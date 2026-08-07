import type { InvoiceShift } from '@/hooks/useInvoices';

export type InvoiceIncludeOptions = {
  includeKm?: boolean;
  includeExpenses?: boolean;
};

/** Labour line is hours × rate; km/expenses stay on shift_total only unless opted into the invoice. */
export function calculateShift(shift: InvoiceShift): InvoiceShift {
  const hoursAmount = Math.round(shift.hours * shift.hourly_rate * 100) / 100;
  const kmAmount = Math.round(shift.km * shift.km_rate * 100) / 100;
  const expensesTotal = Math.round(
    shift.expenses.reduce((sum, e) => sum + e.amount, 0) * 100,
  ) / 100;
  const shiftTotal = Math.round((hoursAmount + kmAmount + expensesTotal) * 100) / 100;
  const invoiceRate = shift.hourly_rate;
  const invoiceHours = Math.round(shift.hours * 100) / 100;
  const invoiceAmount = Math.round(invoiceHours * invoiceRate * 100) / 100;

  return {
    ...shift,
    expenses_total: expensesTotal,
    shift_total: shiftTotal,
    invoice_hours: invoiceHours,
    invoice_rate: invoiceRate,
    invoice_amount: invoiceAmount,
  };
}

export function invoiceLineTotal(
  shifts: InvoiceShift[],
  options: InvoiceIncludeOptions = {},
): number {
  const { includeKm = false, includeExpenses = false } = options;
  return (
    Math.round(
      shifts.reduce((sum, s) => {
        let line = s.invoice_amount;
        if (includeKm) line += s.km * s.km_rate;
        if (includeExpenses) line += s.expenses_total;
        return sum + line;
      }, 0) * 100,
    ) / 100
  );
}

export type InvoiceDisplayRow = {
  date: string;
  description: string;
  reference: string;
  hoursLabel: string;
  rateLabel: string;
  amount: number;
};

/** Build client-facing invoice rows (labour + optional km/expense lines). */
export function buildInvoiceDisplayRows(
  shifts: InvoiceShift[],
  opts: {
    serviceDescription: string;
    defaultRef?: string | null;
    includeKm?: boolean;
    includeExpenses?: boolean;
  },
): InvoiceDisplayRow[] {
  const {
    serviceDescription,
    defaultRef = '',
    includeKm = false,
    includeExpenses = false,
  } = opts;
  const rows: InvoiceDisplayRow[] = [];

  for (const s of shifts) {
    const ref = s.reference_number || defaultRef || '';
    rows.push({
      date: s.shift_date,
      description: serviceDescription,
      reference: ref,
      hoursLabel: s.invoice_hours.toFixed(2),
      rateLabel: `$${s.invoice_rate}`,
      amount: s.invoice_amount,
    });

    if (includeKm && s.km > 0) {
      const kmAmount = Math.round(s.km * s.km_rate * 100) / 100;
      rows.push({
        date: s.shift_date,
        description: `Travel (${s.km} km)`,
        reference: ref,
        hoursLabel: '—',
        rateLabel: `$${s.km_rate}/km`,
        amount: kmAmount,
      });
    }

    if (includeExpenses) {
      for (const exp of s.expenses) {
        rows.push({
          date: s.shift_date,
          description: exp.name,
          reference: ref,
          hoursLabel: '—',
          rateLabel: '—',
          amount: exp.amount,
        });
      }
    }
  }

  return rows;
}
