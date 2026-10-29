# WEFLAB 연동 준비

Webhook 수신 주소:

```text
https://kizeprofile.pages.dev/api/weflab-webhook
```

Cloudflare Secret `WEFLAB_WEBHOOK_TOKEN`을 설정하면 Bearer token으로 요청을 검증합니다.
수신 데이터는 GitHub의 `public/site-data/data.json` 안 `upbo_people`, `upbo_results`에 저장됩니다.
WEFLAB의 실제 공식 webhook payload 형식이 확인되면 필드 매핑만 조정하면 됩니다.
