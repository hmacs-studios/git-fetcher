import React, { useState, useEffect } from 'react';
import { useFeatureAccess, FeatureKey } from '@/hooks/useFeatureAccess';
import { FeatureLockModal } from '@/components/ui/FeatureLockModal';
import BrandedLoader from '@/components/BrandedLoader';

interface FeatureGateProps {
  feature: FeatureKey;
  title?: string;
  children: React.ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ feature, title, children }) => {
  const { isAccessible, isLoading, planTier } = useFeatureAccess(feature);
  const [showModal, setShowModal] = useState(false);

  const displayName = title || feature.replace('_', ' ').toUpperCase();

  useEffect(() => {
    if (!isLoading && !isAccessible) {
      setShowModal(true);
    }
  }, [isLoading, isAccessible]);

  if (isLoading) {
    return <BrandedLoader fullscreen={true} />;
  }

  if (!isAccessible) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden">
        {/* Backdrop: Original page content rendered in inaccessible blurred state */}
        <div
          aria-hidden="true"
          className="pointer-events-none select-none filter blur-sm opacity-40 max-h-screen overflow-hidden transition-all duration-300"
        >
          {children}
        </div>

        {/* Feature Lock Bottom Sheet */}
        <FeatureLockModal
          open={showModal}
          onClose={() => setShowModal(false)}
          featureTitle={displayName}
          planTierRequired={planTier.toUpperCase()}
          redirectOnClose={true}
        />
      </div>
    );
  }

  return <>{children}</>;
};

export default FeatureGate;
