import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ClientRate {
  id: string;
  client_id: string;
  rate_name: string;
  rate_amount: number;
  reference_number?: string | null;
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
  expenses?: string | null;
  reference_number?: string | null;
}

export interface Client {
  id: string;
  user_id: string;
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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const clientsQuery = useQuery({
    queryKey: ['clients', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*, client_rates(*), fixed_shifts(*)')
        .order('name');
      if (error) throw error;
      return data as Client[];
    },
    enabled: !!user,
  });

  const createClient = useMutation({
    mutationFn: async (client: Omit<Client, 'id' | 'user_id' | 'client_rates' | 'fixed_shifts'> & { rates?: Omit<ClientRate, 'id' | 'client_id'>[]; shifts?: Omit<FixedShift, 'id' | 'client_id'>[] }) => {
      const { rates, shifts, ...clientData } = client;
      const { data, error } = await supabase
        .from('clients')
        .insert({ ...clientData, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;

      if (rates?.length) {
        await supabase.from('client_rates').insert(rates.map(r => ({ ...r, client_id: data.id })));
      }
      if (shifts?.length) {
        await supabase.from('fixed_shifts').insert(shifts.map(s => ({ ...s, client_id: data.id })));
      }
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Client> & { id: string }) => {
      const { error } = await supabase.from('clients').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  return { clients: clientsQuery.data ?? [], isLoading: clientsQuery.isLoading, createClient, updateClient, deleteClient };
}

export function useClientRates(clientId: string) {
  const queryClient = useQueryClient();

  const ratesQuery = useQuery({
    queryKey: ['client_rates', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('client_rates').select('*').eq('client_id', clientId);
      if (error) throw error;
      return data as ClientRate[];
    },
    enabled: !!clientId,
  });

  const addRate = useMutation({
    mutationFn: async (rate: Omit<ClientRate, 'id'>) => {
      const { error } = await supabase.from('client_rates').insert(rate);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_rates', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const deleteRate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_rates').delete().eq('id', id);
      if (error) throw error;
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
    queryFn: async () => {
      const { data, error } = await supabase.from('fixed_shifts').select('*').eq('client_id', clientId).order('day_of_week');
      if (error) throw error;
      return data as FixedShift[];
    },
    enabled: !!clientId,
  });

  const addShift = useMutation({
    mutationFn: async (shift: Omit<FixedShift, 'id'>) => {
      const { error } = await supabase.from('fixed_shifts').insert(shift);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_shifts', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const deleteShift = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fixed_shifts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_shifts', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  return { shifts: shiftsQuery.data ?? [], addShift, deleteShift };
}
