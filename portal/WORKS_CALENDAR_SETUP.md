# WORKS 캘린더 단방향 sync 세팅

이 저장소는 매시간(GitHub Actions) WORKS 캘린더 일정을 `portal/events.json` 으로 가져와 `admin.html` 에 표시한다.

## 흐름

```
WORKS 캘린더
   │ (1h 주기)
   ▼
GitHub Actions: works-calendar-sync.yml
   └─ scripts/sync-works-calendar.mjs
        └─ portal/events.json (commit)
              ▼
        admin.html (fetch)
```

## 최초 1회 세팅

### 1. WORKS_BEARER_TOKEN 발급
- WORKS 개발자 콘솔에서 캘린더 read scope를 가진 Bot/Service Account 토큰을 발급한다.
- (대안) 본인 OAuth 토큰을 발급해도 무방하나 만료 시 재등록 필요.

### 2. WORKS_CALENDAR_ID 확인
- WORKS 웹에서 "베이비바우처 운영" 캘린더 → 설정 → URL/식별자 확인.
- 본인 기본 캘린더면 `defaultCalendarId` 그대로 사용해도 됨.

### 3. GitHub Secrets 등록
Repo → Settings → Secrets and variables → Actions → **New repository secret**

| Name | Value |
|---|---|
| `WORKS_BEARER_TOKEN` | (1)에서 받은 토큰 |
| `WORKS_CALENDAR_ID` | (2)에서 확인한 ID (옵션) |

### 4. 워크플로 수동 1회 실행
- Repo → Actions → "Works Calendar Sync" → **Run workflow**
- 성공 시 `portal/events.json` 이 commit 됨.
- `portal/admin.html` 열어서 "이번 달 일정"에 Works 뱃지가 붙은 항목이 보이면 OK.

## 자동 실행
- cron: `0 * * * *` (매시간 정각, UTC).
- 변경사항이 없으면 commit 하지 않으므로 히스토리 오염 없음.

## events.json 스키마
```ts
interface EventItem {
  date: string;        // YYYY-MM-DD
  weekday: string;     // 월~일
  title: string;
  color: "blue"|"red"|"green"|"orange"|"purple";
  source: "works";
  worksEventId: string;
}
```

## 트러블슈팅

| 증상 | 원인 / 조치 |
|---|---|
| Actions 401/403 | `WORKS_BEARER_TOKEN` 만료. 재발급 후 Secret 갱신. |
| `events.json` 비어 있음 | `WORKS_CALENDAR_ID` 가 잘못됐거나, 해당 기간에 일정이 없음. 워크플로 로그 확인. |
| 두 endpoint 모두 실패 | WORKS API spec 변경 가능성. `scripts/sync-works-calendar.mjs` 의 `tryWorksApi` / `tryMcpGateway` 함수 갱신. |
| admin.html 에 Works 일정 안 보임 | `events.json` 이 정상 commit 됐는지 확인, 브라우저 캐시 강제 새로고침. |
| 사내 oss.navercorp.com Actions 미지원 | 운영팀에 self-hosted runner 등록 요청 또는 로컬 cron 으로 대체. |

## 알려진 한계
- WORKS API endpoint는 두 가지를 fallback 으로 시도하지만, 실제 사내 spec 과 다를 수 있음 (필드명/응답 구조 보정 필요할 수 있음).
- 단방향(WORKS → portal)만 지원. portal 에서 캘린더 추가/수정은 WORKS 에 반영되지 않음.
- 사내 oss.navercorp.com 의 GitHub Actions 지원 여부는 인스턴스 설정에 따라 다름.
