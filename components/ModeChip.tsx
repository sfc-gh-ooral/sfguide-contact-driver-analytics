"use client";

// Header Sample/Live switch. Live needs a Snowflake connection on the server; without one,
// choosing Live opens setup steps instead (the app never asks for credentials in the browser).
import { Database, FlaskConical, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getModeState, HOSTED_EXAMPLE, setPreferredMode, type ModeState } from "@/lib/mode";

const REPO = "https://github.com/sfc-gh-ooral/sfguide-contact-driver-analytics";

export function ModeChip() {
  const [state, setState] = useState<ModeState>();
  const [help, setHelp] = useState(false);

  useEffect(() => { getModeState().then(setState); }, []);
  if (!state) return null;

  const live = state.mode === "live";
  const choose = (next: "sample" | "live") => {
    if (next === state.mode) return;
    if (next === "live" && !state.configured) { setHelp(true); return; }
    setPreferredMode(next);
    window.location.reload(); // every panel refetches from the chosen source
  };
  const btn = "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors";

  return (
    <>
      <div role="radiogroup" aria-label="Data source" className="inline-flex items-center rounded-lg border bg-muted/50 p-0.5">
        <button role="radio" aria-checked={!live} onClick={() => choose("sample")}
          title="Bundled synthetic data; AI outputs are labeled samples"
          className={`${btn} ${!live ? "bg-amber-100 text-amber-900 shadow-sm dark:bg-amber-900/40 dark:text-amber-100" : "text-muted-foreground hover:text-foreground"}`}>
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />Sample
        </button>
        <button role="radio" aria-checked={live} onClick={() => choose("live")}
          title={state.configured ? "Data and AI from your Snowflake account" : "Needs a Snowflake connection"}
          className={`${btn} ${live ? "bg-emerald-100 text-emerald-900 shadow-sm dark:bg-emerald-900/40 dark:text-emerald-100" : "text-muted-foreground hover:text-foreground"}`}>
          {live && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />}
          <Database className="h-3.5 w-3.5" aria-hidden />Live
        </button>
      </div>

      {help && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setHelp(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="live-help-title"
            className="w-full max-w-lg rounded-xl border bg-card p-5 text-card-foreground shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id="live-help-title" className="text-base font-semibold">Connect Snowflake to use Live mode</h2>
              <button className="rounded-md p-1 hover:bg-muted" onClick={() => setHelp(false)} aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            {HOSTED_EXAMPLE ? (
              <p className="text-sm text-muted-foreground">
                This hosted example runs only on synthetic data in your browser. To use Live mode, clone the{" "}
                <a className="underline" href={REPO} target="_blank" rel="noreferrer">repository</a> and follow{" "}
                <a className="underline" href={`${REPO}#live-mode-run-it-in-your-account`} target="_blank" rel="noreferrer">Live mode: run it in your account</a> in the README.
              </p>
            ) : (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  No Snowflake connection is configured on this server. For security, the app doesn&apos;t take credentials in the browser. Set them up once on the machine running the app:
                </p>
                <ol className="mb-3 list-decimal space-y-2 pl-5 text-sm">
                  <li>Run <code>sql/setup.sql</code> in a Snowsight worksheet as ACCOUNTADMIN.</li>
                  <li>Create a key pair and register the public key on your user (steps in <code>.env.example</code>).</li>
                  <li>Copy <code>.env.example</code> to <code>.env.local</code> and fill in:</li>
                </ol>
                <pre className="mb-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs">{`SNOWFLAKE_ACCOUNT=<orgname>-<account_name>
SNOWFLAKE_USER=<YOUR_USER>
SNOWFLAKE_PRIVATE_KEY_PATH=/absolute/path/to/rsa_key.p8
SNOWFLAKE_ROLE=CONTACT_DRIVER_ROLE`}</pre>
                <p className="text-sm text-muted-foreground">
                  Then restart with <code>npm run dev</code> and switch to Live.{" "}
                  <a className="underline" href={`${REPO}#live-mode-run-it-in-your-account`} target="_blank" rel="noreferrer">Full guide</a>
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
