import { NextResponse } from "next/server";
import { query } from "@/lib/snowflake";

export async function GET() {
  try {
    const results = await query<{
      LINE_OF_BUSINESS: string;
      PRODUCT_CATEGORY: string;
      CUSTOMER_SEGMENT: string;
    }>(`
      SELECT DISTINCT line_of_business, product_category, customer_segment
      FROM LPL_CONTACT_ANALYTICS.DEMO.CALL_TRANSCRIPTS
    `);

    const lobs = [...new Set(results.map(r => r.LINE_OF_BUSINESS))];
    const segments = [...new Set(results.map(r => r.CUSTOMER_SEGMENT))];
    const products = [...new Set(results.map(r => r.PRODUCT_CATEGORY))];

    return NextResponse.json({ lobs, segments, products });
  } catch (error) {
    console.error("Segments API error:", error);
    return NextResponse.json({ error: "Failed to fetch segments" }, { status: 500 });
  }
}
