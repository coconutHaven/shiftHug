import { parse } from 'date-fns';
import type { InvoiceShift } from '@/hooks/useInvoices';

/** Parse shift_date stored as d/M (e.g. 4/6) using the current calendar year. */
export function parseShiftDateStr(shiftDate: string): Date | null {
  try {
    const d = parse(shiftDate.trim(), 'd/M', new Date());
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** Sort shifts chronologically by shift_date and reassign sort_order. */
export function sortShiftsByDate(shifts: InvoiceShift[]): InvoiceShift[] {
  return [...shifts]
    .sort((a, b) => {
      const da = parseShiftDateStr(a.shift_date);
      const db = parseShiftDateStr(b.shift_date);
      const ta = da?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const tb = db?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (ta !== tb) return ta - tb;
      return a.sort_order - b.sort_order;
    })
    .map((s, i) => ({ ...s, sort_order: i }));
}
