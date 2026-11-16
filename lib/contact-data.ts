// Shared response shaping for every data source (Snowflake or built-in sample data).
// Nothing in this file may import Node-only modules: the hosted example runs it in the browser.

export interface TrendRow {
  WEEK_START: string;
  TOTAL_CALLS: number;
  OVERALL_SENTIMENT: number;
  TOTAL_ESCALATIONS: number;
  ESCALATION_RATE: number;
  AVG_CALL_DURATION_SEC: number;
}

export interface SegmentRow {
  LINE_OF_BUSINESS: string;
  PRODUCT_CATEGORY: string;
  CUSTOMER_SEGMENT: string;
}

export interface DriverRow {
  LINE_OF_BUSINESS: string;
  PRODUCT_CATEGORY: string;
  CUSTOMER_SEGMENT: string;
  CALLER_TYPE: string;
  CALL_VOLUME: number;
  AVG_DURATION: number;
  AVG_SENTIMENT: number;
  ESCALATIONS: number;
  RESOLUTION_RATE: number;
}

export interface LobSummaryRow {
  LINE_OF_BUSINESS: string;
  CALL_VOLUME: number;
  AVG_SENTIMENT: number;
  ESCALATIONS: number;
}

export interface ReasonSummaryRow {
  CALL_REASON: string;
  CALL_VOLUME: number;
  ESCALATIONS: number;
  AVG_SENTIMENT: number;
}

export interface Transcript {
  CALL_ID: string;
  CALL_DATE: string;
  CALL_TIME: string;
  DURATION_SECONDS: number;
  LINE_OF_BUSINESS: string;
  CALL_DISPOSITION: string;
  CALL_REASON: string;
  CUSTOMER_SEGMENT: string;
  TRANSCRIPT: string;
  SENTIMENT_SCORE: number;
  AI_SUMMARY: string;
  AI_DRIVER: string;
  ESCALATED: boolean;
}

export interface DriverFilters {
  lob?: string;
  segment?: string;
}

export interface TranscriptFilters extends DriverFilters {
  week?: string;
  escalated?: boolean;
  limit: number;
}

export type Timeframe = "week" | "month" | "quarter";

/** Every window is relative to the latest call in the data set, so the synthetic data never goes stale. */
export interface DataSource {
  /** All 13 weeks, newest first. */
  trends(): Promise<TrendRow[]>;
  segmentRows(): Promise<SegmentRow[]>;
  /** Drivers for the weeks starting within 30 days of the latest call. */
  drivers(filters: DriverFilters): Promise<DriverRow[]>;
  /** Totals per line of business for the weeks starting within `days` of the latest call. */
  lobSummary(days: number, lob?: string): Promise<LobSummaryRow[]>;
  /** Totals per call reason over the same window. */
  reasonSummary(days: number, lob?: string): Promise<ReasonSummaryRow[]>;
  transcripts(filters: TranscriptFilters): Promise<Transcript[]>;
}

export interface InsightMetrics {
  totalCalls: number;
  avgSentiment: string;
  escalationRate: string;
  topDriver: string;
}

export interface Insight {
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  metrics: InsightMetrics;
  /** "sample": scripted text on sample data. "live": AI_COMPLETE in your account. */
  source: "sample" | "live";
  model?: string;
  latencyMs?: number;
}

export interface InsightStats {
  timeframe: Timeframe;
  lob?: string;
  lobs: LobSummaryRow[];
  reasons: ReasonSummaryRow[];
  metrics: InsightMetrics;
  totalEscalations: number;
}

// ---------- Input parsing (the only way request values reach a data source) ----------

const WEEK_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function filterValue(value: string | null | undefined): string | undefined {
  return value && value !== "all" ? value.slice(0, 100) : undefined;
}

export function parseDriverFilters(params: URLSearchParams): DriverFilters {
  return { lob: filterValue(params.get("lob")), segment: filterValue(params.get("segment")) };
}

export function parseTranscriptFilters(params: URLSearchParams): TranscriptFilters {
  const week = params.get("week");
  const limit = Number.parseInt(params.get("limit") ?? "50", 10);
  return {
    ...parseDriverFilters(params),
    week: week && WEEK_PATTERN.test(week) ? week : undefined,
    escalated: params.get("escalated") === "true",
    limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50,
  };
}

export function parseTimeframe(value: unknown): Timeframe {
  return value === "week" || value === "month" ? value : "quarter";
}

// ---------- Responses ----------

export async function getTrends(source: DataSource): Promise<TrendRow[]> {
  return (await source.trends()).reverse();
}

export async function getSegments(source: DataSource) {
  const rows = await source.segmentRows();
  return {
    lobs: [...new Set(rows.map(r => r.LINE_OF_BUSINESS))].sort(),
    segments: [...new Set(rows.map(r => r.CUSTOMER_SEGMENT))].sort(),
    products: [...new Set(rows.map(r => r.PRODUCT_CATEGORY))].sort(),
  };
}

export function getDrivers(source: DataSource, filters: DriverFilters): Promise<DriverRow[]> {
  return source.drivers(filters);
}

export function getTranscripts(source: DataSource, filters: TranscriptFilters): Promise<Transcript[]> {
  return source.transcripts(filters);
}

export const timeframeDays = (t: Timeframe) => (t === "week" ? 7 : t === "month" ? 30 : 90);
const TIMEFRAME_LABEL: Record<Timeframe, string> = { week: "past week", month: "past month", quarter: "past quarter" };
const pct = (n: number, d: number) => (d > 0 ? ((n / d) * 100).toFixed(1) : "0");

/** The aggregated numbers behind the AI Insights panel (no AI involved). */
export async function getInsightStats(source: DataSource, lobParam: string | undefined, timeframe: Timeframe): Promise<InsightStats> {
  const lob = filterValue(lobParam);
  const days = timeframeDays(timeframe);
  const [lobs, reasons] = await Promise.all([source.lobSummary(days, lob), source.reasonSummary(days, lob)]);
  const totalCalls = lobs.reduce((sum, r) => sum + r.CALL_VOLUME, 0);
  const totalEscalations = lobs.reduce((sum, r) => sum + r.ESCALATIONS, 0);
  const avgSentiment = totalCalls > 0 ? lobs.reduce((sum, r) => sum + r.AVG_SENTIMENT * r.CALL_VOLUME, 0) / totalCalls : 0;
  return {
    timeframe, lob, lobs, reasons, totalEscalations,
    metrics: {
      totalCalls,
      avgSentiment: avgSentiment.toFixed(2),
      escalationRate: pct(totalEscalations, totalCalls),
      topDriver: reasons[0]?.CALL_REASON ?? "n/a",
    },
  };
}

/** Prompt for AI_COMPLETE: aggregated synthetic numbers only, no transcript text. */
export function insightPrompt(stats: InsightStats): string {
  const scope = stats.lob ? `the ${stats.lob} line of business` : "all lines of business";
  const line = (name: string, r: { CALL_VOLUME: number; ESCALATIONS: number; AVG_SENTIMENT: number }) =>
    `- ${name}: ${r.CALL_VOLUME} calls, ${r.ESCALATIONS} escalations (${pct(r.ESCALATIONS, r.CALL_VOLUME)}%), avg sentiment ${r.AVG_SENTIMENT.toFixed(2)}`;
  return [
    "You are a contact-center analyst at Northwind Financial, a fictional financial services firm. The data is synthetic.",
    `Analyze call drivers for ${scope} over the ${TIMEFRAME_LABEL[stats.timeframe]}.`,
    `Totals: ${stats.metrics.totalCalls} calls, ${stats.totalEscalations} escalations (${stats.metrics.escalationRate}%), average sentiment ${stats.metrics.avgSentiment} on a -1 to 1 scale.`,
    "By line of business:", ...stats.lobs.map(r => line(r.LINE_OF_BUSINESS, r)),
    "By call reason:", ...stats.reasons.map(r => line(r.CALL_REASON, r)),
    "Write a 2-3 sentence executive summary, exactly 4 key findings that cite the numbers above, and exactly 4 practical recommendations to reduce repeat calls and escalations.",
    "Use only the numbers given. Do not invent figures, people, or products.",
  ].join("\n");
}

/** Scripted insight for Sample mode, built from the same aggregated numbers. */
export function sampleInsight(stats: InsightStats): Insight {
  const { metrics, reasons } = stats;
  const top = reasons[0];
  const worst = [...reasons].sort((a, b) => b.ESCALATIONS / b.CALL_VOLUME - a.ESCALATIONS / a.CALL_VOLUME)[0];
  const lowest = [...reasons].sort((a, b) => a.AVG_SENTIMENT - b.AVG_SENTIMENT)[0];
  const scope = stats.lob ?? "all lines of business";
  return {
    source: "sample",
    metrics,
    summary: `Over the ${TIMEFRAME_LABEL[stats.timeframe]}, ${scope} handled ${metrics.totalCalls.toLocaleString()} calls with a ${metrics.escalationRate}% escalation rate and an average sentiment of ${metrics.avgSentiment}. `
      + (top ? `${top.CALL_REASON} is the largest driver at ${pct(top.CALL_VOLUME, metrics.totalCalls)}% of calls${worst && worst !== top ? `, while ${worst.CALL_REASON} calls escalate most often` : ""}.` : "No calls matched."),
    keyFindings: [
      top && `${top.CALL_REASON} drives ${top.CALL_VOLUME.toLocaleString()} calls (${pct(top.CALL_VOLUME, metrics.totalCalls)}% of volume).`,
      worst && `${worst.CALL_REASON} has the highest escalation rate at ${pct(worst.ESCALATIONS, worst.CALL_VOLUME)}%.`,
      lowest && `${lowest.CALL_REASON} calls have the lowest average sentiment (${lowest.AVG_SENTIMENT.toFixed(2)}).`,
      `${stats.totalEscalations.toLocaleString()} calls were escalated in total.`,
    ].filter((x): x is string => Boolean(x)),
    recommendations: [
      top ? `Publish a clear self-service explainer for ${top.CALL_REASON.toLowerCase()} topics and link it from statements.` : "Review routing for the busiest queues.",
      worst ? `Give agents a ${worst.CALL_REASON.toLowerCase()} playbook with an early hand-off path to reduce escalations.` : "Review escalation criteria.",
      lowest ? `Review a sample of ${lowest.CALL_REASON.toLowerCase()} calls each week to find root causes of low sentiment.` : "Sample low-sentiment calls weekly.",
      "Track these drivers weekly and set targets for repeat-call and escalation rates.",
    ],
  };
}
