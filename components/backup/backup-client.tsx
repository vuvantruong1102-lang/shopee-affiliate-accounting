"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, FileSpreadsheet, FileJson } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { buildCsv, downloadCsv } from "@/lib/csv-export";

export function BackupClient() {
  const [loading, setLoading] = useState<"excel" | "json" | null>(null);

  async function fetchAllData() {
    const supabase = createClient();
    const [aff, comm, cash, bank, shopee, shopeeDays, bankAccounts, expCat] = await Promise.all([
      supabase.from("affiliate_accounts").select("*").order("created_at"),
      supabase.from("commissions").select("*").order("earned_date"),
      supabase.from("cash_transactions").select("*").order("trans_date"),
      supabase.from("bank_transactions").select("*").order("trans_date"),
      supabase.from("shopee_payments").select("*").order("payment_date"),
      supabase.from("shopee_payment_days").select("*").order("earned_date"),
      supabase.from("bank_accounts").select("*"),
      supabase.from("expense_categories").select("*"),
    ]);

    return {
      affiliate_accounts: aff.data ?? [],
      commissions: comm.data ?? [],
      cash_transactions: cash.data ?? [],
      bank_transactions: bank.data ?? [],
      shopee_payments: shopee.data ?? [],
      shopee_payment_days: shopeeDays.data ?? [],
      bank_accounts: bankAccounts.data ?? [],
      expense_categories: expCat.data ?? [],
    };
  }

  async function handleExportExcel() {
    setLoading("excel");
    try {
      const data = await fetchAllData();
      const today = new Date().toISOString().split("T")[0];

      // Tạo nhiều file CSV trong 1 ZIP — nhưng để đơn giản, sẽ tạo file CSV gộp với section header
      // Hoặc dùng SheetJS để tạo Excel multi-sheet

      // Cách đơn giản: tạo nhiều file CSV và download từng cái
      // Cách tốt hơn: tạo 1 file Excel có nhiều sheet với SheetJS
      
      // Vì SheetJS có thể chưa cài, dùng cách CSV gộp
      let allCsv = "";
      
      // Helper: tạo section CSV
      function addSection(name: string, rows: Record<string, unknown>[]) {
        if (rows.length === 0) {
          allCsv += `\n=== ${name.toUpperCase()} (TRỐNG) ===\n\n`;
          return;
        }
        allCsv += `\n=== ${name.toUpperCase()} (${rows.length} dòng) ===\n`;
        const headers = Object.keys(rows[0]);
        const dataRows = rows.map((r) => headers.map((h) => r[h]));
        allCsv += buildCsv(headers, dataRows).replace(/^\uFEFF/, "") + "\n";
      }

      // BOM ở đầu để Excel đọc UTF-8
      allCsv = "\uFEFF";
      allCsv += `BACKUP DỮ LIỆU SHOPEE AFFILIATE ACCOUNTING\n`;
      allCsv += `Thời gian: ${new Date().toLocaleString("vi-VN")}\n`;

      addSection("Affiliate accounts", data.affiliate_accounts);
      addSection("Commissions", data.commissions);
      addSection("Cash transactions", data.cash_transactions);
      addSection("Bank transactions", data.bank_transactions);
      addSection("Shopee payments", data.shopee_payments);
      addSection("Shopee payment days", data.shopee_payment_days);
      addSection("Bank accounts", data.bank_accounts);
      addSection("Expense categories", data.expense_categories);

      // Download CSV
      const blob = new Blob([allCsv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-shopee-affiliate-${today}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Đã tải xuống file backup CSV");
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi khi tạo backup");
    } finally {
      setLoading(null);
    }
  }

  async function handleExportJson() {
    setLoading("json");
    try {
      const data = await fetchAllData();
      const today = new Date().toISOString().split("T")[0];

      const fullBackup = {
        backup_info: {
          created_at: new Date().toISOString(),
          version: "1.0",
          app: "shopee-affiliate-accounting",
        },
        data,
      };

      const json = JSON.stringify(fullBackup, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-shopee-affiliate-${today}.json`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Đã tải xuống file backup JSON");
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi khi tạo backup");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tải file backup</CardTitle>
        <p className="text-xs text-muted-foreground">
          Chọn 1 trong 2 định dạng phù hợp với bạn
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-4 p-4 rounded-md border border-border hover:border-primary/40 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-success" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">CSV (Excel)</div>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">
              File CSV có thể mở bằng Excel/Google Sheets. Phù hợp để xem lại, in, lưu trữ.
            </p>
            <Button onClick={handleExportExcel} disabled={loading !== null}>
              {loading === "excel" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Tải file CSV
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-4 p-4 rounded-md border border-border hover:border-primary/40 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileJson className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">JSON (Đầy đủ)</div>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">
              File JSON chứa toàn bộ dữ liệu thô, giữ nguyên cấu trúc database. Phù hợp khi cần khôi phục dữ liệu.
            </p>
            <Button variant="outline" onClick={handleExportJson} disabled={loading !== null}>
              {loading === "json" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Tải file JSON
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
