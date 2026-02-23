"use client";

import { useState } from "react";
import { formatTime, generateSrt } from "@/lib/srt";
import { HistoryItem } from "@/hooks/useTranscriber";
import { Button } from "@/components/ui/button";
import { 
  Trash2, FileText, Download, Clock, CheckCircle2, 
  AlertCircle, MessageSquare, Loader2, Copy, Check 
} from "lucide-react";
import { toast } from "sonner";

interface HistoryItemCardProps {
  item: HistoryItem;
  onDelete?: (id: string) => void;
  audioProgress?: number;
  autoExpand?: boolean;
}

export function HistoryItemCard({ item, onDelete, audioProgress, autoExpand = false }: HistoryItemCardProps) {
  const [expandedText, setExpandedText] = useState(autoExpand);
  const [expandedChunks, setExpandedChunks] = useState(false);
  const [copiedTxt, setCopiedTxt] = useState(false);
  const [copiedSrt, setCopiedSrt] = useState(false);

  const downloadFile = (content: string, filename: string, extension: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript_${filename.replace(/\.[^/.]+$/, "")}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyText = () => {
    if (!item.transcript) return;
    navigator.clipboard.writeText(item.transcript);
    setCopiedTxt(true);
    toast("Copied text to clipboard!", { className: "bg-green-500/20 border-green-500/50 text-green-100" });
    setTimeout(() => setCopiedTxt(false), 2000);
  };

  const copySrt = () => {
    if (!item.chunks || item.chunks.length === 0) return;
    navigator.clipboard.writeText(generateSrt(item.chunks));
    setCopiedSrt(true);
    toast("Copied subtitles to clipboard!", { className: "bg-green-500/20 border-green-500/50 text-green-100" });
    setTimeout(() => setCopiedSrt(false), 2000);
  };

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-md transition-colors hover:bg-white/[0.04]">
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
                
                {item.status === "transcribing" && (
                   <span className="flex items-center text-violet-400">
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin"/> Processing
                      {audioProgress !== undefined && ` ${audioProgress}%`}
                   </span>
                )}
             </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
             {onDelete && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => onDelete(item.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  title="Delete item"
                >
                   <Trash2 className="w-5 h-5" />
                </Button>
             )}
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
               onClick={() => setExpandedText(!expandedText)}
             >
               <FileText className="w-4 h-4 mr-2" />
               {expandedText ? "Hide Full Text" : "View Full Text"}
             </Button>
             
             {item.chunks && item.chunks.length > 0 && (
               <Button 
                 variant="secondary"
                 className="bg-white/5 hover:bg-white/10 text-white/80"
                 onClick={() => setExpandedChunks(!expandedChunks)}
               >
                 <MessageSquare className="w-4 h-4 mr-2" />
                 {expandedChunks ? "Hide Subtitles" : "View Subtitles"}
               </Button>
             )}
             
             <div className="flex-1 min-w-[20px]" />
             
             <div className="flex items-center bg-white/[0.03] rounded-lg p-1 border border-white/5">
                 <Button 
                    variant="ghost"
                    size="sm"
                    className="text-violet-300 hover:bg-violet-500/20 hover:text-violet-200"
                    onClick={() => downloadFile(item.transcript!, item.filename, "txt")}
                    title="Download Text"
                 >
                   <Download className="w-4 h-4 mr-2" /> .txt
                 </Button>
                 <Button 
                    variant="ghost"
                    size="sm"
                    className="text-white/60 hover:bg-white/10"
                    onClick={copyText}
                    title="Copy Text"
                 >
                   {copiedTxt ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                 </Button>
             </div>

             {item.chunks && item.chunks.length > 0 && (
                 <div className="flex items-center bg-white/[0.03] rounded-lg p-1 border border-white/5">
                     <Button 
                        variant="ghost"
                        size="sm"
                        className="text-fuchsia-300 hover:bg-fuchsia-500/20 hover:text-fuchsia-200"
                        onClick={() => downloadFile(generateSrt(item.chunks!), item.filename, "srt")}
                        title="Download Subtitles"
                     >
                       <Download className="w-4 h-4 mr-2" /> .srt
                     </Button>
                     <Button 
                        variant="ghost"
                        size="sm"
                        className="text-white/60 hover:bg-white/10"
                        onClick={copySrt}
                        title="Copy Subtitles"
                     >
                       {copiedSrt ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                     </Button>
                 </div>
             )}
         </div>
       )}
       
       {expandedText && item.transcript && (
          <div className="bg-black/40 border border-white/5 rounded-2xl p-6 text-white/70 leading-relaxed whitespace-pre-wrap animate-in fade-in slide-in-from-top-4 mb-6">
             {item.transcript}
          </div>
       )}

       {expandedChunks && item.chunks && (
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
  );
}
