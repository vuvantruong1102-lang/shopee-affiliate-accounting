"use client";

import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import { buildCsv, downloadCsv } from "@/lib/csv-export";
import {
  PERSONAL_DEDUCTION_MONTHLY,
  DEPENDENT_DEDUCTION_MONTHLY,
} from "@/lib/tax-calculator";
import type { AffiliateAccount } from "@/types/database";
import type { YtdTaxResult } from "@/lib/ytd-tax";

interface Props {
  affiliate: AffiliateAccount;
  ytdResult: YtdTaxResult;
  year: number;
  monthsElapsed: number;
  monthlyData: Array<{
    month: number;
    gross: number;
    tax: number;
    net: number;
    count: number;
  }>;
  ytdGross: number;
  ytdTax: number;
  ytdNet: number;
}

export function TaxExportButtons(props: Props) {
  const { affiliate: a, ytdResult: r, year, monthsElapsed, monthlyData } = props;

  function downloadHtml() {
    const html = buildHtmlReport(props);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeName = a.full_name.replace(/[^a-z0-9]/gi, "_");
    link.download = `quyet-toan-thue-TNCN-${safeName}-${year}.html`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Đã tải file HTML. Mở file → Ctrl+P để in/lưu PDF");
  }

  function downloadCsvFile() {
    const headers = ["Tháng", "Số đợt HH", "HH Gross", "Thuế Shopee KT", "Lương công ty", "Tổng TN"];
    const rows: (string | number)[][] = [];

    const salaryPerMonth = a.has_company_salary ? Number(a.monthly_salary_gross) : 0;

    for (const m of monthlyData.slice(0, monthsElapsed)) {
      const total = m.gross + salaryPerMonth;
      rows.push([
        `Tháng ${m.month}/${year}`,
        m.count,
        m.gross,
        m.tax,
        salaryPerMonth,
        total,
      ]);
    }

    // Tổng cộng
    rows.push([
      `TỔNG YTD`,
      monthlyData.reduce((s, m) => s + m.count, 0),
      props.ytdGross,
      props.ytdTax,
      r.breakdown.salaryGross,
      r.totalIncomeYtd,
    ]);
    rows.push([]);

    // Phần quyết toán
    rows.push(["=== BẢNG TÍNH THUẾ QUYẾT TOÁN ==="]);
    rows.push(["Khoản mục", "Số tiền"]);
    rows.push(["Tổng thu nhập YTD", r.totalIncomeYtd]);
    rows.push(["Giảm trừ bản thân", r.breakdown.personalDeduction]);
    rows.push([`Giảm trừ ${a.dependent_count} người phụ thuộc`, r.breakdown.dependentDeduction]);
    rows.push(["Tổng giảm trừ", r.totalDeductionYtd]);
    rows.push(["Thu nhập tính thuế", r.taxableIncomeYtd]);
    rows.push(["Thuế phải nộp (lũy tiến 5 bậc)", r.taxPayableYtd]);
    rows.push(["Thuế đã khấu trừ", r.taxWithheldYtd]);
    rows.push([
      r.status === "refund" ? "Số thuế được hoàn" : "Số thuế còn phải nộp",
      Math.abs(r.taxAdditional),
    ]);

    const csv = buildCsv(headers, rows);
    const safeName = a.full_name.replace(/[^a-z0-9]/gi, "_");
    downloadCsv(`quyet-toan-thue-TNCN-${safeName}-${year}.csv`, csv);
    toast.success("Đã tải file CSV (mở bằng Excel)");
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={downloadCsvFile}>
        <FileSpreadsheet className="w-4 h-4" />
        Tải Excel
      </Button>
      <Button onClick={downloadHtml}>
        <Download className="w-4 h-4" />
        Tải mẫu quyết toán
      </Button>
    </div>
  );
}

// ============================================================================
// Tạo HTML quyết toán đẹp, có thể in
// ============================================================================
function buildHtmlReport(props: Props): string {
  const { affiliate: a, ytdResult: r, year, monthsElapsed, monthlyData, ytdGross, ytdTax } = props;
  const today = new Date();
  const todayStr = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear()}`;
  const salaryPerMonth = a.has_company_salary ? Number(a.monthly_salary_gross) : 0;

  const monthRows = monthlyData
    .slice(0, monthsElapsed)
    .map(
      (m) => `
      <tr>
        <td>Tháng ${m.month}/${year}</td>
        <td style="text-align:center">${m.count}</td>
        <td style="text-align:right">${m.gross.toLocaleString("vi-VN")}</td>
        <td style="text-align:right">${m.tax.toLocaleString("vi-VN")}</td>
        <td style="text-align:right">${salaryPerMonth.toLocaleString("vi-VN")}</td>
        <td style="text-align:right"><strong>${(m.gross + salaryPerMonth).toLocaleString("vi-VN")}</strong></td>
      </tr>
    `,
    )
    .join("");

  const conclusionColor =
    r.status === "owe" ? "#f59e0b" : r.status === "refund" ? "#16a34a" : "#64748b";
  const conclusionText =
    r.status === "owe"
      ? `Số thuế còn phải nộp thêm: <strong style="color:${conclusionColor}">${formatCurrency(r.taxAdditional)}</strong>`
      : r.status === "refund"
        ? `Số thuế được hoàn lại: <strong style="color:${conclusionColor}">${formatCurrency(Math.abs(r.taxAdditional))}</strong>`
        : `Đã đóng đủ thuế: <strong>~0đ</strong>`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Bản tóm tắt quyết toán thuế TNCN - ${a.full_name} - ${year}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Times New Roman', Times, serif;
    color: #111;
    line-height: 1.6;
    padding: 30px 40px;
    max-width: 900px;
    margin: 0 auto;
    background: white;
  }
  h1 { font-size: 18pt; text-align: center; margin-bottom: 4px; text-transform: uppercase; }
  h2 { font-size: 13pt; margin: 18px 0 8px 0; padding-bottom: 4px; border-bottom: 2px solid #333; }
  h3 { font-size: 11pt; margin: 12px 0 6px 0; }
  .subtitle { text-align: center; color: #555; font-style: italic; margin-bottom: 20px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin: 10px 0 20px 0; }
  .info-grid div { font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10pt; }
  th, td { border: 1px solid #999; padding: 6px 10px; }
  th { background: #f0f0f0; text-align: left; font-weight: bold; }
  tfoot td { background: #f8f8f8; font-weight: bold; }
  .right { text-align: right; }
  .center { text-align: center; }
  .conclusion {
    margin: 20px 0;
    padding: 16px 20px;
    background: #f9fafb;
    border-left: 4px solid ${conclusionColor};
    font-size: 12pt;
  }
  .signature {
    margin-top: 50px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    text-align: center;
    font-size: 10pt;
  }
  .signature .role { font-weight: bold; text-transform: uppercase; }
  .signature .hint { color: #777; font-style: italic; margin-top: 3px; }
  .signature .space { height: 60px; }
  .legal-note {
    font-size: 9pt;
    color: #666;
    font-style: italic;
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px dashed #ccc;
  }
  @media print {
    body { padding: 15mm; }
    h1 { font-size: 16pt; }
    @page { size: A4; margin: 1.5cm; }
  }
</style>
</head>
<body>

<h1>Bản tóm tắt quyết toán thuế TNCN</h1>
<p class="subtitle">Năm ${year} (Năm chưa kết thúc: tính từ tháng 1 đến tháng ${monthsElapsed})</p>

<h2>I. Thông tin người nộp thuế</h2>
<div class="info-grid">
  <div><strong>Họ và tên:</strong> ${a.full_name}</div>
  <div><strong>MST cá nhân:</strong> ${a.tax_code || "(chưa khai)"}</div>
  <div><strong>CCCD/CMND:</strong> ${a.cccd || "(chưa khai)"}</div>
  <div><strong>Email:</strong> ${a.email}</div>
  <div><strong>Điện thoại:</strong> ${a.phone || "—"}</div>
  <div><strong>Người phụ thuộc:</strong> ${a.dependent_count} người</div>
</div>

<h2>II. Tổng hợp thu nhập từng tháng</h2>
<table>
  <thead>
    <tr>
      <th>Kỳ</th>
      <th class="center">Số đợt HH Shopee</th>
      <th class="right">HH Gross (đ)</th>
      <th class="right">Thuế Shopee KT (đ)</th>
      <th class="right">Lương công ty (đ)</th>
      <th class="right">Tổng TN (đ)</th>
    </tr>
  </thead>
  <tbody>${monthRows}</tbody>
  <tfoot>
    <tr>
      <td>TỔNG YTD</td>
      <td class="center">${monthlyData.reduce((s, m) => s + m.count, 0)}</td>
      <td class="right">${ytdGross.toLocaleString("vi-VN")}</td>
      <td class="right">${ytdTax.toLocaleString("vi-VN")}</td>
      <td class="right">${r.breakdown.salaryGross.toLocaleString("vi-VN")}</td>
      <td class="right">${r.totalIncomeYtd.toLocaleString("vi-VN")}</td>
    </tr>
  </tfoot>
</table>

<h2>III. Tính thuế quyết toán</h2>
<table>
  <tr>
    <td style="width:60%">1. Tổng thu nhập chịu thuế YTD</td>
    <td class="right"><strong>${r.totalIncomeYtd.toLocaleString("vi-VN")} đ</strong></td>
  </tr>
  ${
    a.has_personal_deduction
      ? `
  <tr>
    <td>2. Giảm trừ bản thân (${monthsElapsed} tháng × ${(PERSONAL_DEDUCTION_MONTHLY / 1_000_000).toFixed(1)}tr)</td>
    <td class="right">− ${r.breakdown.personalDeduction.toLocaleString("vi-VN")} đ</td>
  </tr>`
      : ""
  }
  ${
    a.dependent_count > 0
      ? `
  <tr>
    <td>3. Giảm trừ ${a.dependent_count} NPT (${monthsElapsed} tháng × ${a.dependent_count} × ${(DEPENDENT_DEDUCTION_MONTHLY / 1_000_000).toFixed(1)}tr)</td>
    <td class="right">− ${r.breakdown.dependentDeduction.toLocaleString("vi-VN")} đ</td>
  </tr>`
      : ""
  }
  <tr>
    <td><strong>4. Thu nhập tính thuế</strong></td>
    <td class="right"><strong>${r.taxableIncomeYtd.toLocaleString("vi-VN")} đ</strong></td>
  </tr>
  <tr>
    <td>5. Thuế phải nộp (lũy tiến 5 bậc — Luật 109/2025/QH15)</td>
    <td class="right"><strong>${r.taxPayableYtd.toLocaleString("vi-VN")} đ</strong></td>
  </tr>
  <tr>
    <td>6. Thuế đã khấu trừ trong năm</td>
    <td class="right">${r.taxWithheldYtd.toLocaleString("vi-VN")} đ</td>
  </tr>
</table>

<div class="conclusion">${conclusionText}</div>

<h2>IV. Căn cứ pháp lý</h2>
<ul style="margin-left:25px; font-size:10pt;">
  <li>Luật Thuế thu nhập cá nhân 2025 (số 109/2025/QH15)</li>
  <li>Nghị quyết 110/2025/UBTVQH15 về mức giảm trừ gia cảnh</li>
  <li>Thông tư 111/2013/TT-BTC (khấu trừ 10% vãng lai cho HH ≥ 2tr/lần)</li>
</ul>

<div class="signature">
  <div>
    <div class="role">Người lập</div>
    <div class="hint">(Ký, ghi rõ họ tên)</div>
    <div class="space"></div>
  </div>
  <div>
    <div>Hà Nội, ngày ${todayStr}</div>
    <div class="role">Người nộp thuế</div>
    <div class="hint">(Ký, ghi rõ họ tên)</div>
    <div class="space"></div>
    <div><strong>${a.full_name}</strong></div>
  </div>
</div>

<p class="legal-note">
  Bản tóm tắt này có giá trị tham khảo nội bộ. Để quyết toán chính thức với cơ quan thuế, vui lòng sử dụng mẫu 02/QTT-TNCN trên cổng eTax (thuedientu.gdt.gov.vn) hoặc app eTax Mobile.
</p>

</body>
</html>`;
}
