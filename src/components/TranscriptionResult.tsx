import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TranscriptionResultProps {
  transcript: string;
  chunks: any[];
  audioProgress: number;
  isBusy: boolean;
}

export function TranscriptionResult({ transcript, chunks, audioProgress, isBusy }: TranscriptionResultProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    toast("Copied to clipboard!", { className: "bg-green-500/20 border-green-500/50 text-green-100" });
    setTimeout(() => setCopied(false), 2000);
  };

  const exportSRT = () => {
    if (!chunks || chunks.length === 0) {
      toast.error("No timestamps available");
      return;
    }
    const formatTime = (timeInSeconds: number) => {
      const date = new Date(timeInSeconds * 1000);
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const seconds = String(date.getUTCSeconds()).padStart(2, '0');
      const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');
      return `${hours}:${minutes}:${seconds},${milliseconds}`;
    };

    let srtContent = "";
    chunks.forEach((chunk, index) => {
      const start = formatTime(chunk.timestamp[0]);
      const end = chunk.timestamp[1] !== null ? formatTime(chunk.timestamp[1]) : formatTime(chunk.timestamp[0] + 5); 
      srtContent += `${index + 1}\n${start} --> ${end}\n${chunk.text.trim()}\n\n`;
    });

    const blob = new Blob([srtContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.srt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("Exported SRT successfully!", { className: "bg-green-500/20 border-green-500/50 text-green-100" });
  };

  if (!transcript && !isBusy) return null;

  return (
    <div className="w-full relative group animate-in fade-in zoom-in-95 duration-700">
      <div className="absolute -inset-0.5 bg-gradient-to-b from-violet-500/30 to-fuchsia-500/30 rounded-[2.5rem] blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>
      <div className="relative p-8 rounded-[2.5rem] bg-black/60 backdrop-blur-3xl border border-white/10 shadow-2xl overflow-hidden min-h-[200px] flex flex-col">
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
        
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-bold text-white/50 uppercase tracking-[0.2em]">
              Output
            </h3>
            {isBusy && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-violet-500/20 border border-violet-500/30">
                   <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                  </span>
                  <span className="text-[10px] font-bold text-violet-300 uppercase tracking-wider animate-pulse">Processing {audioProgress}%</span>
                </div>
                <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 transition-all duration-300 ease-out" style={{ width: `${audioProgress}%` }}></div>
                </div>
              </div>
            )}
          </div>
          {transcript && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/5 border-white/10 text-white/80 hover:bg-white/15 hover:text-white rounded-full px-4 transition-all"
                onClick={exportSRT}
              >
                <Download className="w-3.5 h-3.5 mr-2" />
                SRT
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/5 border-white/10 text-white/80 hover:bg-white/15 hover:text-white rounded-full px-4 transition-all"
                onClick={handleCopy}
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-2 text-green-400" /> : <Copy className="w-3.5 h-3.5 mr-2" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          )}
        </div>
        
        <div className={cn(
            "text-white/95 text-xl leading-relaxed font-light whitespace-pre-wrap transition-opacity duration-500 flex-1",
            isBusy && !transcript ? "opacity-40 animate-pulse" : "opacity-100"
          )}
        >
          {transcript || "Extracting vocals in Spanish..."}
        </div>
      </div>
    </div>
  );
}
