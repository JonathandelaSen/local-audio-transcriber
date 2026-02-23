import { useState, useEffect } from "react";
import { formatTime, generateSrt } from "@/lib/srt";
import { HistoryItem } from "@/hooks/useTranscriber";
import { useTranslator } from "@/hooks/useTranslator";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Trash2, FileText, Download, Clock, CheckCircle2, 
  AlertCircle, MessageSquare, Loader2, Copy, Check, Globe
} from "lucide-react";
import { toast } from "sonner";

const TRANSLATION_LANGUAGES = [
  { value: "es", label: "Spanish" },
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "nl", label: "Dutch" },
  { value: "ru", label: "Russian" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
];

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
  const [sourceLang, setSourceLang] = useState("original");
  const [targetLang, setTargetLang] = useState("original");
  const [cachedTranslations, setCachedTranslations] = useState<Record<string, any[]>>({});

  const { 
    isTranslating, 
    isModelLoading, 
    translationProgress, 
    translatedChunks, 
    translateChunks,
    error: translatorError
  } = useTranslator();

  useEffect(() => {
    if (translatedChunks && targetLang !== "original") {
      setCachedTranslations(prev => ({ ...prev, [targetLang]: translatedChunks }));
      toast.success("Translation complete!", { className: "bg-green-500/20 border-green-500/50 text-green-100" });
      setExpandedChunks(true);
    }
  }, [translatedChunks, targetLang]);

  useEffect(() => {
    if (translatorError) {
      const cleanError = translatorError.includes("404") 
        ? "Translation model for this exact language pair is unavailable." 
        : translatorError;
      toast.error(`Translation failed: ${cleanError}`, { 
        className: "bg-red-500/20 border-red-500/50 text-red-100" 
      });
    }
  }, [translatorError]);

  const activeChunks = targetLang === "original" ? item.chunks : (cachedTranslations[targetLang] || null);
  const needsTranslation = targetLang !== "original" && !activeChunks;

  const handleTranslate = () => {
    if (item.chunks) {
        translateChunks(item.chunks, targetLang, sourceLang);
    }
  };

  const handleDownloadSrt = () => {
    if (!activeChunks) return;
    downloadFile(generateSrt(activeChunks), targetLang === "original" ? item.filename : `${item.filename}_${targetLang}`, "srt");
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
    if (!activeChunks) return;
    navigator.clipboard.writeText(generateSrt(activeChunks));
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
               <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                     <span className="text-white/40 text-xs font-medium uppercase tracking-wider pl-1">Subtitles (SRT)</span>
                     <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1 border border-white/5">
                       <Select value={sourceLang} onValueChange={setSourceLang} disabled={isTranslating || isModelLoading}>
                         <SelectTrigger className="h-7 w-[90px] bg-transparent border-0 text-white/70 focus:ring-fuchsia-500/50 text-xs font-medium">
                           <SelectValue placeholder="From" />
                         </SelectTrigger>
                         <SelectContent className="bg-zinc-900 border-white/10 text-white/90">
                           <SelectItem value="original" className="text-xs font-bold border-b border-white/5 mb-1 pb-1 focus:bg-fuchsia-500/20 cursor-pointer">Original</SelectItem>
                           {TRANSLATION_LANGUAGES.map(lang => (
                             <SelectItem key={`src-${lang.value}`} value={lang.value} className="text-xs focus:bg-fuchsia-500/20 cursor-pointer">
                               {lang.label}
                             </SelectItem>
                           ))}
                         </SelectContent>
                       </Select>

                       <span className="text-white/30 text-xs font-bold px-1">→</span>

                       <Select value={targetLang} onValueChange={setTargetLang} disabled={isTranslating || isModelLoading}>
                         <SelectTrigger className="h-7 w-[100px] bg-transparent border-0 text-white/70 focus:ring-fuchsia-500/50 text-xs font-medium">
                           <SelectValue placeholder="To" />
                         </SelectTrigger>
                         <SelectContent className="bg-zinc-900 border-white/10 text-white/90">
                           <SelectItem value="original" className="text-xs font-bold border-b border-white/5 mb-1 pb-1 focus:bg-fuchsia-500/20 cursor-pointer">Original</SelectItem>
                           {TRANSLATION_LANGUAGES.map(lang => (
                             <SelectItem key={`tgt-${lang.value}`} value={lang.value} className="text-xs focus:bg-fuchsia-500/20 cursor-pointer">
                               {lang.label}
                             </SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     </div>
                  </div>

                  <div className="flex items-center gap-1">
                     {needsTranslation ? (
                        <Button 
                         variant="ghost" size="sm" 
                         className="text-fuchsia-300 hover:bg-fuchsia-500/20 hover:text-fuchsia-200 disabled:opacity-50"
                         onClick={handleTranslate} 
                         disabled={isTranslating || isModelLoading || sourceLang === "original"}
                        >
                          {isModelLoading || isTranslating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
                          {isModelLoading ? "Loading Model..." : isTranslating ? `Translating ${translationProgress}%` : "Translate Now"}
                        </Button>
                     ) : (
                        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-1 border border-white/5">
                          <Button 
                             variant="ghost" size="sm" 
                             className="text-fuchsia-300 hover:bg-fuchsia-500/20 hover:text-fuchsia-200"
                             onClick={handleDownloadSrt}
                          >
                            <Download className="w-4 h-4 mr-2" /> Download SRT
                          </Button>
                          <Button 
                             variant="ghost" size="sm" 
                             className="text-white/60 hover:bg-white/10 px-2"
                             onClick={copySrt}
                             title="Copy Subtitles"
                          >
                            {copiedSrt ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                     )}
                  </div>
               </div>
             )}
         </div>
       )}
       
       {expandedText && item.transcript && (
          <div className="bg-black/40 border border-white/5 rounded-2xl p-6 text-white/70 leading-relaxed whitespace-pre-wrap animate-in fade-in slide-in-from-top-4 mb-6">
             {item.transcript}
          </div>
       )}

       {expandedChunks && activeChunks && (
          <div className="space-y-3 bg-black/20 border border-white/5 rounded-2xl p-6 animate-in fade-in slide-in-from-top-4">
             {activeChunks.map((chunk, i) => (
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
