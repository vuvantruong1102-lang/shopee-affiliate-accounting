"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAffiliate } from "@/app/(dashboard)/affiliates/actions";

interface Props {
  id: string;
  name: string;
}

export function AffiliateDeleteButton({ id, name }: Props) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }

    setLoading(true);
    try {
      const result = await deleteAffiliate(id);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Đã đóng tài khoản ${name}`);
      }
    } catch {
      toast.error("Có lỗi xảy ra");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleDelete}
      disabled={loading}
      className={
        confirming
          ? "border-destructive text-destructive hover:bg-destructive/10"
          : ""
      }
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Trash2 className="w-4 h-4" />
      )}
      {confirming ? "Bấm lại để xác nhận" : "Đóng tài khoản"}
    </Button>
  );
}
