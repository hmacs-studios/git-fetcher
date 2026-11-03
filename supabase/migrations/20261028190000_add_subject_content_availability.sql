-- Read-optimised subject availability.  The mobile directory reads these
-- counters in the same response as subjects; it never needs one chapter query
-- per subject merely to decide whether the card is selectable.
create table if not exists public.subject_content_availability (
  subject_id uuid primary key references public.subjects(id) on delete cascade,
  question_bank_chapter_count integer not null default 0 check (question_bank_chapter_count >= 0),
  past_paper_chapter_count integer not null default 0 check (past_paper_chapter_count >= 0),
  updated_at timestamptz not null default now()
);

insert into public.subject_content_availability (subject_id, question_bank_chapter_count, past_paper_chapter_count, updated_at)
select
  s.id,
  count(c.id) filter (where c.content_type is distinct from 'past_paper')::integer,
  count(c.id) filter (where c.content_type = 'past_paper')::integer,
  now()
from public.subjects s
left join public.chapters c on c.subject_id = s.id
group by s.id
on conflict (subject_id) do update set
  question_bank_chapter_count = excluded.question_bank_chapter_count,
  past_paper_chapter_count = excluded.past_paper_chapter_count,
  updated_at = excluded.updated_at;

create or replace function public.apply_subject_content_availability_delta(
  p_subject_id uuid,
  p_question_bank_delta integer,
  p_past_paper_delta integer
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.subject_content_availability as availability (
    subject_id, question_bank_chapter_count, past_paper_chapter_count, updated_at
  ) values (
    p_subject_id,
    greatest(p_question_bank_delta, 0),
    greatest(p_past_paper_delta, 0),
    now()
  )
  on conflict (subject_id) do update set
    question_bank_chapter_count = greatest(availability.question_bank_chapter_count + p_question_bank_delta, 0),
    past_paper_chapter_count = greatest(availability.past_paper_chapter_count + p_past_paper_delta, 0),
    updated_at = now();
$$;

create or replace function public.sync_subject_content_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.apply_subject_content_availability_delta(
      new.subject_id,
      case when new.content_type is distinct from 'past_paper' then 1 else 0 end,
      case when new.content_type = 'past_paper' then 1 else 0 end
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.apply_subject_content_availability_delta(
      old.subject_id,
      case when old.content_type is distinct from 'past_paper' then -1 else 0 end,
      case when old.content_type = 'past_paper' then -1 else 0 end
    );
    return old;
  end if;

  -- UPDATE can move a chapter between subjects and/or between content types.
  perform public.apply_subject_content_availability_delta(
    old.subject_id,
    case when old.content_type is distinct from 'past_paper' then -1 else 0 end,
    case when old.content_type = 'past_paper' then -1 else 0 end
  );
  perform public.apply_subject_content_availability_delta(
    new.subject_id,
    case when new.content_type is distinct from 'past_paper' then 1 else 0 end,
    case when new.content_type = 'past_paper' then 1 else 0 end
  );
  return new;
end;
$$;

drop trigger if exists chapters_sync_subject_content_availability on public.chapters;
create trigger chapters_sync_subject_content_availability
after insert or delete or update of subject_id, content_type on public.chapters
for each row execute function public.sync_subject_content_availability();

alter table public.subject_content_availability enable row level security;
grant select on public.subject_content_availability to authenticated;
drop policy if exists "Authenticated users can read subject availability" on public.subject_content_availability;
create policy "Authenticated users can read subject availability"
on public.subject_content_availability for select to authenticated using (true);
