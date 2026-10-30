drop policy if exists "Admins manage quote clients" on public.quote_clients;
create policy "Admins manage quote clients" on public.quote_clients for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') in ('admin','superadmin') or lower(coalesce(auth.jwt()->>'email','')) in ('soporte@nodavexa.com','joeltrincadov@gmail.com'))
  with check ((auth.jwt()->'app_metadata'->>'role') in ('admin','superadmin') or lower(coalesce(auth.jwt()->>'email','')) in ('soporte@nodavexa.com','joeltrincadov@gmail.com'));
drop policy if exists "Admins manage sales orders" on public.sales_orders;
create policy "Admins manage sales orders" on public.sales_orders for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') in ('admin','superadmin') or lower(coalesce(auth.jwt()->>'email','')) in ('soporte@nodavexa.com','joeltrincadov@gmail.com'))
  with check ((auth.jwt()->'app_metadata'->>'role') in ('admin','superadmin') or lower(coalesce(auth.jwt()->>'email','')) in ('soporte@nodavexa.com','joeltrincadov@gmail.com'));

update public.report_uploads u set report_months = coalesce((
  select array_agg(distinct left(r.normalized->>'fecha',7) order by left(r.normalized->>'fecha',7))
  from public.report_rows r
  where r.owner_id=u.owner_id and r.upload_id=u.id and r.normalized->>'fecha' ~ '^\d{4}-\d{2}-\d{2}$'
), '{}') where cardinality(u.report_months)=0;
