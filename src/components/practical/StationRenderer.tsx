import React, { lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  HelpCircle, 
  BookOpen, 
  Zap, 
  ChevronDown, 
  Image as ImageIcon,
  Youtube,
  GraduationCap
} from 'lucide-react';
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Timer } from './Timer';

// Lazy load YouTube and Images for performance
const YouTubeEmbed = lazy(() => Promise.resolve({ 
  default: ({ id }: { id: string }) => (
  <div className="relative aspect-video rounded-3xl overflow-hidden glass-card shadow-2xl group border border-white/10 my-8">
    <iframe
      className="absolute inset-0 w-full h-full"
      src={`https://www.youtube-nocookie.com/embed/${id}`}
      title="YouTube Video"
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      loading="lazy"
    />
  </div>
)}));

interface StationRendererProps {
  station: {
    id: string;
    name: string;
    tag?: string;
    scenario_text?: string;
    youtube_id?: string;
    instructions_bullets?: string[];
    questions_answers?: (any)[];
    marking_checklist?: (string | { task: string; points: number })[];
    image_urls?: string[];
  };
}

export const StationRenderer: React.FC<StationRendererProps> = ({ station }) => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-5 duration-700">
      
      {/* 🛑 Header Section */}
      <div className="space-y-4 px-2">
        <div className="flex flex-wrap items-center gap-2">
          {station.tag && (
            <Badge className="bg-primary/10 text-primary border border-primary/20 px-3.5 py-1 rounded-full font-bold uppercase tracking-wider text-[11px] shadow-sm">
              {station.tag}
            </Badge>
          )}
          <Badge className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 px-3.5 py-1 rounded-full font-bold text-[11px] uppercase tracking-wider shadow-sm">
            OSCE STATION
          </Badge>
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-foreground leading-tight tracking-tight drop-shadow-sm">
          {station.name || (station as any).title || 'Untitled Station'}
        </h1>
      </div>

      {/* ⏲️ Timer & Controls (Visual Priority) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Timer initialSeconds={300} />
        </div>
        
        {/* 📑 Instructions / Objectives Quick Glance */}
        {station.instructions_bullets && station.instructions_bullets.length > 0 && (
          <Card className="md:col-span-2 glass-card border-white/10 overflow-hidden group">
            <CardHeader className="bg-white/5 py-3 border-b border-white/5 flex flex-row items-center space-x-3 px-5">
              <BookOpen className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground/80">Key Instructions</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <ul className="space-y-2">
                {station.instructions_bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start space-x-3 text-sm text-foreground/80 leading-relaxed">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 📖 Scenario Card */}
      {station.scenario_text && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 blur-3xl opacity-30 -z-10" />
          <Card className="glass-card border-primary/20 overflow-hidden border-2 shadow-xl">
            <div className="absolute top-0 right-0 p-3 overflow-hidden opacity-10">
               <GraduationCap className="w-16 h-16 text-primary -rotate-12 translate-x-4 -translate-y-4" />
            </div>
            <CardHeader className="bg-primary/5 py-4 border-b border-primary/10 px-6">
              <div className="flex items-center space-x-3">
                <Zap className="w-5 h-5 text-primary animate-pulse" />
                <CardTitle className="text-lg font-black text-primary uppercase tracking-tighter">Clinical Scenario</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <p className="text-lg md:text-xl font-medium leading-relaxed text-foreground/90 italic">
                "{station.scenario_text}"
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* 📹 YouTube Embed */}
      {station.youtube_id && (
        <Suspense fallback={<div className="aspect-video rounded-3xl bg-neutral-900 animate-pulse flex items-center justify-center border border-white/10"><Youtube className="w-12 h-12 text-white/20" /></div>}>
          <YouTubeEmbed id={station.youtube_id} />
        </Suspense>
      )}

      {/* 🖼️ Image Gallery */}
      {station.image_urls && station.image_urls.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {station.image_urls.map((url, idx) => (
            <div key={idx} className="relative aspect-[4/3] rounded-2xl overflow-hidden glass-card border border-white/10 shadow-lg hover:scale-[1.02] transition-transform cursor-zoom-in">
              <img 
                src={url} 
                alt={`Station material ${idx + 1}`} 
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute bottom-4 left-4">
                <Badge className="bg-black/60 backdrop-blur-md border-white/10 hover:bg-black/80">
                  <ImageIcon className="w-3 h-3 mr-2" /> View {idx + 1}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ✅ Marking Checklist */}
      {station.marking_checklist && station.marking_checklist.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center space-x-3 px-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <h2 className="text-2xl font-black tracking-tight text-foreground">Marking Checklist</h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <AnimatePresence>
              {station.marking_checklist.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 shadow-sm active:scale-[0.98] transition-all cursor-pointer group"
                >
                   <div className="flex shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 items-center justify-center mr-4 group-hover:bg-emerald-500 group-hover:text-white transition-colors font-bold text-sm">
                      {idx + 1}
                   </div>
                   <div className="flex-1 flex justify-between items-center">
                     <span className="text-base font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                       {typeof item === 'string' ? item : item.task}
                     </span>
                     {typeof item === 'object' && item.points !== undefined && (
                       <Badge variant="secondary" className="ml-2 bg-emerald-500/10 text-emerald-500 border-none px-2 rounded-lg font-black text-[10px]">
                         +{item.points} PT
                       </Badge>
                     )}
                   </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ❓ Viva/Theory Accordion */}
      {station.questions_answers && station.questions_answers.length > 0 && (
         <div className="space-y-6">
            <div className="flex items-center space-x-3 px-2">
              <HelpCircle className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-black tracking-tight text-foreground">Viva / Theory Portion</h2>
            </div>
            <Accordion type="single" collapsible className="w-full space-y-3 px-2">
              {station.questions_answers.map((qa, idx) => (
                <AccordionItem 
                  key={idx} 
                  value={`item-${idx}`} 
                  className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden px-4 hover:border-primary/30 transition-all shadow-sm"
                >
                  <AccordionTrigger className="hover:no-underline py-4 text-left group">
                    <span className="text-base font-bold text-foreground/90 group-hover:text-primary transition-colors">
                      {qa.q || qa.question}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 pt-2">
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 border-dashed text-foreground/80 leading-relaxed font-semibold italic text-lg decoration-primary/20 decoration-2">
                      {qa.a || qa.answer}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
         </div>
      )}

    </div>
  );
};
