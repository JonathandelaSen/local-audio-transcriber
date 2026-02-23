"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatTime, generateSrt } from "@/lib/srt";
import { HistoryItem } from "@/hooks/useTranscriber";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, FileText, Download, Clock, CheckCircle2, AlertCircle, MessageSquare } from "lucide-react";

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [expandedTextFileId, setExpandedTextFileId] = useState<string | null>(null);
  const [expandedChunksFileId, setExpandedChunksFileId] = useState<string | null>(null);

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

  const downloadFile = (content: string, filename: string, extension: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript_${filename.replace(/\.[^/.]+$/, "")}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
              <div key={item.id} className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-md transition-colors hover:bg-white/[0.04]">
                 <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6">
                    <div className="space-y-2 flex-1">
                       <h3 className="text-2xl font-semibold text-white/90 break-all">{item.filename}</h3>
                       <div className="flex flex-wrap items-center gap-4 text-sm">
                          <span className="flex items-center text-white/50">
                             <Clock className="w-4 h-4 mr-1.5" />
                             {new Date(item.timestamp).toLocaleString(undefined, {
                                dateStyle: "medium",
                                timeStyle: "short"
                             })}
                          </span>
                          {item.status === "completed" && <span className="flex items-center text-emerald-400"><CheckCircle2 className="w-4 h-4 mr-1.5"/> Completed</span>}
                          {item.status === "stopped" && <span className="flex items-center text-amber-400"><AlertCircle className="w-4 h-4 mr-1.5"/> Stopped</span>}
                          {item.status === "error" && <span className="flex items-center text-red-400"><AlertCircle className="w-4 h-4 mr-1.5"/> Error</span>}
                       </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                       <Button 
                         variant="ghost" 
                         size="icon"
                         onClick={() => deleteItem(item.id)}
                         className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                         title="Delete item"
                       >
                          <Trash2 className="w-5 h-5" />
                       </Button>
                    </div>
                 </div>

                 {item.error && (
                   <div className="bg-red-500/10 border border-red-500/20 text-red-400/90 p-4 rounded-xl text-sm mb-6">
                     {item.error}
                   </div>
                 )}

                 {item.transcript && (
                   <div className="flex flex-wrap items-center gap-3 mb-6">
                       <Button 
                         variant="secondary"
                         className="bg-white/5 hover:bg-white/10 text-white/80"
                         onClick={() => setExpandedTextFileId(expandedTextFileId === item.id ? null : item.id)}
                       >
                         <FileText className="w-4 h-4 mr-2" />
                         {expandedTextFileId === item.id ? "Hide Full Text" : "View Full Text"}
                       </Button>
                       {item.chunks && item.chunks.length > 0 && (
                         <Button 
                           variant="secondary"
                           className="bg-white/5 hover:bg-white/10 text-white/80"
                           onClick={() => setExpandedChunksFileId(expandedChunksFileId === item.id ? null : item.id)}
                         >
                           <MessageSquare className="w-4 h-4 mr-2" />
                           {expandedChunksFileId === item.id ? "Hide Subtitles" : "View Subtitles"}
                         </Button>
                       )}
                       
                       <div className="flex-1 min-w-[20px]" />
                       
                       <Button 
                          variant="outline"
                          className="border-violet-500/30 text-violet-300 hover:bg-violet-500/20"
                          onClick={() => downloadFile(item.transcript!, item.filename, "txt")}
                       >
                         <Download className="w-4 h-4 mr-2" /> Download .txt
                       </Button>
                       {item.chunks && item.chunks.length > 0 && (
                         <Button 
                            variant="outline"
                            className="border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/20"
                            onClick={() => downloadFile(generateSrt(item.chunks!), item.filename, "srt")}
                         >
                           <Download className="w-4 h-4 mr-2" /> Download .srt
                         </Button>
                       )}
                   </div>
                 )}
                 
                 {expandedTextFileId === item.id && item.transcript && (
                    <div className="bg-black/40 border border-white/5 rounded-2xl p-6 text-white/70 leading-relaxed whitespace-pre-wrap animate-in fade-in slide-in-from-top-4 mb-6">
                       {item.transcript}
                    </div>
                 )}

                 {expandedChunksFileId === item.id && item.chunks && (
                    <div className="space-y-3 bg-black/20 border border-white/5 rounded-2xl p-6 animate-in fade-in slide-in-from-top-4">
                       {item.chunks.map((chunk, i) => (
                         <div key={i} className="flex gap-4 p-3 hover:bg-white/5 rounded-xl transition-colors">
                           <span className="text-violet-400/60 font-mono text-sm shrink-0 mt-0.5">
                             {formatTime(chunk.timestamp[0])}
                           </span>
                           <span className="text-white/80 text-sm">
                             {chunk.text}
                           </span>
                         </div>
                       ))}
                    </div>
                 )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
