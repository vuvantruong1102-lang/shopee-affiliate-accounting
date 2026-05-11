/**
 * Date period helpers - tính khoảng thời gian cho filter của sổ
 */

export type PeriodType = "this_month" | "last_month" | "this_quarter" | "this_year" | "custom";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;
  label: string;
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getDateRange(period: PeriodType, customFrom?: string, customTo?: string): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case "this_month": {
      const from = new Date(y, m, 1);
      const to = new Date(y, m + 1, 0);
      return {
        from: toDateStr(from),
        to: toDateStr(to),
        label: `Tháng ${m + 1}/${y}`,
      };
    }
    case "last_month": {
      const from = new Date(y, m - 1, 1);
      const to = new Date(y, m, 0);
      const lastM = from.getMonth() + 1;
      const lastY = from.getFullYear();
      return {
        from: toDateStr(from),
        to: toDateStr(to),
        label: `Tháng ${lastM}/${lastY}`,
      };
    }
    case "this_quarter": {
      const q = Math.floor(m / 3);
      const from = new Date(y, q * 3, 1);
      const to = new Date(y, q * 3 + 3, 0);
      return {
        from: toDateStr(from),
        to: toDateStr(to),
        label: `Quý ${q + 1}/${y}`,
      };
    }
    case "this_year": {
      const from = new Date(y, 0, 1);
      const to = new Date(y, 11, 31);
      return {
        from: toDateStr(from),
        to: toDateStr(to),
        label: `Năm ${y}`,
      };
    }
    case "custom": {
      return {
        from: customFrom ?? toDateStr(new Date(y, m, 1)),
        to: customTo ?? toDateStr(now),
        label: "Tùy chỉnh",
      };
    }
  }
}

export function getMonthOptions(yearsBack: number = 2): Array<{ value: string; label: string }> {
  const result: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < yearsBack * 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    result.push({
      value: `${y}-${pad(m)}`,
      label: `Tháng ${m}/${y}`,
    });
  }
  return result;
}
