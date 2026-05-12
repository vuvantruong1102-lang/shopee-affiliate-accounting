"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { GlobalSearchModal } from "./search-modal";

/**
 * Global search trigger:
 * - Lắng nghe Ctrl+K / Cmd+K toàn cục để mở modal
 * - Render nút "Tìm kiếm" có thể click
 *
 * Cách dùng: đặt 1 lần trong layout dashboard.
 */
export function GlobalSearchTrigger() {
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    }

    function handleKey(e: KeyboardEvent) {
      // Ctrl+K hoặc Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-background hover:bg-muted text-sm text-muted-foreground transition-colors min-w-[200px] justify-between"
      >
        <span className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Tìm kiếm...</span>
        </span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">
          {isMac ? "⌘" : "Ctrl"}+K
        </kbd>
      </button>

      <GlobalSearchModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
