"use client";

// Staged progress for the AI Insights call. The steps name what the live path really does
// (lib/snowflake.ts). Sample mode advances them over the simulated delay; Live mode advances
// them on the same schedule while the real call runs, and holds the last step until it returns.
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export const INSIGHT_STEPS = (model: string) => [
  "Aggregating V_CALL_DRIVER_ANALYSIS by line of business",
  "Totaling calls, escalations, and sentiment by reason in CALL_TRANSCRIPTS",
  `Calling AI_COMPLETE (${model}) with a structured-output schema`,
  "Parsing summary, findings, and recommendations",
];

/** 4 to 8 seconds, with jitter. */
export const sampleDelayMs = () => 4000 + Math.round(Math.random() * 4000);

export function Reasoning({ steps, expectedMs }: { steps: string[]; expectedMs: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - t0), 120);
    return () => window.clearInterval(id);
  }, []);
  const step = Math.min(steps.length - 1, Math.floor(elapsed / (expectedMs / steps.length)));

  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-xl rounded-lg border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="font-semibold text-primary">Working</span>
        <span className="tabular-nums text-muted-foreground">{(elapsed / 1000).toFixed(1)}s</span>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => {
          const state = i < step ? "done" : i === step ? "active" : "todo";
          return (
            <li key={s} className={`flex items-center gap-2 text-sm ${state === "todo" ? "text-muted-foreground" : ""}`}>
              {state === "done" ? <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                : state === "active" ? <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
                : <span className="h-4 w-4 rounded-full border" aria-hidden />}
              <span>{s}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 h-1 overflow-hidden rounded bg-muted" aria-hidden>
        <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(96, (elapsed / expectedMs) * 100)}%` }} />
      </div>
    </div>
  );
}
