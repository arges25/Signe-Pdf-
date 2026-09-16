const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * The `docx` package hardcodes noChangeAspect="1" on every embedded picture's
 * picLocks/graphicFrameLocks, which stops Word users from freely resizing images
 * (only proportional corner-drag works, and some Word versions disable resize
 * handles entirely). There is no public option to opt out, so patch the raw XML
 * after packing to strip those locks and leave images freely resizable.
 */
export async function unlockDocxImageResize(blob: Blob): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const docXml = zip.file("word/document.xml");
  if (!docXml) return blob;
  const xml = await docXml.async("string");
  const patched = xml
    .replace(/<a:picLocks[^>]*\/>/g, "")
    .replace(/<a:graphicFrameLocks[^>]*\/>/g, "");
  if (patched === xml) return blob;
  zip.file("word/document.xml", patched);
  return zip.generateAsync({ type: "blob", mimeType: DOCX_MIME, compression: "DEFLATE" });
}
