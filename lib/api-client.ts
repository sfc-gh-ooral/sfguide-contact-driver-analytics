// Client-side data access. Sample mode (and the hosted example, which has no server) uses the
// built-in sample data in the browser; Live mode calls the API routes, which query Snowflake.
import {
  getDrivers, getInsightStats, getSegments, getTranscripts, getTrends, parseDriverFilters, parseTimeframe,
  parseTranscriptFilters, sampleInsight, type DriverRow, type Insight, type Transcript, type TrendRow,
} from "./contact-data";
import { mockSource } from "./mock-source";
import { getModeState } from "./mode";

export { HOSTED_EXAMPLE } from "./mode";

const isSample = async () => (await getModeState()).mode === "sample";

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `${url} failed (${res.status})`);
  return body as T;
}

export async function fetchTrends(): Promise<TrendRow[]> {
  return (await isSample()) ? getTrends(mockSource) : getJson("/api/trends");
}

export async function fetchSegments(): Promise<{ lobs: string[]; segments: string[]; products: string[] }> {
  return (await isSample()) ? getSegments(mockSource) : getJson("/api/segments");
}

export async function fetchDrivers(params: URLSearchParams): Promise<DriverRow[]> {
  return (await isSample()) ? getDrivers(mockSource, parseDriverFilters(params)) : getJson(`/api/drivers?${params}`);
}

/** Sample mode returns scripted text after `sampleDelayMs`; Live mode calls AI_COMPLETE with no added delay. */
export async function fetchInsights(segment: string, timeframe: string, sampleDelayMs: number): Promise<Insight> {
  if (await isSample()) {
    const [insight] = await Promise.all([
      getInsightStats(mockSource, segment, parseTimeframe(timeframe)).then(sampleInsight),
      new Promise(resolve => setTimeout(resolve, sampleDelayMs)),
    ]);
    return insight;
  }
  return getJson("/api/insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segment, timeframe }),
  });
}

export async function fetchTranscripts(params: URLSearchParams): Promise<Transcript[]> {
  return (await isSample()) ? getTranscripts(mockSource, parseTranscriptFilters(params)) : getJson(`/api/transcripts?${params}`);
}
