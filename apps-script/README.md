# 판매자 포털 백엔드 배포 가이드 (Google Apps Script)

판매자가 `seller.html`에 입력한 계약·소재·문의 데이터를 Google Drive + Spreadsheet에 자동 저장하는 무료 백엔드입니다.

---

## 🚀 배포 절차 (최초 1회 · 약 7분)

### 1. Apps Script 프로젝트 생성
1. https://script.google.com 접속
2. **새 프로젝트** 클릭 → 제목을 `베이비바우처 판매자 포털 백엔드`로 변경
3. 왼쪽 `Code.gs` 파일 내용 전체 삭제
4. 이 폴더의 [`Code.gs`](./Code.gs) 내용을 전체 복사 → 붙여넣기
5. **저장** (⌘/Ctrl + S)

### 2. 필요한 권한 승인 + 시트·폴더 초기화
1. 상단 함수 드롭다운에서 **`setUp`** 선택
2. **실행** (▶️) 클릭
3. "권한 검토" → Google 계정 선택 → "고급" → "프로젝트로 이동(안전하지 않음)" → **허용**
   - 필요 권한: Drive(폴더/파일), Spreadsheet
4. 실행 로그(하단 패널)에서 생성된 **폴더 URL + 시트 URL** 확인

### 3. 웹앱으로 배포
1. 우측 상단 **배포** → **새 배포**
2. 톱니바퀴 → **웹 앱** 선택
3. 설정:
   - **설명**: `v1`
   - **실행 계정**: `나(본인)`
   - **액세스 권한**: **`모든 사용자`**
     > 주의: 판매자가 로그인 없이 제출해야 하므로 "모든 사용자" 필수. 데이터는 본인 Drive에만 저장됩니다.
4. **배포** 클릭 → **웹 앱 URL 복사**
   - 형태: `https://script.google.com/macros/s/AKfycb...../exec`

### 4. 포털에 URL 연결
두 HTML 파일을 에디터로 열어 URL을 넣어주세요:

**`seller.html`** (상단 `APPS_SCRIPT_URL` 상수)
```js
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycb...../exec';
```

**`admin.html`** — 관리자 포털 로그인 후 브라우저 콘솔(F12)에서 1회 실행:
```js
localStorage.setItem('bv_apps_script_url', 'https://script.google.com/macros/s/AKfycb...../exec');
location.reload();
```

완료! 이제 판매자가 폼을 제출하면:
- `베이비바우처_판매자제출/` 폴더에 브랜드별 하위 폴더 자동 생성
- 로고·연출컷이 Drive에 저장됨
- `베이비바우처_판매자제출_DB` 시트의 `Submissions` 탭에 한 줄 추가
- 어드민 포털 "제출 현황" 섹션에 실시간 반영

---

## 📂 자동 생성되는 Drive 구조

```
베이비바우처_판매자제출/
├── 브랜드A (ACCTID_A)/
│   ├── logo_logo.png
│   └── shots/
│       ├── shot_1_xxx.jpg
│       ├── shot_2_yyy.jpg
│       └── ...
├── 브랜드B (ACCTID_B)/
│   └── ...
└── 베이비바우처_판매자제출_DB (스프레드시트)
    ├── Submissions (탭)
    ├── Inquiries (탭)
    └── BannerLogs (탭)
```

---

## 🔄 업데이트 시
Code.gs 수정 후 **배포 → 배포 관리 → 연필 아이콘 → 새 버전**으로 기존 URL을 그대로 유지하며 갱신 가능.

---

## 🛠️ 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| seller.html 제출 시 401/CORS 오류 | 액세스 권한이 "나"로 되어 있음 | 배포 설정에서 "모든 사용자"로 변경 후 재배포 |
| 이미지 업로드 시간 초과 | 연출컷 5장+ & 고해상도 | 판매자가 3장 이하로 업로드하도록 안내 |
| Drive 용량 부족 | 개인 Drive 15GB 초과 | 회사 Drive 계정으로 Apps Script 재생성 |
| "SyntaxError: Unexpected end of JSON" | POST body 미전송 | seller.html에서 `Content-Type` 생략 필요 (Apps Script의 simple trigger는 form 타입만 허용) — 현재 코드는 `application/x-www-form-urlencoded` 기본으로 OK |

---

## 🔐 보안 메모
- Apps Script URL이 유출되어도 판매자 계정ID(acctId)를 모르면 의미 있는 요청을 만들 수 없음
- 민감도가 높은 환경이라면 요청마다 HMAC 토큰 검증 로직을 추가 가능 (요청 시 별도 안내)
- 제출된 이미지는 "링크를 아는 모든 사람 보기" 권한으로 공유됨 → 어드민 시트에 URL 자동 기록
