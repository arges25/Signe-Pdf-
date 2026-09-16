// The CV's actual content — never touched by template/theme switches or by
// an app-language change. Only cvLanguage drives translation of the
// section titles and level labels that the renderer generates; every
// string the user typed themselves is stored and shown verbatim.

export type CvLanguage = "fr" | "en" | "de" | "tr";

export type CvPhotoShape = "round" | "square" | "rounded" | "portrait";

export type CvPhoto = {
  dataUrl: string; // final cropped image, ready to render/embed
  originalDataUrl: string; // uncropped source, kept so re-opening the crop tool doesn't lose quality
  crop: { zoom: number; offsetX: number; offsetY: number; rotation: number };
  shape: CvPhotoShape;
  sizePercent: number; // 40-100, relative to the template's photo slot
  borderWidth: number; // px, 0 = none
  borderColor: string;
};

export type CvLink = { id: string; label: string; url: string };

export type CvPersonalInfo = {
  firstName: string;
  lastName: string;
  jobTitle: string;
  targetRole: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  birthDate: string;
  nationality: string;
  website: string;
  linkedin: string;
  github: string;
  portfolio: string;
  customLinks: CvLink[];
  photo: CvPhoto | null;
};

export type CvExperience = {
  id: string;
  jobTitle: string;
  company: string;
  city: string;
  country: string;
  startDate: string; // "YYYY-MM" or "YYYY"
  endDate: string;
  current: boolean;
  description: string; // free text; non-empty lines render as bullets
};

export type CvEducation = {
  id: string;
  degree: string;
  institution: string;
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  description: string;
  honors: string;
};

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";
export type SkillsStyle = "list" | "bars" | "stars" | "dots" | "badges";
export type CvSkill = { id: string; name: string; level: SkillLevel | null };

export type LanguageLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "beginner" | "intermediate" | "fluent" | "native";
export type CvSpokenLanguage = { id: string; name: string; level: LanguageLevel };

export type CvCertification = { id: string; name: string; issuer: string; date: string; expiry: string; url: string };

export type CvPermit = { id: string; category: string };

export type CvProject = { id: string; name: string; description: string; technologies: string; date: string; url: string; imageDataUrl: string | null };

export type InterestsStyle = "text" | "list" | "tags" | "icons";
export type CvInterest = { id: string; label: string; icon: string | null };

export type CvReference = { id: string; name: string; jobTitle: string; company: string; phone: string; email: string };

export type CvCustomItem = { id: string; title: string; subtitle: string; date: string; description: string };
export type CvCustomSection = { id: string; title: string; items: CvCustomItem[] };

export type CvSectionKind =
  | "profile" | "experience" | "education" | "skills" | "languages"
  | "certifications" | "projects" | "interests" | "permits" | "references";

export type CvSectionMeta = {
  id: string; // == kind for built-ins, custom-<uuid> for custom sections
  kind: CvSectionKind | "custom";
  titleOverride: string | null; // null = use the translated default for cvLanguage
  visible: boolean;
};

export type CvQrCode = {
  enabled: boolean;
  url: string;
  sizePercent: number; // 8-24, relative to page width
  position: "bottom-right" | "bottom-left" | "top-right" | "sidebar";
};

export type DateFormat = "monthYear" | "numeric" | "yearOnly";
export type SortOrder = "manual" | "recentFirst";

export type CvData = {
  cvLanguage: CvLanguage;
  personal: CvPersonalInfo;
  profileSummary: string;
  experiences: CvExperience[];
  education: CvEducation[];
  skills: CvSkill[];
  skillsStyle: SkillsStyle;
  spokenLanguages: CvSpokenLanguage[];
  certifications: CvCertification[];
  permits: CvPermit[];
  projects: CvProject[];
  interests: CvInterest[];
  interestsStyle: InterestsStyle;
  references: CvReference[];
  referencesAvailableOnRequest: boolean;
  customSections: CvCustomSection[];
  sectionOrder: CvSectionMeta[];
  qrCode: CvQrCode;
  signature: { enabled: boolean; sizePercent: number };
  dateFormat: DateFormat;
  experienceSort: SortOrder;
  educationSort: SortOrder;
};

function uid(): string { return crypto.randomUUID(); }

export function createDefaultSectionOrder(): CvSectionMeta[] {
  const kinds: CvSectionKind[] = ["profile", "experience", "education", "skills", "languages", "certifications", "projects", "interests", "permits", "references"];
  return kinds.map(kind => ({ id: kind, kind, titleOverride: null, visible: kind !== "certifications" && kind !== "projects" && kind !== "permits" }));
}

export function createEmptyCvData(cvLanguage: CvLanguage = "fr"): CvData {
  return {
    cvLanguage,
    personal: {
      firstName: "", lastName: "", jobTitle: "", targetRole: "",
      address: "", postalCode: "", city: "", country: "",
      phone: "", email: "", birthDate: "", nationality: "",
      website: "", linkedin: "", github: "", portfolio: "",
      customLinks: [], photo: null,
    },
    profileSummary: "",
    experiences: [],
    education: [],
    skills: [],
    skillsStyle: "bars",
    spokenLanguages: [],
    certifications: [],
    permits: [],
    projects: [],
    interests: [],
    interestsStyle: "tags",
    references: [],
    referencesAvailableOnRequest: false,
    customSections: [],
    sectionOrder: createDefaultSectionOrder(),
    qrCode: { enabled: false, url: "", sizePercent: 14, position: "bottom-right" },
    signature: { enabled: false, sizePercent: 55 },
    dateFormat: "monthYear",
    experienceSort: "manual",
    educationSort: "manual",
  };
}

export function newExperience(): CvExperience {
  return { id: uid(), jobTitle: "", company: "", city: "", country: "", startDate: "", endDate: "", current: false, description: "" };
}
export function newEducation(): CvEducation {
  return { id: uid(), degree: "", institution: "", city: "", country: "", startDate: "", endDate: "", description: "", honors: "" };
}
export function newSkill(): CvSkill { return { id: uid(), name: "", level: "intermediate" }; }
export function newSpokenLanguage(): CvSpokenLanguage { return { id: uid(), name: "", level: "B1" }; }
export function newCertification(): CvCertification { return { id: uid(), name: "", issuer: "", date: "", expiry: "", url: "" }; }
export function newPermit(): CvPermit { return { id: uid(), category: "B" }; }
export function newProject(): CvProject { return { id: uid(), name: "", description: "", technologies: "", date: "", url: "", imageDataUrl: null }; }
export function newInterest(): CvInterest { return { id: uid(), label: "", icon: null }; }
export function newReference(): CvReference { return { id: uid(), name: "", jobTitle: "", company: "", phone: "", email: "" }; }
export function newCustomSection(title: string): CvCustomSection { return { id: uid(), title, items: [] }; }
export function newCustomItem(): CvCustomItem { return { id: uid(), title: "", subtitle: "", date: "", description: "" }; }
export function newLink(): CvLink { return { id: uid(), label: "", url: "" }; }
