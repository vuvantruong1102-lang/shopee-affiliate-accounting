"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { DepositModal } from "./deposit-modal";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
}

interface Props {
  affiliate: {
    id: string;
    full_name: string;
    received_total: number;
    undeposited: number;
  };
  companyBanks: BankAccount[];
}

export function AffiliateActionsButton({ affiliate, companyBanks }: Props) {
  const [depositOpen, setDepositOpen] = useState(false);

  return (
    <>
      <Button
        variant="default"
        size="sm"
        onClick={() => setDepositOpen(true)}
      >
        <Wallet className="w-3.5 h-3.5" />
        Nộp tiền
      </Button>

      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        affiliate={affiliate}
        companyBanks={companyBanks}
      />
    </>
  );
}
