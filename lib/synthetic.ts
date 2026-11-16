// Deterministic synthetic call log for Northwind Financial (a fictional firm).
// The same rules run in three places and must stay in sync:
//   - here (sample mode, in the server or the browser),
//   - sql/setup.sql (live mode; the SYN_* SQL functions and CALLS insert), which
//     scripts/generate-sql.mjs regenerates from this file.
// No imports: scripts/generate-sql.mjs loads this file directly with Node.

export const SNAPSHOT_FIRST_WEEK = "2026-08-17"; // a Monday; 13 weeks end 2026-11-15
export const WEEKS = 13;
export const SLOTS = 270; // max calls per week

export const LOBS = ["Retirement Services", "Investment Products", "Insurance Solutions", "Advisory Services", "Brokerage Operations"];
export const PRODUCTS = ["IRA/401k", "Mutual Funds", "Annuities", "Life Insurance", "Fee-Based Advisory", "Trading/Execution"];
export const SEGMENTS = ["High Net Worth", "Mass Affluent", "Emerging Affluent", "General"];
export const CALLER_TYPES = ["Advisor", "Client", "Branch Staff"];
// Two product options per line of business (indexes into PRODUCTS).
export const LOB_PRODUCTS = [[0, 1], [1, 5], [2, 3], [4, 1], [5, 0]];
// Per template (same order as TRANSCRIPT_TEMPLATES): usual line of business and escalation chance (per mille).
export const TEMPLATE_LOB = [4, 0, 3, 3, 4, 0, 2, 1, 1, 3];
export const TEMPLATE_ESCALATION = [30, 60, 30, 180, 300, 80, 40, 30, 650, 40];
export const FEE_TEMPLATE = 3; // "Fee Question" grows week over week

const U32 = 4294967296;

/** Integer hash of (i, k) in [0, 2^32). Mirrored exactly by SYN_HASH in sql/setup.sql. */
export function synHash(i: number, k: number): number {
  let h = (Math.imul(i, 0x9e3779b1) + Math.imul(k, 40503) + 12345) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Uniform integer in [0, n). Mirrored by SYN_IDX. */
export const synIdx = (i: number, k: number, n: number) => Math.floor((synHash(i, k) * n) / U32);
const perMille = (i: number, k: number) => synIdx(i, k, 1000);

export const weekVolume = (w: number) => 170 + synIdx(100000 + w, 1, 60) + 3 * w;

export interface SyntheticCall {
  CALL_ID: string;
  CALL_DATE: string;
  CALL_TIME: string;
  DURATION_SECONDS: number;
  LINE_OF_BUSINESS: string;
  PRODUCT_CATEGORY: string;
  CUSTOMER_SEGMENT: string;
  CALLER_TYPE: string;
  CALL_DISPOSITION: string;
  TEMPLATE_ID: number;
  ESCALATED: boolean;
}

/** Base duration per template: about 1.8 seconds per transcript word. */
export function templateBaseDurations(transcripts: string[]): number[] {
  return transcripts.map((t) => Math.round(t.split(/\s+/).length * 1.8));
}

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const pad = (n: number, len = 2) => String(n).padStart(len, "0");

export function generateCalls(baseDurations: number[]): SyntheticCall[] {
  const calls: SyntheticCall[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const volume = weekVolume(w);
    for (let s = 0; s < SLOTS && s < volume; s++) {
      const i = w * SLOTS + s;
      const t = perMille(i, 5) < 50 + 10 * w ? FEE_TEMPLATE : synIdx(i, 6, 10);
      const lob = perMille(i, 7) < 700 ? TEMPLATE_LOB[t] : synIdx(i, 8, 5);
      const escalated = perMille(i, 12) < TEMPLATE_ESCALATION[t];
      const d = perMille(i, 13);
      calls.push({
        CALL_ID: `CALL-${pad(i, 6)}`,
        CALL_DATE: addDays(SNAPSHOT_FIRST_WEEK, 7 * w + synIdx(i, 2, 7)),
        CALL_TIME: `${pad(8 + synIdx(i, 3, 10))}:${pad(synIdx(i, 4, 60))}:00`,
        DURATION_SECONDS: baseDurations[t] + synIdx(i, 14, 240) - 60,
        LINE_OF_BUSINESS: LOBS[lob],
        PRODUCT_CATEGORY: PRODUCTS[LOB_PRODUCTS[lob][synIdx(i, 9, 2)]],
        CUSTOMER_SEGMENT: SEGMENTS[synIdx(i, 10, 4)],
        CALLER_TYPE: CALLER_TYPES[synIdx(i, 11, 3)],
        CALL_DISPOSITION: escalated ? "Escalated" : d < 700 ? "Resolved" : d < 900 ? "Follow-up Required" : "Transferred",
        TEMPLATE_ID: t,
        ESCALATED: escalated,
      });
    }
  }
  return calls;
}
