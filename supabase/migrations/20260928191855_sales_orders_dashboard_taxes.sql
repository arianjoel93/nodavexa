alter table public.quote_products
  add column if not exists cost_mxn numeric(12,2) not null default 0;

alter table public.sales_quote_items
  add column if not exists cost_unit_mxn numeric(12,2) not null default 0;

alter table public.sales_quotes
  add column if not exists sat_isr_rate numeric(5,2) not null default 0,
  add column if not exists sat_other_tax_rate numeric(5,2) not null default 0,
  add column if not exists sat_income_tax_amount numeric(12,2) not null default 0,
  add column if not exists sat_other_tax_amount numeric(12,2) not null default 0,
  add column if not exists cost_total numeric(12,2) not null default 0,
  add column if not exists gross_margin numeric(12,2) not null default 0,
  add column if not exists converted_order_id uuid;

alter table public.sales_quotes
  drop constraint if exists sales_quotes_status_check;

alter table public.sales_quotes
  add constraint sales_quotes_status_check
  check (status in ('draft','sent','accepted','rejected','archived','ordered'));

do $$
begin
  if not exists (select 1 from pg_type where typname = 'sales_order_status') then
    create type public.sales_order_status as enum ('draft', 'confirmed', 'in_progress', 'delivered', 'paid', 'cancelled');
  end if;
end $$;

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  quote_id uuid references public.sales_quotes(id) on delete set null,
  client_id uuid references public.quote_clients(id) on delete set null,
  status public.sales_order_status not null default 'confirmed',
  title text not null default 'Orden de venta',
  currency text not null default 'MXN' check (currency in ('MXN','USD')),
  exchange_rate_mxn_per_usd numeric(12,4),
  invoice_required boolean not null default false,
  vat_rate numeric(5,2) not null default 16,
  sat_isr_rate numeric(5,2) not null default 0,
  sat_other_tax_rate numeric(5,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  sat_income_tax_amount numeric(12,2) not null default 0,
  sat_other_tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  cost_total numeric(12,2) not null default 0,
  gross_margin numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  notes text not null default '',
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sales_orders
  add column if not exists title text not null default 'Orden de venta',
  add column if not exists invoice_required boolean not null default false,
  add column if not exists vat_rate numeric(5,2) not null default 16,
  add column if not exists sat_isr_rate numeric(5,2) not null default 0,
  add column if not exists sat_other_tax_rate numeric(5,2) not null default 0,
  add column if not exists sat_income_tax_amount numeric(12,2) not null default 0,
  add column if not exists sat_other_tax_amount numeric(12,2) not null default 0,
  add column if not exists cost_total numeric(12,2) not null default 0,
  add column if not exists gross_margin numeric(12,2) not null default 0,
  add column if not exists paid_amount numeric(12,2) not null default 0,
  add column if not exists confirmed_at timestamptz not null default now();

alter table public.sales_orders
  drop constraint if exists sales_orders_status_check;

alter table public.sales_orders
  add constraint sales_orders_status_check
  check (status in ('pending','draft','confirmed','in_progress','completed','delivered','paid','cancelled'));

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.sales_orders(id) on delete cascade,
  quote_item_id uuid references public.sales_quote_items(id) on delete set null,
  product_id uuid references public.quote_products(id) on delete set null,
  name text not null,
  description text not null default '',
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  unit_type text not null default 'total' check (unit_type in ('total', 'hour')),
  cost_unit_mxn numeric(12,2) not null default 0,
  hidden boolean not null default false,
  position int not null default 0
);

alter table public.sales_order_items
  add column if not exists cost_unit_mxn numeric(12,2) not null default 0,
  add column if not exists hidden boolean not null default false;

create index if not exists sales_orders_status_created_idx on public.sales_orders(status, created_at desc);
create index if not exists sales_orders_client_created_idx on public.sales_orders(client_id, created_at desc);
create index if not exists sales_order_items_order_idx on public.sales_order_items(order_id, position);

alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.sales_orders replica identity full;
alter table public.sales_order_items replica identity full;

grant select, insert, update, delete on public.sales_orders to authenticated;
grant select, insert, update, delete on public.sales_order_items to authenticated;

drop policy if exists "Admins manage sales orders" on public.sales_orders;
create policy "Admins manage sales orders" on public.sales_orders for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins manage sales order items" on public.sales_order_items;
create policy "Admins manage sales order items" on public.sales_order_items for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sales_orders') then
    alter publication supabase_realtime add table public.sales_orders;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sales_order_items') then
    alter publication supabase_realtime add table public.sales_order_items;
  end if;
end $$;
