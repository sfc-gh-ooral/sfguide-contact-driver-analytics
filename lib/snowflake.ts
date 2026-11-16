import snowflake from "snowflake-sdk";
import fs from "fs";
import type { DataSource, DriverRow, LobSummaryRow, SegmentRow, Transcript, TrendRow } from "./contact-data";
import { mockSource } from "./mock-source";

snowflake.configure({ logLevel: "ERROR" });

let connection: snowflake.Connection | null = null;
let cachedToken: string | null = null;

function getOAuthToken(): string | null {
  const tokenPath = "/snowflake/session/token";
  try {
    if (fs.existsSync(tokenPath)) {
      return fs.readFileSync(tokenPath, "utf8");
    }
  } catch {
    // Not in SPCS environment
  }
  return null;
}

function getConfig(): snowflake.ConnectionOptions {
  const base = {
    account: process.env.SNOWFLAKE_ACCOUNT || "",
    warehouse: process.env.SNOWFLAKE_WAREHOUSE || "COMPUTE_WH",
    database: process.env.SNOWFLAKE_DATABASE || "CONTACT_ANALYTICS",
    schema: process.env.SNOWFLAKE_SCHEMA || "ANALYTICS",
    role: process.env.SNOWFLAKE_ROLE || "SYSADMIN",
  };

  const token = getOAuthToken();
  if (token) {
    return {
      ...base,
      host: process.env.SNOWFLAKE_HOST,
      token,
      authenticator: "oauth",
    };
  }

  if (process.env.SNOWFLAKE_PASSWORD) {
    return {
      ...base,
      username: process.env.SNOWFLAKE_USER || "",
      password: process.env.SNOWFLAKE_PASSWORD,
    };
  }

  return {
    ...base,
    username: process.env.SNOWFLAKE_USER || "",
    authenticator: "EXTERNALBROWSER",
  };
}

async function getConnection(): Promise<snowflake.Connection> {
  const token = getOAuthToken();

  if (connection && (!token || token === cachedToken)) {
    return connection;
  }

  if (connection) {
    console.log("OAuth token changed, reconnecting");
    connection.destroy(() => {});
  }

  const config = getConfig();
  console.log(token ? "Connecting with OAuth token" : `Connecting to Snowflake (${config.authenticator || "password"})`);
  const conn = snowflake.createConnection(config);
  
  return new Promise((resolve, reject) => {
    conn.connect((err) => {
      if (err) {
        reject(err);
      } else {
        connection = conn;
        cachedToken = token;
        resolve(conn);
      }
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

type Bind = string | number | boolean;

export async function query<T>(sql: string, binds: Bind[] = [], retries = 1): Promise<T[]> {
  try {
    const conn = await getConnection();
    return await new Promise<T[]>((resolve, reject) => {
      conn.execute({
        sqlText: sql,
        binds,
        complete: (err, stmt, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve((rows || []) as T[]);
          }
        },
      });
    });
  } catch (err) {
    console.error("Query error:", (err as Error).message);
    if (retries > 0 && isRetryableError(err)) {
      connection = null;
      return query(sql, binds, retries - 1);
    }
    throw err;
  }
}

// Request values reach SQL as bind variables. The one exception, LIMIT, is an integer clamped by parseTranscriptFilters.
const snowflakeSource: DataSource = {
  trends: () => query<TrendRow>(`
    SELECT * FROM CONTACT_ANALYTICS.ANALYTICS.V_TREND_SUMMARY
    ORDER BY WEEK_START DESC
    LIMIT 13
  `),

  segmentRows: () => query<SegmentRow>(`
    SELECT DISTINCT line_of_business, product_category, customer_segment
    FROM CONTACT_ANALYTICS.ANALYTICS.CALL_TRANSCRIPTS
  `),

  drivers: ({ lob, segment }) => query<DriverRow>(`
    SELECT
      line_of_business,
      product_category,
      customer_segment,
      caller_type,
      SUM(call_volume) as call_volume,
      AVG(avg_duration) as avg_duration,
      AVG(avg_sentiment) as avg_sentiment,
      SUM(escalations) as escalations,
      AVG(resolution_rate) as resolution_rate
    FROM CONTACT_ANALYTICS.ANALYTICS.V_CALL_DRIVER_ANALYSIS
    WHERE week_start >= DATEADD(day, -30, CURRENT_DATE())
      AND (? IS NULL OR line_of_business = ?)
      AND (? IS NULL OR customer_segment = ?)
    GROUP BY line_of_business, product_category, customer_segment, caller_type
    ORDER BY call_volume DESC
    LIMIT 50
  `, [lob ?? null, lob ?? null, segment ?? null, segment ?? null] as Bind[]),

  lobSummary: (days, lob) => query<LobSummaryRow>(`
    SELECT
      line_of_business,
      SUM(call_volume) as call_volume,
      AVG(avg_sentiment) as avg_sentiment,
      SUM(escalations) as escalations
    FROM CONTACT_ANALYTICS.ANALYTICS.V_CALL_DRIVER_ANALYSIS
    WHERE week_start >= DATEADD(day, ?, CURRENT_DATE())
      AND (? IS NULL OR line_of_business = ?)
    GROUP BY line_of_business
    ORDER BY call_volume DESC
  `, [-days, lob ?? null, lob ?? null] as Bind[]),

  transcripts: ({ lob, segment, week, escalated, limit }) => query<Transcript>(`
    SELECT
      CALL_ID,
      CALL_DATE,
      CALL_TIME,
      DURATION_SECONDS,
      LINE_OF_BUSINESS,
      CALL_DISPOSITION,
      CALL_REASON,
      CUSTOMER_SEGMENT,
      TRANSCRIPT,
      SENTIMENT_SCORE,
      ESCALATED
    FROM CONTACT_ANALYTICS.ANALYTICS.CALL_TRANSCRIPTS
    WHERE (? IS NULL OR LINE_OF_BUSINESS = ?)
      AND (? IS NULL OR CUSTOMER_SEGMENT = ?)
      AND (? IS NULL OR DATE_TRUNC('week', CALL_DATE) = TO_DATE(?))
      AND (? = FALSE OR ESCALATED = TRUE)
    ORDER BY CALL_DATE DESC, CALL_TIME DESC
    LIMIT ${Math.trunc(limit)}
  `, [lob ?? null, lob ?? null, segment ?? null, segment ?? null, week ?? null, week ?? null, Boolean(escalated)] as Bind[]),
};

// Uses Snowflake when it is reachable; otherwise (USE_MOCK_DATA=true or a connection error) the built-in sample data.
type Method = (...args: never[]) => Promise<unknown>;

function withFallback<K extends keyof DataSource>(key: K): DataSource[K] {
  const live = snowflakeSource[key] as unknown as Method;
  const sample = mockSource[key] as unknown as Method;
  return (async (...args: never[]) => {
    if (process.env.USE_MOCK_DATA === "true") return sample(...args);
    try {
      return await live(...args);
    } catch {
      console.log("Falling back to sample data due to connection error");
      return sample(...args);
    }
  }) as unknown as DataSource[K];
}

export const dataSource: DataSource = {
  trends: withFallback("trends"),
  segmentRows: withFallback("segmentRows"),
  drivers: withFallback("drivers"),
  lobSummary: withFallback("lobSummary"),
  transcripts: withFallback("transcripts"),
};
