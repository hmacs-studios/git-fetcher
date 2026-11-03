import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock3, Crown, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import type { AiApiError } from '@/utils/aiApi';

const featureLabels: Record<string, string> = {
  'study-chat': 'Dr Ahroid Chat',
  'analytics-plan': 'Dr Ahroid Analysis',
  'generate-test': 'AI Test Generator',
  'reference': 'Book References',
  'reference-explain': 'Option Explanations',
  'reference-summary': 'Reference Summary',
  'mistake-explain': 'Mistake Book AI Explain',
  'titration-flashcards': 'Smart Revision Cards',
};

const formatRemaining = (milliseconds: number) => {
  if (milliseconds <= 0) return 'Available now';
  const totalMinutes = Math.ceil(milliseconds / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return [days ? `${days}d` : '', hours ? `${hours}h` : '', !days && minutes ? `${minutes}m` : ''].filter(Boolean).join(' ');
};

const periodLabels: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  cooldown: 'Cooldown',
};

interface UpgradeAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgradeClick?: () => void;
  title?: string;
  description?: string;
  featureName?: string;
  limitError?: AiApiError | null;
}

const UpgradeAccountModal: React.FC<UpgradeAccountModalProps> = ({ isOpen, onClose, onUpgradeClick, title, description, featureName, limitError }) => {
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isOpen || !limitError?.resetAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [isOpen, limitError?.resetAt]);

  const resolvedFeature = featureName || (limitError?.feature ? featureLabels[limitError.feature] : limitError?.feature);
  const resetTime = useMemo(() => limitError?.resetAt ? new Date(limitError.resetAt).getTime() : null, [limitError?.resetAt]);
  const isQuotaLimit = limitError?.status === 429;
  const isPlanRestriction = limitError?.status === 403;
  const showReset = isQuotaLimit && resetTime && Number.isFinite(resetTime);
  const periodKey = limitError?.limitPeriod || 'daily';
  const periodLabel = periodLabels[periodKey] || 'Daily';

  const limit = limitError?.limit;
  const used = limitError?.used;
  const hasUsage = limit != null && used != null && limit > 0;
  const usagePercent = hasUsage ? Math.min(100, Math.round((used / limit) * 100)) : null;

  const handleUpgrade = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      onClose();
      navigate('/pricing');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="mx-auto max-h-[88dvh] overflow-y-auto rounded-t-[2rem] border-x border-t border-primary/20 bg-background/95 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] backdrop-blur-2xl sm:max-w-lg z-[300]" overlayClassName="z-[300]">
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-muted" aria-hidden="true" />
        <SheetHeader className="text-center sm:text-center">
          <Crown className="w-12 h-12 mx-auto text-yellow-500 dark:text-yellow-400 mb-3" />
          <SheetTitle className="text-2xl font-bold brand-display">{title || 'Usage Limit Reached'}</SheetTitle>
          <SheetDescription className="mt-2">
            {description || `You've used all your ${periodLabel.toLowerCase()} AI quota.${isPlanRestriction ? ' This feature requires a plan upgrade.' : ' Upgrade to keep using AI features without limits.'}`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {resolvedFeature && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <p className="text-sm font-black text-foreground">{resolvedFeature}</p>
              </div>

              {hasUsage && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{used} used</span>
                    <span>{limit} limit</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>
              )}

              {showReset && (
                <div className="mt-3 flex items-start gap-2 text-sm text-primary">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-bold">{periodLabel} limit reached</p>
                    <p className="mt-0.5">Resets in {formatRemaining(resetTime - now)}</p>
                    <p className="mt-0.5 text-xs opacity-75">{new Date(resetTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                </div>
              )}

              {isQuotaLimit && !showReset && (
                <div className="mt-3 flex items-start gap-2 text-sm text-primary">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-bold">{periodLabel} limit reached</p>
                    <p className="mt-0.5">Reset time is being refreshed. Please reopen shortly.</p>
                  </div>
                </div>
              )}

              {isPlanRestriction && (
                <div className="mt-3 flex items-start gap-2 text-sm text-primary">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-bold">Not included in your current plan</p>
                    <p className="mt-0.5">No automatic reset — upgrade required</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {!resolvedFeature && showReset && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-2 text-sm text-primary">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-bold">{periodLabel} limit reached</p>
                  <p className="mt-0.5">Resets in {formatRemaining(resetTime - now)}</p>
                  <p className="mt-0.5 text-xs opacity-75">{new Date(resetTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button onClick={onClose} variant="outline" className="w-full">
            Maybe Later
          </Button>
          <Button onClick={handleUpgrade} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold">
            Upgrade Now
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default UpgradeAccountModal;
