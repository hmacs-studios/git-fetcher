-- Create discover_reel_interactions table for logging quiz answers and reactions
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

-- Enable RLS
ALTER TABLE public.discover_reel_interactions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read and insert their own interactions
CREATE POLICY "Users can insert their own discover interactions"
ON public.discover_reel_interactions FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can view discover interactions"
ON public.discover_reel_interactions FOR SELECT
USING (true);
