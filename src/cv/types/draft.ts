import type { CvData } from "./cv-data";
import type { CvTemplateId } from "./template";
import type { CvTheme } from "./theme";

export type CvDraft = {
  id: string;
  name: string;
  templateId: CvTemplateId;
  data: CvData;
  theme: CvTheme;
  createdAt: number;
  updatedAt: number;
};
