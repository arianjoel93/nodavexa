create table if not exists public.quote_clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  country text not null default '',
  website text not null default '',
  tax_id text not null default '',
  billing_name text not null default '',
  billing_address text not null default '',
  marketing_consent boolean not null default false,
  notes text not null default '',
  source text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  unit_price_mxn numeric(12,2) not null default 0,
  taxable boolean not null default true,
  product_type text not null default 'service' check (product_type in ('service','product','maintenance','domain','email','other')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  client_id uuid references public.quote_clients(id) on delete set null,
  project_request_id uuid references public.project_requests(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','archived')),
  title text not null default 'Cotización',
  currency text not null default 'MXN' check (currency in ('MXN','USD')),
  exchange_rate_mxn_per_usd numeric(12,4),
  invoice_required boolean not null default false,
  vat_rate numeric(5,2) not null default 16,
  subtotal numeric(12,2) not null default 0,
  discount_percent numeric(5,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text not null default '',
  internal_notes text not null default '',
  valid_until date,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.sales_quotes(id) on delete cascade,
  product_id uuid references public.quote_products(id) on delete set null,
  name text not null,
  description text not null default '',
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  taxable boolean not null default true,
  hidden boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists quote_clients_created_idx on public.quote_clients(created_at desc);
create index if not exists quote_products_active_idx on public.quote_products(active, created_at desc);
create index if not exists sales_quotes_status_created_idx on public.sales_quotes(status, created_at desc);
create index if not exists sales_quote_items_quote_idx on public.sales_quote_items(quote_id, position);

alter table public.quote_clients enable row level security;
alter table public.quote_products enable row level security;
alter table public.sales_quotes enable row level security;
alter table public.sales_quote_items enable row level security;

alter table public.quote_clients replica identity full;
alter table public.quote_products replica identity full;
alter table public.sales_quotes replica identity full;
alter table public.sales_quote_items replica identity full;

grant select, insert, update, delete on public.quote_clients to authenticated;
grant select, insert, update, delete on public.quote_products to authenticated;
grant select, insert, update, delete on public.sales_quotes to authenticated;
grant select, insert, update, delete on public.sales_quote_items to authenticated;

create policy "Admins manage quote clients" on public.quote_clients for all to authenticated
using ((select auth.jwt())->'app_metadata'->>'role' = 'admin')
with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

create policy "Admins manage quote products" on public.quote_products for all to authenticated
using ((select auth.jwt())->'app_metadata'->>'role' = 'admin')
with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

create policy "Admins manage sales quotes" on public.sales_quotes for all to authenticated
using ((select auth.jwt())->'app_metadata'->>'role' = 'admin')
with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

create policy "Admins manage sales quote items" on public.sales_quote_items for all to authenticated
using ((select auth.jwt())->'app_metadata'->>'role' = 'admin')
with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

insert into public.quote_products (name, description, unit_price_mxn, taxable, product_type, active)
values
  ('Landing page profesional', 'Paquete cerrado de landing page de conversión con dominio gratis el primer año y correo profesional con dominio propio.', 18000, true, 'service', true),
  ('Dominio primer año', 'Dominio incluido en paquete landing page. Se suma internamente y no se desglosa al cliente.', 350, true, 'domain', true),
  ('Correo profesional con dominio propio', 'Configuración base de correo profesional con dominio propio.', 1200, true, 'email', true),
  ('Mantenimiento anual web', 'Mantenimiento, hosting y soporte técnico anual según alcance aprobado.', 789, true, 'maintenance', true)
on conflict do nothing;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quote_clients') then
    alter publication supabase_realtime add table public.quote_clients;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quote_products') then
    alter publication supabase_realtime add table public.quote_products;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sales_quotes') then
    alter publication supabase_realtime add table public.sales_quotes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sales_quote_items') then
    alter publication supabase_realtime add table public.sales_quote_items;
  end if;
end $$;
