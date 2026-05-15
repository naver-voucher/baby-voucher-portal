#!/usr/bin/env python3
"""
cos_send.py — COS 메일 발송 독립 스크립트

사용법:
    python cos_send.py

환경변수 (필수):
    COS_API_URL          COS 엔드포인트 URL
    COS_SENDER_EMAIL     발신자 이메일
    COS_SENDER_NAME      발신자 표시명

환경변수 (선택):
    COS_PILOT_ONLY=1     안전 잠금 — @navercorp.com 외부 수신자 차단

서비스 코드: VOU / 템플릿: VOU_000001
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path
from typing import Dict, Iterable, List, Optional

import requests


# ── 상수 ──────────────────────────────────────────────────────
_INTERNAL_DOMAIN = "@navercorp.com"
_DEFAULT_TIMEOUT_SEC = 30.0
_SERVICE_ID = "VOU"
_TEMPLATE_ID = "VOU_000001"


# ── 모델 ──────────────────────────────────────────────────────
class RecipientType(str, Enum):
    TO = "O"
    CC = "C"
    BCC = "B"


def _camel(key: str) -> str:
    parts = key.split("_")
    return parts[0] + "".join(w.capitalize() for w in parts[1:])


def _to_camel(obj):
    if isinstance(obj, dict):
        return {_camel(k): _to_camel(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_camel(v) for v in obj]
    return obj


@dataclass
class Recipient:
    primary_mail_address: str
    secondary_mail_address: Optional[str] = None
    recipient_type: str = RecipientType.TO.value


@dataclass
class MailRequest:
    mail_title: str
    mail_body: str
    sender_email_address: str
    sender_name: str
    recipients: List[Recipient] = field(default_factory=list)
    name_values: List[Dict[str, str]] = field(default_factory=list)
    individual_dispatch_yn: str = "N"
    service_id: str = _SERVICE_ID
    template_id: str = _TEMPLATE_ID
    reservation_date: Optional[str] = None  # "2025-05-15 14:30:00" — 현재+30분 이후

    def add_recipient(self, mail: str, rtype: RecipientType = RecipientType.TO) -> None:
        self.recipients.append(
            Recipient(primary_mail_address=mail, recipient_type=rtype.value)
        )

    def to_payload(self) -> dict:
        def _drop_none(obj):
            if isinstance(obj, dict):
                return {k: _drop_none(v) for k, v in obj.items() if v is not None}
            if isinstance(obj, list):
                return [_drop_none(v) for v in obj]
            return obj
        return _drop_none(_to_camel(asdict(self)))


@dataclass
class MailResponse:
    state: str
    request_id: Optional[str] = None
    mail_ids: Optional[str] = None
    error_message: Optional[str] = None


# ── safety lock ───────────────────────────────────────────────
def _enforce_pilot_only(recipients: Iterable[Recipient]) -> None:
    """COS_PILOT_ONLY=1 이면 사내 도메인 외 수신자 차단."""
    if os.environ.get("COS_PILOT_ONLY") != "1":
        return
    blocked = [
        r.primary_mail_address
        for r in recipients
        if not r.primary_mail_address.lower().endswith(_INTERNAL_DOMAIN)
    ]
    if blocked:
        raise RuntimeError(
            f"COS_PILOT_ONLY=1 — 외부 수신자 차단됨: {blocked}\n"
            "실발송 전 환경변수를 해제(unset COS_PILOT_ONLY)하세요."
        )


# ── 발송 ──────────────────────────────────────────────────────
def send_mail(
    request: MailRequest,
    attach_path: Optional[Path] = None,
    api_url: Optional[str] = None,
    timeout: float = _DEFAULT_TIMEOUT_SEC,
) -> MailResponse:
    """COS 에 메일을 발송한다. attach_path 지정 시 단일 파일 첨부."""
    _enforce_pilot_only(request.recipients)

    url = api_url or os.environ.get("COS_API_URL")
    if not url:
        raise ValueError("COS_API_URL 환경변수 또는 api_url 인자를 지정하세요.")
    if not request.sender_email_address or not request.sender_name:
        raise ValueError("sender_email_address 와 sender_name 을 모두 지정해야 합니다.")
    if not request.recipients:
        raise ValueError("수신자가 1명 이상 필요합니다.")

    mail_json = json.dumps(request.to_payload(), ensure_ascii=False)
    files: Dict[str, tuple] = {"mailRequest": (None, mail_json, "application/json")}

    attach_fp = None
    try:
        if attach_path is not None:
            attach_path = Path(attach_path)
            if not attach_path.is_file():
                raise FileNotFoundError(f"첨부 파일을 찾을 수 없습니다: {attach_path}")
            attach_fp = attach_path.open("rb")
            files["attachFile"] = (attach_path.name, attach_fp)

        resp = requests.post(url, files=files, timeout=timeout)
    finally:
        if attach_fp:
            attach_fp.close()

    if resp.status_code != 200:
        return MailResponse(
            state="ERROR",
            error_message=f"HTTP {resp.status_code}: {resp.text[:200]}",
        )

    try:
        payload = resp.json()
    except ValueError:
        return MailResponse(state="ERROR", error_message=f"응답 파싱 실패: {resp.text[:200]}")

    return MailResponse(
        state=str(payload.get("state", "UNKNOWN")),
        request_id=payload.get("requestId"),
        mail_ids=payload.get("mailIds"),
        error_message=payload.get("errorMessage"),
    )


# ── 실행 예시 ─────────────────────────────────────────────────
if __name__ == "__main__":
    sender_email = os.environ.get("COS_SENDER_EMAIL", "").strip()
    sender_name  = os.environ.get("COS_SENDER_NAME",  "").strip()

    if not sender_email or not sender_name:
        raise SystemExit("COS_SENDER_EMAIL / COS_SENDER_NAME 환경변수를 설정하세요.")

    req = MailRequest(
        mail_title="테스트 메일",
        mail_body="<p>COS 발송 테스트입니다.</p>",
        sender_email_address=sender_email,
        sender_name=sender_name,
    )
    req.add_recipient("수신자@navercorp.com")

    # 첨부가 있을 경우: send_mail(req, attach_path=Path("파일.zip"))
    result = send_mail(req)
    print(f"state      : {result.state}")
    print(f"request_id : {result.request_id}")
    print(f"mail_ids   : {result.mail_ids}")
    if result.error_message:
        print(f"error      : {result.error_message}")
