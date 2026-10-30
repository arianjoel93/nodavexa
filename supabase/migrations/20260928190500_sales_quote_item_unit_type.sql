alter table public.sales_quote_items
  add column if not exists unit_type text not null default 'total'
  check (unit_type in ('total', 'hour'));

update public.sales_quote_items
set unit_type = 'total'
where unit_type is null;
