import type { CvPhoto } from "../types/cv-data";

const SHAPE_RADIUS: Record<CvPhoto["shape"], string> = { round: "999pt", square: "0", rounded: "8pt", portrait: "6pt" };
const SHAPE_ASPECT: Record<CvPhoto["shape"], string> = { round: "1 / 1", square: "1 / 1", rounded: "1 / 1", portrait: "3 / 4" };

export default function CvPhotoView({ photo, basePt }: { photo: CvPhoto; basePt: number }) {
  const size = basePt * (photo.sizePercent / 100);
  const width = photo.shape === "portrait" ? size * 0.8 : size;
  return <div style={{
    width, height: photo.shape === "portrait" ? width / (3 / 4) : width,
    borderRadius: SHAPE_RADIUS[photo.shape],
    aspectRatio: SHAPE_ASPECT[photo.shape],
    overflow: "hidden", flexShrink: 0,
    border: photo.borderWidth > 0 ? `${photo.borderWidth}pt solid ${photo.borderColor}` : "none",
    boxSizing: "content-box",
  }}>
    <img src={photo.dataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
  </div>;
}
