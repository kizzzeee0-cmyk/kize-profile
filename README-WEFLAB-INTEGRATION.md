# WEFLAB 자동 연동 준비 상태

프로젝트에는 Cloudflare Pages Function 기반 수신 endpoint가 포함되어 있습니다.

`POST /api/weflab-webhook`

현재 receiver가 이해하는 기본 JSON 예시는 다음과 같습니다.

```json
{
  "soop_id": "viewer_id",
  "soop_name": "시청자 닉네임",
  "result_label": "룰렛 결과",
  "quantity": 1
}
```

인증은 다음 중 하나를 사용합니다.

- Header: `x-webhook-token: YOUR_TOKEN`
- Query: `?token=YOUR_TOKEN`

서버 환경변수:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `WEFLAB_WEBHOOK_TOKEN`

동작:

1. SOOP 아이디로 기존 시청자를 찾음
2. 없으면 새 시청자 생성
3. 같은 룰렛 결과가 이미 있으면 수량을 더함
4. 처음 나온 룰렛 결과면 새 행 생성

중요: 2026-09-18 기준 WEFLAB 공개 FAQ/안내에서는 외부 webhook/API payload 규격을 확인하지 못했습니다. 따라서 endpoint 자체는 준비되어 있지만, WEFLAB이 외부로 이벤트를 보내는 공식 방법이 확인되어야 실제 자동 적재를 활성화할 수 있습니다. 로그인 세션을 긁거나 비공개 내부 API를 자동화하는 방식은 사용하지 않습니다.
