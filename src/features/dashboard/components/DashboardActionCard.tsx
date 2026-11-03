import { Link, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import type { DashboardAction } from '../types';
import { navigateWithCardExpansion } from '../dashboardCardNavigation';

type DashboardActionCardProps = {
  action: DashboardAction;
  isExternal?: boolean;
  fixedHeight?: boolean;
  offlineMode?: boolean;
  flat?: boolean;
  soft?: boolean;
  locked?: boolean;
  accessLoading?: boolean;
  onLockedClick?: () => void;
};

export function DashboardActionCard({
  action,
  isExternal = false,
  fixedHeight = false,
  offlineMode = false,
  flat = false,
  soft = false,
  locked = false,
  accessLoading = false,
  onLockedClick,
}: DashboardActionCardProps) {
  const navigate = useNavigate();
  const isDisabled = action.disabled || accessLoading || (offlineMode && action.link !== '/mcqs' && !locked);

  const cardClassName = soft
    ? [
        'group relative overflow-hidden rounded-3xl p-4 transition-transform duration-200 will-change-transform',
        'border border-border/60 bg-gradient-to-br bg-card/95',
        action.softGradient || 'from-muted/40 to-transparent',
        'shadow-sm hover:shadow-md hover:border-primary/30',
        'active:scale-[0.96] hover:-translate-y-0.5',
        'flex min-h-[120px] w-full flex-col justify-between',
        accessLoading ? 'pointer-events-none' : isDisabled ? 'grayscale opacity-45 pointer-events-none' : '',
        fixedHeight ? 'h-[124px]' : '',
      ].filter(Boolean).join(' ')
    : [
        'group relative overflow-hidden rounded-3xl p-4 transition-transform duration-200 will-change-transform',
        'border border-white/20 dark:border-white/10',
        'bg-gradient-to-br',
        action.gradient || 'from-blue-600 via-indigo-600 to-purple-600',
        'shadow-md hover:shadow-lg hover:shadow-primary/20',
        'active:scale-[0.96] hover:-translate-y-1',
        'flex min-h-[120px] w-full flex-col justify-between',
        accessLoading ? 'pointer-events-none' : isDisabled ? 'grayscale opacity-45 pointer-events-none' : '',
        fixedHeight ? 'h-[124px]' : '',
      ].filter(Boolean).join(' ');

  const content = (
    <div className={cardClassName}>
      {locked && (
        <span title="Plan locked" aria-hidden="true" className="absolute right-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-amber-500/30 bg-background text-amber-600 shadow-sm dark:text-amber-400">
          <Lock className="h-3.5 w-3.5" />
        </span>
      )}
      {accessLoading && (
        <div aria-label="Checking plan access" className="absolute inset-0 z-30 flex flex-col justify-end gap-2 rounded-[inherit] bg-background/85 p-4">
          <div className="h-3 w-2/5 animate-pulse rounded-full bg-muted-foreground/20" />
          <div className="h-2.5 w-3/4 animate-pulse rounded-full bg-muted-foreground/15" />
        </div>
      )}
      {soft ? (
        <>
          <div className={`relative z-10 flex items-center justify-between gap-2 ${locked ? 'pr-8' : ''}`}>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-muted/70 shadow-sm group-hover:scale-110 transition-transform duration-300 ${action.flatIconColor || 'text-primary'}`}>
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
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/15 opacity-70" />

          {/* Top Header Row: Glowing Icon Pill + Tag */}
          <div className={`relative z-10 flex items-center justify-between gap-2 ${locked ? 'pr-8' : ''}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 border border-white/30 text-white shadow-sm group-hover:scale-110 group-hover:bg-white/30 transition-all duration-300">
              <action.icon className="h-5 w-5 drop-shadow-sm" />
            </div>

            {action.tag && (
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-white/30 ${action.tagColor || 'bg-white/20 text-white'}`}>
                {action.tag}
              </span>
            )}

            {offlineMode && action.link !== '/mcqs' && (
              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/40 text-white/90">
                Offline
              </span>
            )}

          </div>

          {/* Card Body: Title & Description */}
          <div className="relative z-10 mt-3 space-y-0.5">
            <h3 className="text-[15px] font-black tracking-tight text-white font-rounded leading-snug drop-shadow-sm group-hover:translate-x-0.5 transition-transform">
              {action.title}
            </h3>
            <p className="text-[11px] font-medium text-white/90 line-clamp-1 leading-normal">
              {action.description}
            </p>
          </div>
        </>
      )}
    </div>
  );

  if (locked) {
    return (
      <button
        type="button"
        onClick={onLockedClick}
        disabled={action.disabled}
        aria-label={`Unlock ${action.title}`}
        className="dashboard-action-link text-left disabled:cursor-not-allowed"
      >
        {content}
      </button>
    );
  }

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
      onClick={(event) => {
        if (!isDisabled && action.link) navigateWithCardExpansion(event, () => navigate(action.link!));
      }}
      className={`dashboard-action-link ${isDisabled ? 'pointer-events-none' : ''}`}
    >
      {content}
    </Link>
  );
}
