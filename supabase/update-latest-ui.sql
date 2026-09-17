-- KIZE profile: small UI/data update for an existing Supabase project.
-- Safe to run more than once.

-- Wardrobe English label
update public.site_texts
set value = 'CLOSET'
where text_key = 'wardrobe_label';

-- Add a YouTube shortcut only when a similar shortcut does not already exist.
insert into public.social_links (name, url, icon, sort_order, is_visible)
select 'YouTube 바로가기', 'https://www.youtube.com/', '▶', 3, true
where not exists (
  select 1
  from public.social_links
  where lower(name) like '%youtube%' or name like '%유튜브%'
);

-- Keep shortcut ordering intuitive.
update public.social_links set sort_order = 1 where name like '%팬카페%';
update public.social_links set sort_order = 2 where lower(name) like '%soop%' or name like '%방송국%';
update public.social_links set sort_order = 3 where lower(name) like '%youtube%' or name like '%유튜브%';
