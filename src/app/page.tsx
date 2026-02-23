"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DragDropZone } from "@/components/DragDropZone";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { HistoryItemCard } from "@/components/HistoryItemCard";
import { useTranscriber } from "@/hooks/useTranscriber";
import { decodeAudio } from "@/lib/audio";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { AudioLines, StopCircle, FileAudio, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("auto");
  const { transcript, chunks, audioProgress, isBusy, progressItems, history, debugLog, transcribe, stopTranscription } = useTranscriber();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleFileSelect = async (file: File) => {
    try {
      if (!file.type.includes("audio") && !file.name.match(/\.(m4a|mp3|wav|ogg|flac)$/i)) {
        throw new Error("Please select a valid audio file (.m4a, .mp3, .wav)");
      }
      
      const audioData = await decodeAudio(file);
      transcribe(audioData, file.name, selectedLanguage);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to process audio file.", {
        className: "bg-red-500/20 border-red-500/50 text-red-100"
      });
    }
  };

  return (
    <main className="min-h-screen w-full relative flex flex-col items-center py-20 px-4 sm:px-6 lg:px-8">
      {/* Decorative ambient blurred orbs */}
      <div className="fixed top-[15%] left-[20%] w-[30rem] h-[30rem] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[10%] right-[10%] w-[40rem] h-[40rem] bg-fuchsia-600/10 rounded-full blur-[160px] pointer-events-none" />

      <div className="w-full max-w-4xl z-10 space-y-16 mt-10">
        <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="flex justify-between items-start mb-2 group">
              <div className="inline-flex items-center justify-center p-5 rounded-[2rem] bg-white/[0.03] border border-white/10 backdrop-blur-2xl shadow-2xl relative">
                <div className="absolute inset-0 bg-violet-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <AudioLines className="w-12 h-12 text-violet-400 relative z-10" />
              </div>
              
              <Link href="/history">
                 <Button variant="outline" className="rounded-full bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10">
                    <FileAudio className="w-4 h-4 mr-2" />
                    History
                 </Button>
              </Link>
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white/80 to-white/20 drop-shadow-sm">
            Neural Whisper
          </h1>
          <p className="text-xl md:text-2xl text-white/40 font-light max-w-2xl mx-auto tracking-wide">
            100% private, browser-native transcription via WebGPU.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-10">
          <div className="space-y-6">
             <DragDropZone onFileSelect={handleFileSelect} disabled={isBusy} />
             
             <div className="flex justify-center transition-opacity duration-300" style={{ opacity: isBusy ? 0.5 : 1 }}>
               <LanguageSelector 
                 value={selectedLanguage} 
                 onValueChange={setSelectedLanguage} 
                 disabled={isBusy} 
               />
             </div>
             
             {isBusy && (
               <div className="flex justify-center">
                 <Button 
                   variant="destructive" 
                   onClick={stopTranscription}
                   className="rounded-xl px-8 py-6 text-lg font-medium shadow-lg shadow-red-500/20 hover:shadow-red-500/40 transition-all hover:scale-105"
                 >
                   <StopCircle className="w-5 h-5 mr-2" />
                   Stop Transcription
                 </Button>
               </div>
             )}
          </div>
          <div className="space-y-10">
            {(progressItems.length > 0 || isBusy || transcript) && history[0] && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-4">
                  <ProgressIndicator progressItems={progressItems} />
                  <HistoryItemCard item={history[0]} audioProgress={audioProgress} autoExpand={true} />
                </div>
            )}
            {debugLog && (
               <div className="text-xs text-white/50 bg-black/50 p-4 rounded-xl max-h-40 overflow-auto whitespace-pre-wrap">
                  {debugLog}
               </div>
            )}
          </div>
        </div>
      </div>
      
      <Toaster theme="dark" position="bottom-center" />
    </main>
  );
}
