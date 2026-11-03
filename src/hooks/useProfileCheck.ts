import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { clearCachedMCQData, clearCachedMCQDataSync, getStoredScopeKey, setStoredScopeKey } from '@/utils/mcqContentCache';

export const useProfileCheck = (user: User | null, authResolved: boolean) => {
  const navigate = useNavigate();
  const checkedContextRef = useRef<string | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profiles', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as any;
    },
    enabled: !!user?.id && authResolved,
    staleTime: 0, 
  });

  useEffect(() => {
    if (!authResolved || isLoading || !profile || !user) return;

    // Check institute, program, and year cache context
    const progCode = String(profile.program_code || 'mbbs').trim().toLowerCase();
    const currentScopeKey = `${user.id}:${String(profile.institute || '').trim().toLowerCase()}:${progCode}:${String(profile.year || '').trim().toLowerCase()}`;
    if (checkedContextRef.current !== currentScopeKey) {
      checkedContextRef.current = currentScopeKey;
      const storedScopeKey = getStoredScopeKey();
      if (storedScopeKey && storedScopeKey !== currentScopeKey) {
        clearCachedMCQDataSync();
        void clearCachedMCQData();
      }
      setStoredScopeKey(currentScopeKey);
    }

    // 1. Restriction Logic based on the SQL migration
    // Columns: user_restricted (bool), reason (text), duration (timestamp), reviewed (bool), decision (bool)
    const restriction = profile.restriction_details;

    if (restriction?.user_restricted) {
      if (restriction.duration) {
        const expiryDate = new Date(restriction.duration);
        const now = new Date();
        if (now >= expiryDate) {
          // Duration expired
        }
      }

      if (window.location.pathname !== '/restricted') {
        navigate('/restricted', { replace: true });
      }
    }
  }, [profile, isLoading, authResolved, user, navigate]);

  return { profile, isLoading };
};
