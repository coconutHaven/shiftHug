import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ClientRate {
  id: string;
  client_id: string;
  rate_name: string;
  rate_amount: number;
  reference_number?: string | null;
}

export interface FixedShiftExpense {
  name: string;
  amount: number;
}

export interface FixedShift {
  id: string;
  client_id: string;
  day_of_week: number;
  default_hours: number;
  rate_id: string | null;
  rate_name: string | null;
  notes: string | null;
  hourly_rate?: number | null;
  mileage?: number | null;
  mileage_rate?: number | null;
  expenses?: FixedShiftExpense[];
  reference_number?: string | null;
}

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  service_description: string | null;
  ref_number: string | null;
  hourly_rate: number;
  km_rate: number;
  client_rates?: ClientRate[];
  fixed_shifts?: FixedShift[];
}

export function useClients() {
  const queryClient = useQueryClient();

  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get<Client[]>('/clients'),
  });

  const createClient = useMutation({
    mutationFn: async (client: Omit<Client, 'id' | 'client_rates' | 'fixed_shifts'>) => {
      return api.post<Client>('/clients', client);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Client> & { id: string }) => {
      await api.put(`/clients/${id}`, updates);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/clients/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  return { clients: clientsQuery.data ?? [], isLoading: clientsQuery.isLoading, createClient, updateClient, deleteClient };
}

export function useClientRates(clientId: string) {
  const queryClient = useQueryClient();

  const ratesQuery = useQuery({
    queryKey: ['client_rates', clientId],
    queryFn: () => api.get<ClientRate[]>(`/clients/${clientId}/rates`),
    enabled: !!clientId,
  });

  const addRate = useMutation({
    mutationFn: async (rate: Omit<ClientRate, 'id'>) => {
      await api.post(`/clients/${clientId}/rates`, rate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_rates', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const deleteRate = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/client-rates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_rates', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  return { rates: ratesQuery.data ?? [], addRate, deleteRate };
}

export function useFixedShifts(clientId: string) {
  const queryClient = useQueryClient();

  const shiftsQuery = useQuery({
    queryKey: ['fixed_shifts', clientId],
    queryFn: () => api.get<FixedShift[]>(`/clients/${clientId}/fixed-shifts`),
    enabled: !!clientId,
  });

  const addShift = useMutation({
    mutationFn: async (shift: Omit<FixedShift, 'id'>) => {
      await api.post(`/clients/${clientId}/fixed-shifts`, shift);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_shifts', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const updateShift = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FixedShift> & { id: string }) => {
      await api.put(`/fixed-shifts/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_shifts', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const deleteShift = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/fixed-shifts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_shifts', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  return { shifts: shiftsQuery.data ?? [], addShift, updateShift, deleteShift };
}
