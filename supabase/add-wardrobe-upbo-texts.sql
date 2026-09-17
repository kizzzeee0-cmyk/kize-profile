-- Existing project migration: wardrobe / upbo / editable site copy
alter table public.site_settings add column if not exists roulette_probability_url text;

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

alter table public.site_texts enable row level security;
alter table public.wardrobe_items enable row level security;
alter table public.upbo_people enable row level security;
alter table public.upbo_results enable row level security;

drop policy if exists "public read site texts" on public.site_texts;
create policy "public read site texts" on public.site_texts for select to anon, authenticated using (true);
drop policy if exists "public read visible wardrobe" on public.wardrobe_items;
create policy "public read visible wardrobe" on public.wardrobe_items for select to anon, authenticated using (is_visible = true or public.is_admin());
drop policy if exists "public read visible upbo people" on public.upbo_people;
create policy "public read visible upbo people" on public.upbo_people for select to anon, authenticated using (is_visible = true or public.is_admin());
drop policy if exists "public read upbo results" on public.upbo_results;
create policy "public read upbo results" on public.upbo_results for select to anon, authenticated using (true);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['site_texts','wardrobe_items','upbo_people','upbo_results']
  LOOP
    EXECUTE format('drop trigger if exists set_updated_at on public.%I', t);
    EXECUTE format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
    EXECUTE format('drop policy if exists "admin insert %1$s" on public.%1$I', t);
    EXECUTE format('drop policy if exists "admin update %1$s" on public.%1$I', t);
    EXECUTE format('drop policy if exists "admin delete %1$s" on public.%1$I', t);
    EXECUTE format('create policy "admin insert %1$s" on public.%1$I for insert to authenticated with check (public.is_admin())', t);
    EXECUTE format('create policy "admin update %1$s" on public.%1$I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    EXECUTE format('create policy "admin delete %1$s" on public.%1$I for delete to authenticated using (public.is_admin())', t);
  END LOOP;
END $$;

update public.navigation_links set sort_order=1, url='/', is_external=false, open_new_tab=false where label='프로필';
update public.navigation_links set sort_order=2, url='/schedule/', is_external=false, open_new_tab=false where label='일정';
update public.navigation_links set sort_order=3, url='/songs/', is_external=false, open_new_tab=false where label='노래책';
update public.navigation_links set sort_order=4, url='/roulette/', is_external=false, open_new_tab=false where label='룰렛';
update public.navigation_links set sort_order=5, url='/work/', is_external=false, open_new_tab=false where label='업보';

insert into public.site_texts (text_key, label, value, group_name, sort_order) values
('home_main_contents_label','메인 컨텐츠 영문 라벨','Main Contents','홈',1),
('home_fandom_label','팬덤 브랜딩 영문 라벨','Fandom Branding','홈',2),
('home_fandom_title','팬덤 브랜딩 제목','팬덤 브랜딩','홈',3),
('home_milestone_label','여정 영문 라벨','MILESTONE','홈',4),
('home_milestone_title','여정 제목','키제의 여정','홈',5),
('home_archive_label','아카이브 영문 라벨','ARCHIVE','홈',6),
('home_archive_title','아카이브 제목','클립 및 다시보기','홈',7),
('home_archive_description','아카이브 설명','영상, 다시보기 및 노래커버, 그리고 추억을 차곡차곡 모아두는 공간입니다.','홈',8),
('schedule_label','일정 영문 라벨','SCHEDULE','일정',1),
('schedule_title','일정 제목','방송 일정','일정',2),
('schedule_description','일정 설명','월간 방송 일정과 앞으로 일주일의 계획을 한눈에 확인할 수 있습니다.','일정',3),
('schedule_monthly_label','월간 달력 라벨','MONTHLY CALENDAR','일정',4),
('schedule_upcoming_label','다가오는 일정 라벨','UPCOMING SCHEDULES','일정',5),
('schedule_upcoming_title','다가오는 일정 제목','다가오는 일정','일정',6),
('songbook_label','노래책 영문 라벨','SONGBOOK','노래책',1),
('songbook_title','노래책 제목','노래책','노래책',2),
('songbook_description','노래책 설명','키제가 부를 수 있는 곡을 장르별로 정리한 노래책입니다.','노래책',3),
('wardrobe_label','옷장 영문 라벨','CLOSET','룰렛/옷장',1),
('wardrobe_title','옷장 제목','키제의 옷장','룰렛/옷장',2),
('wardrobe_description','옷장 설명','이번 달 룰렛 의상과 지금까지의 헤어·의상을 한눈에 확인해 보세요.','룰렛/옷장',3),
('wardrobe_probability_button','룰렛 확률 버튼','룰렛확률 확인하기','룰렛/옷장',4),
('upbo_label','업보 영문 라벨','UPBO','업보',1),
('upbo_title','업보 제목','업보 현황','업보',2),
('upbo_description','업보 설명','SOOP 닉네임 또는 아이디로 검색하고 시청자별 룰렛 결과를 확인할 수 있습니다.','업보',3)
on conflict (text_key) do nothing;

insert into public.site_texts (text_key, label, value, group_name, sort_order) values
('preview_notice','미리보기 안내','현재는 미리보기 데이터입니다. Supabase를 연결하면 관리자 CMS의 데이터로 자동 전환됩니다.','공통',1),
('home_intro_fallback','소개 문구 기본값','프로필 소개 문구를 관리자 페이지에서 입력해 주세요.','홈',12),
('home_schedule_button','홈 일정 버튼','방송 일정 보기','홈',13),
('profile_image_label','프로필 이미지 라벨','PROFILE IMAGE','홈',14),
('profile_image_help','프로필 이미지 안내','PNG 투명 이미지를 업로드해 주세요','홈',15),
('home_main_contents_title','메인 컨텐츠 제목','메인 컨텐츠','홈',16),
('home_main_contents_fallback','메인 컨텐츠 기본 설명','종합게임 / 마인크래프트 / 소통 / 노래','홈',17),
('home_fandom_name_label','팬네임 라벨','팬네임','홈',18),
('home_fandom_name_fallback','팬네임 기본 안내','팬네임을 등록해 주세요.','홈',19),
('home_fandom_character_label','팬캐릭터 라벨','팬캐릭터','홈',20),
('home_fandom_character_fallback','팬캐릭터 기본 안내','팬캐릭터 이름을 등록해 주세요.','홈',21),
('home_fandom_description_fallback','팬덤 설명 기본값','팬캐릭터 소개, 디자인 설정, 방송국에서 사용하는 팬덤 브랜딩 설명을 이 영역에 자유롭게 적을 수 있습니다.','홈',22),
('home_fandom_image_label','팬덤 이미지 라벨','FANDOM DESIGN','홈',23),
('home_fandom_image_help','팬덤 이미지 안내','팬캐릭터 디자인 이미지를 업로드해 주세요','홈',24),
('home_milestone_link','여정 관련 링크 문구','관련 링크 ↗','홈',25),
('home_milestone_empty','여정 빈 상태','아직 등록된 여정이 없습니다.','홈',26),
('archive_no_image','아카이브 이미지 없음','NO IMAGE','홈',27),
('home_archive_empty','아카이브 빈 상태','등록된 아카이브가 없습니다.','홈',28),
('home_cta_label','홈 일정 CTA 라벨','SCHEDULE','홈',29),
('home_cta_title','홈 일정 CTA 문구','이번 달 일정과 다가오는 방송을 확인해 보세요.','홈',30),
('home_cta_button','홈 일정 CTA 버튼','일정 페이지 열기','홈',31),
('schedule_upcoming_description','다가오는 일정 설명','오늘을 포함해 앞으로 7일간의 일정입니다.','일정',7),
('schedule_today_button','오늘 버튼','오늘','일정',8),
('schedule_empty','일정 빈 상태','이번 주에 등록된 일정이 없습니다.','일정',9),
('songbook_search_placeholder','노래책 검색 안내','제목, 가수 또는 장르 검색','노래책',4),
('songbook_empty','노래책 빈 상태','조건에 맞는 노래가 없습니다.','노래책',5),
('wardrobe_monthly_tab','이달의 의상 탭','이달의 의상','룰렛/옷장',5),
('wardrobe_existing_tab','기존 의상 탭','기존 의상','룰렛/옷장',6),
('wardrobe_outfit_tab','의상 탭','의상','룰렛/옷장',7),
('wardrobe_hair_tab','헤어 탭','헤어','룰렛/옷장',8),
('wardrobe_empty','옷장 빈 상태','아직 등록된 항목이 없습니다.','룰렛/옷장',9),
('upbo_search_placeholder','업보 검색 안내','SOOP 이름 또는 아이디 검색','업보',4),
('upbo_no_result','업보 결과 없음','등록된 룰렛 결과가 없습니다.','업보',5),
('upbo_empty','업보 검색 결과 없음','검색 조건에 맞는 시청자가 없습니다.','업보',6)
on conflict (text_key) do nothing;
