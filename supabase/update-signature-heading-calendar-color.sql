-- Existing project migration: signature title + schedule '기타' color + remove monthly English label

-- 1) Make '기타' distinct from '휴방' with a soft light-green tone.
update public.schedule_categories
set color = '#A9D79E'
where name = '기타';

-- 2) Add an editable Signature subtitle.
insert into public.site_texts (text_key, label, value, group_name, sort_order)
values ('home_signature_title', '시그니처 제목', '시그니처 풍선', '홈', 10)
on conflict (text_key) do update
set label = excluded.label,
    value = coalesce(nullif(public.site_texts.value, ''), excluded.value),
    group_name = excluded.group_name,
    sort_order = excluded.sort_order;

-- 3) MONTHLY CALENDAR is no longer displayed, so remove the obsolete editable row.
delete from public.site_texts
where text_key = 'schedule_monthly_label';
