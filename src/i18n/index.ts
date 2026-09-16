import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./locales/fr.json";
import en from "./locales/en.json";
import de from "./locales/de.json";
import tr from "./locales/tr.json";

export const SUPPORTED_LANGUAGES = ["fr", "en", "de", "tr"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: AppLanguage = "fr";

const STORAGE_KEY = "signe:app-language";

export function getStoredLanguage(): AppLanguage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) return stored as AppLanguage;
  } catch { /* storage unavailable, fall through to default */ }
  return DEFAULT_LANGUAGE;
}

export function setStoredLanguage(lang: AppLanguage): void {
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* value just won't persist */ }
}

void i18next.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    de: { translation: de },
    tr: { translation: tr },
  },
  lng: getStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export function changeAppLanguage(lang: AppLanguage): void {
  setStoredLanguage(lang);
  void i18next.changeLanguage(lang);
}

i18next.on("languageChanged", lng => { try { document.documentElement.lang = lng; } catch { /* non-browser context */ } });
try { document.documentElement.lang = i18next.language; } catch { /* non-browser context */ }

export default i18next;
