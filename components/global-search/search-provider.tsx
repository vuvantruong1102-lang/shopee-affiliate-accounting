"use client";

import { useState, useEffect } from "react";
import { GlobalSearchModal } from "./search-modal";

/**
 * Provider invisible - chỉ lắng nghe Ctrl+K / Cmd+K toàn cục
 * và mở modal search. KHÔNG render button.
 *
 * Đặt 1 lần trong dashboard layout là đủ.
 */
export function GlobalSearchProvider() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
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

  return <GlobalSearchModal open={open} onClose={() => setOpen(false)} />;
}
