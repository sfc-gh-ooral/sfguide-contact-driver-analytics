import { NextResponse } from "next/server";
import { query } from "@/lib/snowflake";

interface DriverRow {
  LINE_OF_BUSINESS: string;
  PRODUCT_CATEGORY: string;
  CUSTOMER_SEGMENT: string;
  CALLER_TYPE: string;
  CALL_VOLUME: number;
  AVG_DURATION: number;
  AVG_SENTIMENT: number;
  ESCALATIONS: number;
  RESOLUTION_RATE: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lob = searchParams.get("lob");
    const segment = searchParams.get("segment");

    let whereClause = "WHERE week_start >= DATEADD(day, -30, CURRENT_DATE())";
    if (lob && lob !== "all") {
      whereClause += ` AND line_of_business = '${lob}'`;
    }
    if (segment && segment !== "all") {
      whereClause += ` AND customer_segment = '${segment}'`;
    }

    const results = await query<DriverRow>(`
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
      FROM LPL_CONTACT_ANALYTICS.DEMO.V_CALL_DRIVER_ANALYSIS
      ${whereClause}
      GROUP BY line_of_business, product_category, customer_segment, caller_type
      ORDER BY call_volume DESC
      LIMIT 50
    `);
    return NextResponse.json(results);
  } catch (error) {
    console.error("Drivers API error:", error);
    return NextResponse.json({ error: "Failed to fetch drivers" }, { status: 500 });
  }
}
