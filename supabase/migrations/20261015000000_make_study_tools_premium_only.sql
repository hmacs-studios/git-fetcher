-- Restrict Mistake Book, Flashcards, and AI Test Attempts to Premium users.
-- Apply this to every institute matrix so institute-specific rows cannot
-- accidentally retain the previous Free or Iconic access.
UPDATE public.institute_plan_features
SET
  features = jsonb_set(
    jsonb_set(
      jsonb_set(
        features,
        '{mistake_book}',
        '{"free": false, "iconic": false, "premium": true}'::jsonb,
        true
      ),
      '{flashcards}',
      '{"free": false, "iconic": false, "premium": true}'::jsonb,
      true
    ),
    '{ai_test_attempt}',
    '{"free": false, "iconic": false, "premium": true}'::jsonb,
    true
  ),
  updated_at = NOW();
