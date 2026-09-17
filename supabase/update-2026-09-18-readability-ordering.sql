-- KIZE existing-project migration: 2026-09-18
-- Safe to run on an already-connected project. Existing content is preserved.

-- 1) Admin-adjustable calendar event title font size (px)
alter table public.site_settings
  add column if not exists calendar_event_title_size integer;

update public.site_settings
set calendar_event_title_size = coalesce(calendar_event_title_size, 12);

alter table public.site_settings
  alter column calendar_event_title_size set default 12;

-- 2) Normalize existing sort orders so the new ↑ / ↓ controls work predictably.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profile_stats',
    'profile_features',
    'social_links',
    'navigation_links',
    'milestones',
    'archives',
    'songs',
    'schedule_categories',
    'site_texts',
    'wardrobe_items',
    'upbo_people',
    'signature_items'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format(
        'with ranked as (
           select id, row_number() over (order by sort_order asc, created_at asc, id asc) as rn
           from public.%I
         )
         update public.%I as target
         set sort_order = ranked.rn
         from ranked
         where target.id = ranked.id',
        t, t
      );
    end if;
  end loop;
end $$;

-- Upbo roulette results are ordered independently for each viewer.
with ranked as (
  select id,
         row_number() over (partition by person_id order by sort_order asc, created_at asc, id asc) as rn
  from public.upbo_results
)
update public.upbo_results as target
set sort_order = ranked.rn
from ranked
where target.id = ranked.id;

-- 3) Existing SOOP viewers: point profile_image_url at the public SOOP profile-image pattern.
-- The UI also has fallback image patterns if the primary format is unavailable.
update public.upbo_people
set profile_image_url =
  'https://stimg.sooplive.com/LOGO/' || lower(left(trim(soop_id), 2)) || '/' || trim(soop_id) || '/m/' || trim(soop_id) || '.webp'
where trim(coalesce(soop_id, '')) <> '';
