"use client";

import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TRANSCRIPTION_LANGUAGES } from "@/lib/languages";

interface LanguageSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  helperText?: string;
}

export function LanguageSelector({
  value,
  onValueChange,
  disabled,
  required = false,
  invalid = false,
  helperText,
}: LanguageSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className={cn("flex items-center text-sm font-medium", invalid ? "text-amber-200" : "text-white/60")}>
          <Globe2 className="w-4 h-4 mr-1.5 opacity-70" />
          Audio Language
          {required && <span className="ml-1 text-amber-300">*</span>}
        </div>
        <Select value={value} onValueChange={onValueChange} disabled={disabled}>
          <SelectTrigger
            className={cn(
              "w-[220px] bg-white/[0.03] text-white/90 hover:bg-white/[0.06] transition-colors focus:ring-violet-500/50 rounded-xl h-10",
              invalid
                ? "border-amber-400/50 bg-amber-500/10 shadow-[0_0_0_1px_rgba(251,191,36,0.18)]"
                : "border-white/10"
            )}
          >
            <SelectValue placeholder="Choose the media language" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-white/10 text-white/90 rounded-xl shadow-xl backdrop-blur-xl">
            {TRANSCRIPTION_LANGUAGES.map((lang) => (
              <SelectItem
                key={lang.value}
                value={lang.value}
                className="focus:bg-violet-500/20 focus:text-white hover:bg-white/5 rounded-lg cursor-pointer transition-colors"
              >
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {(invalid || helperText) && (
        <div className={cn("text-xs", invalid ? "text-amber-200" : "text-white/50")}>
          {helperText ?? "Select the spoken language before starting transcription."}
        </div>
      )}
    </div>
  );
}
