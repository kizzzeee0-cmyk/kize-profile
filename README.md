# KIZE Profile

KIZE 스트리머 프로필 사이트입니다.

## 현재 저장 구조

이 버전은 외부 DB를 사용하지 않습니다.

- 공개 사이트: Cloudflare Pages
- 관리자 API: Cloudflare Pages Functions
- 콘텐츠 데이터: `public/site-data/data.json`
- 업로드 이미지: `public/site-media/`
- 영구 저장: GitHub Contents API
- 관리자 로그인: Cloudflare Secret의 지정 비밀번호

관리자에서 저장하면 Pages Function이 GitHub의 JSON/이미지 파일을 직접 갱신합니다.

## Cloudflare에 필요한 Secrets

필수:

- `ADMIN_PASSWORD`: `/admin`에서 입력할 비밀번호
- `GITHUB_TOKEN`: `kize-profile` 저장소 Contents 읽기/쓰기 권한이 있는 Fine-grained PAT

권장:

- `SESSION_SECRET`: 관리자 로그인 쿠키 암호화용 긴 랜덤 문자열. 비워두면 `ADMIN_PASSWORD`를 대신 사용합니다.

선택:

- `GITHUB_OWNER`: 기본값 `kizzzeee0-cmyk`
- `GITHUB_REPO`: 기본값 `kize-profile`
- `GITHUB_BRANCH`: 기본값 `main`
- `WEFLAB_WEBHOOK_TOKEN`: WEFLAB webhook을 연결할 때만 사용

## 배포

Cloudflare Pages 빌드 설정:

- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`

GitHub `main`에 새 커밋이 생기면 Cloudflare Pages가 다시 배포합니다.

## 데이터 파일

사이트의 CMS 데이터는 `public/site-data/data.json`에 있습니다. 관리자 화면을 통해 수정하는 것을 권장합니다.

기존 외부 DB 프로젝트는 이 사이트에서 더 이상 사용하지 않으므로 필요하면 별도 백업으로 남겨두면 됩니다.
