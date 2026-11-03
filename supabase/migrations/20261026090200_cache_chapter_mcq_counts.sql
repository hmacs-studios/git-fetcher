alter table public.chapters
  add column if not exists mcq_count integer not null default 0;

with counts as (
  select chapter_id, count(*)::integer as total
  from public.mcqs
  group by chapter_id
)
update public.chapters chapter
set mcq_count = counts.total
from counts
where counts.chapter_id = chapter.id
  and chapter.mcq_count is distinct from counts.total;

update public.chapters chapter
set mcq_count = 0
where chapter.mcq_count <> 0
  and not exists (
    select 1 from public.mcqs mcq where mcq.chapter_id = chapter.id
  );

create or replace function public.sync_chapter_mcq_count()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.chapters set mcq_count = mcq_count + 1 where id = new.chapter_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.chapters set mcq_count = greatest(mcq_count - 1, 0) where id = old.chapter_id;
    return old;
  end if;

  if old.chapter_id is distinct from new.chapter_id then
    update public.chapters set mcq_count = greatest(mcq_count - 1, 0) where id = old.chapter_id;
    update public.chapters set mcq_count = mcq_count + 1 where id = new.chapter_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_chapter_mcq_count_after_change on public.mcqs;
create trigger sync_chapter_mcq_count_after_change
after insert or delete or update of chapter_id on public.mcqs
for each row execute function public.sync_chapter_mcq_count();
