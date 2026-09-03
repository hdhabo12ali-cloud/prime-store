-- ============================================================
-- Prime Store — نظام "بروفايل" عام لكل الزوار (Discord / Google)
-- شغّل هذا مرة وحدة من: Supabase Dashboard -> SQL Editor -> New query
-- (منفصل تمامًا عن جدول أدمن لوحة التحكم)
-- ============================================================

create table if not exists public.members (
  id             uuid primary key default gen_random_uuid(),
  provider       text not null,          -- 'discord' | 'google'
  provider_id    text not null,          -- المعرف من نفس المزوّد
  email          text,
  username       text,
  avatar_url     text,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz not null default now(),
  unique (provider, provider_id)
);
alter table public.members enable row level security;
-- بدون policies عامة — الوصول فقط عبر السيرفر (service_role) من خلال Netlify Functions.
