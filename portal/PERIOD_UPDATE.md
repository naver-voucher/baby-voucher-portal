# 매월 period.json 갱신 가이드

`portal/admin.html`에 흩어져 있던 "이번 달" 운영 데이터(14곳)를 `portal/period.json` 1개 파일로 통합했습니다.
매월 이번 달이 끝나기 1~2일 전, **이 파일 1곳만 수정**하면 어드민 화면 전체가 자동 갱신됩니다.

## 갱신할 필드 (총 13개 섹션)

1. **기본 메타** — `year`, `month`, `label`, `phase`, `phaseLabel`
2. **오픈/퇴점 일자** — `openDate`, `openDateText`, `exitDate`, `exitDateText`, `exitMonthLabel`
3. **마감 일자** — `contractDeadlineText`, `assetDeadlineText`, `submissionDeadlineText`
4. **브랜드 수** — `brandCount` (예: 188)
5. **dashboardCards** — 대시보드 카드 6개 (id/icon/iconBg/badge/title/desc/onclick)
6. **remindList** — 리마인드 발송 카드 (보통 3건)
7. **mailHistory** — 메일 발송 이력 (당월 발송분)
8. **announcements** — 공지 (당월 게시분, 최대 7건)
9. **checklistItems** — 최종검수 체크리스트 8건
10. **checklistStats** — 정상/확인필요/기타 카운트
11. **calendarTitle**, **calendarHeading** — 캘린더 상단 텍스트
12. **calendarEvents** — 캘린더 이번 달 + 다음 달 첫 주 일정
13. **formUrl** — 네이버 폼 URL (변경 시)

## 적용 절차

```bash
cd "/Users/user/Desktop/베이비바우처 운영 자동화"
# 1. period.json 수정
$EDITOR portal/period.json

# 2. 커밋
git add portal/period.json
git commit -m "feat(period): YYYY-MM 운영 데이터 갱신"

# 3. push (사내 git 차단 시 PR로 우회)
git push origin main
```

push 후 사내 GitHub Pages가 약 1~2분 내 자동 배포합니다.

## 검증 방법

1. admin.html을 브라우저로 엽니다.
2. 헤더의 "2026년 5월", 대시보드 카드 6개, 리마인드 카드, 메일 이력, 공지 목록, 체크리스트, 캘린더 일정이 모두 `period.json`의 값과 일치하는지 확인합니다.
3. 개발자도구 콘솔에 `[period.json] 로드 실패` 경고가 없는지 확인합니다.

## 알려진 한계

- **정산 섹션**(L3133~3192)은 이번 통합 범위가 아닙니다 — 별도 작업 예정.
- **운영 변수 input**(`varOpenDate`, `varExitDate`, `varExitMonth`)은 `period.json`에서 초기값을 채우지만, 사용자가 화면에서 수정한 값은 localStorage(`saveDatesToStorage()`)에 우선 저장됩니다. 새 달 적용 시에는 localStorage를 비우거나, period.json 갱신 후 새로고침으로 강제 반영을 권장합니다.
- 일부 동적 계산 필드(예: 진행률 %)는 JS에서 계산하므로 period.json에 없습니다.
- `data-bind`가 없는 fallback markup의 값은 JS 실패 시 그대로 보입니다 — 가능한 한 fallback도 최신 값으로 동기화해두는 것이 좋습니다.
