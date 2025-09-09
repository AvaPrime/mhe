
from __future__ import annotations
from typing import List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from mhe.memory.models import MemoryCard, Consolidation

# --- Mock LLM synth ----------------------------------------------------------
async def _mock_llm_summarize(cards: List[MemoryCard]) -> str:
    """
    Produce a markdown synthesis from MemoryCards.
    """
    if not cards:
        return "# Weekly Synthesis\n\n_No memory cards in this window._\n"

    lines = ["# Weekly Synthesis",
             "",
             "## Key Decisions",
             ]
    # naive: any card with tag containing 'decision' or summary with 'implement'/'define'
    decisions = [c for c in cards if (c.tags and any('decision' in t for t in c.tags)) or ('implement' in c.summary.lower() or 'define' in c.summary.lower())]
    if decisions:
        for c in decisions[:20]:
            lines.append(f"- {c.summary}")
    else:
        lines.append("- (none detected)")

    lines += ["", "## Emergent Themes"]
    # themes: top tags
    tag_counts = {}
    for c in cards:
        for t in (c.tags or []):
            tag_counts[t] = tag_counts.get(t, 0) + 1
    if tag_counts:
        top = sorted(tag_counts.items(), key=lambda kv: kv[1], reverse=True)[:10]
        for t, n in top:
            lines.append(f"- **{t}** × {n}")
    else:
        lines.append("- (no tags)")

    lines += ["", "## Open Questions"]
    # naive: look for '?' in summaries
    questions = [c for c in cards if '?' in c.summary]
    if questions:
        for c in questions[:10]:
            lines.append(f"- {c.summary}")
    else:
        lines.append("- (none detected)")

    lines += ["", "## Source Provenance"]
    for c in cards[:20]:
        lines.append(f"- Card `{c.id}` — {c.summary}")

    return "\n".join(lines)

# --- Job ---------------------------------------------------------------------
async def run_consolidation_job(session: AsyncSession, window_start: datetime, window_end: datetime) -> Consolidation:
    """
    Gather MemoryCards in [window_start, window_end), synthesize a markdown report,
    and return an uncommitted Consolidation row.
    """
    stmt = select(MemoryCard).where(
        MemoryCard.created_at >= window_start,
        MemoryCard.created_at < window_end,
    ).order_by(MemoryCard.created_at.asc())
    res = await session.execute(stmt)
    cards = res.scalars().all()

    report_md = await _mock_llm_summarize(cards)

    cons = Consolidation(
        window_start=window_start,
        window_end=window_end,
        report_md=report_md,
    )
    return cons
