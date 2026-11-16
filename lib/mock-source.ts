// Built-in synthetic sample data. Runs on the server (no Snowflake configured) and in the browser (hosted example).
import type { DataSource, DriverRow, LobSummaryRow, SegmentRow, Transcript, TrendRow } from "./contact-data";
import { TRANSCRIPT_TEMPLATES } from "./transcript-templates";

const LOBS = ["Retirement Services", "Investment Products", "Insurance Solutions", "Advisory Services", "Brokerage Operations"];
const PRODUCTS = ["IRA/401k", "Mutual Funds", "Annuities", "Life Insurance", "Fee-Based Advisory", "Trading/Execution"];
const SEGMENTS = ["High Net Worth", "Mass Affluent", "Emerging Affluent", "General"];
const CALLER_TYPES = ["Advisor", "Client", "Branch Staff"];
const DISPOSITIONS = ["Resolved", "Follow-up Required", "Transferred", "Escalated"];

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const isoDate = (date: Date) => date.toISOString().split("T")[0];

function trends(): TrendRow[] {
  const weeks: TrendRow[] = [];
  const baseCallsPerWeek = 2800;
  for (let i = 0; i <= 12; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i * 7);
    const seasonalFactor = 1 + 0.1 * Math.sin((i / 12) * Math.PI);
    const totalCalls = Math.floor(baseCallsPerWeek * seasonalFactor * (0.9 + Math.random() * 0.2));
    weeks.push({
      WEEK_START: isoDate(date),
      TOTAL_CALLS: totalCalls,
      OVERALL_SENTIMENT: 0.45 + Math.random() * 0.20,
      TOTAL_ESCALATIONS: Math.floor(totalCalls * (0.08 + Math.random() * 0.04)),
      ESCALATION_RATE: 8 + Math.random() * 4,
      AVG_CALL_DURATION_SEC: 380 + Math.floor(Math.random() * 80),
    });
  }
  return weeks;
}

function drivers(lob?: string, segment?: string): DriverRow[] {
  const rows: DriverRow[] = [];
  for (let i = 0; i < 25; i++) {
    rows.push({
      LINE_OF_BUSINESS: lob ?? LOBS[i % LOBS.length],
      PRODUCT_CATEGORY: pick(PRODUCTS),
      CUSTOMER_SEGMENT: segment ?? pick(SEGMENTS),
      CALLER_TYPE: pick(CALLER_TYPES),
      CALL_VOLUME: 400 + Math.floor(Math.random() * 600),
      AVG_DURATION: 300 + Math.floor(Math.random() * 300),
      AVG_SENTIMENT: 0.35 + Math.random() * 0.45,
      ESCALATIONS: Math.floor(Math.random() * 50),
      RESOLUTION_RATE: 60 + Math.random() * 30,
    });
  }
  return rows.sort((a, b) => b.CALL_VOLUME - a.CALL_VOLUME);
}

function lobSummary(days: number, lob?: string): LobSummaryRow[] {
  const scale = days / 30;
  const totals = new Map<string, LobSummaryRow & { count: number }>();
  for (const row of drivers(lob)) {
    const entry = totals.get(row.LINE_OF_BUSINESS) ?? { LINE_OF_BUSINESS: row.LINE_OF_BUSINESS, CALL_VOLUME: 0, AVG_SENTIMENT: 0, ESCALATIONS: 0, count: 0 };
    entry.CALL_VOLUME += Math.round(row.CALL_VOLUME * scale);
    entry.ESCALATIONS += Math.round(row.ESCALATIONS * scale);
    entry.AVG_SENTIMENT += row.AVG_SENTIMENT;
    entry.count += 1;
    totals.set(row.LINE_OF_BUSINESS, entry);
  }
  return [...totals.values()]
    .map(({ count, ...row }) => ({ ...row, AVG_SENTIMENT: row.AVG_SENTIMENT / count }))
    .sort((a, b) => b.CALL_VOLUME - a.CALL_VOLUME);
}

function segmentRows(): SegmentRow[] {
  return LOBS.map((lob, i) => ({ LINE_OF_BUSINESS: lob, PRODUCT_CATEGORY: PRODUCTS[i === 4 ? 5 : i === 3 ? 4 : i], CUSTOMER_SEGMENT: SEGMENTS[i % SEGMENTS.length] }));
}

function transcripts(): Transcript[] {
  const rows: Transcript[] = [];
  for (let i = 0; i < 100; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 90));
    const hours = 8 + Math.floor(Math.random() * 10);
    const mins = Math.floor(Math.random() * 60);
    const transcriptIndex = i % TRANSCRIPT_TEMPLATES.length;
    const template = TRANSCRIPT_TEMPLATES[transcriptIndex];
    const sentiment = Math.max(-1, Math.min(1, template.sentiment + (Math.random() - 0.5) * 0.15));
    const escalated = sentiment < -0.4 || (template.reason === "Complaint" && Math.random() < 0.7);
    const wordCount = template.transcript.split(/\s+/).length;
    const duration = Math.max(180, Math.floor(wordCount * 1.8) + Math.floor(Math.random() * 120) - 60);
    rows.push({
      CALL_ID: `CALL-${String(10000 + i + i * 17).padStart(8, "0")}`,
      CALL_DATE: isoDate(date),
      CALL_TIME: `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`,
      DURATION_SECONDS: duration,
      LINE_OF_BUSINESS: LOBS[(transcriptIndex + Math.floor(i / TRANSCRIPT_TEMPLATES.length)) % LOBS.length],
      CALL_DISPOSITION: escalated ? "Escalated" : DISPOSITIONS[Math.floor(Math.random() * (DISPOSITIONS.length - 1))],
      CALL_REASON: template.reason,
      CUSTOMER_SEGMENT: SEGMENTS[Math.floor(i / 4) % SEGMENTS.length],
      TRANSCRIPT: template.transcript,
      SENTIMENT_SCORE: sentiment,
      ESCALATED: escalated,
    });
  }
  return rows.sort((a, b) => (b.CALL_DATE + b.CALL_TIME).localeCompare(a.CALL_DATE + a.CALL_TIME));
}

// Sample weeks are not Monday-aligned, so a week filter means the 7 days starting on that date.
function inWeek(isoDay: string, week: string): boolean {
  const days = (Date.parse(`${isoDay}T00:00:00Z`) - Date.parse(`${week}T00:00:00Z`)) / 86_400_000;
  return days >= 0 && days < 7;
}

export const mockSource: DataSource = {
  trends: async () => trends(),
  segmentRows: async () => segmentRows(),
  drivers: async ({ lob, segment }) => drivers(lob, segment),
  lobSummary: async (days, lob) => lobSummary(days, lob),
  transcripts: async ({ lob, segment, week, escalated, limit }) =>
    transcripts()
      .filter(t => (!lob || t.LINE_OF_BUSINESS === lob)
        && (!segment || t.CUSTOMER_SEGMENT === segment)
        && (!week || inWeek(t.CALL_DATE, week))
        && (!escalated || t.ESCALATED))
      .slice(0, limit),
};
