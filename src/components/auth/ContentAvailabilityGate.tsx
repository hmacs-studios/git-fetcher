import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import BrandedLoader from '@/components/BrandedLoader';

type ContentArea = 'mcqs' | 'past_papers';

type ContentAvailabilityGateProps = {
  area: ContentArea;
  children: ReactNode;
};

/**
 * Prevents manually entered URLs from bypassing the dashboard's resolved
 * programme/content availability. A zero content version means the snapshot
 * has not been built/applied yet, so it must retain legacy access instead of
 * redirecting a learner away from a quiz they just started.
 */
const ContentAvailabilityGate = ({ area, children }: ContentAvailabilityGateProps) => {
  const capabilityQuery = useQuery({
    queryKey: ['dashboard-content-capabilities'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_dashboard_content_capabilities');
      if (error || !data || typeof data !== 'object') return null;
      return data as {
        components?: Partial<Record<ContentArea, boolean>>;
        content_version?: number;
      };
    },
    staleTime: 1000 * 60,
    retry: 1,
  });

  if (capabilityQuery.isLoading) return <BrandedLoader fullscreen />;

  // A null response means the migration has not reached this environment yet.
  // Keep legacy access working during that deployment window.
  const contentVersion = Number(capabilityQuery.data?.content_version || 0);
  if (
    capabilityQuery.data
    && contentVersion > 0
    && capabilityQuery.data.components?.[area] === false
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ContentAvailabilityGate;
