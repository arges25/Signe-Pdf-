import type { CvData } from "../types/cv-data";
import type { CvTheme } from "../types/theme";
import type { HeaderVariant } from "../types/template";
import CvPhotoView from "./CvPhoto";
import ContactRow from "./ContactRow";
import { nameStyle, jobTitleStyle } from "./style-helpers";

function fullName(data: CvData): string { return [data.personal.firstName, data.personal.lastName].filter(Boolean).join(" "); }
function titleLine(data: CvData): string { return data.personal.jobTitle || data.personal.targetRole; }

export default function CvHeader({ data, theme, variant, showPhoto, inSidebar }: { data: CvData; theme: CvTheme; variant: HeaderVariant; showPhoto: boolean; inSidebar?: boolean }) {
  const photo = showPhoto ? data.personal.photo : null;

  if (inSidebar) {
    return <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "10pt", marginBottom: "16pt" }}>
      {photo && <CvPhotoView photo={photo} basePt={86} />}
      <div>
        <h1 style={{ ...nameStyle(theme), color: theme.colors.sidebarText, fontSize: `${theme.sizeName * 0.82}pt` }}>{fullName(data)}</h1>
        {titleLine(data) && <p style={{ ...jobTitleStyle(theme), color: theme.colors.sidebarText, opacity: 0.85 }}>{titleLine(data)}</p>}
      </div>
      <ContactRow data={data} theme={theme} inSidebar vertical />
    </div>;
  }

  if (variant === "banner") return <div style={{ background: theme.colors.primary, margin: `-${theme.margin}pt -${theme.margin}pt 16pt`, padding: `${theme.margin}pt ${theme.margin}pt 16pt` }}>
    <div style={{ display: "flex", alignItems: "center", gap: "14pt" }}>
      {photo && <CvPhotoView photo={photo} basePt={72} />}
      <div>
        <h1 style={{ ...nameStyle(theme), color: "#fff" }}>{fullName(data)}</h1>
        {titleLine(data) && <p style={{ ...jobTitleStyle(theme), color: "#ffffffcc" }}>{titleLine(data)}</p>}
      </div>
    </div>
    <div style={{ marginTop: "10pt" }}><ContactRow data={data} theme={{ ...theme, colors: { ...theme.colors, text: "#ffffffe6" } }} /></div>
  </div>;

  if (variant === "centered") return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "8pt", marginBottom: "18pt" }}>
    {photo && <CvPhotoView photo={photo} basePt={70} />}
    <h1 style={nameStyle(theme)}>{fullName(data)}</h1>
    {titleLine(data) && <p style={jobTitleStyle(theme)}>{titleLine(data)}</p>}
    <ContactRow data={data} theme={theme} />
  </div>;

  if (variant === "split") return <div style={{ display: "flex", gap: "14pt", alignItems: "stretch", marginBottom: "16pt", background: `${theme.colors.primary}0f`, borderRadius: "6pt", overflow: "hidden" }}>
    <div style={{ background: theme.colors.primary, padding: "14pt", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {photo ? <CvPhotoView photo={photo} basePt={64} /> : <div style={{ width: 64, color: "#fff" }} />}
    </div>
    <div style={{ padding: "14pt 14pt 14pt 0", display: "flex", flexDirection: "column", justifyContent: "center", gap: "6pt" }}>
      <h1 style={nameStyle(theme)}>{fullName(data)}</h1>
      {titleLine(data) && <p style={jobTitleStyle(theme)}>{titleLine(data)}</p>}
      <ContactRow data={data} theme={theme} />
    </div>
  </div>;

  // "classic" (default)
  return <div style={{ display: "flex", gap: "14pt", alignItems: "center", marginBottom: "16pt" }}>
    {photo && <CvPhotoView photo={photo} basePt={68} />}
    <div style={{ flex: 1 }}>
      <h1 style={nameStyle(theme)}>{fullName(data)}</h1>
      {titleLine(data) && <p style={jobTitleStyle(theme)}>{titleLine(data)}</p>}
      <div style={{ marginTop: "8pt" }}><ContactRow data={data} theme={theme} /></div>
    </div>
  </div>;
}
