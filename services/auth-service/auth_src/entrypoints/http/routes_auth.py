from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import cast

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from ...adapters.db.audit import AuditLog
from ...adapters.db.models import RefreshToken, User, Workspace
from ...adapters.db.session import get_db_session
from ...config.settings import Settings
from ...security.jwt import JwtError, decode_and_verify, issue_tokens
from ...security.passwords import hash_password, verify_password

router = APIRouter(prefix="/v1/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)
    workspace_name: str = Field(min_length=1, max_length=200)

    @field_validator("email")
    @classmethod
    def _validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v:
            raise ValueError("Некорректный email")
        return v


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def _validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v:
            raise ValueError("Некорректный email")
        return v


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    user_id: uuid.UUID
    email: str
    workspace_id: uuid.UUID


class RefreshRequest(BaseModel):
    refresh_token: str


def _get_settings(request: Request) -> Settings:
    return cast(Settings, request.app.state.settings)


@router.post("/register", response_model=TokenPairResponse)
async def register(
    body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    x_trace_id: str | None = Header(default=None, alias="X-Trace-Id"),
    x_operation_id: str | None = Header(default=None, alias="X-Operation-Id"),
):
    """Регистрация: создаёт workspace + user, возвращает access/refresh."""
    _ = (
        x_trace_id,
        x_operation_id,
    )  # заголовки фиксируем, используем позже для аудита/логов

    exists = await db.execute(select(User).where(User.email == body.email))
    if exists.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "EMAIL_ALREADY_EXISTS",
                "message": "Пользователь уже существует",
            },
        )

    ws = Workspace(name=body.workspace_name)
    pwd_hash, pwd_salt, iterations = hash_password(body.password)
    user = User(
        email=body.email,
        workspace=ws,
        password_hash=pwd_hash,
        password_salt=pwd_salt,
        password_iterations=iterations,
    )
    db.add(ws)
    db.add(user)
    await db.flush()

    settings = _get_settings(request)
    tokens = issue_tokens(
        secret=settings.jwt_secret,
        issuer=settings.jwt_issuer,
        user_id=user.id,
        workspace_id=ws.id,
        access_ttl_seconds=settings.access_token_ttl_seconds,
        refresh_ttl_seconds=settings.refresh_token_ttl_seconds,
    )

    now = datetime.now(timezone.utc)
    refresh_row = RefreshToken(
        jti=tokens.refresh_jti,
        user_id=user.id,
        workspace_id=ws.id,
        issued_at=now,
        expires_at=now + timedelta(seconds=settings.refresh_token_ttl_seconds),
        revoked_at=None,
    )
    db.add(refresh_row)

    operation_uuid = None
    if x_operation_id:
        try:
            operation_uuid = uuid.UUID(x_operation_id)
        except Exception:
            operation_uuid = None
    db.add(
        AuditLog(
            workspace_id=ws.id,
            user_id=user.id,
            operation_id=operation_uuid,
            action="USER_REGISTERED",
            resource_type="user",
            resource_id=user.id,
            changes={"workspace_id": str(ws.id), "email": user.email},
        )
    )
    await db.commit()

    return TokenPairResponse(
        access_token=tokens.access_token, refresh_token=tokens.refresh_token
    )


@router.post("/login", response_model=TokenPairResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
):
    """Логин: проверяет пароль, возвращает access/refresh."""
    row = await db.execute(select(User).where(User.email == body.email))
    user = row.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_CREDENTIALS", "message": "Неверные данные"},
        )

    if not verify_password(
        body.password,
        hash_b64=user.password_hash,
        salt_b64=user.password_salt,
        iterations=user.password_iterations,
    ):
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_CREDENTIALS", "message": "Неверные данные"},
        )

    settings = _get_settings(request)
    tokens = issue_tokens(
        secret=settings.jwt_secret,
        issuer=settings.jwt_issuer,
        user_id=user.id,
        workspace_id=user.workspace_id,
        access_ttl_seconds=settings.access_token_ttl_seconds,
        refresh_ttl_seconds=settings.refresh_token_ttl_seconds,
    )

    now = datetime.now(timezone.utc)
    refresh_row = RefreshToken(
        jti=tokens.refresh_jti,
        user_id=user.id,
        workspace_id=user.workspace_id,
        issued_at=now,
        expires_at=now + timedelta(seconds=settings.refresh_token_ttl_seconds),
        revoked_at=None,
    )
    db.add(refresh_row)
    await db.commit()

    return TokenPairResponse(
        access_token=tokens.access_token, refresh_token=tokens.refresh_token
    )


@router.get("/me", response_model=MeResponse)
async def me(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
    authorization: str | None = Header(default=None, alias="Authorization"),
):
    """Профиль текущего пользователя по access JWT."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401, detail={"code": "UNAUTHORIZED", "message": "Нет токена"}
        )
    token = authorization.split(" ", 1)[1].strip()

    settings = _get_settings(request)
    try:
        payload = decode_and_verify(
            token,
            secret=settings.jwt_secret,
            issuer=settings.jwt_issuer,
            expected_token_type="access",
        )
    except JwtError:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Неверный токен"},
        ) from None

    user_id = uuid.UUID(payload["sub"])
    row = await db.execute(select(User).where(User.id == user_id))
    user = row.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Пользователь не найден"},
        )

    return MeResponse(user_id=user.id, email=user.email, workspace_id=user.workspace_id)


@router.post("/refresh", response_model=TokenPairResponse)
async def refresh(
    body: RefreshRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session),
):
    """Выдаёт новую пару токенов по refresh JWT (с ротацией)."""
    settings = _get_settings(request)

    try:
        payload = decode_and_verify(
            body.refresh_token,
            secret=settings.jwt_secret,
            issuer=settings.jwt_issuer,
            expected_token_type="refresh",
        )
    except JwtError:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Неверный refresh токен"},
        ) from None

    jti = uuid.UUID(payload["jti"])
    row = await db.execute(select(RefreshToken).where(RefreshToken.jti == jti))
    token_row = row.scalar_one_or_none()
    if token_row is None or token_row.revoked_at is not None:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Refresh токен отозван"},
        )

    # Ротация: отзываем старый refresh и выдаём новый.
    token_row.revoked_at = datetime.now(timezone.utc)

    tokens = issue_tokens(
        secret=settings.jwt_secret,
        issuer=settings.jwt_issuer,
        user_id=uuid.UUID(payload["sub"]),
        workspace_id=uuid.UUID(payload["workspace_id"]),
        access_ttl_seconds=settings.access_token_ttl_seconds,
        refresh_ttl_seconds=settings.refresh_token_ttl_seconds,
    )
    now = datetime.now(timezone.utc)
    new_row = RefreshToken(
        jti=tokens.refresh_jti,
        user_id=uuid.UUID(payload["sub"]),
        workspace_id=uuid.UUID(payload["workspace_id"]),
        issued_at=now,
        expires_at=now + timedelta(seconds=settings.refresh_token_ttl_seconds),
        revoked_at=None,
    )
    db.add(new_row)
    await db.commit()

    return TokenPairResponse(
        access_token=tokens.access_token, refresh_token=tokens.refresh_token
    )
