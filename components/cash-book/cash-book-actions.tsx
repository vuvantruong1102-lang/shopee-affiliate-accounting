"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { CashTransactionModal } from "./cash-transaction-modal";

export function CashBookActions() {
  const [open, setOpen] = useState(false);
  const [defaultType, setDefaultType] = useState<"income" | "expense">("income");

  function handleOpen(type: "income" | "expense") {
    setDefaultType(type);
    setOpen(true);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => handleOpen("income")}>
          <ArrowDownToLine className="w-3.5 h-3.5" />
          Thu tiền mặt
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleOpen("expense")}>
          <ArrowUpFromLine className="w-3.5 h-3.5" />
          Chi tiền mặt
        </Button>
      </div>

      <CashTransactionModal
        open={open}
        onClose={() => setOpen(false)}
        defaultType={defaultType}
      />
    </>
  );
}
