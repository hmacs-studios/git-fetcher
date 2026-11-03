import { ExternalLink, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import type { HmacsProduct, HmacsProductButton } from '../types';

type HmacsProductModalProps = {
  product: HmacsProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function parseProductButtons(product: HmacsProduct): HmacsProductButton[] {
  let raw = product.buttons ?? product.cta_buttons;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((b: any) => ({
      label: b.label || b.text || b.title || 'Open Link',
      link: b.link || b.url || b.target_url || '#',
    }));
  }
  if (product.link) {
    return [{ label: 'Visit Website / App', link: product.link }];
  }
  return [];
}

export function HmacsProductModal({ product, open, onOpenChange }: HmacsProductModalProps) {
  if (!product) return null;

  const buttons = parseProductButtons(product);
  const longDetails = product.long_description || product.description;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Available':
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'In-Beta Stage':
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'In-development':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'Coming Soon':
      default:
        return 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30';
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[85dvh] sm:max-w-xl mx-auto flex-col overflow-hidden rounded-t-[2.25rem] border-x border-t border-primary/20 bg-background/95 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] backdrop-blur-2xl shadow-2xl shadow-primary/10"
      >
        {/* Branding on top */}
        <SheetHeader className="mx-auto w-full text-left shrink-0">
          <div className="flex items-center gap-3.5 mb-2">
            {product.icon ? (
              <div className="h-14 w-14 shrink-0 rounded-2xl bg-primary/10 p-2 border border-primary/20 flex items-center justify-center overflow-hidden shadow-sm">
                <img
                  src={product.icon}
                  alt=""
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary text-xl font-black border border-primary/20">
                {product.project_name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <SheetTitle className="text-2xl font-black tracking-tight text-foreground brand-display leading-none">
                  {product.project_name}
                </SheetTitle>
                {product.status && product.status !== 'Available' && (
                  <Badge variant="outline" className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${getStatusBadge(product.status)}`}>
                    {product.status}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1 mt-1">
                <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                From the Family of HMACS Studios
              </p>
            </div>
          </div>

          {/* Short description in Medmacs accent color */}
          <SheetDescription className="mt-2 text-sm font-bold text-primary leading-relaxed">
            {product.description}
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable Long Details */}
        <div className="my-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 text-xs font-medium leading-relaxed text-muted-foreground space-y-3 border-t border-b border-border/30 py-3">
          {longDetails.split('\n\n').map((paragraph, index) => (
            <p key={index} className="text-foreground/90 font-medium">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Bottom Pinned CTA Buttons (respects bottom safe area) */}
        <div className="shrink-0 space-y-2 pt-1 pb-[env(safe-area-inset-bottom,0px)]">
          {buttons.length > 0 ? (
            buttons.map((btn, idx) => {
              const hasValidLink = Boolean(btn.link && btn.link.trim() !== '' && btn.link !== '#');
              if (!hasValidLink) {
                return (
                  <Button
                    key={idx}
                    disabled
                    variant="outline"
                    className="w-full rounded-xl h-11 text-xs font-extrabold opacity-60 cursor-not-allowed border-primary/20 bg-muted/30 text-muted-foreground"
                  >
                    {btn.label || 'Coming Soon'}
                  </Button>
                );
              }
              return (
                <Button
                  key={idx}
                  asChild
                  variant={idx === 0 ? 'default' : 'outline'}
                  className={`w-full rounded-xl h-11 text-xs font-extrabold transition-all ${
                    idx === 0
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90'
                      : 'border-primary/30 text-foreground hover:bg-primary/10'
                  }`}
                >
                  <a href={btn.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                    <span>{btn.label}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Button>
              );
            })
          ) : (
            <Button
              disabled
              variant="outline"
              className="w-full rounded-xl h-11 text-xs font-extrabold opacity-60 cursor-not-allowed border-primary/20 bg-muted/30 text-muted-foreground"
            >
              Coming Soon
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
