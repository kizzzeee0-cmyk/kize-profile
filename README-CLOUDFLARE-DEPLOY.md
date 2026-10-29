# KIZE Cloudflare Pages 설정

KIZE는 이제 Supabase를 런타임 저장소로 사용하지 않습니다.

- 공개/관리자 화면: Cloudflare Pages
- 관리자 API: Cloudflare Pages Functions
- 데이터: `public/site-data/data.json`
- 이미지: `public/site-media/`
- 영구 저장: GitHub Contents API
- 관리자 로그인: Cloudflare Secret `ADMIN_PASSWORD`

## Cloudflare Pages 빌드 설정

- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`

## 반드시 추가할 Variables and Secrets

Cloudflare Dashboard → Workers & Pages → kizeprofile → Settings → Variables and Secrets

### ADMIN_PASSWORD (Secret)
`https://kizeprofile.pages.dev/admin`에서 입력할 관리자 비밀번호입니다.

### GITHUB_TOKEN (Secret)
Fine-grained GitHub Personal Access Token을 사용합니다.

권장 범위:
- Resource owner: `kizzzeee0-cmyk`
- Repository access: Only select repositories → `kize-profile`
- Repository permissions → Contents: Read and write

### SESSION_SECRET (Secret, 권장)
32자 이상의 임의 문자열을 넣습니다. 생략하면 ADMIN_PASSWORD를 세션 암호화 키로 사용하지만 별도 값이 더 안전합니다.

아래 값은 코드 기본값이 있으므로 생략할 수 있습니다.
- GITHUB_OWNER = `kizzzeee0-cmyk`
- GITHUB_REPO = `kize-profile`
- GITHUB_BRANCH = `main`

## 기존 Supabase 데이터 1회 자동 이관

첫 배포의 `public/site-data/data.json`에는 `migration_pending: true`가 들어 있습니다.

기존 Cloudflare 설정에 아래 Supabase 값이 남아 있는 동안 첫 공개 데이터 요청이 기존 데이터를 읽어 GitHub JSON으로 한 번 이관합니다.

- `VITE_SUPABASE_URL` 또는 `SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` 또는 `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`가 있으면 비공개/숨김 데이터까지 이관하는 데 우선 사용합니다.

`GITHUB_TOKEN`이 설정된 상태에서 사이트를 한 번 연 뒤:

`https://kizeprofile.pages.dev/api/health`

에서 `migration_pending: false`가 되면 이관 완료입니다. 그때 기존 Supabase 관련 Cloudflare 변수를 삭제해도 됩니다.

## 상태 확인

`https://kizeprofile.pages.dev/api/health`

정상 예시:

```json
{
  "ok": true,
  "storage": "github-json",
  "configured": {
    "admin_password": true,
    "session_secret": true,
    "github_token": true
  },
  "migration_pending": false
}
```

관리자에서 데이터를 저장하면 GitHub JSON/이미지가 직접 수정됩니다. CMS 저장용 커밋에는 `[CF-Pages-Skip]`이 붙어 불필요한 전체 재배포를 피합니다.
