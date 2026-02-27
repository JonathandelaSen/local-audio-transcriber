import type {
  CreatorSubtitleStyleSettings,
  CreatorSubtitleTextCase,
  CreatorVerticalEditorPreset,
} from "@/lib/creator/types";

type SubtitleStylePreset = CreatorVerticalEditorPreset["subtitleStyle"];

const HEX_COLOR_RE = /^#?([a-fA-F0-9]{6})$/;

export const CREATOR_SUBTITLE_STYLE_LABELS: Record<SubtitleStylePreset, string> = {
  bold_pop: "Bold Pop",
  clean_caption: "Clean Caption",
  creator_neon: "Creator Neon",
};

export interface CreatorSubtitleQuickStylePreset {
  id: string;
  name: string;
  description: string;
  style: CreatorSubtitleStyleSettings;
}

const DEFAULT_SUBTITLE_STYLE_BY_PRESET: Record<SubtitleStylePreset, Omit<CreatorSubtitleStyleSettings, "preset">> = {
  bold_pop: {
    textColor: "#FFFFFF",
    backgroundColor: "#000000",
    backgroundOpacity: 0.43,
    backgroundRadius: 8,
    outlineColor: "#0A0A0A",
    outlineWidth: 3,
    backgroundPadding: 8,
    textCase: "uppercase",
  },
  clean_caption: {
    textColor: "#FFFFFF",
    backgroundColor: "#000000",
    backgroundOpacity: 0.35,
    backgroundRadius: 6,
    outlineColor: "#323232",
    outlineWidth: 3,
    backgroundPadding: 8,
    textCase: "original",
  },
  creator_neon: {
    textColor: "#E8F7FF",
    backgroundColor: "#000000",
    backgroundOpacity: 0.47,
    backgroundRadius: 10,
    outlineColor: "#003D9C",
    outlineWidth: 3,
    backgroundPadding: 10,
    textCase: "original",
  },
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHexColor(input: string | undefined, fallback: string): string {
  const match = String(input ?? "").trim().match(HEX_COLOR_RE);
  if (!match) return fallback;
  return `#${match[1].toUpperCase()}`;
}

function normalizeTextCase(input: unknown, fallback: CreatorSubtitleTextCase): CreatorSubtitleTextCase {
  return input === "uppercase" ? "uppercase" : fallback;
}

function resolvePreset(input: unknown, fallback: SubtitleStylePreset): SubtitleStylePreset {
  return input === "bold_pop" || input === "clean_caption" || input === "creator_neon" ? input : fallback;
}

function toRgb(hex: string): [number, number, number] {
  const normalized = normalizeHexColor(hex, "#000000");
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

export function getDefaultCreatorSubtitleStyle(preset: SubtitleStylePreset): CreatorSubtitleStyleSettings {
  return {
    preset,
    ...DEFAULT_SUBTITLE_STYLE_BY_PRESET[preset],
  };
}

export function resolveCreatorSubtitleStyle(
  fallbackPreset: SubtitleStylePreset,
  input?: Partial<CreatorSubtitleStyleSettings>
): CreatorSubtitleStyleSettings {
  const preset = resolvePreset(input?.preset, fallbackPreset);
  const defaults = getDefaultCreatorSubtitleStyle(preset);

  return {
    preset,
    textColor: normalizeHexColor(input?.textColor, defaults.textColor),
    backgroundColor: normalizeHexColor(input?.backgroundColor, defaults.backgroundColor),
    backgroundOpacity: clampNumber(
      typeof input?.backgroundOpacity === "number" && Number.isFinite(input.backgroundOpacity)
        ? input.backgroundOpacity
        : defaults.backgroundOpacity,
      0,
      1
    ),
    backgroundRadius: clampNumber(
      typeof input?.backgroundRadius === "number" && Number.isFinite(input.backgroundRadius)
        ? input.backgroundRadius
        : defaults.backgroundRadius,
      0,
      40
    ),
    outlineColor: normalizeHexColor(input?.outlineColor, defaults.outlineColor),
    outlineWidth: clampNumber(
      typeof input?.outlineWidth === "number" && Number.isFinite(input.outlineWidth) ? input.outlineWidth : defaults.outlineWidth,
      0,
      8
    ),
    backgroundPadding: clampNumber(
      typeof input?.backgroundPadding === "number" && Number.isFinite(input.backgroundPadding)
        ? input.backgroundPadding
        : defaults.backgroundPadding,
      0,
      24
    ),
    textCase: normalizeTextCase(input?.textCase, defaults.textCase),
  };
}

export function cssRgbaFromHex(hex: string, alpha: number): string {
  const [r, g, b] = toRgb(hex);
  const clampedAlpha = clampNumber(alpha, 0, 1);
  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha.toFixed(3)})`;
}

export function ffmpegHexColorFromCss(hex: string): string {
  const normalized = normalizeHexColor(hex, "#000000");
  return `0x${normalized.slice(1)}`;
}

export function ffmpegColorWithAlpha(hex: string, alpha: number): string {
  const clampedAlpha = clampNumber(alpha, 0, 1);
  return `${ffmpegHexColorFromCss(hex)}@${clampedAlpha.toFixed(3)}`;
}

export function wrapSubtitleLines(text: string, maxCharsPerLine: number): string[] {
  const words = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (!words.length) return [];

  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    if (currentLine && (currentLine.length + 1 + word.length) > maxCharsPerLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export const COMMON_SUBTITLE_STYLE_PRESETS: CreatorSubtitleQuickStylePreset[] = [
  {
    id: "yt_classic",
    name: "YouTube Classic",
    description: "White text, dark box, balanced outline.",
    style: {
      ...getDefaultCreatorSubtitleStyle("clean_caption"),
      preset: "clean_caption",
      textCase: "original",
    },
  },
  {
    id: "reel_bold",
    name: "Reels Bold",
    description: "Big uppercase punch with stronger outline.",
    style: {
      ...getDefaultCreatorSubtitleStyle("bold_pop"),
      preset: "bold_pop",
      outlineWidth: 3.8,
      backgroundOpacity: 0.5,
      backgroundRadius: 12,
      textCase: "uppercase",
    },
  },
  {
    id: "tiktok_pop",
    name: "TikTok Pop",
    description: "Bright text with thicker dark stroke.",
    style: {
      ...getDefaultCreatorSubtitleStyle("bold_pop"),
      preset: "bold_pop",
      textColor: "#FFF3B0",
      outlineColor: "#141414",
      outlineWidth: 4.2,
      backgroundOpacity: 0.46,
      backgroundRadius: 14,
      textCase: "uppercase",
    },
  },
  {
    id: "podcast_soft",
    name: "Podcast Soft",
    description: "Lower contrast, rounded bubble look.",
    style: {
      ...getDefaultCreatorSubtitleStyle("clean_caption"),
      preset: "clean_caption",
      textColor: "#F4F7FA",
      backgroundColor: "#0F141A",
      backgroundOpacity: 0.62,
      backgroundRadius: 18,
      outlineWidth: 1.2,
      textCase: "original",
    },
  },
  {
    id: "minimal_clear",
    name: "Minimal Clear",
    description: "No box, mostly outline only.",
    style: {
      ...getDefaultCreatorSubtitleStyle("clean_caption"),
      preset: "clean_caption",
      backgroundOpacity: 0,
      backgroundPadding: 0,
      outlineWidth: 3.2,
      backgroundRadius: 0,
      textCase: "original",
    },
  },
  {
    id: "neon_creator",
    name: "Neon Creator",
    description: "Cool cyan neon style for creator edits.",
    style: {
      ...getDefaultCreatorSubtitleStyle("creator_neon"),
      preset: "creator_neon",
      backgroundRadius: 12,
      outlineWidth: 3.6,
      textCase: "original",
    },
  },
];
