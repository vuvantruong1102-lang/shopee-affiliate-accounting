/**
 * Helper xuất file Excel-friendly CSV (UTF-8 BOM) cho phép nhiều bảng trong 1 file.
 * Mỗi section có tiêu đề + bảng riêng, cách nhau bằng dòng trống.
 */

export interface CsvSection {
  title?: string;
  subtitle?: string;
  headers?: string[];
  rows: (string | number | null | undefined)[][];
}

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Nếu chứa dấu phẩy, dấu nháy kép, xuống dòng → bọc bằng dấu nháy kép
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildMultiSectionCsv(sections: CsvSection[]): string {
  const lines: string[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];

    if (section.title) {
      lines.push(escapeCell(section.title));
    }
    if (section.subtitle) {
      lines.push(escapeCell(section.subtitle));
    }
    if (section.title || section.subtitle) {
      lines.push(""); // dòng trống sau tiêu đề
    }

    if (section.headers && section.headers.length > 0) {
      lines.push(section.headers.map(escapeCell).join(","));
    }

    for (const row of section.rows) {
      lines.push(row.map(escapeCell).join(","));
    }

    // Dòng trống ngăn cách giữa các section (trừ section cuối)
    if (i < sections.length - 1) {
      lines.push("");
      lines.push("");
    }
  }

  return lines.join("\r\n");
}

export function downloadCsvWithBom(filename: string, csvContent: string): void {
  // UTF-8 BOM để Excel mở đúng tiếng Việt
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
