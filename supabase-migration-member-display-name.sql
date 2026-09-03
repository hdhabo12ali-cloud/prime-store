-- ============================================================
-- Prime Store — إضافة اسم عرض قابل للتعديل للأعضاء
-- شغّل هذا مرة وحدة من: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================
alter table public.members add column if not exists display_name text;
