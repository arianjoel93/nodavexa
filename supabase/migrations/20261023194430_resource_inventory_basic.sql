create table public.resource_inventory_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 anchor_at timestamptz, period_start timestamptz, period_end timestamptz,
 period_number integer not null default 0, used integer not null default 0 check(used between 0 and 15)
);
create table public.resource_inventory_products (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.resource_inventory_accounts(user_id) on delete cascade,
 sku text not null check(length(trim(sku)) between 1 and 80), name text not null check(length(trim(name)) between 1 and 160),
 unit text not null default 'pieza' check(length(trim(unit)) between 1 and 30), minimum numeric(18,6) not null default 0 check(minimum>=0 and minimum<'Infinity'::numeric),
 stock numeric(18,6) not null default 0 check(stock>=0 and stock<'Infinity'::numeric), active boolean not null default true,
 unique(user_id,sku)
);
create table public.resource_inventory_movements (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.resource_inventory_accounts(user_id) on delete cascade,
 product_id uuid not null references public.resource_inventory_products(id), kind text not null check(kind in ('in','out')),
 quantity numeric(18,6) not null check(quantity>0 and quantity<'Infinity'::numeric), reference text not null default '' check(length(reference)<=160),
 notes text not null default '' check(length(notes)<=1000), created_at timestamptz not null default now(), request_id uuid not null,
 unique(user_id,request_id)
);
create index resource_inventory_history on public.resource_inventory_movements(user_id,created_at desc,id);
alter table public.resource_inventory_accounts enable row level security;
alter table public.resource_inventory_products enable row level security;
alter table public.resource_inventory_movements enable row level security;
revoke all on public.resource_inventory_accounts,public.resource_inventory_products,public.resource_inventory_movements from anon,authenticated;
grant select on public.resource_inventory_accounts,public.resource_inventory_products,public.resource_inventory_movements to authenticated;
create policy "Own inventory account" on public.resource_inventory_accounts for select to authenticated using(user_id=(select auth.uid()));
create policy "Own inventory products" on public.resource_inventory_products for select to authenticated using(user_id=(select auth.uid()));
create policy "Own inventory movements" on public.resource_inventory_movements for select to authenticated using(user_id=(select auth.uid()));

-- One account lock serializes all writes, stock checks and quota renewals.
create function resource_private.inventory_action(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); account public.resource_inventory_accounts; product public.resource_inventory_products;
 qty numeric; next_number integer; page_number integer:=0; request uuid; existing_id uuid;
begin
 if owner_id is null then raise exception 'Inicia sesión para usar tu inventario.'; end if;
 if not exists(select 1 from public.resource_tools where slug='inventario-basico' and published) then raise exception 'La herramienta no está disponible.'; end if;
 insert into public.resource_inventory_accounts(user_id) values(owner_id) on conflict do nothing;
 select * into account from public.resource_inventory_accounts where user_id=owner_id for update;
 if account.anchor_at is not null and now()>=account.period_end then
   next_number:=account.period_number+1;
   while account.anchor_at+make_interval(months=>next_number+1)<=now() loop next_number:=next_number+1; end loop;
   update public.resource_inventory_accounts set period_number=next_number,period_start=anchor_at+make_interval(months=>next_number),period_end=anchor_at+make_interval(months=>next_number+1),used=0 where user_id=owner_id returning * into account;
 end if;
 if p_action='product' then
   if length(trim(coalesce(p_data->>'sku',''))) not between 1 and 80 or length(trim(coalesce(p_data->>'name',''))) not between 1 and 160 or length(trim(coalesce(p_data->>'unit',''))) not between 1 and 30 then raise exception 'Completa el código, nombre y unidad del producto.'; end if;
   qty:=coalesce((p_data->>'minimum')::numeric,0);
   if qty<0 or qty::text in ('NaN','Infinity','-Infinity') or qty<>round(qty,6) then raise exception 'El mínimo debe ser positivo o cero, con hasta seis decimales.'; end if;
   if (select count(*) from public.resource_inventory_products where user_id=owner_id and active)>=30 then raise exception 'Alcanzaste el límite de 30 productos activos.'; end if;
   if exists(select 1 from public.resource_inventory_products where user_id=owner_id and sku=trim(p_data->>'sku')) then raise exception 'Este SKU o PLU ya existe, incluso si está archivado.'; end if;
   insert into public.resource_inventory_products(user_id,sku,name,unit,minimum) values(owner_id,trim(p_data->>'sku'),trim(p_data->>'name'),trim(p_data->>'unit'),qty);
 elsif p_action in ('archive','restore') then
   select * into product from public.resource_inventory_products where id=(p_data->>'id')::uuid and user_id=owner_id for update;
   if not found then raise exception 'El producto no está disponible.'; end if;
   if p_action='archive' and product.stock<>0 then raise exception 'Solo puedes archivar productos sin existencias.'; end if;
   if p_action='restore' and not product.active and (select count(*) from public.resource_inventory_products where user_id=owner_id and active)>=30 then raise exception 'Alcanzaste el límite de 30 productos activos.'; end if;
   update public.resource_inventory_products set active=(p_action='restore') where id=product.id;
 elsif p_action='move' then
   request:=(p_data->>'request_id')::uuid;
   if request is null then raise exception 'Actualiza el formulario e inténtalo de nuevo.'; end if;
   select id into existing_id from public.resource_inventory_movements where user_id=owner_id and request_id=request;
   if existing_id is not null then return jsonb_build_object('saved',true); end if;
   if account.used>=15 then raise exception 'Agotaste tus 15 movimientos. Consulta la fecha de renovación o contacta a soporte.'; end if;
   select * into product from public.resource_inventory_products where id=(p_data->>'product_id')::uuid and user_id=owner_id and active for update;
   if not found then raise exception 'Selecciona un producto activo de tu inventario.'; end if;
   qty:=(p_data->>'quantity')::numeric;
   if qty is null or qty<=0 or qty::text in ('NaN','Infinity','-Infinity') or qty<>round(qty,6) or qty>999999999999 then raise exception 'La cantidad debe ser mayor a cero, con hasta seis decimales.'; end if;
   if coalesce(p_data->>'kind','') not in ('in','out') then raise exception 'Selecciona entrada o salida.'; end if;
   if length(coalesce(p_data->>'reference',''))>160 or length(coalesce(p_data->>'notes',''))>1000 then raise exception 'La referencia o nota supera el tamaño permitido.'; end if;
   if p_data->>'kind'='out' and qty>product.stock then raise exception 'No hay existencias suficientes para esta salida.'; end if;
   if account.anchor_at is null then
     update public.resource_inventory_accounts set anchor_at=now(),period_start=now(),period_end=now()+interval '1 month' where user_id=owner_id;
   end if;
   insert into public.resource_inventory_movements(user_id,product_id,kind,quantity,reference,notes,request_id) values(owner_id,product.id,p_data->>'kind',qty,coalesce(p_data->>'reference',''),coalesce(p_data->>'notes',''),request);
   update public.resource_inventory_products set stock=stock+case when p_data->>'kind'='in' then qty else -qty end where id=product.id;
   update public.resource_inventory_accounts set used=used+1 where user_id=owner_id;
 elsif p_action<>'workspace' or p_action is null then raise exception 'Acción no disponible.';
 end if;
 if p_action<>'workspace' then return jsonb_build_object('saved',true); end if;
 page_number:=greatest(0,coalesce((p_data->>'page')::integer,0));
 return jsonb_build_object('account',to_jsonb(account),'server_now',now(),
 'products',coalesce((select jsonb_agg(to_jsonb(p) order by p.active desc,p.name,p.id) from public.resource_inventory_products p where p.user_id=owner_id),'[]'::jsonb),
 'movement_count',(select count(*) from public.resource_inventory_movements where user_id=owner_id),
 'movements',coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at desc,m.id) from (select * from public.resource_inventory_movements where user_id=owner_id order by created_at desc,id offset page_number*25 limit 25) m),'[]'::jsonb));
end $$;
create function public.resource_inventory_action(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select resource_private.inventory_action(p_action,p_data);$$;
revoke all on function resource_private.inventory_action(text,jsonb),public.resource_inventory_action(text,jsonb) from public,anon;
grant execute on function resource_private.inventory_action(text,jsonb),public.resource_inventory_action(text,jsonb) to authenticated;
insert into public.resource_tools(slug,title,description,route,icon_key,label,published,requires_auth,position) values('inventario-basico','Inventario básico','Controla 30 productos y registra hasta 15 entradas y salidas por mes. Conserva tu historial.','/recursos/inventario-basico','inventory','Gratis con tu cuenta',true,true,5) on conflict(slug) do nothing;
