// Client-side data access. The hosted example (a static GitHub Pages build) has no server,
// so it calls the built-in sample data directly; every other build calls the API routes.
import {
  getDrivers, getInsights, getSegments, getTranscripts, getTrends, parseDriverFilters, parseTimeframe, parseTranscriptFilters,
  type DriverRow, type Insight, type Transcript, type TrendRow,
} from "./contact-data";
import { mockSource } from "./mock-source";

export const HOSTED_EXAMPLE = process.env.NEXT_PUBLIC_HOSTED_EXAMPLE === "true";

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} failed (${res.status})`);
  return res.json();
}

export function fetchTrends(): Promise<TrendRow[]> {
  return HOSTED_EXAMPLE ? getTrends(mockSource) : getJson("/api/trends");
}

export function fetchSegments(): Promise<{ lobs: string[]; segments: string[]; products: string[] }> {
  return HOSTED_EXAMPLE ? getSegments(mockSource) : getJson("/api/segments");
}

export function fetchDrivers(params: URLSearchParams): Promise<DriverRow[]> {
  if (!HOSTED_EXAMPLE) return getJson(`/api/drivers?${params}`);
  return getDrivers(mockSource, parseDriverFilters(params));
}

export function fetchInsights(segment: string, timeframe: string): Promise<Insight> {
  if (!HOSTED_EXAMPLE) {
    return getJson("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segment, timeframe }),
    });
  }
  return getInsights(mockSource, segment, parseTimeframe(timeframe));
}

export function fetchTranscripts(params: URLSearchParams): Promise<Transcript[]> {
  return HOSTED_EXAMPLE ? getTranscripts(mockSource, parseTranscriptFilters(params)) : getJson(`/api/transcripts?${params}`);
}
