import { BellRing, ScrollText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AnnouncementImage } from '@/components/announcements/AnnouncementImage';
import type { Announcement } from '../types';

type AnnouncementsDashboardTabProps = {
  announcements?: Announcement[];
  isLoading: boolean;
};

export function AnnouncementsDashboardTab({ announcements, isLoading }: AnnouncementsDashboardTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center">
        <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs" className="h-9 w-9 object-contain" />
        <h1 className="brand-wordmark text-xl text-foreground">Announcements</h1>
        <div aria-hidden="true" />
      </div>
      {isLoading && (
        <div className="flex justify-center py-12">
          <BellRing className="h-6 w-6 animate-bounce text-muted-foreground" />
        </div>
      )}
      {announcements?.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <ScrollText className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">No announcements yet</p>
        </div>
      )}
      {announcements?.map((announcement) => (
        <Card key={announcement.id} className="border border-border/40 shadow-sm bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 ring-1 ring-background">
                <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="" className="h-7 w-7 object-contain" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="break-words text-sm">{announcement.title}</CardTitle>
                <CardDescription className="mt-1 text-[11px]">
                  {new Date(announcement.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{announcement.content}</p>
            {announcement.media_url?.match(/\.(jpeg|jpg|png|gif|webp)$/i) && (
              <AnnouncementImage src={announcement.media_url} alt="" className="mt-3 h-auto w-full rounded-xl object-contain" />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
