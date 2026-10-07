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
import { CortexBadge, CortexInfoPanel } from "@/components/ui/cortex-badge";
import { TranscriptModal } from "@/components/transcript-modal";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Phone, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Sparkles, Mail, RefreshCw, Info, Brain, Zap, Database, ExternalLink, Clock } from "lucide-react";

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

interface Insight {
  summary: string;
  keyFindings: string[];
  recommendations: string[];
  cortexFunctions?: string[];
  metrics: {
    totalCalls: number;
    avgSentiment: string;
    escalationRate: string;
    topDriver: string;
  };
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
  const [loading, setLoading] = useState(true);
  const [insightLoading, setInsightLoading] = useState(false);
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false);
  const [transcriptFilters, setTranscriptFilters] = useState<TranscriptFilters>({});

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchDrivers();
  }, [selectedLob, selectedSegment]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [trendsRes, segmentsRes] = await Promise.all([
        fetch("/api/trends"),
        fetch("/api/segments"),
      ]);
      const trendsData = await trendsRes.json();
      const segmentsData = await segmentsRes.json();
      setTrends(trendsData);
      setSegments(segmentsData);
      await fetchDrivers();
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
    setLoading(false);
  };

  const fetchDrivers = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedLob !== "all") params.set("lob", selectedLob);
      if (selectedSegment !== "all") params.set("segment", selectedSegment);
      const res = await fetch(`/api/drivers?${params}`);
      const data = await res.json();
      setDrivers(data);
    } catch (error) {
      console.error("Failed to fetch drivers:", error);
    }
  };

  const generateInsights = async () => {
    setInsightLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment: selectedLob, timeframe }),
      });
      const data = await res.json();
      setInsight(data);
    } catch (error) {
      console.error("Failed to generate insights:", error);
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
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">LPL</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Contact Driver Analytics</h1>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Powered by</span>
                  <Badge variant="outline" className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-xs px-2 py-0 font-medium gap-1">
                    <Sparkles className="h-3 w-3" />
                    Snowflake Cortex AI
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedLob} onValueChange={setSelectedLob}>
              <SelectTrigger className="w-48">
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
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Segments</SelectItem>
                {segments.segments?.map(seg => (
                  <SelectItem key={seg} value={seg}>{seg}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <CortexInfoPanel />

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
                <Phone className="h-4 w-4" /> Total Calls
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
              <CortexBadge function="SENTIMENT" size="sm" />
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
                {sentimentTrend >= 0 ? "+" : ""}{(sentimentTrend * 100).toFixed(1)}%
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
            <div className="absolute top-2 right-2 z-10">
              <CortexBadge function="CLASSIFY" size="sm" />
            </div>
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
          <TabsList>
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
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div>
                    <CardTitle>Call Volume Trend</CardTitle>
                    <CardDescription>Weekly call volume over the past 13 weeks - click a point to view calls</CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={{ calls: { label: "Calls", color: "hsl(var(--chart-1))" } }} className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="WEEK_START" tick={{ fontSize: 12 }} tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line 
                          type="monotone" 
                          dataKey="TOTAL_CALLS" 
                          stroke="hsl(var(--chart-1))" 
                          strokeWidth={2} 
                          dot={{ fill: "hsl(var(--chart-1))", cursor: "pointer" }}
                          activeDot={{
                            r: 8,
                            cursor: "pointer",
                            onClick: (e: any, payload: any) => {
                              if (payload?.payload?.WEEK_START) {
                                openTranscriptModal({
                                  week: payload.payload.WEEK_START,
                                  lob: selectedLob,
                                  segment: selectedSegment,
                                  title: `Calls for week of ${new Date(payload.payload.WEEK_START).toLocaleDateString()}`
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

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Distribution by LOB</CardTitle>
                      <CardDescription>Click a segment to drill down</CardDescription>
                    </div>
                    <CortexBadge function="CLASSIFY" />
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <ChartContainer config={{}} className="h-72 w-full mx-auto">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <Pie 
                          data={pieData} 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={80} 
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Top Contact Drivers</CardTitle>
                    <CardDescription>Click any row to view individual call transcripts</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <CortexBadge function="SENTIMENT" />
                    <CortexBadge function="CLASSIFY" />
                  </div>
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
                          <span className={d.AVG_SENTIMENT > 0.6 ? "text-accent" : d.AVG_SENTIMENT < 0.4 ? "text-destructive" : ""}>
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      AI-Generated Insights
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <span>Analysis powered by</span>
                      <CortexBadge function="COMPLETE" size="sm" />
                      <span className="text-muted-foreground">using Llama 3.1 70B</span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
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
                {insight ? (
                  <div className="space-y-6">
                    <div className="p-4 bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-lg border border-primary/10">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">Executive Summary</h4>
                        <CortexBadge function="SUMMARIZE" size="sm" />
                      </div>
                      <p className="text-muted-foreground">{insight.summary}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 bg-secondary/30 rounded-lg">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" /> Key Findings
                          <CortexBadge function="EXTRACT" size="sm" />
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
                          <Zap className="h-4 w-4 text-primary" /> AI Recommendations
                          <CortexBadge function="COMPLETE" size="sm" />
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
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Info className="h-4 w-4" />
                        <span>Cortex Functions Used:</span>
                        <CortexBadge function="COMPLETE" size="sm" />
                        <CortexBadge function="SENTIMENT" size="sm" />
                        <CortexBadge function="SUMMARIZE" size="sm" />
                        <CortexBadge function="CLASSIFY" size="sm" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-4 border-t">
                      <Button variant="outline" className="gap-2">
                        <Mail className="h-4 w-4" />
                        Email Report
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Send this analysis to configured distribution lists
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                      <Brain className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Generate AI Insights</h3>
                    <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
                      Click the button above to analyze call drivers using Snowflake Cortex LLM functions and get AI-powered recommendations
                    </p>
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <span>Powered by:</span>
                      <CortexBadge function="COMPLETE" size="sm" />
                      <CortexBadge function="SENTIMENT" size="sm" />
                      <CortexBadge function="SUMMARIZE" size="sm" />
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
            <span>Data source: LPL_CONTACT_ANALYTICS.DEMO</span>
            <span className="mx-2">•</span>
            <span>AI: Snowflake Cortex (Llama 3.1 70B, Claude 3.5 Sonnet)</span>
            <span className="mx-2">•</span>
            <span>Refresh: Real-time</span>
          </div>
        </footer>
      </main>

      <TranscriptModal 
        open={transcriptModalOpen} 
        onOpenChange={setTranscriptModalOpen} 
        filters={transcriptFilters}
      />
    </div>
  );
}
