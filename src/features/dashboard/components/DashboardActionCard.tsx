import { Link } from 'react-router-dom';
import type { DashboardAction } from '../types';

type DashboardActionCardProps = {
  action: DashboardAction;
  isExternal?: boolean;
  fixedHeight?: boolean;
  offlineMode?: boolean;
  flat?: boolean;
  soft?: boolean;
};

export function DashboardActionCard({
  action,
  isExternal = false,
  fixedHeight = false,
  offlineMode = false,
  flat = false,
  soft = false,
}: DashboardActionCardProps) {
  const isDisabled = action.disabled || (offlineMode && action.link !== '/mcqs');

  const cardClassName = soft
    ? [
        'group relative overflow-hidden rounded-3xl p-4 transition-all duration-300',
        'border border-border/60 bg-gradient-to-br backdrop-blur-sm',
        action.softGradient || 'from-muted/40 to-transparent',
        'shadow-sm hover:shadow-md hover:border-primary/30',
        'active:scale-[0.96] hover:-translate-y-0.5',
        'flex min-h-[120px] w-full flex-col justify-between',
        isDisabled ? 'grayscale opacity-45 pointer-events-none' : '',
        fixedHeight ? 'h-[124px]' : '',
      ].filter(Boolean).join(' ')
    : [
        'group relative overflow-hidden rounded-3xl p-4 transition-all duration-300',
        'border border-white/20 dark:border-white/10',
        'bg-gradient-to-br',
        action.gradient || 'from-blue-600 via-indigo-600 to-purple-600',
        'shadow-lg hover:shadow-xl hover:shadow-primary/20',
        'active:scale-[0.96] hover:-translate-y-1',
        'flex min-h-[120px] w-full flex-col justify-between',
        isDisabled ? 'grayscale opacity-45 pointer-events-none' : '',
        fixedHeight ? 'h-[124px]' : '',
      ].filter(Boolean).join(' ');

  const content = (
    <div className={cardClassName}>
      {soft ? (
        <>
          <div className="pointer-events-none absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-primary/5 blur-2xl group-hover:scale-125 transition-transform duration-500" />

          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-background/70 shadow-sm backdrop-blur-md group-hover:scale-110 transition-transform duration-300 ${action.flatIconColor || 'text-primary'}`}>
              <action.icon className="h-5 w-5" />
            </div>

            {action.tag && (
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${action.tagColor || 'bg-primary/10 text-primary'}`}>
                {action.tag}
              </span>
            )}

            {offlineMode && action.link !== '/mcqs' && (
              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                Offline
              </span>
            )}
          </div>

          <div className="relative z-10 mt-3 space-y-0.5">
            <h3 className="text-[15px] font-black tracking-tight text-foreground font-rounded leading-snug group-hover:translate-x-0.5 transition-transform">
              {action.title}
            </h3>
            <p className="text-[11px] font-medium text-muted-foreground line-clamp-1 leading-normal">
              {action.description}
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Subtle Sheen Light Overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/25 via-transparent to-white/20 opacity-80 group-hover:opacity-100 transition-opacity" />

          {/* Decorative Glow Blob */}
          <div className="pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 rounded-full bg-white/10 blur-2xl group-hover:scale-125 transition-transform duration-500" />

          {/* Top Header Row: Glowing Icon Pill + Tag */}
          <div className="relative z-10 flex items-center justify-between gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 text-white shadow-md shadow-black/10 group-hover:scale-110 group-hover:bg-white/30 transition-all duration-300">
              <action.icon className="h-5 w-5 drop-shadow-sm" />
            </div>

            {action.tag && (
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full backdrop-blur-md border border-white/30 ${action.tagColor || 'bg-white/20 text-white'}`}>
                {action.tag}
              </span>
            )}

            {offlineMode && action.link !== '/mcqs' && (
              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/30 text-white/80 backdrop-blur-md">
                Offline
              </span>
            )}
          </div>

          {/* Card Body: Title & Description */}
          <div className="relative z-10 mt-3 space-y-0.5">
            <h3 className="text-[15px] font-black tracking-tight text-white font-rounded leading-snug drop-shadow-sm group-hover:translate-x-0.5 transition-transform">
              {action.title}
            </h3>
            <p className="text-[11px] font-medium text-white/80 line-clamp-1 leading-normal">
              {action.description}
            </p>
          </div>
        </>
      )}
    </div>
  );

  if (isExternal) {
    return (
      <a
        href={isDisabled ? undefined : action.link}
        target="_blank"
        rel="noopener noreferrer"
        className={`dashboard-action-link ${isDisabled ? 'pointer-events-none' : ''}`}
      >
        {content}
      </a>
    );
  }

  if (action.onClick) {
    return (
      <button
        type="button"
        onClick={isDisabled ? undefined : action.onClick}
        disabled={isDisabled}
        className="dashboard-action-link text-left disabled:cursor-not-allowed"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      to={isDisabled ? '#' : action.link || '#'}
      className={`dashboard-action-link ${isDisabled ? 'pointer-events-none' : ''}`}
    >
      {content}
    </Link>
  );
}
