alter table public.solutions
  add column if not exists product_page jsonb;

comment on column public.solutions.product_page is
  'Contenido estructurado de las paginas de producto editables desde el administrador.';
