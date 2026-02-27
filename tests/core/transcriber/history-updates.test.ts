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

