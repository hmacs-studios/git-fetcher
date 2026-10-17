import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Heart,
  MessageSquare,
  Eye,
  Play,
  Pause,
  Sparkles,
  Bot,
  X,
  Send,
  HelpCircle,
  CheckCircle,
  XCircle,
  ExternalLink,
  Flame,
  FileText,
  MoreVertical,
  Bookmark,
  Info,
  Flag,
  ShieldAlert,
  Edit,
  Trash2,
  AlertTriangle,
  Check,
  Shield,
  Star,
  Crown,
  CheckCircle2,
  UserCheck,
  ImageOff,
} from 'lucide-react';
import { Browser } from '@capacitor/browser';
import { reelDispatcher, ClinicalReel } from '@/services/reelDispatcher';
import { DrAhroidModal } from '@/components/discover/DrAhroidModal';
import { triggerHaptic } from '@/utils/haptics';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface HeartAnim {
  id: number;
  x: number;
  y: number;
}

interface ReelComment {
  id: string;
  userId?: string;
  userName: string;
  userRole?: string;
  userPlan?: string;
  isHighAccuracy?: boolean;
  avatarUrl?: string;
  text: string;
  timestamp: string;
  likes: number;
  isLiked?: boolean;
}

const DEFAULT_PRODUCTION_COMMENTS: Record<string, ReelComment[]> = {};

export const MedmacsDiscoverTab: React.FC<{ active?: boolean }> = ({ active }) => {
  const { user } = useAuth();
  const [reels, setReels] = useState<ClinicalReel[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [activeBadgeTooltip, setActiveBadgeTooltip] = useState<{ id: string; title: string; desc: string } | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showPauseOverlay, setShowPauseOverlay] = useState(false);
  const [hearts, setHearts] = useState<HeartAnim[]>([]);
  const [reactions, setReactions] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [selectedQuizOption, setSelectedQuizOption] = useState<Record<string, string>>({});
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [savedReelIds, setSavedReelIds] = useState<Set<string>>(new Set());
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [reelComments, setReelComments] = useState<Record<string, ReelComment[]>>(DEFAULT_PRODUCTION_COMMENTS);
  const [newCommentInput, setNewCommentInput] = useState('');
  const [showDrAhroid, setShowDrAhroid] = useState(false);
  const [myAvatar, setMyAvatar] = useState<string | undefined>(undefined);
  const [userYear, setUserYear] = useState<string | undefined>(undefined);
  const [showYearWarning, setShowYearWarning] = useState(false);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [savedReels, setSavedReels] = useState<ClinicalReel[]>([]);
  const [reelViews, setReelViews] = useState<Record<string, number>>({});
  const [loadedImages, setLoadedImages] = useState<Set<string>>(() => new Set());
  const [videoReady, setVideoReady] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const closeSavedReels = () => setShowSavedModal(false);
    window.addEventListener('close-saved-reels', closeSavedReels);
    return () => window.removeEventListener('close-saved-reels', closeSavedReels);
  }, []);

  // Comment Tap & Hold / Context Submenu & Edit/Delete Confirmation States
  const [activeCommentSubmenu, setActiveCommentSubmenu] = useState<ReelComment | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentInput, setEditCommentInput] = useState('');
  const [commentToDelete, setCommentToDelete] = useState<ReelComment | null>(null);
  const commentHoldTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Gesture States: Tap & Hold + Pinch to Zoom
  const [isHoldingUI, setIsHoldingUI] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [isPinching, setIsPinching] = useState(false);
  const [isElasticResetting, setIsElasticResetting] = useState(false);

  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pinchStartDistRef = useRef<number>(0);
  const pinchActiveRef = useRef(false);
  const recentPinchReleaseRef = useRef(0);
  const reelStartTimeRef = useRef<number>(Date.now());

  const [seenReelIds, setSeenReelIds] = useState<Set<string>>(() => new Set());
  const [isEndOfFeed, setIsEndOfFeed] = useState(false);
  const [failedReelIds, setFailedReelIds] = useState<Set<string>>(() => new Set());
  const failedReelIdsRef = useRef<Set<string>>(new Set());

  const lastTapTimeRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const touchStartXRef = useRef<number>(0);
  const isSwipingRef = useRef<boolean>(false);
  const wheelCooldownRef = useRef<boolean>(false);
  const currentIndexRef = useRef<number>(currentIndex);
  const reelsRef = useRef<ClinicalReel[]>(reels);

  const [slideAnim, setSlideAnim] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    reelsRef.current = reels;
  }, [reels]);

  // Keep autoplaying video reels/ads in sync with the pause gesture.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isPaused || !currentReel) {
      el.pause();
      return;
    }
    const isVideo = currentReel.media_type === 'video' || !!currentReel.video_url || !!(currentReel.is_ad && (currentReel.ad_banner_url || currentReel.image_url));
    if (isVideo && !videoReady.has(currentReel.assigned_id)) {
      el.pause();
      return;
    }
    el.muted = false;
    el.play().catch(() => {});
  }, [isPaused, currentIndex, reels, videoReady]);

  // Handle device / browser Back Button to close active modals & sheets
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (showCommentsModal || showExplanationModal || showMenuModal || showSourceModal || showDrAhroid) {
        e.preventDefault();
        setShowCommentsModal(false);
        setShowExplanationModal(false);
        setShowMenuModal(false);
        setShowSourceModal(false);
        setShowDrAhroid(false);
      }
    };

    if (showCommentsModal || showExplanationModal || showMenuModal || showSourceModal || showDrAhroid) {
      window.history.pushState({ modalOpen: true }, '');
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [showCommentsModal, showExplanationModal, showMenuModal, showSourceModal, showDrAhroid]);

  // Tab switch / unmount cleanup: wipe seen state & reset session
  useEffect(() => {
    loadReels();

    return () => {
      setSeenReelIds(new Set());
      setIsEndOfFeed(false);
    };
  }, []);

  // Desktop wheel & arrow key navigation for smooth reel scrolling
  useEffect(() => {
    const handleGlobalWheel = (e: WheelEvent) => {
      if (wheelCooldownRef.current) return;
      if (Math.abs(e.deltaY) > 15) {
        wheelCooldownRef.current = true;
        if (e.deltaY > 0) {
          triggerNextReelWithAnim();
        } else {
          triggerPrevReelWithAnim();
        }
        setTimeout(() => {
          wheelCooldownRef.current = false;
        }, 400);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        triggerNextReelWithAnim();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        triggerPrevReelWithAnim();
      }
    };

    window.addEventListener('wheel', handleGlobalWheel, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('wheel', handleGlobalWheel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Preload neighboring images for 0ms instant swipe
  useEffect(() => {
    if (reels.length > 0 && !isEndOfFeed) {
      for (let i = 1; i <= 3; i++) {
        const nextImg = reels[currentIndex + i]?.image_url;
        if (nextImg && nextImg.startsWith('http')) {
          const img = new Image();
          img.src = nextImg;
        }
      }
      const prevImg = reels[currentIndex - 1]?.image_url;
      if (prevImg && prevImg.startsWith('http')) {
        const img = new Image();
        img.src = prevImg;
      }
    }
  }, [currentIndex, reels, isEndOfFeed]);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      setIsHoldingUI(false);
      setIsPinching(true);
      pinchActiveRef.current = true;
      isSwipingRef.current = false;
      setIsElasticResetting(false);
      pinchStartDistRef.current = getTouchDistance(e.touches);
      return;
    }

    if (e.touches.length === 1) {
      touchStartYRef.current = e.touches[0].clientY;
      touchStartXRef.current = e.touches[0].clientX;
      isSwipingRef.current = false;

      holdTimerRef.current = setTimeout(() => {
        setIsHoldingUI(true);
      }, 300);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      if (!isPinching) {
        setIsPinching(true);
        pinchActiveRef.current = true;
        pinchStartDistRef.current = getTouchDistance(e.touches);
      }
      isSwipingRef.current = false;
      const dist = getTouchDistance(e.touches);
      if (pinchStartDistRef.current > 0) {
        const scale = Math.min(3.5, Math.max(1, dist / pinchStartDistRef.current));
        setZoomScale(scale);
      }
      return;
    }

    if (e.touches.length === 1) {
      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const deltaY = currentY - touchStartYRef.current;
      const deltaX = currentX - touchStartXRef.current;

      // Right after a pinch started, a leftover single finger must not be
      // mistaken for a swipe: re-baseline and swallow the movement.
      if (pinchActiveRef.current) {
        touchStartYRef.current = currentY;
        touchStartXRef.current = currentX;
        isSwipingRef.current = false;
        return;
      }

      if (Math.abs(deltaY) > 15 || Math.abs(deltaX) > 15) {
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        setIsHoldingUI(false);
      }

      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 20) {
        isSwipingRef.current = true;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    setIsHoldingUI(false);

    if (isPinching || pinchActiveRef.current || zoomScale > 1.05) {
      pinchActiveRef.current = false;
      isSwipingRef.current = false;
      setIsPinching(false);
      setIsElasticResetting(true);
      setZoomScale(1);
      recentPinchReleaseRef.current = Date.now();
      setTimeout(() => setIsElasticResetting(false), 300);
      return;
    }

    // Ignore a swipe that immediately follows a pinch release so the pinch
    // itself never navigates the feed.
    if (Date.now() - recentPinchReleaseRef.current < 300) {
      isSwipingRef.current = false;
      return;
    }

    if (e.changedTouches.length === 0) return;
    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaY = touchEndY - touchStartYRef.current;
    const deltaX = touchEndX - touchStartXRef.current;

    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 25) {
      isSwipingRef.current = true;
      if (deltaY < 0) {
        triggerNextReelWithAnim();
      } else {
        triggerPrevReelWithAnim();
      }
    }
  };

  // STRICT NO-LOOP REEL NAVIGATION (NO REPETITIONS)
  const triggerNextReelWithAnim = () => {
    const curIdx = currentIndexRef.current;
    const allReels = reelsRef.current;
    if (allReels.length === 0) return;

    if (isEndOfFeed) return;

    if (curIdx < allReels.length - 1) {
      setSlideAnim('animate-in slide-in-from-bottom duration-300');
      const nextIdx = curIdx + 1;
      setCurrentIndex(nextIdx);
      setVideoReady(new Set());

      const nextReelObj = allReels[nextIdx];
      if (nextReelObj) {
        setSeenReelIds((prev) => new Set(prev).add(nextReelObj.assigned_id));
      }
      setIsPaused(false);
      setTimeout(() => setSlideAnim(''), 350);
    } else {
      // Reached the end of loaded queue
      setIsEndOfFeed(true);
    }
  };

  const triggerPrevReelWithAnim = () => {
    const curIdx = currentIndexRef.current;
    const allReels = reelsRef.current;
    if (allReels.length === 0) return;

    if (isEndOfFeed) {
      setIsEndOfFeed(false);
      return;
    }

    if (curIdx > 0) {
      setSlideAnim('animate-in slide-in-from-top duration-300');
      const prevIdx = curIdx - 1;
      setCurrentIndex(prevIdx);
      setVideoReady(new Set());
      setIsPaused(false);
      setTimeout(() => setSlideAnim(''), 350);
    }
  };

  const nextReel = () => triggerNextReelWithAnim();
  const prevReel = () => triggerPrevReelWithAnim();

  // Bad media is filtered out by the dispatcher before it reaches the feed.
  // If an error still slips through at render time, we surface the "Image
  // unavailable" fallback and record the reel at the dispatcher so it never
  // reappears — no autoswiping.
  const markReelFailed = (failedId: string, mediaUrl?: string) => {
    reelDispatcher.reportBrokenMedia(failedId, mediaUrl);

    if (failedReelIdsRef.current.has(failedId)) return;
    failedReelIdsRef.current = new Set(failedReelIdsRef.current).add(failedId);
    setFailedReelIds(failedReelIdsRef.current);
  };

  const isFetchingMoreRef = useRef(false);

  // Proactive Queue Filler: Keeps 3-4 unseen reels ready in queue ahead
  useEffect(() => {
    const unseenAhead = reels.slice(currentIndex + 1).filter((r) => !seenReelIds.has(r.assigned_id));

    if (unseenAhead.length < 4 && !isFetchingMoreRef.current && !isEndOfFeed) {
      isFetchingMoreRef.current = true;
      reelDispatcher
        .fetchReels('user_app', 4, undefined, 50)
        .then((moreReels) => {
          if (moreReels && moreReels.length > 0) {
            setReels((prev) => {
              const existingIds = new Set(prev.map((r) => r.assigned_id));
              let newUnique = moreReels.filter(
                (r) => !existingIds.has(r.assigned_id) && !seenReelIds.has(r.assigned_id)
              );

              // If user has viewed all available reels in filter, allow re-enqueueing for endless stream
              if (newUnique.length === 0) {
                newUnique = moreReels.filter((r) => !existingIds.has(r.assigned_id));
              }

              if (newUnique.length > 0) {
                return [...prev, ...newUnique];
              } else {
                if (prev.length > 0 && currentIndex >= prev.length - 1) {
                  setIsEndOfFeed(true);
                }
                return prev;
              }
            });
          } else if (reels.length > 0 && currentIndex >= reels.length - 1) {
            setIsEndOfFeed(true);
          }
        })
        .catch((err) => console.warn('[Prefetch] Error:', err))
        .finally(() => {
          isFetchingMoreRef.current = false;
        });
    }
  }, [currentIndex, reels, seenReelIds, isEndOfFeed]);

  // Track Dwell Time Telemetry on Reel Index Switch
  useEffect(() => {
    const currentReel = reels[currentIndex];
    const watchTime = Math.max(1, Math.round((Date.now() - reelStartTimeRef.current) / 1000));
    reelStartTimeRef.current = Date.now();

    if (currentReel && user?.id) {
      reelDispatcher.recordView({
        user_id: user.id,
        reel_id: currentReel.assigned_id,
        watch_time_seconds: watchTime,
        is_interacted: !!selectedQuizOption[currentReel.assigned_id],
      }).catch(() => {});
    }

    if (currentReel) {
      // 1. Fetch persistent DB Likes
      reelDispatcher.fetchReelLikes(currentReel.assigned_id, user?.id).then(({ count, userLiked, viewsCount }) => {
        setReactions((prev) => {
          const currentLocal = prev[currentReel.assigned_id];
          return {
            ...prev,
            [currentReel.assigned_id]: {
              count: Math.max(count, currentLocal?.count || 0),
              liked: currentLocal?.liked !== undefined ? currentLocal.liked : userLiked,
            },
          };
        });
        setReelViews((prev) => ({ ...prev, [currentReel.assigned_id]: viewsCount }));
      });

      // 2. Fetch persistent DB Comments
      setIsCommentsLoading(true);
      reelDispatcher.fetchComments(currentReel.assigned_id, user?.id).then(async (dbComments) => {
        if (dbComments && dbComments.length > 0) {
          const commentUserIds = Array.from(
            new Set(dbComments.map((c: any) => c.user_id).filter(Boolean))
          );
          const profileAvatars: Record<string, string> = {};
          if (commentUserIds.length > 0) {
            try {
              const { data: profiles } = await supabase
                .from('profiles')
                .select('id, avatar_url')
                .in('id', commentUserIds);
              (profiles || []).forEach((p: any) => {
                if (p.avatar_url) profileAvatars[p.id] = p.avatar_url;
              });
            } catch (e) {
              console.warn('[Discover] Could not load comment avatars:', e);
            }
          }

          const mapped: ReelComment[] = dbComments.map((c) => ({
            id: c.id,
            userId: c.user_id,
            userName: c.user_name,
            userRole: c.user_role,
            userPlan: c.user_plan,
            isHighAccuracy: c.is_high_accuracy,
            avatarUrl: profileAvatars[c.user_id] || c.avatar_url,
            text: c.comment_text,
            timestamp: new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            likes: c.likes_count || 0,
            isLiked: !!c.is_liked,
          }));
          setReelComments((prev) => ({
            ...prev,
            [currentReel.assigned_id]: mapped,
          }));
        }
        setIsCommentsLoading(false);
      }).catch(() => {
        setIsCommentsLoading(false);
      });
    }
  }, [currentIndex, reels[currentIndex]?.assigned_id]);

  // Load persisted saved reels for the logged-in user
  useEffect(() => {
    if (user?.id) {
      reelDispatcher.fetchSavedReelIds(user.id).then((saved) => {
        setSavedReelIds(saved);
      }).catch(() => {});
    } else {
      setSavedReelIds(new Set());
    }
  }, [user?.id]);

  // Load own profile avatar (profiles.avatar_url is the source of truth)
  useEffect(() => {
    if (!user?.id) {
      setMyAvatar(undefined);
      return;
    }
    (async () => {
      let avatar: string | undefined;
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        avatar = profile?.avatar_url || user?.user_metadata?.avatar_url || undefined;
      } catch (e) {
        console.warn('[Discover] Could not load own avatar:', e);
        avatar = user?.user_metadata?.avatar_url || undefined;
      }
      setMyAvatar(avatar);
    })();
  }, [user?.id, user?.user_metadata?.avatar_url]);

  // Load the user's MBBS year to gate early-year (1-3) users behind a warning.
  useEffect(() => {
    if (!user?.id) {
      setUserYear(undefined);
      return;
    }
    (async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('year')
          .eq('id', user.id)
          .maybeSingle();
        setUserYear((profile?.year as string) || undefined);
      } catch (e) {
        console.warn('[Discover] Could not load user year:', e);
        setUserYear(undefined);
      }
    })();
  }, [user?.id]);

  const isEarlyYear = !!userYear && ['1st', '2nd', '3rd'].includes(String(userYear).trim().toLowerCase());

  useEffect(() => {
    if (active && isEarlyYear) {
      setShowYearWarning(true);
    }
  }, [active, isEarlyYear]);

  // Personalized Reel Loading
  const loadReels = async () => {
    setIsLoading(true);
    setIsEndOfFeed(false);
    try {
      const recentTopics: string[] = [];
      const recentChapters: string[] = [];

      if (user?.id) {
        const { data: userAnswers } = await supabase
          .from('user_answers')
          .select(`
            mcqs(
              chapter_id,
              chapters(
                name,
                subjects(name)
              )
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (userAnswers && userAnswers.length > 0) {
          userAnswers.forEach((ans: any) => {
            const chap = ans.mcqs?.chapters?.name;
            const subj = ans.mcqs?.chapters?.subjects?.name;
            if (chap && !recentChapters.includes(chap)) recentChapters.push(chap);
            if (subj && !recentTopics.includes(subj)) recentTopics.push(subj);
          });
        }
      }

      const data = await reelDispatcher.fetchReels(
        user?.id || 'user_app',
        4,
        undefined,
        100,
        recentTopics,
        recentChapters
      );

      if (data && data.length > 0) {
        setReels(data);
        if (data[0]) {
          setSeenReelIds(new Set([data[0].assigned_id]));
        }
      } else {
        setReels([]);
        setIsEndOfFeed(true);
      }
    } catch (e) {
      console.error('[MedmacsDiscoverTab] Error loading reels:', e);
      setReels([]);
      setIsEndOfFeed(true);
    } finally {
      setIsLoading(false);
    }
  };

  const currentReel = reels[currentIndex];

  // Shuffle the quiz options among themselves once per reel so the correct
  // answer is not always in the same position.
  const shuffledQuizOptions = useMemo(() => {
    const quiz = currentReel?.interactive_quiz;
    if (!quiz) return [];
    const options = [
      { key: 'A' as const, text: quiz.option_a },
      { key: 'B' as const, text: quiz.option_b },
    ];
    return options.sort(() => Math.random() - 0.5);
  }, [currentReel?.assigned_id, currentReel?.interactive_quiz]);

  const handleOpenAdLink = async (targetUrl: string) => {
    if (!targetUrl) return;
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
        await Browser.open({ url: targetUrl });
      } else {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const handleTouchTap = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (isSwipingRef.current) return;
    const now = Date.now();
    const DOUBLE_TAP_THRESHOLD = 300;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    if (now - lastTapTimeRef.current < DOUBLE_TAP_THRESHOLD) {
      // Double tap -> Send Love
      handleSendLove(clientX, clientY);
      lastTapTimeRef.current = 0;
    } else {
      lastTapTimeRef.current = now;
      setTimeout(() => {
        if (lastTapTimeRef.current !== 0) {
          // Play/Pause toggling reserved exclusively for Video media types
          if (currentReel?.media_type === 'video' || !!currentReel?.video_url) {
            togglePauseState();
          }
          lastTapTimeRef.current = 0;
        }
      }, DOUBLE_TAP_THRESHOLD);
    }
  };

  const togglePauseState = () => {
    setIsPaused((prev) => !prev);
    setShowPauseOverlay(true);
    setTimeout(() => setShowPauseOverlay(false), 800);
  };

  const handleSendLove = async (x: number, y: number) => {
    triggerHaptic(20);
    const newHeart: HeartAnim = { id: Date.now(), x, y };
    setHearts((prev) => [...prev, newHeart]);

    if (currentReel) {
      const rid = currentReel.assigned_id;
      setReactions((prev) => {
        const existing = prev[rid] || { count: 142, liked: false };
        return {
          ...prev,
          [rid]: { count: existing.count + (existing.liked ? 0 : 1), liked: true },
        };
      });

      // Record interaction telemetry via Middleman (syncs into self-hosted Supabase)
      reelDispatcher.sendInteraction({
        user_id: user?.id || 'user_app',
        reel_id: rid,
        watch_time_seconds: 5,
        completed_reel: false,
        reaction_type: 'heart',
      });
    }

    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== newHeart.id));
    }, 1000);
  };

  const toggleReact = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentReel) return;
    triggerHaptic(15);
    const rid = currentReel.assigned_id;
    const existing = reactions[rid] || { count: 0, liked: false };
    const newLiked = !existing.liked;

    setReactions((prev) => ({
      ...prev,
      [rid]: { count: existing.count + (newLiked ? 1 : -1), liked: newLiked },
    }));

    // Record persistent like into PostgreSQL discover_reel_likes
    try {
      await reelDispatcher.toggleLike(user?.id, rid, existing.liked);
    } catch (sqlErr) {
      console.warn('[SQL Reaction Error]:', sqlErr);
    }
  };

  const formatCount = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  const openSavedModal = () => {
    setShowSavedModal(true);
    reelDispatcher
      .fetchSavedReels(user?.id)
      .then((rows) => setSavedReels(rows))
      .catch(() => setSavedReels([]));
  };

  const handleOpenSavedReel = (rid: string) => {
    const idx = reels.findIndex((r) => r.assigned_id === rid);
    if (idx >= 0) {
      setCurrentIndex(idx);
    } else {
      const savedReel = savedReels.find((r) => r.assigned_id === rid);
      if (savedReel) {
        setReels((prev) => [savedReel, ...prev]);
        setCurrentIndex(0);
      }
    }
    setSeenReelIds((prev) => new Set(prev).add(rid));
    setIsEndOfFeed(false);
    setIsPaused(false);
    setVideoReady(new Set());
    setShowSavedModal(false);
  };

  const handleImageLoad = (rid: string) => {
    setLoadedImages((prev) => {
      if (prev.has(rid)) return prev;
      const next = new Set(prev);
      next.add(rid);
      return next;
    });
  };

  const handleVideoReady = (rid: string) => {
    setVideoReady((prev) => {
      if (prev.has(rid)) return prev;
      const next = new Set(prev);
      next.add(rid);
      return next;
    });
  };

  const handleVideoBufferProgress = (video: HTMLVideoElement, rid: string) => {
    if (!video.buffered.length) return;
    const bufferedUntil = video.buffered.end(video.buffered.length - 1);
    const startupTarget = Number.isFinite(video.duration)
      ? Math.min(3, video.duration)
      : 3;
    if (bufferedUntil >= startupTarget) handleVideoReady(rid);
  };

  const handleQuizAnswer = async (option: 'A' | 'B') => {
    if (!currentReel) return;

    setSelectedQuizOption((prev) => ({
      ...prev,
      [currentReel.assigned_id]: option,
    }));

    reelDispatcher.sendInteraction({
      user_id: user?.id || 'user_app',
      reel_id: currentReel.assigned_id,
      watch_time_seconds: 10,
      completed_reel: true,
      selected_option: option,
    });
  };

  const handleAddComment = async () => {
    if (!newCommentInput.trim() || !currentReel) return;
    const rid = currentReel.assigned_id;
    const authorName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Dr. Scholar';

    let ownAvatar = myAvatar || user?.user_metadata?.avatar_url || undefined;
    if (!ownAvatar && user?.id) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        if (profile?.avatar_url) ownAvatar = profile.avatar_url;
      } catch (e) {
        console.warn('[Discover] Could not load own avatar:', e);
      }
    }

    const textToPost = newCommentInput.trim();
    setNewCommentInput('');

    // Optimistic UI Update
    const tempCommentObj: ReelComment = {
      id: `c-${Date.now()}`,
      userId: user?.id,
      userName: authorName,
      userPlan: user?.user_metadata?.plan || undefined,
      avatarUrl: ownAvatar,
      text: textToPost,
      timestamp: 'Just now',
      likes: 0,
    };

    setReelComments((prev) => ({
      ...prev,
      [rid]: [...(prev[rid] || []), tempCommentObj],
    }));

    // Persist comment to PostgreSQL database
    const dbComment = await reelDispatcher.postComment({
      userId: user?.id,
      reelId: rid,
      userName: authorName,
      avatarUrl: ownAvatar,
      commentText: textToPost,
      userPlan: user?.user_metadata?.plan || undefined,
    });

    if (dbComment) {
      toast.success('Comment posted');
    }
  };

  const toggleCommentLike = async (commentId: string) => {
    if (!currentReel) return;
    const rid = currentReel.assigned_id;
    const currentList = reelComments[rid] || [];
    const targetComment = currentList.find((c) => c.id === commentId);
    if (!targetComment) return;

    const newLikedState = !targetComment.isLiked;
    triggerHaptic(15);

    // Optimistic Update
    setReelComments((prev) => {
      const list = prev[rid] || [];
      return {
        ...prev,
        [rid]: list.map((c) =>
          c.id === commentId
            ? { ...c, likes: newLikedState ? c.likes + 1 : Math.max(0, c.likes - 1), isLiked: newLikedState }
            : c
        ),
      };
    });

    // Persist comment reaction to PostgreSQL
    if (!commentId.startsWith('c-1') && !commentId.startsWith('c-2') && !commentId.startsWith('c-3')) {
      await reelDispatcher.toggleCommentReaction(user?.id, commentId, targetComment.isLiked || false);
    }
  };

  // --- COMMENT TAP & HOLD, EDIT & DELETE HANDLERS ---
  const handleCommentTouchStart = (comment: ReelComment) => {
    if (commentHoldTimerRef.current) clearTimeout(commentHoldTimerRef.current);
    commentHoldTimerRef.current = setTimeout(() => {
      setActiveCommentSubmenu(comment);
    }, 500);
  };

  const handleCommentTouchEnd = () => {
    if (commentHoldTimerRef.current) {
      clearTimeout(commentHoldTimerRef.current);
      commentHoldTimerRef.current = null;
    }
  };

  const handleStartEditComment = (comment: ReelComment) => {
    setEditingCommentId(comment.id);
    setEditCommentInput(comment.text);
    setActiveCommentSubmenu(null);
  };

  const handleSaveEditedComment = async (commentId: string) => {
    if (!currentReel || !editCommentInput.trim()) return;
    const rid = currentReel.assigned_id;
    const newText = editCommentInput.trim();

    // Optimistic UI update
    setReelComments((prev) => ({
      ...prev,
      [rid]: (prev[rid] || []).map((c) => (c.id === commentId ? { ...c, text: newText } : c)),
    }));

    setEditingCommentId(null);
    setEditCommentInput('');
    toast.success('Comment updated!');

    // Persist edit to PostgreSQL
    await reelDispatcher.updateComment(user?.id, commentId, newText);
  };

  const handleConfirmDeleteComment = async () => {
    if (!commentToDelete || !currentReel) return;
    const rid = currentReel.assigned_id;
    const cid = commentToDelete.id;

    // Optimistic UI update
    setReelComments((prev) => ({
      ...prev,
      [rid]: (prev[rid] || []).filter((c) => c.id !== cid),
    }));

    setCommentToDelete(null);
    setActiveCommentSubmenu(null);
    toast.success('Comment deleted!');

    // Persist deletion in PostgreSQL
    await reelDispatcher.deleteComment(user?.id, cid);
  };

  const handleReportReel = async (reason: string) => {
    if (!currentReel) return;
    const reelId = currentReel.assigned_id;
    setShowMenuModal(false);
    const success = await reelDispatcher.submitReport({
      userId: user?.id,
      reelId,
      reason,
    });
    if (success) {
      toast.success('Item reported to Admins');
      setSeenReelIds((prev) => new Set(prev).add(reelId));
      triggerNextReelWithAnim();
    } else {
      toast.error('Failed to submit report. Try again.');
    }
  };

const DiscoverReelSkeleton: React.FC = () => (
  <div className="relative w-full h-[calc(100dvh-80px)] min-h-[580px] bg-slate-100 dark:bg-slate-950 overflow-hidden flex flex-col justify-between select-none transition-colors duration-300">
    {/* 1. TOP SAFE AREA HEADER SKELETON */}
    <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="w-36 h-8 rounded-full bg-slate-200/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-300 dark:border-white/10 animate-pulse" />
      <div className="w-9 h-9 rounded-full bg-slate-200/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-300 dark:border-white/10 animate-pulse" />
    </div>

    {/* 2. CENTER REEL CANVAS SKELETON */}
    <div className="relative w-full h-full flex items-center justify-center bg-slate-200/60 dark:bg-slate-900/90 animate-pulse">
      <div className="w-16 h-16 rounded-full bg-slate-300/60 dark:bg-slate-800/60 flex items-center justify-center border border-slate-400/20 dark:border-white/5">
        <Flame className="w-8 h-8 text-slate-400 dark:text-slate-700 animate-pulse" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-slate-200/90 via-slate-100/40 to-transparent dark:from-slate-950 dark:via-slate-950/70 dark:to-transparent" />
    </div>

    {/* 3. RIGHT SIDE CONTROLS SKELETON (Aligned to bottom-20) */}
    <div className="absolute right-3 bottom-20 z-30 flex flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <div className="w-11 h-11 rounded-full bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-white/15 animate-pulse shadow-md" />
        <div className="w-6 h-2.5 rounded bg-slate-300 dark:bg-slate-800 animate-pulse" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="w-11 h-11 rounded-full bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-white/15 animate-pulse shadow-md" />
        <div className="w-6 h-2.5 rounded bg-slate-300 dark:bg-slate-800 animate-pulse" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="w-11 h-11 rounded-full bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-white/15 animate-pulse shadow-md" />
        <div className="w-6 h-2.5 rounded bg-slate-300 dark:bg-slate-800 animate-pulse" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="w-11 h-11 rounded-full bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-white/15 animate-pulse shadow-md" />
        <div className="w-6 h-2.5 rounded bg-slate-300 dark:bg-slate-800 animate-pulse" />
      </div>
    </div>

    {/* 4. LEFT BOTTOM CAPTION & QUIZ SKELETON (Aligned to bottom-16 above floating tab bar) */}
    <div className="absolute left-4 bottom-16 right-20 z-30 flex flex-col gap-2 max-w-[82%]">
      {/* Title & Subtitle Card Pill Skeleton */}
      <div className="p-3 rounded-2xl bg-black/30 dark:bg-black/50 border border-white/10 backdrop-blur-md flex flex-col gap-2 animate-pulse">
        <div className="w-3/4 h-5 rounded-lg bg-white/30 dark:bg-slate-700 animate-pulse" />
        <div className="w-full h-3 rounded bg-white/20 dark:bg-slate-800 animate-pulse" />
        <div className="w-4/5 h-3 rounded bg-white/20 dark:bg-slate-800 animate-pulse" />
      </div>

      {/* Quiz Card Skeleton */}
      <div className="mt-1 p-3 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 flex flex-col gap-2 animate-pulse shadow-xl">
        <div className="w-2/3 h-4 rounded bg-slate-200 dark:bg-slate-800" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-white/5" />
          <div className="h-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-white/5" />
        </div>
      </div>

      {/* Ask Dr Ahroid Button Skeleton */}
      <div className="mt-1 w-36 h-9 rounded-full bg-primary/20 border border-primary/20 animate-pulse shadow-sm" />
    </div>
  </div>
);

  if (isLoading) {
    return <DiscoverReelSkeleton />;
  }

  if (!currentReel) {
    return (
      <div className="relative w-full h-[calc(100dvh-80px)] min-h-[580px] bg-slate-100 dark:bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-400 dark:text-slate-500 px-6 text-center">
          <ImageOff className="w-10 h-10 opacity-60" />
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            No more reels to show right now — new reels are added daily!
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-600">
            Check back tomorrow for fresh clinical content.
          </span>
          <button
            onClick={() => {
              setReels([]);
              setIsLoading(true);
              loadReels();
            }}
            className="px-4 py-2 rounded-full bg-primary/15 text-primary font-semibold text-xs"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const currentReactState = reactions[currentReel.assigned_id] || { count: 0, liked: false };
  const currentAnswer = selectedQuizOption[currentReel.assigned_id];
  const isAnswered = !!currentAnswer;
  const isCorrect = currentAnswer === currentReel.interactive_quiz?.correct_option;
  const activeCommentsList = reelComments[currentReel.assigned_id] || [];

  const shouldHideUI = isHoldingUI || isPinching || zoomScale > 1.05;
  const currentVideoSource = currentReel.is_ad
    ? currentReel.ad_banner_url || currentReel.video_url
    : currentReel.video_url;
  const isCurrentVideo = currentReel.media_type === 'video' && Boolean(currentVideoSource);
  const isCurrentMediaReady = isCurrentVideo
    ? videoReady.has(currentReel.assigned_id)
    : loadedImages.has(currentReel.assigned_id);

  return (
    <div className="relative w-full h-[calc(100dvh-80px)] min-h-[580px] bg-slate-100 dark:bg-black text-slate-900 dark:text-white overflow-hidden flex flex-col justify-between select-none">
      {/* 3. TOP SAFE AREA HEADER */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] transition-opacity duration-300 ${
          shouldHideUI ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/15 shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-extrabold text-xs tracking-wider uppercase text-white">
              Medmacs Discover
            </span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            openSavedModal();
          }}
          aria-label="Saved reels"
          className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-black/45 backdrop-blur-md border border-white/15 shadow-sm active:scale-95 transition"
        >
          <Bookmark className="w-4 h-4 text-white" />
          <span className="font-bold text-xs text-white">{savedReelIds.size}</span>
        </button>
      </div>

      {/* 2. REEL IMAGE / CANVAS WITH TAP & HOLD & PINCH TO ZOOM */}
      <div
        ref={containerRef}
        onClick={handleTouchTap}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={() => {
          holdTimerRef.current = setTimeout(() => setIsHoldingUI(true), 300);
        }}
        onMouseUp={() => {
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
          setIsHoldingUI(false);
        }}
        onMouseLeave={() => {
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
          setIsHoldingUI(false);
        }}
        className="relative w-full h-full flex items-center justify-center bg-slate-100 dark:bg-black cursor-pointer overflow-hidden touch-none transition-colors duration-300"
      >
        {failedReelIds.has(currentReel.assigned_id) ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-200 dark:bg-slate-900">
            <ImageOff className="w-10 h-10 text-primary/60" />
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Image unavailable
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 max-w-[220px] text-center">
              {currentReel.medical_topic}
            </span>
          </div>
        ) : (
          <>
            {!isCurrentMediaReady && (
              <div className="absolute inset-0 z-[1] flex items-center justify-center bg-slate-200 dark:bg-slate-950">
                <div className="flex flex-col items-center gap-2.5 animate-pulse">
                  <div className="w-14 h-14 rounded-full bg-slate-300/70 dark:bg-slate-800/70 flex items-center justify-center border border-slate-400/20 dark:border-white/5">
                    <Flame className="w-7 h-7 text-slate-400 dark:text-slate-700" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Loading reel...</span>
                </div>
              </div>
            )}

            {isCurrentVideo ? (
              <video
                key={currentReel.assigned_id}
                ref={videoRef}
                src={currentVideoSource}
                loop
                playsInline
                preload="auto"
                controls={false}
                onProgress={(event) => handleVideoBufferProgress(event.currentTarget, currentReel.assigned_id)}
                onLoadedMetadata={(event) => handleVideoBufferProgress(event.currentTarget, currentReel.assigned_id)}
                onCanPlayThrough={() => handleVideoReady(currentReel.assigned_id)}
                onError={(event) => {
                  const video = event.currentTarget;
                  markReelFailed(currentReel.assigned_id, video.src);
                }}
                onStalled={() => {
                  const elv = videoRef.current;
                  if (elv && !elv.paused && !elv.ended) {
                    elv.play().catch(() => {});
                  }
                }}
                style={{
                  transform: `scale(${zoomScale})`,
                }}
                className={`relative z-[2] w-full h-full object-contain bg-black transition-opacity duration-200 ${
                  isCurrentMediaReady ? 'opacity-100' : 'opacity-0'
                } ${
                  isElasticResetting ? 'transition-transform duration-300 ease-out' : ''
                } ${slideAnim} ${isPaused ? 'brightness-90' : 'brightness-100'}`}
              />
            ) : (
              <img
                key={currentReel.assigned_id}
                src={currentReel.is_ad ? currentReel.ad_banner_url || currentReel.image_url : currentReel.image_url}
                alt={currentReel.medical_topic}
                referrerPolicy="no-referrer"
                onLoad={() => handleImageLoad(currentReel.assigned_id)}
                onError={(event) => {
                  const img = event.currentTarget;
                  markReelFailed(currentReel.assigned_id, img.src);
                }}
                style={{
                  transform: `scale(${zoomScale})`,
                }}
                className={`relative z-[2] w-full h-full object-contain ${
                  isElasticResetting ? 'transition-transform duration-300 ease-out' : ''
                } ${slideAnim} ${isPaused ? 'brightness-90' : 'brightness-100'}`}
              />
            )}
          </>
        )}

        {isPaused && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/35 dark:bg-black/45 backdrop-blur-[2px] pointer-events-none transition-all duration-200">
            <div className="w-16 h-16 rounded-full bg-white/80 dark:bg-slate-900/80 border border-primary/50 flex items-center justify-center text-primary shadow-2xl animate-in zoom-in-75">
              <Pause className="w-8 h-8" />
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/90 drop-shadow-lg">
              Paused
            </span>
          </div>
        )}

        {!isPaused && showPauseOverlay && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 dark:bg-black/40 backdrop-blur-[2px] pointer-events-none transition-all duration-200">
            <div className="w-16 h-16 rounded-full bg-white/80 dark:bg-slate-900/80 border border-primary/50 flex items-center justify-center text-primary shadow-2xl animate-in zoom-in-75">
              <Play className="w-8 h-8 ml-1" />
            </div>
          </div>
        )}

        {hearts.map((h) => (
          <div
            key={h.id}
            style={{ left: h.x - 24, top: h.y - 24 }}
            className="pointer-events-none fixed z-50 animate-bounce"
          >
            <Heart className="w-12 h-12 text-rose-500 fill-rose-500 filter drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]" />
          </div>
        ))}

        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/75 via-black/30 to-transparent pointer-events-none" />
      </div>

      {/* RIGHT SIDE CONTROLS */}
      <div
        className={`absolute right-3 bottom-20 z-30 flex flex-col items-center gap-5 transition-opacity duration-300 ${
          shouldHideUI ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <button onClick={toggleReact} className="flex flex-col items-center group">
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-75 backdrop-blur-md border ${
              currentReactState.liked
                ? 'bg-rose-500/25 border-rose-500/60 text-rose-400 shadow-lg shadow-rose-500/20'
                : 'bg-black/45 border-white/15 text-white hover:bg-black/60 shadow-md'
            }`}
          >
            <Heart className={`w-5 h-5 ${currentReactState.liked ? 'fill-rose-500' : 'group-hover:text-rose-400'}`} />
          </div>
          <span className="mt-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">{currentReactState.count}</span>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowCommentsModal(true);
          }}
          className="flex flex-col items-center group"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md shadow-md transition hover:bg-black/60 active:scale-75">
            <MessageSquare className="w-5 h-5 group-hover:text-primary" />
          </div>
          <span className="mt-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">{activeCommentsList.length}</span>
        </button>

        <div className="flex flex-col items-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md shadow-md">
            <Eye className="w-5 h-5 group-hover:text-primary" />
          </div>
          <span className="mt-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
            {formatCount(reelViews[currentReel.assigned_id] ?? 0)} views
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenuModal(true);
          }}
          className="flex flex-col items-center group"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white backdrop-blur-md shadow-md transition hover:bg-black/60 active:scale-75">
            <MoreVertical className="w-5 h-5 group-hover:text-amber-400" />
          </div>
          <span className="mt-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">More</span>
        </button>
      </div>

      {/* END OF FEED MESSAGE */}
      {isEndOfFeed && (
        <div className="absolute left-4 right-4 top-[max(3.75rem,calc(env(safe-area-inset-top)+2.5rem))] z-40 flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/55 dark:bg-black/65 border border-white/15 backdrop-blur-md shadow-lg animate-in fade-in duration-300">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white">No more reels to show — new reels added daily!</span>
          </div>
        </div>
      )}

      {/* 5. AD REEL TYPE vs CLINICAL REEL TYPE UI */}
      <div
        className={`absolute left-4 bottom-16 right-20 z-30 flex flex-col gap-2 max-w-[82%] transition-opacity duration-300 ${
          shouldHideUI ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        {currentReel.is_ad ? (
          <div className="p-4 rounded-2xl bg-white/95 dark:bg-slate-900/90 border border-amber-500/30 backdrop-blur-xl text-slate-900 dark:text-white shadow-xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/20 dark:bg-amber-500/30 text-amber-700 dark:text-amber-300 border border-amber-500/40 uppercase tracking-wider">
                Sponsored Ad
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold">{currentReel.ad_sponsor_name || 'Partner'}</span>
            </div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight drop-shadow-md">
              {currentReel.medical_topic}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
              {currentReel.diagnosis_text || currentReel.identification_text}
            </p>
            <button
              onClick={() => handleOpenAdLink(currentReel.ad_target_url || 'https://medmacs.app')}
              className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-500/20 active:scale-95 transition"
            >
              <span>{currentReel.ad_cta_text || 'Learn More'}</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="p-2.5 rounded-2xl bg-black/40 dark:bg-black/50 border border-white/10 backdrop-blur-md shadow-xl transition-all duration-300">
              <h2 className="text-lg font-extrabold text-white tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
                {currentReel.medical_topic}
              </h2>
              <p className="text-xs text-slate-100 dark:text-slate-200 mt-0.5 line-clamp-2 leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] font-medium">
                {currentReel.identification_text || currentReel.diagnosis_text}
              </p>
            </div>

            {currentReel.interactive_quiz && (
              <div className="mt-1 p-2.5 rounded-xl bg-white/95 dark:bg-slate-900/90 border border-slate-200 dark:border-white/10 backdrop-blur-md text-xs text-slate-900 dark:text-white shadow-lg">
                <div className="font-semibold text-primary mb-1.5 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-primary" />
                  <span>{currentReel.interactive_quiz.question}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {shuffledQuizOptions.map((option, i) => {
                    const letter = i === 0 ? 'A' : 'B';
                    const selected = currentAnswer === option.key;
                    return (
                      <button
                        key={option.key}
                        onClick={() => handleQuizAnswer(option.key)}
                        className={`px-2.5 py-1.5 rounded-lg text-left font-medium transition border text-[11px] ${
                          selected
                            ? isCorrect
                              ? 'bg-emerald-500/30 border-emerald-400 text-emerald-900 dark:text-emerald-200'
                              : 'bg-rose-500/30 border-rose-400 text-rose-900 dark:text-rose-200'
                            : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {letter}: {option.text}
                      </button>
                    );
                  })}
                </div>

                {/* 4. EXPLANATION MODAL TRIGGER */}
                {isAnswered && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowExplanationModal(true);
                    }}
                    className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-primary hover:text-primary/80 transition"
                  >
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <span>View Detailed Explanation & Solution</span>
                  </button>
                )}
              </div>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDrAhroid(true);
              }}
              className="mt-1 self-start flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground font-bold text-xs shadow-md shadow-primary/25 hover:bg-primary/90 active:scale-95 transition"
            >
              <Bot className="w-4 h-4" />
              <span>Ask Dr Ahroid</span>
              <Sparkles className="w-3.5 h-3.5 opacity-80" />
            </button>
          </>
        )}
      </div>

      {/* 4. DEDICATED QUIZ EXPLANATION MODAL */}
      {showExplanationModal && currentReel.interactive_quiz && (
        <div
          onClick={() => setShowExplanationModal(false)}
          className="fixed inset-0 z-50 bg-black/70 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-border/60 dark:border-white/10 rounded-3xl p-5 text-slate-900 dark:text-white shadow-2xl flex flex-col gap-4 cursor-default"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2 text-primary">
                <FileText className="w-5 h-5" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Quiz Solution & Clinical Explanation</h3>
              </div>
              <button
                onClick={() => setShowExplanationModal(false)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Question Stem</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">{currentReel.interactive_quiz.question}</p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-500/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Correct Answer</span>
                <p className="font-bold text-emerald-900 dark:text-emerald-200 mt-1 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    Option {currentReel.interactive_quiz.correct_option}:{' '}
                    {currentReel.interactive_quiz.correct_option === 'A'
                      ? currentReel.interactive_quiz.option_a
                      : currentReel.interactive_quiz.option_b}
                  </span>
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-border/60 dark:border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Clinical Rationale & Explanation</span>
                <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">{currentReel.interactive_quiz.explanation}</p>
              </div>
            </div>

            <button
              onClick={() => setShowExplanationModal(false)}
              className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 font-bold text-xs text-primary-foreground shadow-lg transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* COMMENTS MODAL */}
      {showCommentsModal && (
        <div
          onClick={() => setShowCommentsModal(false)}
          className="fixed inset-0 z-[100] bg-black/60 dark:bg-black/70 backdrop-blur-md flex flex-col justify-end pb-16 animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-h-[75vh] h-[540px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/10 rounded-t-3xl p-4 flex flex-col text-slate-900 dark:text-white shadow-2xl overflow-hidden cursor-default mb-2"
          >
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-3" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Comments ({activeCommentsList.length})</h3>
              </div>
              <button
                onClick={() => setShowCommentsModal(false)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-4 text-xs pr-1 relative">
              {isCommentsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex gap-3 items-start animate-pulse">
                      <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 shrink-0" />
                      <div className="flex-1 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="w-24 h-3 bg-slate-300 dark:bg-slate-700 rounded" />
                          <div className="w-12 h-2 bg-slate-200 dark:bg-slate-800 rounded" />
                        </div>
                        <div className="w-3/4 h-3 bg-slate-200 dark:bg-slate-700/80 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activeCommentsList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500">
                  <MessageSquare className="w-10 h-10 mb-2 opacity-30 text-primary" />
                  <p className="font-semibold text-sm text-slate-600 dark:text-slate-300">No comments yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Start the discussion by sharing your clinical insight below.</p>
                </div>
              ) : (
                activeCommentsList.map((c) => {
                  const isModerator = c.userRole?.toLowerCase().includes('moderator') || c.userRole?.toLowerCase().includes('mod');
                  const isAdmin = !!c.userRole?.toLowerCase().includes('admin');
                  const isOwnUUID = !!user?.id && c.userId === user.id;
                  const isPremium = c.userPlan?.toLowerCase() === 'premium';
                  const isIconic = c.userPlan?.toLowerCase() === 'iconic';
                  const isHighAccuracy = !!c.isHighAccuracy;

                  return (
                    <div
                      key={c.id}
                      onTouchStart={() => handleCommentTouchStart(c)}
                      onTouchEnd={handleCommentTouchEnd}
                      onMouseDown={() => handleCommentTouchStart(c)}
                      onMouseUp={handleCommentTouchEnd}
                      onMouseLeave={handleCommentTouchEnd}
                      className="flex gap-3 items-start group select-none cursor-pointer"
                    >
                      {c.avatarUrl ? (
                        <img
                          src={c.avatarUrl}
                          alt={c.userName}
                          className="w-9 h-9 rounded-full object-cover shrink-0 border border-border/60 dark:border-white/15 shadow-md"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-primary/60 border border-primary/30 flex items-center justify-center shrink-0 shadow-md">
                          <span className="font-bold text-white text-xs">
                            {c.userName.replace(/^Dr\.\s*/, '').charAt(0)}
                          </span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0 bg-slate-100 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-white/5 relative">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-primary text-xs">{c.userName}</span>

                            {/* BADGE ICONS IN FRONT OF NAME */}
                            <div className="flex items-center gap-1">
                              {/* 1. Verified Badge (Moderator) */}
                              {isModerator && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveBadgeTooltip({
                                      id: c.id + '-mod',
                                      title: 'Verified Moderator',
                                      desc: 'Community Moderator account verified by Medmacs.'
                                    });
                                  }}
                                  className="text-primary hover:scale-110 transition-transform"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 fill-primary/20" />
                                </button>
                              )}

                              {/* 2. Shield Icon (Admin) */}
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveBadgeTooltip({
                                      id: c.id + '-admin',
                                      title: 'System Administrator',
                                      desc: 'Official Medmacs System Administrator profile.'
                                    });
                                  }}
                                  className="text-purple-500 hover:scale-110 transition-transform"
                                >
                                  <Shield className="w-3.5 h-3.5 fill-purple-500/20" />
                                </button>
                              )}

                              {/* 3. Author / Own UUID Icon */}
                              {isOwnUUID && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveBadgeTooltip({
                                      id: c.id + '-author',
                                      title: 'Author / Your Account',
                                      desc: 'You posted this comment with your verified account.'
                                    });
                                  }}
                                  className="text-indigo-400 hover:scale-110 transition-transform"
                                >
                                  <UserCheck className="w-3.5 h-3.5 fill-indigo-500/20" />
                                </button>
                              )}

                              {/* 4. Star Icon (Premium Plan) */}
                              {isPremium && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveBadgeTooltip({
                                      id: c.id + '-prem',
                                      title: 'Premium Plan Member',
                                      desc: 'Active Medmacs Premium subscription holder.'
                                    });
                                  }}
                                  className="text-amber-400 hover:scale-110 transition-transform"
                                >
                                  <Star className="w-3.5 h-3.5 fill-amber-400/30" />
                                </button>
                              )}

                              {/* 5. Crown Icon (Iconic Plan) */}
                              {isIconic && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveBadgeTooltip({
                                      id: c.id + '-iconic',
                                      title: 'Iconic Tier Scholar',
                                      desc: 'Top-tier Medmacs Iconic plan subscriber.'
                                    });
                                  }}
                                  className="text-yellow-500 hover:scale-110 transition-transform"
                                >
                                  <Crown className="w-3.5 h-3.5 fill-yellow-500/30" />
                                </button>
                              )}

                              {/* 6. Fire Icon (High Accuracy Scholar: 90%+ with 500+ MCQs) */}
                              {isHighAccuracy && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveBadgeTooltip({
                                      id: c.id + '-highacc',
                                      title: 'High Accuracy Master',
                                      desc: 'Maintains 90%+ accuracy over 500+ MCQ practice attempts.'
                                    });
                                  }}
                                  className="text-rose-500 hover:scale-110 transition-transform"
                                >
                                  <Flame className="w-3.5 h-3.5 fill-rose-500/30 animate-pulse" />
                                </button>
                              )}
                            </div>

                            </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">{c.timestamp}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveCommentSubmenu(c);
                              }}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 transition opacity-0 group-hover:opacity-100"
                            >
                              <MoreVertical className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {editingCommentId === c.id ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="text"
                              value={editCommentInput}
                              onChange={(e) => setEditCommentInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveEditedComment(c.id)}
                              className="flex-1 bg-white dark:bg-slate-900 border border-primary/50 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEditedComment(c.id)}
                              className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white transition"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingCommentId(null)}
                              className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-normal text-xs">{c.text}</p>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCommentLike(c.id);
                        }}
                        className="flex flex-col items-center shrink-0 pt-1 text-slate-400 hover:text-rose-400 transition"
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${c.isLiked ? 'fill-rose-500 text-rose-500' : ''}`}
                        />
                        <span className="text-[9px] mt-0.5 font-semibold text-slate-500 dark:text-slate-400">{c.likes}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex items-center gap-2 bg-slate-50 dark:bg-slate-950/80 -mx-4 -mb-4 p-3">
              {myAvatar ? (
                <img
                  src={myAvatar}
                  alt={user?.user_metadata?.full_name || 'User'}
                  className="w-8 h-8 rounded-full object-cover shrink-0 border border-border/60 dark:border-white/15 shadow-sm"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-primary/60 border border-primary/30 flex items-center justify-center shrink-0 shadow-sm">
                  <span className="font-bold text-white text-xs">
                    {(user?.user_metadata?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <input
                type="text"
                value={newCommentInput}
                onChange={(e) => setNewCommentInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Add a clinical comment..."
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 rounded-full px-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary focus:outline-none transition"
              />
              <button
                onClick={handleAddComment}
                disabled={!newCommentInput.trim()}
                className="w-9 h-9 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold flex items-center justify-center disabled:opacity-30 transition shadow-md shadow-primary/20 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM-UP OPTIONS SHEET MODAL */}
      {showMenuModal && (
        <div
          onClick={() => setShowMenuModal(false)}
          className="fixed inset-0 z-50 bg-black/60 dark:bg-black/70 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/10 rounded-t-3xl p-5 flex flex-col gap-2 text-slate-900 dark:text-white shadow-2xl animate-in slide-in-from-bottom duration-250 cursor-default"
          >
            {/* Grab handle */}
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-2" />

            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 px-2 mb-1">
              Reel Options
            </h3>

            {/* 1. SAVE OPTION */}
            <button
              onClick={() => {
                const rid = currentReel.assigned_id;
                const wasSaved = savedReelIds.has(rid);
                setSavedReelIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(rid)) {
                    next.delete(rid);
                    toast.info('Removed reel from saved list');
                  } else {
                    next.add(rid);
                    toast.success('Reel saved successfully!');
                  }
                  return next;
                });
                reelDispatcher.toggleSave(user?.id, rid, wasSaved).catch(() => {});
                setShowMenuModal(false);
              }}
              className="flex items-center gap-3 w-full p-3.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/80 text-left font-semibold text-xs transition border border-transparent hover:border-slate-200 dark:hover:border-white/10"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Bookmark className={`w-4 h-4 ${savedReelIds.has(currentReel.assigned_id) ? 'fill-primary text-primary' : ''}`} />
              </div>
              <div className="flex flex-col">
                <span className="text-slate-900 dark:text-white font-bold">
                  {savedReelIds.has(currentReel.assigned_id) ? 'Saved' : 'Save Reel'}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {savedReelIds.has(currentReel.assigned_id) ? 'Saved to your personal collection' : 'Bookmark to view later in Saved items'}
                </span>
              </div>
            </button>

            {/* 2. SOURCE / ATTRIBUTION OPTION */}
            <button
              onClick={() => {
                setShowMenuModal(false);
                setShowSourceModal(true);
              }}
              className="flex items-center gap-3 w-full p-3.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/80 text-left font-semibold text-xs transition border border-transparent hover:border-slate-200 dark:hover:border-white/10"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Info className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-slate-900 dark:text-white font-bold">Source & Image Attribution</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">View medical catalog source, license & provider</span>
              </div>
            </button>

            {/* 3. REPORT / NOT INTERESTED OPTION */}
            <button
              onClick={() => {
                handleReportReel('not_interested');
              }}
              className="flex items-center gap-3 w-full p-3.5 rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left font-semibold text-xs transition border border-transparent hover:border-rose-200 dark:hover:border-rose-500/30 group"
            >
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-rose-600 dark:text-rose-400 font-bold group-hover:text-rose-700 dark:group-hover:text-rose-300">
                  Report / I don't want to see this
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Hide this reel and show fewer similar topics</span>
              </div>
            </button>

            {/* 4. CLOSE OPTION */}
            <button
              onClick={() => setShowMenuModal(false)}
              className="mt-2 w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs text-slate-700 dark:text-slate-200 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* SOURCE & ATTRIBUTION MODAL */}
      {showSourceModal && (
        <div
          onClick={() => setShowSourceModal(false)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-border/60 dark:border-white/10 rounded-3xl p-5 text-slate-900 dark:text-white shadow-2xl flex flex-col gap-4 cursor-default"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2 text-primary">
                <Info className="w-5 h-5" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Image Source & Attribution</h3>
              </div>
              <button
                onClick={() => setShowSourceModal(false)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Medical Catalog ID</span>
                <p className="font-mono font-bold text-primary text-sm mt-0.5">{currentReel.assigned_id}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Provider & Collection</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {currentReel.attribution_text || 'CDC Public Health Image Library (PHIL) / Open Access Clinical Repository'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">License Type</span>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {currentReel.license_type || 'Public Domain / Educational Fair Use'}
                </p>
              </div>

              {currentReel.original_source_url && (
                <button
                  onClick={() => Browser.open({ url: currentReel.original_source_url! })}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-primary/10 text-primary font-bold border border-primary/25 hover:bg-primary/15 transition"
                >
                  <span>Open Original Repository Source</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowSourceModal(false)}
              className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 font-bold text-xs text-primary-foreground shadow-lg transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <DrAhroidModal
        isOpen={showDrAhroid}
        onClose={() => setShowDrAhroid(false)}
        reelTopic={currentReel.medical_topic}
        reelCategory={currentReel.media_category}
        diagnosisText={currentReel.diagnosis_text}
      />

      {/* COMMENT CONTEXT SUBMENU (Tap & Hold options) */}
      {activeCommentSubmenu && (
        <div
          onClick={() => setActiveCommentSubmenu(null)}
          className="fixed inset-0 z-[120] bg-black/60 dark:bg-black/70 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/10 rounded-t-3xl p-5 flex flex-col gap-2 text-slate-900 dark:text-white shadow-2xl animate-in slide-in-from-bottom duration-250 cursor-default"
          >
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-2" />

            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 px-2 mb-1">
              Comment Actions
            </h3>

            {/* Edit Option (Owner / Author) */}
            <button
              onClick={() => handleStartEditComment(activeCommentSubmenu)}
              className="flex items-center gap-3 w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-white font-semibold text-xs transition"
            >
              <Edit className="w-4 h-4 text-primary" />
              <span>Edit Comment</span>
            </button>

            {/* Delete Option with Confirmation Trigger */}
            <button
              onClick={() => setCommentToDelete(activeCommentSubmenu)}
              className="flex items-center gap-3 w-full p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-semibold text-xs transition"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Delete Comment</span>
            </button>

            <button
              onClick={() => setActiveCommentSubmenu(null)}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 font-bold text-xs text-slate-600 dark:text-slate-300 transition mt-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG FOR COMMENT DELETION */}
      {commentToDelete && (
        <div
          onClick={() => setCommentToDelete(null)}
          className="fixed inset-0 z-[130] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-rose-500/30 rounded-3xl p-6 flex flex-col items-center text-center text-slate-900 dark:text-white shadow-2xl cursor-default animate-in zoom-in-95 duration-200"
          >
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-500/40 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>

            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">Delete Comment?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              Are you sure you want to delete this comment? This action cannot be undone.
            </p>

            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                onClick={() => setCommentToDelete(null)}
                className="py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 font-bold text-xs text-slate-700 dark:text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteComment}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-xs text-white shadow-lg shadow-rose-600/30 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    {/* SAVED REELS GRID MODAL */}
      {showSavedModal && (
        <div data-saved-reels-modal="true" className="fixed inset-0 z-[110] bg-black/80 dark:bg-black/90 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
            <div className="flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-primary fill-primary/20" />
              <h3 className="font-bold text-sm text-white">Saved Reels</h3>
              <span className="text-[11px] font-semibold text-slate-400">({savedReels.length})</span>
            </div>
            <button
              onClick={() => setShowSavedModal(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {savedReels.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <Bookmark className="w-12 h-12 text-slate-600 mb-3" />
              <p className="font-semibold text-sm text-slate-300">No saved reels yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Tap the bookmark icon to save a reel you want to revisit later.
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2">
              <div className="grid grid-cols-3 gap-1.5">
                {savedReels.map((r) => (
                  <button
                    key={r.assigned_id}
                    onClick={() => handleOpenSavedReel(r.assigned_id)}
                    className="relative aspect-[3/4] rounded-xl overflow-hidden group active:scale-95 transition bg-slate-800"
                  >
                    <img
                      src={r.image_url}
                      alt={r.medical_topic}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onError={(e) => {
                        const img = e.currentTarget;
                      }}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-5 pb-1.5">
                      <p className="text-[9px] font-bold text-white leading-tight line-clamp-2">{r.medical_topic}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    {/* EARLY-YEAR MBBS CONTENT WARNING */}
      {showYearWarning && (
        <div
          onClick={() => setShowYearWarning(false)}
          className="fixed inset-0 z-[150] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-amber-500/30 rounded-3xl p-6 flex flex-col items-center text-center text-slate-900 dark:text-white shadow-2xl cursor-default animate-in zoom-in-95 duration-200"
          >
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-500/40 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>

            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">Content Warning</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
              We are still building algorithms and contents may not be appropriate for your year of study.
              Continue Anyway?
            </p>

            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                onClick={() => {
                  setShowYearWarning(false);
                  window.dispatchEvent(new CustomEvent('switch-dashboard-tab', { detail: 'home' }));
                }}
                className="py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 font-bold text-xs text-slate-700 dark:text-slate-300 transition"
              >
                Go Back
              </button>
              <button
                onClick={() => setShowYearWarning(false)}
                className="py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 font-bold text-xs text-white shadow-lg shadow-amber-500/30 transition"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
