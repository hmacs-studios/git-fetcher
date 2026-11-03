import { motion } from 'framer-motion';

export const AuthDnaWave = () => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-36 overflow-hidden opacity-25 blur-[0.35px]">
    <motion.svg
      viewBox="0 0 640 128"
      preserveAspectRatio="none"
      className="absolute bottom-0 h-full w-[120%] -translate-x-[8%]"
      animate={{ x: ['-8%', '-3%', '-8%'] }}
      transition={{ duration: 7, ease: 'easeInOut', repeat: Infinity }}
    >
      <path d="M-40 96 C70 20 160 20 270 96 S470 172 680 40" fill="none" stroke="#14b8a6" strokeWidth="3" />
      <path d="M-40 42 C70 118 160 118 270 42 S470 -34 680 98" fill="none" stroke="#0ea5e9" strokeWidth="3" />
      {[40, 120, 200, 280, 360, 440, 520, 600].map((x, index) => (
        <motion.line
          key={x}
          x1={x}
          y1={index % 2 ? 36 : 48}
          x2={x}
          y2={index % 2 ? 104 : 92}
          stroke={index % 2 ? '#2dd4bf' : '#38bdf8'}
          strokeWidth="2"
          strokeLinecap="round"
          animate={{ opacity: [0.25, 0.9, 0.25], y: [-3, 3, -3] }}
          transition={{ duration: 2.8, delay: index * 0.16, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </motion.svg>
  </div>
);
