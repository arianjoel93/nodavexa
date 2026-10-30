grant delete on public.report_uploads to authenticated;
create unique index if not exists resource_access_codes_order_tool_unique
  on public.resource_access_codes(sales_order_id,tool_slug);
