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

const DEFAULT_SUBTITLE_STYLE_BY_PRESET: Record<SubtitleStylePreset, Omit<CreatorSubtitleStyleSettings, "preset">> = {
  bold_pop: {
    textColor: "#FFFFFF",
    backgroundColor: "#000000",
    backgroundOpacity: 0.43,
    outlineColor: "#0A0A0A",
    outlineWidth: 3,
    backgroundPadding: 8,
    textCase: "uppercase",
  },
  clean_caption: {
    textColor: "#FFFFFF",
    backgroundColor: "#000000",
    backgroundOpacity: 0.35,
    outlineColor: "#323232",
    outlineWidth: 3,
    backgroundPadding: 8,
    textCase: "original",
  },
  creator_neon: {
    textColor: "#E8F7FF",
    backgroundColor: "#000000",
    backgroundOpacity: 0.47,
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
