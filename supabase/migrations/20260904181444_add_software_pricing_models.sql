alter table public.solutions
  add column if not exists software_pricing_model text not null default 'total_maintenance',
  add column if not exists initial_price_mxn numeric(12,2) not null default 0,
  add column if not exists annual_maintenance_price_mxn numeric(12,2) not null default 0;

alter table public.solutions drop constraint if exists solutions_software_pricing_model_valid;
alter table public.solutions add constraint solutions_software_pricing_model_valid
  check (software_pricing_model in ('deposit_monthly', 'total_maintenance'));
alter table public.solutions drop constraint if exists solutions_software_prices_nonnegative;
alter table public.solutions add constraint solutions_software_prices_nonnegative
  check (initial_price_mxn >= 0 and annual_maintenance_price_mxn >= 0);

comment on column public.solutions.base_price_mxn is
  'Precio mensual para deposit_monthly; precio total para total_maintenance; precio principal para publicaciones no software.';
comment on column public.solutions.initial_price_mxn is
  'Anticipo opcional para software con cobro por mensualidad.';
comment on column public.solutions.annual_maintenance_price_mxn is
  'Mantenimiento anual de software: hosting, base de datos y servicios definidos en la publicación.';
