# Contact Driver Analytics

Find what's driving repeat calls and escalations in a financial services contact center. The app connects call volume, sentiment, and escalations by line of business, product, segment, and call reason, lets you drill into individual calls with an AI summary, and drafts an executive summary with recommendations.

This is a Snowflake example on **synthetic data** for Northwind Financial, a fictional firm: a Next.js app with a no-account Sample mode and a Live mode that runs on Snowflake with `SNOWFLAKE.CORTEX.SENTIMENT`, `AI_CLASSIFY`, and `AI_COMPLETE`.

**[Try the hosted example](https://sfc-gh-ooral.github.io/sfguide-contact-driver-analytics/try/)** · **[Guide](https://sfc-gh-ooral.github.io/sfguide-contact-driver-analytics/)**

> Synthetic data and illustrative logic only. This is not production, regulatory, or compliance advice. AI output can be wrong; review it before acting on it.

## What it does

| Screen | What you see | Snowflake capability (Live mode) |
| --- | --- | --- |
| KPI cards and trend | Calls, average sentiment, escalations, and duration for the latest week; 13-week call volume; share of calls by line of business | `V_TREND_SUMMARY` and `V_CALL_DRIVER_ANALYSIS` views; sentiment from `SNOWFLAKE.CORTEX.SENTIMENT` |
| Contact drivers | Last 4 weeks by line of business, product, segment, and caller type, with volume, AI sentiment, and resolution rate | `V_CALL_DRIVER_ANALYSIS` |
| Call drill-down | Click any card, chart point, slice, or row to list its calls; open one for the transcript, sentiment, AI summary, and AI driver label | `CALL_TRANSCRIPTS` with `SNOWFLAKE.CORTEX.SENTIMENT`, `AI_COMPLETE` (summary), and `AI_CLASSIFY` (driver) computed in setup |
| AI Insights | Executive summary, four findings, and four recommendations for the selected line of business and time window | `AI_COMPLETE` (`llama3.3-70b`) with a structured-output schema, called on demand over aggregated totals (bind variables only) |
| Sample / Live switch | Header switch that always shows which mode is on. Live with no connection shows setup steps instead of asking for credentials | `/api/mode` reports whether `.env.local` is configured; live errors are shown, never replaced by sample data |

Every AI output is labeled: **Sample AI response** / **Sample data** in Sample mode, **Powered by &lt;function&gt;** in Live mode. In Sample mode, AI Insights waits 4 to 8 seconds and shows the same staged steps as the live path; in Live mode it shows those steps with no added delay and reports the measured latency.

### Story on this synthetic data set

Over the quarter, **Fee Question** calls grow from 8.9% of calls in the first week to 26.5% in the latest week, and become the top driver. In the past month, Complaint calls escalate 72.3% of the time, and Technical Support about 30%. The AI Insights panel should surface both. These numbers hold **on this synthetic data set** only.

## Prerequisites

- **Node.js 20.9 or later** (tested with Node 22.23). Scripts that regenerate SQL or screenshots need Node 22.18+.
- **For Live mode:** a Snowflake account on any edition (no Enterprise-only features are used; tested in AWS US East 1, November 2026) and a role that can create roles, warehouses, and databases (`ACCOUNTADMIN`, or `SECURITYADMIN` + `SYSADMIN`).
- **Cortex AI functions:** `SNOWFLAKE.CORTEX.SENTIMENT`, `AI_CLASSIFY`, and `AI_COMPLETE` with `llama3.3-70b`. If a function or model isn't available in your region, enable [cross-region inference](https://docs.snowflake.com/en/user-guide/snowflake-cortex/cross-region-inference) (`ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'ANY_REGION';`, ACCOUNTADMIN) or set `CORTEX_MODEL` and the model in `sql/setup.sql` to one that is available.
- Tested with Next.js 16.1.6, React 19.2.3, snowflake-sdk 2.3.4, Snowflake 10.42.

## Quick start: no account

```bash
git clone https://github.com/sfc-gh-ooral/sfguide-contact-driver-analytics.git
cd sfguide-contact-driver-analytics
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without a `.env.local`, the app runs in Sample mode in your browser on 2,857 synthetic calls over 13 weeks. Sentiment, call summaries, and driver labels are Cortex outputs captured from a live run (`lib/sample-ai.ts`); the AI Insights text is scripted from the same totals.

## Live mode: run it in your account

1. **Create the objects.** Open a Snowsight SQL worksheet, paste [`sql/setup.sql`](sql/setup.sql), and run all of it (about 45 seconds). It runs top to bottom with no edits, and ends with two checks: 2,857 calls in 13 weeks, and one row per call reason with its sentiment, AI driver, and AI summary.
2. **Create a key pair** and register the public key on your user (or use browser SSO; see [`.env.example`](.env.example)):

   ```bash
   openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -out rsa_key.p8 -nocrypt
   openssl rsa -in rsa_key.p8 -pubout -out rsa_key.pub
   ```

   ```sql
   ALTER USER <YOUR_USER> SET RSA_PUBLIC_KEY='<contents of rsa_key.pub without the BEGIN/END lines>';
   -- If RSA_PUBLIC_KEY is already in use, set RSA_PUBLIC_KEY_2 instead.
   ```

   Keep the key outside the repository; `*.p8` and `rsa_key*` are gitignored anyway.
3. **Configure the app.** `cp .env.example .env.local` and fill in:

   ```env
   SNOWFLAKE_ACCOUNT=<orgname>-<account_name>
   SNOWFLAKE_USER=<YOUR_USER>
   SNOWFLAKE_PRIVATE_KEY_PATH=/absolute/path/to/rsa_key.p8
   SNOWFLAKE_ROLE=CONTACT_DRIVER_ROLE
   ```

4. **Run** `npm run dev` and open [http://localhost:3000](http://localhost:3000). The header switch defaults to **Live** when `.env.local` is configured; switch to **Sample** at any time (the choice is saved in your browser).
5. **Try it.** Click **Escalations** to list escalated calls and open one; on **AI Insights**, click **Generate Insights** for a live `AI_COMPLETE` call.

The app connects as `CONTACT_DRIVER_ROLE`, which can only read the three objects below and call Cortex functions. Request values reach SQL only as bind variables.

### Objects created

| Object | Type | Purpose |
| --- | --- | --- |
| `CONTACT_DRIVER_ROLE` | Role | Read-only app role: `USAGE` on the warehouse, database, and schema; `SELECT` on `CALL_TRANSCRIPTS` and the two views; `SNOWFLAKE.CORTEX_USER`. Granted to you and to `SYSADMIN` |
| `CONTACT_DRIVER_WH` | Warehouse | XSMALL, `AUTO_SUSPEND = 60`, `AUTO_RESUME`, initially suspended |
| `CONTACT_DRIVER_EXAMPLE` | Database | Owned by `SYSADMIN`; schema `ANALYTICS` holds everything below |
| `TRANSCRIPT_TEMPLATES` | Table | 10 fictional call transcripts and their call reason |
| `SYN_XS`, `SYN_HASH`, `SYN_IDX` | SQL functions | Deterministic hash used to generate the calls (same as `lib/synthetic.ts`) |
| `CALLS` | Table | 2,857 synthetic calls: date, time, duration, line of business, product, segment, caller type, disposition, template, escalated |
| `TRANSCRIPT_AI` | Table | One row per template: `SENTIMENT_SCORE` (`SNOWFLAKE.CORTEX.SENTIMENT`), `AI_SUMMARY` (`AI_COMPLETE`), `AI_DRIVER` (`AI_CLASSIFY`) |
| `CALL_TRANSCRIPTS` | Table | What the app reads: calls joined to transcripts and Cortex outputs |
| `V_CALL_DRIVER_ANALYSIS` | View | Weekly totals by line of business, product, segment, and caller type |
| `V_TREND_SUMMARY` | View | Weekly calls, sentiment, escalations, escalation rate, and duration |

`CALL_TRANSCRIPTS` columns: `CALL_ID`, `CALL_DATE` (DATE), `CALL_TIME` (TIME), `DURATION_SECONDS`, `LINE_OF_BUSINESS`, `PRODUCT_CATEGORY`, `CUSTOMER_SEGMENT`, `CALLER_TYPE`, `CALL_DISPOSITION`, `CALL_REASON`, `TRANSCRIPT`, `SENTIMENT_SCORE` (FLOAT, -1 to 1), `AI_SUMMARY`, `AI_DRIVER`, `ESCALATED` (BOOLEAN).

**Sample vs. live numbers.** Setup generates the same calls as Sample mode, and Sample mode uses the Cortex outputs captured from a live run, so every count, rate, and score matches on the dashboard and drivers tab. Two things can differ: if you re-run setup, `AI_COMPLETE` and `AI_CLASSIFY` may word a summary or pick a label slightly differently; and the AI Insights text is written by `AI_COMPLETE` in Live mode but scripted in Sample mode.

**Cleanup:** run [`sql/cleanup.sql`](sql/cleanup.sql). It drops the database, warehouse, and role. If you registered a key only for this example, also run `ALTER USER <YOUR_USER> UNSET RSA_PUBLIC_KEY;` (or `RSA_PUBLIC_KEY_2`).

### Expected cost and time

Measured on an XSMALL warehouse, AWS US East 1, November 2026:

| Step | Time | Compute |
| --- | --- | --- |
| `sql/setup.sql`, top to bottom | 41 to 43 s per run (measured, two runs); the Cortex enrichment step took 6.6 to 6.8 s | Warehouse: **0.11 credits** measured on `CONTACT_DRIVER_WH` for the whole test session (two setup runs, about 70 app and check queries over about an hour), including per-resume minimums |
| AI Insights, one Live call | 10 to 16 s (measured, three calls) | Most of the time is `AI_COMPLETE`; the aggregation queries take well under a second |
| Cortex tokens | n/a | **Estimate, not measured:** setup sends about 10 transcripts (roughly 6,000 input tokens) through each of three functions, and each AI Insights call sends about 700 input and 500 output tokens. At published per-token rates this is a few hundredths of a credit for setup and well under 0.01 credits per insight. Check `SNOWFLAKE.ACCOUNT_USAGE.CORTEX_FUNCTIONS_USAGE_HISTORY` (it lags by up to a few hours) for your actual usage |

The warehouse suspends after 60 seconds idle. Run cleanup when you're done.

## Known limitations

- **Ten transcript templates.** Every call reuses one of 10 fictional transcripts, so Cortex scores and summarizes each template once and all calls that share it share its sentiment, summary, and driver label. Driver-level sentiment varies only through the call mix. To score real calls one by one, apply the same functions to your own transcript column (see "Customize with Cortex Code").
- **Enrichment is a snapshot.** `TRANSCRIPT_AI` and `CALL_TRANSCRIPTS` are built once by setup; re-run section 4 and 5 of `sql/setup.sql` after data changes, or turn them into dynamic tables or a scheduled task.
- **Fixed snapshot dates.** The data covers 2026-08-17 to 2026-11-15. Time windows (latest week, past month, past quarter) count back from the latest call, not from today.
- **AI Insights only sees totals.** The prompt holds aggregated counts, rates, and sentiment by line of business and call reason, never transcript text. It can't explain a driver beyond those numbers, and its wording varies run to run.
- **`AI_DRIVER` is shown but not aggregated.** The drivers table groups by the call reason in the data; the `AI_CLASSIFY` label appears on each call for comparison.
- **The hosted example** is always Sample mode; its Live switch links to this section.
- **Not production-hardened:** no authentication in the app, no row-level security, and one shared Snowflake connection per server process.

## Customize with Cortex Code

- "Explain this pack's data model and map `CALL_TRANSCRIPTS` to my contact-center tables without changing any objects. Propose a least-privilege role and a validation plan first."
- "Replace the template-level enrichment in `sql/setup.sql` with per-call `SNOWFLAKE.CORTEX.SENTIMENT`, `AI_CLASSIFY`, and `AI_COMPLETE` on my transcript table, as an incremental dynamic table, and estimate the token cost for my daily call volume."
- "Add an `AI_DRIVER` breakdown to the Contact Drivers tab and a repeat-caller metric (same customer within 7 days), in both `lib/mock-source.ts` and `lib/snowflake.ts`, so Sample and Live mode stay in sync."

## Project layout

```text
app/                    Next.js App Router page and API routes (/api/mode, trends, segments, drivers, transcripts, insights)
components/             ModeChip (Sample/Live switch), Reasoning (staged steps), transcript modal, ui/ (badges, shadcn/ui)
lib/synthetic.ts        Seeded call generator shared with sql/setup.sql
lib/sample-ai.ts        Cortex outputs captured from a live run (Sample mode)
lib/mock-source.ts      Sample mode data source (runs in the browser)
lib/snowflake.ts        Live mode: connection (key pair, SSO, password, SPCS OAuth), queries, AI_COMPLETE
lib/contact-data.ts     Types, input parsing, insight stats and prompt
lib/mode.ts             Runtime Sample/Live choice
sql/                    setup.sql, cleanup.sql
scripts/                generate-sql.mjs, build-hosted-example.mjs, capture-screenshots.mjs
docs/                   GitHub Pages guide, images/, catalog/, and the /try/ static example
```

- `npm run generate-sql` rewrites the data block of `sql/setup.sql` from `lib/synthetic.ts` and `lib/transcript-templates.ts`. Run it after changing either.
- `npm run build:example` builds the static, no-account example into `docs/try/`.
- `npx playwright install chromium` (first time), then `npm run build:example && npm run capture`, refreshes `docs/images/` (1600×1000) and `docs/catalog/` (960×600) from the hosted example in a fresh headless browser, so no sign-in or account details can appear. Review every image before publishing.

## License and disclaimer

[Apache 2.0](LICENSE). This is an illustrative example provided as is. It is not an official Snowflake product and is not supported by Snowflake Support. It contains no customer data; Northwind Financial and every person in the transcripts are fictional. Review and test before any production use. See also [LEGAL.md](LEGAL.md).

Owner: Oz Oral · Last reviewed: November 2026
