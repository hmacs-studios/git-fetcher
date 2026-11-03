-- Live post-deployment assertion for the FCPS-1 Medicine & Allied directory.
do $$
declare
  v_subject_count integer;
  v_chapter_count integer;
begin
  select count(distinct s.id), count(c.id)
  into v_subject_count, v_chapter_count
  from public.subjects s
  left join public.chapters c on c.subject_id = s.id
  where s.year = 'medicine_allied'
    and s.institutes = to_jsonb(array['fcps_part_1']::text[]);

  if v_subject_count <> 13 or v_chapter_count <> 117 then
    raise exception
      'FCPS Medicine & Allied verification failed: subjects=%, chapters=% (expected 13/117)',
      v_subject_count,
      v_chapter_count;
  end if;
end $$;
