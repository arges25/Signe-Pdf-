import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL;

// Single shared "Easy Docs" wordmark image, used everywhere the app shows
// its name — the home screen and every tool's own header — so the two
// never drift apart again the way the old hardcoded "Signé." header text
// did. Uses the supplied brand artwork directly (no CSS-redrawn text).
export function BrandWordmark({ className }: { className?: string }) {
  return <picture className={`ed-tool-wordmark${className ? ` ${className}` : ""}`}>
    <source srcSet={`${BASE}brand/easy-docs-wordmark.webp`} type="image/webp" />
    <img src={`${BASE}brand/easy-docs-wordmark.png`} alt="Easy Docs" />
  </picture>;
}

export function PrivacyBadge() {
  const { t } = useTranslation();
  return <div className="local-badge"><ShieldCheck size={17} /><span>{t("header.privacyBadge")}</span></div>;
}
