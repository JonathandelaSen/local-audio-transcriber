"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { useTranscriber } from "@/hooks/useTranscriber";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";
import { HistoryItemCard } from "@/components/HistoryItemCard";
import { Toaster } from "@/components/ui/sonner";

export default function HistoryPage() {
  const {
    history,
    deleteHistoryItem,
    renameHistoryItem,
    saveTranslation,
    createShiftedSubtitleVersion,
    transcribe,
  } = useTranscriber();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleRetranscribe = async (projectId: string, language: string) => {
    try {
      const record = await db.mediaFiles.get(projectId);
      const item = history.find((entry) => entry.id === projectId);

      if (record?.file && item) {
        const audioData = await import("@/lib/audio").then((m) => m.decodeAudio(record.file));
        transcribe(audioData, record.file, language, { projectId });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e) {
      console.error("Failed to re-transcribe", e);
    }
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen w-full relative flex flex-col items-center py-20 px-4 sm:px-6 lg:px-8">
      <div className="fixed top-[15%] left-[20%] w-[30rem] h-[30rem] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[10%] right-[10%] w-[40rem] h-[40rem] bg-fuchsia-600/10 rounded-full blur-[160px] pointer-events-none" />

      <div className="w-full max-w-5xl z-10 space-y-10 mt-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-in fade-in slide-in-from-left-4 duration-700">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" className="rounded-full w-12 h-12 p-0 bg-white/5 hover:bg-white/10">
                <ArrowLeft className="w-6 h-6 text-white/70" />
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-white/90">Versioned Transcript History</h1>
              <p className="text-white/40 mt-1">
                Each file keeps multiple transcript versions, and each transcript keeps its own subtitle versions.
              </p>
            </div>
          </div>
          <Link href="/creator">
            <Button variant="outline" className="rounded-full bg-cyan-400/10 border-cyan-300/20 text-cyan-100 hover:text-white hover:bg-cyan-300/15">
              <Sparkles className="w-4 h-4 mr-2" />
              Creator Tools
            </Button>
          </Link>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-20 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-md">
            <FileText className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-white/60">No history found</h2>
            <p className="text-white/40 mt-2">Transcribe some audio or video files to build your version history.</p>
            <Link href="/">
              <Button className="mt-6 bg-violet-600 hover:bg-violet-700 text-white border-0">Start Transcribing</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {history.map((item) => (
              <HistoryItemCard
                key={item.id}
                item={item}
                onDelete={deleteHistoryItem}
                onCreateShiftedSubtitleVersion={createShiftedSubtitleVersion}
                onRename={renameHistoryItem}
                onRetranscribe={handleRetranscribe}
                onSaveTranslation={saveTranslation}
              />
            ))}
          </div>
        )}
      </div>
      <Toaster theme="dark" position="bottom-center" />
    </main>
  );
}
