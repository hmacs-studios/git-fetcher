-- ============================================================================
-- Cloud-Controlled Feature & Plan Access Control Matrix Schema
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.institute_plan_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_code TEXT UNIQUE NOT NULL, -- 'global' for global default, or specific institute code (e.g. 'aimc', 'kemu', 'fcps_part_1')
    features JSONB NOT NULL DEFAULT '{
      "mcqs":            { "free": true, "iconic": true, "premium": true },
      "saved_questions": { "free": true, "iconic": true, "premium": true },
      "viva":            { "free": true, "iconic": true, "premium": true },
      "flps":            { "free": true, "iconic": true, "premium": true },
      "battle_mode":     { "free": true, "iconic": true, "premium": true },
      "seqs":            { "free": true, "iconic": true, "premium": true },
      "ospe":            { "free": true, "iconic": true, "premium": true },
      "ai_tutor":        { "free": true, "iconic": true, "premium": true }
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.institute_plan_features ENABLE ROW LEVEL SECURITY;

-- Allow public read access to feature plan matrix
CREATE POLICY "Allow public read access to institute plan features"
    ON public.institute_plan_features FOR SELECT USING (true);

-- Seed Initial Global Default Row (All features enabled by default)
INSERT INTO public.institute_plan_features (institute_code)
VALUES ('global')
ON CONFLICT (institute_code) DO NOTHING;
