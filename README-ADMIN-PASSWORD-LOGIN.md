# 비밀번호 하나로 관리자 로그인하기

관리자 화면에는 이메일 입력칸이 없습니다. `/admin`에서 지정 비밀번호만 입력합니다.

## Cloudflare Pages 설정

Cloudflare Dashboard → Workers & Pages → kizeprofile → Settings → Variables and Secrets에서 아래 값을 확인합니다.

기존 공개 사이트용:
- `VITE_SUPABASE_URL` = Supabase Project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` = Supabase Publishable key

추가할 관리자 로그인용 서버 변수:
- `ADMIN_EMAIL` = Supabase Authentication에 이미 만들어 둔 관리자 이메일

`ADMIN_EMAIL`은 `VITE_`를 붙이지 않습니다. Pages Function에서만 사용됩니다.
관리자 비밀번호는 GitHub나 Cloudflare 변수에 저장하지 않고, Supabase Authentication에 설정된 해당 계정의 비밀번호를 그대로 사용합니다.

설정 후 Cloudflare에서 새 배포를 실행합니다.

## 데이터가 안 불러와질 때

Supabase Dashboard → SQL Editor에서 `supabase/fix-public-data-access-2026-10-30.sql`을 실행합니다.
이 migration은 기존 콘텐츠를 지우지 않고 공개 SELECT 권한/RLS 정책과 Signature 테이블을 보정합니다.
