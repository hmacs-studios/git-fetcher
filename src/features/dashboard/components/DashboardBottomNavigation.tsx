import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { DashboardTabId } from '../types';
import { triggerHaptic } from '@/utils/haptics';

export type DashboardNavigationItem = {
  id: DashboardTabId;
  label: string;
  icon: ComponentType<{ filled?: boolean; className?: string }>;
  badge?: number | null;
  avatarUrl?: string | null;
};

type DashboardBottomNavigationProps = {
  activeTab: DashboardTabId;
  items: DashboardNavigationItem[];
  onTabChange: (tab: DashboardTabId) => void;
};

export function DashboardBottomNavigation({ activeTab, items, onTabChange }: DashboardBottomNavigationProps) {
  const gridCols = items.length === 4 ? 'grid-cols-4' : items.length === 5 ? 'grid-cols-5' : 'grid-cols-6';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]" aria-label="Dashboard">
      <div className="mx-5 mb-2.5 overflow-hidden rounded-full border border-black/10 bg-white/70 backdrop-blur-2xl shadow-2xl shadow-black/10 dark:border-white/5 dark:bg-white/5 dark:shadow-black/30">
        <div className={`grid h-[56px] ${gridCols} items-center px-1`}>
          {items.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  triggerHaptic(12);
                  onTabChange(item.id);
                }}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex h-full min-w-0 items-center justify-center focus:outline-none focus-visible:outline-none"
              >
                <div className="relative flex items-center justify-center transition-all duration-200 ease-out">
                  <div className={`relative flex items-center justify-center transition-all duration-200 ${isActive ? 'text-primary scale-110' : 'text-foreground/60 dark:text-muted-foreground/70'}`}>
                    {item.id === 'profile' && item.avatarUrl ? (
                      <div className={`w-6 h-6 rounded-full overflow-hidden shrink-0 border transition-colors ${isActive ? 'border-primary ring-2 ring-primary/30' : 'border-border/50'}`}>
                        <img src={item.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <item.icon
                        filled={isActive}
                        className={`block transition-all duration-200 ${isActive ? 'w-6 h-6' : 'w-[22px] h-[22px]'}`}
                      />
                    )}
                    {!!item.badge && !isActive && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full flex items-center justify-center shadow-sm">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

