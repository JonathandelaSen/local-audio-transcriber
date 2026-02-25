"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  Clapperboard,
  Copy,
  FileVideo,
  Film,
  Flame,
  Layers,
  Lightbulb,
  Loader2,
  Play,
  Rocket,
  Scissors,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";

import { db } from "@/lib/db";
import {
  getLatestSubtitleForLanguage,
  getLatestTranscript,
  getSubtitleById,
  getTranscriptById,
  sortSubtitleVersions,
  sortTranscriptVersions,
  type HistoryItem,
  type SubtitleChunk,
  type SubtitleVersion,
} from "@/lib/history";
import {
  secondsToClock,
  type CreatorAnalyzeRequest,
  type CreatorShortPlan,
  type CreatorShortRenderRequest,
  type CreatorViralClip,
  type CreatorVideoInfoBlock,
} from "@/lib/creator/types";
import { useCreatorHub } from "@/hooks/useCreatorHub";
import { useHistoryLibrary } from "@/hooks/useHistoryLibrary";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";

function copyText(text: string, label: string) {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied`, {
    className: "bg-green-500/20 border-green-500/50 text-green-100",
  });
}

function clipSubtitleChunks(clip: CreatorViralClip, chunks: SubtitleChunk[]): SubtitleChunk[] {
  return chunks.filter((chunk) => {
    const start = chunk.timestamp?.[0] ?? 0;
    const end = chunk.timestamp?.[1] ?? start;
    return start < clip.endSeconds && end > clip.startSeconds;
  });
}

function summarizeClipText(clip: CreatorViralClip, chunks: SubtitleChunk[], maxChars = 220): string {
  const text = clipSubtitleChunks(clip, chunks)
    .map((chunk) => String(chunk.text ?? ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return clip.hook;
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

function subtitleVersionLabel(subtitle: SubtitleVersion): string {
  return `S${subtitle.versionNumber} • ${subtitle.language.toUpperCase()} • ${subtitle.kind} • ${subtitle.shiftSeconds >= 0 ? "+" : ""}${subtitle.shiftSeconds}s`;
}

function platformLabel(platform: CreatorShortPlan["platform"]): string {
  if (platform === "youtube_shorts") return "YouTube Shorts";
  if (platform === "instagram_reels") return "Instagram Reels";
  return "TikTok";
}

function subtitleStyleClass(style: CreatorShortPlan["subtitleStyle"]): string {
  if (style === "bold_pop") {
    return "font-black tracking-tight uppercase text-white [text-shadow:0_2px_0_rgba(0,0,0,0.8),0_0_20px_rgba(251,191,36,0.35)]";
  }
  if (style === "creator_neon") {
    return "font-bold text-cyan-100 [text-shadow:0_0_8px_rgba(34,211,238,0.55),0_0_18px_rgba(34,211,238,0.35)]";
  }
  return "font-semibold text-white [text-shadow:0_1px_0_rgba(0,0,0,0.8)]";
}

function buildYouTubeTimestamps(chapters: { timeSeconds: number; label: string }[]): string {
  return chapters
    .slice()
    .sort((a, b) => a.timeSeconds - b.timeSeconds)
    .map((chapter) => `${secondsToClock(chapter.timeSeconds)} ${chapter.label}`)
    .join("\n");
}

function getTranscriptDurationSeconds(item: HistoryItem | undefined, transcriptId: string): number | undefined {
  if (!item) return undefined;
  const transcript = getTranscriptById(item, transcriptId);
  const chunks = transcript?.chunks ?? [];
  const last = [...chunks].reverse().find((chunk) => chunk.timestamp?.[1] != null || chunk.timestamp?.[0] != null);
  const value = last?.timestamp?.[1] ?? last?.timestamp?.[0];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

const VIDEO_INFO_BLOCK_OPTIONS: Array<{
  value: CreatorVideoInfoBlock;
  label: string;
  description: string;
  accent: string;
}> = [
  {
    value: "titleIdeas",
    label: "Title Ideas",
    description: "Multiple headline options for the long-form upload.",
    accent: "text-cyan-200 border-cyan-300/20 bg-cyan-400/5",
  },
  {
    value: "description",
    label: "Description",
    description: "Primary description copy for the video page.",
    accent: "text-emerald-200 border-emerald-300/20 bg-emerald-400/5",
  },
  {
    value: "pinnedComment",
    label: "Pinned Comment",
    description: "Comment CTA copy for engagement and next action.",
    accent: "text-orange-200 border-orange-300/20 bg-orange-400/5",
  },
  {
    value: "hashtagsSeo",
    label: "Hashtags + SEO",
    description: "Hashtags and keyword helpers.",
    accent: "text-pink-200 border-pink-300/20 bg-pink-400/5",
  },
  {
    value: "thumbnailHooks",
    label: "Thumbnail Hooks",
    description: "Short lines for thumbnail text explorations.",
    accent: "text-fuchsia-200 border-fuchsia-300/20 bg-fuchsia-400/5",
  },
  {
    value: "chapters",
    label: "Chapters",
    description: "Timestamp list + chapter text block.",
    accent: "text-amber-200 border-amber-300/20 bg-amber-400/5",
  },
  {
    value: "contentPack",
    label: "Content Pack",
    description: "Summary, hooks, repurpose ideas, CTA ideas.",
    accent: "text-blue-200 border-blue-300/20 bg-blue-400/5",
  },
  {
    value: "insights",
    label: "Insights",
    description: "Metrics and topic-level signals.",
    accent: "text-violet-200 border-violet-300/20 bg-violet-400/5",
  },
];

function toggleBlock(list: CreatorVideoInfoBlock[], block: CreatorVideoInfoBlock): CreatorVideoInfoBlock[] {
  return list.includes(block) ? list.filter((value) => value !== block) : [...list, block];
}

export function CreatorHub() {
  const { history, isLoading: isLoadingHistory, error: historyError, refresh } = useHistoryLibrary();
  const { analysis, isAnalyzing, analyzeError, analyze, lastRender, isRendering, renderError, renderShort } = useCreatorHub();

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string>("");
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string>("");

  const [niche, setNiche] = useState("creator tools / workflow");
  const [audience, setAudience] = useState("content creators and social media teams");
  const [tone, setTone] = useState("sharp, practical, growth-oriented");
  const [activeTool, setActiveTool] = useState<"video_info" | "clip_lab">("video_info");
  const [videoInfoBlocks, setVideoInfoBlocks] = useState<CreatorVideoInfoBlock[]>([
    "titleIdeas",
    "description",
    "chapters",
    "contentPack",
    "insights",
  ]);

  const [selectedClipId, setSelectedClipId] = useState<string>("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");

  const [trimStartNudge, setTrimStartNudge] = useState(0);
  const [trimEndNudge, setTrimEndNudge] = useState(0);
  const [zoom, setZoom] = useState(1.15);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [subtitleScale, setSubtitleScale] = useState(1);
  const [subtitleYOffsetPct, setSubtitleYOffsetPct] = useState(78);
  const [showSafeZones, setShowSafeZones] = useState(true);

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaFilename, setMediaFilename] = useState<string | null>(null);
  const [isVideoMedia, setIsVideoMedia] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const selectedProject = useMemo(() => {
    if (!history.length) return undefined;
    return history.find((item) => item.id === selectedProjectId) ?? history[0];
  }, [history, selectedProjectId]);

  const transcriptOptions = useMemo(() => {
    if (!selectedProject) return [];
    return sortTranscriptVersions(selectedProject.transcripts).slice().reverse();
  }, [selectedProject]);

  const effectiveTranscriptId = useMemo(() => {
    if (!selectedProject) return "";
    const explicit = selectedTranscriptId && selectedProject.transcripts.some((tx) => tx.id === selectedTranscriptId) ? selectedTranscriptId : "";
    return explicit || selectedProject.activeTranscriptVersionId || getLatestTranscript(selectedProject)?.id || "";
  }, [selectedProject, selectedTranscriptId]);

  const selectedTranscript = useMemo(() => {
    if (!selectedProject) return undefined;
    return getTranscriptById(selectedProject, effectiveTranscriptId);
  }, [effectiveTranscriptId, selectedProject]);

  const subtitleOptions = useMemo(() => {
    return sortSubtitleVersions(selectedTranscript?.subtitles ?? []).slice().reverse();
  }, [selectedTranscript]);

  const effectiveSubtitleId = useMemo(() => {
    if (!selectedTranscript) return "";
    if (selectedSubtitleId && selectedTranscript.subtitles.some((sub) => sub.id === selectedSubtitleId)) return selectedSubtitleId;

    const transcriptLang = selectedTranscript.detectedLanguage || selectedTranscript.requestedLanguage || "en";
    return (
      getLatestSubtitleForLanguage(selectedTranscript, transcriptLang)?.id ||
      selectedTranscript.subtitles.find((sub) => sub.kind === "original")?.id ||
      subtitleOptions[0]?.id ||
      ""
    );
  }, [selectedSubtitleId, selectedTranscript, subtitleOptions]);

  const selectedSubtitle = useMemo(() => {
    if (!selectedTranscript) return undefined;
    return getSubtitleById(selectedTranscript, effectiveSubtitleId) ?? subtitleOptions[0];
  }, [effectiveSubtitleId, selectedTranscript, subtitleOptions]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function loadMedia() {
      if (!selectedProject) {
        setMediaUrl(null);
        setMediaFilename(null);
        setIsVideoMedia(false);
        return;
      }

      try {
        const record = await db.mediaFiles.get(selectedProject.mediaId || selectedProject.id);
        if (cancelled) return;
        if (!record?.file) {
          setMediaUrl(null);
          setMediaFilename(null);
          setIsVideoMedia(false);
          return;
        }
        objectUrl = URL.createObjectURL(record.file);
        setMediaUrl(objectUrl);
        setMediaFilename(record.file.name);
        setIsVideoMedia(record.file.type.includes("video") || /\.(mp4|webm|mov|mkv)$/i.test(record.file.name));
      } catch (error) {
        console.error("Failed to load media preview", error);
        if (!cancelled) {
          setMediaUrl(null);
          setMediaFilename(null);
          setIsVideoMedia(false);
        }
      }
    }

    void loadMedia();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedProject]);

  const selectedClip = useMemo(() => {
    if (!analysis?.viralClips?.length) return undefined;
    return analysis.viralClips.find((clip) => clip.id === selectedClipId) ?? analysis.viralClips[0];
  }, [analysis, selectedClipId]);

  const plansForSelectedClip = useMemo(() => {
    if (!analysis?.shortsPlans?.length || !selectedClip) return [];
    return analysis.shortsPlans.filter((plan) => plan.clipId === selectedClip.id);
  }, [analysis, selectedClip]);

  const selectedPlan = useMemo(() => {
    if (!plansForSelectedClip.length) return undefined;
    return plansForSelectedClip.find((plan) => plan.id === selectedPlanId) ?? plansForSelectedClip[0];
  }, [plansForSelectedClip, selectedPlanId]);

  const clipTextPreview = useMemo(() => {
    if (!selectedClip || !selectedSubtitle) return "";
    return summarizeClipText(selectedClip, selectedSubtitle.chunks);
  }, [selectedClip, selectedSubtitle]);

  const editedClip = useMemo(() => {
    if (!selectedClip) return undefined;
    const start = Math.max(0, Number((selectedClip.startSeconds + trimStartNudge).toFixed(2)));
    const end = Math.max(start + 1, Number((selectedClip.endSeconds + trimEndNudge).toFixed(2)));
    return {
      ...selectedClip,
      startSeconds: start,
      endSeconds: end,
      durationSeconds: Number((end - start).toFixed(2)),
    };
  }, [selectedClip, trimEndNudge, trimStartNudge]);

  const selectedClipSubtitleChunks = useMemo(() => {
    if (!editedClip || !selectedSubtitle) return [];
    return clipSubtitleChunks(editedClip, selectedSubtitle.chunks);
  }, [editedClip, selectedSubtitle]);

  const selectedVideoInfoBlocks = useMemo(() => new Set(videoInfoBlocks), [videoInfoBlocks]);
  const showTitleIdeas = selectedVideoInfoBlocks.has("titleIdeas");
  const showDescription = selectedVideoInfoBlocks.has("description");
  const showPinnedComment = selectedVideoInfoBlocks.has("pinnedComment");
  const showHashtagsSeo = selectedVideoInfoBlocks.has("hashtagsSeo");
  const showThumbnailHooks = selectedVideoInfoBlocks.has("thumbnailHooks");
  const showChapters = selectedVideoInfoBlocks.has("chapters");
  const showContentPack = selectedVideoInfoBlocks.has("contentPack");
  const showInsights = selectedVideoInfoBlocks.has("insights");

  const canAnalyze = !!selectedProject && !!selectedTranscript && !!selectedSubtitle && !!selectedTranscript.transcript;
  const canRender = !!selectedProject && !!editedClip && !!selectedPlan;

  const creatorRequestPayload = useMemo<CreatorAnalyzeRequest | null>(() => {
    if (!selectedProject || !selectedTranscript || !selectedSubtitle || !selectedTranscript.transcript) return null;

    return {
      filename: selectedProject.filename,
      transcriptText: selectedTranscript.transcript,
      transcriptChunks: selectedTranscript.chunks ?? [],
      subtitleChunks: selectedSubtitle.chunks,
      transcriptLanguage: selectedTranscript.detectedLanguage || selectedTranscript.requestedLanguage,
      transcriptVersionLabel: selectedTranscript.label,
      subtitleVersionLabel: selectedSubtitle.label,
      durationSeconds: getTranscriptDurationSeconds(selectedProject, selectedTranscript.id),
      niche,
      audience,
      tone,
    };
  }, [audience, niche, selectedProject, selectedSubtitle, selectedTranscript, tone]);

  const handleGenerateVideoInfo = async () => {
    if (!creatorRequestPayload) return;
    if (videoInfoBlocks.length === 0) {
      toast.error("Select at least one video info block to generate.", {
        className: "bg-amber-500/20 border-amber-500/50 text-amber-100",
      });
      return;
    }
    try {
      const result = await analyze({
        ...creatorRequestPayload,
        generation: {
          tool: "video_info",
          videoInfoBlocks,
        },
      });
      toast.success(`Video info generated (${result.providerMode})`, {
        className: "bg-green-500/20 border-green-500/50 text-green-100",
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleGenerateClipLab = async () => {
    if (!creatorRequestPayload) return;
    try {
      const result = await analyze({
        ...creatorRequestPayload,
        generation: {
          tool: "clip_lab",
        },
      });
      toast.success(`Clip lab generated (${result.providerMode})`, {
        className: "bg-green-500/20 border-green-500/50 text-green-100",
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleRenderShort = async () => {
    if (!selectedProject || !editedClip || !selectedPlan) return;

    const payload: CreatorShortRenderRequest = {
      filename: mediaFilename || selectedProject.filename,
      clip: editedClip,
      plan: selectedPlan,
      subtitleChunks: selectedClipSubtitleChunks,
      editor: {
        zoom,
        panX,
        panY,
        subtitleScale,
        subtitleYOffsetPct,
      },
    };

    try {
      const result = await renderShort(payload);
      toast.success(`Mock short package ready (${result.output.platform})`, {
        className: "bg-green-500/20 border-green-500/50 text-green-100",
      });
    } catch (error) {
      console.error(error);
    }
  };

  const previewSubtitleLine = useMemo(() => {
    if (!clipTextPreview) return "Add subtitles + punchy hook text";
    return clipTextPreview.split(/(?<=[.!?])\s+/)[0]?.slice(0, 80) || clipTextPreview.slice(0, 80);
  }, [clipTextPreview]);

  return (
    <main className="min-h-screen w-full relative py-10 px-4 sm:px-6 lg:px-8">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-20 left-[6%] w-[34rem] h-[34rem] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute top-[35%] right-[4%] w-[28rem] h-[28rem] rounded-full bg-orange-500/10 blur-[130px]" />
        <div className="absolute bottom-[-6rem] left-[32%] w-[32rem] h-[32rem] rounded-full bg-emerald-500/5 blur-[150px]" />
        <div className="absolute inset-0 opacity-15 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_40%,#000_70%,transparent_100%)] bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-gradient-to-r from-cyan-400/10 to-orange-400/10 px-3 py-1.5 text-xs uppercase tracking-[0.22em] text-cyan-100/70">
              <Rocket className="w-3.5 h-3.5" /> Creator Tool Bench
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-white to-orange-200">
              Content Engine
            </h1>
            <p className="text-white/60 max-w-3xl">
              Use your transcript as a source asset. Run only the tool you need: video info generation or clip lab + vertical editor.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" className="bg-white/5 hover:bg-white/10 text-white/80">
                <ArrowLeft className="w-4 h-4 mr-2" /> Home
              </Button>
            </Link>
            <Link href="/history">
              <Button variant="ghost" className="bg-white/5 hover:bg-white/10 text-white/80">
                <Layers className="w-4 h-4 mr-2" /> History
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.3fr] gap-6 items-start">
          <Card className="bg-white/[0.03] border-white/10 text-white shadow-2xl backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <FileVideo className="w-5 h-5 text-cyan-300" /> Source + Tool Controls
              </CardTitle>
              <CardDescription className="text-white/50">
                Pick the transcript/subtitle source once, then run either tool independently. Video info supports scoped output blocks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-white/50 mb-2">Project</label>
                  <Select
                    value={selectedProject?.id ?? ""}
                    onValueChange={(value) => {
                      setSelectedProjectId(value);
                      setSelectedTranscriptId("");
                      setSelectedSubtitleId("");
                    }}
                    disabled={isLoadingHistory || history.length === 0}
                  >
                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-white/90">
                      <SelectValue placeholder={isLoadingHistory ? "Loading projects..." : "Select project"} />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border-white/10 text-white/90">
                      {history.map((item) => (
                        <SelectItem key={item.id} value={item.id} className="focus:bg-cyan-500/20 cursor-pointer">
                          {item.filename} ({item.transcripts.length} transcript{item.transcripts.length === 1 ? "" : "s"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-white/50 mb-2">Transcript Version</label>
                    <Select
                      value={effectiveTranscriptId}
                      onValueChange={(value) => {
                        setSelectedTranscriptId(value);
                        setSelectedSubtitleId("");
                      }}
                      disabled={!selectedProject || transcriptOptions.length === 0}
                    >
                      <SelectTrigger className="w-full bg-white/5 border-white/10 text-white/90">
                        <SelectValue placeholder="Select transcript version" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-white/10 text-white/90">
                        {transcriptOptions.map((tx) => (
                          <SelectItem key={tx.id} value={tx.id} className="focus:bg-cyan-500/20 cursor-pointer">
                            {tx.label} • {tx.status} • {new Date(tx.createdAt).toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-white/50 mb-2">Subtitle Version</label>
                    <Select value={effectiveSubtitleId} onValueChange={setSelectedSubtitleId} disabled={!selectedTranscript || subtitleOptions.length === 0}>
                      <SelectTrigger className="w-full bg-white/5 border-white/10 text-white/90">
                        <SelectValue placeholder="Select subtitle version" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950 border-white/10 text-white/90">
                        {subtitleOptions.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id} className="focus:bg-cyan-500/20 cursor-pointer">
                            {subtitleVersionLabel(sub)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-white/50 mb-2">Niche</label>
                    <input
                      value={niche}
                      onChange={(e) => setNiche(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-white/50 mb-2">Audience</label>
                    <input
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-white/50 mb-2">Tone</label>
                    <input
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTool("video_info")}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left transition-colors",
                        activeTool === "video_info"
                          ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Lightbulb className="w-4 h-4" />
                        Video Info Generator
                      </div>
                      <div className="text-xs opacity-80 mt-1">Titles, description, hashtags, chapters, content notes, insights</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTool("clip_lab")}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left transition-colors",
                        activeTool === "clip_lab"
                          ? "border-orange-300/40 bg-orange-400/10 text-orange-100"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Flame className="w-4 h-4" />
                        Clip Lab + Editor
                      </div>
                      <div className="text-xs opacity-80 mt-1">Viral clips, shorts plans, vertical framing, mock render</div>
                    </button>
                  </div>

                  {activeTool === "video_info" && (
                    <div className="space-y-3">
                      <div className="text-xs uppercase tracking-wider text-white/50">
                        Output blocks (generate only what you need)
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {VIDEO_INFO_BLOCK_OPTIONS.map((option) => {
                          const enabled = selectedVideoInfoBlocks.has(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setVideoInfoBlocks((prev) => toggleBlock(prev, option.value))}
                              className={cn(
                                "rounded-xl border p-3 text-left transition-colors",
                                enabled
                                  ? `border-white/10 ${option.accent}`
                                  : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold">{option.label}</div>
                                <div
                                  className={cn(
                                    "h-4 w-4 rounded border transition-colors",
                                    enabled ? "bg-white/90 border-white/90" : "border-white/30 bg-transparent"
                                  )}
                                />
                              </div>
                              <div className="text-xs opacity-80 mt-1 leading-relaxed">{option.description}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      onClick={activeTool === "video_info" ? handleGenerateVideoInfo : handleGenerateClipLab}
                      disabled={!canAnalyze || isAnalyzing || (activeTool === "video_info" && videoInfoBlocks.length === 0)}
                      className={cn(
                        "text-black font-semibold",
                        activeTool === "video_info"
                          ? "bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300"
                          : "bg-gradient-to-r from-orange-500 to-fuchsia-400 hover:from-orange-400 hover:to-fuchsia-300"
                      )}
                    >
                      {isAnalyzing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : activeTool === "video_info" ? (
                        <WandSparkles className="w-4 h-4 mr-2" />
                      ) : (
                        <Flame className="w-4 h-4 mr-2" />
                      )}
                      {activeTool === "video_info" ? "Generate Video Info" : "Generate Clip Lab"}
                    </Button>
                    <Button variant="ghost" onClick={() => void refresh()} className="bg-white/5 hover:bg-white/10 text-white/80">
                      Refresh Media Library
                    </Button>
                    {analysis && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-white/70">
                        Provider: {analysis.providerMode} · {analysis.model}
                      </span>
                    )}
                  </div>
                </div>

                {historyError && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{historyError}</div>}
                {analyzeError && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{analyzeError}</div>}
                {!historyError && !isLoadingHistory && history.length === 0 && (
                  <div className="text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    No transcription projects found yet. Transcribe a file first, then come back to build creator assets.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-500/10 via-white/[0.03] to-orange-500/10 border-white/10 text-white shadow-2xl backdrop-blur-xl overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-orange-300" /> Tool Split (Token-Aware Workflow)
              </CardTitle>
              <CardDescription className="text-white/50">
                Run only the generation path you need. Video info mode supports scoped blocks so you can skip pinned comments, hashtags, or insights when not needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <button
                  type="button"
                  onClick={() => setActiveTool("video_info")}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-colors",
                    activeTool === "video_info"
                      ? "border-cyan-300/35 bg-cyan-400/8 shadow-[0_0_25px_rgba(34,211,238,0.12)]"
                      : "border-white/10 bg-black/20 hover:bg-black/25"
                  )}
                >
                  <div className="font-semibold text-white mb-1 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-cyan-300" /> Video Info Generator
                  </div>
                  <div className="text-white/60">
                    Generate selected long-form packaging blocks only: titles, description, hashtags, pinned comment, thumbnail hooks, chapters, content notes, insights.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTool("clip_lab")}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-colors",
                    activeTool === "clip_lab"
                      ? "border-orange-300/35 bg-orange-400/8 shadow-[0_0_25px_rgba(251,146,60,0.12)]"
                      : "border-white/10 bg-black/20 hover:bg-black/25"
                  )}
                >
                  <div className="font-semibold text-white mb-1 flex items-center gap-2">
                    <Clapperboard className="w-4 h-4 text-orange-300" /> Clip Lab + Editor
                  </div>
                  <div className="text-white/60">
                    Find viral moments, inspect shorts plans, then frame and mock-render a vertical cut from the selected clip.
                  </div>
                </button>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                Tip: use <span className="text-white">Video Info Generator</span> for cheap packaging passes and switch to <span className="text-white">Clip Lab + Editor</span> only when you are ready to cut short-form outputs.
              </div>
            </CardContent>
          </Card>
        </div>

        {analysis && (
          <>
            {activeTool === "video_info" && (
            <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.95fr] gap-6 items-start">
              <Card className="bg-white/[0.03] border-white/10 text-white shadow-xl backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-cyan-300" /> YouTube Content Pack</CardTitle>
                  <CardDescription className="text-white/50">
                    Copy-ready packaging generated from transcript + timed chunks.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {!showTitleIdeas && !showDescription && !showHashtagsSeo && !showPinnedComment && !showThumbnailHooks && (
                    <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-6 text-sm text-white/60">
                      No video info blocks selected. Enable blocks above and run the generator.
                    </div>
                  )}

                  {showTitleIdeas && (
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <label className="text-xs uppercase tracking-wider text-white/50">Title Ideas</label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-white/70 hover:bg-white/10"
                          onClick={() => copyText(analysis.youtube.titleIdeas.join("\n"), "Title ideas")}
                        >
                          <Copy className="w-4 h-4 mr-2" /> Copy
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {analysis.youtube.titleIdeas.map((title, index) => (
                          <button
                            key={`${index}-${title}`}
                            onClick={() => copyText(title, `Title #${index + 1}`)}
                            className="w-full text-left rounded-xl border border-white/10 bg-black/20 hover:bg-black/30 transition-colors p-3 text-sm text-white/90"
                          >
                            <span className="text-cyan-300/80 mr-2">{index + 1}.</span>
                            {title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {showDescription && (
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <label className="text-xs uppercase tracking-wider text-white/50">Description</label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-white/70 hover:bg-white/10"
                          onClick={() => copyText(analysis.youtube.description, "Description")}
                        >
                          <Copy className="w-4 h-4 mr-2" /> Copy
                        </Button>
                      </div>
                      <textarea
                        readOnly
                        value={analysis.youtube.description}
                        className="w-full h-56 rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white/85 leading-relaxed"
                      />
                    </div>
                  )}

                  {(showHashtagsSeo || showPinnedComment || showThumbnailHooks) && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {showHashtagsSeo && (
                        <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                          <div className="text-xs uppercase tracking-wider text-white/50">Hashtags + SEO</div>
                          <div className="flex flex-wrap gap-2">
                            {analysis.youtube.hashtags.map((tag) => (
                              <button
                                key={tag}
                                onClick={() => copyText(tag, "Hashtag")}
                                className="px-2.5 py-1 rounded-full border border-cyan-300/20 bg-cyan-400/5 text-cyan-100 text-xs hover:bg-cyan-400/10"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                          <div className="text-xs text-white/60 leading-relaxed">
                            Keywords: {analysis.youtube.seoKeywords.join(", ")}
                          </div>
                        </div>
                      )}

                      {(showPinnedComment || showThumbnailHooks) && (
                        <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                          <div className="text-xs uppercase tracking-wider text-white/50">
                            {showPinnedComment && showThumbnailHooks
                              ? "Pinned Comment + Thumbnail Hooks"
                              : showPinnedComment
                                ? "Pinned Comment"
                                : "Thumbnail Hooks"}
                          </div>
                          {showPinnedComment && (
                            <button
                              onClick={() => copyText(analysis.youtube.pinnedComment, "Pinned comment")}
                              className="w-full text-left rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 p-3 text-sm text-white/85"
                            >
                              {analysis.youtube.pinnedComment}
                            </button>
                          )}
                          {showThumbnailHooks && (
                            <div className="grid grid-cols-1 gap-2">
                              {analysis.youtube.thumbnailHooks.map((hook) => (
                                <button
                                  key={hook}
                                  onClick={() => copyText(hook, "Thumbnail hook")}
                                  className="text-left text-xs rounded-md border border-white/10 bg-black/20 p-2 text-orange-100/90 hover:bg-black/30"
                                >
                                  {hook}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                {!showChapters && !showContentPack && !showInsights && (
                  <Card className="bg-white/[0.03] border-white/10 text-white shadow-xl backdrop-blur-xl">
                    <CardContent className="p-6 text-sm text-white/60">
                      This column is empty because <code className="text-white">Chapters</code>, <code className="text-white">Content Pack</code>,
                      and <code className="text-white">Insights</code> are all disabled in the Video Info Generator config.
                    </CardContent>
                  </Card>
                )}

                {showChapters && (
                  <Card className="bg-white/[0.03] border-white/10 text-white shadow-xl backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><CalendarClock className="w-5 h-5 text-orange-300" /> Time Marks / Chapters</CardTitle>
                      <CardDescription className="text-white/50">Copy these directly into your YouTube description.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="bg-white/5 hover:bg-white/10 text-white/80"
                          onClick={() => copyText(buildYouTubeTimestamps(analysis.chapters), "YouTube timestamps")}
                        >
                          <Copy className="w-4 h-4 mr-2" /> Copy timestamps
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="bg-white/5 hover:bg-white/10 text-white/80"
                          onClick={() => copyText(analysis.youtube.chapterText, "Chapter block")}
                        >
                          <Copy className="w-4 h-4 mr-2" /> Copy chapter block
                        </Button>
                      </div>
                      <div className="space-y-2 max-h-80 overflow-auto pr-1">
                        {analysis.chapters.map((chapter) => (
                          <div key={chapter.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                            <div className="text-sm font-medium text-white/90">{secondsToClock(chapter.timeSeconds)} {chapter.label}</div>
                            <div className="text-xs text-white/50 mt-1">{chapter.reason}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(showContentPack || showInsights) && (
                  <Card className="bg-white/[0.03] border-white/10 text-white shadow-xl backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Film className="w-5 h-5 text-emerald-300" /> Insights + Repurpose Strategy</CardTitle>
                      <CardDescription className="text-white/50">
                        {showContentPack && showInsights
                          ? "AI content notes plus transcript-level signals."
                          : showContentPack
                            ? "AI content notes to plan posts beyond one upload."
                            : "Transcript-level metrics and theme signals."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {showContentPack && (
                        <>
                          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-white/80 leading-relaxed">
                            {analysis.content.videoSummary}
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                            <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Hook Ideas</div>
                            <ul className="space-y-2 text-white/80">
                              {analysis.content.hookIdeas.map((hook) => (
                                <li key={hook} className="text-sm">• {hook}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                            <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Repurpose Ideas</div>
                            <ul className="space-y-2 text-white/80">
                              {analysis.content.repurposeIdeas.map((idea) => (
                                <li key={idea} className="text-sm">• {idea}</li>
                              ))}
                            </ul>
                          </div>
                        </>
                      )}

                      {showInsights && (
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="rounded-lg border border-white/10 bg-black/20 p-3">Words: <span className="text-cyan-200">{analysis.insights.transcriptWordCount}</span></div>
                          <div className="rounded-lg border border-white/10 bg-black/20 p-3">WPM: <span className="text-cyan-200">{analysis.insights.estimatedSpeakingRateWpm}</span></div>
                          <div className="rounded-lg border border-white/10 bg-black/20 p-3 col-span-2">Theme: <span className="text-white/90">{analysis.insights.detectedTheme}</span></div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
            )}

            {activeTool === "clip_lab" && (
              <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.35fr] gap-6 items-start">
              <Card className="bg-white/[0.03] border-white/10 text-white shadow-xl backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Flame className="w-5 h-5 text-orange-300" /> Viral Clip Finder</CardTitle>
                  <CardDescription className="text-white/50">Pick strong short-form moments to cut and package.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[42rem] overflow-auto pr-1">
                  {analysis.viralClips.map((clip) => {
                    const isActive = selectedClip?.id === clip.id;
                    const textPreview = selectedSubtitle ? summarizeClipText(clip, selectedSubtitle.chunks, 170) : clip.hook;
                    return (
                      <button
                        key={clip.id}
                        onClick={() => {
                          setSelectedClipId(clip.id);
                          setTrimStartNudge(0);
                          setTrimEndNudge(0);
                        }}
                        className={`w-full text-left rounded-2xl border p-4 transition-colors ${
                          isActive
                            ? "border-orange-300/40 bg-orange-400/10"
                            : "border-white/10 bg-black/20 hover:bg-black/30"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="text-sm font-semibold text-white/90">{clip.title}</div>
                          <div className="text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 text-orange-100">Score {clip.score}</div>
                        </div>
                        <div className="text-xs text-white/50 mb-2">
                          {secondsToClock(clip.startSeconds)} → {secondsToClock(clip.endSeconds)} ({Math.round(clip.durationSeconds)}s)
                        </div>
                        <div className="text-sm text-white/80 leading-relaxed">{textPreview}</div>
                        <div className="mt-2 text-xs text-white/55">{clip.reason}</div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="bg-white/[0.03] border-white/10 text-white shadow-xl backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Scissors className="w-5 h-5 text-cyan-300" /> Shorts Planner</CardTitle>
                    <CardDescription className="text-white/50">Platform-specific packaging generated from the selected viral clip.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!selectedClip ? (
                      <div className="text-sm text-white/60">Select a viral clip to see shorts plans.</div>
                    ) : (
                      <>
                        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                          <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Selected Clip</div>
                          <div className="text-sm text-white/90 font-semibold">
                            {secondsToClock(selectedClip.startSeconds)} → {secondsToClock(selectedClip.endSeconds)} · {Math.round(selectedClip.durationSeconds)}s
                          </div>
                          <div className="text-sm text-white/75 mt-2 leading-relaxed">{clipTextPreview}</div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {plansForSelectedClip.map((plan) => {
                            const active = selectedPlan?.id === plan.id;
                            return (
                              <button
                                key={plan.id}
                                onClick={() => setSelectedPlanId(plan.id)}
                                className={`text-left rounded-xl border p-3 transition-colors ${
                                  active ? "border-cyan-300/40 bg-cyan-400/10" : "border-white/10 bg-black/20 hover:bg-black/30"
                                }`}
                              >
                                <div className="text-sm font-semibold text-white/90">{platformLabel(plan.platform)}</div>
                                <div className="text-xs text-white/60 mt-1">Style: {plan.subtitleStyle}</div>
                                <div className="text-xs text-white/60">Hook: {plan.openingText.slice(0, 48)}</div>
                              </button>
                            );
                          })}
                        </div>

                        {selectedPlan && (
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-white/90">{selectedPlan.title}</div>
                                <div className="text-xs text-white/50 mt-1">
                                  {platformLabel(selectedPlan.platform)} • {selectedPlan.editorPreset.resolution} • {selectedPlan.editorPreset.aspectRatio}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-white/70 hover:bg-white/10"
                                onClick={() => copyText(selectedPlan.caption, "Short caption")}
                              >
                                <Copy className="w-4 h-4 mr-2" /> Caption
                              </Button>
                            </div>
                            <div className="text-xs uppercase tracking-wider text-white/50">Caption</div>
                            <textarea readOnly value={selectedPlan.caption} className="w-full h-24 rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-white/80" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                                <div className="text-white/50 mb-1">Opening Text</div>
                                <div className="text-white/90">{selectedPlan.openingText}</div>
                              </div>
                              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                                <div className="text-white/50 mb-1">End Card</div>
                                <div className="text-white/90">{selectedPlan.endCardText}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white/[0.03] border-white/10 text-white shadow-xl backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Clapperboard className="w-5 h-5 text-fuchsia-300" /> Vertical Editor (Preview + Mock Render)</CardTitle>
                    <CardDescription className="text-white/50">
                      Frame the selected clip for vertical and preview subtitle placement. Render endpoint currently returns a mock export package.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 2xl:grid-cols-[320px_1fr] gap-5">
                      <div className="space-y-3">
                        <div className="relative mx-auto w-full max-w-[320px] aspect-[9/16] rounded-[1.6rem] border border-white/15 overflow-hidden bg-black shadow-2xl">
                          {isVideoMedia && mediaUrl ? (
                            <video
                              key={mediaUrl}
                              ref={previewVideoRef}
                              src={mediaUrl}
                              muted
                              loop
                              playsInline
                              autoPlay
                              className="absolute inset-0 w-full h-full object-cover"
                              style={{
                                transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                                transformOrigin: "center center",
                              }}
                            />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-black to-orange-500/10 flex items-center justify-center p-6 text-center">
                              <div>
                                <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Preview Placeholder</div>
                                <div className="text-sm text-white/70 leading-relaxed">
                                  {mediaFilename ? `Audio-only source: ${mediaFilename}` : "No video preview available. You can still plan cuts and export settings."}
                                </div>
                              </div>
                            </div>
                          )}

                          {showSafeZones && selectedPlan && (
                            <>
                              <div
                                className="absolute inset-x-0 border-b border-cyan-300/40 border-dashed"
                                style={{ top: `${selectedPlan.editorPreset.safeTopPct}%` }}
                              />
                              <div
                                className="absolute inset-x-0 border-t border-orange-300/40 border-dashed"
                                style={{ top: `${100 - selectedPlan.editorPreset.safeBottomPct}%` }}
                              />
                            </>
                          )}

                          <div
                            className="absolute left-1/2 -translate-x-1/2 w-[88%] px-3 py-2 rounded-xl bg-black/55 border border-white/10 text-center"
                            style={{ top: `${subtitleYOffsetPct}%`, transform: `translate(-50%, -50%) scale(${subtitleScale})` }}
                          >
                            <div className={`text-sm leading-tight ${selectedPlan ? subtitleStyleClass(selectedPlan.subtitleStyle) : "text-white font-semibold"}`}>
                              {previewSubtitleLine}
                            </div>
                          </div>
                        </div>

                        {editedClip && (
                          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/70 space-y-1">
                            <div>Clip: {secondsToClock(editedClip.startSeconds)} → {secondsToClock(editedClip.endSeconds)}</div>
                            <div>Duration: {editedClip.durationSeconds.toFixed(1)}s</div>
                            <div>Subtitle source: {selectedSubtitle ? subtitleVersionLabel(selectedSubtitle) : "None"}</div>
                            <div>Subtitle chunks in clip: {selectedClipSubtitleChunks.length}</div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                            <div className="text-xs uppercase tracking-wider text-white/50">Trim + Framing</div>
                            <label className="text-xs text-white/70 block">Start nudge: {trimStartNudge.toFixed(1)}s</label>
                            <input type="range" min={-3} max={3} step={0.1} value={trimStartNudge} onChange={(e) => setTrimStartNudge(Number(e.target.value))} className="w-full" />
                            <label className="text-xs text-white/70 block">End nudge: {trimEndNudge.toFixed(1)}s</label>
                            <input type="range" min={-3} max={3} step={0.1} value={trimEndNudge} onChange={(e) => setTrimEndNudge(Number(e.target.value))} className="w-full" />
                            <label className="text-xs text-white/70 block">Zoom: {zoom.toFixed(2)}x</label>
                            <input type="range" min={0.8} max={2.2} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
                            <label className="text-xs text-white/70 block">Pan X: {panX}px</label>
                            <input type="range" min={-220} max={220} step={1} value={panX} onChange={(e) => setPanX(Number(e.target.value))} className="w-full" />
                            <label className="text-xs text-white/70 block">Pan Y: {panY}px</label>
                            <input type="range" min={-220} max={220} step={1} value={panY} onChange={(e) => setPanY(Number(e.target.value))} className="w-full" />
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                            <div className="text-xs uppercase tracking-wider text-white/50">Subtitles + Export</div>
                            <label className="text-xs text-white/70 block">Subtitle scale: {subtitleScale.toFixed(2)}x</label>
                            <input type="range" min={0.7} max={1.6} step={0.01} value={subtitleScale} onChange={(e) => setSubtitleScale(Number(e.target.value))} className="w-full" />
                            <label className="text-xs text-white/70 block">Subtitle vertical position: {subtitleYOffsetPct.toFixed(0)}%</label>
                            <input type="range" min={58} max={90} step={1} value={subtitleYOffsetPct} onChange={(e) => setSubtitleYOffsetPct(Number(e.target.value))} className="w-full" />
                            <label className="flex items-center gap-2 text-xs text-white/70 mt-2">
                              <input type="checkbox" checked={showSafeZones} onChange={(e) => setShowSafeZones(e.target.checked)} />
                              Show platform safe zones
                            </label>

                            <div className="pt-2 flex flex-wrap gap-2">
                              <Button
                                onClick={handleRenderShort}
                                disabled={!canRender || isRendering}
                                className="bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black font-semibold hover:from-fuchsia-400 hover:to-cyan-300"
                              >
                                {isRendering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                                Mock Render Short
                              </Button>
                              <Button
                                variant="ghost"
                                className="bg-white/5 hover:bg-white/10 text-white/80"
                                onClick={() => {
                                  setTrimStartNudge(0);
                                  setTrimEndNudge(0);
                                  setZoom(1.15);
                                  setPanX(0);
                                  setPanY(0);
                                  setSubtitleScale(1);
                                  setSubtitleYOffsetPct(78);
                                }}
                              >
                                Reset Editor
                              </Button>
                            </div>
                            {renderError && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{renderError}</div>}
                          </div>
                        </div>

                        {lastRender && (
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <div className="text-sm font-semibold text-white/90">Mock Export Package</div>
                                <div className="text-xs text-white/50">Job {lastRender.jobId} · {lastRender.status}</div>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-white/70 hover:bg-white/10"
                                onClick={() => copyText(lastRender.debugPreview.ffmpegCommandPreview.join(" "), "FFmpeg command preview")}
                              >
                                <Copy className="w-4 h-4 mr-2" /> FFmpeg cmd
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                                <div className="text-white/50 mb-1">Output</div>
                                <div className="text-white/90">{lastRender.output.filename}</div>
                                <div className="text-white/60 mt-1">{platformLabel(lastRender.output.platform)} · {lastRender.output.resolution}</div>
                              </div>
                              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                                <div className="text-white/50 mb-1">Notes</div>
                                <ul className="space-y-1 text-white/80">
                                  {lastRender.debugPreview.notes.map((note) => (
                                    <li key={note}>• {note}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                            <pre className="text-[11px] text-cyan-100/80 bg-black/35 border border-white/10 rounded-lg p-3 overflow-x-auto">
                              {lastRender.debugPreview.ffmpegCommandPreview.join(" ")}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            )}
          </>
        )}
      </div>

      <Toaster theme="dark" position="bottom-center" />
    </main>
  );
}
