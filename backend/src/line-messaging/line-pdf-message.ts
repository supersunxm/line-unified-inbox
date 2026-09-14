import { PDF_MIME_TYPE } from "../media/pdf-media";

export function formatPdfSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
export function buildPdfFlexMessage(input: { filename: string; fileSize: number; url: string }) {
  const parsedUrl = new URL(input.url);
  if (parsedUrl.protocol !== "https:") throw new Error("Customer PDF URL must use HTTPS");
  const filename = input.filename.length > 100 ? `${input.filename.slice(0, 97)}...` : input.filename;
  return {
    type: "flex",
    altText: `PDF: ${filename}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: "📄 PDF", weight: "bold", size: "md", color: "#111111" },
          { type: "text", text: filename, wrap: true, size: "sm", color: "#333333" },
          { type: "text", text: `${PDF_MIME_TYPE} · ${formatPdfSize(input.fileSize)}`, size: "xs", color: "#777777" },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [{ type: "button", style: "link", action: { type: "uri", label: "เปิดเอกสาร", uri: input.url } }],
      },
    },
  };
}
