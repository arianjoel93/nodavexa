alter table public.solutions
  add column if not exists item_type text not null default 'solution',
  add column if not exists has_vat boolean not null default true,
  add column if not exists payment_type text not null default 'one_time';

alter table public.solutions drop constraint if exists solutions_item_type_valid;
alter table public.solutions add constraint solutions_item_type_valid check (item_type in ('solution','product'));
alter table public.solutions drop constraint if exists solutions_payment_type_valid;
alter table public.solutions add constraint solutions_payment_type_valid check (payment_type in ('one_time','monthly'));

create table if not exists public.site_settings (
  id boolean primary key default true check (id),
  whatsapp text not null default '523338419644',
  email text not null default 'soporte@nodavexa.com',
  address text not null default 'Atención en todo México',
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.success_cases (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  client_type text not null default '',
  problem text not null default '',
  result text not null default '',
  description text not null default '',
  cover_url text not null default '',
  cover_file_path text,
  featured boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists success_cases_published_created_idx on public.success_cases(published, created_at desc);

alter table public.site_settings enable row level security;
alter table public.success_cases enable row level security;

grant select on public.site_settings, public.success_cases to anon, authenticated;
grant update on public.site_settings to authenticated;
grant insert, update, delete on public.success_cases to authenticated;

create policy "Public reads site settings" on public.site_settings for select to anon, authenticated using (true);
create policy "Admins update site settings" on public.site_settings for update to authenticated
using ((select auth.jwt())->'app_metadata'->>'role'='admin')
with check ((select auth.jwt())->'app_metadata'->>'role'='admin');

create policy "Public reads published success cases" on public.success_cases for select to anon, authenticated
using (published or (select auth.jwt())->'app_metadata'->>'role'='admin');
create policy "Admins insert success cases" on public.success_cases for insert to authenticated
with check ((select auth.jwt())->'app_metadata'->>'role'='admin');
create policy "Admins update success cases" on public.success_cases for update to authenticated
using ((select auth.jwt())->'app_metadata'->>'role'='admin')
with check ((select auth.jwt())->'app_metadata'->>'role'='admin');
create policy "Admins delete success cases" on public.success_cases for delete to authenticated
using ((select auth.jwt())->'app_metadata'->>'role'='admin');
