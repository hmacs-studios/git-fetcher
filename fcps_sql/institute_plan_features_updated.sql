-- =============================================================================
-- MedMacs Cloud Access Control Matrix SQL
-- Features Included:
--   1. flps
--   2. mcqs
--   3. ospe
--   4. seqs
--   5. viva
--   6. ai_tutor
--   7. battle_mode
--   8. saved_questions
--   9. mistake_book
--  10. flashcards
--  11. ai_test_attempt
-- =============================================================================

-- 1. Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.institute_plan_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_code TEXT UNIQUE NOT NULL,
    features JSONB NOT NULL DEFAULT '{
      "flps":            { "free": true, "iconic": true, "premium": true },
      "mcqs":            { "free": true, "iconic": true, "premium": true },
      "ospe":            { "free": true, "iconic": true, "premium": true },
      "seqs":            { "free": true, "iconic": true, "premium": true },
      "viva":            { "free": true, "iconic": true, "premium": true },
      "ai_tutor":        { "free": true, "iconic": true, "premium": true },
      "battle_mode":     { "free": true, "iconic": true, "premium": true },
      "saved_questions": { "free": true, "iconic": true, "premium": true },
      "mistake_book":    { "free": true, "iconic": true, "premium": true },
      "flashcards":      { "free": true, "iconic": true, "premium": true },
      "ai_test_attempt": { "free": true, "iconic": true, "premium": true }
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS and public read policy
ALTER TABLE public.institute_plan_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access for institute_plan_features" ON public.institute_plan_features;

CREATE POLICY "Allow public read access for institute_plan_features"
ON public.institute_plan_features FOR SELECT
USING (true);

-- 3. Seed initial 'global' default row
INSERT INTO public.institute_plan_features (institute_code)
VALUES ('global')
ON CONFLICT (institute_code) DO NOTHING;

-- 4. Update existing rows in cloud DB to ensure the new feature keys exist
UPDATE public.institute_plan_features
SET features = features 
  || '{"mistake_book": {"free": true, "iconic": true, "premium": true}}'::jsonb
  || '{"flashcards": {"free": true, "iconic": true, "premium": true}}'::jsonb
  || '{"ai_test_attempt": {"free": true, "iconic": true, "premium": true}}'::jsonb
WHERE NOT (features ? 'mistake_book' AND features ? 'flashcards' AND features ? 'ai_test_attempt');
