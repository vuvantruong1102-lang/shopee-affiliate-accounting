"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Banknote, FileSpreadsheet } from "lucide-react";
import { DepositModal } from "./deposit-modal";
import { AnnualExportModal } from "./annual-export-modal";

interface Props {
  affiliate: {
    id: string;
    full_name: string;
    received_total: number;
    undeposited: number;
  };
}

export function AffiliateActionsButton({ affiliate }: Props) {
  const [depositOpen, setDepositOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <>
      <Button variant="default" size="sm" onClick={() => setDepositOpen(true)}>
        <Banknote className="w-3.5 h-3.5" />
        Nộp tiền mặt
      </Button>

      <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
        <FileSpreadsheet className="w-3.5 h-3.5" />
        Xuất Excel năm
      </Button>

      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        affiliate={affiliate}
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
