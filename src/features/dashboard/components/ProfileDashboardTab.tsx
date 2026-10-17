import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  ChevronRight,
  CreditCard,
  FileText,
  Gauge,
  Info,
  Lock,
  LogOut,
  Mail,
  MonitorSmartphone,
  Moon,
  Receipt,
  RefreshCw,
  Shield,
  Sun,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { AchievementBadgesSkeleton } from '@/components/profile/AchievementBadgesSkeleton';
import { triggerHaptic } from '@/utils/haptics';
import type { AiUsageSummary } from '../types';

const LazyAchievementBadges = lazy(() =>
  import('@/components/profile/AchievementBadges').then((module) => ({ default: module.AchievementBadges })),
);

type ProfileDashboardTabProps = {
  userId?: string;
  email?: string;
  displayName: string;
  cachedAvatarUrl?: string | null;
  userPlanDisplayName: string;
  aiUsageSummary?: AiUsageSummary;
  aiUsageSummaryLoading: boolean;
  isOfflineMode: boolean;
  theme?: string;
  onThemeChange: (theme: string) => void;
  onShowWhatsNew: () => void;
  onOpenUsageLimits: () => void;
  onLogout: () => void;
};

const mainSettings = [
  { label: 'Devices & Sessions', icon: MonitorSmartphone, link: '/profile/devices' },
] as const;

const mainSettingsAfterUsage = [
  { label: 'Change Password', icon: Lock, link: '/profile/password' },
  { label: 'Subscription', icon: CreditCard, link: '/pricing' },
  { label: 'Redeem Code', icon: Award, link: '/redeem' },
  { label: 'Purchase History', icon: Receipt, link: '/purchase-history' },
  { label: 'Know More about Medmacs', icon: Users, link: '/teams' },
  { label: 'Contact Us', icon: Mail, link: '/contact-us' },
] as const;

const legalSettings = [
  { label: 'Privacy Policy', icon: Shield, link: '/privacypolicy' },
  { label: 'Terms & Conditions', icon: FileText, link: '/terms' },
  { label: 'Refund Policy', icon: RefreshCw, link: '/refund-policy' },
] as const;

export function ProfileDashboardTab({
  userId,
  email,
  displayName,
  cachedAvatarUrl,
  userPlanDisplayName,
  aiUsageSummary,
  aiUsageSummaryLoading,
  isOfflineMode,
  theme,
  onThemeChange,
  onShowWhatsNew,
  onOpenUsageLimits,
  onLogout,
}: ProfileDashboardTabProps) {
  return (
    <div className="space-y-4">
      <Link to="/profile" className="flex items-center justify-between p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-accent border border-border/40 shadow-sm hover:opacity-95 active:scale-[0.99] transition-all group">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
            {cachedAvatarUrl ? (
              <img src={cachedAvatarUrl} alt={`${displayName}'s avatar`} className="w-full h-full object-cover" />
            ) : (
              <span className="text-primary-foreground font-bold text-lg">{displayName.substring(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">{displayName}</h2>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
            <Badge className="mt-1.5 text-[10px] bg-primary/15 text-primary border-0 font-semibold">{userPlanDisplayName}</Badge>
            {!isOfflineMode && (
              <p className="mt-1 text-[10px] font-bold text-muted-foreground">
                {aiUsageSummaryLoading ? 'Checking AI usage...' : aiUsageSummary?.label}
              </p>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0 ml-2" />
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-amber-500 fill-amber-500" />
          <h2 className="text-base font-bold text-foreground">Achievements</h2>
        </div>
        <Suspense fallback={<AchievementBadgesSkeleton />}>
          <LazyAchievementBadges userId={userId} />
        </Suspense>
      </div>

      <Card className="border border-border/40 shadow-sm bg-card/80">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon className="w-5 h-5 text-blue-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
              <div>
                <p className="text-sm font-semibold text-foreground">Dark Mode</p>
                <p className="text-[11px] text-muted-foreground">Toggle app theme</p>
              </div>
            </div>
            <Switch
              checked={theme === 'dark'}
              onCheckedChange={(checked) => {
                triggerHaptic(15);
                onThemeChange(checked ? 'dark' : 'light');
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/40 shadow-sm overflow-hidden bg-card/80">
        <CardContent className="p-0 divide-y divide-border/30">
          {mainSettings.map((item) => (
            <Link key={item.link} to={item.link} className="flex items-center justify-between p-4 hover:bg-accent/50 active:bg-accent transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">{item.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          ))}
          <button type="button" onClick={onOpenUsageLimits} className="flex items-center justify-between p-4 hover:bg-accent/50 active:bg-accent transition-colors w-full">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Gauge className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Usage Limits</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
          {mainSettingsAfterUsage.map((item) => (
            <Link key={item.link} to={item.link} className="flex items-center justify-between p-4 hover:bg-accent/50 active:bg-accent transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {item.label === 'Subscription' ? (
                    <>Your Plan: <span className="font-bold text-primary">{userPlanDisplayName.replace(' Plan', '')}</span></>
                  ) : (
                    item.label
                  )}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          ))}
          <button type="button" onClick={onShowWhatsNew} className="flex items-center justify-between p-4 hover:bg-accent/50 active:bg-accent transition-colors w-full">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                <Info className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium text-foreground">What's New</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>

      <Card className="border border-border/20 shadow-none bg-muted/30">
        <CardContent className="p-0 divide-y divide-border/20">
          {legalSettings.map((item) => (
            <Link key={item.link} to={item.link} className="flex items-center justify-between p-3.5 hover:bg-accent/30 active:bg-accent/50 transition-colors">
              <div className="flex items-center gap-3">
                <item.icon className="w-3.5 h-3.5 text-muted-foreground/60" />
                <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
            </Link>
          ))}
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full text-destructive border-destructive/20 hover:bg-destructive/5" onClick={onLogout}>
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>

      <div className="text-center pt-4 pb-2">
        <p className="text-[10px] text-muted-foreground font-medium">A Project by Hmacs Studios.</p>
        <p className="text-[10px] text-muted-foreground mt-1">© 2026 Hmacs Studios. All rights reserved</p>
      </div>
    </div>
  );
}
