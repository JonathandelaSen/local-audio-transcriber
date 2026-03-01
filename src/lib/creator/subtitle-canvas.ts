/**
 * subtitle-canvas.ts
 *
 * Renders subtitle chunks to transparent 1080×1920 PNGs using OffscreenCanvas.
 * The rendering mirrors `SubtitlePreviewText` in CreatorHub.tsx exactly:
 *   - fill-spread passes (faux bold / letter-width)
 *   - stroke pass (outline)
 *   - shadow
 *   - main fill
 *
 * Because we use the same browser rendering engine as the preview div, the
 * exported video will be pixel-identical to what the user sees.
 */

import {
  cssRgbaFromHex,
  getSubtitleLetterWidthOffsets,
  getSubtitleMaxCharsPerLine,
  getSubtitleWeightBoostOffsets,
  resolveCreatorSubtitleStyle,
  wrapSubtitleLines,
} from "@/lib/creator/subtitle-style";
import type {
  CreatorShortEditorState,
  CreatorShortPlan,
  CreatorSubtitleStyleSettings,
  CreatorViralClip,
} from "@/lib/creator/types";
import type { SubtitleChunk } from "@/lib/history";

export const SUBTITLE_CANVAS_WIDTH = 1080;
export const SUBTITLE_CANVAS_HEIGHT = 1920;

export interface SubtitlePngFrame {
  /** Raw PNG bytes for the 1080×1920 transparent overlay frame */
  pngBytes: Uint8Array;
  /** Start time in seconds, already offset for the FFmpeg filter graph */
  start: number;
  /** End time in seconds, already offset for the FFmpeg filter graph */
  end: number;
  /** Path into ffmpeg.wasm VFS where the PNG will be written */
  vfsPath: string;
}

// ─── Font loading ───────────────────────────────────────────────────────────

const FONT_URL =
  "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf";

let cachedFontFace: FontFace | null = null;

async function ensureCanvasFont(): Promise<boolean> {
  if (cachedFontFace) return true;
  try {
    const res = await fetch(FONT_URL);
    if (!res.ok) return false;
    const fontData = await res.arrayBuffer();
    const face = new FontFace("InterSubtitle", fontData, { weight: "700" });
    await face.load();
    // Register so OffscreenCanvas ctx.font can use it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (self as any).fonts?.add(face);
    cachedFontFace = face;
    return true;
  } catch {
    return false;
  }
}

// ─── Single‑chunk renderer ──────────────────────────────────────────────────

function renderChunk(
  style: CreatorSubtitleStyleSettings,
  lines: string[],
  anchorX: number,
  anchorY: number,
  fontSize: number
): OffscreenCanvas {
  const canvas = new OffscreenCanvas(SUBTITLE_CANVAS_WIDTH, SUBTITLE_CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, SUBTITLE_CANVAS_WIDTH, SUBTITLE_CANVAS_HEIGHT);

  const lineHeight = Math.round(fontSize * 1.18);
  const fontSpec = `700 ${fontSize}px InterSubtitle, Inter, sans-serif`;

  // Vertical start: center the whole block around anchorY
  const blockH = (lines.length - 1) * lineHeight + fontSize;
  const blockTop = anchorY - blockH / 2;

  // Letter width: apply via horizontal scale (same effect as CSS scaleX)
  const letterScale = Math.max(1, Math.min(1.5, style.letterWidth));

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = fontSpec;

  lines.forEach((line, i) => {
    const textX = anchorX;
    const textY = blockTop + i * lineHeight;

    // 1. Shadow pass — dedicated fillText so shadow renders independently
    if (style.shadowOpacity > 0 && style.shadowDistance > 0) {
      ctx.save();
      ctx.translate(textX, textY);
      ctx.scale(letterScale, 1);
      ctx.shadowColor = cssRgbaFromHex(style.shadowColor, style.shadowOpacity);
      ctx.shadowOffsetX = style.shadowDistance;
      ctx.shadowOffsetY = style.shadowDistance;
      ctx.shadowBlur = 0;
      ctx.fillStyle = cssRgbaFromHex(style.textColor, 1);
      ctx.font = fontSpec;
      ctx.fillText(line, 0, 0);
      ctx.restore();
    }

    // 2. Stroke (outline) pass — matches WebkitTextStroke + paintOrder: stroke fill
    if (style.borderWidth > 0) {
      ctx.save();
      ctx.translate(textX, textY);
      ctx.scale(letterScale, 1);
      ctx.strokeStyle = cssRgbaFromHex(style.borderColor, 0.95);
      // CSS WebkitTextStroke radiates outward; canvas stroke is centered → ×2
      ctx.lineWidth = style.borderWidth * 2;
      ctx.lineJoin = "round";
      ctx.font = fontSpec;
      ctx.strokeText(line, 0, 0);
      ctx.restore();
    }

    // 3. Main fill (paintOrder: stroke fill → fill is on top of stroke)
    ctx.save();
    ctx.translate(textX, textY);
    ctx.scale(letterScale, 1);
    ctx.fillStyle = cssRgbaFromHex(style.textColor, 1);
    ctx.font = fontSpec;
    ctx.fillText(line, 0, 0);
    ctx.restore();
  });

  return canvas;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function renderSubtitlesToPngs(
  subtitleChunks: SubtitleChunk[],
  clip: CreatorViralClip,
  plan: CreatorShortPlan,
  editor: CreatorShortEditorState,
  timeOffsetSeconds: number
): Promise<SubtitlePngFrame[]> {
  const fontLoaded = await ensureCanvasFont();
  if (!fontLoaded) {
    console.warn("subtitle-canvas: Inter font failed to load — PNGs will use fallback font");
  }

  const style = resolveCreatorSubtitleStyle(plan.subtitleStyle, editor.subtitleStyle);
  const fontSize = Math.round(Math.min(96, Math.max(36, 56 * editor.subtitleScale)));
  const maxCharsPerLine = getSubtitleMaxCharsPerLine(
    fontSize,
    style.letterWidth,
    SUBTITLE_CANVAS_WIDTH
  );

  const anchorX = Math.round(SUBTITLE_CANVAS_WIDTH  * (editor.subtitleXPositionPct / 100));
  const anchorY = Math.round(SUBTITLE_CANVAS_HEIGHT * (editor.subtitleYOffsetPct   / 100));

  const frames: SubtitlePngFrame[] = [];

  for (const chunk of subtitleChunks) {
    const startAbs = chunk.timestamp?.[0];
    const endAbs   = chunk.timestamp?.[1];
    if (startAbs == null) continue;

    const start = Math.max(0, startAbs - clip.startSeconds);
    const end   = endAbs != null
      ? Math.min(Math.max(0, endAbs - clip.startSeconds), clip.durationSeconds)
      : Math.min(start + 2.5, clip.durationSeconds);

    if (end <= start || start > clip.durationSeconds + 0.25) continue;

    const text = String(chunk.text ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;

    const transformed = style.textCase === "uppercase" ? text.toUpperCase() : text;
    const lines = wrapSubtitleLines(transformed, maxCharsPerLine);
    if (!lines.length) continue;

    const canvas = renderChunk(style, lines, anchorX, anchorY, fontSize);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const pngBytes = new Uint8Array(await blob.arrayBuffer());

    const idx = frames.length;
    frames.push({
      pngBytes,
      start: start + timeOffsetSeconds,
      end: end + timeOffsetSeconds,
      vfsPath: `/tmp/sub_${idx}.png`,
    });
  }

  return frames;
}
