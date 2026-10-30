alter table public.resource_activity
  add column if not exists country_code text not null default '',
  add column if not exists country_name text not null default '',
  add column if not exists region text not null default '',
  add column if not exists city text not null default '',
  add column if not exists timezone text not null default '',
  add column if not exists locale text not null default '',
  add column if not exists device_type text not null default '',
  add column if not exists browser text not null default '',
  add column if not exists operating_system text not null default '',
  add column if not exists user_agent text not null default '',
  add column if not exists session_id text not null default '';

create index if not exists resource_activity_created_idx
  on public.resource_activity(created_at desc);

create index if not exists resource_activity_tool_created_idx
  on public.resource_activity(tool_slug, created_at desc);

create index if not exists resource_activity_country_created_idx
  on public.resource_activity(country_code, created_at desc)
  where country_code <> '';

drop policy if exists "Admins read resource profiles" on public.resource_profiles;
create policy "Admins read resource profiles" on public.resource_profiles
for select to authenticated
using (
  (select auth.jwt())->'app_metadata'->>'role' in ('admin', 'superadmin')
  or lower(coalesce((select auth.jwt())->>'email', '')) in ('soporte@nodavexa.com', 'joeltrincadov@gmail.com')
);

drop policy if exists "Users read published resource tools" on public.resource_tools;
create policy "Users read published resource tools" on public.resource_tools
for select to authenticated
using (
  published
  or (select auth.jwt())->'app_metadata'->>'role' in ('admin', 'superadmin')
  or lower(coalesce((select auth.jwt())->>'email', '')) in ('soporte@nodavexa.com', 'joeltrincadov@gmail.com')
);

drop policy if exists "Admins insert resource tools" on public.resource_tools;
create policy "Admins insert resource tools" on public.resource_tools
for insert to authenticated
with check (
  (select auth.jwt())->'app_metadata'->>'role' in ('admin', 'superadmin')
  or lower(coalesce((select auth.jwt())->>'email', '')) in ('soporte@nodavexa.com', 'joeltrincadov@gmail.com')
);

drop policy if exists "Admins update resource tools" on public.resource_tools;
create policy "Admins update resource tools" on public.resource_tools
for update to authenticated
using (
  (select auth.jwt())->'app_metadata'->>'role' in ('admin', 'superadmin')
  or lower(coalesce((select auth.jwt())->>'email', '')) in ('soporte@nodavexa.com', 'joeltrincadov@gmail.com')
)
with check (
  (select auth.jwt())->'app_metadata'->>'role' in ('admin', 'superadmin')
  or lower(coalesce((select auth.jwt())->>'email', '')) in ('soporte@nodavexa.com', 'joeltrincadov@gmail.com')
);

drop policy if exists "Admins delete resource tools" on public.resource_tools;
create policy "Admins delete resource tools" on public.resource_tools
for delete to authenticated
using (
  (select auth.jwt())->'app_metadata'->>'role' in ('admin', 'superadmin')
  or lower(coalesce((select auth.jwt())->>'email', '')) in ('soporte@nodavexa.com', 'joeltrincadov@gmail.com')
);

drop policy if exists "Admins read resource installations" on public.resource_user_tools;
create policy "Admins read resource installations" on public.resource_user_tools
for select to authenticated
using (
  (select auth.jwt())->'app_metadata'->>'role' in ('admin', 'superadmin')
  or lower(coalesce((select auth.jwt())->>'email', '')) in ('soporte@nodavexa.com', 'joeltrincadov@gmail.com')
);

drop policy if exists "Admins read resource activity" on public.resource_activity;
create policy "Admins read resource activity" on public.resource_activity
for select to authenticated
using (
  (select auth.jwt())->'app_metadata'->>'role' in ('admin', 'superadmin')
  or lower(coalesce((select auth.jwt())->>'email', '')) in ('soporte@nodavexa.com', 'joeltrincadov@gmail.com')
);
