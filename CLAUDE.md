# 베이비바우처 파트너 포털 프로젝트

## 담당자
- **최윤아** / 네이버 키즈사업팀 사업담당자
- 이메일: yunah.choii@navercorp.com

## 폴더 구조
```
베이비바우처 운영 자동화/
├── index.html              ← 랜딩 페이지 (배포 루트)
├── portal/
│   ├── admin.html          ← 관리자 포털 (메인 개발)
│   ├── seller.html         ← 판매자 포털
│   └── brand.html          ← 브랜드 포털
├── img/guide/              ← 가이드 이미지
├── mail-templates/
│   ├── 제휴사/             ← 제휴사 대상 .eml
│   └── 멤버십/             ← 멤버십 명단 안내 .eml
├── apps-script/            ← Google Apps Script
└── CLAUDE.md / ONBOARDING.md / OPERATIONS.md
```

## 배포
- **배포 대상**: OSS (네이버 클라우드 Object Storage) — 전환 예정
- **로컬 프리뷰**: http://localhost:8090/portal/admin.html (포트 8090)

## 로그인 정보
- **비밀번호**: `babyvoucher2026`
- **해시**: `ba49a696f5958779cdb8379fd9f1c9d71b736c704beaa8aaf23ff48ee8f6ab4e`
- **세션**: 8시간 유지 (sessionStorage)
- **Works OAuth**: 설정 시 네이버웍스 로그인 가능 (Client ID 필요)

## 데이터 구조
- **전체 브랜드**: 187개
  - 운영중: 170개 (퇴점예정 2개 포함)
  - 신규입점 (9차·5월): 3개
  - 퇴점완료: 14개
- **원본 Excel**: `/Users/user/Downloads/베이비바우처 제휴사 정보.xlsx`
- **MASTER 시트**: `1. 참여계정(MASTER)` (Row 3=헤더, Row 4~=데이터)

## 브랜드 데이터 컬럼 매핑 (Excel → JS)
| Excel 열 | JS 필드 | 내용 |
|---|---|---|
| B | open | 오픈시점 |
| C | end | 제휴종료일 |
| D | type | 혜택구분 |
| E | cat | 대표중카테고리 |
| F | order | 노출순서 |
| G | store | 스토어명 |
| H | acctId | 계정ID |
| I | url | 스토어URL |
| J | mgr | 네이버담당자 |
| M | benefitCat | 혜택적용카테고리 |
| O | sv | 서브버티컬 |
| P | channelNo | 채널번호 |
| Q | payNo | 페이번호 |
| S | company | 상호명 |
| T | name | 브랜드명(Short) |
| U | desc | 브랜드설명 |
| X | email | 메일주소 |
| Y | phone | 연락처 |

## 혜택구분 분류
| 혜택구분 | 서브버티컬 | 담당자 |
|---|---|---|
| 반복구매 | BABY_YUKAH | 김현수 |
| 국민템 | BABY_KOOKMIN | 이민호 |
| 키즈패션 | BABY_KIDSFASHION | 고연수 |
| 장난감/교육 | BABY_TOYEDU | 최윤아 |

## 주요 기능
1. **브랜드사 관리**: 187개 브랜드 테이블, 상태/유형 필터, 검색
2. **계정ID 일괄 복사**: 줄바꿈/쉼표/채널번호/페이번호 복사
3. **SharePoint 동기화**: Power Automate + GitHub Gist 자동 연동 / 파일 업로드 수동
4. **업무 가이드**: 입점 9단계 + 퇴점 체크리스트
5. **소재 취합 현황**: 5월 신규 브랜드 소재 제출 상태 관리

## SharePoint 자동 동기화 구조
```
SharePoint 시트 수정
  → Power Automate 트리거 (파일 변경 감지)
  → Get file content (xlsx base64)
  → HTTP PATCH → GitHub Gist (brands.b64)
  → 포털 접속 시 Gist fetch → processExcelBuffer()
  → localStorage 캐시 저장
```

## 주요 링크 (바로가기)
- SharePoint 시트: `navercorp-my.sharepoint.com/:x:/r/personal/hezy_shin_navercorp_com/...`
- NSS: `iims.navercorp.com/view/svc/main?svcId=NSS`
- NIMO: `nimo.navercorp.com/NAVER_SHOPPING/wizard/1883/result/...`
- MEM: `iims.navercorp.com/view/svc/main?svcId=MEM`
- 네이버폼 (소재취합): `https://naver.me/5fdn6Ums`

## 입점 업무 9단계 요약
1. 시트 기입 + NSS/NIMO 등록
2. 커머스솔루션 계약 등록
3. 계약 안내 + 소재취합 메일 발송
4. 미회신사 리마인드
5. 로고/연출컷 리사이징 요청 (강명화님)
6. 쿠폰 발행 (NSS)
7. MEM 셋팅
8. 쿠폰 승인 요청
9. NSS/MEM 최종 검수

## 퇴점일 기준
- **매달 영업일 기준 말일 오후 6시**

## 개발 관련
- **프리뷰 서버**: `/tmp/brand-portal-serve/` 폴더, 포트 8090
- **단일 HTML 파일**: 모든 기능이 admin.html 하나에 포함
- **배포 방법**: `cp admin.html index.html` 후 `git push`
- **GitHub 조직**: `naver-voucher`
