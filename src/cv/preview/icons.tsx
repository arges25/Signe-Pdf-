import { Award, Briefcase, Calendar, Car, FolderGit2, Globe, GraduationCap, Heart, Languages as LanguagesIcon, Link as LinkIcon, Mail, MapPin, Phone, User } from "lucide-react";

// lucide-react no longer ships trademarked brand icons (GitHub, LinkedIn),
// so social/profile links share a generic "external link" glyph — the
// adjacent label text already says which service it is.
export const CONTACT_ICONS = { phone: Phone, email: Mail, address: MapPin, website: Globe, linkedin: LinkIcon, github: LinkIcon, link: LinkIcon, permit: Car, calendar: Calendar };

export const SECTION_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  profile: User, experience: Briefcase, education: GraduationCap, skills: Award,
  languages: LanguagesIcon, certifications: Award, projects: FolderGit2, interests: Heart,
  permits: Car, references: User, custom: Award,
};
