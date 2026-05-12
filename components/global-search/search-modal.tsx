"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Loader2,
  User,
  Receipt,
  CreditCard,
  ArrowDownToLine,
  ArrowUpFromLine,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { globalSearch, type SearchResult, type SearchResultType } from "./actions";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input khi mở modal
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await globalSearch(trimmed);
        setResults(data);
        setSelectedIndex(0);
      } catch (err) {
        console.error("[GlobalSearch] error:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const handleNavigate = useCallback(
    (item: SearchResult) => {
      router.push(item.href);
      onClose();
    },
    [router, onClose],
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = results[selectedIndex];
        if (item) {
          handleNavigate(item);
        }
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, results, selectedIndex, onClose, handleNavigate]);

  // Scroll active item vào view
  useEffect(() => {
    if (!open) return;
    const el = document.getElementById(`search-result-${selectedIndex}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, open]);

  if (!open) return null;

  // Group results theo type
  const grouped: Record<SearchResultType, SearchResult[]> = {
    affiliate: [],
    shopee_payment: [],
    commission: [],
    bank_transaction: [],
  };
  for (const r of results) {
    grouped[r.type].push(r);
  }

  let runningIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[10vh] animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm affiliate, mã thanh toán Shopee, giao dịch..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {query.trim().length < 2 ? (
            <EmptyHint />
          ) : results.length === 0 && !loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Không tìm thấy kết quả cho "{query}"
            </div>
          ) : (
            <div className="py-2">
              {grouped.affiliate.length > 0 && (
                <ResultGroup label="Affiliates">
                  {grouped.affiliate.map((r) => {
                    const idx = runningIndex++;
                    return (
                      <ResultItem
                        key={`${r.type}-${r.id}`}
                        index={idx}
                        result={r}
                        active={idx === selectedIndex}
                        onClick={() => handleNavigate(r)}
                        onHover={() => setSelectedIndex(idx)}
                      />
                    );
                  })}
                </ResultGroup>
              )}

              {grouped.shopee_payment.length > 0 && (
                <ResultGroup label="Đợt thanh toán Shopee">
                  {grouped.shopee_payment.map((r) => {
                    const idx = runningIndex++;
                    return (
                      <ResultItem
                        key={`${r.type}-${r.id}`}
                        index={idx}
                        result={r}
                        active={idx === selectedIndex}
                        onClick={() => handleNavigate(r)}
                        onHover={() => setSelectedIndex(idx)}
                      />
                    );
                  })}
                </ResultGroup>
              )}

              {grouped.bank_transaction.length > 0 && (
                <ResultGroup label="Giao dịch ngân hàng">
                  {grouped.bank_transaction.map((r) => {
                    const idx = runningIndex++;
                    return (
                      <ResultItem
                        key={`${r.type}-${r.id}`}
                        index={idx}
                        result={r}
                        active={idx === selectedIndex}
                        onClick={() => handleNavigate(r)}
                        onHover={() => setSelectedIndex(idx)}
                      />
                    );
                  })}
                </ResultGroup>
              )}
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-t border-border text-[10px] text-muted-foreground bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono">
                <ArrowUp className="w-2.5 h-2.5 inline" />
                <ArrowDown className="w-2.5 h-2.5 inline ml-0.5" />
              </kbd>
              Di chuyển
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono">
                <CornerDownLeft className="w-2.5 h-2.5 inline" />
              </kbd>
              Mở
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono">
                Esc
              </kbd>
              Đóng
            </span>
          </div>
          <span>{results.length} kết quả</span>
        </div>
      </div>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="py-8 px-4 text-sm">
      <p className="text-center text-muted-foreground mb-4">
        Gõ ít nhất 2 ký tự để tìm kiếm
      </p>
      <div className="max-w-sm mx-auto space-y-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-2">Mẹo:</p>
        <div className="flex items-start gap-2">
          <User className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Tìm affiliate theo tên, SĐT, CCCD, email</span>
        </div>
        <div className="flex items-start gap-2">
          <Receipt className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Tìm đợt Shopee theo mã thanh toán</span>
        </div>
        <div className="flex items-start gap-2">
          <CreditCard className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Tìm giao dịch theo số tiền (vd: 20000000) hoặc mô tả</span>
        </div>
      </div>
    </div>
  );
}

function ResultGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ResultItem({
  index,
  result,
  active,
  onClick,
  onHover,
}: {
  index: number;
  result: SearchResult;
  active: boolean;
  onClick: () => void;
  onHover: () => void;
}) {
  const Icon = getIcon(result.type);
  const iconBg = getIconBg(result.type);

  return (
    <button
      id={`search-result-${index}`}
      onClick={onClick}
      onMouseEnter={onHover}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
        active ? "bg-primary/10" : "hover:bg-muted/40",
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0",
          iconBg,
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{result.title}</div>
        <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
      </div>
      <div className="text-right flex-shrink-0">
        {result.amount !== undefined && (
          <div className="text-sm font-semibold tabular-nums">
            {formatCurrency(result.amount)}
          </div>
        )}
        <div className="text-[10px] text-muted-foreground">{result.meta}</div>
      </div>
    </button>
  );
}

function getIcon(type: SearchResultType) {
  switch (type) {
    case "affiliate":
      return User;
    case "shopee_payment":
      return Receipt;
    case "commission":
      return Receipt;
    case "bank_transaction":
      return CreditCard;
    default:
      return Search;
  }
}

function getIconBg(type: SearchResultType): string {
  switch (type) {
    case "affiliate":
      return "bg-primary/10 text-primary";
    case "shopee_payment":
      return "bg-warning/10 text-warning";
    case "commission":
      return "bg-success/10 text-success";
    case "bank_transaction":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted";
  }
}
