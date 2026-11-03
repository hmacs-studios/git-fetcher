-- Retired team entries must not be displayed by the live Team page.
-- The page reads directly from public.team_members, so remove the legacy
-- seeded records rather than hiding them in the client.
delete from public.team_members
where name = 'Faiqa Ahmed'
  and role = 'Campus Ambassador - JSMU';
