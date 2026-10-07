"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CortexBadge } from "@/components/ui/cortex-badge";
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
  Brain
} from "lucide-react";

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

interface TranscriptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: {
    lob?: string;
    segment?: string;
    week?: string;
    escalated?: boolean;
    title?: string;
  };
}

export function TranscriptModal({ open, onOpenChange, filters }: TranscriptModalProps) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);

  useEffect(() => {
    if (open) {
      fetchTranscripts();
    }
  }, [open, filters]);

  const fetchTranscripts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.lob) params.set("lob", filters.lob);
      if (filters.segment) params.set("segment", filters.segment);
      if (filters.week) params.set("week", filters.week);
      if (filters.escalated) params.set("escalated", "true");
      params.set("limit", "100");

      const response = await fetch(`/api/transcripts?${params}`);
      const data = await response.json();
      setTranscripts(data);
      setSelectedTranscript(null);
    } catch (error) {
      console.error("Failed to fetch transcripts:", error);
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
    if (score >= 0.3) return "text-green-600 bg-green-50";
    if (score <= -0.3) return "text-red-600 bg-red-50";
    return "text-yellow-600 bg-yellow-50";
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

  const generateCallSummary = (transcript: Transcript) => {
    const reason = transcript.CALL_REASON;
    const disposition = transcript.CALL_DISPOSITION;
    const sentiment = transcript.SENTIMENT_SCORE;
    const lob = transcript.LINE_OF_BUSINESS;
    
    const sentimentDesc = sentiment >= 0.3 ? "positive" : sentiment <= -0.3 ? "negative" : "neutral";
    const outcomeDesc = disposition === "Resolved" ? "successfully resolved" : 
                       disposition === "Transferred" ? "transferred to a specialist" :
                       disposition === "Follow-up Required" ? "requires follow-up action" : "escalated for further review";
    
    return `Customer called regarding ${reason.toLowerCase()} for ${lob}. The call was ${outcomeDesc} with an overall ${sentimentDesc} customer sentiment.`;
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
                Viewing real call data from Snowflake
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
                <p className="text-sm text-muted-foreground mt-2">Loading transcripts from Snowflake...</p>
              </div>
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
                            via CORTEX.SENTIMENT
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

                      <div className="mt-3">
                        <Badge variant="secondary" className="text-xs">
                          {selectedTranscript.CALL_REASON}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                      <div className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <MessageSquare className="h-5 w-5 text-primary" />
                          <h4 className="font-semibold">Call Transcript</h4>
                          <CortexBadge function="SUMMARIZE" size="sm" tooltipPosition="bottom" />
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Brain className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">AI Summary</span>
                            <span className="text-[10px] text-blue-600">via CORTEX.SUMMARIZE</span>
                          </div>
                          <p className="text-sm text-blue-900">
                            {generateCallSummary(selectedTranscript)}
                          </p>
                        </div>

                        <div className="bg-muted/30 rounded-lg p-6 leading-relaxed whitespace-pre-wrap font-mono text-sm">
                          {selectedTranscript.TRANSCRIPT}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 text-center">
                          Transcript analyzed using SNOWFLAKE.CORTEX.SENTIMENT() and SNOWFLAKE.CORTEX.SUMMARIZE()
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
