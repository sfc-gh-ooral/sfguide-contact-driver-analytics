// Live mode: Snowflake connection and queries (server only).
// No fallback to sample data: if a live call fails, the error is returned to the app and shown.
import snowflake from "snowflake-sdk";
import fs from "fs";
import {
  insightPrompt, type DataSource, type DriverRow, type Insight, type InsightStats, type LobSummaryRow,
  type ReasonSummaryRow, type SegmentRow, type Transcript, type TrendRow,
} from "./contact-data";

snowflake.configure({ logLevel: "ERROR" });

export const CORTEX_MODEL = process.env.CORTEX_MODEL || "llama3.3-70b";
const SPCS_TOKEN_PATH = "/snowflake/session/token";

let connection: snowflake.Connection | null = null;
let cachedToken: string | null = null;

function getOAuthToken(): string | null {
  try {
    if (fs.existsSync(SPCS_TOKEN_PATH)) return fs.readFileSync(SPCS_TOKEN_PATH, "utf8");
  } catch {
    // Not running in Snowpark Container Services
  }
  return null;
}

/** True when the server has enough settings to try a live connection. Never exposes values. */
export function isConfigured(): boolean {
  if (getOAuthToken()) return true;
  const env = process.env;
  return Boolean(env.SNOWFLAKE_ACCOUNT && env.SNOWFLAKE_USER
    && (env.SNOWFLAKE_PRIVATE_KEY_PATH || env.SNOWFLAKE_PASSWORD || env.SNOWFLAKE_AUTHENTICATOR?.toUpperCase() === "EXTERNALBROWSER"));
}

function getConfig(): snowflake.ConnectionOptions {
  const env = process.env;
  const base = {
    account: env.SNOWFLAKE_ACCOUNT || "",
    warehouse: env.SNOWFLAKE_WAREHOUSE || "CONTACT_DRIVER_WH",
    database: env.SNOWFLAKE_DATABASE || "CONTACT_DRIVER_EXAMPLE",
    schema: env.SNOWFLAKE_SCHEMA || "ANALYTICS",
    role: env.SNOWFLAKE_ROLE || "CONTACT_DRIVER_ROLE",
  };

  const token = getOAuthToken();
  if (token) return { ...base, host: env.SNOWFLAKE_HOST, token, authenticator: "OAUTH" };

  // Key-pair (recommended): SNOWFLAKE_JWT with an unencrypted or passphrase-protected PKCS#8 key.
  if (env.SNOWFLAKE_PRIVATE_KEY_PATH) {
    return {
      ...base,
      username: env.SNOWFLAKE_USER || "",
      authenticator: "SNOWFLAKE_JWT",
      privateKey: fs.readFileSync(env.SNOWFLAKE_PRIVATE_KEY_PATH, "utf8"),
      ...(env.SNOWFLAKE_PRIVATE_KEY_PASSPHRASE ? { privateKeyPass: env.SNOWFLAKE_PRIVATE_KEY_PASSPHRASE } : {}),
    };
  }
  if (env.SNOWFLAKE_PASSWORD) {
    return { ...base, username: env.SNOWFLAKE_USER || "", password: env.SNOWFLAKE_PASSWORD };
  }
  return { ...base, username: env.SNOWFLAKE_USER || "", authenticator: "EXTERNALBROWSER" };
}

async function getConnection(): Promise<snowflake.Connection> {
  const token = getOAuthToken();
  if (connection && (!token || token === cachedToken)) return connection;
  if (connection) connection.destroy(() => {});

  const config = getConfig();
  const conn = snowflake.createConnection(config);
  const connect = (cb: (err: snowflake.SnowflakeError | undefined) => void) =>
    config.authenticator === "EXTERNALBROWSER" ? conn.connectAsync(cb) : conn.connect(cb);
  return new Promise((resolve, reject) => {
    connect((err) => {
      if (err) return reject(err);
      connection = conn;
      cachedToken = token;
      resolve(conn);
    });
  });
}

function isRetryableError(err: unknown): boolean {
  const error = err as { message?: string; code?: number };
  return !!(
    error.message?.includes("OAuth access token expired") ||
    error.message?.includes("terminated connection") ||
    error.code === 407002
  );
}

type Bind = string | number | boolean | null;

export async function query<T>(sql: string, binds: Bind[] = [], retries = 1): Promise<T[]> {
  try {
    const conn = await getConnection();
    return await new Promise<T[]>((resolve, reject) => {
      conn.execute({
        sqlText: sql,
        binds: binds as snowflake.Binds,
        complete: (err, _stmt, rows) => (err ? reject(err) : resolve((rows || []) as T[])),
      });
    });
  } catch (err) {
    if (retries > 0 && isRetryableError(err)) {
      connection = null;
      return query(sql, binds, retries - 1);
    }
    throw err;
  }
}

// Windows are relative to the latest call, matching the sample data.
const LATEST = "(SELECT MAX(CALL_DATE) FROM CALL_TRANSCRIPTS)";
const WEEK_OF = "DATEADD(day, 1 - DAYOFWEEKISO(CALL_DATE), CALL_DATE)";

// Request values reach SQL only as bind variables. The one exception, LIMIT, is an integer clamped by parseTranscriptFilters.
export const snowflakeSource: DataSource = {
  trends: () => query<TrendRow>(`
    SELECT TO_VARCHAR(WEEK_START, 'YYYY-MM-DD') AS WEEK_START, TOTAL_CALLS, OVERALL_SENTIMENT,
           TOTAL_ESCALATIONS, ESCALATION_RATE, AVG_CALL_DURATION_SEC
    FROM V_TREND_SUMMARY
    ORDER BY WEEK_START DESC
    LIMIT 13
  `),

  segmentRows: () => query<SegmentRow>(`
    SELECT DISTINCT LINE_OF_BUSINESS, PRODUCT_CATEGORY, CUSTOMER_SEGMENT FROM CALL_TRANSCRIPTS
  `),

  drivers: ({ lob, segment }) => query<DriverRow>(`
    SELECT LINE_OF_BUSINESS, PRODUCT_CATEGORY, CUSTOMER_SEGMENT, CALLER_TYPE,
           SUM(CALL_VOLUME)                          AS CALL_VOLUME,
           SUM(TOTAL_DURATION) / SUM(CALL_VOLUME)    AS AVG_DURATION,
           SUM(SENTIMENT_SUM) / SUM(CALL_VOLUME)     AS AVG_SENTIMENT,
           SUM(ESCALATIONS)                          AS ESCALATIONS,
           SUM(RESOLVED) * 100 / SUM(CALL_VOLUME)    AS RESOLUTION_RATE
    FROM V_CALL_DRIVER_ANALYSIS
    WHERE WEEK_START >= DATEADD(day, -30, ${LATEST})
      AND (? IS NULL OR LINE_OF_BUSINESS = ?)
      AND (? IS NULL OR CUSTOMER_SEGMENT = ?)
    GROUP BY ALL
    ORDER BY CALL_VOLUME DESC, LINE_OF_BUSINESS || '|' || PRODUCT_CATEGORY || '|' || CUSTOMER_SEGMENT || '|' || CALLER_TYPE
    LIMIT 200
  `, [lob ?? null, lob ?? null, segment ?? null, segment ?? null]),

  lobSummary: (days, lob) => query<LobSummaryRow>(`
    SELECT LINE_OF_BUSINESS,
           SUM(CALL_VOLUME)                      AS CALL_VOLUME,
           SUM(SENTIMENT_SUM) / SUM(CALL_VOLUME) AS AVG_SENTIMENT,
           SUM(ESCALATIONS)                      AS ESCALATIONS
    FROM V_CALL_DRIVER_ANALYSIS
    WHERE WEEK_START >= DATEADD(day, ?, ${LATEST})
      AND (? IS NULL OR LINE_OF_BUSINESS = ?)
    GROUP BY LINE_OF_BUSINESS
    ORDER BY CALL_VOLUME DESC, LINE_OF_BUSINESS
  `, [-days, lob ?? null, lob ?? null]),

  reasonSummary: (days, lob) => query<ReasonSummaryRow>(`
    SELECT CALL_REASON,
           COUNT(*)              AS CALL_VOLUME,
           COUNT_IF(ESCALATED)   AS ESCALATIONS,
           AVG(SENTIMENT_SCORE)  AS AVG_SENTIMENT
    FROM CALL_TRANSCRIPTS
    WHERE ${WEEK_OF} >= DATEADD(day, ?, ${LATEST})
      AND (? IS NULL OR LINE_OF_BUSINESS = ?)
    GROUP BY CALL_REASON
    ORDER BY CALL_VOLUME DESC, CALL_REASON
  `, [-days, lob ?? null, lob ?? null]),

  transcripts: ({ lob, segment, week, escalated, limit }) => query<Transcript>(`
    SELECT CALL_ID,
           TO_VARCHAR(CALL_DATE, 'YYYY-MM-DD') AS CALL_DATE,
           TO_VARCHAR(CALL_TIME, 'HH24:MI:SS') AS CALL_TIME,
           DURATION_SECONDS, LINE_OF_BUSINESS, CALL_DISPOSITION, CALL_REASON, CUSTOMER_SEGMENT,
           TRANSCRIPT, SENTIMENT_SCORE, AI_SUMMARY, AI_DRIVER, ESCALATED
    FROM CALL_TRANSCRIPTS
    WHERE (? IS NULL OR LINE_OF_BUSINESS = ?)
      AND (? IS NULL OR CUSTOMER_SEGMENT = ?)
      AND (? IS NULL OR ${WEEK_OF} = TO_DATE(?))
      AND (? = FALSE OR ESCALATED = TRUE)
    ORDER BY CALL_DATE DESC, CALL_TIME DESC, CALL_ID DESC
    LIMIT ${Math.trunc(limit)}
  `, [lob ?? null, lob ?? null, segment ?? null, segment ?? null, week ?? null, week ?? null, Boolean(escalated)]),
};

/** Executive summary, findings, and recommendations from AI_COMPLETE over the aggregated stats. */
export async function liveInsight(stats: InsightStats): Promise<Insight> {
  const started = Date.now();
  const [row] = await query<{ R: string | { summary?: string; key_findings?: string[]; recommendations?: string[] } }>(`
    SELECT AI_COMPLETE(
      model => ?,
      prompt => ?,
      model_parameters => {'temperature': 0, 'max_tokens': 900},
      response_format => TYPE OBJECT(summary STRING, key_findings ARRAY(STRING), recommendations ARRAY(STRING))
    ) AS R
  `, [CORTEX_MODEL, insightPrompt(stats)]);
  const r = typeof row?.R === "string" ? JSON.parse(row.R) : row?.R;
  if (!r?.summary) throw new Error("AI_COMPLETE returned no summary");
  return {
    source: "live",
    model: CORTEX_MODEL,
    latencyMs: Date.now() - started,
    metrics: stats.metrics,
    summary: r.summary,
    keyFindings: r.key_findings ?? [],
    recommendations: r.recommendations ?? [],
  };
}
