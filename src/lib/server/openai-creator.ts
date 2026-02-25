import {
  secondsToClock,
  type CreatorAnalyzeRequest,
  type CreatorAnalysisResponse,
  type CreatorVideoInfoBlock,
} from "@/lib/creator/types";

type LooseRecord = Record<string, unknown>;

function isRecord(value: unknown): value is LooseRecord {
  return !!value && typeof value === "object";
}

function extractAssistantText(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (!isRecord(first)) return null;
  const message = first.message;
  if (!isRecord(message)) return null;
  const content = message.content;
  return typeof content === "string" ? content : null;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

const ALL_VIDEO_INFO_BLOCKS: CreatorVideoInfoBlock[] = [
  "titleIdeas",
  "description",
  "pinnedComment",
  "hashtagsSeo",
  "thumbnailHooks",
  "chapters",
  "contentPack",
  "insights",
];

function selectedVideoInfoBlocks(request: CreatorAnalyzeRequest): Set<CreatorVideoInfoBlock> {
  const blocks = request.generation?.videoInfoBlocks;
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return new Set(ALL_VIDEO_INFO_BLOCKS);
  }
  return new Set(blocks);
}

function buildOpenAIPrompt(request: CreatorAnalyzeRequest): string {
  const runtime = Math.round(request.durationSeconds ?? 0);
  const tool = request.generation?.tool ?? "full";
  const blocks = selectedVideoInfoBlocks(request);
  const videoInfoOnly = tool === "video_info";
  const transcriptPreview = request.transcriptText.slice(0, videoInfoOnly ? 8000 : 12000);

  const needChunkPreview = !videoInfoOnly || blocks.has("chapters");
  const chunkPreview = needChunkPreview
    ? (request.transcriptChunks || [])
        .slice(0, videoInfoOnly ? 40 : 60)
        .map((chunk) => {
          const start = chunk.timestamp?.[0] == null ? 0 : Math.floor(chunk.timestamp[0]);
          const end = chunk.timestamp?.[1] == null ? start + 3 : Math.floor(chunk.timestamp[1]);
          return `[${secondsToClock(start)}-${secondsToClock(end)}] ${String(chunk.text ?? "")}`;
        })
        .join("\n")
    : "";

  const requestedKeysLine = videoInfoOnly
    ? "Produce ONLY the requested top-level keys from this set when needed: youtube, content, chapters, insights."
    : "Produce these keys: youtube, content, chapters, viralClips, shortsPlans, insights.";

  const scopeLines: string[] = [];
  if (videoInfoOnly) {
    const youtubeFields: string[] = [];
    if (blocks.has("titleIdeas")) youtubeFields.push("titleIdeas");
    if (blocks.has("description")) youtubeFields.push("description");
    if (blocks.has("pinnedComment")) youtubeFields.push("pinnedComment");
    if (blocks.has("hashtagsSeo")) youtubeFields.push("hashtags", "seoKeywords");
    if (blocks.has("thumbnailHooks")) youtubeFields.push("thumbnailHooks");
    if (blocks.has("chapters")) youtubeFields.push("chapterText");

    if (youtubeFields.length > 0) {
      scopeLines.push(`youtube fields: ${youtubeFields.join(", ")}`);
    }
    if (blocks.has("contentPack")) {
      scopeLines.push("content fields: videoSummary, keyMoments, hookIdeas, ctaIdeas, repurposeIdeas");
    }
    if (blocks.has("chapters")) {
      scopeLines.push("chapters: include chapter objects with concrete timestamps");
    }
    if (blocks.has("insights")) {
      scopeLines.push("insights: include creator insights metrics");
    }
    if (!scopeLines.length) {
      scopeLines.push("youtube fields: titleIdeas, description");
      scopeLines.push("content fields: videoSummary, hookIdeas, repurposeIdeas");
    }
  }

  return [
    "You are a senior content strategist for YouTube + Shorts creators.",
    "Return ONLY valid JSON (no markdown).",
    requestedKeysLine,
    "Use concrete timestamps and clip ranges.",
    ...(scopeLines.length ? ["", "Requested scope:", ...scopeLines] : []),
    "",
    `Filename: ${request.filename}`,
    `RuntimeSeconds: ${runtime}`,
    `TranscriptLanguage: ${request.transcriptLanguage ?? "unknown"}`,
    `Tone: ${request.tone ?? "high-clarity creator strategist"}`,
    `Audience: ${request.audience ?? "content creators"}`,
    `Niche: ${request.niche ?? "general creator workflow"}`,
    "",
    "Transcript preview:",
    transcriptPreview,
    ...(needChunkPreview
      ? [
          "",
          "Timed chunk preview:",
          chunkPreview,
        ]
      : []),
  ].join("\n");
}

function mergeOpenAIIntoMock(base: CreatorAnalysisResponse, candidate: unknown): CreatorAnalysisResponse {
  if (!isRecord(candidate)) return base;

  const next: CreatorAnalysisResponse = {
    ...base,
    providerMode: "openai",
    model: "gpt-4.1-mini (api)",
  };

  const youtube = isRecord(candidate.youtube) ? candidate.youtube : null;
  if (youtube) {
    if (Array.isArray(youtube.titleIdeas)) {
      const titles = youtube.titleIdeas.filter((v): v is string => typeof v === "string").slice(0, 8);
      if (titles.length) next.youtube.titleIdeas = titles;
    }
    if (typeof youtube.description === "string" && youtube.description.trim()) {
      next.youtube.description = youtube.description.trim();
    }
    if (typeof youtube.pinnedComment === "string" && youtube.pinnedComment.trim()) {
      next.youtube.pinnedComment = youtube.pinnedComment.trim();
    }
    if (Array.isArray(youtube.hashtags)) {
      const hashtags = youtube.hashtags.filter((v): v is string => typeof v === "string").slice(0, 10);
      if (hashtags.length) next.youtube.hashtags = hashtags;
    }
    if (Array.isArray(youtube.seoKeywords)) {
      const seoKeywords = youtube.seoKeywords.filter((v): v is string => typeof v === "string").slice(0, 12);
      if (seoKeywords.length) next.youtube.seoKeywords = seoKeywords;
    }
    if (Array.isArray(youtube.thumbnailHooks)) {
      const thumbnailHooks = youtube.thumbnailHooks.filter((v): v is string => typeof v === "string").slice(0, 8);
      if (thumbnailHooks.length) next.youtube.thumbnailHooks = thumbnailHooks;
    }
    if (typeof youtube.chapterText === "string" && youtube.chapterText.trim()) {
      next.youtube.chapterText = youtube.chapterText.trim();
    }
  }

  const content = isRecord(candidate.content) ? candidate.content : null;
  if (content) {
    if (typeof content.videoSummary === "string" && content.videoSummary.trim()) {
      next.content.videoSummary = content.videoSummary.trim();
    }
    if (Array.isArray(content.hookIdeas)) {
      const hooks = content.hookIdeas.filter((v): v is string => typeof v === "string").slice(0, 6);
      if (hooks.length) next.content.hookIdeas = hooks;
    }
    if (Array.isArray(content.ctaIdeas)) {
      const ctas = content.ctaIdeas.filter((v): v is string => typeof v === "string").slice(0, 6);
      if (ctas.length) next.content.ctaIdeas = ctas;
    }
    if (Array.isArray(content.keyMoments)) {
      const keyMoments = content.keyMoments.filter((v): v is string => typeof v === "string").slice(0, 10);
      if (keyMoments.length) next.content.keyMoments = keyMoments;
    }
    if (Array.isArray(content.repurposeIdeas)) {
      const repurpose = content.repurposeIdeas.filter((v): v is string => typeof v === "string").slice(0, 10);
      if (repurpose.length) next.content.repurposeIdeas = repurpose;
    }
  }

  if (Array.isArray(candidate.chapters)) {
    const chapters = candidate.chapters
      .filter((row): row is Record<string, unknown> => isRecord(row))
      .map((row, idx) => ({
        id: typeof row.id === "string" ? row.id : `chapter-${idx + 1}`,
        timeSeconds: Number(row.timeSeconds ?? 0),
        label: typeof row.label === "string" ? row.label : `Chapter ${idx + 1}`,
        reason: typeof row.reason === "string" ? row.reason : "Generated chapter",
      }))
      .filter((row) => Number.isFinite(row.timeSeconds));
    if (chapters.length) next.chapters = chapters;
  }

  const insights = isRecord(candidate.insights) ? candidate.insights : null;
  if (insights) {
    if (typeof insights.transcriptWordCount === "number" && Number.isFinite(insights.transcriptWordCount)) {
      next.insights.transcriptWordCount = Math.round(insights.transcriptWordCount);
    }
    if (
      typeof insights.estimatedSpeakingRateWpm === "number" &&
      Number.isFinite(insights.estimatedSpeakingRateWpm)
    ) {
      next.insights.estimatedSpeakingRateWpm = Math.round(insights.estimatedSpeakingRateWpm);
    }
    if (typeof insights.detectedTheme === "string" && insights.detectedTheme.trim()) {
      next.insights.detectedTheme = insights.detectedTheme.trim();
    }
    if (Array.isArray(insights.repeatedTerms)) {
      const terms = insights.repeatedTerms.filter((v): v is string => typeof v === "string").slice(0, 20);
      if (terms.length) next.insights.repeatedTerms = terms;
    }
  }

  return next;
}

export async function tryOpenAICreatorAnalysis(
  request: CreatorAnalyzeRequest,
  mockBase: CreatorAnalysisResponse
): Promise<CreatorAnalysisResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const forceMock = process.env.CREATOR_AI_FORCE_MOCK === "1";
  if (!apiKey || forceMock) return null;

  const body = {
    model: process.env.OPENAI_CREATOR_MODEL || "gpt-4.1-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are a content strategist and short-form repurposing editor. Return only JSON.",
      },
      {
        role: "user",
        content: buildOpenAIPrompt(request),
      },
    ],
  };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI error ${response.status}: ${text.slice(0, 300)}`);
    }

    const payload = (await response.json()) as unknown;
    const assistantText = extractAssistantText(payload);
    if (!assistantText) {
      throw new Error("OpenAI response missing assistant content");
    }

    const parsed = safeJsonParse(assistantText);
    return mergeOpenAIIntoMock(mockBase, parsed);
  } catch (error) {
    console.error("OpenAI creator analysis failed; falling back to mock", error);
    return null;
  }
}
