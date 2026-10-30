create or replace function public.report_tsc_trend(
  p_upload_ids uuid[],
  p_granularity text,
  p_measure text default ''
)
returns table(period_start date, records bigint, value numeric)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_granularity not in ('daily', 'weekly') then
    raise exception 'Unsupported granularity';
  end if;
  if coalesce(cardinality(p_upload_ids), 0) = 0 or cardinality(p_upload_ids) > 100 then
    raise exception 'Upload selection must contain between 1 and 100 reports';
  end if;
  if coalesce(p_measure, '') not in ('', '__weight__', 'peso', 'peso_neto', 'peso_bruto', 'tara', 'cantidad', 'piezas', 'total') then
    raise exception 'Unsupported measure';
  end if;

  return query
  with scoped as (
    select rr.row_key, rr.normalized, rr.upload_id, rr.row_number,
           ru.uploaded_at
    from public.report_rows rr
    join public.report_uploads ru
      on ru.id = rr.upload_id and ru.owner_id = rr.owner_id
    where rr.owner_id = (select auth.uid())
      and ru.owner_id = (select auth.uid())
      and rr.upload_id = any(p_upload_ids)
      and ru.validation_status in ('valid', 'warnings')
  ), parsed as (
    select s.*,
      case
        when s.normalized->>'fecha' ~ '^\d{4}-\d{2}-\d{2}$'
          then (s.normalized->>'fecha')::date
        else null
      end as report_date,
      case
        when p_measure = '__weight__' then coalesce(
          case when s.normalized->>'peso_neto' ~ '^-?\d+(\.\d+)?$' then (s.normalized->>'peso_neto')::numeric end,
          case when s.normalized->>'peso' ~ '^-?\d+(\.\d+)?$' then (s.normalized->>'peso')::numeric end,
          case when s.normalized->>'peso_bruto' ~ '^-?\d+(\.\d+)?$' then (s.normalized->>'peso_bruto')::numeric end
        )
        when p_measure in ('peso', 'peso_neto', 'peso_bruto', 'tara', 'cantidad', 'piezas', 'total')
          and s.normalized->>p_measure ~ '^-?\d+(\.\d+)?$'
          then (s.normalized->>p_measure)::numeric
        else null
      end as measure_value,
      row_number() over (
        partition by s.row_key
        order by s.uploaded_at desc, s.upload_id desc, s.row_number desc
      ) as occurrence
    from scoped s
  ), unique_rows as (
    select * from parsed where occurrence = 1 and report_date is not null
  )
  select
    case when p_granularity = 'weekly'
      then date_trunc('week', u.report_date::timestamp)::date
      else u.report_date
    end as period_start,
    count(*)::bigint as records,
    sum(u.measure_value) as value
  from unique_rows u
  group by 1
  order by 1;
end;
$$;

revoke all on function public.report_tsc_trend(uuid[], text, text) from public, anon;
grant execute on function public.report_tsc_trend(uuid[], text, text) to authenticated;
