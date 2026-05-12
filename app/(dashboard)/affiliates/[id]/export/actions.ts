"use server";

import { createClient } from "@/lib/supabase/server";
import { calculateYtdAdditionalTax } from "@/lib/ytd-tax";
import type { AffiliateAccount } from "@/types/database";

export interface AnnualExportData {
  affiliate: {
    full_name: string;
    cccd: string | null;
    mst: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    bank_name: string | null;
    bank_account_number: string | null;
    bank_account_holder: string | null;
    has_personal_deduction: boolean;
    dependent_count: number;
    has_company_salary: boolean;
    monthly_salary_gross: number;
    monthly_salary_tax_withheld: number;
  };
  year: number;
  monthly_breakdown: Array<{
    month: number;
    gross: number;
    tax_withheld: number;
    net: number;
    commission_count: number;
  }>;
  commissions: Array<{
    earned_date: string;
    period_month: number;
    period_year: number;
    gross: number;
    tax_withheld: number;
    net: number;
    status: string;
    received_date: string | null;
    description: string | null;
    is_from_shopee: boolean;
    payment_code: string | null;
  }>;
  deposits: Array<{
    date: string;
    amount: number;
    bank_name: string;
    account_number: string;
    description: string | null;
    notes: string | null;
  }>;
  totals: {
    gross: number;
    tax_withheld: number;
    net: number;
    received: number;
    pending: number;
    total_deposited: number;
    undeposited: number;
    commission_count: number;
  };
  tax: {
    ytd_shopee_gross: number;
    ytd_shopee_tax: number;
    ytd_salary_gross: number;
    ytd_salary_tax: number;
    ytd_total_gross: number;
    ytd_total_tax_withheld: number;
    personal_deduction: number;
    dependent_deduction: number;
    total_deduction: number;
    taxable_income: number;
    tax_payable: number;
    additional_tax: number;
    refund: number;
    brackets: Array<{
      label: string;
      rate: number;
      income_in_bracket: number;
      tax_in_bracket: number;
    }>;
  };
}

export async function getAffiliateAnnualData(
  affiliateId: string,
  year: number,
): Promise<{ data?: AnnualExportData; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Bạn cần đăng nhập" };

  // 1. Affiliate info
  const { data: aff } = await supabase
    .from("affiliate_accounts")
    .select("*")
    .eq("id", affiliateId)
    .single();

  if (!aff) return { error: "Không tìm thấy affiliate" };

  const affTyped = aff as AffiliateAccount;
  const affAny = aff as Record<string, unknown>;
  const mstValue =
    (affAny.personal_tax_code as string | null) ??
    (affAny.mst as string | null) ??
    (affAny.tax_code as string | null) ??
    null;

  // 2. Commissions trong năm
  const fromDate = `${year}-01-01`;
  const toDate = `${year}-12-31`;

  const { data: commissionsData } = await supabase
    .from("commissions")
    .select("*, shopee_payments!commission_id(payment_code)")
    .eq("account_id", affiliateId)
    .eq("is_deleted", false)
    .gte("earned_date", fromDate)
    .lte("earned_date", toDate)
    .order("earned_date", { ascending: true });

  type CommissionRow = {
    earned_date: string;
    period_month: number;
    period_year: number;
    gross_amount: number;
    tax_withheld: number;
    net_amount: number;
    status: string;
    received_date: string | null;
    description: string | null;
    shopee_payments?: { payment_code: string | null }[];
  };

  const commissions = ((commissionsData ?? []) as CommissionRow[]).map((c) => ({
    earned_date: c.earned_date,
    period_month: c.period_month,
    period_year: c.period_year,
    gross: Number(c.gross_amount),
    tax_withheld: Number(c.tax_withheld),
    net: Number(c.net_amount),
    status: c.status,
    received_date: c.received_date,
    description: c.description,
    is_from_shopee: (c.shopee_payments?.length ?? 0) > 0,
    payment_code: c.shopee_payments?.[0]?.payment_code ?? null,
  }));

  // 3. Deposits trong năm
  const { data: depositsData } = await supabase
    .from("bank_transactions")
    .select("trans_date, amount, description, notes, bank_account_id")
    .eq("account_id", affiliateId)
    .eq("trans_type", "income")
    .eq("is_deleted", false)
    .gte("trans_date", fromDate)
    .lte("trans_date", toDate)
    .order("trans_date", { ascending: true });

  const bankIds = Array.from(
    new Set(
      (depositsData ?? [])
        .map((d) => d.bank_account_id)
        .filter((id): id is string => !!id),
    ),
  );

  const { data: banksData } = bankIds.length
    ? await supabase
        .from("bank_accounts")
        .select("id, bank_name, account_number")
        .in("id", bankIds)
    : { data: [] };

  const bankMap = new Map(
    (banksData ?? []).map((b) => [b.id, b]),
  );

  const deposits = (depositsData ?? []).map((d) => ({
    date: d.trans_date,
    amount: Number(d.amount),
    bank_name: bankMap.get(d.bank_account_id)?.bank_name ?? "—",
    account_number: bankMap.get(d.bank_account_id)?.account_number ?? "—",
    description: d.description ?? null,
    notes: d.notes ?? null,
  }));

  // 4. Monthly breakdown
  const monthlyMap = new Map<
    number,
    { gross: number; tax: number; net: number; count: number }
  >();
  for (let m = 1; m <= 12; m++) {
    monthlyMap.set(m, { gross: 0, tax: 0, net: 0, count: 0 });
  }
  for (const c of commissions) {
    const entry = monthlyMap.get(c.period_month);
    if (entry) {
      entry.gross += c.gross;
      entry.tax += c.tax_withheld;
      entry.net += c.net;
      entry.count += 1;
    }
  }
  const monthly_breakdown = Array.from(monthlyMap.entries()).map(([month, v]) => ({
    month,
    gross: v.gross,
    tax_withheld: v.tax,
    net: v.net,
    commission_count: v.count,
  }));

  // 5. Totals
  const totalGross = commissions.reduce((s, c) => s + c.gross, 0);
  const totalTax = commissions.reduce((s, c) => s + c.tax_withheld, 0);
  const totalNet = commissions.reduce((s, c) => s + c.net, 0);
  const totalReceived = commissions
    .filter((c) => c.status === "received")
    .reduce((s, c) => s + c.net, 0);
  const totalPending = commissions
    .filter((c) => c.status === "pending")
    .reduce((s, c) => s + c.net, 0);
  const totalDeposited = deposits.reduce((s, d) => s + d.amount, 0);

  // 6. Tax calculation - cả năm = 12 tháng
  const monthsInYear = 12;
  const monthlySalaryGross = affTyped.has_company_salary
    ? Number(affTyped.monthly_salary_gross)
    : 0;
  const monthlySalaryTax = affTyped.has_company_salary
    ? Number(affTyped.monthly_salary_tax_withheld)
    : 0;

  const ytdSalaryGross = monthlySalaryGross * monthsInYear;
  const ytdSalaryTax = monthlySalaryTax * monthsInYear;

  const taxResult = calculateYtdAdditionalTax({
    monthsElapsed: monthsInYear,
    monthlySalaryGross,
    monthlySalaryTaxWithheld: monthlySalaryTax,
    ytdShopeeGross: totalGross,
    ytdShopeeTaxWithheld: totalTax,
    hasPersonalDeduction: affTyped.has_personal_deduction,
    dependentCount: affTyped.dependent_count,
  });

  const taxResultAny = taxResult as unknown as Record<string, number>;
  const additionalTaxNeeded = Number(
    taxResultAny.additionalTaxNeeded ??
      taxResultAny.additional_tax_needed ??
      taxResultAny.taxAdditional ??
      0,
  );

  // Tính brackets chi tiết
  const PERSONAL_DEDUCTION_MONTHLY = 15_500_000;
  const DEPENDENT_DEDUCTION_MONTHLY = 6_200_000;
  const TAX_BRACKETS = [
    { upTo: 10_000_000, rate: 0.05 },
    { upTo: 30_000_000, rate: 0.1 },
    { upTo: 60_000_000, rate: 0.2 },
    { upTo: 100_000_000, rate: 0.3 },
    { upTo: Infinity, rate: 0.35 },
  ];

  const personalDeduction =
    (affTyped.has_personal_deduction ? PERSONAL_DEDUCTION_MONTHLY : 0) * monthsInYear;
  const dependentDeduction =
    DEPENDENT_DEDUCTION_MONTHLY * affTyped.dependent_count * monthsInYear;
  const totalDeduction = personalDeduction + dependentDeduction;
  const totalIncome = totalGross + ytdSalaryGross;
  const taxableIncome = Math.max(0, totalIncome - totalDeduction);
  const taxableMonthly = taxableIncome / monthsInYear;

  const brackets: Array<{
    label: string;
    rate: number;
    income_in_bracket: number;
    tax_in_bracket: number;
  }> = [];
  let remaining = taxableMonthly;
  let prevUpTo = 0;
  for (const b of TAX_BRACKETS) {
    if (remaining <= 0) break;
    const bracketSize = b.upTo - prevUpTo;
    const inBracket = Math.min(remaining, bracketSize);
    brackets.push({
      label:
        b.upTo === Infinity
          ? `Trên ${(prevUpTo / 1_000_000).toFixed(0)}tr`
          : prevUpTo === 0
            ? `Đến ${(b.upTo / 1_000_000).toFixed(0)}tr`
            : `${(prevUpTo / 1_000_000).toFixed(0)} - ${(b.upTo / 1_000_000).toFixed(0)}tr`,
      rate: b.rate,
      income_in_bracket: Math.round(inBracket * monthsInYear),
      tax_in_bracket: Math.round(inBracket * b.rate * monthsInYear),
    });
    remaining -= inBracket;
    prevUpTo = b.upTo;
  }

  const taxPayable = brackets.reduce((s, b) => s + b.tax_in_bracket, 0);

  return {
    data: {
      affiliate: {
        full_name: affTyped.full_name,
        cccd: affTyped.cccd ?? null,
        mst: mstValue,
        email: affTyped.email ?? null,
        phone: affTyped.phone ?? null,
        address: affTyped.address ?? null,
        bank_name: affTyped.bank_name ?? null,
        bank_account_number: affTyped.bank_account_number ?? null,
        bank_account_holder: affTyped.bank_account_holder ?? null,
        has_personal_deduction: affTyped.has_personal_deduction,
        dependent_count: affTyped.dependent_count,
        has_company_salary: affTyped.has_company_salary,
        monthly_salary_gross: monthlySalaryGross,
        monthly_salary_tax_withheld: monthlySalaryTax,
      },
      year,
      monthly_breakdown,
      commissions,
      deposits,
      totals: {
        gross: totalGross,
        tax_withheld: totalTax,
        net: totalNet,
        received: totalReceived,
        pending: totalPending,
        total_deposited: totalDeposited,
        undeposited: totalReceived - totalDeposited,
        commission_count: commissions.length,
      },
      tax: {
        ytd_shopee_gross: totalGross,
        ytd_shopee_tax: totalTax,
        ytd_salary_gross: ytdSalaryGross,
        ytd_salary_tax: ytdSalaryTax,
        ytd_total_gross: totalIncome,
        ytd_total_tax_withheld: totalTax + ytdSalaryTax,
        personal_deduction: personalDeduction,
        dependent_deduction: dependentDeduction,
        total_deduction: totalDeduction,
        taxable_income: taxableIncome,
        tax_payable: taxPayable,
        additional_tax: Math.max(0, additionalTaxNeeded),
        refund: Math.max(0, -additionalTaxNeeded),
        brackets,
      },
    },
  };
}
