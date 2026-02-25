import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "@/lib/db";
import {
  makeId,
  normalizeHistoryItem,
  shiftSubtitleChunks,
  sortHistoryItems,
  sortSubtitleVersions,
  sortTranscriptVersions,
  syncOriginalSubtitleVersion,
  type HistoryItem,
  type SubtitleChunk,
  type SubtitleVersion,
  type TranscriptVersion,
} from "@/lib/history";

export type { HistoryItem } from "@/lib/history";

export interface TranscriberProgress {
  file: string;
  name: string;
  progress: number;
  status: string;
}

type ActiveTask = {
  projectId: string;
  transcriptVersionId: string;
};

type TranscribeOptions = {
  projectId?: string;
};

export function useTranscriber() {
  const [transcript, setTranscript] = useState<string>("");
  const [chunks, setChunks] = useState<SubtitleChunk[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [progressItems, setProgressItems] = useState<TranscriberProgress[]>([]);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [debugLog, setDebugLog] = useState<string>("");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const currentTaskRef = useRef<ActiveTask | null>(null);
  const worker = useRef<Worker | null>(null);
  const initializedStorage = useRef(false);

  const mutateHistory = useCallback((updater: (prev: HistoryItem[]) => HistoryItem[]) => {
    setHistory((prev) => sortHistoryItems(updater(prev)));
  }, []);

  const updateTranscriptInHistory = useCallback(
    (projectId: string, transcriptVersionId: string, updater: (transcript: TranscriptVersion) => TranscriptVersion) => {
      mutateHistory((prev) =>
        prev.map((project) => {
          if (project.id !== projectId) return project;

          let changed = false;
          const transcripts = project.transcripts.map((tx) => {
            if (tx.id !== transcriptVersionId) return tx;
            changed = true;
            return updater(tx);
          });

          if (!changed) return project;

          const now = Date.now();
          return {
            ...project,
            transcripts: sortTranscriptVersions(transcripts),
            activeTranscriptVersionId: transcriptVersionId,
            updatedAt: now,
            timestamp: now,
          };
        })
      );
    },
    [mutateHistory]
  );

  const appendLog = useCallback((message: string) => {
    if (process.env.NEXT_PUBLIC_ENABLE_LOGS === "true") {
      setDebugLog((prev) => (prev ? `${prev}\n${message}` : message));
    }
  }, []);

  useEffect(() => {
    if (initializedStorage.current) return;

    db.history
      .orderBy("timestamp")
      .reverse()
      .toArray()
      .then((stored) => {
        const normalized = sortHistoryItems((stored || []).map(normalizeHistoryItem)).map((project) => {
          let hasInterrupted = false;
          const transcripts = project.transcripts.map((tx) => {
            if (tx.status !== "transcribing") return tx;
            hasInterrupted = true;
            return {
              ...tx,
              status: "error" as const,
              error: tx.error || "Interrupted by page reload",
              updatedAt: Date.now(),
            };
          });

          if (!hasInterrupted) return project;
          const now = Date.now();
          return {
            ...project,
            transcripts,
            updatedAt: now,
            timestamp: now,
          };
        });

        initializedStorage.current = true;
        setHistory(normalized);
      })
      .catch((e) => {
        console.error("Failed to load history from DB", e);
        initializedStorage.current = true;
      });
  }, []);

  useEffect(() => {
    if (!initializedStorage.current || history.length === 0) return;
    db.history.bulkPut(history).catch((e) => {
      console.error("Failed to save history to DB", e);
    });
  }, [history]);

  const initWorker = useCallback(() => {
    if (worker.current) return;

    worker.current = new Worker(new URL("../lib/worker.ts", import.meta.url), {
      type: "module",
    });

    worker.current.addEventListener("message", (e) => {
      const { status, data, output, error, duration } = e.data;
      const task = currentTaskRef.current;

      const updateCurrentTranscript = (updater: (tx: TranscriptVersion) => TranscriptVersion) => {
        if (!task) return;
        updateTranscriptInHistory(task.projectId, task.transcriptVersionId, updater);
      };

      switch (status) {
        case "progress":
          if (data?.name) {
            appendLog(`PROGRESS: ${data.name} ${Math.round(data.progress || 0)}%`);
          }
          setProgressItems((prev) => {
            const items = [...prev];
            const idx = items.findIndex((item) => item.file === data.file);
            if (idx !== -1) {
              items[idx] = data;
            } else {
              items.push(data);
            }
            return items;
          });
          break;
        case "ready":
          appendLog("READY: Model loaded");
          setProgressItems([]);
          break;
        case "info":
          appendLog(`INFO: ${e.data.message}`);
          break;
        case "chunk_progress":
          setAudioProgress(e.data.progress);
          break;
        case "chunk":
        case "update": {
          const currentOutput = output && output[0] ? output[0] : output;
          appendLog(`UPDATE: ${JSON.stringify(currentOutput).substring(0, 100)}`);
          if (currentOutput?.text) {
            const nextText = String(currentOutput.text);
            const nextChunks = Array.isArray(currentOutput.chunks) ? (currentOutput.chunks as SubtitleChunk[]) : [];
            setTranscript(nextText);
            setChunks(nextChunks);

            updateCurrentTranscript((tx) => {
              const now = Date.now();
              let updated: TranscriptVersion = {
                ...tx,
                transcript: nextText,
                chunks: nextChunks,
                updatedAt: now,
              };
              updated = syncOriginalSubtitleVersion(updated, {
                chunks: nextChunks,
                language: updated.detectedLanguage ?? updated.requestedLanguage,
                now,
              });
              return updated;
            });
          }
          if (duration && currentOutput?.chunks && currentOutput.chunks.length > 0) {
            const lastChunk = currentOutput.chunks[currentOutput.chunks.length - 1];
            if (lastChunk.timestamp && lastChunk.timestamp[1] !== null) {
              setAudioProgress(Math.min(100, Math.round((lastChunk.timestamp[1] / duration) * 100)));
            }
          }
          break;
        }
        case "complete": {
          appendLog(`COMPLETE: ${JSON.stringify(output).substring(0, 100)}`);
          setIsBusy(false);
          setAudioProgress(100);

          const finalOutput = output && output[0] ? output[0] : output;
          const finalText = finalOutput?.text ? String(finalOutput.text) : undefined;
          const finalChunks = Array.isArray(finalOutput?.chunks) ? (finalOutput.chunks as SubtitleChunk[]) : undefined;
          const detectedLanguage =
            (finalOutput?.language ? String(finalOutput.language) : undefined) ||
            (data?.language ? String(data.language) : undefined);

          if (finalText) setTranscript(finalText);
          if (finalChunks) setChunks(finalChunks);

          updateCurrentTranscript((tx) => {
            const now = Date.now();
            let updated: TranscriptVersion = {
              ...tx,
              status: "completed",
              transcript: finalText ?? tx.transcript,
              chunks: finalChunks ?? tx.chunks,
              detectedLanguage: detectedLanguage ?? tx.detectedLanguage ?? tx.requestedLanguage,
              error: undefined,
              updatedAt: now,
            };
            updated = syncOriginalSubtitleVersion(updated, {
              chunks: (finalChunks ?? tx.chunks ?? []) as SubtitleChunk[],
              language: updated.detectedLanguage,
              now,
            });
            return updated;
          });

          currentTaskRef.current = null;
          break;
        }
        case "error":
          appendLog(`ERROR: ${error}`);
          setIsBusy(false);
          console.error("Worker error:", error);
          updateCurrentTranscript((tx) => ({
            ...tx,
            status: "error",
            error: String(error),
            updatedAt: Date.now(),
          }));
          currentTaskRef.current = null;
          break;
      }
    });
  }, [appendLog, updateTranscriptInHistory]);

  useEffect(() => {
    initWorker();
    return () => {
      // Avoid auto-termination because StrictMode mounts twice and model loading is expensive.
    };
  }, [initWorker]);

  const transcribe = useCallback(
    (audioData: Float32Array, file: File, language: string = "", options: TranscribeOptions = {}) => {
      if (!language) {
        throw new Error("Please select the media language before transcribing.");
      }
      initWorker();

      setIsBusy(true);
      setTranscript("");
      setChunks([]);
      setAudioProgress(0);
      setProgressItems([]);
      setDebugLog("");
      appendLog("Starting...");

      const now = Date.now();
      const projectId = options.projectId || makeId("proj");
      const transcriptVersionId = makeId("tx");
      currentTaskRef.current = { projectId, transcriptVersionId };

      db.mediaFiles.put({ id: projectId, file }).catch((e) => console.error("Failed to save media file", e));

      mutateHistory((prev) => {
        let found = false;
        const next = prev.map((project) => {
          if (project.id !== projectId) return project;
          found = true;

          const nextVersionNumber =
            project.transcripts.reduce((max, tx) => Math.max(max, tx.versionNumber || 0), 0) + 1;
          const newTranscript: TranscriptVersion = {
            id: transcriptVersionId,
            versionNumber: nextVersionNumber,
            label: `Transcript v${nextVersionNumber}`,
            status: "transcribing",
            createdAt: now,
            updatedAt: now,
            requestedLanguage: language,
            subtitles: [],
          };

          return {
            ...project,
            filename: project.filename || file.name,
            updatedAt: now,
            timestamp: now,
            activeTranscriptVersionId: transcriptVersionId,
            transcripts: sortTranscriptVersions([...project.transcripts, newTranscript]),
          };
        });

        if (found) return next;

        const firstTranscript: TranscriptVersion = {
          id: transcriptVersionId,
          versionNumber: 1,
          label: "Transcript v1",
          status: "transcribing",
          createdAt: now,
          updatedAt: now,
          requestedLanguage: language,
          subtitles: [],
        };

        const newProject: HistoryItem = {
          id: projectId,
          mediaId: projectId,
          filename: file.name,
          createdAt: now,
          updatedAt: now,
          timestamp: now,
          activeTranscriptVersionId: transcriptVersionId,
          transcripts: [firstTranscript],
        };

        return [newProject, ...next];
      });

      const duration = audioData.length / 16000;
      worker.current?.postMessage({
        type: "transcribe",
        audio: audioData,
        duration,
        language,
      });
    },
    [appendLog, initWorker, mutateHistory]
  );

  const stopTranscription = useCallback(() => {
    if (worker.current) {
      worker.current.terminate();
      worker.current = null;
    }

    const task = currentTaskRef.current;
    setIsBusy(false);
    setProgressItems([]);
    appendLog("STOPPED by user.");

    if (task) {
      updateTranscriptInHistory(task.projectId, task.transcriptVersionId, (tx) => ({
        ...tx,
        status: "stopped",
        updatedAt: Date.now(),
      }));
    }

    currentTaskRef.current = null;
  }, [appendLog, updateTranscriptInHistory]);

  const deleteHistoryItem = useCallback((id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    db.history.delete(id).catch(console.error);
    db.mediaFiles.delete(id).catch(console.error);
  }, []);

  const renameHistoryItem = useCallback((id: string, newFilename: string) => {
    mutateHistory((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              filename: newFilename,
              updatedAt: Date.now(),
              timestamp: Date.now(),
            }
          : item
      )
    );
  }, [mutateHistory]);

  const createShiftedSubtitleVersion = useCallback(
    (projectId: string, transcriptVersionId: string, subtitleVersionId: string, shiftSeconds: number) => {
      let createdId: string | null = null;

      updateTranscriptInHistory(projectId, transcriptVersionId, (tx) => {
        const source = tx.subtitles.find((sub) => sub.id === subtitleVersionId);
        if (!source) return tx;

        const now = Date.now();
        const nextVersionNumber = tx.subtitles.reduce((max, sub) => Math.max(max, sub.versionNumber || 0), 0) + 1;
        const direction = shiftSeconds >= 0 ? "+" : "";
        const shifted: SubtitleVersion = {
          id: makeId("sub"),
          versionNumber: nextVersionNumber,
          label: `${source.language.toUpperCase()} shift ${direction}${shiftSeconds}s`,
          language: source.language,
          sourceLanguage: source.sourceLanguage ?? source.language,
          kind: "shifted",
          createdAt: now,
          updatedAt: now,
          shiftSeconds: Number((source.shiftSeconds + shiftSeconds).toFixed(3)),
          derivedFromSubtitleVersionId: source.id,
          chunks: shiftSubtitleChunks(source.chunks, shiftSeconds),
        };
        createdId = shifted.id;

        return {
          ...tx,
          subtitles: sortSubtitleVersions([...tx.subtitles, shifted]),
          updatedAt: now,
        };
      });

      return createdId;
    },
    [updateTranscriptInHistory]
  );

  const saveTranslation = useCallback(
    (
      projectId: string,
      transcriptVersionId: string,
      sourceSubtitleVersionId: string,
      targetLanguage: string,
      sourceLanguage: string,
      translatedChunks: SubtitleChunk[]
    ) => {
      let createdId: string | null = null;

      updateTranscriptInHistory(projectId, transcriptVersionId, (tx) => {
        const source = tx.subtitles.find((sub) => sub.id === sourceSubtitleVersionId);
        const now = Date.now();
        const nextVersionNumber = tx.subtitles.reduce((max, sub) => Math.max(max, sub.versionNumber || 0), 0) + 1;

        const translation: SubtitleVersion = {
          id: makeId("sub"),
          versionNumber: nextVersionNumber,
          label: `${targetLanguage.toUpperCase()} translation v${
            tx.subtitles.filter((sub) => sub.language === targetLanguage).length + 1
          }`,
          language: targetLanguage,
          sourceLanguage,
          kind: "translation",
          createdAt: now,
          updatedAt: now,
          shiftSeconds: source?.shiftSeconds ?? 0,
          derivedFromSubtitleVersionId: source?.id,
          chunks: translatedChunks,
        };
        createdId = translation.id;

        return {
          ...tx,
          subtitles: sortSubtitleVersions([...tx.subtitles, translation]),
          updatedAt: now,
        };
      });

      return createdId;
    },
    [updateTranscriptInHistory]
  );

  return {
    transcript,
    chunks,
    audioProgress,
    isBusy,
    progressItems,
    history,
    debugLog,
    transcribe,
    stopTranscription,
    deleteHistoryItem,
    renameHistoryItem,
    createShiftedSubtitleVersion,
    saveTranslation,
  };
}
