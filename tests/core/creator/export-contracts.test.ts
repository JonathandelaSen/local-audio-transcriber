import test from "node:test";
import assert from "node:assert/strict";

import {
  assertExportGeometryInvariants,
  checkExportGeometryInvariants,
} from "../../../src/lib/creator/core/export-contracts";
import { buildShortExportGeometry } from "../../../src/lib/creator/core/export-geometry";

type GeometryCase = {
  name: string;
  sourceWidth: number;
  sourceHeight: number;
  editor: { zoom: number; panX: number; panY: number };
  previewViewport?: { width: number; height: number };
  previewVideoRect?: { width: number; height: number } | null;
};

const matrixCases: GeometryCase[] = [
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
    editor: { zoom: 0.5, panX: 0, panY: 120 },
  },
  {
    name: "portrait source",
    sourceWidth: 1080,
    sourceHeight: 1920,
    editor: { zoom: 1, panX: 60, panY: -60 },
  },
  {
    name: "square source",
    sourceWidth: 1080,
    sourceHeight: 1080,
    editor: { zoom: 1.2, panX: 220, panY: -160 },
  },
  {
    name: "extreme pan/zoom bounds",
    sourceWidth: 3840,
    sourceHeight: 2160,
    editor: { zoom: 2.6, panX: 900, panY: -900 },
  },
  {
    name: "missing preview-rect safe path",
    sourceWidth: 1920,
    sourceHeight: 1080,
    editor: { zoom: 1.15, panX: 120, panY: -100 },
    previewViewport: { width: 420, height: 746 },
    previewVideoRect: null,
  },
];

for (const item of matrixCases) {
  test(`checkExportGeometryInvariants passes for ${item.name}`, () => {
    const geometry = buildShortExportGeometry({
      sourceWidth: item.sourceWidth,
      sourceHeight: item.sourceHeight,
      editor: item.editor,
      previewViewport: item.previewViewport ?? null,
      previewVideoRect: item.previewVideoRect ?? null,
    });

    const result = checkExportGeometryInvariants({
      sourceWidth: item.sourceWidth,
      sourceHeight: item.sourceHeight,
      geometry,
    });

    assert.equal(result.ok, true);
    assert.equal(geometry.outputWidth, 1080);
    assert.equal(geometry.outputHeight, 1920);
  });
}

test("checkExportGeometryInvariants detects stretch-inducing geometry", () => {
  const stretchedGeometry = buildShortExportGeometry({
    sourceWidth: 1920,
    sourceHeight: 1080,
    editor: { zoom: 1, panX: 0, panY: 0 },
    previewViewport: { width: 400, height: 800 },
    previewVideoRect: { width: 1422, height: 800 },
  });

  const result = checkExportGeometryInvariants({
    sourceWidth: 1920,
    sourceHeight: 1080,
    geometry: stretchedGeometry,
  });

  assert.equal(result.ok, false);
  assert.ok(result.violations.some((message) => /aspect ratio|non-uniform/i.test(message)));
});

test("assertExportGeometryInvariants throws on stretch-inducing geometry", () => {
  const stretchedGeometry = buildShortExportGeometry({
    sourceWidth: 1920,
    sourceHeight: 1080,
    editor: { zoom: 1, panX: 0, panY: 0 },
    previewViewport: { width: 400, height: 800 },
    previewVideoRect: { width: 1422, height: 800 },
  });

  assert.throws(
    () =>
      assertExportGeometryInvariants(
        {
          sourceWidth: 1920,
          sourceHeight: 1080,
          geometry: stretchedGeometry,
        },
        { contextLabel: "test-case" }
      ),
    /invariant violation/i
  );
});
