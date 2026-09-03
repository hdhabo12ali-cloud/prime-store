-- ============================================================
-- Prime Store — صفحة عرض مشاريع الأعضاء
-- شغّل هذا مرة وحدة من: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

create table if not exists public.member_projects (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  title        text not null,
  description  text,
  image_url    text,
  link_url     text,
  created_at   timestamptz not null default now()
);
alter table public.member_projects enable row level security;
create index if not exists member_projects_member_id_idx on public.member_projects(member_id);
-- بدون policies عامة — الوصول فقط عبر السيرفر (service_role) من خلال Netlify Functions.
