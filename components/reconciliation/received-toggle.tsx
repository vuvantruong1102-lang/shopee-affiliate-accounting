"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toggleReceivedStatus } from "@/app/(dashboard)/reconciliation/actions";

interface Props {
  id: string;
  isReceived: boolean;
}

export function ReceivedToggle({ id, isReceived }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const result = await toggleReceivedStatus(id, !isReceived);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        !isReceived ? "Đã đánh dấu đã nhận" : "Đã chuyển về trạng thái chưa nhận",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={isReceived ? "outline" : "default"}
      onClick={handleToggle}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isReceived ? (
        <Clock className="w-4 h-4" />
      ) : (
        <CheckCircle2 className="w-4 h-4" />
      )}
      {isReceived ? "Hoàn tác: Chưa nhận" : "Đánh dấu đã nhận"}
    </Button>
  );
}
