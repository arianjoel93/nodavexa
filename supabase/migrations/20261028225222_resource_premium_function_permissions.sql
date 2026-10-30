create or replace function public.resource_has_premium(p_tool_slug text)
returns boolean language sql stable security invoker set search_path=public,pg_temp as $$
  select exists(select 1 from public.resource_entitlements e where e.user_id=(select auth.uid()) and e.tool_slug=p_tool_slug and e.starts_at<=now() and e.expires_at>now());
$$;
revoke all on function public.enforce_tsc_report_month_access() from public,anon,authenticated;
