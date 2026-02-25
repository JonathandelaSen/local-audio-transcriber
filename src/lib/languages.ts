export const TRANSCRIPTION_LANGUAGES = [
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
] as const;

export type TranscriptionLanguageValue = (typeof TRANSCRIPTION_LANGUAGES)[number]["value"];

const TRANSCRIPTION_LANGUAGE_MAP = new Map(
  TRANSCRIPTION_LANGUAGES.map((lang) => [lang.value.toLowerCase(), lang.label])
);

export function getTranscriptionLanguageLabel(value?: string | null): string {
  if (!value) return "Not selected";
  const normalized = String(value).toLowerCase();
  if (normalized === "auto") return "Auto-detect (legacy)";
  return TRANSCRIPTION_LANGUAGE_MAP.get(normalized) ?? String(value);
}

export function isValidTranscriptionLanguage(value?: string | null): value is TranscriptionLanguageValue {
  if (!value) return false;
  return TRANSCRIPTION_LANGUAGE_MAP.has(String(value).toLowerCase());
}
