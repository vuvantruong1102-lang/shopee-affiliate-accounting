/**
 * Tính khoảng thời gian kỳ trước để so sánh.
 * Ví dụ: 2026-05-01 → 2026-05-31 (31 ngày) thì kỳ trước là 2026-03-31 → 2026-04-30
 */

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;
  label?: string;
}

export interface ComparisonResult {
  current: DateRange;
  previous: DateRange;
  daysDiff: number;
}

function parseDate(s: string): Date {
  return new Date(s + "T00:00:00");
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

/**
 * Tính kỳ trước có cùng độ dài
 */
export function getPreviousPeriod(from: string, to: string): ComparisonResult {
  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  const daysDiff = Math.round(
    (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
  ) + 1; // inclusive

  const prevToDate = new Date(fromDate);
  prevToDate.setDate(prevToDate.getDate() - 1);

  const prevFromDate = new Date(prevToDate);
  prevFromDate.setDate(prevFromDate.getDate() - (daysDiff - 1));

  return {
    current: { from, to },
    previous: {
      from: toDateStr(prevFromDate),
      to: toDateStr(prevToDate),
    },
    daysDiff,
  };
}

export function calcChange(current: number, previous: number): {
  diff: number;
  percent: number;
  direction: "up" | "down" | "flat";
} {
  const diff = current - previous;
  let percent = 0;
  if (previous > 0) {
    percent = (diff / previous) * 100;
  } else if (current > 0) {
    percent = 100;
  }
  return {
    diff,
    percent,
    direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
  };
}

export function formatChange(
  current: number,
  previous: number,
): {
  text: string;
  className: string;
  direction: "up" | "down" | "flat";
} {
  const { percent, direction } = calcChange(current, previous);

  if (Math.abs(percent) < 0.5 || (current === 0 && previous === 0)) {
    return { text: "—", className: "text-muted-foreground", direction: "flat" };
  }

  const sign = percent > 0 ? "+" : "";
  return {
    text: `${sign}${percent.toFixed(1)}%`,
    className:
      direction === "up"
        ? "text-success"
        : direction === "down"
          ? "text-destructive"
          : "text-muted-foreground",
    direction,
  };
}

/**
 * Tạo label dễ đọc cho khoảng ngày
 */
export function formatDateRangeLabel(from: string, to: string): string {
  const fromD = parseDate(from);
  const toD = parseDate(to);

  // Cùng tháng
  if (
    fromD.getDate() === 1 &&
    toD.getDate() === new Date(toD.getFullYear(), toD.getMonth() + 1, 0).getDate() &&
    fromD.getMonth() === toD.getMonth() &&
    fromD.getFullYear() === toD.getFullYear()
  ) {
    return `Tháng ${fromD.getMonth() + 1}/${fromD.getFullYear()}`;
  }

  // Cùng quý
  if (
    fromD.getDate() === 1 &&
    fromD.getMonth() % 3 === 0 &&
    toD.getDate() === new Date(toD.getFullYear(), toD.getMonth() + 1, 0).getDate() &&
    toD.getMonth() === fromD.getMonth() + 2 &&
    fromD.getFullYear() === toD.getFullYear()
  ) {
    return `Quý ${Math.floor(fromD.getMonth() / 3) + 1}/${fromD.getFullYear()}`;
  }

  // Cả năm
  if (
    fromD.getDate() === 1 &&
    fromD.getMonth() === 0 &&
    toD.getDate() === 31 &&
    toD.getMonth() === 11 &&
    fromD.getFullYear() === toD.getFullYear()
  ) {
    return `Năm ${fromD.getFullYear()}`;
  }

  // Custom
  const fmt = (d: Date) =>
    `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
  return `${fmt(fromD)} - ${fmt(toD)}`;
}
