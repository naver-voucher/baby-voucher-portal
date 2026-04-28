# 베이비바우처 파트너 포털 운영 매뉴얼

> 대상: 네이버 베이비바우처 사업 담당자
> 목적: 담당자가 바뀌어도 서비스가 끊기지 않도록 권한·데이터·복구 절차를 한 문서에 고정한다.

---

## 1. 시스템 구성 한눈에 보기

```
[판매자]  ──▶  seller.html (GitHub Pages / 내부 웹 호스팅)
                    │  fetch (POST/GET, text/plain)
                    ▼
             Apps Script Web App  ──▶  Google Shared Drive (원본 저장)
                    │                  └─ YYYY-MM / 브랜드명 / logo·shot·brandDesc
                    │                  └─ _exports / YYYY-MM_베이비바우처_*.zip
                    ▼
             Google Sheet (Submissions / Inquiries / Exports)
                    ▲
                    │  GET ?kind=...
                    │
[관리자]  ──▶  admin.html
             └─ 월별 아카이브 → ZIP 다운로드 → nDrive 드래그 (월 1회)
```

- **원본 저장소**: 공유 드라이브 1곳 (개인 드라이브 금지)
- **감사 로그**: Google Sheet 3탭 (Submissions, Inquiries, Exports)
- **장기 보관**: nDrive 공유 폴더에 월별 ZIP 수동 업로드 (5분/월)

---

## 2. 권한 매트릭스

| 리소스 | 소유자 | 편집자 | 비고 |
|---|---|---|---|
| GitHub 저장소 (seller/admin.html) | 팀 org | 사업 담당자 2인 | public 저장소에 admin.html 절대 커밋 금지 |
| Apps Script 프로젝트 | **공유 드라이브** 내 이동 필요 | 담당자 2인 이상 | 개인 드라이브에 두지 말 것 |
| Google Shared Drive `베이비바우처_파트너_운영` | 팀 공유 드라이브 관리자 | 담당자 2인 이상 | `ROOT_FOLDER_ID` 이 드라이브 참조 |
| Google Sheet `BV_Partner_DB` | 공유 드라이브 | 담당자 2인 이상 | Apps Script가 쓴다 |
| nDrive 공유 폴더 | 팀 공용 계정 | 담당자 전원 | 월별 ZIP 백업 저장소 |
| 메일링리스트 `dl_babyvoucher@` | 사업팀 | - | 문의·교체 알림 수신처 |

**핵심 원칙**: 모든 리소스는 최소 2명 이상이 편집 권한을 보유해야 하며, 개인 계정 단독 소유 금지.

---

## 3. 정기 운영 업무

### 매월 (예시: 5월 에셋 기준)

| 날짜 | 업무 | 문서 |
|---|---|---|
| D-14 (매월 10일) | seller.html 에서 브랜드사별 링크 발송 | admin > 제출 현황 > 전체 링크 복사 |
| D-7 (매월 17일) | 미제출사 리마인드 메일 발송 | admin > 메일 템플릿 `리마인드` |
| **D-Day (매월 24일 14시)** | **마감** — 미제출 브랜드 개별 확인 | admin > 제출 현황 |
| D+1 (매월 25일) | **월별 ZIP 다운로드 → nDrive 업로드** | admin > 월별 아카이브 |
| D+1 (매월 25일) | 다음달 에셋 등록 완료 + 판매자 노티 메일 발송 | admin > 메일 템플릿 `에셋 등록 완료` |

### 분기·반기

- 분기 1회: 권한 매트릭스 점검 (퇴사·이동자 제거)
- 반기 1회: Apps Script 배포 버전 갱신 + 테스트 제출 1건

---

## 4. 장애 대응 플레이북

### 4.1 판매자가 "제출이 안 돼요"

1. admin > 제출 현황에서 해당 브랜드 상태 확인
2. Apps Script > 실행 로그 (`보기 > 실행`) 에서 에러 확인
3. 해결되지 않으면 → seller.html URL을 담당자가 직접 열어 재현
4. 임시 우회: 이메일로 파일 수신 → admin 에서 수기 업로드 (브랜드 폴더에 직접 업로드)

### 4.2 Apps Script 권한 만료 (`Authorization required`)

1. Apps Script 편집기 열기 → 임의 함수 실행 → 권한 재승인
2. 웹앱 배포 URL 이 바뀌면 admin.html 의 `bv_apps_script_url` (localStorage) 갱신

### 4.3 Google Shared Drive 용량 초과

1. admin > 월별 아카이브에서 오래된 달 ZIP 다운로드 확인
2. 이미 nDrive 백업 완료된 3개월 이상 지난 원본 폴더 삭제 (ZIP 은 유지)

### 4.4 공유 드라이브 소유 담당자가 퇴사

1. 퇴사 D-30: 공유 드라이브 관리자 권한을 후임자에게 위임
2. Apps Script 프로젝트도 공유 드라이브로 이동 (`파일 > 이동`)
3. Sheet `BV_Partner_DB` 의 `편집자` 목록에 후임자 추가
4. admin.html 의 담당자 이메일·이름 하드코딩 없음 확인 (grep 기준)

---

## 5. Apps Script 재배포 절차

```
1. apps-script/Code.gs 수정
2. Apps Script 편집기에서 "배포 > 배포 관리"
3. 기존 배포 편집 → 새 버전
4. 배포 URL 변경 없음 (같은 deploymentId 유지)
5. admin.html 에서 테스트: 설정 > Apps Script 연결 확인 > 월별 아카이브 로드
```

URL이 바뀐 경우 반드시:
- admin.html 사용자 localStorage 초기화 요청 (또는 admin UI 에 URL 업데이트 입력창 제공)
- seller.html 내 `APPS_SCRIPT_URL` 상수 교체 후 재배포

---

## 6. 보안 체크리스트

- [ ] admin.html 은 private 저장소 또는 내부 호스팅에만 배포
- [ ] `.gitignore` 에 `admin.html`, `CLAUDE.md` 포함 확인
- [ ] Apps Script 웹앱 접근 권한 = "모든 사용자 (익명 포함)" 이지만, 쓰기는 POST body 검증으로 제한
- [ ] 공유 드라이브 외부 공유 차단
- [ ] Google Sheet 공유 범위 = 도메인 내부로 제한
- [ ] nDrive 폴더 외부 공유 차단

---

## 7. 자주 쓰는 URL·ID

| 항목 | 값 | 메모 |
|---|---|---|
| Apps Script Web App | (배포 후 기입) | admin.html localStorage 에 저장 |
| ROOT_FOLDER_ID | (공유 드라이브 폴더 ID) | Apps Script `ScriptProperties` |
| BV_Partner_DB Sheet | (Sheet ID) | Apps Script `ScriptProperties` |
| nDrive 월별 백업 폴더 | (nDrive URL) | 팀 공유 |
| dl_babyvoucher 메일 | dl_babyvoucher@navercorp.com | 문의 수신 |

---

## 8. 담당자 이전 체크리스트 (한 페이지 요약)

이전 담당자가 퇴사·이동하기 전 **반드시** 완료:

1. [ ] 공유 드라이브 `베이비바우처_파트너_운영` 관리자에 후임자 추가
2. [ ] Apps Script 프로젝트 공유 드라이브 이동 + 후임자에 편집자 권한
3. [ ] Google Sheet `BV_Partner_DB` 편집자에 후임자 추가
4. [ ] nDrive 월별 백업 폴더 권한 위임
5. [ ] dl_babyvoucher 메일링리스트 멤버 교체
6. [ ] admin.html 호스팅 계정 접근권 이전
7. [ ] 이 문서(`OPERATIONS.md`) 의 "7. 자주 쓰는 URL·ID" 섹션 최신화
8. [ ] `ONBOARDING.md` 로 후임자 5분 셋업 완료 확인

완료되면 후임자가 `ONBOARDING.md` 만 보고도 독립 운영 가능해야 한다.
