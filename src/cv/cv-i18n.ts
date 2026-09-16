import type { CvLanguage, DateFormat, LanguageLevel, SkillLevel } from "./types/cv-data";

// Text generated *by the CV itself* (section titles, level labels, month
// names, the "references on request" boilerplate) — driven by cvLanguage,
// completely independent of the app's own interface language (i18next).
// Never touches anything the user typed themselves.

export type CvStrings = {
  sections: Record<"profile" | "experience" | "education" | "skills" | "languages" | "certifications" | "projects" | "interests" | "permits" | "references" | "contact", string>;
  skillLevels: Record<SkillLevel, string>;
  languageLevels: Record<LanguageLevel, string>;
  present: string;
  referencesOnRequest: string;
  months: string[];
};

const STRINGS: Record<CvLanguage, CvStrings> = {
  fr: {
    sections: {
      profile: "Profil", experience: "Expériences professionnelles", education: "Formation", skills: "Compétences",
      languages: "Langues", certifications: "Certifications", projects: "Projets", interests: "Centres d’intérêt",
      permits: "Permis", references: "Références", contact: "Coordonnées",
    },
    skillLevels: { beginner: "Débutant", intermediate: "Intermédiaire", advanced: "Avancé", expert: "Expert" },
    languageLevels: { A1: "A1", A2: "A2", B1: "B1", B2: "B2", C1: "C1", C2: "C2", beginner: "Débutant", intermediate: "Intermédiaire", fluent: "Courant", native: "Langue maternelle" },
    present: "Aujourd’hui",
    referencesOnRequest: "Références disponibles sur demande",
    months: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  },
  en: {
    sections: {
      profile: "Profile", experience: "Work Experience", education: "Education", skills: "Skills",
      languages: "Languages", certifications: "Certifications", projects: "Projects", interests: "Interests",
      permits: "Driving Licence", references: "References", contact: "Contact",
    },
    skillLevels: { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced", expert: "Expert" },
    languageLevels: { A1: "A1", A2: "A2", B1: "B1", B2: "B2", C1: "C1", C2: "C2", beginner: "Beginner", intermediate: "Intermediate", fluent: "Fluent", native: "Native" },
    present: "Present",
    referencesOnRequest: "References available upon request",
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  },
  de: {
    sections: {
      profile: "Profil", experience: "Berufserfahrung", education: "Ausbildung", skills: "Kenntnisse",
      languages: "Sprachen", certifications: "Zertifikate", projects: "Projekte", interests: "Interessen",
      permits: "Führerschein", references: "Referenzen", contact: "Kontaktdaten",
    },
    skillLevels: { beginner: "Grundkenntnisse", intermediate: "Gute Kenntnisse", advanced: "Fortgeschritten", expert: "Experte" },
    languageLevels: { A1: "A1", A2: "A2", B1: "B1", B2: "B2", C1: "C1", C2: "C2", beginner: "Anfänger", intermediate: "Mittelstufe", fluent: "Fließend", native: "Muttersprache" },
    present: "Heute",
    referencesOnRequest: "Referenzen auf Anfrage erhältlich",
    months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  },
  tr: {
    sections: {
      profile: "Profil", experience: "İş Deneyimi", education: "Eğitim", skills: "Beceriler",
      languages: "Diller", certifications: "Sertifikalar", projects: "Projeler", interests: "İlgi Alanları",
      permits: "Ehliyet", references: "Referanslar", contact: "İletişim Bilgileri",
    },
    skillLevels: { beginner: "Başlangıç", intermediate: "Orta", advanced: "İleri", expert: "Uzman" },
    languageLevels: { A1: "A1", A2: "A2", B1: "B1", B2: "B2", C1: "C1", C2: "C2", beginner: "Başlangıç", intermediate: "Orta", fluent: "Akıcı", native: "Ana dili" },
    present: "Günümüz",
    referencesOnRequest: "Referanslar istek üzerine sağlanabilir",
    months: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
  },
};

export function cvStrings(lang: CvLanguage): CvStrings { return STRINGS[lang] ?? STRINGS.fr; }

export function formatCvDate(value: string, lang: CvLanguage, format: DateFormat): string {
  if (!value) return "";
  const [yearStr, monthStr] = value.split("-");
  const year = yearStr;
  const monthIndex = monthStr ? Number(monthStr) - 1 : null;
  if (format === "yearOnly" || monthIndex === null) return year;
  if (format === "numeric") return `${monthStr.padStart(2, "0")}/${year}`;
  const months = cvStrings(lang).months;
  const monthName = months[monthIndex] ?? monthStr;
  return lang === "de" ? `${monthName} ${year}` : `${monthName} ${year}`;
}

export function formatCvDateRange(start: string, end: string, current: boolean, lang: CvLanguage, format: DateFormat): string {
  const startLabel = formatCvDate(start, lang, format);
  const endLabel = current ? cvStrings(lang).present : formatCvDate(end, lang, format);
  if (!startLabel && !endLabel) return "";
  if (!endLabel) return startLabel;
  if (!startLabel) return endLabel;
  return `${startLabel} – ${endLabel}`;
}
