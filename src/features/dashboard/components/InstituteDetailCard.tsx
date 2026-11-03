import { Stethoscope } from 'lucide-react';
import { isSpecializedTestInstitute } from '@/utils/institutes';
import type { DashboardInstitute } from '../types';
import { cn } from '@/lib/utils';

export function InstituteDetailCard({ institute, className }: { institute: DashboardInstitute; className?: string }) {
  if (!institute) return null;
  const specializedTest = isSpecializedTestInstitute(institute);

  return (
    <div className={cn('group relative h-32 overflow-hidden rounded-[2rem] shadow-xl', className)}>
      {institute.image_url ? (
        <img
          src={institute.image_url}
          alt={institute.name}
          className="dashboard-carousel-image absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#2dd4bf] to-[#0ea5e9]" />
      )}
      <div className="dashboard-carousel-overlay absolute inset-0 bg-black/40" />
      <div className="relative z-10 h-full flex flex-col justify-end p-6">
        <div className="flex items-center gap-2 mb-1">
          <Stethoscope className="w-4 h-4 text-[#2dd4bf]" />
          <span className="text-[10px] font-black text-white/60 uppercase tracking-[0.2em]">
            {specializedTest ? 'Your Post Graduate Exam' : 'Your Institute'}
          </span>
        </div>
        <h3 className="text-lg font-black text-white tracking-tight leading-tight">{institute.name}</h3>
      </div>
    </div>
  );
}
