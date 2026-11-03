import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Clock3, Laptop, Loader2, LogOut, MonitorSmartphone, ShieldCheck, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import Seo from '@/components/Seo';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  getDeviceId,
  listUserDevices,
  markAllDevicesSignedOut,
  markOtherDevicesSignedOut,
} from '@/utils/deviceSessions';

const Devices = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentDeviceId = getDeviceId();
  const { data: devices = [], isLoading, error } = useQuery({
    queryKey: ['user-devices', user?.id],
    queryFn: () => listUserDevices(user!.id),
    enabled: Boolean(user?.id),
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  const signOutOthers = async () => {
    if (!user || !window.confirm('Sign out all other devices?')) return;
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
    if (signOutError) return toast.error(signOutError.message);
    await markOtherDevicesSignedOut(user.id);
    await queryClient.invalidateQueries({ queryKey: ['user-devices', user.id] });
    toast.success('Other devices have been signed out.');
  };

  const signOutEverywhere = async () => {
    if (!user || !window.confirm('Sign out of Medmacs on every device, including this one?')) return;
    await markAllDevicesSignedOut(user.id);
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
    if (signOutError) return toast.error(signOutError.message);
    navigate('/', { replace: true });
  };

  return (
    <div className="dashboard-modern-font relative flex h-[100dvh] w-full flex-col overflow-hidden bg-background bg-mesh text-foreground">
      <Seo title="Devices and Sessions" description="Review devices recently used with your Medmacs account." />
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-32 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/30 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-2xl">
        <div className="mx-auto grid h-14 max-w-3xl grid-cols-[1fr_auto_1fr] items-center px-4">
          <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs" className="h-9 w-9 object-contain" />
          <h1 className="brand-wordmark text-xl text-foreground">Devices & Sessions</h1>
          <div aria-hidden="true" />
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+4.5rem)]">
        <section className="mb-4 shrink-0 overflow-hidden rounded-3xl border border-border/40 bg-card/80 p-5 shadow-sm backdrop-blur-xl">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">Your signed-in devices</h1>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Review devices that used your account during the last 30 days and sign out sessions you do not recognize.
              </p>
            </div>
          </div>
        </section>

        <section className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-0.5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>}
          {error && <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive">Could not load your devices.</p>}
          {!isLoading && !error && devices.length === 0 && (
            <div className="rounded-3xl border border-border/40 bg-card/80 p-8 text-center shadow-sm">
              <MonitorSmartphone className="mx-auto h-9 w-9 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">No recent devices found.</p>
            </div>
          )}
          {devices.map(device => {
            const isCurrent = device.device_id === currentDeviceId;
            const isActive = !device.signed_out_at && Date.now() - new Date(device.last_seen_at).getTime() < 10 * 60 * 1000;
            const Icon = device.platform === 'Android' || device.platform === 'iOS' ? Smartphone : Laptop;
            return (
              <article key={device.id} className="relative overflow-hidden rounded-3xl border border-border/40 bg-card/90 p-4 shadow-sm backdrop-blur-xl">
                {isCurrent && <div className="absolute inset-y-0 left-0 w-1 bg-primary" />}
                <div className="flex items-start gap-4">
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${isCurrent ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-black">{device.device_name}</h2>
                    {isCurrent && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-primary">This device</span>}
                  </div>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {[device.platform, device.browser, device.app_version && `App ${device.app_version}`].filter(Boolean).join(' • ')}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {isActive && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active now</span>}
                    {device.signed_out_at && <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">Signed out</span>}
                    {!isActive && !device.signed_out_at && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                        <Clock3 className="h-3 w-3" /> {formatDistanceToNow(new Date(device.last_seen_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="shrink-0 space-y-3 rounded-3xl border border-border/40 bg-card/90 p-4 shadow-lg shadow-background/50 backdrop-blur-xl">
          <div className="px-1">
            <h2 className="text-sm font-black">Session controls</h2>
            <p className="mt-1 text-xs text-muted-foreground">Use these controls if a device looks unfamiliar.</p>
          </div>
          <Button className="h-12 w-full rounded-2xl font-bold" variant="outline" onClick={signOutOthers} disabled={!devices.some(device => device.device_id !== currentDeviceId && !device.signed_out_at)}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out other devices
          </Button>
          <Button className="h-12 w-full rounded-2xl font-bold" variant="destructive" onClick={signOutEverywhere}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out everywhere
          </Button>
        </section>
      </main>
    </div>
  );
};

export default Devices;
