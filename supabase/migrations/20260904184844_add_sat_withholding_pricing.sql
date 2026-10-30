alter table public.solutions
  add column if not exists sat_withholdings_enabled boolean not null default false,
  add column if not exists isr_withholding_rate numeric(6,3) not null default 0,
  add column if not exists vat_withholding_rate numeric(6,3) not null default 0;

alter table public.solutions drop constraint if exists solutions_sat_rates_valid;
alter table public.solutions add constraint solutions_sat_rates_valid check (
  isr_withholding_rate between 0 and 100
  and vat_withholding_rate between 0 and 100
  and isr_withholding_rate + vat_withholding_rate < 100
);

comment on column public.solutions.base_price_mxn is
  'Para software con retenciones activas es el importe neto objetivo; el precio publicado se calcula por gross-up.';
