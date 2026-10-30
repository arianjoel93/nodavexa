insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tsc-reports-private','tsc-reports-private',false,52428800,array['text/csv','application/vnd.ms-excel','application/octet-stream'])
on conflict(id) do update set public=false,file_size_limit=52428800,allowed_mime_types=excluded.allowed_mime_types;

create table public.report_uploads(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 uploaded_by uuid not null default auth.uid() references auth.users(id),
 original_name text not null check(length(original_name) between 1 and 255),
 uploaded_at timestamptz not null default now(),
 solution_type text not null check(solution_type in ('basculas','estacionamiento','comedor','toma_turnos','exportacion_mangos','etiquetado_produccion','generico')),
 detected_solution text not null check(detected_solution in ('basculas','estacionamiento','comedor','toma_turnos','exportacion_mangos','etiquetado_produccion','generico')),
 file_size bigint not null check(file_size between 1 and 52428800),
 file_hash text not null check(file_hash ~ '^[a-f0-9]{64}$'),
 storage_path text not null unique,
 validation_status text not null default 'pending' check(validation_status in ('pending','valid','warnings','error')),
 import_mode text not null default 'new_period' check(import_mode in ('new_period','replace_view')),
 encoding text not null default 'utf-8',
 delimiter text not null default ',',
 headers jsonb not null default '[]'::jsonb,
 row_count integer not null default 0 check(row_count>=0),
 active_in_view boolean not null default true,
 created_at timestamptz not null default now(),
 unique(owner_id,id)
);
create index report_uploads_owner_recent on public.report_uploads(owner_id,uploaded_at desc);
create index report_uploads_owner_hash on public.report_uploads(owner_id,file_hash);

create table public.report_rows(
 id bigint generated always as identity primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 upload_id uuid not null,
 row_number integer not null check(row_number>0),
 row_key text not null,
 raw_data jsonb not null,
 normalized jsonb not null,
 created_at timestamptz not null default now(),
 foreign key(owner_id,upload_id) references public.report_uploads(owner_id,id) on delete cascade,
 unique(upload_id,row_number)
);
create index report_rows_upload_key on public.report_rows(upload_id,row_key);
create index report_rows_owner_upload on public.report_rows(owner_id,upload_id);

create table public.report_warnings(
 id bigint generated always as identity primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 upload_id uuid not null,
 row_number integer,
 field_name text not null default '',
 warning_code text not null,
 message text not null,
 created_at timestamptz not null default now(),
 foreign key(owner_id,upload_id) references public.report_uploads(owner_id,id) on delete cascade
);
create index report_warnings_owner_upload on public.report_warnings(owner_id,upload_id);

create table public.report_comparisons(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 base_upload_id uuid not null,
 compared_upload_id uuid not null,
 comparison jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 foreign key(owner_id,base_upload_id) references public.report_uploads(owner_id,id) on delete cascade,
 foreign key(owner_id,compared_upload_id) references public.report_uploads(owner_id,id) on delete cascade,
 check(base_upload_id<>compared_upload_id)
);
create index report_comparisons_owner_recent on public.report_comparisons(owner_id,created_at desc);

alter table public.report_uploads enable row level security;
alter table public.report_rows enable row level security;
alter table public.report_warnings enable row level security;
alter table public.report_comparisons enable row level security;
grant select,insert,update on public.report_uploads to authenticated;
grant select,insert on public.report_rows,public.report_warnings,public.report_comparisons to authenticated;
create policy "Users manage own TSC report uploads" on public.report_uploads for all to authenticated
using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()) and uploaded_by=(select auth.uid()));
create policy "Users read own TSC report rows" on public.report_rows for select to authenticated using(owner_id=(select auth.uid()));
create policy "Users insert own TSC report rows" on public.report_rows for insert to authenticated with check(owner_id=(select auth.uid()));
create policy "Users read own TSC report warnings" on public.report_warnings for select to authenticated using(owner_id=(select auth.uid()));
create policy "Users insert own TSC report warnings" on public.report_warnings for insert to authenticated with check(owner_id=(select auth.uid()));
create policy "Users read own TSC comparisons" on public.report_comparisons for select to authenticated using(owner_id=(select auth.uid()));
create policy "Users insert own TSC comparisons" on public.report_comparisons for insert to authenticated with check(owner_id=(select auth.uid()));

create policy "Upload own TSC report originals" on storage.objects for insert to authenticated
with check(bucket_id='tsc-reports-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Read own TSC report originals" on storage.objects for select to authenticated
using(bucket_id='tsc-reports-private' and (storage.foldername(name))[1]=(select auth.uid())::text);

insert into public.resource_tools(slug,title,description,route,icon_key,label,published,requires_auth,position)
values('reportes-tsc','Reportes TSC','Analiza reportes CSV de impresoras TSC, compara periodos y conserva originales.','/recursos/reportes-tsc','chart','Gratis con tu cuenta',true,true,6)
on conflict(slug) do update set title=excluded.title,description=excluded.description,route=excluded.route,icon_key=excluded.icon_key,requires_auth=true;
