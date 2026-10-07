import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/snowflake";

interface Transcript {
  CALL_ID: string;
  CALL_DATE: string;
  CALL_TIME: string;
  DURATION_SECONDS: number;
  LINE_OF_BUSINESS: string;
  CALL_DISPOSITION: string;
  CALL_REASON: string;
  CUSTOMER_SEGMENT: string;
  TRANSCRIPT: string;
  SENTIMENT_SCORE: number;
  ESCALATED: boolean;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lob = searchParams.get("lob");
  const segment = searchParams.get("segment");
  const week = searchParams.get("week");
  const escalated = searchParams.get("escalated");
  const limit = searchParams.get("limit") || "50";

  let whereClause = "WHERE 1=1";
  
  if (lob && lob !== "all") {
    whereClause += ` AND LINE_OF_BUSINESS = '${lob}'`;
  }
  if (segment && segment !== "all") {
    whereClause += ` AND CUSTOMER_SEGMENT = '${segment}'`;
  }
  if (week) {
    whereClause += ` AND DATE_TRUNC('week', CALL_DATE) = '${week}'`;
  }
  if (escalated === "true") {
    whereClause += ` AND ESCALATED = TRUE`;
  }

  const sql = `
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
    FROM LPL_CONTACT_ANALYTICS.DEMO.CALL_TRANSCRIPTS
    ${whereClause}
    ORDER BY CALL_DATE DESC, CALL_TIME DESC
    LIMIT ${limit}
  `;

  try {
    const data = await query<Transcript>(sql);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching transcripts:", error);
    return NextResponse.json([]);
  }
}
