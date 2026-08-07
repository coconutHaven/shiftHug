import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { requireUserId, throwOnError } from '@/lib/supabaseAuth';
import { invoiceLineTotal } from '@/lib/shiftCalculations';

export interface Expense {
  name: string;
  amount: number;
}

export interface InvoiceShift {
  id?: string;
  invoice_id?: string;
  shift_date: string;
  day_name: string;
  hours: number;
  hourly_rate: number;
  rate_name: string;
  reference_number?: string | null;
  km: number;
  km_rate: number;
  expenses: Expense[];
  expenses_total: number;
  shift_total: number;
  invoice_hours: number;
  invoice_rate: number;
  invoice_amount: number;
  sort_order: number;
}

export interface Invoice {
  id: string;
  client_id: string;
  invoice_number: number;
  invoice_date: string;
  status: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  invoice_shifts?: InvoiceShift[];
  clients?: { name: string };
}

function parseExpenses(raw: unknown): Expense[] {
  if (Array.isArray(raw)) {
    return raw.map((e) => ({
      name: String((e as Expense)?.name ?? ''),
      amount: Number((e as Expense)?.amount ?? 0),
    }));
  }
  if (typeof raw === 'string') {
    try {
      return parseExpenses(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

function mapShift(row: Record<string, unknown>): InvoiceShift {
  return {
    id: row.id as string | undefined,
    invoice_id: row.invoice_id as string | undefined,
    shift_date: String(row.shift_date ?? ''),
    day_name: String(row.day_name ?? ''),
    hours: Number(row.hours ?? 0),
    hourly_rate: Number(row.hourly_rate ?? 0),
    rate_name: String(row.rate_name ?? ''),
    reference_number: (row.reference_number as string | null) ?? null,
    km: Number(row.km ?? 0),
    km_rate: Number(row.km_rate ?? 0),
    expenses: parseExpenses(row.expenses),
    expenses_total: Number(row.expenses_total ?? 0),
    shift_total: Number(row.shift_total ?? 0),
    invoice_hours: Number(row.invoice_hours ?? 0),
    invoice_rate: Number(row.invoice_rate ?? 0),
    invoice_amount: Number(row.invoice_amount ?? 0),
    sort_order: Number(row.sort_order ?? 0),
  };
}

function shiftInsertRows(invoiceId: string, shifts: InvoiceShift[]) {
  return shifts.map((s, i) => ({
    invoice_id: invoiceId,
    shift_date: s.shift_date,
    day_name: s.day_name,
    hours: s.hours,
    hourly_rate: s.hourly_rate,
    rate_name: s.rate_name,
    reference_number: s.reference_number ?? null,
    km: s.km,
    km_rate: s.km_rate,
    expenses: s.expenses,
    expenses_total: s.expenses_total,
    shift_total: s.shift_total,
    invoice_hours: s.invoice_hours,
    invoice_rate: s.invoice_rate,
    invoice_amount: s.invoice_amount,
    sort_order: s.sort_order ?? i,
  }));
}

export function useInvoices(clientId?: string) {
  const queryClient = useQueryClient();

  const invoicesQuery = useQuery({
    queryKey: ['invoices', clientId],
    queryFn: async () => {
      let q = supabase
        .from('invoices')
        .select('*, clients(name), invoice_shifts(*)')
        .order('created_at', { ascending: false });
      if (clientId) q = q.eq('client_id', clientId);
      const data = throwOnError(await q);
      return (data ?? []).map((inv) => ({
        ...inv,
        total_amount: Number(inv.total_amount),
        invoice_number: Number(inv.invoice_number),
        clients: inv.clients
          ? { name: (inv.clients as { name: string }).name }
          : undefined,
        invoice_shifts: ((inv.invoice_shifts as Record<string, unknown>[] | null) ?? [])
          .map(mapShift)
          .sort((a, b) => a.sort_order - b.sort_order),
      })) as Invoice[];
    },
  });

  const getNextInvoiceNumber = async (cId: string): Promise<number> => {
    const data = throwOnError(
      await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('client_id', cId)
        .order('invoice_number', { ascending: false })
        .limit(1),
    );
    const max = data?.[0]?.invoice_number;
    return (max != null ? Number(max) : 0) + 1;
  };

  const createInvoice = useMutation({
    mutationFn: async (invoice: {
      client_id: string;
      invoice_date: string;
      shifts: InvoiceShift[];
      invoice_number?: number;
    }) => {
      const userId = await requireUserId();
      const invoiceNumber =
        invoice.invoice_number ?? (await getNextInvoiceNumber(invoice.client_id));
      const total = invoiceLineTotal(invoice.shifts);

      const created = throwOnError(
        await supabase
          .from('invoices')
          .insert({
            user_id: userId,
            client_id: invoice.client_id,
            invoice_date: invoice.invoice_date,
            invoice_number: invoiceNumber,
            status: 'draft',
            total_amount: total,
          })
          .select('*')
          .single(),
      );

      const shifts = throwOnError(
        await supabase
          .from('invoice_shifts')
          .insert(shiftInsertRows(created.id, invoice.shifts))
          .select('*'),
      );

      return {
        ...created,
        total_amount: Number(created.total_amount),
        invoice_shifts: (shifts ?? []).map((s) => mapShift(s as Record<string, unknown>)),
      } as Invoice;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const deleteDraft = useMutation({
    mutationFn: async (id: string) => {
      const existing = throwOnError(
        await supabase.from('invoices').select('status').eq('id', id).single(),
      );
      if (existing.status !== 'draft') throw new Error('Only draft invoices can be deleted');
      throwOnError(await supabase.from('invoices').delete().eq('id', id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const publishInvoice = useMutation({
    mutationFn: async (id: string) => {
      throwOnError(
        await supabase.from('invoices').update({ status: 'published' }).eq('id', id),
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Invoice> & { id: string }) => {
      const allowed: Record<string, unknown> = {};
      if (updates.invoice_date != null) allowed.invoice_date = updates.invoice_date;
      if (updates.notes !== undefined) allowed.notes = updates.notes;
      if (updates.total_amount != null) allowed.total_amount = updates.total_amount;
      throwOnError(await supabase.from('invoices').update(allowed).eq('id', id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const updateDraftInvoice = useMutation({
    mutationFn: async (payload: {
      id: string;
      invoice_date: string;
      shifts: InvoiceShift[];
      invoice_number?: number;
    }) => {
      const existing = throwOnError(
        await supabase.from('invoices').select('status').eq('id', payload.id).single(),
      );
      if (existing.status !== 'draft') throw new Error('Only draft invoices can be edited');

      const total = invoiceLineTotal(payload.shifts);
      const updatePayload: Record<string, unknown> = {
        invoice_date: payload.invoice_date,
        total_amount: total,
      };
      if (payload.invoice_number != null) updatePayload.invoice_number = payload.invoice_number;

      const updated = throwOnError(
        await supabase
          .from('invoices')
          .update(updatePayload)
          .eq('id', payload.id)
          .select('*')
          .single(),
      );

      throwOnError(await supabase.from('invoice_shifts').delete().eq('invoice_id', payload.id));
      const shifts = throwOnError(
        await supabase
          .from('invoice_shifts')
          .insert(shiftInsertRows(payload.id, payload.shifts))
          .select('*'),
      );

      return {
        ...updated,
        total_amount: Number(updated.total_amount),
        invoice_shifts: (shifts ?? []).map((s) => mapShift(s as Record<string, unknown>)),
      } as Invoice;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  return {
    invoices: invoicesQuery.data ?? [],
    isLoading: invoicesQuery.isLoading,
    createInvoice,
    publishInvoice,
    updateInvoice,
    updateDraftInvoice,
    deleteDraft,
    getNextInvoiceNumber,
  };
}
