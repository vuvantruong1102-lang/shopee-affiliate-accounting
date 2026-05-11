"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/shared/currency-input";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function BankAccountForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [openingDate, setOpeningDate] = useState(today);
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim()) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("bank_accounts").insert({
      bank_name: bankName.trim(),
      account_number: accountNumber.trim(),
      account_holder: accountHolder.trim().toUpperCase(),
      opening_balance: openingBalance,
      opening_date: openingDate,
      notes: notes.trim() || null,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Đã khai báo tài khoản ngân hàng");
    setBankName("");
    setAccountNumber("");
    setAccountHolder("");
    setOpeningBalance(0);
    setNotes("");
    setLoading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label className="mb-1.5 block">
            Tên ngân hàng <span className="text-destructive">*</span>
          </Label>
          <Input
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Vietcombank, MB Bank..."
            required
          />
        </div>
        <div>
          <Label className="mb-1.5 block">
            Số tài khoản <span className="text-destructive">*</span>
          </Label>
          <Input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="XXXXXXXXXXXX"
            className="font-mono"
            required
          />
        </div>
        <div className="md:col-span-2">
          <Label className="mb-1.5 block">
            Chủ tài khoản <span className="text-destructive">*</span>
          </Label>
          <Input
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            placeholder="CONG TY TNHH ABC"
            style={{ textTransform: "uppercase" }}
            required
          />
        </div>
        <div>
          <Label className="mb-1.5 block">Số dư ban đầu</Label>
          <CurrencyInput
            value={openingBalance}
            onChange={setOpeningBalance}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Số dư hiện có tại ngày khai báo
          </p>
        </div>
        <div>
          <Label className="mb-1.5 block">Ngày bắt đầu theo dõi</Label>
          <Input
            type="date"
            value={openingDate}
            onChange={(e) => setOpeningDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block">Ghi chú</Label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
          placeholder="Tùy chọn"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Thêm tài khoản
        </Button>
      </div>
    </form>
  );
}
