"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clapperboard,
  Copy,
  Download,
  FileVideo,
  Film,
  Flame,
  FolderOpen,
  HardDriveDownload,
  Layers,
  Lightbulb,
  Loader2,
  Pause,
  Play,
  Rocket,
  Scissors,
  Save,
  Sparkles,
  TriangleAlert,
  Volume2,
  VolumeX,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";

import { db } from "@/lib/db";
import {
  getLatestSubtitleForLanguage,
  getLatestTranscript,
  getSubtitleById,
  getTranscriptById,
  makeId,
  sortSubtitleVersions,
  sortTranscriptVersions,
  type HistoryItem,
  type SubtitleChunk,
  type SubtitleVersion,
} from "@/lib/history";
import {
  clamp,
  secondsToClock,
  type CreatorAnalyzeRequest,
  type CreatorShortEditorState,
  type CreatorShortPlan,
  type CreatorShortRenderResponse,
  type CreatorViralClip,
  type CreatorVideoInfoBlock,
} from "@/lib/creator/types";
import type { CreatorShortExportRecord, CreatorShortProjectRecord } from "@/lib/creator/storage";
import { exportShortVideoLocally } from "@/lib/creator/local-render";
import { useCreatorHub } from "@/hooks/useCreatorHub";
import { useHistoryLibrary } from "@/hooks/useHistoryLibrary";
import { useCreatorShortsLibrary } from "@/hooks/useCreatorShortsLibrary";
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

function createManualFallbackClip(options: {
  sourceDurationSeconds?: number;
  subtitleLanguage?: string;
}): CreatorViralClip {
  const maxDuration = typeof options.sourceDurationSeconds === "number" && Number.isFinite(options.sourceDurationSeconds)
    ? Math.max(1, Number(options.sourceDurationSeconds.toFixed(2)))
    : undefined;
  const endSeconds = maxDuration ? Math.min(maxDuration, 60) : 60;

  return {
    id: "manual_clip_fallback",
    startSeconds: 0,
    endSeconds,
    durationSeconds: Number((endSeconds - 0).toFixed(2)),
    score: 0,
    title: "Manual Clip (No Clip Lab)",
    hook: "Edit this source manually without generating clip suggestions first.",
    reason: "Fallback clip created so the editor can be used immediately.",
    punchline: "Manual short edit",
    sourceChunkIndexes: [],
    suggestedSubtitleLanguage: options.subtitleLanguage || "en",
    platforms: ["youtube_shorts", "instagram_reels", "tiktok"],
  };
}

function createManualFallbackPlan(clipId: string): CreatorShortPlan {
  return {
    id: "manual_plan_fallback",
    clipId,
    platform: "youtube_shorts",
    title: "Manual Edit Preset",
    caption: "",
    subtitleStyle: "clean_caption",
    openingText: "Manual short cut",
    endCardText: "Follow for more",
    editorPreset: {
      platform: "youtube_shorts",
      aspectRatio: "9:16",
      resolution: "1080x1920",
      subtitleStyle: "clean_caption",
      safeTopPct: 12,
      safeBottomPct: 14,
      targetDurationRange: [15, 60],
    },
  };
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

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  return `${value >= 10 || power === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[power]}`;
}

async function readVideoDimensions(file: File, existingVideoEl?: HTMLVideoElement | null): Promise<{ width: number; height: number }> {
  if (existingVideoEl?.videoWidth && existingVideoEl?.videoHeight) {
    return { width: existingVideoEl.videoWidth, height: existingVideoEl.videoHeight };
  }

  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => resolve();
      const onError = () => reject(new Error("Failed to read source video metadata"));
      video.addEventListener("loadedmetadata", onLoaded, { once: true });
      video.addEventListener("error", onError, { once: true });
    });
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("Source video metadata missing dimensions");
    }
    return { width: video.videoWidth, height: video.videoHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
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

type CreatorToolMode = "video_info" | "clip_lab";
type HubView = "start" | "ai_lab" | "editor";

type CreatorHubProps = {
  initialTool?: CreatorToolMode;
  lockedTool?: CreatorToolMode;
};

export function CreatorHub({ initialTool = "video_info", lockedTool }: CreatorHubProps = {}) {
  const { history, isLoading: isLoadingHistory, error: historyError, refresh } = useHistoryLibrary();
  const {
    analysis,
    isAnalyzing,
    analyzeError,
    analyze,
    lastRender,
    setLastRender,
  } = useCreatorHub();

  const [hubView, setHubView] = useState<HubView>("start");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string>("");
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<string>("");

  const [niche, setNiche] = useState("creator tools / workflow");
  const [audience, setAudience] = useState("content creators and social media teams");
  const [tone, setTone] = useState("sharp, practical, growth-oriented");
  const [activeTool, setActiveTool] = useState<CreatorToolMode>(lockedTool ?? initialTool);
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
  const [subtitleXPositionPct, setSubtitleXPositionPct] = useState(50);
  const [subtitleYOffsetPct, setSubtitleYOffsetPct] = useState(78);
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [activeSavedShortProjectId, setActiveSavedShortProjectId] = useState<string>("");
  const [isExportingShort, setIsExportingShort] = useState(false);
  const [exportProgressPct, setExportProgressPct] = useState(0);
  const [localRenderError, setLocalRenderError] = useState<string | null>(null);
  const [shortProjectNameDraft, setShortProjectNameDraft] = useState("");

  const isToolLocked = !!lockedTool;
  const isVideoInfoPage = lockedTool === "video_info";
  const isShortsPage = lockedTool === "clip_lab";

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaFilename, setMediaFilename] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isVideoMedia, setIsVideoMedia] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (lockedTool && activeTool !== lockedTool) {
      setActiveTool(lockedTool);
    }
  }, [activeTool, lockedTool]);

  const selectedProject = useMemo(() => {
    if (!history.length) return undefined;
    return history.find((item) => item.id === selectedProjectId) ?? history[0];
  }, [history, selectedProjectId]);

  const {
    projects: savedShortProjects,
    exportsByProjectId,
    isLoading: isLoadingShortsLibrary,
    error: shortsLibraryError,
    upsertProject,
    upsertExport,
  } = useCreatorShortsLibrary(selectedProject?.id);

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

  const sourceDurationSeconds = useMemo(() => {
    if (!selectedProject || !selectedTranscript) return undefined;
    return getTranscriptDurationSeconds(selectedProject, selectedTranscript.id);
  }, [selectedProject, selectedTranscript]);

  const manualFallbackClip = useMemo(() => {
    if (!selectedProject || !selectedTranscript || !selectedSubtitle) return undefined;
    return createManualFallbackClip({
      sourceDurationSeconds,
      subtitleLanguage: selectedSubtitle.language || selectedTranscript.detectedLanguage || selectedTranscript.requestedLanguage,
    });
  }, [selectedProject, selectedSubtitle, selectedTranscript, sourceDurationSeconds]);

  const manualFallbackPlan = useMemo(() => {
    if (!manualFallbackClip) return undefined;
    return createManualFallbackPlan(manualFallbackClip.id);
  }, [manualFallbackClip]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    async function loadMedia() {
      if (!selectedProject) {
        setMediaUrl(null);
        setMediaFilename(null);
        setMediaFile(null);
        setIsVideoMedia(false);
        return;
      }

      try {
        const record = await db.mediaFiles.get(selectedProject.mediaId || selectedProject.id);
        if (cancelled) return;
        if (!record?.file) {
          setMediaUrl(null);
          setMediaFilename(null);
          setMediaFile(null);
          setIsVideoMedia(false);
          return;
        }
        objectUrl = URL.createObjectURL(record.file);
        setMediaUrl(objectUrl);
        setMediaFilename(record.file.name);
        setMediaFile(record.file);
        setIsVideoMedia(record.file.type.includes("video") || /\.(mp4|webm|mov|mkv)$/i.test(record.file.name));
      } catch (error) {
        console.error("Failed to load media preview", error);
        if (!cancelled) {
          setMediaUrl(null);
          setMediaFilename(null);
          setMediaFile(null);
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

  useEffect(() => {
    setActiveSavedShortProjectId("");
    setLocalRenderError(null);
    setExportProgressPct(0);
    setIsPlaying(false);
    setShortProjectNameDraft("");
  }, [selectedProject?.id]);

  // Video event callbacks — attached as JSX props on the <video>, no effect needed
  const handleVideoTimeUpdate = useCallback(() => {
    const video = previewVideoRef.current;
    if (video) setCurrentTime(video.currentTime);
  }, []);
  const handleVideoPlay = useCallback(() => setIsPlaying(true), []);
  const handleVideoPause = useCallback(() => setIsPlaying(false), []);
  const handleVideoEnded = useCallback(() => setIsPlaying(false), []);

  const activeSavedShortProject = useMemo(() => {
    if (!savedShortProjects.length) return undefined;
    return savedShortProjects.find((item) => item.id === activeSavedShortProjectId) ?? undefined;
  }, [activeSavedShortProjectId, savedShortProjects]);

  const selectedClip = useMemo(() => {
    const analysisClips = analysis?.viralClips ?? [];
    if (selectedClipId) {
      const fromAnalysis = analysisClips.find((clip) => clip.id === selectedClipId);
      if (fromAnalysis) return fromAnalysis;
      if (activeSavedShortProject?.clipId === selectedClipId) return activeSavedShortProject.clip;
      if (manualFallbackClip?.id === selectedClipId) return manualFallbackClip;
    }
    if (analysisClips.length) return analysisClips[0];
    return activeSavedShortProject?.clip ?? manualFallbackClip;
  }, [activeSavedShortProject, analysis, manualFallbackClip, selectedClipId]);

  const plansForSelectedClip = useMemo(() => {
    if (analysis?.shortsPlans?.length && selectedClip) {
      const fromAnalysis = analysis.shortsPlans.filter((plan) => plan.clipId === selectedClip.id);
      if (fromAnalysis.length) return fromAnalysis;
    }
    if (activeSavedShortProject?.plan && activeSavedShortProject.plan.clipId === selectedClip?.id) {
      return [activeSavedShortProject.plan];
    }
    if (manualFallbackPlan && selectedClip?.id === manualFallbackPlan.clipId) {
      return [manualFallbackPlan];
    }
    return [];
  }, [activeSavedShortProject?.plan, analysis, manualFallbackPlan, selectedClip]);

  const selectedPlan = useMemo(() => {
    if (plansForSelectedClip.length) {
      return plansForSelectedClip.find((plan) => plan.id === selectedPlanId) ?? plansForSelectedClip[0];
    }
    return activeSavedShortProject?.plan ?? manualFallbackPlan;
  }, [activeSavedShortProject?.plan, manualFallbackPlan, plansForSelectedClip, selectedPlanId]);

  const clipTextPreview = useMemo(() => {
    if (!selectedClip || !selectedSubtitle) return "";
    return summarizeClipText(selectedClip, selectedSubtitle.chunks);
  }, [selectedClip, selectedSubtitle]);

  const editedClip = useMemo(() => {
    if (!selectedClip) return undefined;
    const maxClipEnd = typeof sourceDurationSeconds === "number" && Number.isFinite(sourceDurationSeconds)
      ? Math.max(1, Number(sourceDurationSeconds.toFixed(2)))
      : Number.POSITIVE_INFINITY;
    const maxClipStart = Number.isFinite(maxClipEnd) ? Math.max(0, maxClipEnd - 1) : Number.POSITIVE_INFINITY;

    const start = Number(clamp(Number((selectedClip.startSeconds + trimStartNudge).toFixed(2)), 0, maxClipStart).toFixed(2));
    const unclampedEnd = Number((selectedClip.endSeconds + trimEndNudge).toFixed(2));
    const minEnd = Number((start + 1).toFixed(2));
    const end = Number(clamp(Math.max(minEnd, unclampedEnd), minEnd, maxClipEnd).toFixed(2));
    return {
      ...selectedClip,
      startSeconds: start,
      endSeconds: end,
      durationSeconds: Number((end - start).toFixed(2)),
    };
  }, [selectedClip, sourceDurationSeconds, trimEndNudge, trimStartNudge]);

  useEffect(() => {
    if (!activeSavedShortProject || !selectedClip) return;
    if (selectedClip.id !== activeSavedShortProject.clipId) return;

    const nextStartNudge = Number((activeSavedShortProject.clip.startSeconds - selectedClip.startSeconds).toFixed(2));
    const nextEndNudge = Number((activeSavedShortProject.clip.endSeconds - selectedClip.endSeconds).toFixed(2));

    setTrimStartNudge((prev) => (Math.abs(prev - nextStartNudge) < 0.01 ? prev : nextStartNudge));
    setTrimEndNudge((prev) => (Math.abs(prev - nextEndNudge) < 0.01 ? prev : nextEndNudge));
  }, [activeSavedShortProject, selectedClip]);

  // Seek video to clip start when clip changes
  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video || !editedClip) return;
    video.currentTime = editedClip.startSeconds;
    setCurrentTime(editedClip.startSeconds);
  }, [editedClip, mediaUrl]);

  // Enforce clip boundaries during playback
  useEffect(() => {
    if (!editedClip || !isPlaying) return;
    const video = previewVideoRef.current;
    if (!video) return;
    if (currentTime >= editedClip.endSeconds) {
      video.currentTime = editedClip.startSeconds;
    }
  }, [currentTime, editedClip, isPlaying]);

  const togglePlayPause = useCallback(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    if (video.paused) {
      if (editedClip && video.currentTime >= editedClip.endSeconds) {
        video.currentTime = editedClip.startSeconds;
      }
      void video.play();
    } else {
      video.pause();
    }
  }, [editedClip]);

  const toggleMute = useCallback(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const selectedClipSubtitleChunks = useMemo(() => {
    if (!editedClip || !selectedSubtitle) return [];
    return clipSubtitleChunks(editedClip, selectedSubtitle.chunks);
  }, [editedClip, selectedSubtitle]);

  const currentEditorState = useMemo<CreatorShortEditorState>(
    () => ({
      zoom,
      panX,
      panY,
      subtitleScale,
      subtitleXPositionPct,
      subtitleYOffsetPct,
      showSafeZones,
    }),
    [panX, panY, showSafeZones, subtitleScale, subtitleXPositionPct, subtitleYOffsetPct, zoom]
  );

  useEffect(() => {
    if (!activeSavedShortProject) return;
    setShortProjectNameDraft(activeSavedShortProject.name || "");
  }, [activeSavedShortProject]);

  const autoGeneratedShortProjectName = useMemo(() => {
    if (!editedClip || !selectedPlan) return "";
    return `${platformLabel(selectedPlan.platform)} • ${secondsToClock(editedClip.startSeconds)}-${secondsToClock(editedClip.endSeconds)}`;
  }, [editedClip, selectedPlan]);

  const setEditedClipStartSeconds = useCallback(
    (nextStartSeconds: number) => {
      if (!selectedClip || !Number.isFinite(nextStartSeconds)) return;
      setTrimStartNudge(Number((nextStartSeconds - selectedClip.startSeconds).toFixed(2)));
      setActiveSavedShortProjectId("");
    },
    [selectedClip]
  );

  const setEditedClipEndSeconds = useCallback(
    (nextEndSeconds: number) => {
      if (!selectedClip || !Number.isFinite(nextEndSeconds)) return;
      setTrimEndNudge(Number((nextEndSeconds - selectedClip.endSeconds).toFixed(2)));
      setActiveSavedShortProjectId("");
    },
    [selectedClip]
  );

  const setEditedClipDurationSeconds = useCallback(
    (nextDurationSeconds: number) => {
      if (!editedClip || !Number.isFinite(nextDurationSeconds)) return;
      setEditedClipEndSeconds(editedClip.startSeconds + nextDurationSeconds);
    },
    [editedClip, setEditedClipEndSeconds]
  );

  const adjustEditedClipDurationSeconds = useCallback(
    (deltaSeconds: number) => {
      if (!editedClip || !Number.isFinite(deltaSeconds)) return;
      setEditedClipDurationSeconds(editedClip.durationSeconds + deltaSeconds);
    },
    [editedClip, setEditedClipDurationSeconds]
  );

  const savedExportsForActiveShort = useMemo(
    () => (activeSavedShortProject ? exportsByProjectId.get(activeSavedShortProject.id) ?? [] : []),
    [activeSavedShortProject, exportsByProjectId]
  );

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
  const canRender = !!selectedProject && !!selectedTranscript && !!selectedSubtitle && !!editedClip && !!selectedPlan;
  const canExportVideo = canRender && !!mediaFile && isVideoMedia;

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

  const buildCurrentShortProjectRecord = useCallback(
    (
      status: CreatorShortProjectRecord["status"],
      options?: { id?: string; lastExportId?: string; lastError?: string }
    ): CreatorShortProjectRecord | null => {
      if (!selectedProject || !selectedTranscript || !selectedSubtitle || !editedClip || !selectedPlan) return null;

      const existing =
        (options?.id && savedShortProjects.find((record) => record.id === options.id)) ||
        savedShortProjects.find(
          (record) =>
            record.sourceProjectId === selectedProject.id &&
            record.transcriptId === selectedTranscript.id &&
            record.subtitleId === selectedSubtitle.id &&
            record.clipId === editedClip.id &&
            record.planId === selectedPlan.id
        );

      const now = Date.now();
      const explicitShortName = shortProjectNameDraft.trim();
      return {
        id: existing?.id ?? makeId("shortproj"),
        sourceProjectId: selectedProject.id,
        sourceMediaId: selectedProject.mediaId || selectedProject.id,
        sourceFilename: mediaFilename || selectedProject.filename,
        transcriptId: selectedTranscript.id,
        subtitleId: selectedSubtitle.id,
        clipId: editedClip.id,
        planId: selectedPlan.id,
        platform: selectedPlan.platform,
        name:
          explicitShortName ||
          existing?.name ||
          `${platformLabel(selectedPlan.platform)} • ${secondsToClock(editedClip.startSeconds)}-${secondsToClock(editedClip.endSeconds)}`,
        clip: editedClip,
        plan: selectedPlan,
        editor: currentEditorState,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        status,
        lastExportId: options?.lastExportId ?? existing?.lastExportId,
        lastError: options?.lastError,
      };
    },
    [
      currentEditorState,
      editedClip,
      mediaFilename,
      savedShortProjects,
      selectedPlan,
      selectedProject,
      shortProjectNameDraft,
      selectedSubtitle,
      selectedTranscript,
    ]
  );

  const handleSaveShortProject = useCallback(async () => {
    const record = buildCurrentShortProjectRecord("draft", {
      id: activeSavedShortProjectId || undefined,
    });
    if (!record) {
      toast.error("Select a source with transcript + subtitles to save a short config.", {
        className: "bg-amber-500/20 border-amber-500/50 text-amber-100",
      });
      return;
    }

    try {
      await upsertProject(record);
      setActiveSavedShortProjectId(record.id);
      setShortProjectNameDraft(record.name);
      toast.success("Short editor configuration saved", {
        className: "bg-green-500/20 border-green-500/50 text-green-100",
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to save short configuration", {
        className: "bg-red-500/20 border-red-500/50 text-red-100",
      });
    }
  }, [activeSavedShortProjectId, buildCurrentShortProjectRecord, upsertProject]);

  const applySavedShortProject = useCallback((project: CreatorShortProjectRecord) => {
    setActiveTool("clip_lab");
    setActiveSavedShortProjectId(project.id);
    setSelectedProjectId(project.sourceProjectId);
    setSelectedTranscriptId(project.transcriptId);
    setSelectedSubtitleId(project.subtitleId);
    setSelectedClipId(project.clipId);
    setSelectedPlanId(project.planId);
    setShortProjectNameDraft(project.name || "");

    setTrimStartNudge(0);
    setTrimEndNudge(0);
    setZoom(project.editor.zoom);
    setPanX(project.editor.panX);
    setPanY(project.editor.panY);
    setSubtitleScale(project.editor.subtitleScale);
    setSubtitleXPositionPct(project.editor.subtitleXPositionPct ?? 50);
    setSubtitleYOffsetPct(project.editor.subtitleYOffsetPct);
    setShowSafeZones(project.editor.showSafeZones ?? true);
  }, []);

  const handleDownloadSavedExport = useCallback((record: CreatorShortExportRecord) => {
    if (!record.fileBlob) {
      toast.error("This export record does not have a saved file blob.", {
        className: "bg-red-500/20 border-red-500/50 text-red-100",
      });
      return;
    }
    const url = URL.createObjectURL(record.fileBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = record.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleRenderShort = async () => {
    if (!selectedProject || !editedClip || !selectedPlan || !selectedTranscript || !selectedSubtitle) return;
    if (!mediaFile) {
      toast.error("Source media is unavailable. Reload the source file from history.", {
        className: "bg-red-500/20 border-red-500/50 text-red-100",
      });
      return;
    }
    if (!isVideoMedia) {
      toast.error("Local export currently requires a video source.", {
        className: "bg-amber-500/20 border-amber-500/50 text-amber-100",
      });
      return;
    }

    setIsExportingShort(true);
    setExportProgressPct(0);
    setLocalRenderError(null);

    let shortProjectRecord = buildCurrentShortProjectRecord("exporting", {
      id: activeSavedShortProjectId || undefined,
    });
    if (!shortProjectRecord) {
      setIsExportingShort(false);
      return;
    }

    try {
      await upsertProject(shortProjectRecord);
      setActiveSavedShortProjectId(shortProjectRecord.id);
      setShortProjectNameDraft(shortProjectRecord.name);

      const sourceVideoSize = await readVideoDimensions(mediaFile, previewVideoRef.current);
      const frameRect = previewFrameRef.current?.getBoundingClientRect();
      const videoRect = previewVideoRef.current?.getBoundingClientRect();
      const previewViewport = frameRect ? { width: frameRect.width, height: frameRect.height } : null;
      const previewVideoRect = videoRect ? { width: videoRect.width, height: videoRect.height } : null;

      const localExport = await exportShortVideoLocally({
        sourceFile: mediaFile,
        sourceFilename: mediaFilename || selectedProject.filename,
        clip: editedClip,
        plan: selectedPlan,
        subtitleChunks: selectedClipSubtitleChunks,
        editor: currentEditorState,
        sourceVideoSize,
        previewViewport,
        previewVideoRect,
        onProgress: setExportProgressPct,
      });

      const exportRecord: CreatorShortExportRecord = {
        id: makeId("shortexport"),
        shortProjectId: shortProjectRecord.id,
        sourceProjectId: selectedProject.id,
        sourceFilename: mediaFilename || selectedProject.filename,
        platform: selectedPlan.platform,
        createdAt: Date.now(),
        status: "completed",
        filename: localExport.file.name,
        mimeType: localExport.file.type || "video/mp4",
        sizeBytes: localExport.file.size,
        fileBlob: localExport.file,
        debugFfmpegCommand: localExport.ffmpegCommandPreview,
        debugNotes: localExport.notes,
        clip: editedClip,
        plan: selectedPlan,
        editor: currentEditorState,
      };

      await upsertExport(exportRecord);

      shortProjectRecord = {
        ...shortProjectRecord,
        status: "exported",
        updatedAt: Date.now(),
        lastExportId: exportRecord.id,
        lastError: undefined,
      };
      await upsertProject(shortProjectRecord);

      const renderResult: CreatorShortRenderResponse = {
        ok: true,
        providerMode: "local-browser",
        jobId: exportRecord.id,
        status: "completed",
        createdAt: exportRecord.createdAt,
        estimatedSeconds: 0,
        output: {
          platform: selectedPlan.platform,
          filename: exportRecord.filename,
          aspectRatio: "9:16",
          resolution: "1080x1920",
          subtitleBurnedIn: localExport.subtitleBurnedIn,
        },
        debugPreview: {
          ffmpegCommandPreview: localExport.ffmpegCommandPreview,
          notes: localExport.notes,
        },
      };
      setLastRender(renderResult);

      handleDownloadSavedExport(exportRecord);
      toast.success(`Short exported and saved (${formatBytes(exportRecord.sizeBytes)})`, {
        className: "bg-green-500/20 border-green-500/50 text-green-100",
      });
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Short export failed";
      setLocalRenderError(message);

      if (shortProjectRecord) {
        try {
          const failedProject: CreatorShortProjectRecord = {
            ...shortProjectRecord,
            status: "error",
            updatedAt: Date.now(),
            lastError: message,
          };
          await upsertProject(failedProject);
        } catch (persistErr) {
          console.error("Failed to persist short export error state", persistErr);
        }
      }

      toast.error(message, {
        className: "bg-red-500/20 border-red-500/50 text-red-100",
      });
    } finally {
      setIsExportingShort(false);
    }
  };

  const previewSubtitleLine = useMemo(() => {
    // While playing, sync subtitle to current playback time
    if (isPlaying && selectedClipSubtitleChunks.length > 0 && editedClip) {
      const matchingChunk = selectedClipSubtitleChunks.find((chunk) => {
        const start = chunk.timestamp?.[0] ?? 0;
        const end = chunk.timestamp?.[1] ?? start;
        return currentTime >= start && currentTime <= end;
      });
      if (matchingChunk) {
        return String(matchingChunk.text ?? "").trim().slice(0, 100);
      }
      return ""; // between chunks, show nothing
    }
    if (!clipTextPreview) return "Add subtitles + punchy hook text";
    return clipTextPreview.split(/(?<=[.!?])\s+/)[0]?.slice(0, 80) || clipTextPreview.slice(0, 80);
  }, [clipTextPreview, currentTime, editedClip, isPlaying, selectedClipSubtitleChunks]);

  const clipProgressPct = useMemo(() => {
    if (!editedClip) return 0;
    const elapsed = currentTime - editedClip.startSeconds;
    const duration = editedClip.durationSeconds;
    if (duration <= 0) return 0;
    return Math.min(100, Math.max(0, (elapsed / duration) * 100));
  }, [currentTime, editedClip]);

  const topBadgeLabel = isVideoInfoPage ? "Video Info Studio" : isShortsPage ? "Shorts Forge" : "Creator Tool Bench";
  const pageHeading = isVideoInfoPage ? "Packaging Lab" : isShortsPage ? "Shorts Forge" : "Content Engine";
  const pageDescription = isVideoInfoPage
    ? "Generate long-form titles, descriptions, chapters, hooks, and SEO blocks on a dedicated page. No clip tools mixed in."
    : isShortsPage
      ? "Cut, frame, preview, save, and export vertical shorts on a dedicated page. This workspace is focused on clip production only."
      : "Use your transcript as a source asset. Run only the tool you need: video info generation or clip lab + vertical editor.";

  return (
    <main
      className={cn(
        "min-h-screen w-full relative py-10 px-4 sm:px-6 lg:px-8",
        isVideoInfoPage && "bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.12),transparent_40%),radial-gradient(circle_at_85%_15%,rgba(34,211,238,0.15),transparent_45%),#06090a]",
        isShortsPage && "bg-[radial-gradient(circle_at_12%_8%,rgba(244,114,182,0.14),transparent_40%),radial-gradient(circle_at_88%_12%,rgba(251,146,60,0.16),transparent_45%),#090607]"
      )}
    >
      <div className="fixed inset-0 pointer-events-none">
        <div
          className={cn(
            "absolute -top-20 left-[6%] w-[34rem] h-[34rem] rounded-full blur-[120px]",
            isVideoInfoPage ? "bg-emerald-400/14" : isShortsPage ? "bg-fuchsia-500/14" : "bg-cyan-500/10"
          )}
        />
        <div
          className={cn(
            "absolute top-[35%] right-[4%] w-[28rem] h-[28rem] rounded-full blur-[130px]",
            isVideoInfoPage ? "bg-cyan-400/12" : isShortsPage ? "bg-orange-500/14" : "bg-orange-500/10"
          )}
        />
        <div
          className={cn(
            "absolute bottom-[-6rem] left-[32%] w-[32rem] h-[32rem] rounded-full blur-[150px]",
            isVideoInfoPage ? "bg-teal-300/8" : isShortsPage ? "bg-rose-400/8" : "bg-emerald-500/5"
          )}
        />
        <div
          className={cn(
            "absolute inset-0 opacity-15 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_40%,#000_70%,transparent_100%)]",
            isShortsPage
              ? "bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:44px_44px]"
              : "bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:56px_56px]"
          )}
        />
      </div>

      <div className="relative z-10 max-w-[100rem] mx-auto space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.22em]",
                isVideoInfoPage
                  ? "border border-emerald-300/25 bg-gradient-to-r from-emerald-400/10 to-cyan-400/10 text-emerald-100/80"
                  : isShortsPage
                    ? "border border-orange-300/25 bg-gradient-to-r from-orange-400/10 to-fuchsia-400/10 text-orange-100/80"
                    : "border border-cyan-300/20 bg-gradient-to-r from-cyan-400/10 to-orange-400/10 text-cyan-100/70"
              )}
            >
              <Rocket className="w-3.5 h-3.5" /> {topBadgeLabel}
            </div>
            <h1
              className={cn(
                "text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text",
                isVideoInfoPage
                  ? "bg-gradient-to-r from-emerald-200 via-cyan-100 to-white"
                  : isShortsPage
                    ? "bg-gradient-to-r from-orange-200 via-rose-100 to-fuchsia-200"
                    : "bg-gradient-to-r from-cyan-200 via-white to-orange-200"
              )}
            >
              {pageHeading}
            </h1>
            <p className="text-white/60 max-w-3xl">
              {pageDescription}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isToolLocked && (
              <Link href="/creator">
                <Button
                  variant="ghost"
                  className={cn(
                    "text-white/85 border",
                    isVideoInfoPage
                      ? "bg-emerald-400/8 border-emerald-300/20 hover:bg-emerald-300/12"
                      : "bg-orange-400/8 border-orange-300/20 hover:bg-orange-300/12"
                  )}
                >
                  <Sparkles className="w-4 h-4 mr-2" /> Tool Hub
                </Button>
              </Link>
            )}
            {isToolLocked && (
              <Link href={isVideoInfoPage ? "/creator/shorts" : "/creator/video-info"}>
                <Button
                  variant="ghost"
                  className={cn(
                    "text-white/85 border",
                    isVideoInfoPage
                      ? "bg-white/5 border-cyan-300/20 hover:bg-cyan-400/10"
                      : "bg-white/5 border-fuchsia-300/20 hover:bg-fuchsia-400/10"
                  )}
                >
                  {isVideoInfoPage ? (
                    <>
                      <Clapperboard className="w-4 h-4 mr-2" /> Shorts Page
                    </>
                  ) : (
                    <>
                      <Lightbulb className="w-4 h-4 mr-2" /> Info Page
                    </>
                  )}
                </Button>
              </Link>
            )}
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

        <div className="max-w-4xl mx-auto w-full">
          <Card className="bg-white/[0.03] border-white/10 text-white shadow-2xl backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <FileVideo className="w-5 h-5 text-cyan-300" /> Source + Tool Controls
              </CardTitle>
              <CardDescription className="text-white/50">
                {isToolLocked
                  ? isVideoInfoPage
                    ? "Select a transcript/subtitle source and generate only packaging outputs on this page. Use the hub to switch into shorts production."
                    : "Select a transcript/subtitle source and run clip discovery/shorts workflows on this page. Packaging generation lives on its own page."
                  : "Pick the transcript/subtitle source once, then run either tool independently. Video info supports scoped output blocks."}
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
                  {!isToolLocked && (
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
                  )}



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
                    {activeTool === "video_info" && (
                      <Button
                        onClick={handleGenerateVideoInfo}
                        disabled={!canAnalyze || isAnalyzing || videoInfoBlocks.length === 0}
                        className="text-black font-semibold bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300"
                      >
                        {isAnalyzing ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <WandSparkles className="w-4 h-4 mr-2" />
                        )}
                        Generate Video Info
                      </Button>
                    )}
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


        </div>

        {(analysis || activeTool === "clip_lab") && (
          <>
            {activeTool === "video_info" && analysis && (
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

            {activeTool === "clip_lab" && hubView === "start" && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                  <Card 
                    className="bg-white/[0.03] border-white/10 text-white shadow-xl backdrop-blur-xl cursor-pointer hover:bg-white/5 transition-colors group relative overflow-hidden"
                    onClick={() => {
                      if (!manualFallbackClip || !manualFallbackPlan) return;
                      setActiveSavedShortProjectId("");
                      setSelectedClipId(manualFallbackClip.id);
                      setSelectedPlanId(manualFallbackPlan.id);
                      setShortProjectNameDraft("");
                      setTrimStartNudge(0);
                      setTrimEndNudge(0);
                      setHubView("editor");
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader>
                      <CardTitle className="text-2xl font-bold flex items-center gap-2">
                        ✂️ Manual Edit
                      </CardTitle>
                      <CardDescription className="text-white/60 text-base mt-2 leading-relaxed">
                        Jump straight into the editor with your full video. Perfect for when you already know what you want to cut.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <Card 
                    className="bg-white/[0.03] border-white/10 text-white shadow-xl backdrop-blur-xl cursor-pointer hover:bg-white/5 transition-colors group relative overflow-hidden"
                    onClick={() => setHubView("ai_lab")}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/10 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader>
                      <CardTitle className="text-2xl font-bold flex items-center gap-2">
                        ✨ AI Magic Clips
                      </CardTitle>
                      <CardDescription className="text-white/60 text-base mt-2 leading-relaxed">
                        Let AI analyze your transcript and suggest the most viral, engaging moments based on your defined niche and tone.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
                
                {/* Saved Shorts Gallery */}
                {!isLoadingShortsLibrary && savedShortProjects.length > 0 && (
                  <div className="space-y-4 mt-8">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-white/90">Your Saved Shorts</h3>
                      <span className="text-xs text-white/50">{savedShortProjects.length} preset{savedShortProjects.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {savedShortProjects.map((project) => {
                        const exportCount = (exportsByProjectId.get(project.id) ?? []).length;
                        return (
                          <div
                            key={project.id}
                            onClick={() => {
                              applySavedShortProject(project);
                              setHubView("editor");
                            }}
                            className="rounded-xl border border-white/10 bg-black/20 hover:bg-white/5 cursor-pointer transition-colors p-5 group relative overflow-hidden"
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="relative">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="text-base font-semibold text-white/90 line-clamp-2 leading-snug">{project.name}</div>
                                <div className="text-10px uppercase tracking-wider bg-emerald-500/10 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/20 whitespace-nowrap">{platformLabel(project.platform)}</div>
                              </div>
                              <div className="text-xs text-white/50 font-medium mb-4">
                                {secondsToClock(project.clip.startSeconds)} → {secondsToClock(project.clip.endSeconds)}
                              </div>
                              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                <div className="text-[11px] text-white/40">{new Date(project.updatedAt).toLocaleDateString()}</div>
                                {exportCount > 0 ? (
                                  <div className="flex items-center gap-1.5 text-[11px] text-white/60 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                                    <Download className="w-3 h-3" />
                                    <span>{exportCount} file{exportCount === 1 ? '' : 's'}</span>
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-white/30 italic">Not exported yet</div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTool === "clip_lab" && hubView === "ai_lab" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 -ml-3" onClick={() => setHubView("start")}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button
                    onClick={handleGenerateClipLab}
                    disabled={!canAnalyze || isAnalyzing}
                    className="text-black font-semibold bg-gradient-to-r from-orange-500 to-fuchsia-400 hover:from-orange-400 hover:to-fuchsia-300 shadow-lg"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Flame className="w-4 h-4 mr-2" />
                    )}
                    {analysis?.viralClips?.length ? "Regenerate Clips" : "Generate Clips"}
                  </Button>
                </div>
                <Card className="bg-white/[0.03] border-white/10 text-white shadow-xl backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl"><Flame className="w-6 h-6 text-orange-300" /> AI Magic Clips</CardTitle>
                    <CardDescription className="text-white/50 text-base">Review AI-suggested viral moments. Click any clip to start editing.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 max-h-[42rem] overflow-auto pr-1">
                    {analysis?.viralClips?.length ? (
                      analysis.viralClips.map((clip) => {
                        const textPreview = selectedSubtitle ? summarizeClipText(clip, selectedSubtitle.chunks, 200) : clip.hook;
                        return (
                          <button
                            key={clip.id}
                            onClick={() => {
                              setActiveSavedShortProjectId("");
                              setSelectedClipId(clip.id);
                              setShortProjectNameDraft("");
                              setTrimStartNudge(0);
                              setTrimEndNudge(0);
                              setHubView("editor");
                            }}
                            className="w-full text-left rounded-2xl border border-white/10 bg-black/20 hover:bg-black/40 hover:border-orange-300/30 transition-all p-5 group"
                          >
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <div className="text-base font-semibold text-white/90 group-hover:text-orange-200 transition-colors">{clip.title}</div>
                              <div className="text-xs px-2.5 py-1 rounded-full bg-orange-400/10 border border-orange-400/20 text-orange-100/90 font-medium tracking-wide">Score {clip.score}</div>
                            </div>
                            <div className="text-xs text-white/50 mb-3 font-medium">
                              {secondsToClock(clip.startSeconds)} → {secondsToClock(clip.endSeconds)} ({Math.round(clip.durationSeconds)}s)
                            </div>
                            <div className="text-sm text-white/80 leading-relaxed italic border-l-2 border-white/10 pl-3 py-1 mb-3">{textPreview}</div>
                            <div className="text-xs text-white/55 bg-white/5 rounded-lg p-3 leading-relaxed">{clip.reason}</div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-8 text-center text-sm text-white/60">
                        <Flame className="w-8 h-8 mx-auto text-white/20 mb-3" />
                        Run <span className="text-white font-semibold">Generate Clip Lab</span> up top to populate viral clip candidates!
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTool === "clip_lab" && hubView === "editor" && (
              <div className="space-y-6">
                <div>
                  <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 -ml-3" onClick={() => setHubView("start")}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] 2xl:grid-cols-[320px_1fr] gap-6 items-start">

                <div className="space-y-6">
                  <Card className="bg-white/[0.03] border-white/10 text-white shadow-xl backdrop-blur-xl">
                    <CardHeader className="pb-4">
                      <CardTitle className="flex items-center gap-2 text-lg"><FolderOpen className="w-5 h-5 text-emerald-300" /> Saved Shorts</CardTitle>
                      <CardDescription className="text-white/50 text-xs">
                        Jump between presets quickly.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {shortsLibraryError && (
                        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{shortsLibraryError}</div>
                      )}
                      {isLoadingShortsLibrary && (
                        <div className="text-sm text-white/50">Loading saved shorts…</div>
                      )}
                      {!isLoadingShortsLibrary && savedShortProjects.length === 0 && (
                        <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-4 text-xs text-white/60 text-center">
                          No saved shorts yet.
                        </div>
                      )}

                      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                        {savedShortProjects.map((project) => {
                          const isActive = activeSavedShortProjectId === project.id;
                          return (
                            <div
                              key={project.id}
                              onClick={() => applySavedShortProject(project)}
                              className={cn(
                                "rounded-xl border p-3 cursor-pointer transition-colors hover:bg-white/10",
                                isActive ? "border-emerald-300/40 bg-emerald-400/10 pointer-events-none" : "border-white/10 bg-black/20"
                              )}
                            >
                              <div className="text-sm font-semibold text-white/90 truncate mb-1">{project.name}</div>
                              <div className="flex items-center justify-between">
                                <div className="text-[11px] text-white/55">
                                  {platformLabel(project.platform)} · {secondsToClock(project.clip.startSeconds)} → {secondsToClock(project.clip.endSeconds)}
                                </div>
                                {isActive && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-white/[0.03] border-white/10 text-white shadow-xl backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Clapperboard className="w-5 h-5 text-fuchsia-300" /> Vertical Editor + Export</CardTitle>
                    <CardDescription className="text-white/50">
                      Full-width editor for framing and subtitle placement. Exports are rendered locally in the browser and saved in your shorts lifecycle.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 2xl:grid-cols-[420px_1fr] gap-5">
                      <div className="space-y-3">
                        <div
                          ref={previewFrameRef}
                          className="relative mx-auto w-full max-w-[420px] aspect-[9/16] rounded-[1.6rem] border border-white/15 overflow-hidden bg-black shadow-2xl"
                        >
                          {isVideoMedia && mediaUrl ? (
                            <video
                              key={mediaUrl}
                              ref={previewVideoRef}
                              src={mediaUrl}
                              muted
                              playsInline
                              onTimeUpdate={handleVideoTimeUpdate}
                              onPlay={handleVideoPlay}
                              onPause={handleVideoPause}
                              onEnded={handleVideoEnded}
                              className="absolute"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                left: "50%",
                                top: "50%",
                                transform: `translate(-50%, -50%) scale(${zoom}) translate(${panX}px, ${panY}px)`,
                                transformOrigin: "center center",
                              }}
                            />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-black to-orange-500/10 flex items-center justify-center p-6 text-center">
                              <div>
                                <div className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Preview Placeholder</div>
                                <div className="text-sm text-white/70 leading-relaxed">
                                  {mediaFilename ? `Audio-only source: ${mediaFilename}` : "No video preview available. You can still save editor presets for later."}
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

                          {previewSubtitleLine && (
                            <div
                              className="absolute px-2 py-1.5 text-center transition-opacity duration-150"
                              style={{
                                left: `${subtitleXPositionPct}%`,
                                top: `${subtitleYOffsetPct}%`,
                                transform: `translate(-50%, -50%) scale(${subtitleScale})`,
                                maxWidth: "80%",
                                backgroundColor: "rgba(0,0,0,0.43)",
                                fontFamily: "var(--font-inter), 'Inter', sans-serif",
                              }}
                            >
                              <div
                                className="text-sm leading-tight font-semibold"
                                style={{
                                  color: "#FFFFFF",
                                  WebkitTextStroke: "0.5px rgba(10,10,10,0.8)",
                                  paintOrder: "stroke fill",
                                }}
                              >
                                {previewSubtitleLine}
                              </div>
                            </div>
                          )}

                          {/* Playback controls overlay at bottom of frame */}
                          {isVideoMedia && mediaUrl && (
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 pb-3 px-3">
                              {/* Seek bar */}
                              <div
                                className="h-1 rounded-full bg-white/20 mb-2.5 cursor-pointer"
                                onClick={(e) => {
                                  if (!editedClip) return;
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                                  const seekTime = editedClip.startSeconds + pct * editedClip.durationSeconds;
                                  const video = previewVideoRef.current;
                                  if (video) {
                                    video.currentTime = seekTime;
                                    setCurrentTime(seekTime);
                                  }
                                }}
                              >
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-300 transition-[width] duration-100"
                                  style={{ width: `${clipProgressPct}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={togglePlayPause}
                                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                                    aria-label={isPlaying ? "Pause" : "Play"}
                                  >
                                    {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={toggleMute}
                                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                                    aria-label={isMuted ? "Unmute" : "Mute"}
                                  >
                                    {isMuted ? <VolumeX className="w-4 h-4 text-white/70" /> : <Volume2 className="w-4 h-4 text-white" />}
                                  </button>
                                </div>
                                {editedClip && (
                                  <div className="text-[11px] text-white/60 tabular-nums">
                                    {secondsToClock(Math.max(0, currentTime - editedClip.startSeconds))} / {secondsToClock(editedClip.durationSeconds)}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {editedClip && (
                          <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/70 space-y-1">
                            <div>Clip: {secondsToClock(editedClip.startSeconds)} → {secondsToClock(editedClip.endSeconds)}</div>
                            <div>Duration: {editedClip.durationSeconds.toFixed(1)}s</div>
                            <div>Subtitle source: {selectedSubtitle ? subtitleVersionLabel(selectedSubtitle) : "None"}</div>
                            <div>Subtitle chunks in clip: {selectedClipSubtitleChunks.length}</div>
                            {activeSavedShortProject && (
                              <div className="text-emerald-200/90">Loaded saved short: {activeSavedShortProject.name}</div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                            <div className="text-xs uppercase tracking-wider text-white/50">Trim + Framing</div>
                            {editedClip && (
                              <div className="rounded-xl border border-white/10 bg-black/40 p-4 space-y-5">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <label className="text-xs uppercase tracking-widest text-emerald-300/80 font-medium w-20">Start</label>
                                    <div className="relative flex-1">
                                      <input
                                        type="number"
                                        min={0}
                                        step={0.1}
                                        value={editedClip.startSeconds}
                                        onChange={(e) => {
                                          const value = Number(e.target.value);
                                          if (!Number.isFinite(value)) return;
                                          setEditedClipStartSeconds(value);
                                        }}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-3 pr-6 text-left text-sm font-medium text-emerald-100 shadow-inner focus:outline-none focus:border-emerald-400/50 focus:bg-emerald-400/10 transition-colors"
                                      />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30 pointer-events-none">sec</span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center justify-between gap-3">
                                    <label className="text-xs uppercase tracking-widest text-orange-300/80 font-medium w-20">End</label>
                                    <div className="relative flex-1">
                                      <input
                                        type="number"
                                        min={1}
                                        step={0.1}
                                        value={editedClip.endSeconds}
                                        onChange={(e) => {
                                          const value = Number(e.target.value);
                                          if (!Number.isFinite(value)) return;
                                          setEditedClipEndSeconds(value);
                                        }}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-3 pr-6 text-left text-sm font-medium text-orange-100 shadow-inner focus:outline-none focus:border-orange-400/50 focus:bg-orange-400/10 transition-colors"
                                      />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30 pointer-events-none">sec</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-3">
                                    <label className="text-xs uppercase tracking-widest text-cyan-300/80 font-medium w-20">Duration</label>
                                    <div className="relative flex-1">
                                      <input
                                        type="number"
                                        min={1}
                                        step={0.1}
                                        value={editedClip.durationSeconds}
                                        onChange={(e) => {
                                          const value = Number(e.target.value);
                                          if (!Number.isFinite(value)) return;
                                          setEditedClipDurationSeconds(value);
                                        }}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-3 pr-6 text-left text-sm font-medium text-cyan-100 shadow-inner focus:outline-none focus:border-cyan-400/50 focus:bg-cyan-400/10 transition-colors"
                                      />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30 pointer-events-none">sec</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-wrap justify-center gap-2 pt-4 border-t border-white/5">
                                  <Button type="button" size="sm" variant="ghost" className="h-8 px-4 text-xs font-medium rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white/70 transition-colors" onClick={() => adjustEditedClipDurationSeconds(-5)}>
                                    -5s
                                  </Button>
                                  <Button type="button" size="sm" variant="ghost" className="h-8 px-4 text-xs font-medium rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white/70 transition-colors" onClick={() => adjustEditedClipDurationSeconds(-1)}>
                                    -1s
                                  </Button>
                                  <Button type="button" size="sm" variant="ghost" className="h-8 px-4 text-xs font-medium rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white/70 transition-colors" onClick={() => adjustEditedClipDurationSeconds(0.5)}>
                                    +0.5s
                                  </Button>
                                  <Button type="button" size="sm" variant="ghost" className="h-8 px-4 text-xs font-medium rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white/70 transition-colors" onClick={() => adjustEditedClipDurationSeconds(1)}>
                                    +1s
                                  </Button>
                                  <Button type="button" size="sm" variant="ghost" className="h-8 px-4 text-xs font-medium rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white/70 transition-colors" onClick={() => adjustEditedClipDurationSeconds(5)}>
                                    +5s
                                  </Button>
                                </div>
                                {typeof sourceDurationSeconds === "number" && Number.isFinite(sourceDurationSeconds) && (
                                  <div className="text-[11px] text-white/45">Source duration: {sourceDurationSeconds.toFixed(1)}s (trim is clamped to this length)</div>
                                )}
                              </div>
                            )}
                            <label className="text-xs text-white/70 block">Start nudge: {trimStartNudge.toFixed(1)}s</label>
                            <input
                              type="range"
                              min={-300}
                              max={300}
                              step={0.1}
                              value={trimStartNudge}
                              onChange={(e) => {
                                setTrimStartNudge(Number(e.target.value));
                                setActiveSavedShortProjectId("");
                              }}
                              className="w-full"
                            />
                            <label className="text-xs text-white/70 block">End nudge: {trimEndNudge.toFixed(1)}s</label>
                            <input
                              type="range"
                              min={-300}
                              max={300}
                              step={0.1}
                              value={trimEndNudge}
                              onChange={(e) => {
                                setTrimEndNudge(Number(e.target.value));
                                setActiveSavedShortProjectId("");
                              }}
                              className="w-full"
                            />
                            <label className="text-xs text-white/70 block">Zoom: {zoom.toFixed(2)}x</label>
                            <input type="range" min={0.5} max={4.0} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
                            <label className="text-xs text-white/70 block">Pan X: {panX}px</label>
                            <input type="range" min={-600} max={600} step={1} value={panX} onChange={(e) => setPanX(Number(e.target.value))} className="w-full" />
                            <label className="text-xs text-white/70 block">Pan Y: {panY}px</label>
                            <input type="range" min={-600} max={600} step={1} value={panY} onChange={(e) => setPanY(Number(e.target.value))} className="w-full" />
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                            <div className="text-xs uppercase tracking-wider text-white/50">Subtitles</div>
                            <label className="text-xs text-white/70 block">Subtitle scale: {subtitleScale.toFixed(2)}x</label>
                            <input type="range" min={0.7} max={1.8} step={0.01} value={subtitleScale} onChange={(e) => setSubtitleScale(Number(e.target.value))} className="w-full" />
                            <label className="text-xs text-white/70 block">Subtitle horizontal position: {subtitleXPositionPct.toFixed(0)}%</label>
                            <input type="range" min={10} max={90} step={1} value={subtitleXPositionPct} onChange={(e) => setSubtitleXPositionPct(Number(e.target.value))} className="w-full" />
                            <label className="text-xs text-white/70 block">Subtitle vertical position: {subtitleYOffsetPct.toFixed(0)}%</label>
                            <input type="range" min={45} max={92} step={1} value={subtitleYOffsetPct} onChange={(e) => setSubtitleYOffsetPct(Number(e.target.value))} className="w-full" />
                            <label className="flex items-center gap-2 text-xs text-white/70 mt-2">
                              <input type="checkbox" checked={showSafeZones} onChange={(e) => setShowSafeZones(e.target.checked)} />
                              Show platform safe zones
                            </label>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                            <div className="text-xs uppercase tracking-wider text-white/50">Save + Export</div>
                            <div className="text-xs text-white/60 leading-relaxed">
                              Export creates an MP4 locally in the browser, stores the file blob + editor configuration in IndexedDB, and downloads it immediately.
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs text-white/70 block">
                                Saved short name
                                <input
                                  type="text"
                                  value={shortProjectNameDraft}
                                  onChange={(e) => setShortProjectNameDraft(e.target.value)}
                                  placeholder={autoGeneratedShortProjectName || "Auto-generated on save"}
                                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35"
                                />
                              </label>
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-[11px] text-white/45">
                                  Load a saved short, change this name, then click <span className="text-white/75">Save Short Config</span> to rename it.
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs bg-white/5 hover:bg-white/10 text-white/80"
                                  onClick={() => setShortProjectNameDraft("")}
                                  disabled={!shortProjectNameDraft.trim()}
                                >
                                  Auto Name
                                </Button>
                              </div>
                            </div>
                            {!isVideoMedia && mediaFilename && (
                              <div className="text-xs text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 flex items-start gap-2">
                                <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
                                Current source is audio-only. Save config is available, local MP4 export needs a video source.
                              </div>
                            )}
                            {!canRender && !isExportingShort && (
                              <div className="text-xs text-white/50 bg-white/5 border border-white/10 rounded-lg p-2">
                                {selectedProject && (!selectedTranscript || !selectedSubtitle)
                                  ? "Select a transcript + subtitle source to enable save/export."
                                  : "Pick a source project to start editing and saving shorts."}
                              </div>
                            )}
                            <div className="pt-2 flex flex-wrap gap-2">
                              <Button
                                onClick={handleSaveShortProject}
                                disabled={!canRender || isExportingShort}
                                variant="ghost"
                                className="bg-white/5 hover:bg-white/10 text-white/90"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                Save Short Config
                              </Button>
                              <Button
                                onClick={handleRenderShort}
                                disabled={!canExportVideo || isExportingShort}
                                className="bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black font-semibold hover:from-fuchsia-400 hover:to-cyan-300"
                              >
                                {isExportingShort ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <HardDriveDownload className="w-4 h-4 mr-2" />}
                                {isExportingShort ? `Exporting ${exportProgressPct}%` : "Export Short (Local)"}
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
                                  setSubtitleXPositionPct(50);
                                  setSubtitleYOffsetPct(78);
                                  setShowSafeZones(true);
                                  setActiveSavedShortProjectId("");
                                }}
                              >
                                Reset Editor
                              </Button>
                            </div>
                            {isExportingShort && (
                              <div className="space-y-2">
                                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-fuchsia-400 to-cyan-300 transition-[width] duration-150"
                                    style={{ width: `${Math.max(4, exportProgressPct)}%` }}
                                  />
                                </div>
                                <div className="text-xs text-white/55">Local ffmpeg.wasm export in progress… keep this tab open.</div>
                              </div>
                            )}
                            {localRenderError && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{localRenderError}</div>}
                          </div>
                        </div>


                        {activeSavedShortProject && savedExportsForActiveShort.length > 0 && (
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                            <div className="text-sm font-semibold text-white/90">Saved Exports for Active Short</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {savedExportsForActiveShort.map((exp) => (
                                <div key={exp.id} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                                  <div className="text-xs text-white/90 break-all">{exp.filename}</div>
                                  <div className="text-[11px] text-white/50">
                                    {new Date(exp.createdAt).toLocaleString()} · {formatBytes(exp.sizeBytes)} · {exp.status}
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-white/80 hover:bg-white/10"
                                      onClick={() => handleDownloadSavedExport(exp)}
                                    >
                                      <Download className="w-4 h-4 mr-2" /> Download MP4
                                    </Button>
                                    {exp.debugFfmpegCommand && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-white/70 hover:bg-white/10"
                                        onClick={() => copyText(exp.debugFfmpegCommand?.join(" ") ?? "", "Saved FFmpeg command")}
                                      >
                                        <Copy className="w-4 h-4 mr-2" /> Cmd
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
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
