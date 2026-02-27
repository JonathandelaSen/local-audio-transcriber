import { getFFmpeg } from "@/lib/ffmpeg";
import { buildShortExportGeometry } from "@/lib/creator/core/export-geometry";
import {
  ffmpegColorWithAlpha,
  ffmpegHexColorFromCss,
  resolveCreatorSubtitleStyle,
  wrapSubtitleLines,
} from "@/lib/creator/subtitle-style";
import type {
  CreatorShortEditorState,
  CreatorShortPlan,
  CreatorViralClip,
} from "@/lib/creator/types";
import type { SubtitleChunk } from "@/lib/history";

const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;
const FAST_SEEK_CUSHION_SECONDS = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^\w.-]+/g, "_");
}

function parseFfmpegTimecodeToSeconds(timecode: string): number | null {
  const match = timecode.match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (!match) return null;
  const [, hoursRaw, minutesRaw, secondsRaw, fractionRaw] = match;
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const seconds = Number(secondsRaw);
  const fraction = fractionRaw ? Number(`0.${fractionRaw}`) : 0;
  if (![hours, minutes, seconds, fraction].every(Number.isFinite)) return null;
  return hours * 3600 + minutes * 60 + seconds + fraction;
}

function parseFfmpegLogProgressSeconds(message: string): number | null {
  const match = message.match(/\btime=(\d+:\d{2}:\d{2}(?:\.\d+)?)\b/);
  if (!match) return null;
  return parseFfmpegTimecodeToSeconds(match[1]);
}

function drawtextEscape(text: string): string {
  // FFmpeg drawtext escaping: escape special filter chars and single quotes
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "'\\''")
    .replace(/:/g, "\\:")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/;/g, "\\;")
    .replace(/%/g, "%%")
    .replace(/\r/g, "");
}

const FONT_URL = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf";
const FONT_PATH = "/tmp/Inter.ttf";

let fontLoaded = false;

async function ensureFontLoaded(ff: Awaited<ReturnType<typeof getFFmpeg>>): Promise<boolean> {
  if (fontLoaded) return true;
  try {
    const response = await fetch(FONT_URL);
    if (!response.ok) return false;
    const fontData = new Uint8Array(await response.arrayBuffer());
    await ff.writeFile(FONT_PATH, fontData);
    fontLoaded = true;
    return true;
  } catch (err) {
    console.warn("Failed to load font for subtitle burn-in:", err);
    return false;
  }
}

function buildDrawtextSubtitleFilters(
  subtitleChunks: SubtitleChunk[],
  clip: CreatorViralClip,
  plan: CreatorShortPlan,
  editor: CreatorShortEditorState,
  timeOffsetSeconds: number = 0
): string[] {
  const chunks = (subtitleChunks || [])
    .map((chunk) => {
      const startAbs = chunk.timestamp?.[0];
      const endAbs = chunk.timestamp?.[1];
      const start = startAbs == null ? null : Math.max(0, startAbs - clip.startSeconds);
      const end = endAbs == null ? (start == null ? null : start + 2.5) : Math.max(0, endAbs - clip.startSeconds);
      const text = String(chunk.text ?? "").replace(/\s+/g, " ").trim();
      if (!text || start == null || end == null || end <= start) return null;
      if (start > clip.durationSeconds + 0.25) return null;
      return {
        start,
        end: Math.min(end, clip.durationSeconds),
        text,
      };
    })
    .filter((row): row is { start: number; end: number; text: string } => !!row);

  if (!chunks.length) return [];

  const style = resolveCreatorSubtitleStyle(plan.subtitleStyle, editor.subtitleStyle);
  const fontSize = Math.round(clamp(56 * editor.subtitleScale, 36, 96));
  // Estimate max chars per line: ~80% of output width / (fontSize * 0.55 avg char width)
  const maxCharsPerLine = Math.max(10, Math.round((OUTPUT_WIDTH * 0.80) / (fontSize * 0.55)));
  const x = `(w*${(editor.subtitleXPositionPct / 100).toFixed(4)}-tw/2)`;
  const y = `(h*${(editor.subtitleYOffsetPct / 100).toFixed(4)}-th/2)`;

  return chunks.flatMap((chunk) => {
    const transformed = style.textCase === "uppercase" ? chunk.text.toUpperCase() : chunk.text;
    const lines = wrapSubtitleLines(transformed, maxCharsPerLine);
    const lineStep = Math.round(fontSize * 1.18);
    const centerIndex = (lines.length - 1) / 2;

    return lines.map((line, lineIndex) => {
      const escaped = drawtextEscape(line);
      const offsetPx = (lineIndex - centerIndex) * lineStep;
      const yWithOffset = offsetPx === 0 ? y : `(${y}${offsetPx >= 0 ? "+" : ""}${offsetPx.toFixed(2)})`;

      return (
        `drawtext=fontfile=${FONT_PATH}` +
        `:text='${escaped}'` +
        `:fontsize=${fontSize}` +
        `:fontcolor=${ffmpegHexColorFromCss(style.textColor)}` +
        `:borderw=${style.outlineWidth.toFixed(2)}` +
        `:bordercolor=${ffmpegHexColorFromCss(style.outlineColor)}` +
        `:box=1` +
        `:boxcolor=${ffmpegColorWithAlpha(style.backgroundColor, style.backgroundOpacity)}` +
        `:boxborderw=${style.backgroundPadding.toFixed(2)}` +
        `:x=${x}` +
        `:y=${yWithOffset}` +
        `:enable='between(t,${(chunk.start + timeOffsetSeconds).toFixed(3)},${(chunk.end + timeOffsetSeconds).toFixed(3)})'`
      );
    });
  });
}

export interface LocalShortExportInput {
  sourceFile: File;
  sourceFilename: string;
  clip: CreatorViralClip;
  plan: CreatorShortPlan;
  subtitleChunks: SubtitleChunk[];
  editor: CreatorShortEditorState;
  sourceVideoSize: { width: number; height: number };
  previewViewport?: { width: number; height: number } | null;
  previewVideoRect?: { width: number; height: number } | null;
  onProgress?: (progressPct: number) => void;
}

export interface LocalShortExportResult {
  file: File;
  ffmpegCommandPreview: string[];
  notes: string[];
  subtitleBurnedIn: boolean;
}

export async function exportShortVideoLocally(input: LocalShortExportInput): Promise<LocalShortExportResult> {
  const ff = await getFFmpeg();
  const mountDir = `/render_${Date.now()}`;
  const outputFilename = sanitizeFilename(
    `${input.sourceFilename.replace(/\.[^/.]+$/, "")}__${input.plan.platform}__${Math.floor(input.clip.startSeconds)}-${Math.ceil(
      input.clip.endSeconds
    )}.mp4`
  );
  const outputPath = `out_${Date.now()}.mp4`;

  const preview = buildShortExportGeometry({
    sourceWidth: input.sourceVideoSize.width,
    sourceHeight: input.sourceVideoSize.height,
    editor: input.editor,
    previewViewport: input.previewViewport ?? null,
    previewVideoRect: input.previewVideoRect ?? null,
    outputWidth: OUTPUT_WIDTH,
    outputHeight: OUTPUT_HEIGHT,
  });

  const clipDuration = Math.max(0.5, input.clip.endSeconds - input.clip.startSeconds);
  const inputSeekSeconds = Math.max(0, input.clip.startSeconds - FAST_SEEK_CUSHION_SECONDS);
  const exactTrimAfterSeekSeconds = Math.max(0, input.clip.startSeconds - inputSeekSeconds);

  // Offset subtitle times by exactTrimAfterSeekSeconds because the filter graph
  // processes frames starting from the first -ss seek point, not the clip start.
  // The second -ss then trims and rebases output timestamps.
  const subtitleDrawtextFilters = buildDrawtextSubtitleFilters(
    input.subtitleChunks ?? [], input.clip, input.plan, input.editor, exactTrimAfterSeekSeconds
  );

  let lastProgressPct = 0;
  const emitProgress = (pct: number) => {
    const next = Math.round(clamp(pct, 0, 100));
    if (next <= lastProgressPct) return;
    lastProgressPct = next;
    input.onProgress?.(lastProgressPct);
  };

  const runFfmpegExecWithFallbackProgress = async (args: string[]) => {
    const startPct = Math.max(lastProgressPct, 8);
    const startedAt = Date.now();
    const quickRampMs = Math.max(4_000, clipDuration * 2_500);
    const tailTauMs = Math.max(12_000, clipDuration * 5_000);

    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed <= quickRampMs) {
        const linear = clamp(elapsed / quickRampMs, 0, 1);
        const eased = 1 - Math.pow(1 - linear, 3);
        emitProgress(startPct + (94 - startPct) * eased);
        return;
      }

      const tailElapsed = elapsed - quickRampMs;
      const tailEased = 1 - Math.exp(-tailElapsed / tailTauMs);
      emitProgress(94 + (99 - 94) * tailEased);
    }, 250);

    try {
      await ff.exec(args);
    } finally {
      clearInterval(timer);
    }
  };

  const progressHandler = ({ progress, time }: { progress: number; time: number }) => {
    // ffmpeg.wasm progress can be unreliable with input-seeking; use time-based fallback
    let pct = 0;
    if (Number.isFinite(progress) && progress > 0) {
      pct = progress <= 1 ? progress * 100 : progress;
    } else if (Number.isFinite(time) && time > 0) {
      // time is in microseconds of output processed
      pct = Math.min(100, (time / 1_000_000 / clipDuration) * 100);
    }
    emitProgress(pct);
  };
  ff.on("progress", progressHandler);

  const logHandler = ({ message }: { message: string }) => {
    const processedSeconds = parseFfmpegLogProgressSeconds(String(message ?? ""));
    if (processedSeconds == null || processedSeconds <= 0) return;
    emitProgress((processedSeconds / clipDuration) * 100);
  };
  ff.on("log", logHandler);

  // Build the video filter chain: scale/pad/crop + optional drawtext subtitle filters
  const baseFilter = preview.filter;

  const buildFfmpegArgs = (filter: string, seekMode: "hybrid" | "exact"): string[] => {
    const preInputSeek = seekMode === "hybrid" ? ["-ss", String(inputSeekSeconds)] : [];
    const postInputSeekSeconds = seekMode === "hybrid" ? exactTrimAfterSeekSeconds : input.clip.startSeconds;
    return [
      ...preInputSeek,
      "-i",
      `${mountDir}/${input.sourceFile.name}`,
      "-ss",
      String(postInputSeekSeconds),
      "-t",
      String(clipDuration),
      "-vf",
      filter,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "22",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ];
  };

  const renderWithSeekFallback = async (filter: string): Promise<"hybrid" | "exact"> => {
    try {
      emitProgress(8);
      await runFfmpegExecWithFallbackProgress(buildFfmpegArgs(filter, "hybrid"));
      return "hybrid";
    } catch (hybridError) {
      console.warn("Hybrid-seek render failed, retrying with exact-seek mode:", hybridError);
      try {
        await ff.deleteFile(outputPath);
      } catch {}
      emitProgress(8);
      await runFfmpegExecWithFallbackProgress(buildFfmpegArgs(filter, "exact"));
      return "exact";
    }
  };

  let usedSubtitleBurnIn = false;
  let usedSeekMode: "hybrid" | "exact" = "hybrid";

  try {
    emitProgress(1);
    await ff.createDir(mountDir);
    await ff.mount("WORKERFS" as never, { files: [input.sourceFile] }, mountDir);
    emitProgress(4);

    // Attempt subtitle burn-in with drawtext filters
    if (subtitleDrawtextFilters.length > 0) {
      const hasFontLoaded = await ensureFontLoaded(ff);
      if (hasFontLoaded) {
        emitProgress(6);
        const fullFilter = [baseFilter, ...subtitleDrawtextFilters].join(",");
        try {
          usedSeekMode = await renderWithSeekFallback(fullFilter);
          usedSubtitleBurnIn = true;
        } catch (err) {
          console.warn("Drawtext subtitle burn-in failed, retrying export without subtitles:", err);
          try { await ff.deleteFile(outputPath); } catch {}
          usedSeekMode = await renderWithSeekFallback(baseFilter);
        }
      } else {
        console.warn("Font not available, exporting without subtitles");
        usedSeekMode = await renderWithSeekFallback(baseFilter);
      }
    } else {
      usedSeekMode = await renderWithSeekFallback(baseFilter);
    }

    emitProgress(98);
    const output = await ff.readFile(outputPath);
    if (typeof output === "string") {
      throw new Error("FFmpeg returned text output instead of binary video data");
    }
    const data = output instanceof Uint8Array ? new Uint8Array(output) : new Uint8Array(output as Uint8Array);
    if (data.byteLength < 1024) {
      throw new Error("Rendered output is empty. Clip timing may be outside the source video range.");
    }
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const file = new File([arrayBuffer], outputFilename, { type: "video/mp4" });
    emitProgress(100);

    const ffmpegCommandPreview =
      usedSeekMode === "hybrid"
        ? [
            "ffmpeg",
            "-ss",
            String(inputSeekSeconds),
            "-i",
            input.sourceFilename,
            "-ss",
            String(exactTrimAfterSeekSeconds),
            "-t",
            String(clipDuration),
            "-vf",
            usedSubtitleBurnIn ? `${baseFilter},...drawtext` : baseFilter,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "22",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            outputFilename,
          ]
        : [
            "ffmpeg",
            "-i",
            input.sourceFilename,
            "-ss",
            String(input.clip.startSeconds),
            "-t",
            String(clipDuration),
            "-vf",
            usedSubtitleBurnIn ? `${baseFilter},...drawtext` : baseFilter,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "22",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            outputFilename,
          ];

    const effectiveSubtitleStyle = resolveCreatorSubtitleStyle(input.plan.subtitleStyle, input.editor.subtitleStyle);

    const notes = [
      `Local browser render via ffmpeg.wasm (${input.plan.platform})`,
      usedSeekMode === "hybrid"
        ? inputSeekSeconds > 0
          ? `Hybrid trim seek enabled: fast pre-seek ${inputSeekSeconds.toFixed(2)}s, exact post-seek ${exactTrimAfterSeekSeconds.toFixed(2)}s.`
          : `Exact trim seek from start: ${exactTrimAfterSeekSeconds.toFixed(2)}s.`
        : `Fallback exact-seek mode used from ${input.clip.startSeconds.toFixed(2)}s for container compatibility.`,
      preview.canvasWidth !== preview.scaledWidth || preview.canvasHeight !== preview.scaledHeight
        ? `Zoom-out/pad mode. Scaled frame ${preview.scaledWidth}x${preview.scaledHeight}, padded canvas ${preview.canvasWidth}x${preview.canvasHeight} @ (${preview.padX}, ${preview.padY}), crop @ (${preview.cropX}, ${preview.cropY}).`
        : `Crop based on zoom/pan. Scaled frame ${preview.scaledWidth}x${preview.scaledHeight}, crop @ (${preview.cropX}, ${preview.cropY}).`,
      input.previewVideoRect
        ? `Preview parity source: video rect ${Math.round(input.previewVideoRect.width)}x${Math.round(input.previewVideoRect.height)} inside viewport ${Math.round(
            input.previewViewport?.width ?? 0
          )}x${Math.round(input.previewViewport?.height ?? 0)}.`
        : "Preview parity source: computed from source dimensions + editor zoom.",
      usedSubtitleBurnIn
        ? `Subtitles burned in at x=${input.editor.subtitleXPositionPct.toFixed(0)}%, y=${input.editor.subtitleYOffsetPct.toFixed(0)}% using ${effectiveSubtitleStyle.preset}.`
        : "Rendered without burned subtitles (subtitle filter unavailable or no subtitle chunks).",
      effectiveSubtitleStyle.backgroundRadius > 0
        ? "Rounded subtitle box corners are preview-only right now; FFmpeg drawtext export uses square boxes."
        : "Subtitle box corners exported as square boxes.",
    ];

    return {
      file,
      ffmpegCommandPreview,
      notes,
      subtitleBurnedIn: usedSubtitleBurnIn,
    };
  } finally {
    try {
      await ff.deleteFile(outputPath);
    } catch {}
    try {
      await ff.unmount(mountDir);
      await ff.deleteDir(mountDir);
    } catch {}
    ff.off("progress", progressHandler);
    ff.off("log", logHandler);
  }
}
