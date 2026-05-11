"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/shared/currency-input";
import { Loader2, Save, Wallet, Building2 } from "lucide-react";
import { toast } from "sonner";
import { createExpense } from "@/app/(dashboard)/data-entry/actions";
import { cn } from "@/lib/utils";
import type { BankAccount, ExpenseCategory } from "@/types/database";

interface Props {
  categories: ExpenseCategory[];
  banks: BankAccount[];
}

const CATEGORY_TYPE_LABEL: Record<string, string> = {
  operating: "Vận hành",
  marketing: "Marketing",
  salary: "Lương/Thưởng",
  tax: "Thuế",
  other: "Khác",
};

export function ExpenseForm({ categories, banks }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const [transDate, setTransDate] = useState(today);
  const [amount, setAmount] = useState(0);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [source, setSource] = useState<"cash" | "bank">("bank");
  const [bankId, setBankId] = useState(banks[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId || amount <= 0 || !description.trim()) {
      toast.error("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setLoading(true);
    try {
      const result = await createExpense({
        trans_date: transDate,
        amount,
        expense_category_id: categoryId,
        description: description.trim(),
        source,
        bank_account_id: source === "bank" ? bankId : undefined,
        counterparty_name: counterpartyName || undefined,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã ghi nhận chi tiêu");
      router.push("/data-entry");
    } finally {
      setLoading(false);
    }
  }

  // Group categories theo type
  const grouped = categories.reduce<Record<string, ExpenseCategory[]>>((acc, c) => {
    if (!acc[c.type]) acc[c.type] = [];
    acc[c.type].push(c);
    return acc;
  }, {});

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nguồn chi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSource("bank")}
              className={cn(
                "p-4 rounded-lg border-2 text-left transition-colors",
                source === "bank"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <Building2 className={cn("w-5 h-5 mb-2", source === "bank" ? "text-primary" : "text-muted-foreground")} />
              <div className="font-medium text-sm">Từ ngân hàng</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Chuyển khoản, thanh toán thẻ
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSource("cash")}
              className={cn(
                "p-4 rounded-lg border-2 text-left transition-colors",
                source === "cash"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40",
              )}
            >
              <Wallet className={cn("w-5 h-5 mb-2", source === "cash" ? "text-primary" : "text-muted-foreground")} />
              <div className="font-medium text-sm">Tiền mặt</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Chi trực tiếp từ quỹ tiền mặt
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thông tin khoản chi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {source === "bank" && banks.length > 1 && (
            <div>
              <Label className="mb-1.5 block">Tài khoản ngân hàng</Label>
              <select
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                className="h-9 w-full px-3 rounded-md border border-input bg-background text-sm"
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name} - {b.account_number}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="mb-1.5 block">
                Ngày <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={transDate}
                onChange={(e) => setTransDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label className="mb-1.5 block">
                Số tiền <span className="text-destructive">*</span>
              </Label>
              <CurrencyInput value={amount} onChange={setAmount} required />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block">
              Khoản mục <span className="text-destructive">*</span>
            </Label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-9 w-full px-3 rounded-md border border-input bg-background text-sm"
              required
            >
              <option value="">— Chọn khoản mục —</option>
              {Object.entries(grouped).map(([type, items]) => (
                <optgroup key={type} label={CATEGORY_TYPE_LABEL[type] ?? type}>
                  {items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <Label className="mb-1.5 block">
              Nội dung <span className="text-destructive">*</span>
            </Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mô tả ngắn về khoản chi"
              required
            />
          </div>

          <div>
            <Label className="mb-1.5 block">Bên nhận (tùy chọn)</Label>
            <Input
              value={counterpartyName}
              onChange={(e) => setCounterpartyName(e.target.value)}
              placeholder="Tên đối tác/nhà cung cấp"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Hủy
        </Button>
        <Button type="submit" disabled={loading || amount <= 0 || !categoryId || !description.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Lưu chi tiêu
        </Button>
      </div>
    </form>
  );
}
