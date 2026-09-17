# 기존 Supabase 연결 프로젝트 업데이트

이미 KIZE 사이트와 Supabase를 연결해서 사용 중이라면 **schema.sql / seed.sql을 다시 실행하지 마세요.**
기존 콘텐츠를 유지하면서 이번 기능만 추가하려면 아래 순서로 진행합니다.

1. Supabase Dashboard → SQL Editor → New query
2. `supabase/update-2026-09-18-readability-ordering.sql` 전체 내용을 붙여넣고 Run
3. 새 ZIP의 코드 파일 전체를 기존 로컬 프로젝트에 덮어쓰기
4. 기존 `.env.local`은 그대로 유지
5. `start-windows.bat` 다시 실행
6. 관리자 → 사이트 설정 → `달력 일정 제목 글씨 크기 (px)`에서 11~14 정도로 조절

이번 migration은 기존 데이터는 유지하고 다음을 처리합니다.

- 달력 일정 제목 크기 설정 추가
- 기존 sort_order를 1,2,3...으로 정리
- 이후 새 항목은 자동으로 마지막 순서에 추가
- 관리자 목록에서 ↑ / ↓ 로 순서 변경
- 기존 SOOP 업보 프로필 URL을 SOOP ID 기반 자동 이미지 주소로 정리

## Cloudflare 배포 후 SOOP 프로필 사진을 실제 Storage에도 자동 저장하려면

Cloudflare Pages → 프로젝트 → Settings → Environment variables에 서버 전용 값도 추가합니다.

- `SUPABASE_URL` = Supabase Project URL
- `SUPABASE_SECRET_KEY` = Supabase Secret key

이 값들은 **VITE_ 접두사를 붙이지 않습니다.** 브라우저 코드로 노출되면 안 됩니다.

배포 후 관리자가 SOOP 아이디를 저장하면 `/api/soop-profile-sync`가 해당 계정이 실제 관리자 계정인지 확인한 뒤 공개 SOOP 프로필 이미지 경로를 시도하고, 성공하면 `site-media/upbo/`에 복사하여 `upbo_people.profile_image_url`을 갱신합니다. 공개 이미지 경로를 찾지 못하면 기존 외부 이미지 연결 방식이 fallback으로 남습니다.

## WEFLAB

`/api/weflab-webhook` 수신 endpoint도 준비되어 있습니다. 다만 WEFLAB에서 공식적으로 외부 webhook URL/API와 payload 형식을 제공해야 실제 자동 적재를 켤 수 있습니다. 비공개 요청이나 로그인 세션을 긁는 방식은 사용하지 않습니다.
