"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Banknote, ArrowUpFromLine } from "lucide-react";
import { BankDepositModal } from "./bank-deposit-modal";
import { BankExpenseModal } from "./bank-expense-modal";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
}

interface Affiliate {
  id: string;
  full_name: string;
}

interface Props {
  bankAccounts: BankAccount[];
  affiliates: Affiliate[];
}

export function BankBookActions({ bankAccounts, affiliates }: Props) {
  const [depositOpen, setDepositOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setDepositOpen(true)}>
          <Banknote className="w-3.5 h-3.5" />
          Nộp tiền vào NH
        </Button>
        <Button size="sm" variant="outline" onClick={() => setExpenseOpen(true)}>
          <ArrowUpFromLine className="w-3.5 h-3.5" />
          Chi tiêu NH
        </Button>
      </div>

      <BankDepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        bankAccounts={bankAccounts}
        affiliates={affiliates}
      />

      <BankExpenseModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        bankAccounts={bankAccounts}
      />
    </>
  );
}
