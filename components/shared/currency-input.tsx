"use client";

import { forwardRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

/**
 * Input nhập số tiền với format tự động:
 * - Gõ: 5000000 → hiển thị: 5.000.000
 * - Khi blur, làm gọn các số 0
 */
export const CurrencyInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, className, ...props }, ref) => {
    const [display, setDisplay] = useState(formatVN(value));

    useEffect(() => {
      setDisplay(formatVN(value));
    }, [value]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value.replace(/[^\d]/g, "");
      const num = raw === "" ? 0 : parseInt(raw, 10);
      setDisplay(formatVN(num));
      onChange(num);
    }

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          className={cn("font-mono tabular-nums pr-8 text-right", className)}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          ₫
        </span>
      </div>
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";

function formatVN(value: number): string {
  if (!value || value === 0) return "";
  return new Intl.NumberFormat("vi-VN").format(value);
}
