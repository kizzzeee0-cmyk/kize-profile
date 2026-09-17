-- Existing KIZE project: run once in Supabase SQL Editor to add the songbook.

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null,
  song_key text,
  genre text not null default '기타',
  note text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.songs;
create trigger set_updated_at before update on public.songs
for each row execute function public.set_updated_at();

alter table public.songs enable row level security;

drop policy if exists "public read visible songs" on public.songs;
create policy "public read visible songs" on public.songs
for select to anon, authenticated
using (is_visible = true or public.is_admin());

drop policy if exists "admin insert songs" on public.songs;
create policy "admin insert songs" on public.songs
for insert to authenticated with check (public.is_admin());

drop policy if exists "admin update songs" on public.songs;
create policy "admin update songs" on public.songs
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin delete songs" on public.songs;
create policy "admin delete songs" on public.songs
for delete to authenticated using (public.is_admin());

insert into public.songs (title, artist, song_key, genre, note, sort_order) values
('Love wins all', 'IU', null, '발라드', null, 1),
('Ditto', 'NewJeans', null, 'K-POP', null, 2),
('INVU', 'TAEYEON', null, 'K-POP', '신청 가능', 3),
('Blue Moon', 'HYOLYN & CHANGMO', null, 'R&B', null, 4);

update public.navigation_links
set url = '/songs/', is_external = false, open_new_tab = false
where label = '노래책';
