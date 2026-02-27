export interface PreviewViewportSize {
  width: number;
  height: number;
}

export interface PreviewVideoRectSize {
  width: number;
  height: number;
}

export interface ExportGeometryEditorLike {
  zoom: number;
  panX: number;
  panY: number;
}

export interface ShortExportGeometryInput {
  sourceWidth: number;
  sourceHeight: number;
  editor: ExportGeometryEditorLike;
  previewViewport?: PreviewViewportSize | null;
  previewVideoRect?: PreviewVideoRectSize | null;
  outputWidth?: number;
  outputHeight?: number;
}

export interface ShortExportGeometryResult {
  filter: string;
  cropX: number;
  cropY: number;
  scaledWidth: number;
  scaledHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  padX: number;
  padY: number;
  outputWidth: number;
  outputHeight: number;
  usedPreviewVideoRect: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildShortExportGeometry(input: ShortExportGeometryInput): ShortExportGeometryResult {
  const outputWidth = Math.max(1, Math.round(input.outputWidth ?? 1080));
  const outputHeight = Math.max(1, Math.round(input.outputHeight ?? 1920));

  const viewportWidth = Math.max(1, input.previewViewport?.width ?? 320);
  const viewportHeight = Math.max(1, input.previewViewport?.height ?? (viewportWidth * 16) / 9);

  const previewRectWidth = Number(input.previewVideoRect?.width);
  const previewRectHeight = Number(input.previewVideoRect?.height);
  const usedPreviewVideoRect =
    Number.isFinite(previewRectWidth) &&
    Number.isFinite(previewRectHeight) &&
    previewRectWidth > 0 &&
    previewRectHeight > 0;

  const safeSourceWidth = Math.max(1, input.sourceWidth);
  const safeSourceHeight = Math.max(1, input.sourceHeight);
  const baseScale = Math.min(outputWidth / safeSourceWidth, outputHeight / safeSourceHeight);
  const scaleFactor = baseScale * Math.max(0.2, input.editor.zoom || 1);

  const fallbackScaledWidth = Math.max(1, Math.round(safeSourceWidth * scaleFactor));
  const fallbackScaledHeight = Math.max(1, Math.round(safeSourceHeight * scaleFactor));
  const scaledWidth = usedPreviewVideoRect ? Math.max(1, Math.round((previewRectWidth / viewportWidth) * outputWidth)) : fallbackScaledWidth;
  const scaledHeight = usedPreviewVideoRect
    ? Math.max(1, Math.round((previewRectHeight / viewportHeight) * outputHeight))
    : fallbackScaledHeight;

  const panXOut = (input.editor.panX / viewportWidth) * outputWidth;
  const panYOut = (input.editor.panY / viewportHeight) * outputHeight;

  const canvasWidth = Math.max(outputWidth, scaledWidth);
  const canvasHeight = Math.max(outputHeight, scaledHeight);

  const padX = Math.round(
    clamp(
      (canvasWidth - scaledWidth) / 2 + (scaledWidth < outputWidth ? panXOut : 0),
      0,
      Math.max(0, canvasWidth - scaledWidth)
    )
  );
  const padY = Math.round(
    clamp(
      (canvasHeight - scaledHeight) / 2 + (scaledHeight < outputHeight ? panYOut : 0),
      0,
      Math.max(0, canvasHeight - scaledHeight)
    )
  );

  const centerCropX = (canvasWidth - outputWidth) / 2;
  const centerCropY = (canvasHeight - outputHeight) / 2;
  const cropX = Math.round(
    clamp(
      centerCropX - (scaledWidth >= outputWidth ? panXOut : 0),
      0,
      Math.max(0, canvasWidth - outputWidth)
    )
  );
  const cropY = Math.round(
    clamp(
      centerCropY - (scaledHeight >= outputHeight ? panYOut : 0),
      0,
      Math.max(0, canvasHeight - outputHeight)
    )
  );

  const filters = [`scale=${scaledWidth}:${scaledHeight}`];
  if (canvasWidth !== scaledWidth || canvasHeight !== scaledHeight) {
    filters.push(`pad=${canvasWidth}:${canvasHeight}:${padX}:${padY}:black`);
  }
  filters.push(`crop=${outputWidth}:${outputHeight}:${cropX}:${cropY}`);
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
    outputWidth,
    outputHeight,
    usedPreviewVideoRect,
  };
}

