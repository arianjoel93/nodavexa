-- Nodavexa: ejecutar una vez en Supabase SQL Editor.
-- Después, asigna el rol al usuario administrador desde SQL Editor:
-- update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb where email = 'TU_CORREO';

create extension if not exists pgcrypto;

create table if not exists public.solutions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  excerpt text not null default '',
  description text not null default '',
  category text not null default 'Automatización',
  cover_url text not null default '',
  cover_file_path text,
  video_url text,
  website_url text,
  seo_keywords text[] not null default '{}',
  seo_description text not null default '',
  base_price_mxn numeric(12,2) not null default 0,
  vat_rate numeric(5,2) not null default 16,
  quote_enabled boolean not null default false,
  shipping_weight_kg numeric(10,3) not null default 0,
  shipping_length_cm numeric(10,2) not null default 0,
  shipping_width_cm numeric(10,2) not null default 0,
  shipping_height_cm numeric(10,2) not null default 0,
  featured boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.solutions add column if not exists cover_file_path text;
alter table public.solutions add column if not exists website_url text;
alter table public.solutions drop constraint if exists solutions_seo_keywords_max_three;
alter table public.solutions add constraint solutions_seo_keywords_max_three check (cardinality(seo_keywords) <= 3);
alter table public.solutions drop constraint if exists solutions_pricing_shipping_valid;
alter table public.solutions add constraint solutions_pricing_shipping_valid check (base_price_mxn >= 0 and vat_rate between 0 and 100 and shipping_weight_kg >= 0 and shipping_length_cm >= 0 and shipping_width_cm >= 0 and shipping_height_cm >= 0);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  solution_id uuid not null references public.solutions(id) on delete cascade,
  name text not null,
  weight text not null default '',
  length text not null default '',
  width text not null default '',
  height text not null default '',
  position integer not null default 0
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  solution_id uuid not null references public.solutions(id) on delete cascade,
  name text not null,
  url text not null,
  file_path text,
  kind text not null check (kind in ('datasheet','manual')),
  position integer not null default 0
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(), name text not null, company text not null default '',
  email text not null, phone text not null default '', message text not null,
  status text not null default 'new' check(status in ('new','read','replied','archived')),
  created_at timestamptz not null default now()
);

create index if not exists solutions_published_created_idx on public.solutions(published, created_at desc);
create index if not exists equipment_solution_idx on public.equipment(solution_id);
create index if not exists documents_solution_idx on public.documents(solution_id);

alter table public.solutions enable row level security;
alter table public.equipment enable row level security;
alter table public.documents enable row level security;
alter table public.contact_messages enable row level security;

grant select on public.solutions, public.equipment, public.documents to anon, authenticated;
grant insert, update, delete on public.solutions, public.equipment, public.documents to authenticated;
grant select, update on public.contact_messages to authenticated;

create policy "Admins read contact messages" on public.contact_messages for select to authenticated using ((select auth.jwt())->'app_metadata'->>'role'='admin');
create policy "Admins update contact messages" on public.contact_messages for update to authenticated using ((select auth.jwt())->'app_metadata'->>'role'='admin') with check ((select auth.jwt())->'app_metadata'->>'role'='admin');

create policy "Public reads published solutions" on public.solutions for select to anon, authenticated
using (published or (select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins insert solutions" on public.solutions for insert to authenticated
with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins update solutions" on public.solutions for update to authenticated
using ((select auth.jwt())->'app_metadata'->>'role' = 'admin')
with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins delete solutions" on public.solutions for delete to authenticated
using ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

create policy "Public reads equipment for published solution" on public.equipment for select to anon, authenticated
using (exists (select 1 from public.solutions s where s.id = solution_id and (s.published or (select auth.jwt())->'app_metadata'->>'role' = 'admin')));
create policy "Admins insert equipment" on public.equipment for insert to authenticated with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Admins update equipment" on public.equipment for update to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Admins delete equipment" on public.equipment for delete to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "Public reads documents for published solution" on public.documents for select to anon, authenticated
using (exists (select 1 from public.solutions s where s.id = solution_id and (s.published or (select auth.jwt()->'app_metadata'->>'role') = 'admin')));
create policy "Admins insert documents" on public.documents for insert to authenticated with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Admins update documents" on public.documents for update to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "Admins delete documents" on public.documents for delete to authenticated using ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('solution-assets','solution-assets',true,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=true, file_size_limit=10485760, allowed_mime_types=excluded.allowed_mime_types;

-- Public buckets serve known object URLs without a SELECT policy; omitting it prevents file listing.
create policy "Admins upload solution assets" on storage.objects for insert to authenticated with check (bucket_id='solution-assets' and (select auth.jwt()->'app_metadata'->>'role')='admin');
create policy "Admins update solution assets" on storage.objects for update to authenticated using (bucket_id='solution-assets' and (select auth.jwt()->'app_metadata'->>'role')='admin') with check (bucket_id='solution-assets' and (select auth.jwt()->'app_metadata'->>'role')='admin');
create policy "Admins delete solution assets" on storage.objects for delete to authenticated using (bucket_id='solution-assets' and (select auth.jwt()->'app_metadata'->>'role')='admin');
