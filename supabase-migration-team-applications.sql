-- ============================================================
-- Prime Store — نظام تقديمات الفرق (Bot Developer, Designer...)
-- شغّل هذا مرة وحدة من: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

create table if not exists public.team_applications (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null references public.members(id) on delete cascade,
  team          text not null check (team in ('bot_developer','bot_team','designer_team','marketing_team','website_team')),
  message       text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   text
);
alter table public.team_applications enable row level security;
create index if not exists team_applications_member_id_idx on public.team_applications(member_id);
create index if not exists team_applications_status_idx on public.team_applications(status);
-- بدون policies عامة — الوصول فقط عبر السيرفر (service_role) من خلال Netlify Functions.
