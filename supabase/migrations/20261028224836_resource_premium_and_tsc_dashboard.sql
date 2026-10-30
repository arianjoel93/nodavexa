alter table public.report_uploads add column if not exists report_months text[] not null default '{}';

create table if not exists public.resource_entitlements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  tool_slug text not null references public.resource_tools(slug) on delete cascade,
  source text not null check (source in ('manual','customer_code')),
  client_id uuid references public.quote_clients(id) on delete set null,
  sales_order_id uuid references public.sales_orders(id) on delete set null,
  starts_at timestamptz not null default now(), expires_at timestamptz not null,
  granted_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
  unique (user_id,tool_slug,starts_at)
);
create index if not exists resource_entitlements_user_tool_expiry_idx on public.resource_entitlements(user_id,tool_slug,expires_at desc);
alter table public.resource_entitlements enable row level security;
grant select,insert,update,delete on public.resource_entitlements to authenticated;
create policy "Users read own resource entitlements" on public.resource_entitlements for select to authenticated using (user_id=(select auth.uid()));
create policy "Nodavexa admins manage resource entitlements" on public.resource_entitlements for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') in ('admin','superadmin') or lower(coalesce(auth.jwt()->>'email','')) in ('soporte@nodavexa.com','joeltrincadov@gmail.com'))
  with check ((auth.jwt()->'app_metadata'->>'role') in ('admin','superadmin') or lower(coalesce(auth.jwt()->>'email','')) in ('soporte@nodavexa.com','joeltrincadov@gmail.com'));

create table if not exists public.resource_access_codes (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.quote_clients(id) on delete cascade,
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  tool_slug text not null references public.resource_tools(slug) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'), issued_at timestamptz not null default now(),
  expires_at timestamptz not null, redeemed_by uuid references auth.users(id) on delete set null, redeemed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create index if not exists resource_access_codes_client_order_idx on public.resource_access_codes(client_id,sales_order_id);
alter table public.resource_access_codes enable row level security;
grant select,insert,update,delete on public.resource_access_codes to authenticated;
create policy "Nodavexa admins manage resource access codes" on public.resource_access_codes for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') in ('admin','superadmin') or lower(coalesce(auth.jwt()->>'email','')) in ('soporte@nodavexa.com','joeltrincadov@gmail.com'))
  with check ((auth.jwt()->'app_metadata'->>'role') in ('admin','superadmin') or lower(coalesce(auth.jwt()->>'email','')) in ('soporte@nodavexa.com','joeltrincadov@gmail.com'));

create or replace function public.resource_has_premium(p_tool_slug text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.resource_entitlements e where e.user_id=(select auth.uid()) and e.tool_slug=p_tool_slug and e.starts_at<=now() and e.expires_at>now());
$$;
revoke all on function public.resource_has_premium(text) from public,anon;
grant execute on function public.resource_has_premium(text) to authenticated;

create or replace function public.redeem_resource_access_code(p_code_hash text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user_id uuid:=auth.uid(); v_email text:=lower(coalesce(auth.jwt()->>'email','')); v_code public.resource_access_codes%rowtype; v_client_email text; v_order_status text;
begin
  if v_user_id is null then raise exception 'Inicia sesión para canjear el código.'; end if;
  if v_email='' then raise exception 'Verifica el correo de tu cuenta antes de canjear el código.'; end if;
  select c into v_code from public.resource_access_codes c where c.code_hash=lower(p_code_hash) for update;
  if not found then raise exception 'El código no es válido.'; end if;
  select lower(coalesce(email,'')) into v_client_email from public.quote_clients where id=v_code.client_id;
  if v_code.expires_at<=now() then raise exception 'El código ya venció.'; end if;
  if v_code.redeemed_by is not null and v_code.redeemed_by<>v_user_id then raise exception 'El código ya fue utilizado por otra cuenta.'; end if;
  if v_client_email<>v_email then raise exception 'El correo de tu cuenta debe coincidir con el correo registrado en la compra.'; end if;
  select status::text into v_order_status from public.sales_orders where id=v_code.sales_order_id and client_id=v_code.client_id;
  if v_order_status<>'paid' then raise exception 'La orden asociada aún no aparece como pagada.'; end if;
  update public.resource_access_codes set redeemed_by=v_user_id,redeemed_at=coalesce(redeemed_at,now()) where id=v_code.id;
  insert into public.resource_entitlements(user_id,tool_slug,source,client_id,sales_order_id,starts_at,expires_at,granted_by)
    values(v_user_id,v_code.tool_slug,'customer_code',v_code.client_id,v_code.sales_order_id,now(),v_code.expires_at,v_code.created_by)
    on conflict(user_id,tool_slug,starts_at) do nothing;
  return jsonb_build_object('tool_slug',v_code.tool_slug,'expires_at',v_code.expires_at);
end; $$;
revoke all on function public.redeem_resource_access_code(text) from public,anon;
grant execute on function public.redeem_resource_access_code(text) to authenticated;

create or replace function public.enforce_tsc_report_month_access()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_previous_months text[]; v_new_months text[];
begin
  v_new_months:=coalesce(new.report_months,'{}'::text[]);
  if public.resource_has_premium('reportes-tsc') then return new; end if;
  if cardinality(v_new_months)>1 then raise exception 'La cuenta gratuita solo puede usar reportes de un mes. Activa el acceso Premium de Reportes TSC para comparar meses distintos.'; end if;
  select array_agg(distinct m) into v_previous_months from public.report_uploads u cross join lateral unnest(coalesce(u.report_months,'{}'::text[])) m
    where u.owner_id=new.owner_id and u.validation_status in ('valid','warnings');
  if coalesce(cardinality(v_previous_months),0)>0 and coalesce(cardinality(v_new_months),0)>0
     and exists(select 1 from unnest(v_new_months) m where not(m=any(v_previous_months))) then
    raise exception 'Ya tienes reportes de otro mes. La cuenta gratuita solo admite un mes; solicita acceso Premium para cargar periodos distintos.';
  end if;
  if coalesce(cardinality(v_previous_months),0)>0 and coalesce(cardinality(v_new_months),0)=0 then raise exception 'No se identificó el mes de este archivo. Agrega fechas válidas o solicita acceso Premium.'; end if;
  return new;
end; $$;
drop trigger if exists report_uploads_month_access on public.report_uploads;
create trigger report_uploads_month_access before insert on public.report_uploads for each row execute function public.enforce_tsc_report_month_access();

create or replace function public.report_tsc_dashboard(p_since timestamptz default now()-interval '30 days')
returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_result jsonb;
begin
  if v_uid is null then raise exception 'Inicia sesión para consultar tus reportes.'; end if;
  with uploads as (
    select u.id,u.solution_type,u.original_name,u.uploaded_at,
      regexp_replace(upper(regexp_replace(u.original_name,'\.[^.]+$','')),'^(BDHISTO|BDHISF)[0-9]+$','\1') family
    from public.report_uploads u where u.owner_id=v_uid and u.uploaded_at>=p_since and u.validation_status in ('valid','warnings')
  ), scoped as (
    select r.*,u.solution_type,u.uploaded_at,u.family,row_number() over(partition by u.family,r.row_key order by u.uploaded_at desc,u.id desc,r.row_number desc) rn
    from uploads u join public.report_rows r on r.owner_id=v_uid and r.upload_id=u.id
  ), parsed as (
    select s.*,
      case when s.normalized->>'fecha' ~ '^\d{4}-\d{2}-\d{2}$' then (s.normalized->>'fecha')::date end report_date,
      coalesce(nullif(trim(s.normalized->>'peso_neto'),''),nullif(trim(s.normalized->>'peso'),''),nullif(trim(s.normalized->>'peso_bruto'),'')) weight_text,
      coalesce(nullif(trim(s.normalized->>'producto'),''),nullif(trim(s.normalized->>'codigo'),''),nullif(trim(s.normalized->>'descripcion'),''),'Sin producto') product_label,
      coalesce(nullif(trim(s.normalized->>'proveedor'),''),nullif(trim(s.normalized->>'cliente'),''),'') client_label
    from scoped s where s.rn=1
  ), clean as (
    select p.*,case when p.weight_text ~ '^-?\d+(\.\d+)?$' then p.weight_text::numeric end weight_value from parsed p
  ), series as (
    select report_date,count(*) records,sum(weight_value) weight from clean where report_date is not null group by report_date
  ), products as (
    select product_label label,count(*) records,sum(weight_value) weight from clean group by product_label order by sum(weight_value) desc nulls last,count(*) desc limit 10
  ), clients as (
    select client_label label,count(*) records,sum(weight_value) weight from clean where client_label<>'' group by client_label order by sum(weight_value) desc nulls last,count(*) desc limit 10
  ), totals as (
    select count(*) records,count(distinct report_date) days,count(distinct solution_type) solutions,count(distinct nullif(product_label,'Sin producto')) products,
      count(distinct nullif(client_label,'')) clients,sum(weight_value) weight_total,avg(weight_value) weight_average,
      (select count(*) from uploads) uploads,(select count(*) from public.report_warnings w join uploads u on u.id=w.upload_id where w.owner_id=v_uid) warnings from clean
  )
  select jsonb_build_object('uploads',t.uploads,'records',t.records,'days',t.days,'solutions',t.solutions,'products_count',t.products,'clients_count',t.clients,
    'weight_total',t.weight_total,'weight_average',t.weight_average,'warnings',t.warnings,
    'series',coalesce((select jsonb_agg(jsonb_build_object('date',s.report_date,'records',s.records,'weight',s.weight) order by s.report_date) from series s),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object('label',p.label,'records',p.records,'weight',p.weight) order by p.weight desc nulls last,p.records desc) from products p),'[]'::jsonb),
    'clients',coalesce((select jsonb_agg(jsonb_build_object('label',c.label,'records',c.records,'weight',c.weight) order by c.weight desc nulls last,c.records desc) from clients c),'[]'::jsonb))
  into v_result from totals t;
  return v_result;
end; $$;
revoke all on function public.report_tsc_dashboard(timestamptz) from public,anon;
grant execute on function public.report_tsc_dashboard(timestamptz) to authenticated;
create index if not exists report_uploads_owner_uploaded_idx on public.report_uploads(owner_id,uploaded_at desc);
create index if not exists report_rows_owner_upload_key_idx on public.report_rows(owner_id,upload_id,row_key);
