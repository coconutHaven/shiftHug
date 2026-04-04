import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

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

export function useInvoices(clientId?: string) {
  const queryClient = useQueryClient();

  const invoicesQuery = useQuery({
    queryKey: ['invoices', clientId],
    queryFn: async () => {
      const invoices = await api.get<Invoice[]>('/invoices');
      if (clientId) return invoices.filter(i => i.client_id === clientId);
      return invoices;
    },
  });

  const getNextInvoiceNumber = async (cId: string): Promise<number> => {
    const { next } = await api.get<{ next: number }>(`/invoices/next-number/${cId}`);
    return next;
  };

  const createInvoice = useMutation({
    mutationFn: async (invoice: { client_id: string; invoice_date: string; shifts: InvoiceShift[]; invoice_number?: number }) => {
      return api.post<Invoice>('/invoices', invoice);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const deleteDraft = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/invoices/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const publishInvoice = useMutation({
    mutationFn: async (id: string) => {
      await api.put(`/invoices/${id}/publish`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Invoice> & { id: string }) => {
      await api.put(`/invoices/${id}`, updates);
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
