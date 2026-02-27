import test from "node:test";
import assert from "node:assert/strict";

import { buildShortExportGeometry } from "../../../src/lib/creator/core/export-geometry";

const sourceLandscape = { sourceWidth: 1920, sourceHeight: 1080 };

test("buildShortExportGeometry uses previewVideoRect to match preview cover framing", () => {
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

test("buildShortExportGeometry falls back to source+zoom math when preview rect is unavailable", () => {
  const geometry = buildShortExportGeometry({
    ...sourceLandscape,
    editor: { zoom: 1, panX: 0, panY: 0 },
    previewViewport: { width: 400, height: 800 },
  });

  assert.equal(geometry.usedPreviewVideoRect, false);
  assert.equal(geometry.scaledWidth, 1080);
  assert.equal(geometry.scaledHeight, 608);
  assert.ok(geometry.filter.includes("scale=1080:608"));
  assert.ok(geometry.filter.includes("pad=1080:1920:0:656:black"));
});

