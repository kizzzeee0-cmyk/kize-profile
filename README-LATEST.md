# Latest profile update

이번 버전에서 추가된 기능:
- 원형 프로필 이미지 영역
- Birthday 자동 D-day / Debut 자동 D+ 표시
- MBTI + Fan Character 포함 6개 정보 카드
- Contents (소통 / 노래 / 종합게임)
- Signature 이미지 6~12칸 갤러리
- 일정 월 이동 화살표를 년월 양옆으로 배치
- 팬카페 / SOOP / YouTube 짧은 버튼명

기존 Supabase 프로젝트를 사용 중이라면 아래 SQL을 한 번 실행하세요.

`supabase/add-signature-profile-polish.sql`

Supabase Dashboard → SQL Editor → New Query → 파일 전체 붙여넣기 → Run

Signature 이미지는 `/admin/profile`의 `Signature 이미지 (최대 12장)`에서 관리합니다.
권장 이미지 비율은 293×248이며 공개 페이지에서는 `object-fit: contain`으로 잘리지 않게 표시됩니다.


## Latest cleanup
- Schedule page: removed the Today button under the month.
- Public profile facts are back to Birthday / Debut / Live Time / Off-Day only.
- Contents section removed.
- Signature cards are smaller and use the 293×159 aspect ratio without cropping.
- Milestone heading centered.
- Kize journey / Archive / Songbook / Closet / Upbo title sizing matches Broadcast Schedule.
- Upcoming Schedule title uses a slightly lighter weight.
- Demo Birthday: 09.22, Demo Debut: 2026.04.01, so D-day badges are visible immediately.

## Latest polish
- `MONTHLY CALENDAR` label removed from the public schedule page.
- `기타` schedule category now uses `#A9D79E` light green.
- Signature subtitle `시그니처 풍선` added and editable in `/admin/texts`.
- `키제의 여정` and `아카이브` titles use the same weight as `다가오는 일정`.
- Existing Supabase users: run `supabase/update-signature-heading-calendar-color.sql`.


## Latest polish
- Increased spacing between the four profile info cards and Signature.
- Live Time / Off-Day descriptions remain editable in Admin > Profile and render slightly bolder.
- Removed auxiliary descriptive sentences from Archive, Schedule, Upcoming, Songbook, Closet, and Upbo public headings.
- Added a little extra top breathing room to Schedule / Songbook / Closet / Upbo pages.


## Latest micro polish
- ARCHIVE title default: `클립 및 다시보기`
- Signature heading-to-image spacing slightly increased
- SOOP shortcut button changed to sky-blue palette
- Inner page top spacing slightly reduced
- Existing Supabase: run `supabase/update-archive-title-soop-polish.sql` once to update the stored Archive title.

## 2026-09-18 schedule/admin/deploy update
- Calendar event: time and title are now on the same line.
- Calendar time text is larger/bolder; event title size is adjustable in Admin > Site Settings (8–20px).
- Upcoming schedule table text is larger and heavier for readability.
- Manual sort-order number inputs are hidden in generic CMS editors; new items append automatically and ↑/↓ buttons reorder them.
- Upbo viewer/result ordering also uses automatic order + ↑/↓ controls.
- Upbo profile images are derived automatically from the SOOP ID with fallback URL patterns; manual image upload is no longer required.
- Cloudflare Pages webhook receiver scaffold added at `/api/weflab-webhook` for future WEFLAB integration.
- Existing Supabase users: run `supabase/update-2026-09-18-readability-ordering.sql` once.
- Deployment instructions: `README-CLOUDFLARE-DEPLOY.md`.

## 2026-09-18 일정 가독성 / 관리자 정렬 / SOOP·WEFLAB 준비 업데이트

- 달력 일정: 시간 + 제목을 한 줄로 표시
- 시간은 더 크고 굵게, 제목은 더 크게 표시
- 관리자 사이트 설정에서 달력 제목 글씨 크기(px) 조절 가능
- 다가오는 일정 표 전체 글씨 크기/굵기 강화
- sort_order 직접 입력 제거: 새 항목 자동 마지막 추가 + ↑ / ↓ 재정렬
- 업보 시청자: SOOP ID 입력만으로 프로필 이미지 자동 연결
- Cloudflare 배포 + 서버 환경변수 설정 시 SOOP 프로필 이미지를 Supabase Storage에 자동 복사하는 `/api/soop-profile-sync` 포함
- WEFLAB 수신 endpoint `/api/weflab-webhook` 준비. 공식 outbound webhook/API payload 확인 후 실제 자동 연결 가능
- 기존 Supabase 업데이트용 `supabase/update-2026-09-18-readability-ordering.sql` 포함
- Cloudflare Pages 배포 가이드 `README-CLOUDFLARE-DEPLOY.md` 포함
