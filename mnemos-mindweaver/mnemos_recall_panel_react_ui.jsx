import React, { useMemo, useState, useEffect, useCallback } from "react";

type Priors = { precision: number; intuition: number; myth: number };
type EvidenceItem = { id: string; snippet: string; meta?: any };
type Layers = {
  codestone?: { id: string; essence: string; archetype?: string; energy_level?: number; domain_tags?: string[]; lineage?: string[] };
  evidence?: EvidenceItem[];
  codecell?: { id: string; name: string; members: { id: string; snippet: string }[]; generative_potential?: number };
  lineage?: { name: string; principle: string };
};
type RecallResponse = { priors: Priors; layers: Layers };

function clamp01(n: number) { return Math.min(1, Math.max(0, n)); }
function sanitizePriors(p?: Partial<Priors>): Priors {
  const a = clamp01(p?.precision ?? 0);
  const b = clamp01(p?.intuition ?? 0);
  const c = clamp01(p?.myth ?? 0);
  const s = a + b + c;
  if (s <= 0) return { precision: 0, intuition: 0, myth: 0 };
  return { precision: a / s, intuition: b / s, myth: c / s };
}
function isLayers(x: any): x is Layers { return x && typeof x === "object"; }

function ThemeToggle({ dark, setDark }: { dark: boolean; setDark: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => setDark(!dark)}
      className={`relative inline-flex items-center h-8 w-16 rounded-full border transition-all duration-300 ${dark ? "bg-zinc-900 border-zinc-700" : "bg-white border-gray-300"}`}
      aria-label="Toggle theme"
    >
      <span className={`absolute inset-0 rounded-full blur-xl opacity-70 transition ${dark ? "bg-gradient-to-r from-fuchsia-600/30 via-cyan-500/20 to-emerald-400/30" : "bg-gradient-to-r from-fuchsia-400/20 via-cyan-400/20 to-emerald-300/20"}`} />
      <span className={`z-10 inline-block h-6 w-6 rounded-full mx-1 transform transition-all duration-300 shadow-lg ${dark ? "translate-x-8 bg-gradient-to-br from-fuchsia-500 to-cyan-400" : "translate-x-0 bg-gradient-to-br from-gray-800 to-gray-600"}`} />
    </button>
  );
}

export default function MnemosRecallPanel() {
  const [text, setText] = useState("Draft a ritual for ingestion that honors half-formed thoughts");
  const [userId, setUserId] = useState("phoenix");
  const [sessionId, setSessionId] = useState("s-001");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<RecallResponse | null>(null);
  const [thumb, setThumb] = useState<"up" | "down" | null>(null);
  const [dark, setDark] = useState<boolean>(true);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("mnemos:theme") : null;
    if (stored === "dark" || stored === "light") setDark(stored === "dark");
    else {
      const prefersDark = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDark(prefersDark);
    }
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("mnemos:theme", dark ? "dark" : "light");
  }, [dark]);

  const priors = sanitizePriors(resp?.priors);
  const layers = isLayers(resp?.layers) ? resp!.layers : {};

  const callRecall = useCallback(async () => {
    const ctrl = new AbortController();
    setLoading(true); setError(null); setThumb(null);
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch("/v1/recall", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId, session_id: sessionId, text }), signal: ctrl.signal });
      if (!r.ok) throw new Error(`Recall failed: ${r.status}`);
      const json = (await r.json()) as RecallResponse;
      setResp(json);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
      setResp({ priors: { precision: 0.18, intuition: 0.54, myth: 0.28 }, layers: { codestone: { id: "cs_mock", essence: "Mock essence", archetype: "Threshold", energy_level: 0.6, domain_tags: ["mock"], lineage: ["shard_1"] }, evidence: [{ id: "shard_1", snippet: "Mock evidence", meta: { source: "chat" } }], codecell: { id: "cc_mock", name: "Mock constellation", members: [], generative_potential: 0.5 }, lineage: { name: "Threshold", principle: "Pause before crossing." } } });
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [userId, sessionId, text]);

  const sendFeedback = useCallback(async (kind: "up" | "down") => {
    setThumb(kind);
    try {
      const lineage = layers && (layers as Layers).lineage?.name;
      const r = await fetch("/v1/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId, event_id: `${Date.now()}`, surfaced: { shards: ((layers as Layers)?.evidence ?? []).map((e: any) => e.id) }, feedback: { lineage, rating: kind === "up" ? 1 : -1 }, outcome: kind === "up" ? "success" : "partial" }) });
      if (!r.ok) throw new Error(`Feedback failed: ${r.status}`);
    } catch (e: any) {
      setError(e?.message ?? "Feedback error");
    }
  }, [layers, userId]);

  const evidenceArr: EvidenceItem[] = useMemo(() => (layers as Layers)?.evidence ?? [], [layers]);
  const EvidenceList = useMemo(() => {
    const ev = evidenceArr;
    if (!ev.length) return <div className={dark ? "text-zinc-400" : "text-gray-500"}>No evidence.</div>;
    const top = ev.slice(0, 20);
    return (
      <ul className="space-y-2">
        {top.map((e) => (
          <li key={e.id} className={`rounded-xl border p-3 ${dark ? "border-zinc-800 bg-zinc-900/60" : "border-gray-200 bg-white"}`}>{e.snippet}</li>
        ))}
      </ul>
    );
  }, [evidenceArr, dark]);

  const rootBg = dark ? "bg-zinc-950 text-zinc-100" : "bg-gradient-to-b from-white to-gray-50 text-gray-900";

  return (
    <div className={`min-h-screen ${rootBg} p-6`}>
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mnemos — Interface of Communion</h1>
            <p className={dark ? "text-zinc-400 text-sm" : "text-gray-600 text-sm"}>Recall with precision, intuition, and myth.</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle dark={dark} setDark={setDark} />
            <div className={dark ? "text-zinc-400 text-xs" : "text-gray-500 text-xs"}>Session: {sessionId}</div>
          </div>
        </header>

        <div className={`rounded-2xl ${dark ? "bg-zinc-900/70 border-zinc-800" : "bg-white/80 border-gray-200"} border p-4 backdrop-blur-md`}>
          <label htmlFor="mnemos-input" className="sr-only">Ask Mnemos</label>
          <textarea id="mnemos-input" className={`w-full rounded-xl border p-3 focus:outline-none focus:ring-2 ${dark ? "border-zinc-800 bg-zinc-900/60 text-zinc-100 focus:ring-fuchsia-400" : "border-gray-200 bg-white text-gray-900 focus:ring-gray-800"}`} rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-busy={loading} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input className={`rounded-lg border px-2 py-1 text-sm ${dark ? "border-zinc-800 bg-zinc-900/60 text-zinc-100" : "border-gray-200 bg-white text-gray-900"}`} value={userId} onChange={(e)=>setUserId(e.target.value)} />
            <input className={`rounded-lg border px-2 py-1 text-sm ${dark ? "border-zinc-800 bg-zinc-900/60 text-zinc-100" : "border-gray-200 bg-white text-gray-900"}`} value={sessionId} onChange={(e)=>setSessionId(e.target.value)} />
            <button type="button" onClick={callRecall} disabled={loading} className={`rounded-xl px-4 py-2 text-sm disabled:opacity-50 ${dark ? "bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white" : "bg-gray-900 text-white"}`}>{loading ? "Recalling..." : "Recall"}</button>
            {thumb && <span className={dark ? "text-zinc-400 text-xs" : "text-gray-500 text-xs"}>Feedback: {thumb}</span>}
          </div>
          {error && <div className="mt-2 text-xs text-rose-400">{String(error)}</div>}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className={`rounded-2xl ${dark ? "bg-zinc-900/70 border-zinc-800" : "bg-white/80 border-gray-200"} border p-4 backdrop-blur-md`}>
            <div className="text-sm font-semibold mb-2">Codestone Essence</div>
            {layers && (layers as Layers).codestone ? (
              <div>
                <div className={dark ? "text-zinc-100" : "text-gray-900"}>{(layers as Layers).codestone!.essence}</div>
                <div className={dark ? "text-zinc-400 text-xs mt-2" : "text-gray-600 text-xs mt-2"}>Archetype: {(layers as Layers).codestone!.archetype ?? ""}</div>
              </div>
            ) : (
              <div className={dark ? "text-zinc-400 text-sm" : "text-gray-500 text-sm"}>No essence yet.</div>
            )}
          </div>

          <div className={`rounded-2xl ${dark ? "bg-zinc-900/70 border-zinc-800" : "bg-white/80 border-gray-200"} border p-4 backdrop-blur-md`}>
            <div className="text-sm font-semibold mb-2">Lineage (Archetype)</div>
            {layers && (layers as Layers).lineage ? (
              <div>
                <div className="text-base font-medium">{(layers as Layers).lineage!.name}</div>
                <p className={dark ? "text-zinc-200 text-sm mt-1" : "text-gray-700 text-sm mt-1"}>{(layers as Layers).lineage!.principle}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={()=>sendFeedback("up")} className={`${dark ? "bg-gradient-to-r from-fuchsia-600 to-cyan-500 text-white" : "border border-gray-900 text-white bg-gray-900"} rounded-xl px-3 py-1.5 text-xs`}>Invoke + Feedback</button>
                  <button type="button" onClick={()=>sendFeedback("down")} className={`${dark ? "border-zinc-700" : "border-gray-300"} rounded-xl border px-3 py-1.5 text-xs`}>Not helpful</button>
                </div>
              </div>
            ) : (
              <div className={dark ? "text-zinc-400 text-sm" : "text-gray-500 text-sm"}>No archetypal guidance yet.</div>
            )}
          </div>
        </div>

        <div className={`rounded-2xl ${dark ? "bg-zinc-900/70 border-zinc-800" : "bg-white/80 border-gray-200"} border p-4 backdrop-blur-md`}>
          <div className="text-sm font-semibold mb-2">Evidence Shards</div>
          {EvidenceList}
        </div>

        <footer className={dark ? "text-zinc-500 text-xs text-center pt-2 pb-6" : "text-gray-500 text-xs text-center pt-2 pb-6"}>Mnemos v0.3</footer>
      </div>
    </div>
  );
}

if (typeof window !== "undefined") {
  const p1 = sanitizePriors({ precision: 2, intuition: 1, myth: 1 });
  const p2 = sanitizePriors({ precision: -1, intuition: 0, myth: 0 });
  const p3 = sanitizePriors(undefined);
  const sum1 = p1.precision + p1.intuition + p1.myth;
  const sum2 = p2.precision + p2.intuition + p2.myth;
  const sum3 = p3.precision + p3.intuition + p3.myth;
  console.assert(Math.abs(sum1 - 1) < 1e-6, "priors normalize");
  console.assert(sum2 === 1 || sum2 === 0, "priors clamp");
  console.assert(sum3 === 0, "priors empty");
}
