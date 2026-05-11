import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { Receipt, FileText, AlertTriangle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { calculateYtdAdditionalTax } from "@/lib/ytd-tax";
import {
  PERSONAL_DEDUCTION_MONTHLY,
  DEPENDENT_DEDUCTION_MONTHLY,
  TAX_BRACKETS_MONTHLY,
} from "@/lib/tax-calculator";
import type { AffiliateAccount, Commission } from "@/types/database";

export default async function TaxPage() {
  const supabase = await createClient();

  const now = new Date();
  const currentYear = now.getFullYear();
  const monthsElapsed = now.getMonth() + 1;

  const [affiliatesRes, commissionsRes] = await Promise.all([
    supabase
      .from("affiliate_accounts")
      .select("*")
      .eq("is_deleted", false)
      .in("status", ["active", "paused"])
      .order("full_name"),
    supabase
      .from("commissions")
      .select("account_id, gross_amount, tax_withheld")
      .eq("is_deleted", false)
      .eq("period_year", currentYear),
  ]);

  const affiliates = (affiliatesRes.data ?? []) as AffiliateAccount[];
  const commissions = (commissionsRes.data ?? []) as Pick<
    Commission,
    "account_id" | "gross_amount" | "tax_withheld"
  >[];

  // Tính YTD cho mỗi affiliate
  const ytdMap = new Map(affiliates.map((a) => [a.id, { gross: 0, tax: 0 }]));
  for (const c of commissions) {
    const entry = ytdMap.get(c.account_id);
    if (entry) {
      entry.gross += Number(c.gross_amount);
      entry.tax += Number(c.tax_withheld);
    }
  }

  const summaries = affiliates.map((a) => {
    const ytd = ytdMap.get(a.id) ?? { gross: 0, tax: 0 };
    const result = calculateYtdAdditionalTax({
      monthsElapsed,
      monthlySalaryGross: a.has_company_salary ? Number(a.monthly_salary_gross) : 0,
      monthlySalaryTaxWithheld: a.has_company_salary
        ? Number(a.monthly_salary_tax_withheld)
        : 0,
      ytdShopeeGross: ytd.gross,
      ytdShopeeTaxWithheld: ytd.tax,
      hasPersonalDeduction: a.has_personal_deduction,
      dependentCount: a.dependent_count,
    });
    return { affiliate: a, result };
  });

  const totalOwe = summaries
    .filter((s) => s.result.status === "owe")
    .reduce((sum, s) => sum + s.result.taxAdditional, 0);
  const totalRefund = summaries
    .filter((s) => s.result.status === "refund")
    .reduce((sum, s) => sum + Math.abs(s.result.taxAdditional), 0);
  const oweCount = summaries.filter((s) => s.result.status === "owe").length;
  const refundCount = summaries.filter((s) => s.result.status === "refund").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Thuế TNCN"
        description={`YTD năm ${currentYear} (tháng 1-${monthsElapsed}) • Áp dụng Luật Thuế TNCN 2025`}
      />

      {/* Tổng quan */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium">
                  Tổng phải nộp thêm
                </p>
                <p className="text-xl font-semibold mt-1 tabular-nums text-warning">
                  {formatCurrency(totalOwe)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {oweCount} affiliate có thu nhập vượt mức giảm trừ
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                <Receipt className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-medium">
                  Tổng được hoàn
                </p>
                <p className="text-xl font-semibold mt-1 tabular-nums text-success">
                  {formatCurrency(totalRefund)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {refundCount} affiliate khấu trừ thừa
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bảng theo dõi từng affiliate */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bảng theo dõi thuế từng affiliate</CardTitle>
          <p className="text-xs text-muted-foreground">
            Click vào từng người để xem chi tiết và xuất quyết toán
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {summaries.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Chưa có affiliate nào
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left font-medium px-6 py-2.5">Affiliate</th>
                    <th className="text-right font-medium px-6 py-2.5">Tổng TN YTD</th>
                    <th className="text-right font-medium px-6 py-2.5">Đã KT thuế</th>
                    <th className="text-right font-medium px-6 py-2.5">Phải nộp</th>
                    <th className="text-right font-medium px-6 py-2.5">Chênh lệch</th>
                    <th className="text-center font-medium px-6 py-2.5">Trạng thái</th>
                    <th className="w-10 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map(({ affiliate: a, result }) => (
                    <tr
                      key={a.id}
                      className="border-b border-border last:border-0 hover:bg-muted/40 group"
                    >
                      <td className="px-6 py-3">
                        <Link
                          href={`/tax/${a.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {a.full_name}
                        </Link>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {a.dependent_count > 0 && `${a.dependent_count} NPT`}
                          {a.has_company_salary && (
                            <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted">
                              Có lương
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums">
                        {formatCurrency(result.totalIncomeYtd)}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(result.taxWithheldYtd)}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums">
                        {formatCurrency(result.taxPayableYtd)}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums">
                        {result.status === "no_data" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : result.status === "owe" ? (
                          <span className="text-warning font-medium">
                            +{formatCurrency(result.taxAdditional)}
                          </span>
                        ) : result.status === "refund" ? (
                          <span className="text-success font-medium">
                            {formatCurrency(result.taxAdditional)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">~0đ</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center">
                        {result.status === "owe" && <Badge variant="warning">Phải nộp</Badge>}
                        {result.status === "refund" && <Badge variant="success">Được hoàn</Badge>}
                        {result.status === "even" && <Badge variant="neutral">Đủ</Badge>}
                        {result.status === "no_data" && <Badge variant="neutral">Chưa có TN</Badge>}
                      </td>
                      <td className="px-2 py-3">
                        <Link
                          href={`/tax/${a.id}`}
                          className="block p-1 text-muted-foreground hover:text-foreground"
                        >
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Căn cứ pháp lý */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Căn cứ pháp lý
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Quy định áp dụng từ kỳ tính thuế năm 2026
          </p>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          {/* Văn bản pháp luật */}
          <div>
            <h4 className="font-medium mb-2">Văn bản áp dụng</h4>
            <ul className="space-y-1 text-muted-foreground text-xs list-disc list-inside">
              <li>
                <strong>Luật Thuế TNCN 2025</strong> (số 109/2025/QH15) — Quốc hội thông qua 10/12/2025
              </li>
              <li>
                <strong>Nghị quyết 110/2025/UBTVQH15</strong> — điều chỉnh mức giảm trừ gia cảnh
              </li>
              <li>
                <strong>Thông tư 111/2013/TT-BTC</strong> — vẫn áp dụng cho khấu trừ 10% vãng lai
              </li>
            </ul>
          </div>

          {/* Biểu thuế */}
          <div>
            <h4 className="font-medium mb-2">Biểu thuế lũy tiến từng phần (5 bậc)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left font-medium px-4 py-2">Bậc</th>
                    <th className="text-left font-medium px-4 py-2">Thu nhập tính thuế/tháng</th>
                    <th className="text-right font-medium px-4 py-2">Thuế suất</th>
                  </tr>
                </thead>
                <tbody>
                  {TAX_BRACKETS_MONTHLY.map((b, i) => {
                    const prev = i === 0 ? 0 : TAX_BRACKETS_MONTHLY[i - 1].upTo;
                    return (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-4 py-2 font-medium">Bậc {i + 1}</td>
                        <td className="px-4 py-2">
                          {b.upTo === Infinity
                            ? `Trên ${(prev / 1_000_000).toFixed(0)} triệu`
                            : prev === 0
                              ? `Đến ${(b.upTo / 1_000_000).toFixed(0)} triệu`
                              : `Trên ${(prev / 1_000_000).toFixed(0)} đến ${(b.upTo / 1_000_000).toFixed(0)} triệu`}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums">
                          {(b.rate * 100).toFixed(0)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Giảm trừ gia cảnh */}
          <div>
            <h4 className="font-medium mb-2">Mức giảm trừ gia cảnh</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md bg-muted/40">
                <div className="text-xs text-muted-foreground">Bản thân người nộp thuế</div>
                <div className="font-semibold mt-0.5 tabular-nums">
                  {formatCurrency(PERSONAL_DEDUCTION_MONTHLY)}/tháng
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatCurrency(PERSONAL_DEDUCTION_MONTHLY * 12)}/năm
                </div>
              </div>
              <div className="p-3 rounded-md bg-muted/40">
                <div className="text-xs text-muted-foreground">Mỗi người phụ thuộc</div>
                <div className="font-semibold mt-0.5 tabular-nums">
                  {formatCurrency(DEPENDENT_DEDUCTION_MONTHLY)}/tháng
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatCurrency(DEPENDENT_DEDUCTION_MONTHLY * 12)}/năm
                </div>
              </div>
            </div>
          </div>

          {/* Công thức */}
          <div>
            <h4 className="font-medium mb-2">Công thức tính</h4>
            <div className="bg-muted/30 rounded-md p-4 space-y-2 text-xs font-mono">
              <div>Thu nhập chịu thuế = Tổng thu nhập − Khoản miễn thuế</div>
              <div>Thu nhập tính thuế = TN chịu thuế − Giảm trừ gia cảnh − BHXH/BHYT/BHTN</div>
              <div>Thuế phải nộp = TN tính thuế × Thuế suất lũy tiến (5 bậc)</div>
              <div className="pt-2 border-t border-border">Cuối năm quyết toán:</div>
              <div>Thuế còn phải nộp = Thuế phải nộp − Thuế đã khấu trừ trong năm</div>
            </div>
          </div>

          {/* Khấu trừ vãng lai */}
          <div className="p-3 rounded-md bg-warning/10 border border-warning/20">
            <h4 className="font-medium text-warning mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Khấu trừ 10% vãng lai (cho hoa hồng Shopee)
            </h4>
            <p className="text-xs text-muted-foreground">
              Theo Thông tư 111/2013/TT-BTC, thu nhập từ <strong>2 triệu/lần trở lên</strong> đối với cá nhân
              không có hợp đồng lao động hoặc hợp đồng dưới 3 tháng → bị khấu trừ <strong>10% tại nguồn</strong>.
              Đây là <em>khấu trừ tạm thu</em>, cuối năm vẫn phải quyết toán theo lũy tiến nếu thu nhập đủ ngưỡng.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
