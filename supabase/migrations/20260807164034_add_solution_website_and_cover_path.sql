alter table public.solutions
  add column if not exists website_url text,
  add column if not exists cover_file_path text;
