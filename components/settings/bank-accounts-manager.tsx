"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Loader2, Building2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from "@/app/(dashboard)/settings/actions";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  notes: string | null;
  created_at: string;
}

interface Props {
  bankAccounts: BankAccount[];
  transactionCounts: Record<string, number>;
}

export function BankAccountsManager({ bankAccounts, transactionCounts }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  const editingAccount = bankAccounts.find((b) => b.id === editingId);

  return (
    <div className="space-y-4">
      {/* Action button */}
      {!showForm && (
        <div className="flex justify-end">
          <Button onClick={openCreate} size="sm">
            <Plus className="w-3.5 h-3.5" />
            Thêm tài khoản
          </Button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <BankAccountForm
          account={editingAccount}
          onCancel={closeForm}
          onSuccess={closeForm}
        />
      )}

      {/* List */}
      {bankAccounts.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground border border-dashed border-border rounded-md">
          <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Chưa có tài khoản ngân hàng nào</p>
          <p className="text-xs mt-1">Bấm "Thêm tài khoản" để bắt đầu</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bankAccounts.map((b) => (
            <BankAccountItem
              key={b.id}
              account={b}
              transactionCount={transactionCounts[b.id] ?? 0}
              onEdit={() => openEdit(b.id)}
              disabled={editingId === b.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// FORM
// ============================================================================
function BankAccountForm({
  account,
  onCancel,
  onSuccess,
}: {
  account?: BankAccount;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const isEditing = !!account;
  const [bankName, setBankName] = useState(account?.bank_name ?? "");
  const [accountNumber, setAccountNumber] = useState(account?.account_number ?? "");
  const [accountHolder, setAccountHolder] = useState(account?.account_holder ?? "");
  const [notes, setNotes] = useState(account?.notes ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const input = {
        bank_name: bankName,
        account_number: accountNumber,
        account_holder: accountHolder,
        notes: notes.trim() || undefined,
      };

      const result = isEditing
        ? await updateBankAccount({ ...input, id: account!.id })
        : await createBankAccount(input);

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(isEditing ? "Đã cập nhật" : "Đã thêm tài khoản");
      onSuccess();
    } catch (err) {
      console.error(err);
      toast.error("Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-2 border-primary/30 rounded-md p-4 bg-primary/5 space-y-3"
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold">
          {isEditing ? "Sửa tài khoản" : "Thêm tài khoản mới"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 rounded-md hover:bg-muted text-muted-foreground"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-xs font-medium">
            Ngân hàng <span className="text-destructive">*</span>
          </Label>
          <Input
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="VD: Vietcombank, BIDV..."
            required
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium">
            Số tài khoản <span className="text-destructive">*</span>
          </Label>
          <Input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="VD: 0123456789"
            className="font-mono tabular-nums"
            required
          />
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block text-xs font-medium">
          Chủ tài khoản <span className="text-destructive">*</span>
        </Label>
        <Input
          value={accountHolder}
          onChange={(e) => setAccountHolder(e.target.value)}
          placeholder="VD: Công ty TNHH XYZ"
          required
        />
      </div>

      <div>
        <Label className="mb-1.5 block text-xs font-medium">Ghi chú</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Tùy chọn"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="flex-1">
          Hủy
        </Button>
        <Button type="submit" size="sm" disabled={loading} className="flex-1">
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Check className="w-3.5 h-3.5" />
          )}
          {isEditing ? "Lưu thay đổi" : "Thêm tài khoản"}
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// ITEM
// ============================================================================
function BankAccountItem({
  account,
  transactionCount,
  onEdit,
  disabled,
}: {
  account: BankAccount;
  transactionCount: number;
  onEdit: () => void;
  disabled?: boolean;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const hasTransactions = transactionCount > 0;
    const message = hasTransactions
      ? `Tài khoản ${account.bank_name} ${account.account_number} có ${transactionCount} giao dịch.\n\nXóa mềm sẽ ẩn TK khỏi danh sách nhưng giữ lịch sử giao dịch cũ. Tiếp tục?`
      : `Xóa tài khoản ${account.bank_name} ${account.account_number}?\nKhông có giao dịch nào, sẽ xóa hoàn toàn.`;

    if (!confirm(message)) return;

    setDeleting(true);
    try {
      const result = await deleteBankAccount(account.id);
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else if ("data" in result && result.data) {
        toast.success(
          result.data.was_hard_deleted
            ? "Đã xóa hoàn toàn tài khoản"
            : `Đã xóa mềm tài khoản (giữ ${result.data.transaction_count} giao dịch)`,
        );
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 p-3 rounded-md border border-border hover:bg-muted/40 transition-colors group",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{account.bank_name}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span className="font-mono tabular-nums">{account.account_number}</span>
            <span>·</span>
            <span className="truncate">{account.account_holder}</span>
          </div>
          {account.notes && (
            <div className="text-xs text-muted-foreground italic mt-0.5 truncate">
              📝 {account.notes}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-xs text-muted-foreground text-right">
          <div className="font-medium">{transactionCount}</div>
          <div className="text-[10px]">giao dịch</div>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={onEdit}
            disabled={deleting}
            className="p-2 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            title="Sửa"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Xóa"
          >
            {deleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
