-- Existing Supabase project: update the Archive title only.
-- UI color/spacing changes are handled in CSS and do not require DB changes.

insert into public.site_texts (text_key, label, value, group_name, sort_order)
values ('home_archive_title', '아카이브 제목', '클립 및 다시보기', '홈', 7)
on conflict (text_key) do update
set value = excluded.value,
    label = excluded.label,
    group_name = excluded.group_name,
    sort_order = excluded.sort_order;
