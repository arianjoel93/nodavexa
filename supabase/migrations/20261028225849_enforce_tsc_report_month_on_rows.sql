create or replace function public.enforce_tsc_report_row_month_access()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_month text; v_existing_month text;
begin
  if public.resource_has_premium('reportes-tsc') then return new; end if;
  v_month := substring(coalesce(new.normalized->>'fecha','') from '^(\d{4}-\d{2})-\d{2}$');
  if v_month is null then return new; end if;
  select substring(r.normalized->>'fecha' from '^(\d{4}-\d{2})-\d{2}$') into v_existing_month
    from public.report_rows r
    where r.owner_id=new.owner_id
      and substring(r.normalized->>'fecha' from '^(\d{4}-\d{2})-\d{2}$') is not null
      and substring(r.normalized->>'fecha' from '^(\d{4}-\d{2})-\d{2}$') <> v_month
    limit 1;
  if v_existing_month is not null then
    raise exception 'La cuenta gratuita solo puede alimentar el dashboard con datos de un mes. Activa Premium para usar meses distintos.';
  end if;
  return new;
end; $$;
revoke all on function public.enforce_tsc_report_row_month_access() from public,anon,authenticated;
drop trigger if exists report_rows_month_access on public.report_rows;
create trigger report_rows_month_access before insert on public.report_rows for each row execute function public.enforce_tsc_report_row_month_access();
