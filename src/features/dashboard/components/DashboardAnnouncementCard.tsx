import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Megaphone } from 'lucide-react';
import type { DashboardAnnouncement, DashboardInstitute } from '../types';
import { formatAnnouncementPreview, formatAnnouncementText } from './AnnouncementText';
import { InstituteDetailCard } from './InstituteDetailCard';

type DashboardAnnouncementCardProps = {
  announcement: DashboardAnnouncement;
  onOpen: () => void;
  tabIndex?: number;
};

export function DashboardAnnouncementCard({ announcement, onOpen, tabIndex }: DashboardAnnouncementCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      tabIndex={tabIndex}
      aria-label={`Open announcement: ${announcement.card_heading}`}
      className="group relative block h-32 w-full overflow-hidden rounded-[2rem] border border-teal-300/30 text-left shadow-xl shadow-teal-900/10 transition-transform duration-150 active:scale-[0.98]"
    >
      {announcement.card_background_image_url ? (
        <img
          src={announcement.card_background_image_url}
          alt=""
          className="dashboard-carousel-image absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#0d9488] to-[#0284c7]" />
      )}
      <div className="absolute inset-0 bg-black/35" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal-400/20 via-transparent to-cyan-500/20" />
      {announcement.card_secondary_image_url && (
        <img
          src={announcement.card_secondary_image_url}
          alt=""
          className="absolute right-2 bottom-0 h-[92%] max-w-[42%] object-contain drop-shadow-2xl"
        />
      )}
      <div className="relative z-10 h-full flex flex-col justify-end p-5 pr-[42%]">
        <div className="flex items-center gap-1.5 mb-1">
          <Megaphone className="w-3.5 h-3.5 text-[#2dd4bf]" />
          <span className="text-[10px] font-black text-white/65 uppercase tracking-[0.18em]">Announcement</span>
        </div>
        <h3 className="text-lg font-black text-white tracking-tight leading-tight line-clamp-1">
          {formatAnnouncementText(announcement.card_heading)}
        </h3>
        <p className="whitespace-pre-line text-white/70 text-[11px] leading-relaxed line-clamp-2 mt-1">
          {formatAnnouncementPreview(announcement.card_subheading)}
        </p>
      </div>
    </button>
  );
}

type DashboardAnnouncementCarouselProps = {
  announcements: DashboardAnnouncement[];
  institute: DashboardInstitute;
  onOpen: (announcement: DashboardAnnouncement) => void;
};

export function DashboardAnnouncementCarousel({ announcements, institute, onOpen }: DashboardAnnouncementCarouselProps) {
  const totalSlides = announcements.length + (institute ? 1 : 0);
  const [carouselRef, carouselApi] = useEmblaCarousel({ loop: totalSlides > 1, align: 'start' });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const syncSelection = useCallback(() => {
    setSelectedIndex(carouselApi?.selectedScrollSnap() ?? 0);
  }, [carouselApi]);

  useEffect(() => {
    if (!carouselApi) return;
    carouselApi.reInit();
    syncSelection();
    carouselApi.on('select', syncSelection);
    carouselApi.on('reInit', syncSelection);
    return () => {
      carouselApi.off('select', syncSelection);
      carouselApi.off('reInit', syncSelection);
    };
  }, [carouselApi, totalSlides, syncSelection]);

  const activeIndex = Math.min(selectedIndex, Math.max(totalSlides - 1, 0));

  if (totalSlides === 0) return null;

  return (
    <div className="mb-6" role="region" aria-label="Dashboard announcements" aria-roledescription="carousel">
      <div ref={carouselRef} className="-mx-3 overflow-hidden touch-pan-y">
        <div className="flex">
          {announcements.map((announcement, index) => (
            <div key={announcement.id} className="min-w-0 flex-[0_0_100%] px-3 py-3" role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${totalSlides}`} aria-hidden={index !== activeIndex}>
              <DashboardAnnouncementCard announcement={announcement} onOpen={() => onOpen(announcement)} tabIndex={index === activeIndex ? 0 : -1} />
            </div>
          ))}
          {institute && (
            <div className="min-w-0 flex-[0_0_100%] px-3 py-3" role="group" aria-roledescription="slide" aria-label={`${totalSlides} of ${totalSlides}`} aria-hidden={activeIndex !== totalSlides - 1}>
              <InstituteDetailCard institute={institute} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
