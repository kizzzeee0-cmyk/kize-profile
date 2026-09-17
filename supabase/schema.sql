-- Kize Profile site / Supabase schema
-- Run this once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_profiles where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  site_title text not null default 'KIZE',
  site_description text not null default '',
  brand_color text not null default '#9389DE',
  footer_text text not null default '© 2026 KIZE. ALL RIGHTS RESERVED.',
  logo_text text not null default 'KIZE',
  favicon_url text,
  seo_image_url text,
  dark_mode_enabled boolean not null default true,
  roulette_probability_url text,
  calendar_event_title_size integer not null default 12 check (calendar_event_title_size between 8 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  korean_name text not null default '키제',
  english_name text not null default 'Kize',
  since_date date,
  badge_text text not null default 'SOOP STREAMER',
  intro text not null default '',
  profile_image_url text,
  fandom_name text,
  fandom_character_name text,
  fandom_description text,
  fandom_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_stats (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  value text not null,
  description text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_features (
  id uuid primary key default gen_random_uuid(),
  icon text not null default '◌',
  title text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_links (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  icon text not null default '↗',
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.navigation_links (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  url text not null,
  is_external boolean not null default false,
  open_new_tab boolean not null default false,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text not null,
  description text,
  image_url text,
  external_url text,
  is_highlight boolean not null default false,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.archives (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text not null,
  category text not null default 'Clip',
  description text,
  video_url text not null,
  platform text not null default 'YouTube',
  thumbnail_url text,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.schedule_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#9389DE',
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  schedule_date date not null,
  start_time time,
  end_time time,
  category_id uuid references public.schedule_categories(id) on delete set null,
  description text,
  participants text,
  related_url text,
  image_url text,
  note text,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


create table if not exists public.site_texts (
  id uuid primary key default gen_random_uuid(),
  text_key text not null unique,
  label text not null,
  value text not null default '',
  group_name text not null default '기타',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  period_type text not null default 'monthly' check (period_type in ('monthly','existing')),
  item_type text not null default 'outfit' check (item_type in ('outfit','hair')),
  image_url text,
  description text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.upbo_people (
  id uuid primary key default gen_random_uuid(),
  soop_name text not null,
  soop_id text not null unique,
  profile_image_url text,
  note text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.upbo_results (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.upbo_people(id) on delete cascade,
  result_label text not null,
  quantity integer not null default 1 check (quantity >= 0),
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists schedules_date_idx on public.schedules(schedule_date);
create index if not exists milestones_sort_idx on public.milestones(sort_order);
create index if not exists archives_date_idx on public.archives(date desc);

-- updated_at triggers
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['site_settings','profile','profile_stats','profile_features','social_links','navigation_links','milestones','archives','songs','schedule_categories','schedules','site_texts','wardrobe_items','upbo_people','upbo_results']
  LOOP
    EXECUTE format('drop trigger if exists set_updated_at on public.%I', t);
    EXECUTE format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  END LOOP;
END $$;

-- RLS
alter table public.admin_profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.profile enable row level security;
alter table public.profile_stats enable row level security;
alter table public.profile_features enable row level security;
alter table public.social_links enable row level security;
alter table public.navigation_links enable row level security;
alter table public.milestones enable row level security;
alter table public.archives enable row level security;
alter table public.songs enable row level security;
alter table public.schedule_categories enable row level security;
alter table public.schedules enable row level security;
alter table public.site_texts enable row level security;
alter table public.wardrobe_items enable row level security;
alter table public.upbo_people enable row level security;
alter table public.upbo_results enable row level security;

-- Public readable singleton data
create policy "public read site settings" on public.site_settings for select to anon, authenticated using (true);
create policy "public read profile" on public.profile for select to anon, authenticated using (true);

-- Public readable only when visible
create policy "public read visible profile stats" on public.profile_stats for select to anon, authenticated using (is_visible = true or public.is_admin());
create policy "public read visible profile features" on public.profile_features for select to anon, authenticated using (is_visible = true or public.is_admin());
create policy "public read visible social links" on public.social_links for select to anon, authenticated using (is_visible = true or public.is_admin());
create policy "public read visible navigation" on public.navigation_links for select to anon, authenticated using (is_visible = true or public.is_admin());
create policy "public read visible milestones" on public.milestones for select to anon, authenticated using (is_visible = true or public.is_admin());
create policy "public read visible archives" on public.archives for select to anon, authenticated using (is_visible = true or public.is_admin());
create policy "public read visible songs" on public.songs for select to anon, authenticated using (is_visible = true or public.is_admin());
create policy "public read visible categories" on public.schedule_categories for select to anon, authenticated using (is_visible = true or public.is_admin());
create policy "public read visible schedules" on public.schedules for select to anon, authenticated using (is_visible = true or public.is_admin());
create policy "public read site texts" on public.site_texts for select to anon, authenticated using (true);
create policy "public read visible wardrobe" on public.wardrobe_items for select to anon, authenticated using (is_visible = true or public.is_admin());
create policy "public read visible upbo people" on public.upbo_people for select to anon, authenticated using (is_visible = true or public.is_admin());
create policy "public read upbo results" on public.upbo_results for select to anon, authenticated using (true);

-- Admin profile: users can verify their own admin membership; existing admins can manage rows.
create policy "admin profile read own" on public.admin_profiles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "admins insert admin profiles" on public.admin_profiles for insert to authenticated with check (public.is_admin());
create policy "admins update admin profiles" on public.admin_profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete admin profiles" on public.admin_profiles for delete to authenticated using (public.is_admin());

-- Admin CRUD policies
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['site_settings','profile','profile_stats','profile_features','social_links','navigation_links','milestones','archives','songs','schedule_categories','schedules','site_texts','wardrobe_items','upbo_people','upbo_results']
  LOOP
    EXECUTE format('create policy "admin insert %1$s" on public.%1$I for insert to authenticated with check (public.is_admin())', t);
    EXECUTE format('create policy "admin update %1$s" on public.%1$I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    EXECUTE format('create policy "admin delete %1$s" on public.%1$I for delete to authenticated using (public.is_admin())', t);
  END LOOP;
END $$;

-- Storage bucket. Public reads are intentional for profile/archive images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 10485760, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "admins upload site media" on storage.objects for insert to authenticated
with check (bucket_id = 'site-media' and public.is_admin());
create policy "admins update site media" on storage.objects for update to authenticated
using (bucket_id = 'site-media' and public.is_admin())
with check (bucket_id = 'site-media' and public.is_admin());
create policy "admins delete site media" on storage.objects for delete to authenticated
using (bucket_id = 'site-media' and public.is_admin());

-- Signature gallery
create table if not exists public.signature_items (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  title text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.signature_items enable row level security;
drop policy if exists "public read visible signature items" on public.signature_items;
create policy "public read visible signature items" on public.signature_items for select to anon, authenticated using (is_visible = true or public.is_admin());
drop policy if exists "admin insert signature_items" on public.signature_items;
create policy "admin insert signature_items" on public.signature_items for insert to authenticated with check (public.is_admin());
drop policy if exists "admin update signature_items" on public.signature_items;
create policy "admin update signature_items" on public.signature_items for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin delete signature_items" on public.signature_items;
create policy "admin delete signature_items" on public.signature_items for delete to authenticated using (public.is_admin());
drop trigger if exists set_updated_at on public.signature_items;
create trigger set_updated_at before update on public.signature_items for each row execute function public.set_updated_at();
create or replace function public.enforce_signature_item_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.signature_items) >= 12 then
    raise exception 'Signature images are limited to 12 items.';
  end if;
  return new;
end;
$$;
drop trigger if exists signature_item_limit on public.signature_items;
create trigger signature_item_limit before insert on public.signature_items for each row execute function public.enforce_signature_item_limit();
