"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { TopAffiliate } from "@/types/audit";

interface Props {
  data: TopAffiliate[];
}

export function TopAffiliatesList({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Chưa có hoa hồng tháng này
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => Number(d.total_net)));

  return (
    <div className="divide-y divide-border">
      {data.map((a, idx) => {
        const value = Number(a.total_net);
        const percent = maxValue > 0 ? (value / maxValue) * 100 : 0;
        return (
          <Link
            key={a.affiliate_id}
            href={`/affiliates/${a.affiliate_id}`}
            className="block px-5 py-3 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-6 text-center">
                {idx === 0 ? (
                  <Trophy className="w-4 h-4 text-warning mx-auto" />
                ) : (
                  <span className="text-xs text-muted-foreground font-medium">
                    #{idx + 1}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate">
                    {a.affiliate_name}
                  </div>
                  <div className="text-sm tabular-nums font-medium whitespace-nowrap">
                    {formatCurrency(value)}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                    {a.commission_count} đợt
                  </span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
