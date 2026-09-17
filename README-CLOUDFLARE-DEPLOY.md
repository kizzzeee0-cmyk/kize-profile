# KIZE Profile — Cloudflare Pages 배포 가이드

이 프로젝트는 React + Vite + Supabase 구조입니다.

## 0. 기존 Supabase 프로젝트를 계속 사용할 때

Supabase Dashboard → SQL Editor → New query에서 아래 파일을 한 번 실행하세요.

`supabase/update-2026-09-18-readability-ordering.sql`

이 SQL은 기존 콘텐츠를 지우지 않고 다음만 추가/정리합니다.

- 달력 일정 제목 글씨 크기 설정 컬럼 추가
- 기존 정렬 순서를 1, 2, 3... 형태로 정리
- SOOP 아이디 기반 프로필 이미지 URL 갱신

## 1. 로컬 환경변수

프로젝트 루트의 `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxx
```

`SUPABASE_SECRET_KEY`는 절대로 `.env.local`의 `VITE_` 변수로 넣지 마세요.

## 2. GitHub 업로드

1. GitHub에서 새 저장소를 만듭니다. 예: `kizeprofile`
2. 이 프로젝트 폴더 안의 파일 전체를 저장소 루트에 올립니다.
3. `.env.local`은 올리지 않습니다. `.gitignore`에 이미 제외되어 있습니다.

## 3. Cloudflare Pages

Cloudflare Dashboard → Workers & Pages → Create application → Pages → Import an existing Git repository

설정값:

- Project name: `kizeprofile` (사용 가능할 때 `kizeprofile.pages.dev`가 됩니다)
- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`

## 4. Cloudflare 환경변수

Pages 프로젝트 → Settings → Environment variables 에 다음 2개를 Production에 추가합니다.

- `VITE_SUPABASE_URL` = Supabase Project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` = Supabase Publishable key

저장 후 새 배포를 실행합니다.

## 5. Supabase Auth Redirect URL

실제 배포 주소가 정해진 뒤 Supabase Dashboard → Authentication → URL Configuration에서:

- Site URL: `https://kizeprofile.pages.dev`
- Redirect URLs에 `https://kizeprofile.pages.dev/**` 추가
- 로컬 테스트도 계속할 경우 `http://localhost:5173/**`, 실제 Vite가 5176으로 뜬다면 `http://localhost:5176/**`도 추가

프로젝트 이름이 달라졌다면 실제 Pages 주소로 바꿔 입력하세요.

## 6. WEFLAB webhook 준비 기능을 사용할 때만

Cloudflare Pages 프로젝트의 서버 측 환경변수에 다음을 추가합니다.

- `SUPABASE_URL` = Supabase Project URL
- `SUPABASE_SECRET_KEY` = Supabase Secret key (서버 전용)
- `WEFLAB_WEBHOOK_TOKEN` = 본인이 만든 충분히 긴 임의 문자열

`SUPABASE_URL` + `SUPABASE_SECRET_KEY`는 SOOP ID 저장 시 프로필 사진을 Supabase Storage로 자동 복사하는 `/api/soop-profile-sync`에도 사용됩니다. `SUPABASE_SECRET_KEY`에는 절대로 `VITE_`를 붙이지 마세요.

Webhook endpoint:

`https://kizeprofile.pages.dev/api/weflab-webhook?token=YOUR_TOKEN`

주의: 이 endpoint는 준비되어 있지만, WEFLAB 공개 문서에서 외부 webhook 전송 규격을 확인하지 못했습니다. WEFLAB이 실제로 webhook URL과 payload를 제공할 때 그 형식에 맞춰 연결해야 완전 자동화됩니다.
