import { generateMockCreatorAnalysis, generateMockShortRender } from "@/lib/creator/mock";
import {
  type CreatorAnalyzeRequest,
  type CreatorAnalyzeGenerationConfig,
  type CreatorAnalysisResponse,
  type CreatorShortRenderRequest,
  type CreatorShortRenderResponse,
} from "@/lib/creator/types";
import { tryOpenAICreatorAnalysis } from "@/lib/server/openai-creator";

function normalizeAnalyzeRequest(input: CreatorAnalyzeRequest): CreatorAnalyzeRequest {
  const generation = input.generation as CreatorAnalyzeGenerationConfig | undefined;

  return {
    ...input,
    filename: String(input.filename || "untitled-media"),
    transcriptText: String(input.transcriptText || "").trim(),
    transcriptChunks: Array.isArray(input.transcriptChunks) ? input.transcriptChunks : [],
    subtitleChunks: Array.isArray(input.subtitleChunks) ? input.subtitleChunks : undefined,
    transcriptLanguage: input.transcriptLanguage ? String(input.transcriptLanguage) : undefined,
    transcriptVersionLabel: input.transcriptVersionLabel ? String(input.transcriptVersionLabel) : undefined,
    subtitleVersionLabel: input.subtitleVersionLabel ? String(input.subtitleVersionLabel) : undefined,
    durationSeconds:
      typeof input.durationSeconds === "number" && Number.isFinite(input.durationSeconds)
        ? input.durationSeconds
        : undefined,
    niche: input.niche ? String(input.niche) : undefined,
    audience: input.audience ? String(input.audience) : undefined,
    tone: input.tone ? String(input.tone) : undefined,
    generation:
      generation && typeof generation === "object"
        ? {
            tool:
              generation.tool === "video_info" || generation.tool === "clip_lab" || generation.tool === "full"
                ? generation.tool
                : undefined,
            videoInfoBlocks: Array.isArray(generation.videoInfoBlocks)
              ? generation.videoInfoBlocks
                  .filter((value): value is NonNullable<CreatorAnalyzeGenerationConfig["videoInfoBlocks"]>[number] => typeof value === "string")
                  .slice(0, 16)
              : undefined,
          }
        : undefined,
  };
}

export async function analyzeCreatorSource(input: CreatorAnalyzeRequest): Promise<CreatorAnalysisResponse> {
  const request = normalizeAnalyzeRequest(input);
  const mock = generateMockCreatorAnalysis(request);
  const openAI = await tryOpenAICreatorAnalysis(request, mock);
  return openAI ?? mock;
}

export async function renderCreatorShort(input: CreatorShortRenderRequest): Promise<CreatorShortRenderResponse> {
  return generateMockShortRender(input);
}
