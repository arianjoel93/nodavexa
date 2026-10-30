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
  software_pricing_model text not null default 'total_maintenance',
  initial_price_mxn numeric(12,2) not null default 0,
  annual_maintenance_price_mxn numeric(12,2) not null default 0,
  sat_withholdings_enabled boolean not null default false,
  isr_withholding_rate numeric(6,3) not null default 0,
  vat_withholding_rate numeric(6,3) not null default 0,
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
alter table public.solutions add column if not exists software_pricing_model text not null default 'total_maintenance';
alter table public.solutions add column if not exists initial_price_mxn numeric(12,2) not null default 0;
alter table public.solutions add column if not exists annual_maintenance_price_mxn numeric(12,2) not null default 0;
alter table public.solutions add column if not exists sat_withholdings_enabled boolean not null default false;
alter table public.solutions add column if not exists isr_withholding_rate numeric(6,3) not null default 0;
alter table public.solutions add column if not exists vat_withholding_rate numeric(6,3) not null default 0;
alter table public.solutions drop constraint if exists solutions_sat_rates_valid;
alter table public.solutions add constraint solutions_sat_rates_valid check (isr_withholding_rate between 0 and 100 and vat_withholding_rate between 0 and 100 and isr_withholding_rate + vat_withholding_rate < 100);
alter table public.solutions drop constraint if exists solutions_software_pricing_model_valid;
alter table public.solutions add constraint solutions_software_pricing_model_valid check (software_pricing_model in ('deposit_monthly','total_maintenance'));
alter table public.solutions drop constraint if exists solutions_software_prices_nonnegative;
alter table public.solutions add constraint solutions_software_prices_nonnegative check (initial_price_mxn >= 0 and annual_maintenance_price_mxn >= 0);
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

create table if not exists public.success_case_videos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  video_url text not null,
  youtube_id text not null,
  description text not null default '',
  position integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists solutions_published_created_idx on public.solutions(published, created_at desc);
create index if not exists equipment_solution_idx on public.equipment(solution_id);
create index if not exists documents_solution_idx on public.documents(solution_id);
create index if not exists success_case_videos_published_position_idx on public.success_case_videos(published, position, created_at desc);

alter table public.solutions enable row level security;
alter table public.equipment enable row level security;
alter table public.documents enable row level security;
alter table public.contact_messages enable row level security;
alter table public.success_case_videos enable row level security;

grant select on public.solutions, public.equipment, public.documents to anon, authenticated;
grant insert, update, delete on public.solutions, public.equipment, public.documents to authenticated;
grant select, update on public.contact_messages to authenticated;
grant select on public.success_case_videos to anon, authenticated;
grant insert, update, delete on public.success_case_videos to authenticated;

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

create policy "Public reads published success case videos" on public.success_case_videos for select to anon, authenticated
using (published or (select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins insert success case videos" on public.success_case_videos for insert to authenticated
with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins update success case videos" on public.success_case_videos for update to authenticated
using ((select auth.jwt())->'app_metadata'->>'role' = 'admin')
with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins delete success case videos" on public.success_case_videos for delete to authenticated
using ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

insert into public.success_case_videos (slug, title, video_url, youtube_id, description, position, published)
values
  ('software-para-control-de-exportaciones','Software para control de exportaciones','https://youtube.com/shorts/uhbGHaKrOGc?si=coqEImA9YopQG6Wd','uhbGHaKrOGc','Caso en video sobre software para controlar y organizar procesos de exportación.',1,true),
  ('verificador-de-precios','Verificador de precios','https://youtube.com/shorts/PxC8HnzTb48?si=qylzcHDeO0QS-fRC','PxC8HnzTb48','Caso en video de una herramienta para consulta y verificación de precios.',2,true),
  ('control-de-inventarios','Control de inventarios','https://youtube.com/shorts/ozsz3vmR4Y4?si=c1eNz6bo38GHiLGP','ozsz3vmR4Y4','Caso en video enfocado en control operativo de inventarios.',3,true)
on conflict (slug) do update set
  title = excluded.title,
  video_url = excluded.video_url,
  youtube_id = excluded.youtube_id,
  description = excluded.description,
  position = excluded.position,
  published = excluded.published,
  updated_at = now();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('solution-assets','solution-assets',true,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=true, file_size_limit=10485760, allowed_mime_types=excluded.allowed_mime_types;

-- Public buckets serve known object URLs without a SELECT policy; omitting it prevents file listing.
create policy "Admins upload solution assets" on storage.objects for insert to authenticated with check (bucket_id='solution-assets' and (select auth.jwt()->'app_metadata'->>'role')='admin');
create policy "Admins update solution assets" on storage.objects for update to authenticated using (bucket_id='solution-assets' and (select auth.jwt()->'app_metadata'->>'role')='admin') with check (bucket_id='solution-assets' and (select auth.jwt()->'app_metadata'->>'role')='admin');
create policy "Admins delete solution assets" on storage.objects for delete to authenticated using (bucket_id='solution-assets' and (select auth.jwt()->'app_metadata'->>'role')='admin');

create table if not exists public.site_settings (
  id boolean primary key default true check (id),
  whatsapp text not null default '523338419644',
  email text not null default 'soporte@nodavexa.com',
  address text not null default 'Atención en todo México',
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (true) on conflict (id) do nothing;
alter table public.site_settings add column if not exists form_maintenance_mxn numeric(12,2) not null default 789;
alter table public.site_settings add column if not exists form_extra_changes_note text not null default 'Los cambios, nuevas secciones, integraciones o actualizaciones fuera del alcance aprobado se cotizan por separado.';
alter table public.site_settings add column if not exists form_landing_quote_min_mxn numeric(12,2) not null default 12000;
alter table public.site_settings add column if not exists form_landing_quote_max_mxn numeric(12,2) not null default 28000;
alter table public.site_settings add column if not exists homepage_hero_slides jsonb not null default '[{"image_url":"https://images.pexels.com/photos/4483942/pexels-photo-4483942.jpeg?auto=compress&cs=tinysrgb&w=2000","alt":"Personal de almacén escanea productos para registrar movimientos de inventario"},{"image_url":"https://images.pexels.com/photos/38136632/pexels-photo-38136632.jpeg?auto=compress&cs=tinysrgb&w=2000","alt":"Personal consulta existencias en una tableta dentro del almacén"},{"image_url":"https://images.pexels.com/photos/30625284/pexels-photo-30625284.jpeg?auto=compress&cs=tinysrgb&w=2000","alt":"Pasillos y estanterías con productos organizados en un almacén"}]'::jsonb;
alter table public.site_settings enable row level security;
grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;
drop policy if exists "Public reads site settings" on public.site_settings;
drop policy if exists "Admins update site settings" on public.site_settings;
create policy "Public reads site settings" on public.site_settings for select to anon, authenticated using (true);
create policy "Admins update site settings" on public.site_settings for update to authenticated
using ((select auth.jwt())->'app_metadata'->>'role' = 'admin')
with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

create table if not exists public.project_requests (
  id uuid primary key default gen_random_uuid(),
  form_slug text not null default 'proyecto',
  status text not null default 'new' check (status in ('new','reviewing','quoted','sent','archived')),
  service_type text not null check (service_type in ('landing_page','website','web_app','installable_software')),
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text not null default '',
  country text not null default '',
  company_website text not null default '',
  company_description text not null default '',
  project_goal text not null default '',
  target_audience text not null default '',
  references_text text not null default '',
  brand_assets text not null default '',
  content_status text not null default '',
  sections_needed text[] not null default '{}',
  features_needed text[] not null default '{}',
  integrations_needed text[] not null default '{}',
  pages_count integer not null default 1,
  deadline text not null default '',
  budget_range text not null default '',
  technical_notes text not null default '',
  maintenance_ack boolean not null default false,
  updates_ack boolean not null default false,
  annual_maintenance_mxn numeric(12,2) not null default 789,
  quote jsonb,
  quoted_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_requests_status_created_idx on public.project_requests(status, created_at desc);
create index if not exists project_requests_service_created_idx on public.project_requests(service_type, created_at desc);
alter table public.project_requests enable row level security;
alter table public.project_requests replica identity full;
grant insert on public.project_requests to anon, authenticated;
grant select, update, delete on public.project_requests to authenticated;
drop policy if exists "Public submits project requests" on public.project_requests;
drop policy if exists "Admins read project requests" on public.project_requests;
drop policy if exists "Admins update project requests" on public.project_requests;
drop policy if exists "Admins delete project requests" on public.project_requests;
create policy "Public submits project requests" on public.project_requests for insert to anon, authenticated
with check (maintenance_ack = true and updates_ack = true);
create policy "Admins read project requests" on public.project_requests for select to authenticated
using ((select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins update project requests" on public.project_requests for update to authenticated
using ((select auth.jwt())->'app_metadata'->>'role' = 'admin')
with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins delete project requests" on public.project_requests for delete to authenticated
using ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'project_requests'
  ) then
    alter publication supabase_realtime add table public.project_requests;
  end if;
end $$;
