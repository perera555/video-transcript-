export type Language = {
  code: string; // Whisper / ISO-639-1 code
  name: string;
  native: string;
  nllb: string; // NLLB-200 code for on-device translation
};

export const LANGUAGES: Language[] = [
  { code: "en", name: "English", native: "English", nllb: "eng_Latn" },
  { code: "si", name: "Sinhala", native: "සිංහල", nllb: "sin_Sinh" },
  { code: "ta", name: "Tamil", native: "தமிழ்", nllb: "tam_Taml" },
  { code: "es", name: "Spanish", native: "Español", nllb: "spa_Latn" },
  { code: "hi", name: "Hindi", native: "हिन्दी", nllb: "hin_Deva" },
  { code: "fr", name: "French", native: "Français", nllb: "fra_Latn" },
  { code: "de", name: "German", native: "Deutsch", nllb: "deu_Latn" },
  { code: "pt", name: "Portuguese", native: "Português", nllb: "por_Latn" },
  { code: "it", name: "Italian", native: "Italiano", nllb: "ita_Latn" },
  { code: "ar", name: "Arabic", native: "العربية", nllb: "arb_Arab" },
  { code: "zh", name: "Chinese", native: "中文", nllb: "zho_Hans" },
  { code: "ja", name: "Japanese", native: "日本語", nllb: "jpn_Jpan" },
  { code: "ko", name: "Korean", native: "한국어", nllb: "kor_Hang" },
  { code: "ru", name: "Russian", native: "Русский", nllb: "rus_Cyrl" },
  { code: "tr", name: "Turkish", native: "Türkçe", nllb: "tur_Latn" },
  { code: "bn", name: "Bengali", native: "বাংলা", nllb: "ben_Beng" },
  { code: "ur", name: "Urdu", native: "اردو", nllb: "urd_Arab" },
  { code: "te", name: "Telugu", native: "తెలుగు", nllb: "tel_Telu" },
  { code: "ml", name: "Malayalam", native: "മലയാളം", nllb: "mal_Mlym" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", nllb: "kan_Knda" },
  { code: "mr", name: "Marathi", native: "मराठी", nllb: "mar_Deva" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia", nllb: "ind_Latn" },
  { code: "ms", name: "Malay", native: "Bahasa Melayu", nllb: "zsm_Latn" },
  { code: "th", name: "Thai", native: "ไทย", nllb: "tha_Thai" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt", nllb: "vie_Latn" },
  { code: "nl", name: "Dutch", native: "Nederlands", nllb: "nld_Latn" },
  { code: "pl", name: "Polish", native: "Polski", nllb: "pol_Latn" },
  { code: "uk", name: "Ukrainian", native: "Українська", nllb: "ukr_Cyrl" },
  { code: "fa", name: "Persian", native: "فارسی", nllb: "pes_Arab" },
  { code: "sv", name: "Swedish", native: "Svenska", nllb: "swe_Latn" },
  { code: "el", name: "Greek", native: "Ελληνικά", nllb: "ell_Grek" },
  { code: "he", name: "Hebrew", native: "עברית", nllb: "heb_Hebr" },
  { code: "ne", name: "Nepali", native: "नेपाली", nllb: "npi_Deva" },
  { code: "tl", name: "Filipino", native: "Filipino", nllb: "tgl_Latn" },
  { code: "sw", name: "Swahili", native: "Kiswahili", nllb: "swh_Latn" },
];

export const langByCode = (code: string) => LANGUAGES.find((l) => l.code === code);

// Groq's verbose_json returns the detected language as a lowercase English name.
export function codeFromName(name?: string): string | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase();
  return LANGUAGES.find((l) => l.name.toLowerCase() === n || l.code === n)?.code;
}
