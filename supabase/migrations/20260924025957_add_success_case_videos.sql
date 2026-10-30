create table if not exists public.success_case_videos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  video_url text not null,
  youtube_id text not null,
  description text not null default '',
  position integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists success_case_videos_published_position_idx
  on public.success_case_videos(published, position, created_at desc);

alter table public.success_case_videos enable row level security;

grant select on public.success_case_videos to anon, authenticated;
grant insert, update, delete on public.success_case_videos to authenticated;

create policy "Public reads published success case videos"
  on public.success_case_videos
  for select
  to anon, authenticated
  using (published or (select auth.jwt())->'app_metadata'->>'role' = 'admin');

create policy "Admins insert success case videos"
  on public.success_case_videos
  for insert
  to authenticated
  with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

create policy "Admins update success case videos"
  on public.success_case_videos
  for update
  to authenticated
  using ((select auth.jwt())->'app_metadata'->>'role' = 'admin')
  with check ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

create policy "Admins delete success case videos"
  on public.success_case_videos
  for delete
  to authenticated
  using ((select auth.jwt())->'app_metadata'->>'role' = 'admin');

insert into public.success_case_videos (slug, title, video_url, youtube_id, description, position, published)
values
  (
    'software-para-control-de-exportaciones',
    'Software para control de exportaciones',
    'https://youtube.com/shorts/uhbGHaKrOGc?si=coqEImA9YopQG6Wd',
    'uhbGHaKrOGc',
    'Caso en video sobre software para controlar y organizar procesos de exportación.',
    1,
    true
  ),
  (
    'verificador-de-precios',
    'Verificador de precios',
    'https://youtube.com/shorts/PxC8HnzTb48?si=qylzcHDeO0QS-fRC',
    'PxC8HnzTb48',
    'Caso en video de una herramienta para consulta y verificación de precios.',
    2,
    true
  ),
  (
    'control-de-inventarios',
    'Control de inventarios',
    'https://youtube.com/shorts/ozsz3vmR4Y4?si=c1eNz6bo38GHiLGP',
    'ozsz3vmR4Y4',
    'Caso en video enfocado en control operativo de inventarios.',
    3,
    true
  )
on conflict (slug) do update set
  title = excluded.title,
  video_url = excluded.video_url,
  youtube_id = excluded.youtube_id,
  description = excluded.description,
  position = excluded.position,
  published = excluded.published,
  updated_at = now();
