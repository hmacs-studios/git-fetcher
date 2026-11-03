insert into public.app_config (key, value)
values (
  'dr_ahroid_rotating_messages',
  '["Dr Ahroid is the only AI in Pakistan trained on actual medical books.","Dr Ahroid is trained on actual medical books.","Get clear explanations for difficult medical concepts with Dr Ahroid.","Revise smarter with an AI study companion built for medical students."]'
)
on conflict (key) do nothing;
