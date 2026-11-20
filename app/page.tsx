"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AiBadge, PoweredBy, SampleBadge } from "@/components/ui/cortex-badge";
import { TranscriptModal } from "@/components/transcript-modal";
import { ModeChip } from "@/components/ModeChip";
import { INSIGHT_STEPS, Reasoning, sampleDelayMs } from "@/components/Reasoning";
import { HOSTED_EXAMPLE, fetchDrivers as loadDrivers, fetchInsights, fetchSegments, fetchTrends } from "@/lib/api-client";
import { getModeState, type ModeState } from "@/lib/mode";
import type { Insight } from "@/lib/contact-data";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Phone, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Sparkles, RefreshCw, Info, Brain, Zap, Database, ExternalLink, Clock } from "lucide-react";

interface TrendData {
  WEEK_START: string;
  TOTAL_CALLS: number;
  OVERALL_SENTIMENT: number;
  TOTAL_ESCALATIONS: number;
  ESCALATION_RATE: number;
  AVG_CALL_DURATION_SEC: number;
}

interface DriverData {
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

interface TranscriptFilters {
  lob?: string;
  segment?: string;
  week?: string;
  escalated?: boolean;
  title?: string;
}

export default function Dashboard() {
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [segments, setSegments] = useState<{ lobs: string[]; segments: string[] }>({ lobs: [], segments: [] });
  const [selectedLob, setSelectedLob] = useState("all");
  const [selectedSegment, setSelectedSegment] = useState("all");
  const [timeframe, setTimeframe] = useState("month");
  // Below md the pie card is too narrow for outside labels at the desktop radius.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const [loading, setLoading] = useState(true);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightExpectedMs, setInsightExpectedMs] = useState(6000);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ModeState>();
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false);
  const [transcriptFilters, setTranscriptFilters] = useState<TranscriptFilters>({});
  const sample = mode?.mode !== "live";
  const model = mode?.model ?? "llama3.3-70b";

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [trendsData, segmentsData] = await Promise.all([fetchTrends(), fetchSegments()]);
      setTrends(trendsData);
      setSegments(segmentsData);
      await fetchDrivers();
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  };

  const fetchDrivers = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedLob !== "all") params.set("lob", selectedLob);
      if (selectedSegment !== "all") params.set("segment", selectedSegment);
      setDrivers(await loadDrivers(params));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    getModeState().then(setMode);
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLob, selectedSegment]);

  const generateInsights = async () => {
    // Sample mode waits 4-8 s; Live mode has no added delay (the steps advance on a typical ~12 s latency).
    const delay = sampleDelayMs();
    setInsightExpectedMs(sample ? delay : 12000);
    setInsightLoading(true);
    setInsightError(null);
    setInsight(null);
    try {
      setInsight(await fetchInsights(selectedLob, timeframe, delay));
    } catch (err) {
      setInsightError((err as Error).message);
    }
    setInsightLoading(false);
  };

  const openTranscriptModal = (filters: TranscriptFilters) => {
    setTranscriptFilters(filters);
    setTranscriptModalOpen(true);
  };

  const latestTrend = trends[trends.length - 1];
  const previousTrend = trends[trends.length - 2];
  const callTrend = latestTrend && previousTrend ? ((latestTrend.TOTAL_CALLS - previousTrend.TOTAL_CALLS) / previousTrend.TOTAL_CALLS * 100) : 0;
  const sentimentTrend = latestTrend && previousTrend ? (latestTrend.OVERALL_SENTIMENT - previousTrend.OVERALL_SENTIMENT) : 0;

  const lobDistribution = drivers.reduce((acc, d) => {
    acc[d.LINE_OF_BUSINESS] = (acc[d.LINE_OF_BUSINESS] || 0) + d.CALL_VOLUME;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(lobDistribution).map(([name, value]) => ({ name, value }));
  const COLORS = ["#e91e8c", "#00d4aa", "#ffb800", "#7c4dff", "#ff5252"];
  const sentimentClass = (s: number) => (s >= 0.3 ? "text-accent" : s < 0 ? "text-destructive" : "");

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Contact Driver Analytics</h1>
                <p className="text-xs text-muted-foreground">Northwind Financial (fictional) · synthetic data</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center md:justify-end gap-3">
            <ModeChip />
            <Select value={selectedLob} onValueChange={setSelectedLob}>
              <SelectTrigger className="flex-1 min-w-[10rem] md:flex-none md:w-48">
                <SelectValue placeholder="Line of Business" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lines of Business</SelectItem>
                {segments.lobs?.map(lob => (
                  <SelectItem key={lob} value={lob}>{lob}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedSegment} onValueChange={setSelectedSegment}>
              <SelectTrigger className="flex-1 min-w-[10rem] md:flex-none md:w-44">
                <SelectValue placeholder="Segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Segments</SelectItem>
                {segments.segments?.map(seg => (
                  <SelectItem key={seg} value={seg}>{seg}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchData} aria-label="Reload data">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {mode && sample && (
        <div role="note" className="border-b bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-2 text-xs flex flex-wrap items-center gap-x-2 gap-y-1">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            <strong>Sample mode.</strong>
            <span>Runs in your browser on synthetic data; no Snowflake account needed. Sentiment, call summaries, and driver labels were captured from a live Cortex run; AI insights are scripted samples.</span>
            <a className="underline underline-offset-2 font-medium" href="https://github.com/sfc-gh-ooral/sfguide-contact-driver-analytics#live-mode-run-it-in-your-account">Run it in your own account</a>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {error && (
          <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="font-semibold text-destructive">Live mode: a Snowflake call failed</p>
            <p className="mt-1 break-words">{error}</p>
            <p className="mt-1 text-muted-foreground">No sample data was substituted. Fix the connection or switch to Sample in the header.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card 
            className="relative cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 group"
            onClick={() => openTranscriptModal({ 
              lob: selectedLob, 
              segment: selectedSegment,
              title: "All Calls" + (selectedLob !== "all" ? ` - ${selectedLob}` : "")
            })}
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> Calls (latest week)
              </CardDescription>
              <CardTitle className="text-3xl font-bold">
                {latestTrend?.TOTAL_CALLS?.toLocaleString() || "—"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`flex items-center text-sm ${callTrend >= 0 ? "text-destructive" : "text-accent"}`}>
                {callTrend >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {Math.abs(callTrend).toFixed(1)}% from last week
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="h-3 w-3" />
                Click to view call transcripts
              </div>
            </CardContent>
          </Card>

          <Card 
            className="relative cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 group"
            onClick={() => openTranscriptModal({ 
              lob: selectedLob, 
              segment: selectedSegment,
              title: "All Calls - Sentiment Analysis"
            })}
          >
            <div className="absolute top-2 right-2 z-10">
              <AiBadge fn="SENTIMENT" sample={sample} sampleLabel="Sample data" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> Avg Sentiment
              </CardDescription>
              <CardTitle className="text-3xl font-bold">
                {latestTrend?.OVERALL_SENTIMENT?.toFixed(2) || "—"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`flex items-center text-sm ${sentimentTrend >= 0 ? "text-accent" : "text-destructive"}`}>
                {sentimentTrend >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {sentimentTrend >= 0 ? "+" : ""}{sentimentTrend.toFixed(2)} vs last week (-1 to 1 scale)
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="h-3 w-3" />
                Click to view sentiment details
              </div>
            </CardContent>
          </Card>

          <Card 
            className="relative cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 group"
            onClick={() => openTranscriptModal({ 
              lob: selectedLob, 
              segment: selectedSegment,
              escalated: true,
              title: "Escalated Calls" + (selectedLob !== "all" ? ` - ${selectedLob}` : "")
            })}
          >
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Escalations
              </CardDescription>
              <CardTitle className="text-3xl font-bold">
                {latestTrend?.TOTAL_ESCALATIONS?.toLocaleString() || "—"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                {latestTrend?.ESCALATION_RATE?.toFixed(1)}% escalation rate
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="h-3 w-3" />
                Click to view escalated calls
              </div>
            </CardContent>
          </Card>

          <Card className="relative">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Avg Duration
              </CardDescription>
              <CardTitle className="text-3xl font-bold">
                {latestTrend?.AVG_CALL_DURATION_SEC ? `${Math.round(latestTrend.AVG_CALL_DURATION_SEC / 60)}m` : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                {latestTrend?.AVG_CALL_DURATION_SEC?.toFixed(0)}s average
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="trends" className="space-y-4">
          <TabsList className="max-w-full overflow-x-auto justify-start">
            <TabsTrigger value="trends" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Trend Analysis
            </TabsTrigger>
            <TabsTrigger value="drivers" className="gap-2">
              <Database className="h-4 w-4" />
              Contact Drivers
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2">
              <Brain className="h-4 w-4" />
              AI Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trends" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2 min-w-0">
                <CardHeader>
                  <div>
                    <CardTitle>Call Volume Trend</CardTitle>
                    <CardDescription>Weekly call volume over the past 13 weeks - click a point to view calls</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{ calls: { label: "Calls", color: "var(--chart-1)" } }} className="h-72 max-w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="WEEK_START" tick={{ fontSize: 12 }} tickFormatter={(v) => new Date(`${v}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line 
                          type="monotone" 
                          dataKey="TOTAL_CALLS" 
                          stroke="var(--chart-1)" 
                          strokeWidth={2} 
                          dot={{ fill: "var(--chart-1)", cursor: "pointer" }}
                          activeDot={{
                            r: 8,
                            cursor: "pointer",
                            onClick: (_e: unknown, payload: unknown) => {
                              const p = payload as { payload?: { WEEK_START?: string } };
                              if (p?.payload?.WEEK_START) {
                                openTranscriptModal({
                                  week: p.payload.WEEK_START,
                                  lob: selectedLob,
                                  segment: selectedSegment,
                                  title: `Calls for week of ${p.payload.WEEK_START}`
                                });
                              }
                            }
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="min-w-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Distribution by LOB</CardTitle>
                      <CardDescription>Last 4 weeks · click a segment to drill down</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <ChartContainer config={{}} className="h-72 w-full mx-auto max-md:[&_.recharts-pie-label-text]:text-[11px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Pie 
                          data={pieData} 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={narrow ? 55 : 80} 
                          dataKey="value" 
                          label={({ name, percent }) => `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`} 
                          labelLine={false}
                          cursor="pointer"
                          onClick={(data) => {
                            openTranscriptModal({
                              lob: data.name,
                              segment: selectedSegment,
                              title: `${data.name} Calls`
                            });
                          }}
                        >
                          {pieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => value.toLocaleString()} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="drivers" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div>
                    <CardTitle>Top Contact Drivers</CardTitle>
                    <CardDescription>Last 4 weeks, by line of business, product, segment, and caller · click any row to view its calls</CardDescription>
                  </div>
                  <AiBadge fn="SENTIMENT" sample={sample} sampleLabel="Sample data" />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line of Business</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Segment</TableHead>
                      <TableHead>Caller</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          Sentiment
                          <span className="text-[9px] text-muted-foreground">(AI)</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-right">Resolution</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drivers.slice(0, 15).map((d, i) => (
                      <TableRow 
                        key={i} 
                        className="cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => openTranscriptModal({
                          lob: d.LINE_OF_BUSINESS,
                          segment: d.CUSTOMER_SEGMENT,
                          title: `${d.LINE_OF_BUSINESS} - ${d.CUSTOMER_SEGMENT} Calls`
                        })}
                      >
                        <TableCell className="font-medium">{d.LINE_OF_BUSINESS}</TableCell>
                        <TableCell>{d.PRODUCT_CATEGORY}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{d.CUSTOMER_SEGMENT}</Badge>
                        </TableCell>
                        <TableCell>{d.CALLER_TYPE}</TableCell>
                        <TableCell className="text-right">{d.CALL_VOLUME?.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <span className={sentimentClass(d.AVG_SENTIMENT)}>
                            {d.AVG_SENTIMENT?.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{d.RESOLUTION_RATE?.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <Card className="border-primary/20">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      AI-Generated Insights
                    </CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-2 mt-1">
                      <span>Executive summary from aggregated driver stats</span>
                      {sample ? <SampleBadge /> : <><PoweredBy fn="AI_COMPLETE" /><span className="text-muted-foreground">{model}</span></>}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={timeframe} onValueChange={setTimeframe}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="week">Past Week</SelectItem>
                        <SelectItem value="month">Past Month</SelectItem>
                        <SelectItem value="quarter">Past Quarter</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={generateInsights} disabled={insightLoading} className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      {insightLoading ? "Analyzing..." : "Generate Insights"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {insightLoading ? (
                  <Reasoning steps={INSIGHT_STEPS(model)} expectedMs={insightExpectedMs} />
                ) : insightError ? (
                  <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
                    <p className="font-semibold text-destructive">The AI_COMPLETE call failed</p>
                    <p className="mt-1 break-words">{insightError}</p>
                  </div>
                ) : insight ? (
                  <div className="space-y-6">
                    <div className="p-4 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-lg border border-primary/10">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h4 className="font-semibold">Executive Summary</h4>
                        {insight.source === "sample" ? <SampleBadge /> : <PoweredBy fn="AI_COMPLETE" />}
                      </div>
                      <p className="text-muted-foreground">{insight.summary}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 bg-secondary/30 rounded-lg">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" /> Key Findings
                        </h4>
                        <ul className="space-y-2">
                          {insight.keyFindings.map((finding, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                              {finding}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 bg-secondary/30 rounded-lg">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Zap className="h-4 w-4 text-primary" /> Recommendations
                        </h4>
                        <ul className="space-y-2">
                          {insight.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs shrink-0">
                                {i + 1}
                              </div>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="p-3 bg-muted/50 rounded-lg border">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Info className="h-4 w-4" />
                        {insight.source === "live" ? (
                          <span>Live: AI_COMPLETE ({insight.model}) on totals from V_CALL_DRIVER_ANALYSIS and CALL_TRANSCRIPTS · measured latency {((insight.latencyMs ?? 0) / 1000).toFixed(1)} s · AI-generated; review before use.</span>
                        ) : (
                          <span>Sample: scripted text built from the same totals. In Live mode, AI_COMPLETE writes this panel from those totals.</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                      <Brain className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Generate AI Insights</h3>
                    <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
                      Summarizes call volume, escalations, and sentiment by line of business and call reason, then suggests where to reduce repeat calls and escalations.
                    </p>
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      {sample ? <SampleBadge label="Sample mode: scripted response" /> : <PoweredBy fn="AI_COMPLETE" />}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <footer className="pt-6 border-t text-center text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <Database className="h-4 w-4" />
            {sample ? (
              <span>Data source: built-in synthetic sample data{HOSTED_EXAMPLE ? " (hosted example)" : ""}. Illustrative example; not production or regulatory advice.</span>
            ) : (
              <span>Data source: CONTACT_DRIVER_EXAMPLE.ANALYTICS (synthetic) · AI: SNOWFLAKE.CORTEX.SENTIMENT, AI_CLASSIFY, and AI_COMPLETE ({model}) · Illustrative example; not production or regulatory advice.</span>
            )}
          </div>
        </footer>
      </main>

      <TranscriptModal 
        open={transcriptModalOpen} 
        onOpenChange={setTranscriptModalOpen} 
        filters={transcriptFilters}
        sample={sample}
      />
    </div>
  );
}
