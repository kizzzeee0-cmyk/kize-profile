-- KIZE public-data recovery migration (2026-10-30)
-- Safe for an existing project. It does not delete content.
-- Run once in Supabase Dashboard > SQL Editor.

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

grant usage on schema public to anon, authenticated;
grant select on table
  public.site_settings,
  public.profile,
  public.profile_stats,
  public.profile_features,
  public.social_links,
  public.navigation_links,
  public.milestones,
  public.archives,
  public.songs,
  public.schedule_categories,
  public.schedules,
  public.site_texts,
  public.signature_items,
  public.wardrobe_items,
  public.upbo_people,
  public.upbo_results
  to anon, authenticated;

drop policy if exists "public read site settings" on public.site_settings;
create policy "public read site settings" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "public read profile" on public.profile;
create policy "public read profile" on public.profile for select to anon, authenticated using (true);
drop policy if exists "public read visible profile stats" on public.profile_stats;
create policy "public read visible profile stats" on public.profile_stats for select to anon, authenticated using (is_visible = true or public.is_admin());
drop policy if exists "public read visible profile features" on public.profile_features;
create policy "public read visible profile features" on public.profile_features for select to anon, authenticated using (is_visible = true or public.is_admin());
drop policy if exists "public read visible social links" on public.social_links;
create policy "public read visible social links" on public.social_links for select to anon, authenticated using (is_visible = true or public.is_admin());
drop policy if exists "public read visible navigation" on public.navigation_links;
create policy "public read visible navigation" on public.navigation_links for select to anon, authenticated using (is_visible = true or public.is_admin());
drop policy if exists "public read visible milestones" on public.milestones;
create policy "public read visible milestones" on public.milestones for select to anon, authenticated using (is_visible = true or public.is_admin());
drop policy if exists "public read visible archives" on public.archives;
create policy "public read visible archives" on public.archives for select to anon, authenticated using (is_visible = true or public.is_admin());
drop policy if exists "public read visible songs" on public.songs;
create policy "public read visible songs" on public.songs for select to anon, authenticated using (is_visible = true or public.is_admin());
drop policy if exists "public read visible categories" on public.schedule_categories;
create policy "public read visible categories" on public.schedule_categories for select to anon, authenticated using (is_visible = true or public.is_admin());
drop policy if exists "public read visible schedules" on public.schedules;
create policy "public read visible schedules" on public.schedules for select to anon, authenticated using (is_visible = true or public.is_admin());
drop policy if exists "public read site texts" on public.site_texts;
create policy "public read site texts" on public.site_texts for select to anon, authenticated using (true);
drop policy if exists "public read visible signature items" on public.signature_items;
create policy "public read visible signature items" on public.signature_items for select to anon, authenticated using (is_visible = true or public.is_admin());
drop policy if exists "public read visible wardrobe" on public.wardrobe_items;
create policy "public read visible wardrobe" on public.wardrobe_items for select to anon, authenticated using (is_visible = true or public.is_admin());
drop policy if exists "public read visible upbo people" on public.upbo_people;
create policy "public read visible upbo people" on public.upbo_people for select to anon, authenticated using (is_visible = true or public.is_admin());
drop policy if exists "public read upbo results" on public.upbo_results;
create policy "public read upbo results" on public.upbo_results for select to anon, authenticated using (true);
