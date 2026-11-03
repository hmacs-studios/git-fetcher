import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ShoppingBag, CheckCircle, AlertTriangle, Receipt, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Seo from '@/components/Seo';
import { useState, useEffect, useRef } from 'react';

const PurchaseHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const lastScrollY = useRef(0);
  const [headerVisible, setHeaderVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setHeaderVisible(currentScrollY < lastScrollY.current || currentScrollY < 10);
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const { data: purchases, isLoading } = useQuery({
    queryKey: ['purchase-history', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('pending_payments')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'success')
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!user?.id,
  });

  const isExpired = (p: any) => {
    if (!p.created_at || !p.validity) return false;
    const created = new Date(p.created_at);
    const days = p.validity?.toLowerCase() === 'yearly' ? 365 : 30;
    const expiry = new Date(created.getTime() + days * 24 * 60 * 60 * 1000);
    return new Date() > expiry;
  };

  const getExpiryDate = (p: any) => {
    if (!p.created_at || !p.validity) return null;
    const created = new Date(p.created_at);
    const days = p.validity?.toLowerCase() === 'yearly' ? 365 : 30;
    return new Date(created.getTime() + days * 24 * 60 * 60 * 1000);
  };

  return (
    <div className="dashboard-modern-font min-h-screen w-full bg-background bg-mesh text-foreground relative overflow-x-hidden">
      <Seo title="Purchase History" description="View your purchase history" />

      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 -left-32 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div
        className={`fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-border/30 pt-[env(safe-area-inset-top)] transition-transform duration-300 ${headerVisible ? 'translate-y-0' : '-translate-y-full'}`}
      >
        <div className="container mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-5">
          <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs" className="h-9 w-9 object-contain" />
          <h1 className="brand-wordmark text-xl text-foreground">Purchase History</h1>
          <div aria-hidden="true" />
        </div>
      </div>

      <main className="relative z-10 container mx-auto px-5 py-8 max-w-lg mt-[var(--header-height)]">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Receipt className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">
            Your Purchases
          </h1>
          <p className="text-muted-foreground text-sm mt-2">Payment history and subscription receipts</p>
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Loading" className="w-16 h-16 object-contain animate-pulse" />
          </div>
        )}

        {!isLoading && (!purchases || purchases.length === 0) && (
          <div className="rounded-3xl border border-border/50 bg-card/80 px-6 py-12 text-center shadow-sm backdrop-blur-xl space-y-4">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-primary blur-2xl opacity-15 rounded-full" />
              <div className="relative bg-primary/10 p-5 rounded-3xl">
                <ShoppingBag className="w-9 h-9 text-primary" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground font-medium">No purchases yet</p>
            <Button onClick={() => navigate('/pricing')}
              className="rounded-xl h-11 px-8 font-bold text-xs">
              View Plans
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {purchases?.map((p: any) => {
            const expired = isExpired(p);
            const expiry = getExpiryDate(p);
            const durationType = p.validity?.toLowerCase() === 'yearly' ? 'Yearly' : 'Monthly';
            
            return (
              <div key={p.id} className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/90 text-card-foreground shadow-sm backdrop-blur-xl">
                <div className={`h-1 w-full ${expired ? 'bg-muted-foreground/35' : 'bg-primary'}`} />
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${expired ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}><Receipt className="h-5 w-5" /></div>
                      <div className="min-w-0">
                      <p className="truncate text-sm font-black">{p.plan_name || p.plan || 'Premium'} Plan</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      </div>
                    </div>
                    <div className="shrink-0 pl-3 text-right">
                      <span className="text-lg font-black">Rs. {p.amount || '—'}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-widest">
                      {durationType}
                    </Badge>
                    {expired ? (
                      <Badge className="bg-destructive/10 text-destructive border-destructive/15 text-[9px] font-bold uppercase tracking-widest">
                        <AlertTriangle className="w-3 h-3 mr-1" /> Expired
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15 text-[9px] font-bold uppercase tracking-widest">
                        <CheckCircle className="w-3 h-3 mr-1" /> Active
                      </Badge>
                    )}
                  </div>
                  {expiry && (
                    <p className="mt-3 flex items-center gap-1.5 border-t border-border/40 pt-3 text-[10px] text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" /> {expired ? 'Expired' : 'Expires'} {expiry.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default PurchaseHistory;
