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

export interface DataSource {
  /** Most recent 13 weeks, newest first. */
  trends(): Promise<TrendRow[]>;
  segmentRows(): Promise<SegmentRow[]>;
  drivers(filters: DriverFilters): Promise<DriverRow[]>;
  lobSummary(days: number, lob?: string): Promise<LobSummaryRow[]>;
  transcripts(filters: TranscriptFilters): Promise<Transcript[]>;
}

export interface Insight {
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  metrics: { totalCalls: number; avgSentiment: string; escalationRate: string; topDriver: string };
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
    lobs: [...new Set(rows.map(r => r.LINE_OF_BUSINESS))],
    segments: [...new Set(rows.map(r => r.CUSTOMER_SEGMENT))],
    products: [...new Set(rows.map(r => r.PRODUCT_CATEGORY))],
  };
}

export function getDrivers(source: DataSource, filters: DriverFilters): Promise<DriverRow[]> {
  return source.drivers(filters);
}

export function getTranscripts(source: DataSource, filters: TranscriptFilters): Promise<Transcript[]> {
  return source.transcripts(filters);
}

export async function getInsights(source: DataSource, segment: string | undefined, timeframe: Timeframe): Promise<Insight> {
  const days = timeframe === "week" ? 7 : timeframe === "month" ? 30 : 90;
  const callData = await source.lobSummary(days, filterValue(segment));

  const totalCalls = callData.reduce((sum, r) => sum + r.CALL_VOLUME, 0);
  const avgSentiment = callData.length > 0
    ? callData.reduce((sum, r) => sum + r.AVG_SENTIMENT, 0) / callData.length
    : 0;
  const totalEscalations = callData.reduce((sum, r) => sum + r.ESCALATIONS, 0);
  const topDriver = callData[0]?.LINE_OF_BUSINESS || "General Inquiries";
  const escalationRate = totalCalls > 0 ? ((totalEscalations / totalCalls) * 100).toFixed(1) : "0";

  return {
    summary: `Analysis of ${totalCalls.toLocaleString()} calls over the past ${timeframe}. The primary contact driver is "${topDriver}" with an average sentiment score of ${avgSentiment.toFixed(2)}. Escalation rate is ${escalationRate}%.`,
    keyFindings: [
      `${topDriver} accounts for the highest call volume`,
      `Overall sentiment is ${avgSentiment > 0.6 ? "positive" : avgSentiment > 0.4 ? "neutral" : "needs attention"}`,
      `${totalEscalations} calls required escalation (${escalationRate}% rate)`,
      `Common themes include account inquiries, fee questions, and process delays`,
    ],
    recommendations: [
      "Implement self-service options for common account inquiries to reduce call volume",
      "Enhance advisor training on fee explanation to improve first-call resolution",
      "Review rollover process workflow to reduce paperwork-related delays",
      "Consider proactive outreach for high-value clients showing negative sentiment patterns",
    ],
    metrics: { totalCalls, avgSentiment: avgSentiment.toFixed(2), escalationRate, topDriver },
  };
}
