-- Migration: Create discover_reel_views and discover_reel_interactions tables
-- Supports tracking dwell watch time, interaction telemetry, and ad analytics

CREATE TABLE IF NOT EXISTS public.discover_reel_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reel_id TEXT NOT NULL,
    watch_time_seconds NUMERIC(10, 2) DEFAULT 0,
    is_interacted BOOLEAN DEFAULT FALSE,
    interaction_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.discover_reel_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can insert their own discover reel views"
ON public.discover_reel_views FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can view discover reel views"
ON public.discover_reel_views FOR SELECT
USING (true);

-- Ensure discover_reel_interactions table exists with full schema
CREATE TABLE IF NOT EXISTS public.discover_reel_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    reel_id TEXT NOT NULL,
    selected_option TEXT,
    is_correct BOOLEAN,
    reaction_type TEXT,
    watch_time_seconds NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.discover_reel_interactions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'discover_reel_interactions' AND policyname = 'Users can insert their own discover interactions'
    ) THEN
        CREATE POLICY "Users can insert their own discover interactions"
        ON public.discover_reel_interactions FOR INSERT
        WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'discover_reel_interactions' AND policyname = 'Users can view discover interactions'
    ) THEN
        CREATE POLICY "Users can view discover interactions"
        ON public.discover_reel_interactions FOR SELECT
        USING (true);
    END IF;
END $$;
