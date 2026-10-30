create table if not exists public.resource_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  sector text not null default 'Otro',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resource_profiles_sector_idx on public.resource_profiles(sector);

create table if not exists public.resource_tools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  route text not null,
  icon_key text not null default 'wrench',
  label text not null default 'Disponible',
  published boolean not null default true,
  requires_auth boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.resource_tools (slug, title, description, route, icon_key, label, published, requires_auth, position)
values
  ('excel-a-sqlite', 'Excel o CSV a SQLite', 'Convierte hojas de cálculo en una base de datos .db. Cada pestaña se convierte en una tabla.', '/recursos/excel-a-sqlite', 'database', 'Disponible', true, true, 1),
  ('csv-formato-texto', 'Convertidor CSV Formato Tipo Texto', 'Exporta una hoja como CSV UTF-8, separado por comas y con todos los campos entre comillas.', '/recursos/csv-formato-texto', 'file-text', 'Disponible', true, true, 2)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  route = excluded.route,
  icon_key = excluded.icon_key,
  position = excluded.position,
  updated_at = now();

alter table public.resource_profiles enable row level security;
alter table public.resource_tools enable row level security;

grant select, insert, update on public.resource_profiles to authenticated;
grant select, insert, update, delete on public.resource_tools to authenticated;

drop policy if exists "Users read own resource profile" on public.resource_profiles;
create policy "Users read own resource profile" on public.resource_profiles
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users create own resource profile" on public.resource_profiles;
create policy "Users create own resource profile" on public.resource_profiles
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users update own resource profile" on public.resource_profiles;
create policy "Users update own resource profile" on public.resource_profiles
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users read published resource tools" on public.resource_tools;
create policy "Users read published resource tools" on public.resource_tools
for select to authenticated
using (
  published
  or (select auth.jwt())->'app_metadata'->>'role' = 'admin'
  or (select auth.jwt())->>'email' = 'joeltrincadov@gmail.com'
);

drop policy if exists "Admins insert resource tools" on public.resource_tools;
create policy "Admins insert resource tools" on public.resource_tools
for insert to authenticated
with check (
  (select auth.jwt())->'app_metadata'->>'role' = 'admin'
  or (select auth.jwt())->>'email' = 'joeltrincadov@gmail.com'
);

drop policy if exists "Admins update resource tools" on public.resource_tools;
create policy "Admins update resource tools" on public.resource_tools
for update to authenticated
using (
  (select auth.jwt())->'app_metadata'->>'role' = 'admin'
  or (select auth.jwt())->>'email' = 'joeltrincadov@gmail.com'
)
with check (
  (select auth.jwt())->'app_metadata'->>'role' = 'admin'
  or (select auth.jwt())->>'email' = 'joeltrincadov@gmail.com'
);

drop policy if exists "Admins delete resource tools" on public.resource_tools;
create policy "Admins delete resource tools" on public.resource_tools
for delete to authenticated
using (
  (select auth.jwt())->'app_metadata'->>'role' = 'admin'
  or (select auth.jwt())->>'email' = 'joeltrincadov@gmail.com'
);

alter table public.resource_tools replica identity full;
