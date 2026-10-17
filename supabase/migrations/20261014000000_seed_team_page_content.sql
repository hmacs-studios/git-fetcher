insert into public.app_settings (setting_name, setting_value)
values (
  'team_page_content',
  '{
    "founder_biography": "I am Dr. Muhammad Ameer Hamza, the founder of Medmacs. I created Medmacs to make medical learning more practical, focused, and accessible for students. I am building it around the way we actually study: with useful tools, clear explanations, and a community that keeps improving the experience together.",
    "founder_linkedin": "https://www.linkedin.com/in/dr-ameerhamza/",
    "founder_instagram": "https://www.instagram.com/ameerhamza.exe/"
  }'
)
on conflict (setting_name) do update
set setting_value = excluded.setting_value;
