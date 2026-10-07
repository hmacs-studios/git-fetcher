-- Make reference features unlimited across all plans in ai_feature_policies
UPDATE public.ai_feature_policies
SET
  enabled                 = true,
  daily_requests          = NULL,
  weekly_requests         = NULL,
  monthly_requests        = NULL,
  monthly_token_budget   = NULL,
  monthly_credit_budget  = NULL
WHERE feature IN ('reference', 'reference-verify', 'reference-summary', 'reference-explain')
  AND plan IN ('free', 'iconic', 'premium');
