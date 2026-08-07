import { describe, it, expect } from 'vitest';
import {
  calculateShift,
  invoiceLineTotal,
  buildInvoiceDisplayRows,
} from '@/lib/shiftCalculations';
import type { InvoiceShift } from '@/hooks/useInvoices';

const baseShift = (): InvoiceShift => ({
  shift_date: '1/6',
  day_name: 'Mon',
  hours: 0,
  hourly_rate: 44,
  rate_name: 'Standard',
  km: 0,
  km_rate: 0.95,
  expenses: [],
  expenses_total: 0,
  shift_total: 0,
  invoice_hours: 0,
  invoice_rate: 0,
  invoice_amount: 0,
  sort_order: 0,
});

describe('calculateShift', () => {
  it('bills hours × rate only; expenses stay on shift_total', () => {
    const shift = calculateShift({
      ...baseShift(),
      hours: 5,
      hourly_rate: 44,
      km: 0,
      expenses: [{ name: 'Expense', amount: 42.4 }],
    });
    expect(shift.shift_total).toBe(262.4);
    expect(shift.expenses_total).toBe(42.4);
    expect(shift.invoice_rate).toBe(44);
    expect(shift.invoice_hours).toBe(5);
    expect(shift.invoice_amount).toBe(220);
  });

  it('does not fold km into invoice_hours', () => {
    const shift = calculateShift({
      ...baseShift(),
      hours: 3,
      hourly_rate: 55,
      km: 10,
      km_rate: 0.95,
      expenses: [{ name: 'Parking', amount: 5 }],
    });
    expect(shift.shift_total).toBe(179.5);
    expect(shift.invoice_rate).toBe(55);
    expect(shift.invoice_hours).toBe(3);
    expect(shift.invoice_amount).toBe(165);
  });
});

describe('invoiceLineTotal', () => {
  it('defaults to labour only', () => {
    const a = calculateShift({
      ...baseShift(),
      hours: 3,
      hourly_rate: 50,
      km: 10,
      km_rate: 0.95,
      expenses: [{ name: 'P', amount: 5 }],
    });
    expect(invoiceLineTotal([a])).toBe(150);
  });

  it('can include km and expenses', () => {
    const a = calculateShift({
      ...baseShift(),
      hours: 3,
      hourly_rate: 50,
      km: 10,
      km_rate: 0.95,
      expenses: [{ name: 'P', amount: 5 }],
    });
    expect(invoiceLineTotal([a], { includeKm: true, includeExpenses: true })).toBe(164.5);
  });
});

describe('buildInvoiceDisplayRows', () => {
  it('adds optional travel and expense rows', () => {
    const shift = calculateShift({
      ...baseShift(),
      hours: 2,
      hourly_rate: 44,
      km: 10,
      km_rate: 0.95,
      expenses: [{ name: 'Parking', amount: 5 }],
    });
    const rows = buildInvoiceDisplayRows([shift], {
      serviceDescription: 'Support',
      includeKm: true,
      includeExpenses: true,
    });
    expect(rows).toHaveLength(3);
    expect(rows[0].amount).toBe(88);
    expect(rows[1].description).toContain('Travel');
    expect(rows[2].description).toBe('Parking');
  });
});
