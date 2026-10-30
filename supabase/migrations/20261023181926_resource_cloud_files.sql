insert into storage.buckets (id,name,public,file_size_limit)
values ('resource-files','resource-files',false,26214400)
on conflict (id) do update set public=false,file_size_limit=26214400;
create table public.resource_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tool_slug text not null,
  name text not null check (length(name) between 1 and 180),
  path text not null unique,
  size_bytes integer not null check (size_bytes between 0 and 26214400),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index resource_files_user_tool_created on public.resource_files(user_id,tool_slug,created_at desc);
create index resource_files_expiry on public.resource_files(expires_at);
alter table public.resource_files enable row level security;
grant select,insert,delete on public.resource_files to authenticated;
create policy "Own recent files" on public.resource_files for select to authenticated using (user_id=(select auth.uid()) and expires_at>now());
create policy "Insert own file" on public.resource_files for insert to authenticated
with check (user_id=(select auth.uid()) and (storage.foldername(path))[1]=(select auth.uid())::text and created_at between now()-interval '1 minute' and now()+interval '1 minute' and expires_at between now() and now()+interval '30 days 1 minute');
create policy "Delete own file" on public.resource_files for delete to authenticated using (user_id=(select auth.uid()));
create policy "Upload resource files" on storage.objects for insert to authenticated with check (bucket_id='resource-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Read own recent resource files" on storage.objects for select to authenticated using (bucket_id='resource-files' and (storage.foldername(name))[1]=(select auth.uid())::text and created_at>now()-interval '30 days');
create policy "Delete own resource files" on storage.objects for delete to authenticated using (bucket_id='resource-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create table public.resource_cleanup_auth (id boolean primary key default true check(id),token_hash text not null);
alter table public.resource_cleanup_auth enable row level security;
revoke all on public.resource_cleanup_auth from anon,authenticated;
grant select on public.resource_cleanup_auth to service_role;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$
declare secret text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  insert into public.resource_cleanup_auth(id,token_hash) values(true,encode(extensions.digest(secret,'sha256'),'hex'));
  perform vault.create_secret(secret,'resource_files_cleanup_token','Expiration of generated files');
end $$;
select cron.schedule('resource-files-expiry','15 * * * *',$job$
select net.http_post(url:='https://muykjvbxcugfazluwjzs.supabase.co/functions/v1/cleanup-resource-files',headers:=jsonb_build_object('Content-Type','application/json','x-cleanup-token',(select decrypted_secret from vault.decrypted_secrets where name='resource_files_cleanup_token')),body:='{}'::jsonb);
$job$);
