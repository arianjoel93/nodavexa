create table if not exists public.resource_user_tools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_id uuid not null references public.resource_tools(id) on delete cascade,
  installed_at timestamptz not null default now(),
  unique (user_id, tool_id)
);

create index if not exists resource_user_tools_user_idx
  on public.resource_user_tools(user_id, installed_at desc);

alter table public.resource_user_tools enable row level security;
grant select, insert, delete on public.resource_user_tools to authenticated;

drop policy if exists "Users read own resource installations" on public.resource_user_tools;
create policy "Users read own resource installations" on public.resource_user_tools
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users install own resource tools" on public.resource_user_tools;
create policy "Users install own resource tools" on public.resource_user_tools
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users uninstall own resource tools" on public.resource_user_tools;
create policy "Users uninstall own resource tools" on public.resource_user_tools
for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Admins read resource installations" on public.resource_user_tools;
create policy "Admins read resource installations" on public.resource_user_tools
for select to authenticated
using (
  (select auth.jwt())->'app_metadata'->>'role' = 'admin'
  or (select auth.jwt())->>'email' = 'joeltrincadov@gmail.com'
);

create table if not exists public.resource_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_id uuid references public.resource_tools(id) on delete set null,
  tool_slug text not null,
  action text not null,
  quantity integer not null default 1 check (quantity > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists resource_activity_user_created_idx
  on public.resource_activity(user_id, created_at desc);

create index if not exists resource_activity_user_tool_idx
  on public.resource_activity(user_id, tool_slug, created_at desc);

alter table public.resource_activity enable row level security;
grant select, insert on public.resource_activity to authenticated;

drop policy if exists "Users read own resource activity" on public.resource_activity;
create policy "Users read own resource activity" on public.resource_activity
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users create own resource activity" on public.resource_activity;
create policy "Users create own resource activity" on public.resource_activity
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Admins read resource activity" on public.resource_activity;
create policy "Admins read resource activity" on public.resource_activity
for select to authenticated
using (
  (select auth.jwt())->'app_metadata'->>'role' = 'admin'
  or (select auth.jwt())->>'email' = 'joeltrincadov@gmail.com'
);

alter table public.resource_user_tools replica identity full;
alter table public.resource_activity replica identity full;
