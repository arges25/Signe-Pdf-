import { createEmptyCvData, newCertification, newEducation, newExperience, newInterest, newPermit, newSkill, newSpokenLanguage, type CvData } from "./types/cv-data";

// Used only to preview templates before the user has entered their own
// data (template gallery thumbnails, "try this template" quick look).
export function sampleCvData(): CvData {
  const data = createEmptyCvData("fr");
  data.personal = {
    ...data.personal,
    firstName: "Camille", lastName: "Dubois", jobTitle: "Cheffe de projet digital", targetRole: "Cheffe de projet digital",
    address: "12 rue des Lilas", postalCode: "75011", city: "Paris", country: "France",
    phone: "06 12 34 56 78", email: "camille.dubois@email.com",
    website: "camilledubois.fr", linkedin: "linkedin.com/in/camilledubois",
    photo: null,
  };
  data.profileSummary = "Cheffe de projet digital avec 6 ans d’expérience dans le pilotage de produits web et mobiles. Je conçois des solutions centrées utilisateur, en lien étroit avec les équipes design et développement.";
  data.experiences = [
    { ...newExperience(), jobTitle: "Cheffe de projet digital", company: "Numérique & Co", city: "Paris", country: "France", startDate: "2022-03", endDate: "", current: true, description: "Pilotage de 3 refontes de plateformes e-commerce.\nCoordination d’une équipe de 8 personnes (design, dev, QA).\nAugmentation du taux de conversion de 24%." },
    { ...newExperience(), jobTitle: "Chargée de projet web", company: "Studio Pixel", city: "Lyon", country: "France", startDate: "2019-09", endDate: "2022-02", current: false, description: "Gestion de projets clients de la conception à la mise en ligne.\nMise en place d’un processus agile pour l’équipe." },
  ];
  data.education = [
    { ...newEducation(), degree: "Master Management de Projets Digitaux", institution: "Université Paris-Dauphine", city: "Paris", country: "France", startDate: "2017-09", endDate: "2019-06", description: "", honors: "Mention Bien" },
  ];
  data.skills = [
    { ...newSkill(), name: "Gestion de projet", level: "expert" },
    { ...newSkill(), name: "Figma", level: "advanced" },
    { ...newSkill(), name: "Scrum / Agile", level: "advanced" },
    { ...newSkill(), name: "SQL", level: "intermediate" },
  ];
  data.spokenLanguages = [
    { ...newSpokenLanguage(), name: "Français", level: "native" },
    { ...newSpokenLanguage(), name: "Anglais", level: "C1" },
    { ...newSpokenLanguage(), name: "Espagnol", level: "B1" },
  ];
  data.certifications = [{ ...newCertification(), name: "PSM I", issuer: "Scrum.org", date: "2021" }];
  data.permits = [{ ...newPermit(), category: "B" }];
  data.interests = [newInterest(), newInterest(), newInterest()].map((it, i) => ({ ...it, label: ["Photographie", "Course à pied", "Voyages"][i] }));
  data.sectionOrder = data.sectionOrder.map(s => ["certifications", "permits"].includes(s.kind) ? { ...s, visible: true } : s);
  return data;
}
