-- ============================================================
-- Prime Store — نظام مفاتيح التفعيل (License) وملفات الإعدادات الجاهزة (Presets)
-- شغّل هذا مرة وحدة من: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

-- مفاتيح التفعيل للمنتجات/الباكجات
create table if not exists public.license_keys (
  id            uuid primary key default gen_random_uuid(),
  key_code      text unique not null,
  item_name     text not null,
  status        text not null default 'unused' check (status in ('unused','redeemed','revoked')),
  member_id     uuid references public.members(id) on delete set null,
  redeemed_at   timestamptz,
  created_at    timestamptz not null default now()
);
alter table public.license_keys enable row level security;
create index if not exists license_keys_status_idx on public.license_keys(status);

-- ملفات/إعدادات جاهزة للبوتات (Presets)
create table if not exists public.presets (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  category     text,
  file_url     text not null,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
alter table public.presets enable row level security;
-- بدون policies عامة — الوصول فقط عبر السيرفر (service_role) من خلال Netlify Functions.
