"use client";

import { Badge } from "@/components/ui/badge";
import { Sparkles, Brain, Zap, BarChart3, MessageSquare } from "lucide-react";

interface CortexBadgeProps {
  function: "COMPLETE" | "SUMMARIZE" | "SENTIMENT" | "CLASSIFY" | "EXTRACT" | "TRANSLATE" | "EMBED" | "SEARCH";
  size?: "sm" | "md";
  showTooltip?: boolean;
}

const CORTEX_INFO: Record<string, { icon: React.ReactNode; description: string; example: string; color: string }> = {
  COMPLETE: {
    icon: <Brain className="h-3 w-3" />,
    description: "CORTEX.COMPLETE() - Generates text responses using large language models (Claude, Llama, Mistral)",
    example: "SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3.1-70b', 'Summarize these call drivers...')",
    color: "bg-purple-500/10 text-purple-700 border-purple-500/20"
  },
  SUMMARIZE: {
    icon: <MessageSquare className="h-3 w-3" />,
    description: "CORTEX.SUMMARIZE() - Automatically summarizes long text documents or transcripts",
    example: "SELECT SNOWFLAKE.CORTEX.SUMMARIZE(transcript) FROM call_transcripts",
    color: "bg-blue-500/10 text-blue-700 border-blue-500/20"
  },
  SENTIMENT: {
    icon: <BarChart3 className="h-3 w-3" />,
    description: "CORTEX.SENTIMENT() - Analyzes text and returns a sentiment score from -1 (negative) to 1 (positive)",
    example: "SELECT SNOWFLAKE.CORTEX.SENTIMENT(transcript) as score FROM call_transcripts",
    color: "bg-green-500/10 text-green-700 border-green-500/20"
  },
  CLASSIFY: {
    icon: <Zap className="h-3 w-3" />,
    description: "CORTEX.CLASSIFY_TEXT() - Classifies text into predefined categories using AI",
    example: "SELECT SNOWFLAKE.CORTEX.CLASSIFY_TEXT(transcript, ['billing','technical','sales'])",
    color: "bg-orange-500/10 text-orange-700 border-orange-500/20"
  },
  EXTRACT: {
    icon: <Sparkles className="h-3 w-3" />,
    description: "CORTEX.EXTRACT_ANSWER() - Extracts specific answers from text based on questions",
    example: "SELECT SNOWFLAKE.CORTEX.EXTRACT_ANSWER(transcript, 'What was the customer issue?')",
    color: "bg-pink-500/10 text-pink-700 border-pink-500/20"
  },
  TRANSLATE: {
    icon: <MessageSquare className="h-3 w-3" />,
    description: "CORTEX.TRANSLATE() - Translates text between languages",
    example: "SELECT SNOWFLAKE.CORTEX.TRANSLATE(transcript, 'es', 'en')",
    color: "bg-cyan-500/10 text-cyan-700 border-cyan-500/20"
  },
  EMBED: {
    icon: <Brain className="h-3 w-3" />,
    description: "CORTEX.EMBED_TEXT_768() - Generates vector embeddings for semantic search",
    example: "SELECT SNOWFLAKE.CORTEX.EMBED_TEXT_768('e5-base-v2', transcript)",
    color: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20"
  },
  SEARCH: {
    icon: <Sparkles className="h-3 w-3" />,
    description: "Cortex Search Service - Hybrid search combining semantic + keyword for RAG applications",
    example: "SELECT * FROM TABLE(cortex_search_service.search('customer complaint'))",
    color: "bg-violet-500/10 text-violet-700 border-violet-500/20"
  }
};

export function CortexBadge({ function: func, size = "sm", showTooltip = true, tooltipPosition = "top" }: CortexBadgeProps & { tooltipPosition?: "top" | "bottom" }) {
  const info = CORTEX_INFO[func];
  
  const badge = (
    <Badge 
      variant="outline" 
      className={`${info.color} ${size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"} font-mono cursor-help gap-1 transition-all hover:scale-105`}
    >
      {info.icon}
      CORTEX.{func}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }
  
  return (
    <div 
      className="relative inline-block group"
      onClick={(e) => e.stopPropagation()}
    >
      {badge}
      <div className={`absolute left-1/2 -translate-x-1/2 w-80 p-3 bg-popover text-popover-foreground border rounded-lg shadow-lg z-[9999] pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ${tooltipPosition === "bottom" ? "top-full mt-2" : "bottom-full mb-2"}`}>
        <div className="flex items-start gap-2 mb-2">
          <div className="p-1.5 rounded bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Snowflake Cortex AI</h4>
            <p className="text-xs text-muted-foreground">{info.description}</p>
          </div>
        </div>
        <div className="bg-muted/50 rounded p-2 mt-2">
          <p className="text-[10px] font-mono text-muted-foreground break-all">{info.example}</p>
        </div>
        {tooltipPosition === "bottom" ? (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[-1px] border-8 border-transparent border-b-popover"></div>
        ) : (
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-8 border-transparent border-t-popover"></div>
        )}
      </div>
    </div>
  );
}

export function CortexInfoPanel() {
  return (
    <div className="p-4 bg-gradient-to-r from-primary/5 via-primary/10 to-accent/5 rounded-lg border border-primary/20">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Powered by Snowflake Cortex AI</h3>
          <p className="text-xs text-muted-foreground">LLM functions running directly in your Snowflake warehouse</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {(["COMPLETE", "SENTIMENT", "SUMMARIZE", "CLASSIFY"] as const).map((func) => (
          <CortexBadge key={func} function={func} size="md" />
        ))}
      </div>
    </div>
  );
}
