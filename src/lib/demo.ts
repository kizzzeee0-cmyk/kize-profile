import type { PublicData, SongItem, WardrobeItem, UpboPerson, UpboResult } from '../types'

export const demoData: PublicData = {
  settings: {
    id: 'demo-settings',
    site_title: 'KIZE',
    site_description: '깔끔하고 단정한 버추얼 스트리머 키제 프로필',
    brand_color: '#9389DE',
    footer_text: '© 2026 KIZE. ALL RIGHTS RESERVED.',
    logo_text: 'KIZE',
    favicon_url: '/kize-favicon.png',
    seo_image_url: null,
    dark_mode_enabled: true,
    roulette_probability_url: '#',
    calendar_event_title_size: 12,
  },
  profile: {
    id: 'demo-profile',
    korean_name: '키제',
    english_name: 'KIZE',
    since_date: '2026-01-01',
    badge_text: 'SOOP STREAMER',
    intro: '차분한 분위기 속에서 소통, 종합게임, 노래를 함께 즐기는 버추얼 스트리머 키제입니다.\n메인 프로필과 일정, 아카이브를 깔끔하게 정리해 보여주는 페이지예요.',
    profile_image_url: null,
    fandom_name: '예시 팬네임',
    fandom_character_name: '예시 팬캐릭터',
    fandom_description: '팬네임, 팬캐릭터 소개, 브랜딩 설정을 관리자 페이지에서 자유롭게 적을 수 있습니다.\n방송국에서 사용하는 명칭이나 간단한 세계관 설명도 함께 정리해 보세요.',
    fandom_image_url: null,
  },
  stats: [
    { id: 's1', label: 'Birthday', value: '09 . 22', description: null, sort_order: 1, is_visible: true },
    { id: 's2', label: 'Debut', value: '2026 . 04 . 01', description: null, sort_order: 2, is_visible: true },
    { id: 's3', label: 'Live Time', value: '17 : 00', description: '일정에 따라 변경될 수 있습니다.', sort_order: 3, is_visible: true },
    { id: 's4', label: 'Off-Day', value: '-', description: '자세한 일정은 스케줄 페이지를 확인해 주세요.', sort_order: 4, is_visible: true },
  ],
  features: [
    { id: 'f1', icon: '☁', title: '소통', description: '', sort_order: 1, is_visible: true },
    { id: 'f2', icon: '♫', title: '노래', description: '', sort_order: 2, is_visible: true },
    { id: 'f3', icon: '✦', title: '종합게임', description: '', sort_order: 3, is_visible: true },
  ],
  socialLinks: [
    { id: 'sl1', name: '공식 팬카페', url: '#', icon: '↗', sort_order: 1, is_visible: true },
    { id: 'sl2', name: 'SOOP 방송국', url: '#', icon: '↗', sort_order: 2, is_visible: true },
    { id: 'sl3', name: 'YouTube', url: '#', icon: '▶', sort_order: 3, is_visible: true },
  ],
  navigationLinks: [
    { id: 'n1', label: '프로필', url: '/', is_external: false, open_new_tab: false, sort_order: 1, is_visible: true },
    { id: 'n2', label: '일정', url: '/schedule/', is_external: false, open_new_tab: false, sort_order: 2, is_visible: true },
    { id: 'n3', label: '노래책', url: '/songs/', is_external: false, open_new_tab: false, sort_order: 3, is_visible: true },
    { id: 'n4', label: '룰렛', url: '/roulette/', is_external: false, open_new_tab: false, sort_order: 4, is_visible: true },
    { id: 'n5', label: '업보', url: '/work/', is_external: false, open_new_tab: false, sort_order: 5, is_visible: true },
  ],
  milestones: [
    { id: 'm1', date: '2026-01-01', title: '첫 방송', description: '키제의 방송 여정을 이 타임라인에 차곡차곡 기록해 보세요.', image_url: null, external_url: null, is_highlight: true, sort_order: 1, is_visible: true },
  ],
  archives: [],
  categories: [
    { id: 'c1', name: '방송', color: '#9389DE', sort_order: 1, is_visible: true },
    { id: 'c2', name: '휴방', color: '#9EA4B7', sort_order: 2, is_visible: true },
    { id: 'c3', name: '이벤트', color: '#EDB3C8', sort_order: 3, is_visible: true },
    { id: 'c4', name: '합방', color: '#7AA6E8', sort_order: 4, is_visible: true },
    { id: 'c5', name: '대회', color: '#D7B06D', sort_order: 5, is_visible: true },
    { id: 'c6', name: '기타', color: '#A9D79E', sort_order: 6, is_visible: true },
  ],
  siteTexts: [
    { id:'t1', text_key:'home_main_contents_label', label:'컨텐츠 영문 라벨', value:'Contents', group_name:'홈', sort_order:1 },
    { id:'t4', text_key:'home_milestone_label', label:'여정 영문 라벨', value:'MILESTONE', group_name:'홈', sort_order:4 },
    { id:'t5', text_key:'home_milestone_title', label:'여정 제목', value:'키제의 여정', group_name:'홈', sort_order:5 },
    { id:'t6', text_key:'home_archive_label', label:'아카이브 영문 라벨', value:'ARCHIVE', group_name:'홈', sort_order:6 },
    { id:'t7', text_key:'home_archive_title', label:'아카이브 제목', value:'클립 및 다시보기', group_name:'홈', sort_order:7 },
    { id:'t8', text_key:'home_archive_description', label:'아카이브 설명', value:'영상, 다시보기 및 노래커버, 그리고 추억을 차곡차곡 모아두는 공간입니다.', group_name:'홈', sort_order:8 },
    { id:'tsig', text_key:'home_signature_label', label:'시그니처 영문 라벨', value:'SIGNATURE', group_name:'홈', sort_order:9 },
    { id:'tsig2', text_key:'home_signature_title', label:'시그니처 제목', value:'시그니처 풍선', group_name:'홈', sort_order:10 },
    { id:'t9', text_key:'schedule_label', label:'일정 영문 라벨', value:'SCHEDULE', group_name:'일정', sort_order:1 },
    { id:'t10', text_key:'schedule_title', label:'일정 제목', value:'방송 일정', group_name:'일정', sort_order:2 },
    { id:'t11', text_key:'schedule_description', label:'일정 설명', value:'월간 방송 일정과 앞으로 일주일의 계획을 한눈에 확인할 수 있습니다.', group_name:'일정', sort_order:3 },
    { id:'t13', text_key:'schedule_upcoming_label', label:'다가오는 일정 라벨', value:'UPCOMING SCHEDULES', group_name:'일정', sort_order:5 },
    { id:'t14', text_key:'schedule_upcoming_title', label:'다가오는 일정 제목', value:'다가오는 일정', group_name:'일정', sort_order:6 },
    { id:'t15', text_key:'songbook_label', label:'노래책 영문 라벨', value:'SONGBOOK', group_name:'노래책', sort_order:1 },
    { id:'t16', text_key:'songbook_title', label:'노래책 제목', value:'노래책', group_name:'노래책', sort_order:2 },
    { id:'t17', text_key:'songbook_description', label:'노래책 설명', value:'키제가 부를 수 있는 곡을 장르별로 정리한 노래책입니다.', group_name:'노래책', sort_order:3 },
    { id:'t18', text_key:'wardrobe_label', label:'옷장 영문 라벨', value:'CLOSET', group_name:'룰렛/옷장', sort_order:1 },
    { id:'t19', text_key:'wardrobe_title', label:'옷장 제목', value:'키제의 옷장', group_name:'룰렛/옷장', sort_order:2 },
    { id:'t20', text_key:'wardrobe_description', label:'옷장 설명', value:'이번 달 룰렛 의상과 지금까지의 헤어·의상을 한눈에 확인해 보세요.', group_name:'룰렛/옷장', sort_order:3 },
    { id:'t21', text_key:'wardrobe_probability_button', label:'룰렛 확률 버튼', value:'룰렛확률 확인하기', group_name:'룰렛/옷장', sort_order:4 },
    { id:'t22', text_key:'upbo_label', label:'업보 영문 라벨', value:'UPBO', group_name:'업보', sort_order:1 },
    { id:'t23', text_key:'upbo_title', label:'업보 제목', value:'업보 현황', group_name:'업보', sort_order:2 },
    { id:'t24', text_key:'upbo_description', label:'업보 설명', value:'SOOP 닉네임 또는 아이디로 검색하고 시청자별 룰렛 결과를 확인할 수 있습니다.', group_name:'업보', sort_order:3 },
  ],
  signatures: [
    { id:'sig1', image_url:'', title:'Signature 01', sort_order:1, is_visible:true },
    { id:'sig2', image_url:'', title:'Signature 02', sort_order:2, is_visible:true },
    { id:'sig3', image_url:'', title:'Signature 03', sort_order:3, is_visible:true },
    { id:'sig4', image_url:'', title:'Signature 04', sort_order:4, is_visible:true },
    { id:'sig5', image_url:'', title:'Signature 05', sort_order:5, is_visible:true },
    { id:'sig6', image_url:'', title:'Signature 06', sort_order:6, is_visible:true },
  ],
}

export const demoSongs: SongItem[] = [
  { id: 'song1', title: 'Love wins all', artist: 'IU', song_key: null, genre: '발라드', note: null, sort_order: 1, is_visible: true },
  { id: 'song2', title: 'Ditto', artist: 'NewJeans', song_key: null, genre: 'K-POP', note: null, sort_order: 2, is_visible: true },
  { id: 'song3', title: 'INVU', artist: 'TAEYEON', song_key: null, genre: 'K-POP', note: '신청 가능', sort_order: 3, is_visible: true },
]

export const demoWardrobe: WardrobeItem[] = [
  { id:'w1', name:'이달의 기본 의상', period_type:'monthly', item_type:'outfit', image_url:null, description:'이번 달 룰렛에서 등장하는 의상 예시입니다.', sort_order:1, is_visible:true },
  { id:'w2', name:'기본 헤어', period_type:'existing', item_type:'hair', image_url:null, description:'관리자 페이지에서 이미지를 업로드해 주세요.', sort_order:2, is_visible:true },
]

export const demoUpboPeople: UpboPerson[] = [
  { id:'u1', soop_name:'예시 시청자', soop_id:'example_soop', profile_image_url:null, note:null, sort_order:1, is_visible:true },
]

export const demoUpboResults: UpboResult[] = [
  { id:'ur1', person_id:'u1', result_label:'노래 1곡', quantity:2, note:null, sort_order:1 },
  { id:'ur2', person_id:'u1', result_label:'공포게임 30분', quantity:1, note:null, sort_order:2 },
]
