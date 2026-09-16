import type { CvCertification, CvCustomItem, CvCustomSection, CvData, CvEducation, CvExperience, CvProject, CvSectionMeta } from "../types/cv-data";
import { cvStrings } from "../cv-i18n";

export function isTitleBlock(kind: FlowBlock["kind"]): boolean { return kind === "section-title" || kind === "custom-title"; }

export type FlowBlock =
  | { id: string; kind: "section-title"; section: CvSectionMeta; label: string }
  | { id: string; kind: "profile-text"; text: string }
  | { id: string; kind: "experience-item"; item: CvExperience }
  | { id: string; kind: "education-item"; item: CvEducation }
  | { id: string; kind: "skills-list" }
  | { id: string; kind: "languages-list" }
  | { id: string; kind: "certification-item"; item: CvCertification }
  | { id: string; kind: "project-item"; item: CvProject }
  | { id: string; kind: "interests-block" }
  | { id: string; kind: "permits-block" }
  | { id: string; kind: "references-block" }
  | { id: string; kind: "custom-title"; section: CvCustomSection }
  | { id: string; kind: "custom-item"; sectionId: string; item: CvCustomItem };

function sortedExperiences(data: CvData): CvExperience[] {
  if (data.experienceSort !== "recentFirst") return data.experiences;
  return [...data.experiences].sort((a, b) => (b.current ? "9999" : b.endDate || b.startDate).localeCompare(a.current ? "9999" : a.endDate || a.startDate));
}
function sortedEducation(data: CvData): CvEducation[] {
  if (data.educationSort !== "recentFirst") return data.education;
  return [...data.education].sort((a, b) => (b.endDate || b.startDate).localeCompare(a.endDate || a.startDate));
}

function blocksForSection(data: CvData, section: CvSectionMeta): FlowBlock[] {
  const strings = cvStrings(data.cvLanguage);
  const label = section.titleOverride ?? (section.kind !== "custom" ? strings.sections[section.kind] : "");
  const title: FlowBlock = { id: `title-${section.id}`, kind: "section-title", section, label };
  switch (section.kind) {
    case "profile":
      return data.profileSummary.trim() ? [title, { id: "profile-body", kind: "profile-text", text: data.profileSummary }] : [];
    case "experience":
      return sortedExperiences(data).length ? [title, ...sortedExperiences(data).map((item): FlowBlock => ({ id: `exp-${item.id}`, kind: "experience-item", item }))] : [];
    case "education":
      return sortedEducation(data).length ? [title, ...sortedEducation(data).map((item): FlowBlock => ({ id: `edu-${item.id}`, kind: "education-item", item }))] : [];
    case "skills":
      return data.skills.length ? [title, { id: "skills-body", kind: "skills-list" }] : [];
    case "languages":
      return data.spokenLanguages.length ? [title, { id: "languages-body", kind: "languages-list" }] : [];
    case "certifications":
      return data.certifications.length ? [title, ...data.certifications.map((item): FlowBlock => ({ id: `cert-${item.id}`, kind: "certification-item", item }))] : [];
    case "projects":
      return data.projects.length ? [title, ...data.projects.map((item): FlowBlock => ({ id: `proj-${item.id}`, kind: "project-item", item }))] : [];
    case "interests":
      return data.interests.length ? [title, { id: "interests-body", kind: "interests-block" }] : [];
    case "permits":
      return data.permits.length ? [title, { id: "permits-body", kind: "permits-block" }] : [];
    case "references":
      return (data.references.length || data.referencesAvailableOnRequest) ? [title, { id: "references-body", kind: "references-block" }] : [];
    default:
      return [];
  }
}

function blocksForCustomSection(section: CvCustomSection): FlowBlock[] {
  if (!section.items.length) return [];
  const title: FlowBlock = { id: `title-${section.id}`, kind: "custom-title", section };
  return [title, ...section.items.map((item): FlowBlock => ({ id: `custom-${item.id}`, kind: "custom-item", sectionId: section.id, item }))];
}

export function buildFlowBlocks(data: CvData, sidebarKinds: string[]): { main: FlowBlock[]; sidebar: FlowBlock[] } {
  const main: FlowBlock[] = [];
  const sidebar: FlowBlock[] = [];
  const customById = new Map(data.customSections.map(s => [s.id, s]));
  const seenCustom = new Set<string>();

  for (const meta of data.sectionOrder) {
    if (!meta.visible) continue;
    const target = sidebarKinds.includes(meta.kind) ? sidebar : main;
    if (meta.kind === "custom") {
      const section = customById.get(meta.id);
      if (!section) continue;
      seenCustom.add(meta.id);
      target.push(...blocksForCustomSection(section));
    } else {
      target.push(...blocksForSection(data, meta));
    }
  }
  // Any custom section not yet placed in sectionOrder (e.g. freshly added) still renders, appended to main.
  for (const section of data.customSections) {
    if (!seenCustom.has(section.id)) main.push(...blocksForCustomSection(section));
  }
  return { main, sidebar };
}
