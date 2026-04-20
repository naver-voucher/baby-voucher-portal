# 판매자 포털 백엔드 배포 가이드 (Google Apps Script)

판매자가 `seller.html`에 입력한 계약·소재·문의 데이터를 **공유 드라이브** + Google Sheet에 자동 저장하고, 관리자 포털이 이를 실시간 조회·월별 ZIP 백업할 수 있게 하는 백엔드입니다.

> 💡 담당자 승계 안전성을 위해 **반드시 공유 드라이브**에 배포하세요. 개인 드라이브 배포는 금지.

---

## 🚀 배포 절차 (최초 1회 · 약 10분)

### 1. 공유 드라이브 준비
1. Google Drive 좌측 메뉴 > **공유 드라이브** > 새로 만들기 → `베이비바우처_파트너_운영`
2. 멤버에 **담당자 최소 2명**을 "관리자" 권한으로 추가
3. 이 드라이브의 루트에 빈 폴더 `_root` 생성 → 주소창에서 **폴더 ID 복사** (예: `1AbC...xyz`)

### 2. Apps Script 프로젝트 생성 (공유 드라이브 내부에)
1. 위 공유 드라이브에서 **새로 만들기 > 더보기 > Google Apps Script**
2. 프로젝트 제목: `베이비바우처 판매자 포털 백엔드`
3. 기본 `Code.gs` 내용 전체 삭제 → 이 폴더의 [`Code.gs`](./Code.gs) 붙여넣기 → **저장**

### 3. 공유 드라이브 바인딩
1. 편집기 상단 함수 드롭다운에서 **`bindSharedDrive`** 선택
2. 에디터 좌측 `코드.gs` 파일에서 `bindSharedDrive` 함수의 인자를 수정:
   ```js
   function bindSharedDrive() {
     const SHARED_DRIVE_FOLDER_ID = '여기에_복사한_폴더ID_붙여넣기';
     ...
   }
   ```
3. **실행** → 권한 승인 (Drive, Spreadsheet)
4. 실행 로그에 `ROOT_FOLDER_ID 저장 완료` 확인

### 4. 초기 세팅 (시트·탭 생성)
1. 함수 드롭다운 **`setUp`** 선택 → 실행
2. 실행 로그에 **시트 URL + 루트 폴더 URL** 출력 확인
3. 공유 드라이브에 `베이비바우처_판매자제출_DB` 시트가 생겼는지 확인 (탭: Submissions / Inquiries / Exports)

### 5. 웹앱 배포
1. 우측 상단 **배포 > 새 배포**
2. 유형: **웹 앱**
   - **설명**: `v1`
   - **실행 계정**: `나(본인)`
   - **액세스 권한**: **`모든 사용자`** (판매자가 로그인 없이 제출해야 함)
3. **배포** → 웹 앱 URL 복사
   - 형태: `https://script.google.com/macros/s/AKfyc.../exec`

### 6. 포털에 URL 연결

**admin.html** — 관리자 포털 로그인 후:
1. 좌측 메뉴 **판매자 포털 > 월별 아카이브**
2. 상단 `⚙️ Apps Script 연결` 박스에 URL 붙여넣고 **저장**
3. **연결 테스트** 클릭 → `✓ 연결 성공` 확인

**seller.html** — 파일 상단 상수 교체 후 재배포:
```js
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfyc.../exec';
```

완료! 판매자 제출 시 공유 드라이브에 자동 저장되고, 관리자 포털에 실시간 반영됩니다.

---

## 📂 공유 드라이브 구조

```
베이비바우처_파트너_운영/ (공유 드라이브 루트)
└── _root/ (ROOT_FOLDER_ID)
    ├── 2026-05/                       ← 월별 폴더 (자동 생성)
    │   ├── 브랜드A/
    │   │   ├── 로고_브랜드A.png
    │   │   ├── 연출컷_브랜드A.png
    │   │   └── brandDesc.txt
    │   └── 브랜드B/
    │       └── ...
    ├── 2026-06/
    │   └── ...
    ├── _exports/                      ← 월별 ZIP 백업 (자동 생성)
    │   ├── 2026-05_베이비바우처_20260525-143012.zip
    │   └── 2026-06_베이비바우처_20260625-143512.zip
    └── 베이비바우처_판매자제출_DB (스프레드시트)
        ├── Submissions
        ├── Inquiries
        └── Exports
```

---

## 🔌 API 엔드포인트

모든 엔드포인트는 `https://script.google.com/macros/s/.../exec` 에 쿼리 파라미터로 호출.

| 메서드 | 파라미터 | 용도 | 응답 |
|---|---|---|---|
| GET | `?kind=ping` | 연결 상태 확인 | `{ok:true, ts}` |
| GET | `?kind=submissions` | 전체 제출 현황 | 배열 |
| GET | `?kind=inquiries` | 전체 문의 목록 | 배열 |
| GET | `?kind=months` | 월별 폴더 목록 | `[{ym, count, folderUrl}]` |
| GET | `?kind=export&ym=YYYY-MM&by=이메일` | 해당 월 ZIP 생성·저장·링크 반환 | `{ok, ym, count, fileId, zipUrl, directDownloadUrl, brands}` |
| GET | `?kind=exports` | ZIP 내보내기 이력 | `[{exportedAt, ym, count, zipUrl, by}]` |
| POST | body=JSON (text/plain) | 판매자 제출·문의 접수 | `{ok:true, brandFolder, logoUrl, ...}` |

POST body 예시 (seller.html 이 보냄):
```json
{ "type":"submission", "acctId":"...", "brandName":"...", "logo":"data:image/png;base64,...", ... }
{ "type":"inquiry", "category":"담당자교체", "acctId":"...", "handoffName":"...", ... }
```

> CORS 우회: seller.html 은 `Content-Type: text/plain;charset=utf-8` 로 전송 (Apps Script 의 preflight 미발생 조건).

---

## 🔄 업데이트 시

Code.gs 수정 후:
1. 편집기에서 **저장**
2. **배포 > 배포 관리 > 연필 아이콘 > 새 버전**
3. 배포 URL은 동일하게 유지됨 (admin.html URL 변경 불필요)

---

## 🛠️ 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| seller.html 제출 시 CORS 오류 | Content-Type이 application/json | seller.html 에서 `text/plain;charset=utf-8` 유지 |
| 401 Unauthorized | 배포 액세스 = "나만" | 배포 설정에서 "모든 사용자"로 변경 후 재배포 |
| 이미지 업로드 시간 초과 | 고해상도 이미지 5장+ | 브랜드사에 연출컷 해상도 2MB 이하 안내 |
| 공유 드라이브 용량 부족 | 오래된 월 원본 누적 | nDrive 백업 완료된 3개월 이상 지난 월 폴더 삭제 (ZIP 은 보존) |
| ZIP 다운로드 실패 (timeout) | 한 월 브랜드 수 30+ | Apps Script 6분 실행 한도 초과 → 브랜드 일부 수동 제외 후 재시도 |
| `TypeError: Cannot read 'getFolderById'` | ROOT_FOLDER_ID 미설정 | `bindSharedDrive` 함수에 폴더 ID 채우고 다시 실행 |
| admin 포털 "Apps Script URL 미설정" | localStorage 초기화됨 | 월별 아카이브 상단 설정 박스에 URL 재저장 |

---

## 🔐 보안 메모

- Apps Script URL이 외부에 유출되어도 유효한 `acctId` 를 모르면 의미 있는 제출이 어렵지만, 고위험 환경이라면 HMAC 토큰 검증 추가 권장
- 제출 원본은 **공유 드라이브 내부에만 저장** (외부 공유 링크 생성하지 않음)
- 월별 ZIP 만 "링크를 아는 모든 사람: 보기" 권한으로 공유 (admin 에서 다운로드 자동화를 위해) → 다운로드 후 nDrive 이동 뒤 원본 삭제 운영 권장
- 공유 드라이브 자체의 외부 공유는 G Suite 관리자 정책에서 차단 설정 필수

---

## 📋 승계 체크리스트

이전 담당자 퇴사·이동 전 반드시:

- [ ] 공유 드라이브 관리자에 후임자 추가
- [ ] Apps Script 프로젝트 편집자에 후임자 추가
- [ ] `BV_Partner_DB` 시트 편집자에 후임자 추가
- [ ] 배포 URL + ROOT_FOLDER_ID 를 `OPERATIONS.md` §7에 기록
- [ ] 후임자가 `ONBOARDING.md` 따라 admin 포털 연결 테스트 완료 확인
