// Built-in synthetic sample data. Runs on the server and in the browser (Sample mode and the hosted example).
// Same calls as sql/setup.sql loads (lib/synthetic.ts); sentiment, AI summary, and AI driver are
// Cortex outputs captured from a live run (lib/sample-ai.ts). Aggregations mirror the SQL views.
import type { DataSource, DriverRow, LobSummaryRow, ReasonSummaryRow, SegmentRow, Transcript, TrendRow } from "./contact-data";
import { SAMPLE_TRANSCRIPT_AI } from "./sample-ai";
import { generateCalls, templateBaseDurations, type SyntheticCall } from "./synthetic";
import { TRANSCRIPT_TEMPLATES } from "./transcript-templates";

type Call = SyntheticCall & { CALL_REASON: string; SENTIMENT_SCORE: number; WEEK_START: string };

const DAY = 86_400_000;
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dayMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
/** Monday of the call's week (matches DAYOFWEEKISO in the SQL views). */
const weekStart = (iso: string) => toIso(dayMs(iso) - ((new Date(dayMs(iso)).getUTCDay() + 6) % 7) * DAY);

let cache: { calls: Call[]; latest: string } | null = null;
function data() {
  if (!cache) {
    const calls = generateCalls(templateBaseDurations(TRANSCRIPT_TEMPLATES.map(t => t.transcript))).map(c => ({
      ...c,
      CALL_REASON: TRANSCRIPT_TEMPLATES[c.TEMPLATE_ID].reason,
      SENTIMENT_SCORE: SAMPLE_TRANSCRIPT_AI[c.TEMPLATE_ID].sentiment,
      WEEK_START: weekStart(c.CALL_DATE),
    }));
    cache = { calls, latest: calls.reduce((m, c) => (c.CALL_DATE > m ? c.CALL_DATE : m), "") };
  }
  return cache;
}

/** Calls in weeks starting on or after (latest call - days), optionally for one line of business. */
function windowCalls(days: number, lob?: string) {
  const { calls, latest } = data();
  const from = toIso(dayMs(latest) - days * DAY);
  return calls.filter(c => c.WEEK_START >= from && (!lob || c.LINE_OF_BUSINESS === lob));
}

function group<T>(calls: Call[], key: (c: Call) => string, row: (cs: Call[]) => T): T[] {
  const groups = new Map<string, Call[]>();
  for (const c of calls) {
    const k = key(c);
    const g = groups.get(k);
    if (g) g.push(c); else groups.set(k, [c]);
  }
  return [...groups.values()].map(row);
}

const sum = (cs: Call[], f: (c: Call) => number) => cs.reduce((s, c) => s + f(c), 0);
const avg = (cs: Call[], f: (c: Call) => number) => sum(cs, f) / cs.length;
const escalations = (cs: Call[]) => cs.filter(c => c.ESCALATED).length;
const byVolume = <T extends { CALL_VOLUME: number }>(rows: T[], name: (r: T) => string) =>
  rows.sort((a, b) => b.CALL_VOLUME - a.CALL_VOLUME || name(a).localeCompare(name(b)));

function trends(): TrendRow[] {
  return group(data().calls, c => c.WEEK_START, cs => ({
    WEEK_START: cs[0].WEEK_START,
    TOTAL_CALLS: cs.length,
    OVERALL_SENTIMENT: avg(cs, c => c.SENTIMENT_SCORE),
    TOTAL_ESCALATIONS: escalations(cs),
    ESCALATION_RATE: (escalations(cs) * 100) / cs.length,
    AVG_CALL_DURATION_SEC: avg(cs, c => c.DURATION_SECONDS),
  })).sort((a, b) => b.WEEK_START.localeCompare(a.WEEK_START));
}

function drivers(lob?: string, segment?: string): DriverRow[] {
  const calls = windowCalls(30, lob).filter(c => !segment || c.CUSTOMER_SEGMENT === segment);
  const rows = group(calls, c => [c.LINE_OF_BUSINESS, c.PRODUCT_CATEGORY, c.CUSTOMER_SEGMENT, c.CALLER_TYPE].join("|"), cs => ({
    LINE_OF_BUSINESS: cs[0].LINE_OF_BUSINESS,
    PRODUCT_CATEGORY: cs[0].PRODUCT_CATEGORY,
    CUSTOMER_SEGMENT: cs[0].CUSTOMER_SEGMENT,
    CALLER_TYPE: cs[0].CALLER_TYPE,
    CALL_VOLUME: cs.length,
    AVG_DURATION: avg(cs, c => c.DURATION_SECONDS),
    AVG_SENTIMENT: avg(cs, c => c.SENTIMENT_SCORE),
    ESCALATIONS: escalations(cs),
    RESOLUTION_RATE: (cs.filter(c => c.CALL_DISPOSITION === "Resolved").length * 100) / cs.length,
  }));
  return byVolume(rows, r => [r.LINE_OF_BUSINESS, r.PRODUCT_CATEGORY, r.CUSTOMER_SEGMENT, r.CALLER_TYPE].join("|")).slice(0, 200);
}

function lobSummary(days: number, lob?: string): LobSummaryRow[] {
  return byVolume(group(windowCalls(days, lob), c => c.LINE_OF_BUSINESS, cs => ({
    LINE_OF_BUSINESS: cs[0].LINE_OF_BUSINESS,
    CALL_VOLUME: cs.length,
    AVG_SENTIMENT: avg(cs, c => c.SENTIMENT_SCORE),
    ESCALATIONS: escalations(cs),
  })), r => r.LINE_OF_BUSINESS);
}

function reasonSummary(days: number, lob?: string): ReasonSummaryRow[] {
  return byVolume(group(windowCalls(days, lob), c => c.CALL_REASON, cs => ({
    CALL_REASON: cs[0].CALL_REASON,
    CALL_VOLUME: cs.length,
    ESCALATIONS: escalations(cs),
    AVG_SENTIMENT: avg(cs, c => c.SENTIMENT_SCORE),
  })), r => r.CALL_REASON);
}

function segmentRows(): SegmentRow[] {
  const seen = new Map<string, SegmentRow>();
  for (const c of data().calls) {
    const k = `${c.LINE_OF_BUSINESS}|${c.PRODUCT_CATEGORY}|${c.CUSTOMER_SEGMENT}`;
    if (!seen.has(k)) seen.set(k, { LINE_OF_BUSINESS: c.LINE_OF_BUSINESS, PRODUCT_CATEGORY: c.PRODUCT_CATEGORY, CUSTOMER_SEGMENT: c.CUSTOMER_SEGMENT });
  }
  return [...seen.values()];
}

function toTranscript(c: Call): Transcript {
  const ai = SAMPLE_TRANSCRIPT_AI[c.TEMPLATE_ID];
  return {
    CALL_ID: c.CALL_ID,
    CALL_DATE: c.CALL_DATE,
    CALL_TIME: c.CALL_TIME,
    DURATION_SECONDS: c.DURATION_SECONDS,
    LINE_OF_BUSINESS: c.LINE_OF_BUSINESS,
    CALL_DISPOSITION: c.CALL_DISPOSITION,
    CALL_REASON: c.CALL_REASON,
    CUSTOMER_SEGMENT: c.CUSTOMER_SEGMENT,
    TRANSCRIPT: TRANSCRIPT_TEMPLATES[c.TEMPLATE_ID].transcript,
    SENTIMENT_SCORE: c.SENTIMENT_SCORE,
    AI_SUMMARY: ai.summary,
    AI_DRIVER: ai.driver,
    ESCALATED: c.ESCALATED,
  };
}

export const mockSource: DataSource = {
  trends: async () => trends(),
  segmentRows: async () => segmentRows(),
  drivers: async ({ lob, segment }) => drivers(lob, segment),
  lobSummary: async (days, lob) => lobSummary(days, lob),
  reasonSummary: async (days, lob) => reasonSummary(days, lob),
  transcripts: async ({ lob, segment, week, escalated, limit }) =>
    data().calls
      .filter(c => (!lob || c.LINE_OF_BUSINESS === lob)
        && (!segment || c.CUSTOMER_SEGMENT === segment)
        && (!week || c.WEEK_START === week)
        && (!escalated || c.ESCALATED))
      .sort((a, b) => (b.CALL_DATE + b.CALL_TIME + b.CALL_ID).localeCompare(a.CALL_DATE + a.CALL_TIME + a.CALL_ID))
      .slice(0, limit)
      .map(toTranscript),
};
