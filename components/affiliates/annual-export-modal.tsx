"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, FileSpreadsheet, X, Download } from "lucide-react";
import { toast } from "sonner";
import { getAffiliateAnnualData } from "@/app/(dashboard)/affiliates/[id]/export/actions";
import { buildMultiSectionCsv, downloadCsvWithBom, type CsvSection } from "@/lib/csv-multi-section";

interface Props {
  open: boolean;
  onClose: () => void;
  affiliateId: string;
  affiliateName: string;
}

function pct(part: number, total: number): string {
  if (total === 0) return "";
  return ((part / total) * 100).toFixed(2) + "%";
}

const MONTH_NAMES = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

export function AnnualExportModal({ open, onClose, affiliateId, affiliateName }: Props) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleExport() {
    setLoading(true);
    try {
      const result = await getAffiliateAnnualData(affiliateId, year);

      if (result.error || !result.data) {
        toast.error(result.error || "Không lấy được dữ liệu");
        return;
      }

      const d = result.data;
      const sections: CsvSection[] = [];

      // ============ SECTION 1: Thông tin chung ============
      sections.push({
        title: `HỒ SƠ QUYẾT TOÁN THUẾ TNCN NĂM ${d.year}`,
        subtitle: `Affiliate: ${d.affiliate.full_name}`,
        rows: [
          ["Họ tên:", d.affiliate.full_name],
          ["CCCD/CMND:", d.affiliate.cccd ?? "—"],
          ["MST cá nhân:", d.affiliate.mst ?? "—"],
          ["Email:", d.affiliate.email ?? "—"],
          ["Điện thoại:", d.affiliate.phone ?? "—"],
          ["Địa chỉ:", d.affiliate.address ?? "—"],
          ["TK nhận tiền:",
            `${d.affiliate.bank_name ?? "—"} · ${d.affiliate.bank_account_number ?? "—"} · ${d.affiliate.bank_account_holder ?? "—"}`,
          ],
          [],
          ["Giảm trừ bản thân:", d.affiliate.has_personal_deduction ? "Có (15.500.000đ/tháng)" : "Không"],
          ["Số người phụ thuộc:", `${d.affiliate.dependent_count} người`],
          ["Có lương công ty:", d.affiliate.has_company_salary ? `Có (${d.affiliate.monthly_salary_gross.toLocaleString("vi-VN")}đ/tháng)` : "Không"],
        ],
      });

      // ============ SECTION 2: Tổng kết năm ============
      sections.push({
        title: "TỔNG KẾT DOANH THU NĂM",
        headers: ["Khoản mục", "Số tiền (VNĐ)", "Ghi chú"],
        rows: [
          ["Tổng hoa hồng Gross", d.totals.gross.toLocaleString("vi-VN"), `${d.totals.commission_count} đợt`],
          ["Thuế Shopee đã KT 10%", d.totals.tax_withheld.toLocaleString("vi-VN"), ""],
          ["Tổng hoa hồng Net", d.totals.net.toLocaleString("vi-VN"), "Gross - Thuế"],
          [],
          ["Đã thực nhận (Status: received)", d.totals.received.toLocaleString("vi-VN"), ""],
          ["Chưa nhận (Status: pending)", d.totals.pending.toLocaleString("vi-VN"), ""],
          [],
          ["Đã nộp vào TK công ty", d.totals.total_deposited.toLocaleString("vi-VN"), ""],
          ["Còn cầm chưa nộp",
            d.totals.undeposited > 0
              ? d.totals.undeposited.toLocaleString("vi-VN")
              : `Vượt ${Math.abs(d.totals.undeposited).toLocaleString("vi-VN")}`,
            "Đã nhận - Đã nộp",
          ],
        ],
      });

      // ============ SECTION 3: Breakdown theo tháng ============
      sections.push({
        title: "BẢNG KÊ HOA HỒNG THEO TỪNG THÁNG",
        headers: ["Tháng", "Số đợt", "Gross (VNĐ)", "Thuế 10% (VNĐ)", "Net (VNĐ)"],
        rows: [
          ...d.monthly_breakdown.map((m) => [
            MONTH_NAMES[m.month - 1],
            m.commission_count,
            m.gross.toLocaleString("vi-VN"),
            m.tax_withheld.toLocaleString("vi-VN"),
            m.net.toLocaleString("vi-VN"),
          ]),
          [],
          [
            "TỔNG NĂM",
            d.totals.commission_count,
            d.totals.gross.toLocaleString("vi-VN"),
            d.totals.tax_withheld.toLocaleString("vi-VN"),
            d.totals.net.toLocaleString("vi-VN"),
          ],
        ],
      });

      // ============ SECTION 4: Chi tiết từng đợt ============
      sections.push({
        title: "CHI TIẾT TỪNG ĐỢT HOA HỒNG",
        subtitle: `${d.commissions.length} đợt trong năm ${d.year}`,
        headers: [
          "STT", "Ngày chốt", "Mã thanh toán Shopee", "Kỳ",
          "Gross (VNĐ)", "Thuế 10% (VNĐ)", "Net (VNĐ)", "Trạng thái", "Ngày nhận tiền",
        ],
        rows: d.commissions.map((c, i) => [
          i + 1,
          c.earned_date,
          c.payment_code ?? "—",
          `T${c.period_month}/${c.period_year}`,
          c.gross.toLocaleString("vi-VN"),
          c.tax_withheld.toLocaleString("vi-VN"),
          c.net.toLocaleString("vi-VN"),
          c.status === "received" ? "Đã nhận" : "Chờ nhận",
          c.received_date ?? "—",
        ]),
      });

      // ============ SECTION 5: Chi tiết nộp tiền ============
      sections.push({
        title: "CHI TIẾT NỘP TIỀN VÀO CÔNG TY",
        subtitle: `${d.deposits.length} lượt nộp trong năm ${d.year}`,
        headers: ["STT", "Ngày nộp", "Số tiền (VNĐ)", "TK ngân hàng", "Số TK", "Ghi chú"],
        rows: d.deposits.length === 0
          ? [["—", "Không có giao dịch nộp tiền nào", "", "", "", ""]]
          : d.deposits.map((dep, i) => [
              i + 1,
              dep.date,
              dep.amount.toLocaleString("vi-VN"),
              dep.bank_name,
              dep.account_number,
              dep.notes ?? "",
            ]),
      });

      // ============ SECTION 6: Tính thuế chi tiết ============
      sections.push({
        title: "TÍNH THUẾ TNCN CHI TIẾT (Luật Thuế 109/2025/QH15)",
        headers: ["Khoản mục", "Số tiền (VNĐ)", "% / Tổng TN"],
        rows: [
          ["Tổng thu nhập Shopee năm", d.tax.ytd_shopee_gross.toLocaleString("vi-VN"), pct(d.tax.ytd_shopee_gross, d.tax.ytd_total_gross)],
          ["Tổng lương công ty năm", d.tax.ytd_salary_gross.toLocaleString("vi-VN"), pct(d.tax.ytd_salary_gross, d.tax.ytd_total_gross)],
          ["TỔNG THU NHẬP NĂM", d.tax.ytd_total_gross.toLocaleString("vi-VN"), "100%"],
          [],
          ["Giảm trừ bản thân (12 tháng)", d.tax.personal_deduction.toLocaleString("vi-VN"), ""],
          ["Giảm trừ NPT (12 tháng)", d.tax.dependent_deduction.toLocaleString("vi-VN"), ""],
          ["TỔNG GIẢM TRỪ", d.tax.total_deduction.toLocaleString("vi-VN"), ""],
          [],
          ["THU NHẬP TÍNH THUẾ", d.tax.taxable_income.toLocaleString("vi-VN"), ""],
          ["TNTT BÌNH QUÂN/THÁNG", Math.round(d.tax.taxable_income / 12).toLocaleString("vi-VN"), ""],
        ],
      });

      // ============ SECTION 7: Thuế theo bậc ============
      sections.push({
        title: "THUẾ THEO TỪNG BẬC LŨY TIẾN",
        headers: ["Bậc", "Khoảng TN", "Thuế suất", "TN trong bậc (VNĐ)", "Thuế trong bậc (VNĐ)"],
        rows: d.tax.brackets.length === 0
          ? [["—", "TNTT ≤ 0, không phát sinh thuế", "", "", ""]]
          : [
              ...d.tax.brackets.map((b, i) => [
                `Bậc ${i + 1}`,
                b.label,
                `${(b.rate * 100).toFixed(0)}%`,
                b.income_in_bracket.toLocaleString("vi-VN"),
                b.tax_in_bracket.toLocaleString("vi-VN"),
              ]),
              [],
              ["", "TỔNG THUẾ PHẢI NỘP", "", "", d.tax.tax_payable.toLocaleString("vi-VN")],
            ],
      });

      // ============ SECTION 8: Kết quả quyết toán ============
      sections.push({
        title: "KẾT QUẢ QUYẾT TOÁN",
        headers: ["Khoản mục", "Số tiền (VNĐ)"],
        rows: [
          ["A. Tổng thuế phải nộp (lũy tiến)", d.tax.tax_payable.toLocaleString("vi-VN")],
          ["B. Đã khấu trừ - Shopee 10%", d.tax.ytd_shopee_tax.toLocaleString("vi-VN")],
          ["C. Đã khấu trừ - Lương công ty", d.tax.ytd_salary_tax.toLocaleString("vi-VN")],
          ["D. TỔNG ĐÃ KHẤU TRỪ (B+C)", d.tax.ytd_total_tax_withheld.toLocaleString("vi-VN")],
          [],
          ["E. CHÊNH LỆCH (A - D)", (d.tax.tax_payable - d.tax.ytd_total_tax_withheld).toLocaleString("vi-VN")],
          [],
          [
            d.tax.additional_tax > 0 ? "→ CÒN PHẢI NỘP THÊM" : d.tax.refund > 0 ? "→ ĐƯỢC HOÀN LẠI" : "→ ĐÃ NỘP ĐỦ",
            d.tax.additional_tax > 0
              ? d.tax.additional_tax.toLocaleString("vi-VN")
              : d.tax.refund > 0
                ? d.tax.refund.toLocaleString("vi-VN")
                : "0",
          ],
        ],
      });

      // ============ FOOTER ============
      sections.push({
        rows: [
          [],
          [`Hồ sơ được xuất từ phần mềm Kế toán Affiliate Shopee`],
          [`Ngày xuất: ${new Date().toLocaleDateString("vi-VN")}`],
          [`Lưu ý: Số liệu chỉ mang tính tham khảo. Đối chiếu với cơ quan thuế trước khi nộp.`],
        ],
      });

      const csv = buildMultiSectionCsv(sections);
      const safeName = d.affiliate.full_name.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
      downloadCsvWithBom(`quyettoan-thue-${d.year}-${safeName}.csv`, csv);

      toast.success(`Đã tải hồ sơ năm ${d.year} cho ${d.affiliate.full_name}`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-success" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Xuất hồ sơ quyết toán năm</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{affiliateName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              Chọn năm <span className="text-destructive">*</span>
            </Label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              disabled={loading}
              className="h-10 w-full px-3 rounded-md border border-input bg-background text-sm"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">File CSV sẽ bao gồm:</p>
            <p>• Thông tin cá nhân affiliate</p>
            <p>• Tổng kết doanh thu năm</p>
            <p>• Bảng kê hoa hồng từng tháng (12 tháng)</p>
            <p>• Chi tiết từng đợt hoa hồng</p>
            <p>• Chi tiết các lượt nộp tiền công ty</p>
            <p>• Tính thuế TNCN chi tiết theo 5 bậc lũy tiến</p>
            <p>• Kết quả quyết toán (phải nộp / được hoàn)</p>
          </div>

          <div className="rounded-md bg-warning/10 border border-warning/30 p-3 text-xs text-warning">
            💡 File tải về là <strong>.csv</strong>, mở được bằng Excel/Google Sheets (UTF-8 BOM hỗ trợ tiếng Việt).
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="flex-1">
              Hủy
            </Button>
            <Button onClick={handleExport} disabled={loading} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Tải xuống
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
