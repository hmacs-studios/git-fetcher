import { useEffect, useState } from 'react';
import { BellNavIcon } from '@/components/ui/TabIcons';
import type { DashboardTabId } from '../types';

type DashboardHeaderProps = {
  activeTab: DashboardTabId;
  unreadCount?: number;
  onOpenAnnouncements: () => void;
};

export function DashboardHeader({
  activeTab,
  unreadCount = 0,
  onOpenAnnouncements,
}: DashboardHeaderProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);
    const appRoot = document.getElementById('root');
    const dashboardPage = document.querySelector<HTMLElement>('[data-dashboard-page]');
    const getScrollY = () => Math.max(window.scrollY, appRoot?.scrollTop ?? 0, dashboardPage?.scrollTop ?? 0);
    let lastScrollY = getScrollY();

    const handleScroll = () => {
      const scrollY = getScrollY();
      if (scrollY < 64) {
        setIsVisible(true);
        lastScrollY = scrollY;
        return;
      }

      const movement = scrollY - lastScrollY;
      if (Math.abs(movement) < 8) return;
      setIsVisible(movement < 0);
      lastScrollY = scrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    appRoot?.addEventListener('scroll', handleScroll, { passive: true });
    dashboardPage?.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      appRoot?.removeEventListener('scroll', handleScroll);
      dashboardPage?.removeEventListener('scroll', handleScroll);
    };
  }, [activeTab]);

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-40 bg-background"
        style={{ height: 'env(safe-area-inset-top, 0px)' }}
      />
      <header
        className={`fixed left-0 right-0 top-0 z-50 origin-top border-b border-border/20 bg-gradient-to-b from-background via-background to-background/95 pt-[env(safe-area-inset-top)] transform-gpu transition-[transform,opacity] duration-300 [transition-timing-function:cubic-bezier(.22,1,.36,1)] motion-reduce:transition-none dark:from-background dark:via-background dark:to-background/95 ${isVisible ? 'translate-y-0 rotate-x-0 opacity-100' : 'pointer-events-none -translate-y-3 [transform:perspective(700px)_rotateX(-78deg)_translateY(-12px)] opacity-0'}`}
      >
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center px-5">
          <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="" className="h-9 w-9 rounded-lg object-contain" />
          <span className="brand-wordmark text-xl text-foreground">Medmacs</span>
          <button
            type="button"
            onClick={onOpenAnnouncements}
            aria-label="Open announcements"
            className="relative flex h-11 w-11 items-center justify-center justify-self-end rounded-xl border border-border/60 bg-muted/70 text-foreground transition-colors hover:bg-muted"
          >
            <BellNavIcon className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>
    </>
  );
}

