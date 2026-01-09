from __future__ import annotations

import base64
import hashlib
import hmac
import os


def hash_password(
    password: str,
    *,
    salt: bytes | None = None,
    iterations: int = 210_000,
) -> tuple[str, str, int]:
    """Хэширует пароль через PBKDF2-HMAC-SHA256.

    Возвращает: (hash_b64, salt_b64, iterations)
    """
    if salt is None:
        salt = os.urandom(16)

    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
        dklen=32,
    )
    return _b64(dk), _b64(salt), iterations


def verify_password(
    password: str, *, hash_b64: str, salt_b64: str, iterations: int
) -> bool:
    """Проверяет пароль по сохранённым значениям."""
    salt = _b64decode(salt_b64)
    expected = _b64decode(hash_b64)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
        dklen=len(expected),
    )
    return hmac.compare_digest(dk, expected)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))
