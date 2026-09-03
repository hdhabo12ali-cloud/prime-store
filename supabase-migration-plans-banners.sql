-- ============================================================
-- Prime Store — إضافة جداول "الخطط (Plans)" و"الشعارات (Banners)"
-- شغّل هذا الملف كامل مرة وحدة من: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

-- 1) جدول الخطط (Plans) — 3 باقات اشتراك بأسعار
create table if not exists public.plans (
  id           text primary key,
  name         text not null,
  price        text not null,
  period       text not null default '/mo',
  tagline      text,
  features     jsonb not null default '[]'::jsonb,
  badge        text,
  featured     boolean not null default false,
  cta_url      text,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.plans enable row level security;

-- 2) جدول الشعارات/البنرات (Banners)
create table if not exists public.banners (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  image_url    text not null,
  link_url     text,
  active       boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
alter table public.banners enable row level security;

-- 3) بيانات مبدئية لـ 3 خطط (عدّلها بعدين من لوحة التحكم -> الخطط)
insert into public.plans (id, name, price, period, tagline, features, badge, featured, sort_order)
values
  ('basic',   'Basic',   '$9',  '/mo', 'يناسب البداية',        '["دعم عبر Discord","تحديثات أساسية","باكج واحد نشط"]'::jsonb, null,          false, 1),
  ('pro',     'Pro',     '$29', '/mo', 'الأكثر طلبًا',          '["كل مزايا Basic","أولوية بالدعم","كل الباكجات مفتوحة","مفتاح API"]'::jsonb, 'الأكثر طلبًا', true,  2),
  ('elite',   'Elite',   '$79', '/mo', 'للفرق والمشاريع الكبيرة','["كل مزايا Pro","أداة بناء الموقع بدون كود","دعم مخصص 1-on-1","صفحة API كاملة"]'::jsonb, null,          false, 3)
on conflict (id) do nothing;

-- ملاحظة: الجداول ما فيها policies عامة عشان الوصول يكون فقط عبر السيرفر
-- (service_role key) من خلال Netlify Functions — نفس أسلوب باقي جداول المشروع.
