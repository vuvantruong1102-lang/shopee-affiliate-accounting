"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { BankAccountModal } from "./bank-account-modal";
import { DeleteBankAccountModal } from "./delete-bank-account-modal";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string | null;
  notes: string | null;
  opening_balance?: number | null;
  created_at?: string;
  is_deleted?: boolean | null;
}

interface Props {
  bankAccounts: BankAccount[];
  transactionCounts: Record<string, number>;
}

export function BankAccountsManager({ bankAccounts, transactionCounts }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<BankAccount | null>(null);

  function handleEdit(b: BankAccount) {
    setSelected(b);
    setEditOpen(true);
  }

  function handleDelete(b: BankAccount) {
    setSelected(b);
    setDeleteOpen(true);
  }

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="w-3.5 h-3.5" />
          Thêm tài khoản
        </Button>
      </div>

      {bankAccounts.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border py-12 text-center">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium">Chưa có tài khoản nào</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Thêm tài khoản công ty đầu tiên để bắt đầu
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            Thêm tài khoản
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {bankAccounts.map((b) => {
            const txnCount = transactionCounts[b.id] ?? 0;
            const opening = Number(b.opening_balance ?? 0);
            return (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{b.bank_name}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    {b.account_number}
                    {b.account_holder ? ` · ${b.account_holder}` : ""}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                    <span>
                      Số dư đầu kỳ:{" "}
                      <span className="font-medium tabular-nums">
                        {formatCurrency(opening)}
                      </span>
                    </span>
                    <span>·</span>
                    <span>{txnCount} giao dịch</span>
                    {b.notes ? (
                      <>
                        <span>·</span>
                        <span className="truncate max-w-[200px]">{b.notes}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(b)}
                    title="Chỉnh sửa"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(b)}
                    className="text-destructive hover:text-destructive"
                    title="Xóa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BankAccountModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
      />

      {selected && (
        <>
          <BankAccountModal
            open={editOpen}
            onClose={() => {
              setEditOpen(false);
              setSelected(null);
            }}
            mode="edit"
            initialData={{
              id: selected.id,
              bank_name: selected.bank_name,
              account_number: selected.account_number,
              account_holder: selected.account_holder,
              notes: selected.notes,
              opening_balance: selected.opening_balance,
            }}
          />

          <DeleteBankAccountModal
            open={deleteOpen}
            onClose={() => {
              setDeleteOpen(false);
              setSelected(null);
            }}
            bankAccount={{
              id: selected.id,
              bank_name: selected.bank_name,
              account_number: selected.account_number,
              transaction_count: transactionCounts[selected.id] ?? 0,
            }}
          />
        </>
      )}
    </>
  );
}
