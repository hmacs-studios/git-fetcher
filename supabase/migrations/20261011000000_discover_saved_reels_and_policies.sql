-- Saved reels (bookmarks) + missing policies for the discover reels store.
-- Applied to the self-hosted reels Supabase (separate from the app Supabase).

CREATE TABLE IF NOT EXISTS public.discover_saved_reels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    reel_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, reel_id)
);

ALTER TABLE public.discover_saved_reels ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'discover_saved_reels' AND policyname = 'discover_anon_select_saved') THEN
        CREATE POLICY "discover_anon_select_saved"
        ON public.discover_saved_reels FOR SELECT
        USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'discover_saved_reels' AND policyname = 'discover_anon_manage_saved') THEN
        CREATE POLICY "discover_anon_manage_saved"
        ON public.discover_saved_reels FOR ALL
        USING (auth.uid() IS NULL OR auth.uid()::text = user_id)
        WITH CHECK (auth.uid() IS NULL OR auth.uid()::text = user_id);
    END IF;

    -- Comments previously had no UPDATE policy, so edits were silently rejected.
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'discover_reel_comments' AND policyname = 'discover_anon_update') THEN
        CREATE POLICY "discover_anon_update"
        ON public.discover_reel_comments FOR UPDATE
        USING (auth.uid() IS NULL OR auth.uid()::text = user_id)
        WITH CHECK (auth.uid() IS NULL OR auth.uid()::text = user_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saved_reels_reel ON public.discover_saved_reels(reel_id);
CREATE INDEX IF NOT EXISTS idx_saved_reels_user ON public.discover_saved_reels(user_id);
