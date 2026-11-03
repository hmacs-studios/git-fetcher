import React from 'react';

type BrandedLoaderProps = {
  fullscreen?: boolean;
};

const BrandedLoader: React.FC<BrandedLoaderProps> = ({ fullscreen = true }) => {
  return (
    <div
      className={[
        fullscreen ? 'fixed inset-0 z-[999]' : 'relative min-h-[16rem] w-full',
        'flex items-center justify-center overflow-hidden bg-background text-foreground transition-colors duration-300',
      ].join(' ')}
    >
      <div className="relative flex items-center justify-center w-[140px] h-[140px] bg-card rounded-full shadow-lg border border-border animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">
        <img src="/icon.svg" alt="Loading" className="h-[100px] w-[100px] object-contain" />
      </div>
    </div>
  );
};

export default BrandedLoader;
