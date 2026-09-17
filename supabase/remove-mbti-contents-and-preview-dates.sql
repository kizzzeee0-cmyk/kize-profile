-- KIZE profile cleanup update
-- Safe update for an existing Supabase project.

-- Hide MBTI if it was created by the previous version.
update public.profile_stats
set is_visible = false
where lower(label) = 'mbti';

-- Give placeholder Birthday/Debut values useful preview dates only when they are still defaults.
update public.profile_stats
set value = '09 . 22', description = null
where lower(label) = 'birthday' and value in ('00 . 00', '00.00', '');

update public.profile_stats
set value = '2026 . 04 . 01', description = null
where lower(label) = 'debut' and value in ('2026 . 00 . 00', '2026.00.00', '');

-- Contents section is no longer shown on the public profile.
update public.profile_features set is_visible = false;
