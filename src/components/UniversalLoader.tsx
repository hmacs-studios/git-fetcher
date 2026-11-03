import React from 'react';

type UniversalLoaderProps = {
  label?: string;
  variant?: 'dark' | 'light' | 'full';
  size?: 'sm' | 'md' | 'lg';
};

export const UniversalLoader: React.FC<UniversalLoaderProps> = ({
  label = 'Loading...',
  variant = 'full',
  size = 'md',
}) => {
  const isFull = variant === 'full';

  const sizeClasses = {
    sm: {
      wrapper: 'w-[100px] h-[100px]',
      img: 'h-[70px] w-[70px]',
      text: 'text-xs',
    },
    md: {
      wrapper: 'w-[130px] h-[130px]',
      img: 'h-[90px] w-[90px]',
      text: 'text-sm',
    },
    lg: {
      wrapper: 'w-[160px] h-[160px]',
      img: 'h-[110px] w-[110px]',
      text: 'text-base',
    },
  }[size];

  return (
    <div
      className={[
        isFull ? 'fixed inset-0 z-[9999]' : 'relative min-h-[16rem] w-full py-8',
        'flex flex-col items-center justify-center overflow-hidden bg-background text-foreground transition-colors duration-300 p-4 select-none',
      ].join(' ')}
    >
      {/* Ambient background glow */}
      <div className="absolute w-56 h-56 rounded-full bg-primary/10 blur-[80px] pointer-events-none animate-pulse" />

      {/* Brand logo container */}
      <div
        className={`relative flex items-center justify-center ${sizeClasses.wrapper} bg-card rounded-full shadow-lg border border-border animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]`}
      >
        <img
          src="/icon.svg"
          alt="Medmacs"
          className={`${sizeClasses.img} object-contain`}
        />
      </div>

      {label && (
        <div className="mt-4 flex flex-col items-center gap-1.5 relative z-10">
          <p className={`${sizeClasses.text} font-semibold text-muted-foreground tracking-wide`}>
            {label}
          </p>
        </div>
      )}
    </div>
  );
};

export default UniversalLoader;
