import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SUPPORTED_LANGUAGES, changeAppLanguage, type AppLanguage } from "./index";

const FLAGS: Record<AppLanguage, string> = { fr: "🇫🇷", en: "🇬🇧", de: "🇩🇪", tr: "🇹🇷" };

// Discreet, single-row trigger — deliberately not four wide buttons, so it
// stays out of the way of the home screen's own content on a small phone.
export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const current = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language) ? (i18n.language as AppLanguage) : "fr";

  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" className="language-switcher" aria-label={t("language.selectLabel")}>
        <Globe size={15} />
        <span aria-hidden="true">{FLAGS[current]}</span>
        <span className="language-switcher-code">{current.toUpperCase()}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="language-switcher-menu">
      {SUPPORTED_LANGUAGES.map(lang => <DropdownMenuItem key={lang} onSelect={() => changeAppLanguage(lang)} data-active={lang === current}>
        <span aria-hidden="true">{FLAGS[lang]}</span> {t(`language.${lang}`)}
      </DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}
