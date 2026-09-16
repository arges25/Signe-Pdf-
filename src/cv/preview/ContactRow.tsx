import type { CvData } from "../types/cv-data";
import type { CvTheme } from "../types/theme";
import { CONTACT_ICONS } from "./icons";
import { bodyStyle } from "./style-helpers";

export default function ContactRow({ data, theme, inSidebar, vertical }: { data: CvData; theme: CvTheme; inSidebar?: boolean; vertical?: boolean }) {
  const p = data.personal;
  const items: { icon: keyof typeof CONTACT_ICONS; text: string }[] = [];
  if (p.phone) items.push({ icon: "phone", text: p.phone });
  if (p.email) items.push({ icon: "email", text: p.email });
  const address = [p.address, p.postalCode, p.city, p.country].filter(Boolean).join(", ");
  if (address) items.push({ icon: "address", text: address });
  if (p.website) items.push({ icon: "website", text: p.website });
  if (p.linkedin) items.push({ icon: "linkedin", text: p.linkedin });
  if (p.github) items.push({ icon: "github", text: p.github });
  if (p.portfolio) items.push({ icon: "link", text: p.portfolio });
  for (const link of p.customLinks) if (link.url) items.push({ icon: "link", text: link.label ? `${link.label}: ${link.url}` : link.url });

  const color = inSidebar ? theme.colors.sidebarText : theme.colors.text;
  return <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", flexWrap: "wrap", gap: vertical ? "4pt" : "3pt 14pt" }}>
    {items.map((item, i) => {
      const Icon = CONTACT_ICONS[item.icon];
      return <span key={i} style={{ ...bodyStyle(theme), color, display: "inline-flex", alignItems: "center", gap: "5pt", fontSize: theme.sizeBody * 0.94 }}>
        {theme.icons && <Icon size={theme.sizeBody * 0.95} />}{item.text}
      </span>;
    })}
  </div>;
}
