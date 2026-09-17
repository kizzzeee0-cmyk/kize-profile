-- Existing project migration: Signature gallery + profile card polish

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
create policy "public read visible signature items" on public.signature_items
for select to anon, authenticated
using (is_visible = true or public.is_admin());

drop policy if exists "admin insert signature_items" on public.signature_items;
create policy "admin insert signature_items" on public.signature_items
for insert to authenticated with check (public.is_admin());

drop policy if exists "admin update signature_items" on public.signature_items;
create policy "admin update signature_items" on public.signature_items
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin delete signature_items" on public.signature_items;
create policy "admin delete signature_items" on public.signature_items
for delete to authenticated using (public.is_admin());

drop trigger if exists set_updated_at on public.signature_items;
create trigger set_updated_at before update on public.signature_items
for each row execute function public.set_updated_at();

create or replace function public.enforce_signature_item_limit()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.signature_items) >= 12 then
    raise exception 'Signature images are limited to 12 items.';
  end if;
  return new;
end;
$$;

drop trigger if exists signature_item_limit on public.signature_items;
create trigger signature_item_limit
before insert on public.signature_items
for each row execute function public.enforce_signature_item_limit();

-- Add MBTI card once if it is missing.
insert into public.profile_stats (label, value, description, sort_order, is_visible)
select 'MBTI', 'XXXX', null, 5, true
where not exists (select 1 from public.profile_stats where lower(label) = 'mbti');

-- Keep the six-card order predictable.
update public.profile_stats set sort_order=1 where lower(label)='birthday';
update public.profile_stats set sort_order=2 where lower(label)='debut';
update public.profile_stats set sort_order=3 where lower(replace(label,' ',''))='livetime';
update public.profile_stats set sort_order=4 where lower(replace(label,' ',''))='off-day' or lower(replace(label,' ',''))='offday';
update public.profile_stats set sort_order=5 where lower(label)='mbti';

-- Convert content cards to the requested three categories when possible.
update public.profile_features set icon='☁', title='소통', description='', sort_order=1 where sort_order=1;
update public.profile_features set icon='♫', title='노래', description='', sort_order=2 where sort_order=2;
insert into public.profile_features (icon, title, description, sort_order, is_visible)
select '✦', '종합게임', '', 3, true
where not exists (select 1 from public.profile_features where sort_order=3);

-- Shorter shortcut labels. URLs are preserved.
update public.social_links set name='공식 팬카페' where name ilike '%팬카페%';
update public.social_links set name='SOOP 방송국' where name ilike '%soop%' or name ilike '%방송국%';
update public.social_links set name='YouTube' where name ilike '%youtube%' or name ilike '%유튜브%';

-- Editable section labels.
insert into public.site_texts (text_key, label, value, group_name, sort_order) values
('home_signature_label','시그니처 영문 라벨','SIGNATURE','홈',9)
on conflict (text_key) do nothing;
update public.site_texts set value='Contents', label='컨텐츠 영문 라벨' where text_key='home_main_contents_label';

delete from public.site_texts where text_key in (
  'home_fandom_label','home_fandom_title','home_fandom_name_label','home_fandom_name_fallback',
  'home_fandom_character_label','home_fandom_character_fallback','home_fandom_description_fallback',
  'home_fandom_image_label','home_fandom_image_help'
);
