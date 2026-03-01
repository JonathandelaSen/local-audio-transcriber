import test from "node:test";
import assert from "node:assert/strict";

import {
  markInterruptedTranscriptsAsErrored,
  updateTranscriptInHistoryItems,
  upsertTranscribingTranscriptProject,
} from "../../../src/lib/transcriber/core/history-updates";
import type { HistoryItem } from "../../../src/lib/history";

function buildHistory(): HistoryItem[] {
  return [
    {
      id: "proj_1",
      mediaId: "proj_1",
      filename: "audio.wav",
      createdAt: 1,
      updatedAt: 1,
      timestamp: 1,
      activeTranscriptVersionId: "tx_1",
      transcripts: [
        {
          id: "tx_1",
          versionNumber: 1,
          label: "Transcript v1",
          status: "transcribing",
          createdAt: 1,
          updatedAt: 1,
          requestedLanguage: "en",
          subtitles: [],
        },
      ],
    },
  ];
}

test("markInterruptedTranscriptsAsErrored converts transcribing transcripts to error", () => {
  const updated = markInterruptedTranscriptsAsErrored(buildHistory(), {
    now: 500,
    message: "Interrupted",
  });

  assert.equal(updated[0].transcripts[0].status, "error");
  assert.equal(updated[0].transcripts[0].error, "Interrupted");
  assert.equal(updated[0].updatedAt, 500);
  assert.equal(updated[0].timestamp, 500);
});

test("markInterruptedTranscriptsAsErrored preserves explicit transcript errors", () => {
  const history = buildHistory();
  history[0].transcripts[0].error = "Already failed";

  const updated = markInterruptedTranscriptsAsErrored(history, {
    now: 500,
    message: "Interrupted",
  });

  assert.equal(updated[0].transcripts[0].status, "error");
  assert.equal(updated[0].transcripts[0].error, "Already failed");
});

test("updateTranscriptInHistoryItems updates only target transcript and project timestamps", () => {
  const updated = updateTranscriptInHistoryItems(buildHistory(), {
    projectId: "proj_1",
    transcriptVersionId: "tx_1",
    now: 700,
    updater: (tx) => ({
      ...tx,
      status: "completed",
      transcript: "hello",
      updatedAt: 700,
    }),
  });

  assert.equal(updated[0].transcripts[0].status, "completed");
  assert.equal(updated[0].transcripts[0].transcript, "hello");
  assert.equal(updated[0].updatedAt, 700);
  assert.equal(updated[0].activeTranscriptVersionId, "tx_1");
});

test("updateTranscriptInHistoryItems leaves non-target projects untouched", () => {
  const base = buildHistory();
  const otherProject: HistoryItem = {
    id: "proj_2",
    mediaId: "proj_2",
    filename: "audio_2.wav",
    createdAt: 2,
    updatedAt: 2,
    timestamp: 2,
    activeTranscriptVersionId: "tx_9",
    transcripts: [
      {
        id: "tx_9",
        versionNumber: 1,
        label: "Transcript v1",
        status: "completed",
        createdAt: 2,
        updatedAt: 2,
        requestedLanguage: "en",
        subtitles: [],
        transcript: "stable",
      },
    ],
  };
  const history = [base[0], otherProject];

  const updated = updateTranscriptInHistoryItems(history, {
    projectId: "proj_1",
    transcriptVersionId: "tx_1",
    now: 800,
    updater: (tx) => ({ ...tx, status: "completed", updatedAt: 800 }),
  });

  assert.equal(updated[0].updatedAt, 800);
  assert.equal(updated[1], otherProject);
  assert.equal(updated[1].transcripts[0].transcript, "stable");
});

test("updateTranscriptInHistoryItems returns original project when transcript id is missing", () => {
  const history = buildHistory();
  const originalProjectRef = history[0];

  const updated = updateTranscriptInHistoryItems(history, {
    projectId: "proj_1",
    transcriptVersionId: "tx_missing",
    now: 900,
    updater: (tx) => ({ ...tx, status: "completed", updatedAt: 900 }),
  });

  assert.equal(updated[0], originalProjectRef);
  assert.equal(updated[0].updatedAt, 1);
  assert.equal(updated[0].transcripts[0].status, "transcribing");
});

test("upsertTranscribingTranscriptProject appends transcript version to existing project", () => {
  const updated = upsertTranscribingTranscriptProject(buildHistory(), {
    now: 1000,
    projectId: "proj_1",
    transcriptVersionId: "tx_2",
    fileName: "audio.wav",
    requestedLanguage: "es",
  });

  assert.equal(updated.length, 1);
  assert.equal(updated[0].transcripts.length, 2);
  assert.equal(updated[0].transcripts[1].id, "tx_2");
  assert.equal(updated[0].transcripts[1].requestedLanguage, "es");
  assert.equal(updated[0].activeTranscriptVersionId, "tx_2");
});

test("upsertTranscribingTranscriptProject keeps existing filename when appending", () => {
  const history = buildHistory();
  history[0].filename = "keep-me.wav";

  const updated = upsertTranscribingTranscriptProject(history, {
    now: 1100,
    projectId: "proj_1",
    transcriptVersionId: "tx_3",
    fileName: "new-name.wav",
    requestedLanguage: "de",
  });

  assert.equal(updated[0].filename, "keep-me.wav");
  assert.equal(updated[0].activeTranscriptVersionId, "tx_3");
});

test("upsertTranscribingTranscriptProject creates a new project when missing", () => {
  const updated = upsertTranscribingTranscriptProject([], {
    now: 2000,
    projectId: "proj_9",
    transcriptVersionId: "tx_1",
    fileName: "new.wav",
    requestedLanguage: "fr",
  });

  assert.equal(updated.length, 1);
  assert.equal(updated[0].id, "proj_9");
  assert.equal(updated[0].mediaId, "proj_9");
  assert.equal(updated[0].filename, "new.wav");
  assert.equal(updated[0].transcripts[0].status, "transcribing");
  assert.equal(updated[0].transcripts[0].requestedLanguage, "fr");
});
