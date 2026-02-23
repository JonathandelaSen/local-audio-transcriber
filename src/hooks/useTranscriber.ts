import { useState, useEffect, useRef, useCallback } from "react";

export interface TranscriberProgress {
  file: string;
  name: string;
  progress: number;
  status: string;
}

export interface HistoryItem {
  id: string;
  filename: string;
  status: "transcribing" | "completed" | "error" | "stopped";
  transcript?: string;
  chunks?: any[];
  error?: string;
  timestamp: number;
}

export function useTranscriber() {
  const [transcript, setTranscript] = useState<string>("");
  const [chunks, setChunks] = useState<any[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [progressItems, setProgressItems] = useState<TranscriberProgress[]>([]);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [debugLog, setDebugLog] = useState<string>("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  const currentFileIdRef = useRef<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const initializedStorage = useRef(false);

  // Load history from localStorage on mount
  useEffect(() => {
    if (!initializedStorage.current) {
      try {
        const stored = localStorage.getItem("transcriberHistory");
        if (stored) {
          const parsed = JSON.parse(stored);
          // Only keep valid items, mark transcribing as error if page reloaded
          const cleanedHistory = parsed.map((item: HistoryItem) => {
            if (item.status === "transcribing") {
               return { ...item, status: "error", error: "Interrupted by page reload" };
            }
            return item;
          });
          setHistory(cleanedHistory);
        }
      } catch (e) {
        console.error("Failed to load history", e);
      }
      initializedStorage.current = true;
    }
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (initializedStorage.current) {
       try {
           localStorage.setItem("transcriberHistory", JSON.stringify(history));
       } catch(e) {
           console.error("Failed to save history", e);
       }
    }
  }, [history]);

  // Helper to safely append logs if enabled
  const appendLog = useCallback((message: string) => {
    if (process.env.NEXT_PUBLIC_ENABLE_LOGS === "true") {
      setDebugLog((prev) => prev ? `${prev}\n${message}` : message);
    }
  }, []);

  const initWorker = useCallback(() => {
    if (worker.current) return;
    
    worker.current = new Worker(new URL("../lib/worker.ts", import.meta.url), {
      type: "module",
    });

    worker.current.addEventListener("message", (e) => {
      const { status, data, output, error, chunk, duration } = e.data;
      const activeId = currentFileIdRef.current;

      switch (status) {
        case "progress":
          if (data && data.name) {
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
          appendLog(`READY: Model loaded`);
          setProgressItems([]); // Loading complete
          break;
        case "info":
          appendLog(`INFO: ${e.data.message}`);
          break;
        case "chunk_progress":
          setAudioProgress(e.data.progress);
          break;
        case "chunk":
        case "update":
          // Transformers.js sends partial results in arrays sometimes
          const currentOutput = output && output[0] ? output[0] : output;
          appendLog(`UPDATE: ${JSON.stringify(currentOutput).substring(0, 100)}`);
          if (currentOutput && currentOutput.text) {
              setTranscript(currentOutput.text);
              setChunks(currentOutput.chunks || []);
              
              setHistory(prev => prev.map(item => 
                 item.id === activeId ? { ...item, transcript: currentOutput.text, chunks: currentOutput.chunks || [] } : item
              ));
          }
          if (duration && currentOutput && currentOutput.chunks && currentOutput.chunks.length > 0) {
            const lastChunk = currentOutput.chunks[currentOutput.chunks.length - 1];
            if (lastChunk.timestamp && lastChunk.timestamp[1] !== null) {
                setAudioProgress(Math.min(100, Math.round((lastChunk.timestamp[1] / duration) * 100)));
            }
          }
          break;
        case "complete":
          appendLog(`COMPLETE: ${JSON.stringify(output).substring(0, 100)}`);
          setIsBusy(false);
          setAudioProgress(100);
          if (output && output.text) {
            setTranscript(output.text);
            setChunks(output.chunks || []);
            
            setHistory(prev => prev.map(item => 
              item.id === activeId ? { ...item, status: "completed", transcript: output.text, chunks: output.chunks || [] } : item
            ));
          } else {
            setHistory(prev => prev.map(item => 
              item.id === activeId ? { ...item, status: "completed" } : item
            ));
          }
          currentFileIdRef.current = null;
          break;
        case "error":
          appendLog(`ERROR: ${error}`);
          setIsBusy(false);
          console.error("Worker error:", error);
          setHistory(prev => prev.map(item => 
            item.id === activeId ? { ...item, status: "error", error: error } : item
          ));
          currentFileIdRef.current = null;
          break;
      }
    });
  }, []);

  useEffect(() => {
    initWorker();
    return () => {
      // Disabling auto-termination on unmount as React StrictMode mounts/unmounts twice
      // and we don't want to kill the worker that's loading ~70MB of models.
      // worker.current?.terminate();
    };
  }, [initWorker]);

  const transcribe = (audioData: Float32Array, filename: string, language: string = "auto") => {
    // Re-init worker if it was terminated by stopTranscription
    initWorker();
    
    setIsBusy(true);
    setTranscript("");
    setChunks([]);
    setAudioProgress(0);
    setProgressItems([]);
    setDebugLog("");
    appendLog("Starting...");
    
    const id = Date.now().toString();
    currentFileIdRef.current = id;
    
    setHistory(prev => [{
      id,
      filename,
      status: "transcribing",
      timestamp: Date.now()
    }, ...prev]);

    const duration = audioData.length / 16000;
    worker.current?.postMessage({
      type: "transcribe",
      audio: audioData,
      duration,
      language
    });
  };

  const stopTranscription = () => {
    if (worker.current) {
      worker.current.terminate();
      worker.current = null;
    }
    const activeId = currentFileIdRef.current;
    
    setIsBusy(false);
    setProgressItems([]);
    appendLog("STOPPED by user.");
    
    setHistory(prev => prev.map(item => 
      item.id === activeId ? { ...item, status: "stopped" } : item
    ));
    currentFileIdRef.current = null;
  };

  const deleteHistoryItem = (id: string) => {
      setHistory(prev => prev.filter(item => item.id !== id));
  };

  return { transcript, chunks, audioProgress, isBusy, progressItems, history, debugLog, transcribe, stopTranscription, deleteHistoryItem };
}
