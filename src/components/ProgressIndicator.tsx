import { Progress } from "@/components/ui/progress";
import { TranscriberProgress } from "@/hooks/useTranscriber";

interface ProgressIndicatorProps {
  progressItems: TranscriberProgress[];
}

export function ProgressIndicator({ progressItems }: ProgressIndicatorProps) {
  if (progressItems.length === 0) return null;

  return (
    <div className="w-full space-y-5 p-8 rounded-[2rem] bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
      <h3 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 uppercase tracking-[0.2em] text-center">
        Initialize Core AI Model
      </h3>
      <div className="space-y-4">
        {progressItems.map((item) => (
          <div key={item.file} className="space-y-2">
            <div className="flex justify-between items-end text-xs font-medium tracking-wide">
              <span className="text-white/50 truncate max-w-[75%]">{item.file}</span>
              <span className="text-white/90">{Math.round(item.progress)}%</span>
            </div>
            <Progress value={item.progress} className="h-1 bg-white/5 overflow-hidden" />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-center text-white/30 uppercase tracking-widest mt-6">
        Stored locally. Never leaves your device.
      </p>
    </div>
  );
}
