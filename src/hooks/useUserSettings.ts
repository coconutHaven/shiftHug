import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { requireUserId, throwOnError } from '@/lib/supabaseAuth';

export interface UserSettings {
  id?: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  abn: string | null;
  bsb: string | null;
  account_number: string | null;
  color_scheme: string | null;
}

export function useUserSettings() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['user_settings'],
    queryFn: async () => {
      const userId = await requireUserId();
      const data = throwOnError(
        await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
      );
      if (!data) return null;
      return {
        id: data.id,
        display_name: data.display_name,
        email: data.email,
        phone: data.phone,
        abn: data.abn,
        bsb: data.bsb,
        account_number: data.account_number,
        color_scheme: data.color_scheme,
      } as UserSettings;
    },
  });

  const upsertSettings = useMutation({
    mutationFn: async (settings: Partial<UserSettings>) => {
      const userId = await requireUserId();
      const existing = throwOnError(
        await supabase
          .from('user_settings')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle(),
      );

      const payload: Record<string, unknown> = {};
      for (const key of [
        'display_name',
        'email',
        'phone',
        'abn',
        'bsb',
        'account_number',
        'color_scheme',
      ] as const) {
        if (settings[key] !== undefined) payload[key] = settings[key];
      }

      if (existing?.id) {
        throwOnError(
          await supabase.from('user_settings').update(payload).eq('id', existing.id),
        );
      } else {
        throwOnError(
          await supabase.from('user_settings').insert({ user_id: userId, ...payload }),
        );
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user_settings'] }),
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    upsertSettings,
  };
}
