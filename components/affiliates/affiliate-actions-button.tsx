"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, FileSpreadsheet } from "lucide-react";
import { DepositModal } from "./deposit-modal";
import { AnnualExportModal } from "./annual-export-modal";

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
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <>
      <Button variant="default" size="sm" onClick={() => setDepositOpen(true)}>
        <Wallet className="w-3.5 h-3.5" />
        Nộp tiền
      </Button>

      <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
        <FileSpreadsheet className="w-3.5 h-3.5" />
        Xuất Excel năm
      </Button>

      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        affiliate={affiliate}
        companyBanks={companyBanks}
      />

      <AnnualExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        affiliateId={affiliate.id}
        affiliateName={affiliate.full_name}
      />
    </>
  );
}
