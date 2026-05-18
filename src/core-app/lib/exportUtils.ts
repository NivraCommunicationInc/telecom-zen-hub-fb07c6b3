/**
 * Core export utilities — generic CSV downloader for admin pages.
 */
export interface CsvColumn {
  key: string;
  label: string;
}

export const exportToCSV = (
  data: Record<string, any>[],
  filename: string,
  headers: CsvColumn[],
) => {
  if (!data?.length) return;
  const csvHeaders = headers.map((h) => `"${h.label.replace(/"/g, '""')}"`).join(",");
  const csvRows = data.map((row) =>
    headers
      .map((h) => {
        const val = row[h.key] ?? "";
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(","),
  );
  const csv = [csvHeaders, ...csvRows].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
