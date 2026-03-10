import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface UserSettings {
  id?: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  abn: string | null;
  bsb: string | null;
  account_number: string | null;
  color_scheme: string | null;
}

export function useUserSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['user_settings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as UserSettings | null;
    },
    enabled: !!user,
  });

  const upsertSettings = useMutation({
    mutationFn: async (settings: Partial<UserSettings>) => {
      const { error } = await supabase
        .from('user_settings')
        .upsert({ ...settings, user_id: user!.id }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user_settings'] }),
  });

  return { settings: settingsQuery.data, isLoading: settingsQuery.isLoading, upsertSettings };
}
