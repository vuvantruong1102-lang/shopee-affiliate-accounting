import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { calculateYtdAdditionalTax } from "@/lib/ytd-tax";
import { TaxBreakdown } from "@/components/tax/tax-breakdown";
import { TaxExportButtons } from "@/components/tax/tax-export-buttons";
import type { AffiliateAccount, Commission } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TaxDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: affiliateData } = await supabase
    .from("affiliate_accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (!affiliateData) notFound();
  const a = affiliateData as AffiliateAccount;

  const now = new Date();
  const currentYear = now.getFullYear();
  const monthsElapsed = now.getMonth() + 1;

  // Lấy tất cả hoa hồng trong năm
  const { data: commissionsData } = await supabase
    .from("commissions")
    .select("*")
    .eq("account_id", id)
    .eq("is_deleted", false)
    .eq("period_year", currentYear)
    .order("earned_date", { ascending: true });

  const commissions = (commissionsData ?? []) as Commission[];

  // Tổng hợp theo tháng (cho bảng dưới)
  const monthlyData = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    gross: 0,
    tax: 0,
    net: 0,
    count: 0,
  }));

  for (const c of commissions) {
    const m = c.period_month - 1;
    if (m >= 0 && m < 12) {
      monthlyData[m].gross += Number(c.gross_amount);
      monthlyData[m].tax += Number(c.tax_withheld);
      monthlyData[m].net += Number(c.net_amount);
      monthlyData[m].count += 1;
    }
  }

  const ytdGross = commissions.reduce((s, c) => s + Number(c.gross_amount), 0);
  const ytdTax = commissions.reduce((s, c) => s + Number(c.tax_withheld), 0);
  const ytdNet = commissions.reduce((s, c) => s + Number(c.net_amount), 0);

  // ✨ Tính thuế CẢ NĂM (luật VN quyết toán theo năm)
  const ytdResult = calculateYtdAdditionalTax({
    monthsElapsed,
    monthlySalaryGross: a.has_company_salary ? Number(a.monthly_salary_gross) : 0,
    monthlySalaryTaxWithheld: a.has_company_salary ? Number(a.monthly_salary_tax_withheld) : 0,
    ytdShopeeGross: ytdGross,
    ytdShopeeTaxWithheld: ytdTax,
    hasPersonalDeduction: a.has_personal_deduction,
    dependentCount: a.dependent_count,
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div className="flex items-center gap-2 -mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tax">
            <ChevronLeft className="w-4 h-4" />
            Tổng quan thuế
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Thuế TNCN của ${a.full_name}`}
        description={`Năm ${currentYear} · Tính theo cả năm (12 tháng) — đã nhận dữ liệu Shopee đến tháng ${monthsElapsed}`}
        action={
          <TaxExportButtons
            affiliate={a}
            ytdResult={ytdResult}
            year={currentYear}
            monthsElapsed={monthsElapsed}
            monthlyData={monthlyData}
            ytdGross={ytdGross}
            ytdTax={ytdTax}
            ytdNet={ytdNet}
          />
        }
      />

      {/* KPI tổng quan */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground font-medium">Tổng thu nhập năm</p>
            <p className="text-xl font-semibold mt-2 tabular-nums">
              {formatCurrency(ytdResult.totalIncomeYtd)}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              HH Shopee (YTD) + Lương cả năm
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground font-medium">Thu nhập tính thuế</p>
            <p className="text-xl font-semibold mt-2 tabular-nums">
              {formatCurrency(ytdResult.taxableIncomeYtd)}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              Sau giảm trừ {formatCurrency(ytdResult.totalDeductionYtd)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground font-medium">Thuế phải nộp năm</p>
            <p className="text-xl font-semibold mt-2 tabular-nums">
              {formatCurrency(ytdResult.taxPayableYtd)}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              Lũy tiến 5 bậc (theo năm)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground font-medium">
              {ytdResult.status === "refund" ? "Được hoàn" : "Cần nộp thêm"}
            </p>
            <p
              className={`text-xl font-semibold mt-2 tabular-nums ${
                ytdResult.status === "refund"
                  ? "text-success"
                  : ytdResult.status === "owe"
                    ? "text-warning"
                    : ""
              }`}
            >
              {formatCurrency(Math.abs(ytdResult.taxAdditional))}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">
              {ytdResult.status === "even" && "Đã đóng đủ"}
              {ytdResult.status === "owe" && "Phải nộp khi quyết toán"}
              {ytdResult.status === "refund" && "Sẽ hoàn lại khi quyết toán"}
              {ytdResult.status === "no_data" && "Chưa có dữ liệu"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown chi tiết */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chi tiết tính thuế cả năm</CardTitle>
          <p className="text-xs text-muted-foreground">
            Áp dụng cho cả năm {currentYear} · Thu nhập Shopee hiện tại đến tháng {monthsElapsed}
          </p>
        </CardHeader>
        <CardContent>
          <TaxBreakdown ytdResult={ytdResult} monthsElapsed={monthsElapsed} affiliate={a} />
        </CardContent>
      </Card>

      {/* Bảng thu nhập theo tháng */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thu nhập từng tháng năm {currentYear}</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dữ liệu Shopee thực tế tháng 1 – {monthsElapsed}, lương ước tính cả 12 tháng
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left font-medium px-6 py-2.5">Tháng</th>
                  <th className="text-center font-medium px-6 py-2.5">Số đợt HH</th>
                  <th className="text-right font-medium px-6 py-2.5">Gross HH</th>
                  <th className="text-right font-medium px-6 py-2.5">Thuế Shopee KT</th>
                  <th className="text-right font-medium px-6 py-2.5">Lương công ty</th>
                  <th className="text-right font-medium px-6 py-2.5">Tổng TN tháng</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.slice(0, monthsElapsed).map((m) => {
                  const salaryThisMonth = a.has_company_salary
                    ? Number(a.monthly_salary_gross)
                    : 0;
                  const totalThisMonth = m.gross + salaryThisMonth;
                  return (
                    <tr key={m.month} className="border-b border-border last:border-0">
                      <td className="px-6 py-2.5 font-medium">Tháng {m.month}</td>
                      <td className="px-6 py-2.5 text-center tabular-nums text-muted-foreground">
                        {m.count}
                      </td>
                      <td className="px-6 py-2.5 text-right tabular-nums">
                        {formatCurrency(m.gross)}
                      </td>
                      <td className="px-6 py-2.5 text-right tabular-nums text-muted-foreground">
                        {formatCurrency(m.tax)}
                      </td>
                      <td className="px-6 py-2.5 text-right tabular-nums text-muted-foreground">
                        {salaryThisMonth > 0 ? formatCurrency(salaryThisMonth) : "—"}
                      </td>
                      <td className="px-6 py-2.5 text-right tabular-nums font-medium">
                        {formatCurrency(totalThisMonth)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold bg-muted/30">
                  <td className="px-6 py-3">Tổng cả năm (cho quyết toán)</td>
                  <td className="px-6 py-3 text-center tabular-nums">
                    {monthlyData.reduce((s, m) => s + m.count, 0)}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums">
                    {formatCurrency(ytdGross)}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(ytdTax)}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums">
                    {formatCurrency(ytdResult.breakdown.salaryGross)}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums">
                    {formatCurrency(ytdResult.totalIncomeYtd)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
