import type { CreatorViralClip } from "@/lib/creator/types";
import type { SubtitleChunk } from "@/lib/history";

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clipSubtitleChunks(clip: CreatorViralClip, chunks: SubtitleChunk[]): SubtitleChunk[] {
  return chunks.filter((chunk) => {
    const start = chunk.timestamp?.[0] ?? 0;
    const end = chunk.timestamp?.[1] ?? start;
    return start < clip.endSeconds && end > clip.startSeconds;
  });
}

export function clampClipToMediaDuration(clip: CreatorViralClip, mediaDurationSeconds: number): CreatorViralClip {
  const safeDuration = Number.isFinite(mediaDurationSeconds) ? mediaDurationSeconds : 0;
  if (safeDuration <= 0) return clip;

  const minClipDuration = 0.5;
  const rawDuration =
    Number.isFinite(clip.durationSeconds) && clip.durationSeconds > 0
      ? clip.durationSeconds
      : Math.max(0, clip.endSeconds - clip.startSeconds);
  const targetDuration = clampNumber(rawDuration, minClipDuration, safeDuration);
  const maxStart = Math.max(0, safeDuration - targetDuration);

  let start = Number.isFinite(clip.startSeconds) ? clip.startSeconds : 0;
  start = clampNumber(start, 0, maxStart);
  let end = start + targetDuration;

  if (end > safeDuration) {
    end = safeDuration;
    start = Math.max(0, end - targetDuration);
  }
  const duration = Math.max(minClipDuration, end - start);

  return {
    ...clip,
    startSeconds: Number(start.toFixed(3)),
    endSeconds: Number(end.toFixed(3)),
    durationSeconds: Number(duration.toFixed(3)),
  };
}
