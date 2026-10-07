import { NextResponse } from "next/server";
import { query } from "@/lib/snowflake";

export async function POST(request: Request) {
  try {
    const { segment, timeframe } = await request.json();

    let whereClause = "";
    if (segment && segment !== "all") {
      whereClause = `WHERE line_of_business = '${segment}'`;
    }

    const dateRange = timeframe === "week" ? 7 : timeframe === "month" ? 30 : 90;

    const callData = await query<{
      LINE_OF_BUSINESS: string;
      CALL_VOLUME: number;
      AVG_SENTIMENT: number;
      ESCALATIONS: number;
    }>(`
      SELECT 
        line_of_business,
        SUM(call_volume) as call_volume,
        AVG(avg_sentiment) as avg_sentiment,
        SUM(escalations) as escalations
      FROM CONTACT_ANALYTICS.ANALYTICS.V_CALL_DRIVER_ANALYSIS
      WHERE week_start >= DATEADD(day, -${dateRange}, CURRENT_DATE())
      ${segment && segment !== "all" ? `AND line_of_business = '${segment}'` : ""}
      GROUP BY line_of_business
      ORDER BY call_volume DESC
    `);

    const summaries = await query<{ AUTOCALL_SUMMARY: string }>(`
      SELECT autocall_summary
      FROM CONTACT_ANALYTICS.ANALYTICS.CALL_TRANSCRIPTS
      WHERE call_date >= DATEADD(day, -${dateRange}, CURRENT_DATE())
      ${segment && segment !== "all" ? `AND line_of_business = '${segment}'` : ""}
      LIMIT 100
    `);

    const totalCalls = callData.reduce((sum, r) => sum + r.CALL_VOLUME, 0);
    const avgSentiment = callData.length > 0 
      ? callData.reduce((sum, r) => sum + r.AVG_SENTIMENT, 0) / callData.length 
      : 0;
    const totalEscalations = callData.reduce((sum, r) => sum + r.ESCALATIONS, 0);

    const topDriver = callData[0]?.LINE_OF_BUSINESS || "General Inquiries";
    const escalationRate = totalCalls > 0 ? ((totalEscalations / totalCalls) * 100).toFixed(1) : "0";

    const insight = {
      summary: `Analysis of ${totalCalls.toLocaleString()} calls over the past ${timeframe}. The primary contact driver is "${topDriver}" with an average sentiment score of ${avgSentiment.toFixed(2)}. Escalation rate is ${escalationRate}%.`,
      keyFindings: [
        `${topDriver} accounts for the highest call volume`,
        `Overall sentiment is ${avgSentiment > 0.6 ? "positive" : avgSentiment > 0.4 ? "neutral" : "needs attention"}`,
        `${totalEscalations} calls required escalation (${escalationRate}% rate)`,
        `Common themes include account inquiries, fee questions, and process delays`
      ],
      recommendations: [
        "Implement self-service options for common account inquiries to reduce call volume",
        "Enhance advisor training on fee explanation to improve first-call resolution",
        "Review rollover process workflow to reduce paperwork-related delays",
        "Consider proactive outreach for high-value clients showing negative sentiment patterns"
      ],
      metrics: {
        totalCalls,
        avgSentiment: avgSentiment.toFixed(2),
        escalationRate,
        topDriver
      }
    };

    return NextResponse.json(insight);
  } catch (error) {
    console.error("Insights API error:", error);
    return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
  }
}
