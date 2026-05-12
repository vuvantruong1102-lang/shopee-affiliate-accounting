"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchResultType =
  | "affiliate"
  | "shopee_payment"
  | "commission"
  | "bank_transaction";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  meta: string;
  href: string;
  amount?: number;
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const results: SearchResult[] = [];

  // ============ 1. AFFILIATES (search theo tên/sđt/cccd/email) ============
  const { data: affiliates } = await supabase
    .from("affiliate_accounts")
    .select("id, full_name, phone, cccd, email, status")
    .or(
      `full_name.ilike.%${q}%,phone.ilike.%${q}%,cccd.ilike.%${q}%,email.ilike.%${q}%`,
    )
    .eq("is_deleted", false)
    .limit(10);

  for (const a of affiliates ?? []) {
    const statusLabel =
      a.status === "active" ? "Đang hoạt động" :
      a.status === "paused" ? "Tạm dừng" : "Đã đóng";

    results.push({
      type: "affiliate",
      id: a.id,
      title: a.full_name,
      subtitle: [a.phone, a.email].filter(Boolean).join(" · ") || "—",
      meta: statusLabel,
      href: `/affiliates/${a.id}`,
    });
  }

  // ============ 2. SHOPEE PAYMENTS (theo payment_code) ============
  if (/^\d/.test(q) || q.toLowerCase().includes("shopee")) {
    const { data: payments } = await supabase
      .from("shopee_payments")
      .select(
        "id, payment_code, payment_date, total_net, total_gross, is_received, account_id, affiliate_accounts!inner(full_name)",
      )
      .ilike("payment_code", `%${q}%`)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .limit(10);

    // ✨ FIX: affiliate_accounts là array từ join, không phải object
    type PaymentRow = {
      id: string;
      payment_code: string;
      payment_date: string;
      total_net: number;
      total_gross: number;
      is_received: boolean;
      account_id: string;
      affiliate_accounts: { full_name: string }[] | { full_name: string };
    };

    for (const p of (payments ?? []) as unknown as PaymentRow[]) {
      // Có thể là array hoặc object tùy Supabase version → handle cả 2
      const affObj = Array.isArray(p.affiliate_accounts)
        ? p.affiliate_accounts[0]
        : p.affiliate_accounts;
      const affiliateName = affObj?.full_name ?? "—";

      results.push({
        type: "shopee_payment",
        id: p.id,
        title: `Đợt thanh toán ${p.payment_code}`,
        subtitle: `${affiliateName} · ${p.payment_date}`,
        meta: p.is_received ? "Đã nhận" : "Chờ nhận",
        href: `/reconciliation`,
        amount: Number(p.total_net),
      });
    }
  }

  // ============ 3. BANK TRANSACTIONS ============
  const numericQuery = q.replace(/[^\d]/g, "");
  const numericAmount = numericQuery ? parseInt(numericQuery) : null;

  if (numericAmount && numericAmount > 1000) {
    // Search theo amount
    const { data: txns } = await supabase
      .from("bank_transactions")
      .select("id, trans_date, amount, description, trans_type, account_id, bank_account_id")
      .eq("amount", numericAmount)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .limit(5);

    type TxnRow = {
      id: string;
      trans_date: string;
      amount: number;
      description: string | null;
      trans_type: string;
      account_id: string | null;
      bank_account_id: string;
    };

    for (const t of (txns ?? []) as unknown as TxnRow[]) {
      results.push({
        type: "bank_transaction",
        id: t.id,
        title: t.description ?? `Giao dịch ${t.trans_type === "income" ? "thu" : "chi"}`,
        subtitle: t.trans_date,
        meta: t.trans_type === "income" ? "Thu" : "Chi",
        href: `/bank-book`,
        amount: Number(t.amount),
      });
    }
  } else if (q.length >= 3) {
    // Search theo description/notes
    const { data: txns } = await supabase
      .from("bank_transactions")
      .select("id, trans_date, amount, description, trans_type, notes")
      .or(`description.ilike.%${q}%,notes.ilike.%${q}%`)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .limit(5);

    type TxnRow = {
      id: string;
      trans_date: string;
      amount: number;
      description: string | null;
      trans_type: string;
      notes: string | null;
    };

    for (const t of (txns ?? []) as unknown as TxnRow[]) {
      results.push({
        type: "bank_transaction",
        id: t.id,
        title: t.description ?? `Giao dịch ${t.trans_type === "income" ? "thu" : "chi"}`,
        subtitle: `${t.trans_date}${t.notes ? " · " + t.notes : ""}`,
        meta: t.trans_type === "income" ? "Thu" : "Chi",
        href: `/bank-book`,
        amount: Number(t.amount),
      });
    }
  }

  return results.slice(0, 25);
}
