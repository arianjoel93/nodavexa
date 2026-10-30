alter table public.site_settings
  add column if not exists form_maintenance_mxn numeric(12,2) not null default 789,
  add column if not exists form_extra_changes_note text not null default 'Los cambios, nuevas secciones, integraciones o actualizaciones fuera del alcance aprobado se cotizan por separado.';

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

grant insert on public.project_requests to anon, authenticated;
grant select, update, delete on public.project_requests to authenticated;

create policy "Public submits project requests" on public.project_requests
for insert to anon, authenticated
with check (maintenance_ack = true and updates_ack = true);

create policy "Admins read project requests" on public.project_requests
for select to authenticated
using ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

create policy "Admins update project requests" on public.project_requests
for update to authenticated
using ((select auth.jwt())->'app_metadata'->>'role' = 'admin')
with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

create policy "Admins delete project requests" on public.project_requests
for delete to authenticated
using ((select auth.jwt())->'app_metadata'->>'role' = 'admin');
