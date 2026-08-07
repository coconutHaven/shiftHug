import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { requireUserId, throwOnError } from '@/lib/supabaseAuth';

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

function parseExpenses(raw: unknown): FixedShiftExpense[] {
  if (Array.isArray(raw)) {
    return raw.map((e) => ({
      name: String((e as FixedShiftExpense)?.name ?? ''),
      amount: Number((e as FixedShiftExpense)?.amount ?? 0),
    }));
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return parseExpenses(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  return [];
}

function mapFixedShift(row: Record<string, unknown>): FixedShift {
  return {
    id: String(row.id),
    client_id: String(row.client_id),
    day_of_week: Number(row.day_of_week),
    default_hours: Number(row.default_hours),
    rate_id: (row.rate_id as string | null) ?? null,
    rate_name: (row.rate_name as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    hourly_rate: row.hourly_rate != null ? Number(row.hourly_rate) : null,
    mileage: row.mileage != null ? Number(row.mileage) : null,
    mileage_rate: row.mileage_rate != null ? Number(row.mileage_rate) : null,
    expenses: parseExpenses(row.expenses),
    reference_number: (row.reference_number as string | null) ?? null,
  };
}

function mapClient(row: Record<string, unknown>): Client {
  const rates = ((row.client_rates as Record<string, unknown>[] | null) ?? []).map((r) => ({
    id: String(r.id),
    client_id: String(r.client_id),
    rate_name: String(r.rate_name),
    rate_amount: Number(r.rate_amount),
    reference_number: (r.reference_number as string | null) ?? null,
  }));
  const fixed = ((row.fixed_shifts as Record<string, unknown>[] | null) ?? []).map(mapFixedShift);
  return {
    id: String(row.id),
    name: String(row.name),
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    service_description: (row.service_description as string | null) ?? null,
    ref_number: (row.ref_number as string | null) ?? null,
    hourly_rate: Number(row.hourly_rate ?? 0),
    km_rate: Number(row.km_rate ?? 0),
    client_rates: rates,
    fixed_shifts: fixed,
  };
}

function serializeFixedExpenses(expenses?: FixedShiftExpense[]): string {
  return JSON.stringify(expenses ?? []);
}

export function useClients() {
  const queryClient = useQueryClient();

  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const data = throwOnError(
        await supabase
          .from('clients')
          .select('*, client_rates(*), fixed_shifts(*)')
          .order('name'),
      );
      return (data ?? []).map((c) => mapClient(c as Record<string, unknown>));
    },
  });

  const createClient = useMutation({
    mutationFn: async (client: Omit<Client, 'id' | 'client_rates' | 'fixed_shifts'>) => {
      const userId = await requireUserId();
      const data = throwOnError(
        await supabase
          .from('clients')
          .insert({
            user_id: userId,
            name: client.name,
            email: client.email,
            phone: client.phone,
            address: client.address,
            service_description: client.service_description,
            ref_number: client.ref_number,
            hourly_rate: client.hourly_rate,
            km_rate: client.km_rate,
          })
          .select('*')
          .single(),
      );
      return mapClient({ ...data, client_rates: [], fixed_shifts: [] });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Client> & { id: string }) => {
      const allowed = {
        name: updates.name,
        email: updates.email,
        phone: updates.phone,
        address: updates.address,
        service_description: updates.service_description,
        ref_number: updates.ref_number,
        hourly_rate: updates.hourly_rate,
        km_rate: updates.km_rate,
      };
      const payload = Object.fromEntries(
        Object.entries(allowed).filter(([, v]) => v !== undefined),
      );
      throwOnError(await supabase.from('clients').update(payload).eq('id', id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      throwOnError(await supabase.from('clients').delete().eq('id', id));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  return {
    clients: clientsQuery.data ?? [],
    isLoading: clientsQuery.isLoading,
    createClient,
    updateClient,
    deleteClient,
  };
}

export function useClientRates(clientId: string) {
  const queryClient = useQueryClient();

  const ratesQuery = useQuery({
    queryKey: ['client_rates', clientId],
    queryFn: async () => {
      const data = throwOnError(
        await supabase
          .from('client_rates')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at'),
      );
      return (data ?? []).map((r) => ({
        id: r.id,
        client_id: r.client_id,
        rate_name: r.rate_name,
        rate_amount: Number(r.rate_amount),
        reference_number: r.reference_number ?? null,
      })) as ClientRate[];
    },
    enabled: !!clientId,
  });

  const addRate = useMutation({
    mutationFn: async (rate: Omit<ClientRate, 'id'>) => {
      throwOnError(
        await supabase.from('client_rates').insert({
          client_id: clientId,
          rate_name: rate.rate_name,
          rate_amount: rate.rate_amount,
          reference_number: rate.reference_number ?? null,
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_rates', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const deleteRate = useMutation({
    mutationFn: async (id: string) => {
      throwOnError(await supabase.from('client_rates').delete().eq('id', id));
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
      const data = throwOnError(
        await supabase
          .from('fixed_shifts')
          .select('*')
          .eq('client_id', clientId)
          .order('day_of_week'),
      );
      return (data ?? []).map((s) => mapFixedShift(s as Record<string, unknown>));
    },
    enabled: !!clientId,
  });

  const addShift = useMutation({
    mutationFn: async (shift: Omit<FixedShift, 'id'>) => {
      throwOnError(
        await supabase.from('fixed_shifts').insert({
          client_id: clientId,
          day_of_week: shift.day_of_week,
          default_hours: shift.default_hours,
          rate_id: shift.rate_id,
          rate_name: shift.rate_name,
          notes: shift.notes,
          hourly_rate: shift.hourly_rate ?? null,
          mileage: shift.mileage ?? null,
          mileage_rate: shift.mileage_rate ?? null,
          expenses: serializeFixedExpenses(shift.expenses),
          reference_number: shift.reference_number ?? null,
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_shifts', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const updateShift = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FixedShift> & { id: string }) => {
      const payload: Record<string, unknown> = {};
      if (updates.day_of_week != null) payload.day_of_week = updates.day_of_week;
      if (updates.default_hours != null) payload.default_hours = updates.default_hours;
      if (updates.rate_id !== undefined) payload.rate_id = updates.rate_id;
      if (updates.rate_name !== undefined) payload.rate_name = updates.rate_name;
      if (updates.notes !== undefined) payload.notes = updates.notes;
      if (updates.hourly_rate !== undefined) payload.hourly_rate = updates.hourly_rate;
      if (updates.mileage !== undefined) payload.mileage = updates.mileage;
      if (updates.mileage_rate !== undefined) payload.mileage_rate = updates.mileage_rate;
      if (updates.expenses !== undefined) payload.expenses = serializeFixedExpenses(updates.expenses);
      if (updates.reference_number !== undefined) payload.reference_number = updates.reference_number;
      throwOnError(await supabase.from('fixed_shifts').update(payload).eq('id', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_shifts', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  const deleteShift = useMutation({
    mutationFn: async (id: string) => {
      throwOnError(await supabase.from('fixed_shifts').delete().eq('id', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixed_shifts', clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });

  return { shifts: shiftsQuery.data ?? [], addShift, updateShift, deleteShift };
}
