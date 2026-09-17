-- Run after schema.sql on a fresh Supabase project.
insert into public.site_settings (site_title, site_description, brand_color, footer_text, logo_text, dark_mode_enabled, roulette_probability_url, calendar_event_title_size)
values ('KIZE', '깔끔하고 단정한 버추얼 스트리머 키제 프로필', '#9389DE', '© 2026 KIZE. ALL RIGHTS RESERVED.', 'KIZE', true, 'https://example.com/roulette-probability', 12)
on conflict (singleton) do update set
  site_title=excluded.site_title,
  logo_text=excluded.logo_text,
  roulette_probability_url=excluded.roulette_probability_url,
  calendar_event_title_size=excluded.calendar_event_title_size;

insert into public.profile (korean_name, english_name, since_date, badge_text, intro, fandom_name, fandom_character_name, fandom_description)
values (
  '키제', 'KIZE', '2026-01-01', 'SOOP STREAMER',
  '차분한 분위기 속에서 소통, 종합게임, 노래를 함께 즐기는 버추얼 스트리머 키제입니다.',
  '예시 팬네임', '예시 팬캐릭터',
  '팬캐릭터 소개, 디자인 설정, 방송국에서 사용하는 팬덤 브랜딩 설명을 이곳에 입력해 주세요.'
)
on conflict (singleton) do update set korean_name=excluded.korean_name;

insert into public.profile_stats (label, value, description, sort_order) values
('Birthday', '09 . 22', null, 1),
('Debut', '2026 . 04 . 01', null, 2),
('Live Time', '17 : 00', '일정에 따라 변경될 수 있습니다.', 3),
('Off-Day', '-', '일정 페이지를 확인해 주세요.', 4);

insert into public.profile_features (icon, title, description, sort_order) values
('☁', '소통', '', 1),
('♫', '노래', '', 2),
('✦', '종합게임', '', 3);

insert into public.social_links (name, url, icon, sort_order) values
('공식 팬카페', 'https://example.com/fancafe', '↗', 1),
('SOOP 방송국', 'https://example.com/soop', '↗', 2),
('YouTube', 'https://example.com/youtube', '▶', 3),
('X / Twitter', 'https://example.com/x', 'X', 4);

insert into public.navigation_links (label, url, is_external, open_new_tab, sort_order) values
('프로필', '/', false, false, 1),
('일정', '/schedule/', false, false, 2),
('노래책', '/songs/', false, false, 3),
('룰렛', '/roulette/', false, false, 4),
('업보', '/work/', false, false, 5);

insert into public.schedule_categories (name, color, sort_order) values
('방송', '#9389DE', 1),
('휴방', '#9EA4B7', 2),
('이벤트', '#EDB3C8', 3),
('합방', '#7AA6E8', 4),
('대회', '#D7B06D', 5),
('기타', '#A9D79E', 6)
on conflict (name) do update set color=excluded.color, sort_order=excluded.sort_order;

insert into public.songs (title, artist, song_key, genre, note, sort_order) values
('Love wins all', 'IU', null, '발라드', null, 1),
('Ditto', 'NewJeans', null, 'K-POP', null, 2),
('INVU', 'TAEYEON', null, 'K-POP', '신청 가능', 3);

insert into public.site_texts (text_key, label, value, group_name, sort_order) values
('home_main_contents_label','컨텐츠 영문 라벨','Contents','홈',1),
('home_fandom_label','팬덤 브랜딩 영문 라벨','Fandom Branding','홈',2),
('home_fandom_title','팬덤 브랜딩 제목','팬덤 브랜딩','홈',3),
('home_milestone_label','여정 영문 라벨','MILESTONE','홈',4),
('home_milestone_title','여정 제목','키제의 여정','홈',5),
('home_archive_label','아카이브 영문 라벨','ARCHIVE','홈',6),
('home_archive_title','아카이브 제목','클립 및 다시보기','홈',7),
('home_archive_description','아카이브 설명','영상, 다시보기 및 노래커버, 그리고 추억을 차곡차곡 모아두는 공간입니다.','홈',8),
('home_signature_label','시그니처 영문 라벨','SIGNATURE','홈',9),
('home_signature_title','시그니처 제목','시그니처 풍선','홈',10),
('home_cta_label','홈 일정 CTA 라벨','SCHEDULE','홈',9),
('home_cta_title','홈 일정 CTA 문구','이번 달 일정과 다가오는 방송을 확인해 보세요.','홈',10),
('home_cta_button','홈 일정 CTA 버튼','일정 페이지 열기','홈',11),
('schedule_label','일정 영문 라벨','SCHEDULE','일정',1),
('schedule_title','일정 제목','방송 일정','일정',2),
('schedule_description','일정 설명','월간 방송 일정과 앞으로 일주일의 계획을 한눈에 확인할 수 있습니다.','일정',3),
('schedule_upcoming_label','다가오는 일정 라벨','UPCOMING SCHEDULES','일정',5),
('schedule_upcoming_title','다가오는 일정 제목','다가오는 일정','일정',6),
('schedule_upcoming_description','다가오는 일정 설명','오늘을 포함해 앞으로 7일간의 일정입니다.','일정',7),
('songbook_label','노래책 영문 라벨','SONGBOOK','노래책',1),
('songbook_title','노래책 제목','노래책','노래책',2),
('songbook_description','노래책 설명','키제가 부를 수 있는 곡을 장르별로 정리한 노래책입니다.','노래책',3),
('wardrobe_label','옷장 영문 라벨','CLOSET','룰렛/옷장',1),
('wardrobe_title','옷장 제목','키제의 옷장','룰렛/옷장',2),
('wardrobe_description','옷장 설명','이번 달 룰렛 의상과 지금까지의 헤어·의상을 한눈에 확인해 보세요.','룰렛/옷장',3),
('wardrobe_probability_button','룰렛 확률 버튼','룰렛확률 확인하기','룰렛/옷장',4),
('wardrobe_monthly_tab','이달의 의상 탭','이달의 의상','룰렛/옷장',5),
('wardrobe_existing_tab','기존 의상 탭','기존 의상','룰렛/옷장',6),
('wardrobe_outfit_tab','의상 탭','의상','룰렛/옷장',7),
('wardrobe_hair_tab','헤어 탭','헤어','룰렛/옷장',8),
('upbo_label','업보 영문 라벨','UPBO','업보',1),
('upbo_title','업보 제목','업보 현황','업보',2),
('upbo_description','업보 설명','SOOP 닉네임 또는 아이디로 검색하고 시청자별 룰렛 결과를 확인할 수 있습니다.','업보',3),
('upbo_search_placeholder','업보 검색 안내','SOOP 이름 또는 아이디 검색','업보',4)
on conflict (text_key) do update set label=excluded.label, value=excluded.value, group_name=excluded.group_name, sort_order=excluded.sort_order;

insert into public.wardrobe_items (name, period_type, item_type, description, sort_order) values
('이달의 기본 의상', 'monthly', 'outfit', '이번 달 룰렛 의상 예시입니다.', 1),
('기본 헤어', 'existing', 'hair', '헤어 이미지를 관리자에서 업로드해 주세요.', 2);

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
on conflict (text_key) do update set label=excluded.label, value=excluded.value, group_name=excluded.group_name, sort_order=excluded.sort_order;
