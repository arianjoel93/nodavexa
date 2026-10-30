alter table public.quote_products
  add column if not exists unit_type text not null default 'total'
  check (unit_type in ('total', 'hour'));

update public.quote_products
set unit_type = 'total'
where unit_type is null;
