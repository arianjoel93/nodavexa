-- Keep Nodavexa's public catalog readable while restricting all management writes
-- to authenticated users whose app_metadata role is explicitly "admin".
-- Do not use user_metadata for authorization: it is editable by the user.

alter table public.solutions enable row level security;
alter table public.equipment enable row level security;
alter table public.documents enable row level security;
alter table public.contact_messages enable row level security;
alter table public.site_settings enable row level security;
alter table public.success_cases enable row level security;

revoke all on public.solutions, public.equipment, public.documents, public.site_settings, public.success_cases from anon;
revoke all on public.solutions, public.equipment, public.documents, public.site_settings, public.success_cases from authenticated;
grant select on public.solutions, public.equipment, public.documents, public.site_settings, public.success_cases to anon, authenticated;
grant insert, update, delete on public.solutions, public.equipment, public.documents, public.success_cases to authenticated;
grant update on public.site_settings to authenticated;

revoke all on public.contact_messages from anon, authenticated;
grant select, update on public.contact_messages to authenticated;

drop policy if exists "Public reads published solutions" on public.solutions;
drop policy if exists "Admins insert solutions" on public.solutions;
drop policy if exists "Admins update solutions" on public.solutions;
drop policy if exists "Admins delete solutions" on public.solutions;
create policy "Public reads published solutions" on public.solutions
  for select to anon, authenticated
  using (published or (select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins insert solutions" on public.solutions
  for insert to authenticated
  with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins update solutions" on public.solutions
  for update to authenticated
  using ((select auth.jwt())->'app_metadata'->>'role' = 'admin')
  with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins delete solutions" on public.solutions
  for delete to authenticated
  using ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

drop policy if exists "Public reads equipment for published solution" on public.equipment;
drop policy if exists "Admins insert equipment" on public.equipment;
drop policy if exists "Admins update equipment" on public.equipment;
drop policy if exists "Admins delete equipment" on public.equipment;
create policy "Public reads equipment for published solution" on public.equipment
  for select to anon, authenticated
  using (exists (
    select 1 from public.solutions s
    where s.id = solution_id
      and (s.published or (select auth.jwt())->'app_metadata'->>'role' = 'admin')
  ));
create policy "Admins insert equipment" on public.equipment
  for insert to authenticated
  with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins update equipment" on public.equipment
  for update to authenticated
  using ((select auth.jwt())->'app_metadata'->>'role' = 'admin')
  with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins delete equipment" on public.equipment
  for delete to authenticated
  using ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

drop policy if exists "Public reads documents for published solution" on public.documents;
drop policy if exists "Admins insert documents" on public.documents;
drop policy if exists "Admins update documents" on public.documents;
drop policy if exists "Admins delete documents" on public.documents;
create policy "Public reads documents for published solution" on public.documents
  for select to anon, authenticated
  using (exists (
    select 1 from public.solutions s
    where s.id = solution_id
      and (s.published or (select auth.jwt())->'app_metadata'->>'role' = 'admin')
  ));
create policy "Admins insert documents" on public.documents
  for insert to authenticated
  with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins update documents" on public.documents
  for update to authenticated
  using ((select auth.jwt())->'app_metadata'->>'role' = 'admin')
  with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins delete documents" on public.documents
  for delete to authenticated
  using ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

drop policy if exists "Admins read contact messages" on public.contact_messages;
drop policy if exists "Admins update contact messages" on public.contact_messages;
create policy "Admins read contact messages" on public.contact_messages
  for select to authenticated
  using ((select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins update contact messages" on public.contact_messages
  for update to authenticated
  using ((select auth.jwt())->'app_metadata'->>'role' = 'admin')
  with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

drop policy if exists "Public reads site settings" on public.site_settings;
drop policy if exists "Admins update site settings" on public.site_settings;
create policy "Public reads site settings" on public.site_settings
  for select to anon, authenticated using (true);
create policy "Admins update site settings" on public.site_settings
  for update to authenticated
  using ((select auth.jwt())->'app_metadata'->>'role' = 'admin')
  with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

drop policy if exists "Public reads published success cases" on public.success_cases;
drop policy if exists "Admins insert success cases" on public.success_cases;
drop policy if exists "Admins update success cases" on public.success_cases;
drop policy if exists "Admins delete success cases" on public.success_cases;
create policy "Public reads published success cases" on public.success_cases
  for select to anon, authenticated
  using (published or (select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins insert success cases" on public.success_cases
  for insert to authenticated
  with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins update success cases" on public.success_cases
  for update to authenticated
  using ((select auth.jwt())->'app_metadata'->>'role' = 'admin')
  with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');
create policy "Admins delete success cases" on public.success_cases
  for delete to authenticated
  using ((select auth.jwt())->'app_metadata'->>'role' = 'admin');
