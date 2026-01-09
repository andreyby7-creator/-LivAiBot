from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
import uuid
from dataclasses import dataclass
from typing import Any, cast


class JwtError(Exception):
    """Ошибка валидации/парсинга JWT."""


@dataclass(frozen=True)
class JwtTokens:
    access_token: str
    refresh_token: str
    refresh_jti: uuid.UUID


def issue_tokens(
    *,
    secret: str,
    issuer: str,
    user_id: uuid.UUID,
    workspace_id: uuid.UUID,
    access_ttl_seconds: int,
    refresh_ttl_seconds: int,
) -> JwtTokens:
    now = int(time.time())
    refresh_jti = uuid.uuid4()

    access_payload = {
        "iss": issuer,
        "sub": str(user_id),
        "workspace_id": str(workspace_id),
        "token_type": "access",
        "iat": now,
        "exp": now + access_ttl_seconds,
    }
    refresh_payload = {
        "iss": issuer,
        "sub": str(user_id),
        "workspace_id": str(workspace_id),
        "token_type": "refresh",
        "jti": str(refresh_jti),
        "iat": now,
        "exp": now + refresh_ttl_seconds,
    }

    access_token = _encode_hs256(access_payload, secret)
    refresh_token = _encode_hs256(refresh_payload, secret)
    return JwtTokens(
        access_token=access_token, refresh_token=refresh_token, refresh_jti=refresh_jti
    )


def decode_and_verify(
    token: str,
    *,
    secret: str,
    issuer: str,
    expected_token_type: str | None = None,
) -> dict[str, Any]:
    header_b64, payload_b64, sig_b64 = _split(token)
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected_sig = _hmac_sha256(signing_input, secret.encode("utf-8"))
    if not hmac.compare_digest(_b64url_decode(sig_b64), expected_sig):
        raise JwtError("Неверная подпись токена")

    payload = cast(dict[str, Any], json.loads(_b64url_decode(payload_b64)))
    if payload.get("iss") != issuer:
        raise JwtError("Неверный issuer")

    now = int(time.time())
    exp = payload.get("exp")
    if not isinstance(exp, int):
        raise JwtError("Некорректный exp")
    if now >= exp:
        raise JwtError("Токен истёк")

    if expected_token_type is not None:
        if payload.get("token_type") != expected_token_type:
            raise JwtError("Неверный тип токена")

    return payload


def _encode_hs256(payload: dict, secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_b64 = _b64url_encode(
        json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    payload_b64 = _b64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = _hmac_sha256(signing_input, secret.encode("utf-8"))
    sig_b64 = _b64url_encode(signature)
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def _hmac_sha256(data: bytes, key: bytes) -> bytes:
    return hmac.new(key, data, hashlib.sha256).digest()


def _split(token: str) -> tuple[str, str, str]:
    parts = token.split(".")
    if len(parts) != 3:
        raise JwtError("Некорректный формат JWT")
    return parts[0], parts[1], parts[2]


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))
