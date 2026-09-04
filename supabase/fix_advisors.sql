drop policy if exists "Public reads solution assets" on storage.objects;

drop policy if exists "Public reads published solutions" on public.solutions;
drop policy if exists "Admins insert solutions" on public.solutions;
drop policy if exists "Admins update solutions" on public.solutions;
drop policy if exists "Admins delete solutions" on public.solutions;
create policy "Public reads published solutions" on public.solutions for select to anon, authenticated using (published or (select auth.jwt())->'app_metadata'->>'role'='admin');
create policy "Admins insert solutions" on public.solutions for insert to authenticated with check ((select auth.jwt())->'app_metadata'->>'role'='admin');
create policy "Admins update solutions" on public.solutions for update to authenticated using ((select auth.jwt())->'app_metadata'->>'role'='admin') with check ((select auth.jwt())->'app_metadata'->>'role'='admin');
create policy "Admins delete solutions" on public.solutions for delete to authenticated using ((select auth.jwt())->'app_metadata'->>'role'='admin');

drop policy if exists "Public reads equipment for published solution" on public.equipment;
drop policy if exists "Admins insert equipment" on public.equipment;
drop policy if exists "Admins update equipment" on public.equipment;
drop policy if exists "Admins delete equipment" on public.equipment;
create policy "Public reads equipment for published solution" on public.equipment for select to anon, authenticated using (exists (select 1 from public.solutions s where s.id=solution_id and (s.published or (select auth.jwt())->'app_metadata'->>'role'='admin')));
create policy "Admins insert equipment" on public.equipment for insert to authenticated with check ((select auth.jwt())->'app_metadata'->>'role'='admin');
create policy "Admins update equipment" on public.equipment for update to authenticated using ((select auth.jwt())->'app_metadata'->>'role'='admin') with check ((select auth.jwt())->'app_metadata'->>'role'='admin');
create policy "Admins delete equipment" on public.equipment for delete to authenticated using ((select auth.jwt())->'app_metadata'->>'role'='admin');

drop policy if exists "Public reads documents for published solution" on public.documents;
drop policy if exists "Admins insert documents" on public.documents;
drop policy if exists "Admins update documents" on public.documents;
drop policy if exists "Admins delete documents" on public.documents;
create policy "Public reads documents for published solution" on public.documents for select to anon, authenticated using (exists (select 1 from public.solutions s where s.id=solution_id and (s.published or (select auth.jwt())->'app_metadata'->>'role'='admin')));
create policy "Admins insert documents" on public.documents for insert to authenticated with check ((select auth.jwt())->'app_metadata'->>'role'='admin');
create policy "Admins update documents" on public.documents for update to authenticated using ((select auth.jwt())->'app_metadata'->>'role'='admin') with check ((select auth.jwt())->'app_metadata'->>'role'='admin');
create policy "Admins delete documents" on public.documents for delete to authenticated using ((select auth.jwt())->'app_metadata'->>'role'='admin');
