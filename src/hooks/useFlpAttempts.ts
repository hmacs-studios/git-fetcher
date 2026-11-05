import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FlpAttempt {
  id: string;
  score: number;
  total_questions: number;
  completed_at: string;
}

export function useFlpAttempts(userId: string | undefined, enabled = true) {
  return useQuery<FlpAttempt[]>({
    queryKey: ['flpResults', userId],
    enabled: Boolean(userId) && enabled,
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('flp_user_attempts')
        .select('id, score, total_questions, completed_at')
        .eq('user_id', userId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}
