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
          ? "border-violet-500/80 bg-violet-500/10 shadow-[0_0_80px_rgba(139,92,246,0.3)] scale-[1.02]"
          : "border-white/10 bg-black/40 hover:bg-black/60 hover:border-white/30 hover:shadow-[0_0_40px_rgba(255,255,255,0.05)]",
        disabled && "opacity-50 cursor-not-allowed border-white/5 bg-black/20"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-fuchsia-500/10 transition-opacity duration-700", isDragging ? "opacity-100" : "opacity-0")} />
      
      <div className="z-10 flex flex-col items-center space-y-6 pointer-events-none">
        <div className={cn(
            "p-5 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 transition-all duration-500", 
            isDragging ? "scale-110 shadow-[0_0_40px_rgba(139,92,246,0.5)] rotate-3 bg-violet-500/20 border-violet-500/30" : "group-hover:scale-105 group-hover:rotate-1"
          )}>
          <UploadCloud className={cn("w-12 h-12 transition-colors duration-300", isDragging ? "text-violet-300" : "text-white/60 group-hover:text-white/90")} />
        </div>
        <div className="text-center space-y-2">
          <p className="text-xl font-light text-white/90 tracking-wide">
            Drag & Drop your audio
          </p>
          <p className="text-sm font-medium text-white/40 uppercase tracking-widest">
            .m4a • .mp3 • .wav
          </p>
        </div>
      </div>
      <input
        type="file"
        accept="audio/*"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        disabled={disabled}
      />
    </div>
  );
}
