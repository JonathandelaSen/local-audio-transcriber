import { getFFmpeg } from "@/lib/ffmpeg";
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

function assEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\r?\n/g, "\\N");
}

function toAssTime(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const cs = Math.floor((safe - Math.floor(safe)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function colorForStyle(style: CreatorShortPlan["subtitleStyle"]): {
  primary: string;
  outline: string;
  back: string;
  bold: number;
} {
  if (style === "creator_neon") {
    return { primary: "&H00FFF7E8", outline: "&H009C3D00", back: "&H78000000", bold: 1 };
  }
  if (style === "clean_caption") {
    return { primary: "&H00FFFFFF", outline: "&H00323232", back: "&H5A000000", bold: 0 };
  }
  return { primary: "&H00FFFFFF", outline: "&H000A0A0A", back: "&H6E000000", bold: 1 };
}

function buildAssSubtitleScript(
  subtitleChunks: SubtitleChunk[],
  clip: CreatorViralClip,
  plan: CreatorShortPlan,
  editor: CreatorShortEditorState
): string | null {
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

  if (!chunks.length) return null;

  const subtitleColors = colorForStyle(plan.subtitleStyle);
  const fontSize = Math.round(clamp(56 * editor.subtitleScale, 36, 96));
  const x = Math.round(clamp((editor.subtitleXPositionPct / 100) * OUTPUT_WIDTH, 80, OUTPUT_WIDTH - 80));
  const y = Math.round(clamp((editor.subtitleYOffsetPct / 100) * OUTPUT_HEIGHT, 120, OUTPUT_HEIGHT - 80));
  const marginL = Math.max(24, Math.round((OUTPUT_WIDTH * 0.12)));
  const marginR = marginL;
  const marginV = Math.max(24, OUTPUT_HEIGHT - y);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${OUTPUT_WIDTH}
PlayResY: ${OUTPUT_HEIGHT}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.601

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontSize},${subtitleColors.primary},&H000000FF,${subtitleColors.outline},${subtitleColors.back},${subtitleColors.bold},0,0,0,100,100,0,0,1,3.2,0.6,2,${marginL},${marginR},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const events = chunks.map((chunk) => {
    const text = assEscape(chunk.text);
    return `Dialogue: 0,${toAssTime(chunk.start)},${toAssTime(chunk.end)},Default,,0,0,0,,{\\an5\\pos(${x},${y})}${text}`;
  });

  return `${header}\n${events.join("\n")}\n`;
}

function getFfmpegFilter(
  sourceWidth: number,
  sourceHeight: number,
  editor: CreatorShortEditorState,
  previewViewport: { width: number; height: number } | null,
  previewVideoRect?: { width: number; height: number } | null
): {
  filter: string;
  cropX: number;
  cropY: number;
  scaledWidth: number;
  scaledHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  padX: number;
  padY: number;
} {
  const viewportWidth = Math.max(1, previewViewport?.width ?? 320);
  const viewportHeight = Math.max(1, previewViewport?.height ?? (viewportWidth * 16) / 9);


  const baseScale = Math.min(OUTPUT_WIDTH / sourceWidth, OUTPUT_HEIGHT / sourceHeight);
  const scaleFactor = baseScale * Math.max(0.2, editor.zoom || 1);
  const scaledWidth = Math.max(1, Math.round(sourceWidth * scaleFactor));
  const scaledHeight = Math.max(1, Math.round(sourceHeight * scaleFactor));

  const panXOut = (editor.panX / viewportWidth) * OUTPUT_WIDTH;
  const panYOut = (editor.panY / viewportHeight) * OUTPUT_HEIGHT;

  const canvasWidth = Math.max(OUTPUT_WIDTH, scaledWidth);
  const canvasHeight = Math.max(OUTPUT_HEIGHT, scaledHeight);

  const padX = Math.round(
    clamp(
      (canvasWidth - scaledWidth) / 2 + (scaledWidth < OUTPUT_WIDTH ? panXOut : 0),
      0,
      Math.max(0, canvasWidth - scaledWidth)
    )
  );
  const padY = Math.round(
    clamp(
      (canvasHeight - scaledHeight) / 2 + (scaledHeight < OUTPUT_HEIGHT ? panYOut : 0),
      0,
      Math.max(0, canvasHeight - scaledHeight)
    )
  );

  const centerCropX = (canvasWidth - OUTPUT_WIDTH) / 2;
  const centerCropY = (canvasHeight - OUTPUT_HEIGHT) / 2;
  const cropX = Math.round(
    clamp(
      centerCropX - (scaledWidth >= OUTPUT_WIDTH ? panXOut : 0),
      0,
      Math.max(0, canvasWidth - OUTPUT_WIDTH)
    )
  );
  const cropY = Math.round(
    clamp(
      centerCropY - (scaledHeight >= OUTPUT_HEIGHT ? panYOut : 0),
      0,
      Math.max(0, canvasHeight - OUTPUT_HEIGHT)
    )
  );

  const filters = [`scale=${scaledWidth}:${scaledHeight}`];
  if (canvasWidth !== scaledWidth || canvasHeight !== scaledHeight) {
    filters.push(`pad=${canvasWidth}:${canvasHeight}:${padX}:${padY}:black`);
  }
  filters.push(`crop=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:${cropX}:${cropY}`);
  filters.push("format=yuv420p");

  return {
    filter: filters.join(","),
    cropX,
    cropY,
    scaledWidth,
    scaledHeight,
    canvasWidth,
    canvasHeight,
    padX,
    padY,
  };
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
  const assPath = `subs_${Date.now()}.ass`;
  const preview = getFfmpegFilter(
    input.sourceVideoSize.width,
    input.sourceVideoSize.height,
    input.editor,
    input.previewViewport ?? null,
    input.previewVideoRect ?? null
  );

  const subtitleAss = buildAssSubtitleScript(input.subtitleChunks ?? [], input.clip, input.plan, input.editor);

  const clipDuration = Math.max(0.5, input.clip.endSeconds - input.clip.startSeconds);
  const inputSeekSeconds = Math.max(0, input.clip.startSeconds - FAST_SEEK_CUSHION_SECONDS);
  const exactTrimAfterSeekSeconds = Math.max(0, input.clip.startSeconds - inputSeekSeconds);

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

  const baseArgs = [
    "-ss",
    String(inputSeekSeconds),
    "-i",
    `${mountDir}/${input.sourceFile.name}`,
    "-ss",
    String(exactTrimAfterSeekSeconds),
    "-t",
    String(clipDuration),
    "-vf",
    preview.filter,
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

  let usedSubtitleBurnIn = false;

  try {
    emitProgress(1);
    await ff.createDir(mountDir);
    await ff.mount("WORKERFS" as never, { files: [input.sourceFile] }, mountDir);
    emitProgress(4);

    if (subtitleAss) {
      await ff.writeFile(assPath, new TextEncoder().encode(subtitleAss));
      emitProgress(6);
      try {
        const subtitleArgs = [...baseArgs];
        const vfIndex = subtitleArgs.indexOf("-vf");
        if (vfIndex !== -1) {
          subtitleArgs[vfIndex + 1] = `${preview.filter},ass=${assPath}`;
        }
        emitProgress(8);
        await runFfmpegExecWithFallbackProgress(subtitleArgs);
        usedSubtitleBurnIn = true;
      } catch (err) {
        console.warn("ASS subtitle burn-in failed, retrying export without subtitles", err);
        try {
          await ff.deleteFile(outputPath);
        } catch {}
        emitProgress(8);
        await runFfmpegExecWithFallbackProgress(baseArgs);
      }
    } else {
      emitProgress(8);
      await runFfmpegExecWithFallbackProgress(baseArgs);
    }

    emitProgress(98);
    const output = await ff.readFile(outputPath);
    if (typeof output === "string") {
      throw new Error("FFmpeg returned text output instead of binary video data");
    }
    const data = output instanceof Uint8Array ? new Uint8Array(output) : new Uint8Array(output as Uint8Array);
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const file = new File([arrayBuffer], outputFilename, { type: "video/mp4" });
    emitProgress(100);

    const ffmpegCommandPreview = [
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
      usedSubtitleBurnIn ? `${preview.filter},ass=subs.ass` : preview.filter,
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

    const notes = [
      `Local browser render via ffmpeg.wasm (${input.plan.platform})`,
      inputSeekSeconds > 0
        ? `Hybrid trim seek enabled: fast pre-seek ${inputSeekSeconds.toFixed(2)}s, exact post-seek ${exactTrimAfterSeekSeconds.toFixed(2)}s.`
        : `Exact trim seek from start: ${exactTrimAfterSeekSeconds.toFixed(2)}s.`,
      preview.canvasWidth !== preview.scaledWidth || preview.canvasHeight !== preview.scaledHeight
        ? `Zoom-out/pad mode. Scaled frame ${preview.scaledWidth}x${preview.scaledHeight}, padded canvas ${preview.canvasWidth}x${preview.canvasHeight} @ (${preview.padX}, ${preview.padY}), crop @ (${preview.cropX}, ${preview.cropY}).`
        : `Crop based on zoom/pan. Scaled frame ${preview.scaledWidth}x${preview.scaledHeight}, crop @ (${preview.cropX}, ${preview.cropY}).`,
      input.previewVideoRect
        ? `Preview parity source: video rect ${Math.round(input.previewVideoRect.width)}x${Math.round(input.previewVideoRect.height)} inside viewport ${Math.round(
            input.previewViewport?.width ?? 0
          )}x${Math.round(input.previewViewport?.height ?? 0)}.`
        : "Preview parity source: computed from source dimensions + editor zoom.",
      usedSubtitleBurnIn
        ? `Subtitles burned in at x=${input.editor.subtitleXPositionPct.toFixed(0)}%, y=${input.editor.subtitleYOffsetPct.toFixed(0)}%.`
        : "Rendered without burned subtitles (subtitle filter unavailable or no subtitle chunks).",
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
      await ff.deleteFile(assPath);
    } catch {}
    try {
      await ff.unmount(mountDir);
      await ff.deleteDir(mountDir);
    } catch {}
    ff.off("progress", progressHandler);
    ff.off("log", logHandler);
  }
}
