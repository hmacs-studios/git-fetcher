import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, BellRing, Calendar, ScrollText, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import Seo from '@/components/Seo';

const AnnouncementsPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <Seo
                title="Announcements - GitFetcher"
                description="Latest news, updates, and release notes from GitFetcher."
            />

            {/* Header with Back Button */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 pt-[env(safe-area-inset-top)]">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/dashboard')}
                            className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                            aria-label="Back to Dashboard"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <BellRing className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            Announcements
                        </h1>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8">
                <p className="text-gray-600 dark:text-gray-400 text-center mb-8">
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
                        <Card key={announcement.id} className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 shadow-md hover:shadow-lg transition-shadow duration-300 animate-fade-in">
                            <CardHeader>
                                <CardTitle className="text-gray-900 dark:text-white flex items-center">
                                    <BellRing className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                                    {announcement.title}
                                </CardTitle>
                                <CardDescription className="text-gray-600 dark:text-gray-400 flex items-center mt-1">
                                    <Calendar className="h-4 w-4 mr-1.5 text-gray-500" />
                                    {new Date(announcement.created_at).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">{announcement.content}</p>
                                {announcement.media_url && (
                                    <div className="mt-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                                        {announcement.media_url.match(/\.(jpeg|jpg|png|gif|webp)$/i) ? (
                                            <img
                                                src={announcement.media_url}
                                                alt="Announcement media"
                                                className="w-full h-auto object-cover max-h-96"
                                                onError={(e) => {
                                                    e.currentTarget.onerror = null;
                                                    e.currentTarget.src = 'https://placehold.co/600x400/cccccc/333333?text=Image+Not+Available';
                                                }}
                                            />
                                        ) : announcement.media_url.match(/\.(mp4|webm|ogg)$/i) ? (
                                            <video controls className="w-full h-auto max-h-96">
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
