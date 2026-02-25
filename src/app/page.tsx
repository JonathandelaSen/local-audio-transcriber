"use client";

import { useState } from "react";
import Link from "next/link";
import { DragDropZone } from "@/components/DragDropZone";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ProgressIndicator } from "@/components/ProgressIndicator";
import { HistoryItemCard } from "@/components/HistoryItemCard";
import { useTranscriber } from "@/hooks/useTranscriber";
import { decodeAudio } from "@/lib/audio";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  AudioLines,
  Clapperboard,
  FileAudio,
  Languages,
  Sparkles,
  StopCircle,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function isSupportedMedia(file: File) {
  return (
    file.type.includes("audio") ||
    file.type.includes("video") ||
    /\.(m4a|mp3|wav|ogg|flac|aac|mp4|webm|mov|mkv)$/i.test(file.name)
  );
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exp;
  return `${value >= 10 || exp === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exp]}`;
}

export default function Home() {
  const [selectedLanguage, setSelectedLanguage] = useState("");
  const [languageTouched, setLanguageTouched] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [stagedAudioData, setStagedAudioData] = useState<Float32Array | null>(null);
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);
  const {
    audioProgress,
    isBusy,
    progressItems,
    history,
    debugLog,
    transcribe,
    stopTranscription,
    createShiftedSubtitleVersion,
    saveTranslation,
  } = useTranscriber();

  const handleFileSelect = async (file: File) => {
    try {
      if (!isSupportedMedia(file)) {
        throw new Error("Please select a valid audio or video file (.m4a, .mp3, .wav, .mp4, etc)");
      }

      setIsPreparingMedia(true);
      setStagedFile(file);
      setStagedAudioData(null);

      const audioData = await decodeAudio(file);
      setStagedAudioData(audioData);

      toast.success("Media loaded. Choose a language and start transcription.", {
        className: "bg-green-500/20 border-green-500/50 text-green-100",
      });
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to process audio file.";
      toast.error(message, {
        className: "bg-red-500/20 border-red-500/50 text-red-100"
      });
      setStagedAudioData(null);
    }
    setIsPreparingMedia(false);
  };

  const handleStartTranscription = () => {
    if (!selectedLanguage) {
      setLanguageTouched(true);
      toast.error("Select the spoken language before transcribing.", {
        className: "bg-amber-500/20 border-amber-500/50 text-amber-100",
      });
      return;
    }

    if (!stagedFile || !stagedAudioData) {
      toast.error("Upload a media file first.", {
        className: "bg-red-500/20 border-red-500/50 text-red-100",
      });
      return;
    }

    try {
      transcribe(stagedAudioData, stagedFile, selectedLanguage);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start transcription.";
      toast.error(message, {
        className: "bg-red-500/20 border-red-500/50 text-red-100",
      });
    }
  };

  const stagedDurationSeconds = stagedAudioData ? stagedAudioData.length / 16000 : null;
  const stagedIsVideo = stagedFile ? stagedFile.type.includes("video") || /\.(mp4|webm|mov|mkv)$/i.test(stagedFile.name) : false;
  const showLanguageWarning = languageTouched && !selectedLanguage;

  return (
    <main className="min-h-screen w-full relative flex flex-col items-center py-16 px-4 sm:px-6 lg:px-8 overflow-x-clip">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-[12%] -left-[8%] w-[42rem] h-[42rem] bg-orange-500/12 rounded-full blur-[150px]" />
        <div className="absolute top-[25%] right-[-8%] w-[38rem] h-[38rem] bg-cyan-500/14 rounded-full blur-[160px]" />
        <div className="absolute bottom-[-10%] left-[28%] w-[34rem] h-[34rem] bg-emerald-500/8 rounded-full blur-[170px]" />
        <div className="absolute inset-0 opacity-20 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,#000_65%,transparent_100%)] bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:54px_54px]" />
      </div>

      <div className="w-full max-w-5xl z-10 space-y-12 mt-4">
        <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-2 group">
            <div className="inline-flex items-center justify-center p-5 rounded-[2rem] bg-white/[0.03] border border-white/10 backdrop-blur-2xl shadow-2xl relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-cyan-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <AudioLines className="w-12 h-12 text-orange-300 relative z-10" />
            </div>

            <div className="flex items-center gap-2">
              <Link href="/creator">
                <Button variant="outline" className="rounded-full bg-cyan-400/10 border-cyan-300/20 text-cyan-100 hover:text-white hover:bg-cyan-300/15">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Creator Hub
                </Button>
              </Link>
              <Link href="/history">
                <Button variant="outline" className="rounded-full bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10">
                  <FileAudio className="w-4 h-4 mr-2" />
                  History
                </Button>
              </Link>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-gradient-to-r from-orange-400/10 to-cyan-400/10 px-4 py-1.5 text-xs uppercase tracking-[0.22em] text-orange-100/80 shadow-[0_0_24px_rgba(249,115,22,0.12)]">
            <Clapperboard className="w-3.5 h-3.5" />
            Media In, Assets Out
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.92]">
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-100 to-zinc-400 drop-shadow-[0_0_24px_rgba(255,255,255,0.18)]">
              Upload Your
            </span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-amber-300 to-cyan-300 italic">
              Audio or Video
            </span>
          </h1>
          <p className="text-lg md:text-2xl text-white/45 font-light max-w-3xl mx-auto tracking-wide">
            Private browser-native transcription, subtitle versions, and creator tools built around your media workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <div className="space-y-6">
            <DragDropZone onFileSelect={handleFileSelect} disabled={isBusy || isPreparingMedia} />

            <div className="rounded-[1.5rem] border border-white/10 bg-black/30 backdrop-blur-2xl p-4 sm:p-5">
              <div className="flex flex-col lg:flex-row lg:items-start gap-5 justify-between">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                    <Languages className="w-4 h-4 text-orange-300" />
                    Transcription language is required
                  </div>
                  <LanguageSelector
                    value={selectedLanguage}
                    onValueChange={(value) => {
                      setSelectedLanguage(value);
                      if (value) setLanguageTouched(false);
                    }}
                    disabled={isBusy || isPreparingMedia}
                    required
                    invalid={showLanguageWarning}
                    helperText={
                      showLanguageWarning
                        ? "Pick the spoken language before continuing."
                        : "Choose the language spoken in the media to improve transcription reliability."
                    }
                  />
                </div>

                <div className="min-w-0 lg:min-w-[280px] rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/45 mb-2">Uploaded Media</div>
                  {stagedFile ? (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-white/90 break-all">{stagedFile.name}</div>
                      <div className="text-xs text-white/60">
                        {stagedIsVideo ? "Video" : "Audio"} · {formatBytes(stagedFile.size)}
                        {stagedDurationSeconds ? ` · ~${Math.round(stagedDurationSeconds)}s` : ""}
                      </div>
                      <div className="text-xs">
                        {isPreparingMedia ? (
                          <span className="text-cyan-200">Preparing audio stream...</span>
                        ) : stagedAudioData ? (
                          <span className="text-emerald-200">Ready for transcription</span>
                        ) : (
                          <span className="text-white/45">Upload a file to unlock actions</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-white/45">Drop a media file above to start your workflow.</div>
                  )}
                </div>
              </div>
            </div>

            {stagedFile && (
              <div className="rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-orange-500/8 via-white/[0.02] to-cyan-500/8 p-5 sm:p-6 backdrop-blur-2xl space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-white/45">Next Actions</div>
                    <div className="text-lg font-semibold text-white/90">Choose what to do with this media</div>
                  </div>
                  <div className="text-xs text-white/50">
                    Step 1 is transcript + subtitles. Creator tools use your transcript history.
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-sm font-semibold text-white/90 flex items-center gap-2">
                      <WandSparkles className="w-4 h-4 text-orange-300" />
                      Transcribe + Subtitles
                    </div>
                    <div className="text-xs text-white/55 mt-2 leading-relaxed">
                      Create a transcript version and original subtitle track for this uploaded file.
                    </div>
                    <Button
                      onClick={handleStartTranscription}
                      disabled={isBusy || isPreparingMedia || !stagedAudioData}
                      className="mt-4 w-full bg-gradient-to-r from-orange-400 to-cyan-400 text-black font-semibold hover:from-orange-300 hover:to-cyan-300"
                    >
                      Start Transcription
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-sm font-semibold text-white/90 flex items-center gap-2">
                      <FileAudio className="w-4 h-4 text-cyan-300" />
                      Versioned History
                    </div>
                    <div className="text-xs text-white/55 mt-2 leading-relaxed">
                      Review transcripts, create translated subtitles, shift timing, and re-run versions.
                    </div>
                    <Link href="/history">
                      <Button variant="outline" className="mt-4 w-full bg-white/5 border-white/10 text-white/85 hover:bg-white/10">
                        Open History
                      </Button>
                    </Link>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-sm font-semibold text-white/90 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-fuchsia-300" />
                      Creator Tools
                    </div>
                    <div className="text-xs text-white/55 mt-2 leading-relaxed">
                      Generate video info, find viral clips, and use the vertical editor after a transcript exists.
                    </div>
                    <Link href="/creator">
                      <Button variant="outline" className="mt-4 w-full bg-cyan-400/8 border-cyan-300/20 text-cyan-100 hover:bg-cyan-300/12">
                        Open Creator Tools
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}

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
            {history[0] && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-4">
                  <ProgressIndicator progressItems={progressItems} />
                  <HistoryItemCard
                    item={history[0]}
                    audioProgress={audioProgress}
                    autoExpand={true}
                    onCreateShiftedSubtitleVersion={createShiftedSubtitleVersion}
                    onSaveTranslation={saveTranslation}
                  />
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
