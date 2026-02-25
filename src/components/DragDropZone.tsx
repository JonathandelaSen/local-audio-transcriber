import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { UploadCloud } from "lucide-react";

interface DragDropZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function DragDropZone({ onFileSelect, disabled }: DragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFileSelect(e.dataTransfer.files[0]);
      }
    },
    [disabled, onFileSelect]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      className={cn(
        "relative group flex flex-col items-center justify-center w-full h-72 border border-dashed rounded-[2.5rem] transition-all duration-500 backdrop-blur-2xl overflow-hidden",
        isDragging
          ? "border-orange-300/80 bg-orange-400/10 shadow-[0_0_90px_rgba(251,146,60,0.28)] scale-[1.02]"
          : "border-white/10 bg-black/40 hover:bg-black/60 hover:border-white/30 hover:shadow-[0_0_40px_rgba(255,255,255,0.05)]",
        disabled && "opacity-50 cursor-not-allowed border-white/5 bg-black/20"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={cn("absolute inset-[1px] rounded-[calc(2.5rem-2px)]", "bg-gradient-to-br from-white/[0.02] via-black/60 to-black/80")} />
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-cyan-500/10 transition-opacity duration-700",
          isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      />
      <div className="absolute inset-0 opacity-20 [mask-image:radial-gradient(circle_at_50%_50%,#000_45%,transparent_100%)] bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <div
        className={cn(
          "absolute inset-0 rounded-[2.5rem] p-[1px] transition-opacity duration-500",
          isDragging
            ? "opacity-100 bg-gradient-to-br from-orange-300/70 via-cyan-300/60 to-orange-300/70"
            : "opacity-70 bg-gradient-to-br from-white/10 via-white/5 to-white/10 group-hover:from-orange-300/30 group-hover:to-cyan-300/30"
        )}
      >
        <div className="absolute inset-[1px] rounded-[calc(2.5rem-1px)] bg-transparent" />
      </div>
      
      <div className="z-10 flex flex-col items-center space-y-6 pointer-events-none">
        <div className={cn(
            "p-5 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 transition-all duration-500", 
            isDragging ? "scale-110 shadow-[0_0_40px_rgba(251,146,60,0.35)] rotate-3 bg-orange-500/20 border-orange-500/30" : "group-hover:scale-105 group-hover:rotate-1"
          )}>
          <UploadCloud className={cn("w-12 h-12 transition-colors duration-300", isDragging ? "text-orange-200" : "text-white/60 group-hover:text-cyan-200")} />
        </div>
        <div className="text-center space-y-2">
          <p className={cn("text-xl font-semibold tracking-wide transition-colors", isDragging ? "text-orange-100" : "text-white/90")}>
            {isDragging ? "Drop your media to stage it" : "Drag & Drop your media"}
          </p>
          <p className="text-sm font-medium text-white/40 uppercase tracking-[0.24em]">
            Audio / Video Workflow
          </p>
          <p className="text-xs text-white/45 max-w-xs mx-auto">
            Upload first, pick the spoken language, then choose what you want to do next.
          </p>
        </div>
      </div>
      <input
        type="file"
        accept="audio/*,video/*,.mkv"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        disabled={disabled}
      />
    </div>
  );
}
