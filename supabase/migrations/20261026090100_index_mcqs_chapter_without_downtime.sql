-- Intentionally kept as a single top-level statement so PostgreSQL can build
-- the large content index without blocking normal reads or writes.
create index concurrently if not exists mcqs_chapter_id_content_idx
  on public.mcqs (chapter_id);
