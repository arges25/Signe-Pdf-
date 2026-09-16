import { useTranslation } from "react-i18next";
import { AreaField } from "./fields";

export default function ProfileForm({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  return <div className="cv-form">
    <AreaField label={t("cv.sections.profile")} value={value} onChange={onChange} rows={6} />
  </div>;
}
