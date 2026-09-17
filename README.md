# KIZE Profile — Pretendard + Songbook + Wardrobe + Upbo

키제(KIZE)를 위한 프로필 / 일정 / 노래책 / 룰렛 옷장 / 업보 / 관리자 CMS 프로젝트입니다.

## 이번 버전 핵심

- 전체 폰트: **Pretendard** (눈누 font_page/694의 웹폰트 소스)
- 상단 메뉴 순서: **프로필 → 일정 → 노래책 → 룰렛 → 업보**
- 홈: Birthday / Debut / Live Time / Off-Day 바로 아래에 **Main Contents + Fandom Branding** 배치
- `/songs/`: 장르별 노래책
- `/roulette/`: 이달의 의상 / 기존 의상, 의상 / 헤어 분류, 이미지 갤러리, `룰렛확률 확인하기` 외부 링크 버튼
- `/work/`: SOOP 이름/아이디 검색, 프로필 이미지, 시청자별 룰렛 결과와 개수 표시
- `/admin/texts`: 공개 페이지의 섹션 제목/설명/버튼 문구 관리
- `/admin/wardrobe`: 옷장 이미지 및 분류 관리
- `/admin/upbo`: SOOP 시청자 및 룰렛 결과/개수 관리
- `/admin/settings`: 룰렛 확률 URL 포함 사이트 설정

## Supabase를 아직 연결하지 않았다면

1. `supabase/schema.sql`
2. `supabase/seed.sql`
3. 관리자 계정 생성 후 `supabase/make-first-admin.sql`

순서대로 실행합니다.

## 기존 버전에 이미 Supabase를 연결했다면

기존 DB를 삭제하지 말고 Supabase → SQL Editor에서 아래 파일을 **한 번만** 실행하세요.

`supabase/add-wardrobe-upbo-texts.sql`

이 파일은 다음을 추가합니다.

- site_texts
- wardrobe_items
- upbo_people
- upbo_results
- roulette_probability_url
- 메뉴 순서 및 내부 링크 업데이트

기존 노래책 테이블이 없다면 `supabase/add-songbook.sql`도 먼저/추가로 실행하세요.

## 문구를 어디에서 수정하나요?

- 이름/소개/팬네임/팬캐릭터: `/admin/profile`
- Birthday/Debut/Live Time/Off-Day: `/admin/profile`
- Main Contents: `/admin/profile`
- 상단 메뉴명/순서/주소: `/admin/navigation`
- 섹션명, 설명, 버튼 문구: `/admin/texts`
- Footer/로고/사이트 제목/룰렛확률 URL: `/admin/settings`
- 일정 카테고리명/색: `/admin/settings`
- 노래책: `/admin/songs`
- 룰렛 옷장: `/admin/wardrobe`
- 업보 사용자 및 결과: `/admin/upbo`

## WEFLAB 자동 연동에 대해

현재 프로젝트는 **수동 업보 등록/관리까지 완성**되어 있습니다. WEFLAB의 공개 문서에서 외부 사이트로 매 후원/룰렛 결과를 전달하는 공식 webhook/API 규격을 확인할 수 없어 자동 입력은 기본 활성화하지 않았습니다.

WEFLAB 측에서 사용할 수 있는 webhook URL, API 문서, 토큰 또는 실제 전송 payload 예시를 제공받으면 `upbo_people` / `upbo_results`에 자동 저장하는 Supabase Edge Function을 추가할 수 있습니다.

## 로컬 실행

Windows: `start-windows.bat` 더블클릭

또는:

```bash
npm install
npm run dev
```

개발 주소는 `http://localhost:5173/` 또는 사용 가능한 다음 포트로 표시됩니다.

## 2026-09-17 latest update

- 홈 이름 `키제 KIZE` 가로 배치
- 팬카페 / SOOP / YouTube 3개 바로가기 카드
- 홈 하단 Schedule CTA 제거
- 첨부 캐릭터 얼굴을 기본 favicon으로 추가 (`/public/kize-favicon.png`)
- 옷장 영문 라벨 기본값을 `CLOSET`으로 변경
- 업보 공개 페이지는 시청자 요약 목록 → 클릭 상세 룰렛 결과 구조
- 일정 페이지의 방송 일정 / 년월 / 다가오는 일정 제목 크기 축소

기존 Supabase 프로젝트를 이미 사용 중이면 `supabase/update-latest-ui.sql`을 SQL Editor에서 한 번 실행하세요. 기존 옷장 영문 라벨을 `CLOSET`으로 바꾸고 YouTube 바로가기 행이 없다면 추가합니다.
