"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { HistoryItem } from "@/hooks/useTranscriber";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import { HistoryItemCard } from "@/components/HistoryItemCard";

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("transcriberHistory");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch(e) {
      console.error(e);
    }
  }, []);

  const deleteItem = (id: string) => {
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    localStorage.setItem("transcriberHistory", JSON.stringify(updated));
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen w-full relative flex flex-col items-center py-20 px-4 sm:px-6 lg:px-8">
      {/* Decorative ambient blurred orbs */}
      <div className="fixed top-[15%] left-[20%] w-[30rem] h-[30rem] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[10%] right-[10%] w-[40rem] h-[40rem] bg-fuchsia-600/10 rounded-full blur-[160px] pointer-events-none" />

      <div className="w-full max-w-4xl z-10 space-y-10 mt-10">
        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-4 duration-700">
           <Link href="/">
             <Button variant="ghost" className="rounded-full w-12 h-12 p-0 bg-white/5 hover:bg-white/10">
                <ArrowLeft className="w-6 h-6 text-white/70" />
             </Button>
           </Link>
           <div>
             <h1 className="text-4xl font-bold tracking-tight text-white/90">Transcription History</h1>
             <p className="text-white/40 mt-1">Review, download, or manage your past transcriptions.</p>
           </div>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-20 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-md">
             <FileText className="w-16 h-16 text-white/20 mx-auto mb-4" />
             <h2 className="text-xl font-medium text-white/60">No history found</h2>
             <p className="text-white/40 mt-2">Transcribe some audio files to see them here.</p>
             <Link href="/">
               <Button className="mt-6 bg-violet-600 hover:bg-violet-700 text-white border-0">
                 Start Transcribing
               </Button>
             </Link>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {history.map((item) => (
               <HistoryItemCard key={item.id} item={item} onDelete={deleteItem} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
