import { api } from "@/lib/api";

export async function downloadStore360Export(options: {
  storeIds: string[];
  startDate: string;
  endDate: string;
}) {
  const { blob, filename } = await api.storeInsightsExport({
    storeIds: options.storeIds,
    startDate: options.startDate,
    endDate: options.endDate,
    timezone: "Asia/Bangkok",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename ?? `store-360_multi_${options.startDate.replaceAll("-", "")}-${options.endDate.replaceAll("-", "")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}
