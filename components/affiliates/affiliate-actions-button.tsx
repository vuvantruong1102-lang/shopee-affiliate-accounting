"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Banknote, FileSpreadsheet, Pencil, XCircle, Receipt } from "lucide-react";
import Link from "next/link";
import { DepositModal } from "./deposit-modal";
import { AnnualExportModal } from "./annual-export-modal";
import { CloseAffiliateModal } from "./close-affiliate-modal";

interface Props {
  affiliate: {
    id: string;
    full_name: string;
    received_total: number;
    undeposited: number;
    status?: string;
  };
}

export function AffiliateActionsButton({ affiliate }: Props) {
  const [depositOpen, setDepositOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  const isClosed = affiliate.status === "closed";

  return (
    <>
      {!isClosed && (
        <Button variant="default" size="sm" onClick={() => setDepositOpen(true)}>
          <Banknote className="w-3.5 h-3.5" />
          Nộp tiền mặt
        </Button>
      )}

      <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
        <FileSpreadsheet className="w-3.5 h-3.5" />
        Xuất Excel năm
      </Button>

      <Button variant="outline" size="sm" asChild>
        <Link href={`/tax/${affiliate.id}`}>
          <Receipt className="w-3.5 h-3.5" />
          Xem thuế chi tiết
        </Link>
      </Button>

      <Button variant="outline" size="sm" asChild>
        <Link href={`/affiliates/${affiliate.id}/edit`}>
          <Pencil className="w-3.5 h-3.5" />
          Chỉnh sửa
        </Link>
      </Button>

      {!isClosed && (
        <Button variant="outline" size="sm" onClick={() => setCloseOpen(true)}>
          <XCircle className="w-3.5 h-3.5" />
          Đóng tài khoản
        </Button>
      )}

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

      <CloseAffiliateModal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        affiliate={{
          id: affiliate.id,
          full_name: affiliate.full_name,
        }}
      />
    </>
  );
}
