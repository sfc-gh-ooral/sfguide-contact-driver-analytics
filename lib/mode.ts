// Sample / Live mode, chosen at runtime in the header switch.
// Live is the default when the server has a Snowflake connection; the reader can stay in Sample.
// The hosted example (static GitHub Pages build) is always Sample.
export type Mode = "sample" | "live";

export const HOSTED_EXAMPLE = process.env.NEXT_PUBLIC_HOSTED_EXAMPLE === "true";
const KEY = "contact-driver-mode";

export interface ModeState {
  mode: Mode;
  configured: boolean;
  model?: string;
}

let pending: Promise<ModeState> | null = null;

export function getModeState(): Promise<ModeState> {
  if (!pending) {
    pending = (async () => {
      if (HOSTED_EXAMPLE) return { mode: "sample", configured: false };
      try {
        const res = await fetch("/api/mode", { cache: "no-store" });
        const j = (await res.json()) as { configured: boolean; model?: string };
        const preferSample = window.localStorage.getItem(KEY) === "sample";
        return { mode: j.configured && !preferSample ? "live" : "sample", configured: j.configured, model: j.model };
      } catch {
        return { mode: "sample", configured: false };
      }
    })();
  }
  return pending;
}

export function setPreferredMode(mode: Mode) {
  window.localStorage.setItem(KEY, mode);
}
