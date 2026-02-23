import { useState, useEffect, useRef } from "react";

export interface TranscriberProgress {
  file: string;
  name: string;
  progress: number;
  status: string;
}

export function useTranscriber() {
  const [transcript, setTranscript] = useState<string>("");
  const [chunks, setChunks] = useState<any[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [progressItems, setProgressItems] = useState<TranscriberProgress[]>([]);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [debugLog, setDebugLog] = useState<string>("");
  const worker = useRef<Worker | null>(null);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(new URL("../lib/worker.ts", import.meta.url), {
        type: "module",
      });

      worker.current.addEventListener("message", (e) => {
        const { status, data, output, error, chunk, duration } = e.data;

        switch (status) {
          case "progress":
            if (data && data.name) {
               setDebugLog((prev) => `${prev}\nPROGRESS: ${data.name} ${Math.round(data.progress || 0)}%`);
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
            setDebugLog((prev) => `${prev}\nREADY: Model loaded`);
            setProgressItems([]); // Loading complete
            break;
          case "info":
            setDebugLog((prev) => `${prev}\nINFO: ${e.data.message}`);
            break;
          case "chunk_progress":
            setAudioProgress(e.data.progress);
            break;
          case "chunk":
          case "update":
            // Transformers.js sends partial results in arrays sometimes
            const currentOutput = output && output[0] ? output[0] : output;
            setDebugLog((prev) => prev + `\nUPDATE: ${JSON.stringify(currentOutput).substring(0, 100)}`);
            if (currentOutput && currentOutput.text) {
                setTranscript(currentOutput.text);
                setChunks(currentOutput.chunks || []);
            }
            if (duration && currentOutput && currentOutput.chunks && currentOutput.chunks.length > 0) {
              const lastChunk = currentOutput.chunks[currentOutput.chunks.length - 1];
              if (lastChunk.timestamp && lastChunk.timestamp[1] !== null) {
                  setAudioProgress(Math.min(100, Math.round((lastChunk.timestamp[1] / duration) * 100)));
              }
            }
            break;
          case "complete":
            setDebugLog((prev) => prev + `\nCOMPLETE: ${JSON.stringify(output).substring(0, 100)}`);
            setIsBusy(false);
            setAudioProgress(100);
            if (output && output.text) {
              setTranscript(output.text);
              setChunks(output.chunks || []);
            }
            break;
          case "error":
            setDebugLog((prev) => prev + `\nERROR: ${error}`);
            setIsBusy(false);
            console.error("Worker error:", error);
            break;
        }
      });
    }

    return () => {
      // Disabling auto-termination on unmount as React StrictMode mounts/unmounts twice
      // and we don't want to kill the worker that's loading ~70MB of models.
      // worker.current?.terminate();
    };
  }, []);

  const transcribe = (audioData: Float32Array) => {
    setIsBusy(true);
    setTranscript("");
    setChunks([]);
    setAudioProgress(0);
    setDebugLog("Starting...");
    const duration = audioData.length / 16000;
    worker.current?.postMessage({
      type: "transcribe",
      audio: audioData,
      duration,
    });
  };

  return { transcript, chunks, audioProgress, isBusy, progressItems, debugLog, transcribe };
}
