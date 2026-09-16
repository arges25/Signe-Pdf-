import type { CvData } from "../types/cv-data";
import type { CvTheme } from "../types/theme";
import type { CvTemplateConfig } from "../types/template";
import type { SignatureAsset } from "@/lib/pdf-signing";
import { useCvPagination, blockMargins } from "./pagination";
import type { FlowBlock } from "./flow-blocks";
import { renderFlowBlock } from "./render-block";
import { bodyStyle } from "./style-helpers";
import CvHeader from "./CvHeader";
import CvQr from "./CvQr";
import { A4_WIDTH_PT, A4_HEIGHT_PT } from "./layout-constants";

function usePaginatedCv(data: CvData, theme: CvTheme, template: CvTemplateConfig) {
  const contentWidth = A4_WIDTH_PT - theme.margin * 2;
  const sidebarWidth = theme.columns === 2 ? contentWidth * (theme.sidebarWidthPercent / 100) - 10 : 0;
  const mainWidth = theme.columns === 2 ? contentWidth - contentWidth * (theme.sidebarWidthPercent / 100) - 10 : contentWidth;
  return useCvPagination(data, theme, template, mainWidth, sidebarWidth);
}

function QrOverlay({ data, theme }: { data: CvData; theme: CvTheme }) {
  if (!data.qrCode.enabled || !data.qrCode.url.trim()) return null;
  const sizePt = A4_WIDTH_PT * (data.qrCode.sizePercent / 100);
  const posStyle: React.CSSProperties = { position: "absolute" };
  if (data.qrCode.position === "bottom-right") { posStyle.right = theme.margin; posStyle.bottom = theme.margin; }
  else if (data.qrCode.position === "bottom-left") { posStyle.left = theme.margin; posStyle.bottom = theme.margin; }
  else if (data.qrCode.position === "top-right") { posStyle.right = theme.margin; posStyle.top = theme.margin; }
  else { posStyle.left = theme.margin; posStyle.top = theme.margin; }
  return <div style={posStyle}><CvQr url={data.qrCode.url} sizePt={sizePt} /></div>;
}

function SignatureOverlay({ data, theme, signature }: { data: CvData; theme: CvTheme; signature: SignatureAsset | null }) {
  if (!data.signature.enabled || !signature) return null;
  const width = 90 * (data.signature.sizePercent / 100);
  const height = width * (signature.height / signature.width);
  return <div style={{ position: "absolute", right: theme.margin, bottom: theme.margin }}>
    <img src={signature.dataUrl} alt="" style={{ width, height, display: "block" }} />
  </div>;
}

function BlockWrapper({ block, theme, children }: { block: FlowBlock; theme: CvTheme; children: React.ReactNode }) {
  const margins = blockMargins(block.kind, theme);
  return <div style={{ marginTop: `${margins.top}pt`, marginBottom: `${margins.bottom}pt` }}>{children}</div>;
}

export default function CvRenderer({ data, theme, template, signature }: { data: CvData; theme: CvTheme; template: CvTemplateConfig; signature: SignatureAsset | null }) {
  const { pages, ready } = usePaginatedCv(data, theme, template);
  const showPhoto = Boolean(data.personal.photo);
  const isSidebarHeader = template.headerVariant === "sidebar-photo" && theme.columns === 2;

  if (!ready) return <div className="cv-page" style={{ width: A4_WIDTH_PT, height: A4_HEIGHT_PT, background: theme.colors.background }} />;

  return <>
    {pages.map((page, pageIndex) => {
      const isLast = pageIndex === pages.length - 1;
      const isFirst = pageIndex === 0;
      return <div key={pageIndex} className="cv-page" style={{ width: A4_WIDTH_PT, height: A4_HEIGHT_PT, background: theme.colors.background, position: "relative", overflow: "hidden", display: "flex" }}>
        {theme.columns === 2 && <div style={{ width: `${theme.sidebarWidthPercent}%`, background: theme.colors.sidebarBackground, padding: `${theme.margin}pt 14pt`, boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {isFirst && isSidebarHeader && <CvHeader data={data} theme={theme} variant={template.headerVariant} showPhoto={showPhoto} inSidebar />}
          {page.sidebar.map(block => <BlockWrapper key={block.id} block={block} theme={theme}>{renderFlowBlock(block, data, theme, template.sectionHeaderVariant, template.experienceVariant, true)}</BlockWrapper>)}
        </div>}
        <div style={{ flex: 1, padding: `${theme.margin}pt`, boxSizing: "border-box", display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
          {isFirst && !isSidebarHeader && <CvHeader data={data} theme={theme} variant={template.headerVariant} showPhoto={showPhoto} />}
          {page.main.map(block => <BlockWrapper key={block.id} block={block} theme={theme}>{renderFlowBlock(block, data, theme, template.sectionHeaderVariant, template.experienceVariant, false)}</BlockWrapper>)}
        </div>
        {isLast && <QrOverlay data={data} theme={theme} />}
        {isLast && <SignatureOverlay data={data} theme={theme} signature={signature} />}
        <div style={{ position: "absolute", bottom: "8pt", left: 0, right: 0, textAlign: "center", ...bodyStyle(theme), fontSize: 7, color: theme.colors.secondary, opacity: pages.length > 1 ? 0.6 : 0 }}>{pageIndex + 1} / {pages.length}</div>
      </div>;
    })}
  </>;
}
