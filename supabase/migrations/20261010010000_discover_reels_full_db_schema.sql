-- Migration: Discover Reels Full PostgreSQL Data Model
-- Includes Likes, Comments, Comment Reactions, Comment Replies, and Reel Reports

-- 1. REEL LIKES TABLE
CREATE TABLE IF NOT EXISTS public.discover_reel_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    reel_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, reel_id)
);

ALTER TABLE public.discover_reel_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own reel likes"
ON public.discover_reel_likes FOR ALL
USING (auth.uid() = user_id OR auth.uid() IS NULL)
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Anyone can view reel likes count"
ON public.discover_reel_likes FOR SELECT
USING (true);

-- 2. REEL COMMENTS TABLE (Supports nested parent_comment_id for replies)
CREATE TABLE IF NOT EXISTS public.discover_reel_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    reel_id TEXT NOT NULL,
    parent_comment_id UUID REFERENCES public.discover_reel_comments(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    user_role TEXT DEFAULT 'Medical Student',
    avatar_url TEXT,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.discover_reel_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert discover comments"
ON public.discover_reel_comments FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Anyone can view discover comments"
ON public.discover_reel_comments FOR SELECT
USING (true);

CREATE POLICY "Users can delete their own discover comments"
ON public.discover_reel_comments FOR DELETE
USING (auth.uid() = user_id);

-- 3. REEL COMMENT REACTIONS TABLE (Likes on individual comments/replies)
CREATE TABLE IF NOT EXISTS public.discover_comment_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    comment_id UUID REFERENCES public.discover_reel_comments(id) ON DELETE CASCADE NOT NULL,
    reaction_type TEXT DEFAULT 'like',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, comment_id)
);

ALTER TABLE public.discover_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their comment reactions"
ON public.discover_comment_reactions FOR ALL
USING (auth.uid() = user_id OR auth.uid() IS NULL)
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Anyone can view comment reactions"
ON public.discover_comment_reactions FOR SELECT
USING (true);

-- 4. REEL REPORTS TABLE (Moderation & Flagging)
CREATE TABLE IF NOT EXISTS public.discover_reel_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reel_id TEXT NOT NULL,
    report_reason TEXT NOT NULL,
    additional_notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.discover_reel_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit reel reports"
ON public.discover_reel_reports FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Anyone can view reel reports"
ON public.discover_reel_reports FOR SELECT
USING (true);

-- Indexes for high performance querying
CREATE INDEX IF NOT EXISTS idx_discover_reel_likes_reel_id ON public.discover_reel_likes(reel_id);
CREATE INDEX IF NOT EXISTS idx_discover_reel_comments_reel_id ON public.discover_reel_comments(reel_id);
CREATE INDEX IF NOT EXISTS idx_discover_reel_comments_parent ON public.discover_reel_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_discover_comment_reactions_comment ON public.discover_comment_reactions(comment_id);
