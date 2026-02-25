import { useState } from "react";
import type {
  CreatorAnalyzeRequest,
  CreatorAnalysisResponse,
  CreatorShortRenderRequest,
  CreatorShortRenderResponse,
} from "@/lib/creator/types";

interface ApiErrorResponse {
  ok?: false;
  error?: string;
}

async function postJson<TResponse>(url: string, payload: unknown): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as TResponse | ApiErrorResponse;
  if (!response.ok) {
    const message = (data as ApiErrorResponse).error || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data as TResponse;
}

export function useCreatorHub() {
  const [analysis, setAnalysis] = useState<CreatorAnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [lastRender, setLastRender] = useState<CreatorShortRenderResponse | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const analyze = async (payload: CreatorAnalyzeRequest) => {
    setIsAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await postJson<CreatorAnalysisResponse>("/api/creator/analyze", payload);
      setAnalysis(result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analyze request failed";
      setAnalyzeError(message);
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderShort = async (payload: CreatorShortRenderRequest) => {
    setIsRendering(true);
    setRenderError(null);
    try {
      const result = await postJson<CreatorShortRenderResponse>("/api/creator/shorts/render", payload);
      setLastRender(result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Render request failed";
      setRenderError(message);
      throw error;
    } finally {
      setIsRendering(false);
    }
  };

  return {
    analysis,
    setAnalysis,
    isAnalyzing,
    analyzeError,
    analyze,
    lastRender,
    setLastRender,
    isRendering,
    renderError,
    renderShort,
  };
}
