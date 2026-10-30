alter table public.site_settings
  add column if not exists form_landing_quote_min_mxn numeric(12,2) not null default 12000,
  add column if not exists form_landing_quote_max_mxn numeric(12,2) not null default 28000;

alter table public.project_requests replica identity full;

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
