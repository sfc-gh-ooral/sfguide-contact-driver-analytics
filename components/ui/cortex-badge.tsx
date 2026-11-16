"use client";

// "Powered by <function>" in Live mode; "Sample AI response" / "Sample data" in Sample mode.
// Only the functions this example actually runs are listed here.
import { Badge } from "@/components/ui/badge";
import { BarChart3, Brain, FlaskConical, Tags } from "lucide-react";

export type CortexFunction = "AI_COMPLETE" | "SENTIMENT" | "AI_CLASSIFY";

const INFO: Record<CortexFunction, { label: string; icon: React.ReactNode; description: string; where: string }> = {
  AI_COMPLETE: {
    label: "AI_COMPLETE",
    icon: <Brain className="h-3 w-3" />,
    description: "Generates text with a large language model. Used for the AI Insights panel (on demand) and per-call summaries (once, in setup).",
    where: "AI_COMPLETE(model, prompt, model_parameters, response_format)",
  },
  SENTIMENT: {
    label: "CORTEX.SENTIMENT",
    icon: <BarChart3 className="h-3 w-3" />,
    description: "Scores each transcript from -1 (negative) to 1 (positive). Computed once in sql/setup.sql.",
    where: "SNOWFLAKE.CORTEX.SENTIMENT(transcript)",
  },
  AI_CLASSIFY: {
    label: "AI_CLASSIFY",
    icon: <Tags className="h-3 w-3" />,
    description: "Assigns each transcript a contact-driver category. Computed once in sql/setup.sql.",
    where: "AI_CLASSIFY(transcript, [categories], {task_description})",
  },
};

export function SampleBadge({ label = "Sample AI response", title }: { label?: string; title?: string }) {
  return (
    <Badge variant="outline" title={title ?? "Sample mode: captured or scripted output, not a live Cortex call"}
      className="gap-1 border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-800 dark:text-amber-200">
      <FlaskConical className="h-3 w-3" aria-hidden />{label}
    </Badge>
  );
}

export function PoweredBy({ fn }: { fn: CortexFunction }) {
  const info = INFO[fn];
  return (
    <Badge variant="outline" title={`${info.description}\n${info.where}`}
      className="gap-1 border-purple-500/20 bg-purple-500/10 px-1.5 py-0 font-mono text-[10px] text-purple-700 dark:text-purple-200">
      {info.icon}Powered by {info.label}
    </Badge>
  );
}

/** The right badge for the current mode. */
export function AiBadge({ fn, sample, sampleLabel }: { fn: CortexFunction; sample: boolean; sampleLabel?: string }) {
  return sample ? <SampleBadge label={sampleLabel} title={`Sample mode: output captured from ${INFO[fn].label} in a live run, not a live call`} /> : <PoweredBy fn={fn} />;
}
