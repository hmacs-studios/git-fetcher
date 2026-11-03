insert into public.app_settings (setting_name, setting_value)
values (
  'seq_beta_banner',
  '{
    "enabled": true,
    "version": "2026-10-29",
    "message": "Short Questions is currently in beta. Your feedback helps us improve the experience.",
    "report_label": "Report an issue"
  }'
)
on conflict (setting_name) do update
set setting_value = excluded.setting_value;
