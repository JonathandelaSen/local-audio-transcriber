"use client";

import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Globe2 } from "lucide-react";

interface LanguageSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

const SUPPORTED_LANGUAGES = [
  { value: "auto", label: "Auto-Detect (Default)" },
  { value: "spanish", label: "Spanish" },
  { value: "english", label: "English" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "italian", label: "Italian" },
  { value: "portuguese", label: "Portuguese" },
  { value: "dutch", label: "Dutch" },
  { value: "russian", label: "Russian" },
  { value: "japanese", label: "Japanese" },
  { value: "chinese", label: "Chinese" },
];

export function LanguageSelector({ value, onValueChange, disabled }: LanguageSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center text-white/60 text-sm font-medium">
        <Globe2 className="w-4 h-4 mr-1.5 opacity-70" />
        Audio Language
      </div>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="w-[180px] bg-white/[0.03] border-white/10 text-white/90 hover:bg-white/[0.06] transition-colors focus:ring-violet-500/50 rounded-xl h-10">
          <SelectValue placeholder="Select language" />
        </SelectTrigger>
        <SelectContent className="bg-zinc-900 border-white/10 text-white/90 rounded-xl shadow-xl backdrop-blur-xl">
          {SUPPORTED_LANGUAGES.map((lang) => (
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
  );
}
