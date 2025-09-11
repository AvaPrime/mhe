# apps/api/recall_v1.py
"""
Mnemos — Recall & Feedback API (v0.3.1)

This module exposes two primary endpoints:
  - POST /v1/recall   : Orchestrates three-channel recall (precision / intuition / myth)
  - POST /v1/feedback : Captures user feedback and updates personalization state

Design goals (annotated inline):
  • Keep hot-path work small and cache per-request context (e.g., personal myth)
  • Use hybrid retrieval (BM25 + vector) then add resonance + personalization signals
  • Surface a "harmonic stack" (codestone → evidence → codecell → lineage)
  • Make heuristics configurable; add clear observability touchpoints
"""

from __future__ import annotations
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
import math
import re

# DB / search primitives
from libs.db.db import get_session
from libs.search.hybrid import search_hybrid

# Embeddings (not directly used here but useful for future expansion)
from libs.embeddings.service import embed  # noqa: F401

# Personalization services
from libs.personalization.service import (
    load_personal_myth,
    update_personal_myth_from_feedback,
    recency_boost,
)

# ----------------------------------------------------------------------------
# Router
# ----------------------------------------------------------------------------
router = APIRouter(prefix="/v1", tags=["recall_v1"]) 

# ----------------------------------------------------------------------------
# Pydantic Schemas
# ----------------------------------------------------------------------------
class ContextEvent(BaseModel):
    """Ambient context for a recall invocation.

    Many fields are optional—the API will infer missing ones (sentiment/arousal,
    entropy, time_of_day). Keeping this explicit makes the behavior observable.
    """
    user_id: str = "user"
    session_id: str = "default"
    text: str
    channel: str = "chat"     # chat | task | compose | api
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    time_of_day: Optional[str] = None     # dawn | day | dusk | night
    cadence_ms: Optional[int] = None      # avg latency between recent user turns
    sentiment: Optional[float] = None     # [-1,1]
    arousal: Optional[float] = None       # [0,1]
    entropy: Optional[float] = None       # lexical diversity proxy
    intent_hints: Dict[str, Any] = {}

class ActivationTrace(BaseModel):
    """Minimal feedback payload describing what was surfaced and what the user chose."""
    user_id: str
    event_id: str
    surfaced: Dict[str, List[str]]
    chosen_ids: List[str] = []
    dwell_ms: int = 0
    spawned_artifacts: List[str] = []
    feedback: Optional[Dict[str, Any]] = None
    outcome: str = "success"  # success | partial | miss

# ----------------------------------------------------------------------------
# Lightweight NLP utilities (cheap, dependency-free proxies)
# ----------------------------------------------------------------------------
POS = {"love","great","good","beautiful","yes","wonderful","excited","amazing","alive","inspired"}
NEG = {"hate","bad","no","worse","terrible","stuck","afraid","anxious","sad","angry"}
ARCHETYPE_LEX = {
    "phoenix": "Phoenix",
    "rebirth": "Phoenix",
    "bridge": "Bridge",
    "connect": "Bridge",
    "weave": "Weaver",
    "weaver": "Weaver",
    "mirror": "Mirror",
    "reflect": "Mirror",
    "spiral": "Spiral",
    "cycle": "Spiral",
    "threshold": "Threshold",
    "seed": "Seed",
}

_WORDS = re.compile(r"[\w']+")


def _sentiment_arousal(text: str) -> Tuple[float, float]:
    """Very small heuristic sentiment/arousal estimator.

    • Sentiment: normalized (pos - neg) / total
    • Arousal: scaled by punctuation (!) and absolute sentiment magnitude
    """
    tokens = [t.lower() for t in _WORDS.findall(text)]
    pos = sum(1 for t in tokens if t in POS)
    neg = sum(1 for t in tokens if t in NEG)
    ex = text.count("!")
    sentiment = (pos - neg) / max(1, pos + neg)
    arousal = min(1.0, 0.2 + 0.15 * ex + 0.6 * abs(sentiment))
    return float(sentiment), float(arousal)


def _entropy(text: str) -> float:
    """Lexical diversity proxy: unique / total tokens (0..1)."""
    tokens = [t.lower() for t in _WORDS.findall(text)]
    if not tokens:
        return 0.0
    return round(len(set(tokens)) / len(tokens), 4)


def _time_of_day(dt: datetime) -> str:
    """Coarse local time bucket for light prior shifts."""
    h = dt.hour
    if 5 <= h < 11:
        return "dawn"
    if 11 <= h < 17:
        return "day"
    if 17 <= h < 21:
        return "dusk"
    return "night"

# ----------------------------------------------------------------------------
# Mode classifier → channel priors
# ----------------------------------------------------------------------------
# Expose default weights; keep configurable via environment in future.
MODE_WEIGHTS = {"precision": 0.34, "intuition": 0.33, "myth": 0.33}


def classify_mode(ev: ContextEvent) -> Dict[str, float]:
    """Heuristic bootstrap for channel priors.

    In production, replace/augment with a tiny calibrated model trained on
    ActivationTrace labels. For now, regex cues + time-of-day bias suffice.
    """
    text = ev.text.lower()
    pri = MODE_WEIGHTS.copy()

    # Interrogatives → lean precision
    if re.search(r"\b(when|what|who|where|which|how many|date|first|last)\b", text):
        pri["precision"] += 0.2

    # Creative verbs → lean intuition
    if re.search(r"\b(design|draft|brainstorm|invent|compose|weave|forge)\b", text):
        pri["intuition"] += 0.2

    # Mythic lexicon → lean myth
    if any(k in text for k in ["threshold", "rebirth", "archetype", "myth", "meaning"]):
        pri["myth"] += 0.2

    # Night/dawn bias slightly toward intuition/myth (anecdotally more generative)
    tod = ev.time_of_day or _time_of_day(ev.timestamp)
    if tod in ("night", "dawn"):
        pri["intuition"] += 0.05
        pri["myth"] += 0.05

    # Normalize to a probability simplex
    s = sum(pri.values())
    return {k: v / s for k, v in pri.items()}

# ----------------------------------------------------------------------------
# Resonance & Personalization scoring
# ----------------------------------------------------------------------------

def _cos(a: List[float], b: List[float]) -> float:
    """Cosine similarity safe-guarded to [0,1]."""
    if not a or not b or len(a) != len(b):
        return 0.0
    num = sum(x * y for x, y in zip(a, b))
    da = math.sqrt(sum(x * x for x in a)) or 1.0
    db = math.sqrt(sum(y * y for y in b)) or 1.0
    return max(0.0, min(1.0, num / (da * db)))


def resonance_score(item_meta: Dict[str, Any], ev: ContextEvent, myth: Dict[str, Any]) -> float:
    """Estimate resonance between the current moment and an item.

    Components:
      • Emotional match (sentiment/arousal)
      • Seed continuity (half-formed ideas that recur for this user)
      • Cadence alignment (tempo of the exchange)
      • Momentum proximity (recency/energy stored on the item)
      • Closure conflict penalty (avoid re-opening closed threads when exploring)
    """
    # Emotion: compute from request if absent
    s, a = (ev.sentiment, ev.arousal)
    if s is None or a is None:
        s, a = _sentiment_arousal(ev.text)
    item_sent = float(item_meta.get("sentiment", s))
    item_ar = float(item_meta.get("arousal", a))
    em = _cos([item_sent, item_ar], [s, a])

    # Seed continuity: if user-specific seed-forms appear, boost resonance
    seedness = float(item_meta.get("seedness", 0.2))
    seed_forms = [sf.lower() for sf in myth.get("seed_forms", [])]
    seed_hit = any(sf in ev.text.lower() for sf in seed_forms)
    sd = (0.7 if seed_hit else 0.0) + 0.3 * seedness

    # Cadence: crude alignment (prefer quicker tempo when cadence_ms small)
    ca = 0.5
    if ev.cadence_ms is not None:
        ca = 1.0 - min(1.0, ev.cadence_ms / 60000.0)  # 0..1 (fast→1)

    # Momentum: use item-side hint if present
    mp = float(item_meta.get("momentum", 0.3))

    # Closure conflict: penalize if the item is marked closed but user wants to explore
    cf = 1.0 if (item_meta.get("closure_needed") and ev.intent_hints.get("explore")) else 0.0

    r = 0.35 * em + 0.25 * sd + 0.25 * ca + 0.15 * mp - 0.2 * cf
    return max(0.0, min(1.0, r))


def personalization_score(item_meta: Dict[str, Any], myth: Dict[str, Any]) -> float:
    """Personalization score via archetype affinity, activation recency, and signature match."""
    # Archetype affinity: dot(archetype weights, item archetype vector)
    arch_vec = item_meta.get("archetypes", {})
    aa = 0.0
    for k, w in arch_vec.items():
        aa += float(w) * float(myth.get("archetype_weights", {}).get(k, 0.0))

    # Activation recency/strength (bounded 0..1)
    ab = recency_boost(item_meta.get("activation_count", 0), item_meta.get("last_activated"))

    # Signature match: seed-forms/metaphors embedded in the item
    sig = 0.0
    snippet = (item_meta.get("snippet") or "").lower() + str(item_meta).lower()
    for sf in myth.get("seed_forms", []):
        if sf.lower() in snippet:
            sig += 0.1

    return max(0.0, min(1.0, 0.6 * aa + 0.3 * ab + 0.1 * sig))

# ----------------------------------------------------------------------------
# Layered formatter helpers — create the harmonic stack
# ----------------------------------------------------------------------------

def guess_archetype(text: str) -> Optional[str]:
    """Map free text to a coarse archetype by lexical cue."""
    t = text.lower()
    for k, name in ARCHETYPE_LEX.items():
        if k in t:
            return name
    return None


def make_codestone_summary(items: List[Dict[str, Any]], query: str) -> Dict[str, Any]:
    """Synthesize a short essence summary from top evidence.

    This is a placeholder; a proper distiller would summarize multiple items and
    reference lineage. We keep it simple and explicit for now.
    """
    if not items:
        return {}
    top = items[0]
    snippet = top.get("snippet", "")
    sentences = re.split(r"(?<=[.!?])\s+", snippet)
    essence = " ".join(sentences[:2]).strip() or snippet[:200]
    arche = guess_archetype(snippet) or guess_archetype(query) or "Bridge"
    return {
        "id": f"cs_{top['id']}",
        "essence": essence,
        "context_frame": "Hybrid recall synthesis",
        "resonance_type": "pattern",
        "energy_level": 0.6,
        "domain_tags": list(set(filter(None, [top.get("meta", {}).get("title")]))),
        "archetype": arche,
        "lineage": [top["id"]],
    }


def make_codecell(items: List[Dict[str, Any]], query: str) -> Dict[str, Any]:
    """Assemble a small constellation of the top items with light metadata."""
    if not items:
        return {}
    name = "Constellation: " + (guess_archetype(query) or "Weaver")
    members = [{"id": it["id"], "snippet": it["snippet"][:180]} for it in items[:5]]
    return {
        "id": f"cc_{items[0]['id']}",
        "name": name,
        "description": "Resonant cluster assembled from top hybrid results.",
        "members": members,
        "generative_potential": 0.5 + 0.05 * len(members),
    }


def make_lineage_hint(query: str) -> Optional[Dict[str, Any]]:
    """Offer a principle if the query carries a strong archetypal cue."""
    arch = guess_archetype(query)
    if not arch:
        return None
    principles = {
        "Bridge": "Unite disparate domains through a common form.",
        "Seed": "Nurture the smallest viable spark; protect emergence.",
        "Phoenix": "Let go to transform; rebirth follows dissolution.",
        "Weaver": "Integrate threads; coherence reveals pattern.",
        "Mirror": "Reflect to understand the self-similar.",
        "Spiral": "Return with difference; iterate towards depth.",
        "Threshold": "Pause before crossing; prepare the terms of passage.",
    }
    return {"name": arch, "principle": principles.get(arch, "Follow the pattern’s pull.")}

# ----------------------------------------------------------------------------
# Endpoint: /v1/recall — the interface of communion
# ----------------------------------------------------------------------------
@router.post("/recall")
def recall(ev: ContextEvent):
    """Main recall orchestrator.

    Steps:
      1) Fill missing ambient features (sentiment, arousal, entropy, time-of-day)
      2) Classify mode → channel priors (precision/intuition/myth)
      3) Retrieve candidate evidence via hybrid search
      4) Score each item with resonance + personalization (using cached myth)
      5) Blend by priors and surface the harmonic stack
    """
    # 1) Ambient defaults
    if ev.sentiment is None or ev.arousal is None:
        s, a = _sentiment_arousal(ev.text)
        ev.sentiment, ev.arousal = s, a
    if ev.time_of_day is None:
        ev.time_of_day = _time_of_day(ev.timestamp)
    if ev.entropy is None:
        ev.entropy = _entropy(ev.text)

    # Cache personal myth ONCE per request to avoid repeated DB hits
    myth = load_personal_myth(ev.user_id)

    # 2) Channel priors
    pri = classify_mode(ev)

    # 3) Base retrieval from shards (serves precision + evidence)
    base = search_hybrid(ev.text, k=20)

    # 4) Score candidates with resonance + personalization per channel
    scored: List[Dict[str, Any]] = []
    for it in base:
        # Merge item meta; add snippet to meta for downstream scorers
        meta = {**(it.get("meta") or {}), "snippet": it.get("snippet", "")}
        R = resonance_score(meta, ev, myth)
        P = personalization_score(meta, myth)
        base_score = float(it.get("score", 0.0))
        scored.append(
            {
                "item": it,
                "scores": {
                    # Channel-specific blends (tunable; keep explicit here)
                    "precision": 0.7 * base_score + 0.15 * R + 0.15 * P,
                    "intuition": 0.45 * base_score + 0.35 * R + 0.20 * P,
                    "myth": 0.35 * base_score + 0.25 * R + 0.40 * P,
                },
            }
        )

    # Blend by priors and take top-N
    def blended_score(sc: Dict[str, float]) -> float:
        return sum(pri[ch] * sc[ch] for ch in ("precision", "intuition", "myth"))

    ranked = sorted(scored, key=lambda r: blended_score(r["scores"]), reverse=True)
    items = [r["item"] for r in ranked[:7]]

    # 5) Layered surfacing — the harmonic stack
    codestone = make_codestone_summary(items, ev.text)
    codecell = make_codecell(items, ev.text)
    lineage = make_lineage_hint(ev.text)

    evidence = [
        {"id": it["id"], "snippet": it["snippet"], "meta": it.get("meta", {})}
        for it in items[:5]
    ]

    return {"priors": pri, "layers": {"codestone": codestone, "evidence": evidence, "codecell": codecell, "lineage": lineage}}


# ----------------------------------------------------------------------------
# Endpoint: /v1/feedback — teach Mnemos your preferences
# ----------------------------------------------------------------------------
@router.post("/feedback")
def feedback(trace: ActivationTrace):
    """Persist feedback and update the per-user myth map.

    Expect feedback like: {"lineage": "Bridge", "seed_forms": ["mindkiss"]}
    This function writes an activation trace row and nudges archetype weights.
    """
    update_personal_myth_from_feedback(trace)
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# libs/personalization/models.py — ORM rows for Personal Myth & Traces
# ---------------------------------------------------------------------------
from __future__ import annotations
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, JSON, TIMESTAMP
from datetime import datetime
from libs.db.models import Base

class PersonalMythRow(Base):
    """Single row per user containing the personalization payload (JSON)."""
    __tablename__ = "personal_myth"
    user_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))

class ActivationTraceRow(Base):
    """Immutable log of surfaced results and user choices for learning."""
    __tablename__ = "activation_traces"
    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(100))
    event_id: Mapped[str] = mapped_column(String(120))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True))


# ---------------------------------------------------------------------------
# libs/personalization/service.py — load/save + simple learning updates
# ---------------------------------------------------------------------------
from __future__ import annotations
from datetime import datetime, timezone
from typing import Dict, Any
import math
import uuid

from libs.db.db import get_session
from libs.personalization.models import PersonalMythRow, ActivationTraceRow

# Default myth profile —
# Weights are soft priors; downstream scoring normalizes into [0,1].
DEFAULT_MYTH = {
    "archetype_weights": {
        "Bridge": 0.2,
        "Seed": 0.2,
        "Weaver": 0.2,
        "Phoenix": 0.2,
        "Mirror": 0.1,
        "Spiral": 0.05,
        "Threshold": 0.05,
    },
    "metaphor_map": {},
    "cadence_profile": {},
    "seed_forms": ["what if", "maybe", "seed", "bridge", "weave"],
    "rerank_bias": {},
}


def load_personal_myth(user_id: str) -> Dict[str, Any]:
    """Load or initialize the user's myth profile.

    NOTE: Table creation belongs in migrations/startup; avoid ensure_tables() here.
    """
    with get_session() as s:
        row = s.get(PersonalMythRow, user_id)
        if not row:
            row = PersonalMythRow(
                user_id=user_id,
                data=DEFAULT_MYTH.copy(),
                updated_at=datetime.now(timezone.utc),
            )
            s.merge(row)
            s.commit()
        return row.data


def save_personal_myth(user_id: str, data: Dict[str, Any]):
    """Persist the user's myth profile."""
    with get_session() as s:
        row = s.get(PersonalMythRow, user_id)
        now = datetime.now(timezone.utc)
        if not row:
            row = PersonalMythRow(user_id=user_id, data=data, updated_at=now)
        else:
            row.data = data
            row.updated_at = now
        s.merge(row)
        s.commit()


def _age_seconds(dt: Any) -> float:
    """Return age in seconds from a timestamp-like value; 0 if unknown."""
    try:
        if isinstance(dt, str):
            # Best-effort parse common ISO formats; fallback to 0 on failure
            return max(0.0, (datetime.now(timezone.utc) - datetime.fromisoformat(dt)).total_seconds())
        if isinstance(dt, datetime):
            return max(0.0, (datetime.now(timezone.utc) - dt).total_seconds())
    except Exception:
        return 0.0
    return 0.0


def recency_boost(activation_count: int, last_activated: Any) -> float:
    """Bounded boost using count saturation + exponential time decay.

    • Count term: log1p(count) / 5 → gentle saturation in [0,~0.3]
    • Time decay: exp(-age / τ) with τ≈7 days → fresher = stronger
    • Final clamp to [0,1]
    """
    if activation_count <= 0:
        return 0.0
    count_term = math.log1p(activation_count) / 5.0
    age = _age_seconds(last_activated)
    tau = 7 * 24 * 3600  # ~1 week, tuneable
    decay = math.exp(-age / tau) if age > 0 else 1.0
    return max(0.0, min(1.0, count_term * decay))


def update_personal_myth_from_feedback(trace) -> None:
    """Write activation trace and nudge archetype weights / seed-forms.

    Idempotence: feedback writes are append-only; repeated calls simply log more
    traces and apply small weight updates. A downstream batch job can denoise.
    """
    # Persist trace
    with get_session() as s:
        s.merge(
            ActivationTraceRow(
                id=str(uuid.uuid4()),
                user_id=trace.user_id,
                event_id=trace.event_id,
                payload=trace.model_dump(),
                created_at=datetime.now(timezone.utc),
            )
        )
        s.commit()

    # Update myth
    myth = load_personal_myth(trace.user_id)
    arch = myth.get("archetype_weights", {})

    # If a lineage was affirmed, nudge its weight and renormalize
    if trace.feedback and isinstance(trace.feedback, dict):
        chosen_lineage = trace.feedback.get("lineage")
        new_seeds = trace.feedback.get("seed_forms", [])
        if chosen_lineage:
            arch[chosen_lineage] = min(1.0, arch.get(chosen_lineage, 0.0) + 0.05)
            total = sum(arch.values()) or 1.0
            arch = {k: v / total for k, v in arch.items()}
            myth["archetype_weights"] = arch
        # Extend seed-forms with any new phrases
        if new_seeds:
            myth.setdefault("seed_forms", [])
            for sf in new_seeds:
                sf_l = sf.lower()
                if sf_l not in myth["seed_forms"]:
                    myth["seed_forms"].append(sf_l)

    save_personal_myth(trace.user_id, myth)


# ---------------------------------------------------------------------------
# apps/api/main.py (patch) — include the router
# ---------------------------------------------------------------------------
from fastapi import FastAPI
from libs.db.db import ensure_tables
from apps.api.recall_v1 import router as recall_v1_router

app = FastAPI(title="Mnemos API", version="0.3.1")

@app.on_event("startup")
def startup():
    # Centralize DDL/bootstrap in migrations; this call remains for dev ergonomics
    ensure_tables()

@app.get("/health")
def health():
    return {"status": "ok"}

# Mount the Recall & Feedback API
app.include_router(recall_v1_router)
