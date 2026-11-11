# NAMRA Weflab receiver bridge

이 폴더의 `bridge.py`는 **위플랩 프로토콜을 추측하거나 우회해서 접속하는 프로그램이 아닙니다.**

공개적으로 확인 가능한 자료에서는 Weflab 후원 알림 URL을 입력한 외부 모니터링 프로그램이 웹소켓 연결을 유지하고,
다음 데이터를 반환하는 사례가 확인됩니다.

- 룰렛 이름
- 후원자 SOOP ID
- 별풍선 값
- 실제 당첨 룰렛 항목
- count = 1
- 프리셋 목록
- 모니터링/웹소켓 연결 상태

참고:
- https://wikidocs.net/284503
- https://wikidocs.net/284505

하지만 해당 외부 프로그램의 Weflab 웹소켓 프로토콜/패킷 사양은 공개 문서에서 확인되지 않았습니다.
따라서 이 저장소에는 검증되지 않은 Weflab 직접 접속 코드를 넣지 않습니다.

## 이 브리지가 하는 일

1. 사이트의 관리자 설정을 주기적으로 확인
2. 서버가 암호화 보관한 Weflab 알림 URL을 수신기 인증 후 가져옴
3. 승인된 로컬 source adapter가 넘긴 이벤트를 로컬 큐에 영구 저장
4. `bridge_event_id`를 생성해 재전송에도 같은 ID 유지
5. 최대 50건씩 묶어서 사이트 `/api/roulette/ingest`로 전송
6. 네트워크 실패 시 큐에 남겨 재시도
7. 실제 source adapter가 보고한 웹소켓/모니터링 상태를 서버에 전달

## 실행

1. 관리자 > 업보 관리 > 위플랩 연동에서 **수신기 인증키 생성**
2. `receiver-config.example.json`을 `receiver-config.json`으로 복사
3. 인증키 입력
4. Windows에서:

```powershell
py bridge.py --config receiver-config.json
```

`receiver-config.json`과 `receiver-queue.jsonl`은 Git에 올리지 마세요.

## 로컬 source adapter 계약

브리지는 기본적으로 `127.0.0.1:18088`에서만 대기합니다.

### 실제 당첨 이벤트

`POST http://127.0.0.1:18088/event`

```json
{
  "source_event_id": "원본 이벤트 ID가 있으면 전달",
  "roulette_name": "룰렛 이름",
  "donor_soop_id": "SOOP 고유 ID",
  "donor_display_name": "표시 닉네임",
  "item_name": "실제 당첨 항목",
  "count": 1,
  "occurred_at": "2026-11-11T10:30:00+09:00",
  "preset_items": ["항목A", "항목B"]
}
```

원본 이벤트 ID가 없다면 브리지가 최초 수신 시 `bridge_event_id`를 생성해 로컬 큐에 저장합니다.
서버 재전송 시 같은 ID가 유지되므로 네트워크 재시도로 인한 중복 증가를 막습니다.

### 프리셋

`POST http://127.0.0.1:18088/preset`

```json
{
  "roulette_name": "룰렛 이름",
  "items": ["노래 1곡", "그림 선물", "꽝"]
}
```

### 실제 소스 연결 상태

`POST http://127.0.0.1:18088/source-status`

```json
{
  "monitoring": true,
  "websocket_connected": true,
  "source_verified": true,
  "state": "receiving",
  "error": ""
}
```

**source_verified=true는 실제 Weflab 데이터를 읽는 승인된 adapter가 연결 검증을 끝낸 경우에만 사용해야 합니다.**
브리지만 켜져 있다고 정상 수신 상태로 만들면 안 됩니다.

## 현재 필요한 마지막 연결 조각

실제 Weflab 웹소켓을 읽는 source adapter입니다.

다음 중 하나가 있어야 안전하게 완성할 수 있습니다.

- Weflab 공식 이벤트/API 문서
- Weflab이 허용한 연동 방식
- 사용 권한이 있는 기존 모니터링 프로그램의 문서화된 로컬 출력 규격
- 실제 후원 알림 URL을 이용한 승인된 테스트 환경과 패킷 사양

이 중 하나가 확보되기 전에는 직접 Weflab 프로토콜을 추측해서 구현하지 않습니다.
