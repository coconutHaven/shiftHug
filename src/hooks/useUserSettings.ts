import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

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
    queryFn: () => api.get<UserSettings | null>('/settings'),
  });

  const upsertSettings = useMutation({
    mutationFn: async (settings: Partial<UserSettings>) => {
      await api.put('/settings', settings);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user_settings'] }),
  });

  return { settings: settingsQuery.data, isLoading: settingsQuery.isLoading, upsertSettings };
}
