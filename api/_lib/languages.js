// The languages a family can read their feedback in. English is the learning language and always stays the source of
// truth: feedback is written, checked and stored in English first, then translated on request (see translateFeedback.js).
// To offer another language, add a line here and nothing else changes. "native" is how the language names itself, which
// is what the picker shows; "dir" is "rtl" for scripts that read right to left.
const LANGUAGES = [
  { code: "en", name: "English", native: "English", dir: "ltr" },
  { code: "pl", name: "Polish", native: "Polski", dir: "ltr" },
  { code: "ro", name: "Romanian", native: "Română", dir: "ltr" },
  { code: "es", name: "Spanish", native: "Español", dir: "ltr" },
  { code: "pt", name: "Portuguese", native: "Português", dir: "ltr" },
  { code: "ar", name: "Arabic", native: "العربية", dir: "rtl" },
  { code: "ur", name: "Urdu", native: "اردو", dir: "rtl" },
  { code: "pa", name: "Punjabi (Gurmukhi script)", native: "ਪੰਜਾਬੀ", dir: "ltr" },
  { code: "bn", name: "Bengali", native: "বাংলা", dir: "ltr" },
  { code: "hi", name: "Hindi", native: "हिन्दी", dir: "ltr" },
  { code: "zh", name: "Chinese (Simplified)", native: "中文", dir: "ltr" },
];

const BY_CODE = new Map(LANGUAGES.map((l) => [l.code, l]));

// Returns the language record for a code, or null when it is not one we offer (including "en": nothing to translate).
function translatableLanguage(code) {
  const l = BY_CODE.get(String(code || "").toLowerCase());
  return l && l.code !== "en" ? l : null;
}

module.exports = { LANGUAGES, translatableLanguage };
