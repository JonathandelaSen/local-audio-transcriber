"use client";

import { useState } from "react";
import { DragDropZone } from "@/components/DragDropZone";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { TranscriptionResult } from "@/components/TranscriptionResult";
import { useTranscriber } from "@/hooks/useTranscriber";
import { decodeAudio } from "@/lib/audio";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { AudioLines } from "lucide-react";

export default function Home() {
  const { transcript, chunks, audioProgress, isBusy, progressItems, debugLog, transcribe } = useTranscriber();

  const handleFileSelect = async (file: File) => {
    try {
      if (!file.type.includes("audio") && !file.name.match(/\.(m4a|mp3|wav|ogg|flac)$/i)) {
        throw new Error("Please select a valid audio file (.m4a, .mp3, .wav)");
      }
      
      const audioData = await decodeAudio(file);
      transcribe(audioData);
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
          <div className="inline-flex items-center justify-center p-5 rounded-[2rem] bg-white/[0.03] border border-white/10 backdrop-blur-2xl mb-2 shadow-2xl relative group">
            <div className="absolute inset-0 bg-violet-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <AudioLines className="w-12 h-12 text-violet-400 relative z-10" />
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white/80 to-white/20 drop-shadow-sm">
            Neural Whisper
          </h1>
          <p className="text-xl md:text-2xl text-white/40 font-light max-w-2xl mx-auto tracking-wide">
            100% private, browser-native translation for <span className="text-violet-300/80 font-medium">Spanish audio</span> via WebGPU.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-10">
          <DragDropZone onFileSelect={handleFileSelect} disabled={isBusy} />
          
          <div className="space-y-10">
            <ProgressIndicator progressItems={progressItems} />
            <TranscriptionResult transcript={transcript} chunks={chunks} audioProgress={audioProgress} isBusy={isBusy} />
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
