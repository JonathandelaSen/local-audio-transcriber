import test from "node:test";
import assert from "node:assert/strict";

import { checkExportGeometryInvariants } from "../../../src/lib/creator/core/export-contracts";
import { buildShortExportGeometry } from "../../../src/lib/creator/core/export-geometry";

const sourceLandscape = { sourceWidth: 1920, sourceHeight: 1080 };

test("buildShortExportGeometry maps previewVideoRect coordinates into export filter coordinates", () => {
  const geometry = buildShortExportGeometry({
    ...sourceLandscape,
    editor: { zoom: 1, panX: 0, panY: 0 },
    previewViewport: { width: 400, height: 800 },
    previewVideoRect: { width: 1422, height: 800 },
  });

  assert.equal(geometry.usedPreviewVideoRect, true);
  assert.equal(geometry.scaledWidth, 3839);
  assert.equal(geometry.scaledHeight, 1920);
  assert.equal(geometry.cropY, 0);
  assert.ok(geometry.filter.includes("scale=3839:1920"));
  assert.ok(!geometry.filter.includes("pad="));
  assert.ok(geometry.filter.includes("crop=1080:1920:1380:0"));
});

test("buildShortExportGeometry produces pad mode for zoom-out framing with black bars", () => {
  const geometry = buildShortExportGeometry({
    ...sourceLandscape,
    editor: { zoom: 0.5, panX: 0, panY: 0 },
    previewViewport: { width: 400, height: 800 },
    previewVideoRect: { width: 711, height: 400 },
  });

  assert.equal(geometry.usedPreviewVideoRect, true);
  assert.equal(geometry.scaledWidth, 1920);
  assert.equal(geometry.scaledHeight, 960);
  assert.equal(geometry.canvasWidth, 1920);
  assert.equal(geometry.canvasHeight, 1920);
  assert.equal(geometry.padX, 0);
  assert.equal(geometry.padY, 480);
  assert.equal(geometry.cropX, 420);
  assert.equal(geometry.cropY, 0);
  assert.ok(geometry.filter.includes("pad=1920:1920:0:480:black"));
});

test("buildShortExportGeometry maps panY into pad offset in zoom-out mode", () => {
  const centered = buildShortExportGeometry({
    ...sourceLandscape,
    editor: { zoom: 0.5, panX: 0, panY: 0 },
    previewViewport: { width: 400, height: 800 },
    previewVideoRect: { width: 711, height: 400 },
  });
  const panned = buildShortExportGeometry({
    ...sourceLandscape,
    editor: { zoom: 0.5, panX: 0, panY: 100 },
    previewViewport: { width: 400, height: 800 },
    previewVideoRect: { width: 711, height: 400 },
  });

  assert.equal(centered.padY, 480);
  assert.equal(panned.padY, 720);
  assert.equal(panned.cropY, 0);
});

type FallbackMatrixScenario = {
  name: string;
  sourceWidth: number;
  sourceHeight: number;
  editor: { zoom: number; panX: number; panY: number };
  previewViewport?: { width: number; height: number };
};

const fallbackMatrix: FallbackMatrixScenario[] = [
  {
    name: "landscape source + default zoom",
    sourceWidth: 1920,
    sourceHeight: 1080,
    editor: { zoom: 1, panX: 0, panY: 0 },
  },
  {
    name: "landscape source + zoom-out pad mode",
    sourceWidth: 1920,
    sourceHeight: 1080,
    editor: { zoom: 0.5, panX: 0, panY: 100 },
  },
  {
    name: "portrait source",
    sourceWidth: 1080,
    sourceHeight: 1920,
    editor: { zoom: 1, panX: 140, panY: -120 },
  },
  {
    name: "square source",
    sourceWidth: 1080,
    sourceHeight: 1080,
    editor: { zoom: 1.35, panX: -220, panY: 180 },
  },
  {
    name: "extreme pan/zoom boundaries",
    sourceWidth: 3840,
    sourceHeight: 2160,
    editor: { zoom: 2.5, panX: 1200, panY: -1200 },
  },
  {
    name: "explicit missing preview-rect path",
    sourceWidth: 1920,
    sourceHeight: 1080,
    editor: { zoom: 1.12, panX: 90, panY: -110 },
    previewViewport: { width: 420, height: 746 },
  },
];

for (const scenario of fallbackMatrix) {
  test(`buildShortExportGeometry keeps aspect ratio stable in fallback path: ${scenario.name}`, () => {
    const geometry = buildShortExportGeometry({
      sourceWidth: scenario.sourceWidth,
      sourceHeight: scenario.sourceHeight,
      editor: scenario.editor,
      previewViewport: scenario.previewViewport ?? null,
    });

    assert.equal(geometry.usedPreviewVideoRect, false);
    assert.equal(geometry.outputWidth, 1080);
    assert.equal(geometry.outputHeight, 1920);

    const invariants = checkExportGeometryInvariants({
      sourceWidth: scenario.sourceWidth,
      sourceHeight: scenario.sourceHeight,
      geometry,
    });

    assert.equal(invariants.ok, true);
  });
}

test("previewVideoRect path is flagged by geometry contracts when it introduces stretch", () => {
  const geometry = buildShortExportGeometry({
    ...sourceLandscape,
    editor: { zoom: 1, panX: 0, panY: 0 },
    previewViewport: { width: 400, height: 800 },
    previewVideoRect: { width: 1422, height: 800 },
  });

  const invariants = checkExportGeometryInvariants({
    ...sourceLandscape,
    geometry,
  });

  assert.equal(invariants.ok, false);
  assert.ok(invariants.violations.some((message) => /aspect ratio|non-uniform/i.test(message)));
});
