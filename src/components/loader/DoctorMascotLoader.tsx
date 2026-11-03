import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getRandomDoctorAction, DoctorLoaderAction } from './doctorLoaderActions';

interface DoctorMascotLoaderProps {
  label?: string;
  variant?: 'dark' | 'light' | 'full' | 'inline';
  showSubtext?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const DoctorMascotLoader: React.FC<DoctorMascotLoaderProps> = ({
  label,
  variant = 'full',
  showSubtext = true,
  size = 'md',
}) => {
  const [action] = useState<DoctorLoaderAction>(() => getRandomDoctorAction());
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const isDark = variant === 'dark' || variant === 'full';
  const isInline = variant === 'inline';

  // Responsive dimensions - enlarged video container
  const dimensions = useMemo(() => {
    switch (size) {
      case 'sm':
        return { height: 'h-52 sm:h-64', width: 'w-48 sm:w-60', ring: 'w-52 h-52' };
      case 'lg':
        return { height: 'h-80 sm:h-96 md:h-[28rem]', width: 'w-64 sm:w-80 md:w-96', ring: 'w-80 h-80' };
      case 'md':
      default:
        return { height: 'h-64 sm:h-76 md:h-88', width: 'w-56 sm:w-68 md:w-80', ring: 'w-64 h-64' };
    }
  }, [size]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className={[
        variant === 'full'
          ? 'fixed inset-0 z-[9999]'
          : isInline
            ? 'relative w-full py-8 bg-transparent text-foreground'
            : 'relative w-full py-8',
        'flex flex-col items-center justify-center overflow-hidden overscroll-none select-none',
        variant === 'full' || variant === 'dark'
          ? 'bg-gradient-to-br from-[#041416] via-[#091124] to-[#020617] text-white'
          : variant === 'light'
            ? 'bg-background/95 backdrop-blur-md text-foreground'
            : '',
      ].filter(Boolean).join(' ')}
    >
      {/* Background Ambient Glow Orbs */}
      {isDark && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 h-80 w-80 rounded-full bg-[#14b8a6]/15 blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 -right-20 h-80 w-80 rounded-full bg-[#0ea5e9]/15 blur-[120px] animate-pulse" />
          {/* Subtle radial center highlight */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(20,184,166,0.08)_0%,transparent_70%)]" />
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center justify-center p-4 max-w-sm mx-auto text-center">
        {/* Glow ring behind doctor */}
        <div className="relative flex items-center justify-center">
          <div
            className={`absolute ${dimensions.ring} rounded-full bg-gradient-to-tr from-teal-500/20 via-cyan-400/10 to-transparent blur-2xl animate-pulse pointer-events-none`}
          />

          {/* Doctor Video Mascot Container */}
          <div
            className={`relative ${dimensions.height} ${dimensions.width} flex items-center justify-center overflow-hidden drop-shadow-[0_12px_28px_rgba(20,184,166,0.25)]`}
          >
            {/* Fallback image while video buffers or on error */}
            {(!videoLoaded || videoError) && (
              <motion.img
                src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png"
                alt="Medmacs Mascot"
                className="w-24 h-24 object-contain filter drop-shadow-[0_4px_12px_rgba(20,184,166,0.4)]"
                animate={{ scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}

            {!videoError && (
              <video
                key={action.id}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                onLoadedData={() => setVideoLoaded(true)}
                onError={() => setVideoError(true)}
                className={`w-full h-full object-contain pointer-events-none transition-opacity duration-300 ${
                  videoLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <source src={action.webm} type="video/webm" />
                <source src={action.mp4} type="video/mp4" />
              </video>
            )}
          </div>
        </div>

        {/* Dynamic Badge & Tagline */}
        <div className="mt-2 flex flex-col items-center gap-1.5">
          <motion.h4
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-sm sm:text-base font-semibold tracking-wide ${
              isDark ? 'text-white/90' : 'text-foreground'
            }`}
          >
            {label || action.tagline}
          </motion.h4>

          {showSubtext && action.subtext && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className={`text-xs max-w-xs font-normal leading-relaxed ${
                isDark ? 'text-teal-200/60' : 'text-muted-foreground'
              }`}
            >
              {action.subtext}
            </motion.p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default DoctorMascotLoader;
