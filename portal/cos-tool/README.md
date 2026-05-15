# COS 메일 발송 툴

COS(Consolidated Outbound mail System)를 통해 메일을 발송하는 로컬 프록시 기반 발송 툴입니다.

---

## 파일 구조

```
COS/
├── 실행.bat              ← Windows 실행 스크립트
├── 실행.command          ← Mac 실행 스크립트 (더블클릭 실행)
├── COS 메일 발송.lnk     ← Windows 바로가기 (아이콘 포함)
├── README.md             ← 이 파일 (기술 문서)
├── 사용법.md             ← HTML 툴 사용 가이드
└── app/
    ├── proxy.py          ← 로컬 프록시 서버 (localhost:5000)
    ├── index.html        ← 발송 UI
    ├── cos_send.py       ← Python 단독 실행 / 모듈 임포트용
    ├── cos_icon.ico      ← 바로가기 아이콘
    └── history.json      ← 발송 이력 자동 저장 (자동 생성)
```

---

## 사전 준비

**Python 3.8 이상** 및 아래 라이브러리가 필요합니다.

```bash
pip install requests openpyxl
# Mac은 pip3 사용
pip3 install requests openpyxl
```

### 실행 방법

| OS | 방법 |
|---|---|
| Windows | `실행.bat` 더블클릭 또는 `COS 메일 발송.lnk` |
| Mac | `실행.command` 더블클릭 (최초 1회 `chmod +x 실행.command`) |

---

## 발신자 DL 목록

| 템플릿 ID | 발신 이메일 | 발신자명 |
|---|---|---|
| `VOU_000001` | dl_naverpet_2025@navercorp.com | 네이버펫바우처_2025 |
| `VOU_000002` | dl_babyvoucher@navercorp.com | 네이버베이비바우처 |

> COS 서비스 코드: `VOU`

---

## cos_send.py — 모듈 임포트 사용법

HTML 툴 없이 Python 스크립트에서 직접 발송할 때 사용합니다.

```python
from pathlib import Path
from app.cos_send import MailRequest, RecipientType, send_mail

req = MailRequest(
    mail_title="5월 리포트 안내",
    mail_body="<p>안녕하세요. 5월 리포트를 전달드립니다.</p>",
    sender_email_address="dl_naverpet_2025@navercorp.com",
    sender_name="네이버펫바우처_2025",
)
req.add_recipient("partner@example.com")
req.add_recipient("cc_person@navercorp.com", RecipientType.CC)

# 파일 첨부
result = send_mail(req, attach_path=Path("리포트.zip"))

print(result.state)       # SUCCESS / ERROR
print(result.request_id)  # COS 요청 ID
```

### 예약 발송 (Python)

```python
req = MailRequest(
    ...,
    reservation_date="2025-06-01 10:00:00",  # 현재 기준 30분 이후
)
```

### 환경변수

```powershell
$env:COS_API_URL      = "https://cos.navercorp.com/cos/mail/v2/api"
$env:COS_SENDER_EMAIL = "dl_naverpet_2025@navercorp.com"
$env:COS_SENDER_NAME  = "네이버펫바우처_2025"
$env:COS_PILOT_ONLY   = "1"   # 사내(@navercorp.com) 외 수신자 차단
```

---

## proxy.py 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/` | index.html 서빙 |
| GET | `/history` | history.json 반환 |
| GET | `/template` | 수신자 목록 엑셀 양식 다운로드 |
| POST | `/send` | COS API 중계 (메일 발송) |
| POST | `/upload-list` | 수신자 목록 xlsx/CSV 파싱 |
| POST | `/history` | history.json 저장 |

---

## 주의사항

- COS는 **첨부 파일 1개**만 허용합니다. 여러 파일은 zip으로 묶어 전달하세요.
- `COS_API_URL`은 사내 네트워크 또는 VPN 연결 상태에서만 접근 가능합니다.
- 예약 발송은 현재 시간 기준 **최소 30분 이후**로 설정해야 합니다.
