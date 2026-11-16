"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AiBadge } from "@/components/ui/cortex-badge";
import { fetchTranscripts as loadTranscripts } from "@/lib/api-client";
import type { Transcript } from "@/lib/contact-data";
import { 
  Phone, 
  Clock, 
  User, 
  Building, 
  AlertTriangle, 
  CheckCircle,
  Loader2,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Tags
} from "lucide-react";

interface TranscriptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sample mode: show sample labels instead of "Powered by". */
  sample: boolean;
  filters: {
    lob?: string;
    segment?: string;
    week?: string;
    escalated?: boolean;
    title?: string;
  };
}

export function TranscriptModal({ open, onOpenChange, filters, sample }: TranscriptModalProps) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);

  useEffect(() => {
    if (open) {
      fetchTranscripts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filters]);

  const fetchTranscripts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.lob) params.set("lob", filters.lob);
      if (filters.segment) params.set("segment", filters.segment);
      if (filters.week) params.set("week", filters.week);
      if (filters.escalated) params.set("escalated", "true");
      params.set("limit", "100");

      setTranscripts(await loadTranscripts(params));
      setSelectedTranscript(null);
    } catch (err) {
      setTranscripts([]);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getSentimentColor = (score: number) => {
    if (score >= 0.3) return "text-green-600 bg-green-50 dark:bg-green-950/40 dark:text-green-300";
    if (score <= -0.3) return "text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300";
    return "text-yellow-700 bg-yellow-50 dark:bg-yellow-950/40 dark:text-yellow-300";
  };

  const getSentimentIcon = (score: number) => {
    if (score >= 0.3) return <TrendingUp className="h-3 w-3" />;
    if (score <= -0.3) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getSentimentLabel = (score: number) => {
    if (score >= 0.3) return "Positive";
    if (score <= -0.3) return "Negative";
    return "Neutral";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                {filters.title || "Call Transcripts"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {sample ? "Synthetic sample calls (no Snowflake connection used)" : "Synthetic calls from CONTACT_DRIVER_EXAMPLE.ANALYTICS.CALL_TRANSCRIPTS in your Snowflake account"}
              </DialogDescription>
            </div>
            <Badge variant="outline" className="font-mono">
              {transcripts.length} calls
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground mt-2">{sample ? "Loading sample calls..." : "Loading calls from Snowflake..."}</p>
              </div>
            </div>
          ) : error ? (
            <div role="alert" className="m-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-semibold text-destructive">Live mode: loading calls failed</p>
              <p className="mt-1 break-words">{error}</p>
            </div>
          ) : (
            <>
              <ScrollArea className="w-[420px] min-w-[420px] border-r">
                <div className="p-2 space-y-1">
                  {transcripts.map((t) => (
                    <Card
                      key={t.CALL_ID}
                      className={`cursor-pointer transition-all hover:bg-accent/50 ${
                        selectedTranscript?.CALL_ID === t.CALL_ID ? "border-primary bg-accent" : ""
                      }`}
                      onClick={() => setSelectedTranscript(t)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">
                                {t.CALL_ID}
                              </span>
                              {t.ESCALATED && (
                                <AlertTriangle className="h-3 w-3 text-red-500" />
                              )}
                            </div>
                            <p className="text-sm font-medium truncate mt-1">{t.CALL_REASON}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{t.LINE_OF_BUSINESS}</span>
                              <span>•</span>
                              <span>{formatDuration(t.DURATION_SECONDS)}</span>
                            </div>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] px-1.5 py-0 ${getSentimentColor(t.SENTIMENT_SCORE)}`}
                          >
                            {getSentimentIcon(t.SENTIMENT_SCORE)}
                            <span className="ml-1">{t.SENTIMENT_SCORE.toFixed(2)}</span>
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                {selectedTranscript ? (
                  <>
                    <div className="p-6 border-b bg-muted/30">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg flex items-center gap-2 flex-wrap">
                            <span className="break-all">Call ID: {selectedTranscript.CALL_ID}</span>
                            {selectedTranscript.ESCALATED && (
                              <Badge variant="destructive" className="text-xs shrink-0">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Escalated
                              </Badge>
                            )}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {selectedTranscript.CALL_DATE} at {selectedTranscript.CALL_TIME}
                          </p>
                        </div>
                        <div className={`px-4 py-2 rounded-lg shrink-0 ${getSentimentColor(selectedTranscript.SENTIMENT_SCORE)}`}>
                          <div className="flex items-center gap-1.5 text-sm font-medium justify-center">
                            {getSentimentIcon(selectedTranscript.SENTIMENT_SCORE)}
                            <span>{getSentimentLabel(selectedTranscript.SENTIMENT_SCORE)}</span>
                          </div>
                          <p className="text-xl font-bold text-center">
                            {selectedTranscript.SENTIMENT_SCORE.toFixed(3)}
                          </p>
                          <p className="text-[10px] text-center opacity-70">
                            {sample ? "sample (captured CORTEX.SENTIMENT)" : "via SNOWFLAKE.CORTEX.SENTIMENT"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Line of Business</p>
                            <p className="text-sm font-medium">{selectedTranscript.LINE_OF_BUSINESS}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Segment</p>
                            <p className="text-sm font-medium">{selectedTranscript.CUSTOMER_SEGMENT}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Duration</p>
                            <p className="text-sm font-medium">{formatDuration(selectedTranscript.DURATION_SECONDS)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedTranscript.CALL_DISPOSITION === "Resolved" ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase">Disposition</p>
                            <p className="text-sm font-medium">{selectedTranscript.CALL_DISPOSITION}</p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {selectedTranscript.CALL_REASON}
                        </Badge>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Tags className="h-3 w-3" aria-hidden /> AI driver: <strong className="text-foreground">{selectedTranscript.AI_DRIVER}</strong>
                        </span>
                        <AiBadge fn="AI_CLASSIFY" sample={sample} />
                      </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                      <div className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <MessageSquare className="h-5 w-5 text-primary" />
                          <h4 className="font-semibold">Call Transcript</h4>
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 dark:bg-blue-950/30 dark:border-blue-900">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Brain className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">AI Summary</span>
                            <AiBadge fn="AI_COMPLETE" sample={sample} />
                          </div>
                          <p className="text-sm text-blue-900 dark:text-blue-100">
                            {selectedTranscript.AI_SUMMARY}
                          </p>
                        </div>

                        <div className="bg-muted/30 rounded-lg p-6 leading-relaxed whitespace-pre-wrap font-mono text-sm">
                          {selectedTranscript.TRANSCRIPT}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 text-center">
                          Synthetic transcript. Sentiment, summary, and driver were computed once per transcript template in sql/setup.sql with SNOWFLAKE.CORTEX.SENTIMENT, AI_COMPLETE, and AI_CLASSIFY{sample ? " (captured outputs shown in Sample mode)" : ""}.
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Phone className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">Select a call to view details</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
