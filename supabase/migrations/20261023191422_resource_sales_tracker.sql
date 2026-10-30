create table public.resource_sales_periods (
  user_id uuid primary key references auth.users(id) on delete cascade,
  period_id uuid not null default gen_random_uuid(),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null default now() + interval '1 month'
);
create table public.resource_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.resource_sales_periods(user_id) on delete cascade,
  period_id uuid not null,
  client_name text not null check (length(trim(client_name)) between 1 and 160),
  phone text not null check (length(trim(phone)) between 1 and 40),
  company text not null default '' check (length(company)<=160),
  notes text not null default '' check (length(notes)<=3000),
  amount numeric(14,2) not null check (amount>0),
  created_at timestamptz not null default now()
);
create index resource_sales_user_period on public.resource_sales(user_id,period_id,created_at desc);
alter table public.resource_sales_periods enable row level security;
alter table public.resource_sales enable row level security;
grant select on public.resource_sales_periods,public.resource_sales to authenticated;
create policy "Read own sales period" on public.resource_sales_periods for select to authenticated using (user_id=(select auth.uid()));
create policy "Read own resource sales" on public.resource_sales for select to authenticated using (user_id=(select auth.uid()));

-- Mutations only run through these transactions, so the monthly lock cannot
-- be bypassed through direct table writes. Each function derives its owner from Auth.
create schema if not exists resource_private;
revoke all on schema resource_private from public;
grant usage on schema resource_private to authenticated;

create function resource_private.sales_workspace() returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); current_period public.resource_sales_periods;
begin
  if owner_id is null then raise exception 'Inicia sesión para consultar tus ventas.'; end if;
  insert into public.resource_sales_periods(user_id) values(owner_id) on conflict do nothing;
  select * into current_period from public.resource_sales_periods where user_id=owner_id for update;
  return jsonb_build_object('period',to_jsonb(current_period),'expired',now()>=current_period.ends_at,'server_now',now(),
    'sales',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc,s.id) from public.resource_sales s where s.user_id=owner_id and s.period_id=current_period.period_id),'[]'::jsonb));
end $$;

create function resource_private.add_sale(p_period uuid,p_client text,p_phone text,p_company text,p_notes text,p_amount numeric) returns uuid
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); current_period public.resource_sales_periods; sale_id uuid;
begin
  if owner_id is null then raise exception 'Inicia sesión para guardar una venta.'; end if;
  select * into current_period from public.resource_sales_periods where user_id=owner_id for update;
  if not found or current_period.period_id is distinct from p_period then raise exception 'El periodo cambió. Actualiza la herramienta.'; end if;
  if now()>=current_period.ends_at then raise exception 'Tu mes terminó. Descarga el reporte o descarta el periodo para continuar.'; end if;
  if not exists(select 1 from public.resource_tools where slug='control-ventas' and published) then raise exception 'La herramienta no está disponible.'; end if;
  if (select count(*) from public.resource_sales where user_id=owner_id)>=5000 then raise exception 'Alcanzaste 5000 ventas en este periodo.'; end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 then raise exception 'Escribe un importe mayor a cero.'; end if;
  insert into public.resource_sales(user_id,period_id,client_name,phone,company,notes,amount)
    values(owner_id,p_period,trim(p_client),trim(p_phone),trim(coalesce(p_company,'')),trim(coalesce(p_notes,'')),round(p_amount,2)) returning id into sale_id;
  return sale_id;
end $$;

create function resource_private.close_sales_period(p_period uuid,p_choice text) returns void
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); current_period public.resource_sales_periods;
begin
  if owner_id is null then raise exception 'Inicia sesión para cerrar el periodo.'; end if;
  if p_choice not in ('downloaded','discarded') or p_choice is null then raise exception 'Confirma la descarga o el descarte del reporte.'; end if;
  select * into current_period from public.resource_sales_periods where user_id=owner_id for update;
  if not found or current_period.period_id is distinct from p_period then raise exception 'El periodo cambió. Actualiza la herramienta.'; end if;
  if now()<current_period.ends_at then raise exception 'El periodo todavía no ha terminado.'; end if;
  delete from public.resource_sales where user_id=owner_id;
  update public.resource_sales_periods set period_id=gen_random_uuid(),started_at=now(),ends_at=now()+interval '1 month' where user_id=owner_id;
end $$;

create function public.resource_sales_workspace() returns jsonb language sql security invoker set search_path='' as $$ select resource_private.sales_workspace(); $$;
create function public.resource_sales_add(p_period uuid,p_client text,p_phone text,p_company text,p_notes text,p_amount numeric) returns uuid language sql security invoker set search_path='' as $$ select resource_private.add_sale(p_period,p_client,p_phone,p_company,p_notes,p_amount); $$;
create function public.resource_sales_close(p_period uuid,p_choice text) returns void language sql security invoker set search_path='' as $$ select resource_private.close_sales_period(p_period,p_choice); $$;
revoke all on function resource_private.sales_workspace(),resource_private.add_sale(uuid,text,text,text,text,numeric),resource_private.close_sales_period(uuid,text) from public,anon;
grant execute on function resource_private.sales_workspace(),resource_private.add_sale(uuid,text,text,text,text,numeric),resource_private.close_sales_period(uuid,text) to authenticated;
revoke all on function public.resource_sales_workspace(),public.resource_sales_add(uuid,text,text,text,text,numeric),public.resource_sales_close(uuid,text) from public,anon;
grant execute on function public.resource_sales_workspace(),public.resource_sales_add(uuid,text,text,text,text,numeric),public.resource_sales_close(uuid,text) to authenticated;

insert into public.resource_tools(slug,title,description,route,icon_key,label,published,requires_auth,position)
values('control-ventas','Mis ventas','Registra ventas, consulta tus indicadores y descarga tu reporte mensual.','/recursos/control-ventas','chart','Gratis con tu cuenta',true,true,4)
on conflict(slug) do update set title=excluded.title,description=excluded.description,route=excluded.route,icon_key=excluded.icon_key,requires_auth=true;
