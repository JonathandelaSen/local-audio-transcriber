import type { ShortExportGeometryResult } from "@/lib/creator/core/export-geometry";

export interface ExportInvariantCheckResult {
  ok: boolean;
  violations: string[];
  metrics: {
    sourceAspectRatio: number;
    scaledAspectRatio: number;
    aspectRatioDeltaPct: number;
    scaleX: number;
    scaleY: number;
    scaleDeltaPct: number;
  };
}

export interface ExportGeometryInvariantInput {
  sourceWidth: number;
  sourceHeight: number;
  geometry: ShortExportGeometryResult;
  expectedOutputWidth?: number;
  expectedOutputHeight?: number;
  maxScaleDeltaPct?: number;
  maxAspectRatioDeltaPct?: number;
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function ratioDeltaPct(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b) / Math.max(a, b) * 100;
}

export function checkExportGeometryInvariants(input: ExportGeometryInvariantInput): ExportInvariantCheckResult {
  const expectedOutputWidth = Math.max(1, Math.round(input.expectedOutputWidth ?? 1080));
  const expectedOutputHeight = Math.max(1, Math.round(input.expectedOutputHeight ?? 1920));
  const maxScaleDeltaPct = Math.max(0, input.maxScaleDeltaPct ?? 1.5);
  const maxAspectRatioDeltaPct = Math.max(0, input.maxAspectRatioDeltaPct ?? 1.5);

  const violations: string[] = [];
  const safeSourceWidth = Math.max(1, input.sourceWidth);
  const safeSourceHeight = Math.max(1, input.sourceHeight);
  const safeScaledWidth = Math.max(1, input.geometry.scaledWidth);
  const safeScaledHeight = Math.max(1, input.geometry.scaledHeight);

  if (input.geometry.outputWidth !== expectedOutputWidth || input.geometry.outputHeight !== expectedOutputHeight) {
    violations.push(
      `Output resolution mismatch: expected ${expectedOutputWidth}x${expectedOutputHeight}, got ${input.geometry.outputWidth}x${input.geometry.outputHeight}.`
    );
  }

  const scaleX = safeScaledWidth / safeSourceWidth;
  const scaleY = safeScaledHeight / safeSourceHeight;
  const sourceAspectRatio = safeSourceWidth / safeSourceHeight;
  const scaledAspectRatio = safeScaledWidth / safeScaledHeight;
  const scaleDeltaPct = ratioDeltaPct(scaleX, scaleY);
  const aspectRatioDeltaPct = ratioDeltaPct(sourceAspectRatio, scaledAspectRatio);

  if (scaleDeltaPct > maxScaleDeltaPct) {
    violations.push(
      `Non-uniform scaling detected: scaleX=${scaleX.toFixed(4)}, scaleY=${scaleY.toFixed(4)}, delta=${scaleDeltaPct.toFixed(3)}% (max ${maxScaleDeltaPct.toFixed(3)}%).`
    );
  }

  if (aspectRatioDeltaPct > maxAspectRatioDeltaPct) {
    violations.push(
      `Aspect ratio drift detected: source=${sourceAspectRatio.toFixed(6)}, scaled=${scaledAspectRatio.toFixed(6)}, delta=${aspectRatioDeltaPct.toFixed(3)}% (max ${maxAspectRatioDeltaPct.toFixed(3)}%).`
    );
  }

  return {
    ok: violations.length === 0,
    violations,
    metrics: {
      sourceAspectRatio: round4(sourceAspectRatio),
      scaledAspectRatio: round4(scaledAspectRatio),
      aspectRatioDeltaPct: round4(aspectRatioDeltaPct),
      scaleX: round4(scaleX),
      scaleY: round4(scaleY),
      scaleDeltaPct: round4(scaleDeltaPct),
    },
  };
}

export function assertExportGeometryInvariants(
  input: ExportGeometryInvariantInput,
  options?: { contextLabel?: string }
): ExportInvariantCheckResult {
  const result = checkExportGeometryInvariants(input);
  if (result.ok) return result;

  const label = options?.contextLabel ? `[${options.contextLabel}] ` : "";
  const detail = [
    `${label}Export geometry invariant violation.`,
    ...result.violations,
    `metrics=${JSON.stringify(result.metrics)}`,
  ].join("\n");
  throw new Error(detail);
}
