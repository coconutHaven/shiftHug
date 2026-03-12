import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  user_id: string;
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

export function useInvoices(clientId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const invoicesQuery = useQuery({
    queryKey: ['invoices', user?.id, clientId],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select('*, clients(name), invoice_shifts(*)')
        .order('invoice_number', { ascending: false });
      if (clientId) query = query.eq('client_id', clientId);
      const { data, error } = await query;
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!user,
  });

  const getNextInvoiceNumber = async (clientId: string): Promise<number> => {
    const { data } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('client_id', clientId)
      .order('invoice_number', { ascending: false })
      .limit(1);

    return (data?.[0]?.invoice_number ?? 0) + 1;
  };

  const createInvoice = useMutation({
    mutationFn: async (invoice: { client_id: string; invoice_date: string; shifts: InvoiceShift[] }) => {
      const invoiceNumber = await getNextInvoiceNumber(invoice.client_id);
      const totalAmount = invoice.shifts.reduce((sum, s) => sum + s.invoice_amount, 0);
      const formattedDate = new Date(invoice.invoice_date)
        .toISOString()
        .split("T")[0];
      const { data, error } = await supabase
        .from('invoices')
        .insert({
          user_id: user!.id,
          client_id: invoice.client_id,
          invoice_number: invoiceNumber,
          invoice_date: formattedDate,
          total_amount: totalAmount,
          status: 'draft',
        })
        .select()
        .single();
      if (error) throw error;

      const shiftsToInsert = invoice.shifts.map((s, i) => ({
        invoice_id: data.id,
        shift_date: s.shift_date,
        day_name: s.day_name,
        hours: s.hours,
        hourly_rate: s.hourly_rate,
        rate_name: s.rate_name || 'Standard',
        reference_number: s.reference_number ?? null,
        km: s.km,
        km_rate: s.km_rate,
        expenses: JSON.stringify(s.expenses),
        expenses_total: s.expenses_total,
        shift_total: s.shift_total,
        invoice_hours: s.invoice_hours,
        invoice_rate: s.invoice_rate,
        invoice_amount: s.invoice_amount,
        sort_order: i,
      }));

      const { error: shiftError } = await supabase.from('invoice_shifts').insert(shiftsToInsert);
      if (shiftError) throw shiftError;

      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const deleteDraft = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id)
        .eq('status', 'draft');

      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const publishInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoices').update({ status: 'published' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Invoice> & { id: string }) => {
      const { error } = await supabase.from('invoices').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  return {
    invoices: invoicesQuery.data ?? [],
    isLoading: invoicesQuery.isLoading,
    createInvoice,
    publishInvoice,
    updateInvoice,
    deleteDraft,
    getNextInvoiceNumber,
  };
}
