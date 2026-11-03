import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle, BellRing, Calendar, ScrollText } from 'lucide-react';
import { AnnouncementImage } from '@/components/announcements/AnnouncementImage';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import Seo from '@/components/Seo';

const AnnouncementsPage = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    type ProfileType = { role: string; plan: string } | null;

    const { data: profile } = useQuery<ProfileType>({
        queryKey: ['profile-role-plan', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase
                .from('profiles')
                .select('role, plan')
                .eq('id', user.id)
                .maybeSingle();

            if (error) {
                console.error('Error fetching profile:', error);
                return null;
            }
            return data as ProfileType;
        },
        enabled: !!user?.id
    });

    // Fetch announcements from Supabase
    const { data: announcements, isLoading, isError, error } = useQuery({
        queryKey: ['announcements'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching announcements:', error);
                throw new Error('Failed to load announcements. Please try again later.');
            }
            return data;
        },
        enabled: true,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
    });

    // Fetch user's read announcements
    const { data: readAnnouncements } = useQuery({
        queryKey: ['readAnnouncements', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const { data, error } = await supabase
                .from('user_announcements')
                .select('announcement_id')
                .eq('user_id', user.id);

            if (error) {
                console.error('Error fetching read announcements:', error);
                return [];
            }
            return data.map(item => item.announcement_id);
        },
        enabled: !!user?.id,
        staleTime: 0,
    });

    // Mutation to mark announcements as read
    const markAsReadMutation = useMutation({
        mutationFn: async (announcementIds: string[]) => {
            if (!user?.id || !announcementIds || announcementIds.length === 0) return;

            const recordsToInsert = announcementIds.map((id: string) => ({
                user_id: user.id,
                announcement_id: id,
            }));

            const { error } = await supabase
                .from('user_announcements')
                .upsert(recordsToInsert, { onConflict: 'user_id, announcement_id' });

            if (error) {
                console.error('Error marking announcements as read:', error);
                throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['readAnnouncements', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['profileDropdownProfile', user?.id] });
        },
        onError: (err) => {
            console.error('Failed to mark announcements as read:', err.message);
        }
    });

    // Mark all current announcements as read when component mounts (or announcements/user change)
    useEffect(() => {
        if (announcements && announcements.length > 0) {
            try {
                localStorage.setItem('last_seen_announcement_id', announcements[0].id);
            } catch (e) {
                console.error('Error saving last_seen_announcement_id:', e);
            }
        }
        if (user?.id && announcements && announcements.length > 0 && readAnnouncements) {
            const unreadIds = announcements
                .filter(announcement => !readAnnouncements.includes(announcement.id))
                .map(announcement => announcement.id);

            if (unreadIds.length > 0) {
                markAsReadMutation.mutate(unreadIds);
            }
        }
    }, [user?.id, announcements, readAnnouncements]);

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Seo
                title="Announcements - GitFetcher"
                description="Latest news, updates, and release notes from GitFetcher."
            />

            {/* Header with Back Button */}
            <div className="sticky top-0 z-30 border-b border-border/60 bg-background/92 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
                <div className="mx-auto grid max-w-4xl grid-cols-[1fr_auto_1fr] items-center px-4 py-4">
                    <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="Medmacs" className="h-9 w-9 object-contain" />
                    <h1 className="brand-wordmark text-xl text-foreground">Announcements</h1>
                    <div aria-hidden="true" />
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8">
                <p className="mb-8 text-center text-muted-foreground">
                    Stay updated with the latest features, releases, and platform updates.
                </p>

                <div className="space-y-6">
                    {isLoading && (
                        <div className="text-center text-blue-500 dark:text-blue-400 mt-8 flex flex-col items-center justify-center">
                            <BellRing className="h-8 w-8 animate-bounce mb-3" />
                            <p>Loading announcements...</p>
                        </div>
                    )}

                    {isError && (
                        <div className="text-center text-red-600 dark:text-red-400 mt-8 flex flex-col items-center justify-center">
                            <XCircle className="h-8 w-8 mb-3" />
                            <p>{error?.message || 'Failed to load announcements. Please check your connection.'}</p>
                        </div>
                    )}

                    {!isLoading && !isError && announcements?.length === 0 && (
                        <div className="text-center text-gray-600 dark:text-gray-400 mt-8 flex flex-col items-center justify-center">
                            <ScrollText className="h-8 w-8 mb-3" />
                            <p>No announcements available at the moment. Please check back later!</p>
                        </div>
                    )}

                    {announcements?.map((announcement) => (
                        <Card key={announcement.id} className="animate-fade-in overflow-hidden border border-border/60 bg-card shadow-sm">
                            <CardHeader>
                                <div className="flex items-start gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 ring-1 ring-background">
                                        <img src="/lovable-uploads/bf69a7f7-550a-45a1-8808-a02fb889f8c5.png" alt="" className="h-8 w-8 object-contain" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <CardTitle className="break-words text-foreground">{announcement.title}</CardTitle>
                                        <CardDescription className="mt-1 flex items-center text-muted-foreground">
                                            <Calendar className="mr-1.5 h-4 w-4 shrink-0" />
                                            {new Date(announcement.created_at).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="mb-4 whitespace-pre-wrap leading-relaxed text-foreground/85">{announcement.content}</p>
                                {announcement.media_url && (
                                    <div className="mt-4">
                                        {announcement.media_url.match(/\.(jpeg|jpg|png|gif|webp)$/i) ? (
                                            <AnnouncementImage
                                                src={announcement.media_url}
                                                alt="Announcement media"
                                                className="h-auto w-full rounded-xl object-contain"
                                            />
                                        ) : announcement.media_url.match(/\.(mp4|webm|ogg)$/i) ? (
                                            <video controls className="h-auto w-full rounded-xl">
                                                <source src={announcement.media_url} type={`video/${announcement.media_url.split('.').pop()}`} />
                                                Your browser does not support the video tag.
                                            </video>
                                        ) : (
                                            <p className="text-red-500 text-sm p-2">Unsupported media type.</p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AnnouncementsPage;
