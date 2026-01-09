from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from ...adapters.db.audit import AuditLog
from ...adapters.db.models import Bot, BotVersion
from ...adapters.db.session import get_db_session

router = APIRouter(prefix="/v1/bots", tags=["bots"])


class BotCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    instruction: str = Field(default="", max_length=50_000)
    settings: dict = Field(default_factory=dict)


class BotResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    status: str
    created_at: datetime
    current_version: int


class BotsListResponse(BaseModel):
    items: list[BotResponse]


class UpdateInstructionRequest(BaseModel):
    instruction: str = Field(min_length=1, max_length=50_000)
    settings: dict = Field(default_factory=dict)


@router.get("", response_model=BotsListResponse)
async def list_bots(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> BotsListResponse:
    workspace_id = _require_workspace_id(request)

    # Для MVP: вытаскиваем “текущую версию” через подзапрос max(version)
    subq = (
        select(BotVersion.bot_id, func.max(BotVersion.version).label("max_version"))
        .where(BotVersion.workspace_id == workspace_id)
        .group_by(BotVersion.bot_id)
        .subquery()
    )
    q = (
        select(Bot, subq.c.max_version)
        .outerjoin(subq, subq.c.bot_id == Bot.id)
        .where(Bot.workspace_id == workspace_id)
        .order_by(desc(Bot.created_at))
    )
    rows = (await db.execute(q)).all()
    items: list[BotResponse] = []
    for bot, max_version in rows:
        items.append(
            BotResponse(
                id=bot.id,
                workspace_id=bot.workspace_id,
                name=bot.name,
                status=bot.status,
                created_at=bot.created_at,
                current_version=int(max_version or 0),
            )
        )
    return BotsListResponse(items=items)


@router.post("", response_model=BotResponse, status_code=201)
async def create_bot(
    request: Request,
    body: BotCreateRequest,
    db: AsyncSession = Depends(get_db_session),
    x_operation_id: str | None = Header(default=None, alias="X-Operation-Id"),
) -> BotResponse:
    workspace_id = _require_workspace_id(request)

    operation_uuid = _parse_operation_id(x_operation_id)
    if operation_uuid is not None:
        existing = (
            await db.execute(
                select(Bot).where(
                    Bot.workspace_id == workspace_id,
                    Bot.operation_id == operation_uuid,
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            max_version = (
                await db.execute(
                    select(func.max(BotVersion.version)).where(
                        BotVersion.workspace_id == workspace_id,
                        BotVersion.bot_id == existing.id,
                    )
                )
            ).scalar_one()
            return BotResponse(
                id=existing.id,
                workspace_id=existing.workspace_id,
                name=existing.name,
                status=existing.status,
                created_at=existing.created_at,
                current_version=int(max_version or 0),
            )

    bot = Bot(
        workspace_id=workspace_id,
        name=body.name,
        status="draft",
        operation_id=operation_uuid,
    )
    db.add(bot)
    await db.flush()

    now = datetime.now(timezone.utc)
    version_row = BotVersion(
        workspace_id=workspace_id,
        bot_id=bot.id,
        version=1,
        instruction=body.instruction,
        settings=body.settings or {},
        operation_id=operation_uuid,
        created_at=now,
    )
    db.add(version_row)
    db.add(
        AuditLog(
            workspace_id=workspace_id,
            user_id=None,
            operation_id=operation_uuid,
            action="BOT_CREATED",
            resource_type="bot",
            resource_id=bot.id,
            changes={"name": bot.name, "status": bot.status},
        )
    )
    await db.commit()

    return BotResponse(
        id=bot.id,
        workspace_id=bot.workspace_id,
        name=bot.name,
        status=bot.status,
        created_at=bot.created_at,
        current_version=1,
    )


@router.get("/{bot_id}", response_model=BotResponse)
async def get_bot(
    request: Request,
    bot_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> BotResponse:
    workspace_id = _require_workspace_id(request)

    bot = (
        await db.execute(
            select(Bot).where(Bot.id == bot_id, Bot.workspace_id == workspace_id)
        )
    ).scalar_one_or_none()
    if bot is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "BOT_NOT_FOUND", "message": "Бот не найден"},
        )

    max_version = (
        await db.execute(
            select(func.max(BotVersion.version)).where(
                BotVersion.workspace_id == workspace_id, BotVersion.bot_id == bot_id
            )
        )
    ).scalar_one()

    return BotResponse(
        id=bot.id,
        workspace_id=bot.workspace_id,
        name=bot.name,
        status=bot.status,
        created_at=bot.created_at,
        current_version=int(max_version or 0),
    )


@router.put("/{bot_id}/instruction", response_model=BotResponse)
async def update_instruction(
    request: Request,
    bot_id: uuid.UUID,
    body: UpdateInstructionRequest,
    db: AsyncSession = Depends(get_db_session),
    x_operation_id: str | None = Header(default=None, alias="X-Operation-Id"),
) -> BotResponse:
    """Создаёт новую версию конфигурации бота."""
    workspace_id = _require_workspace_id(request)
    operation_uuid = _parse_operation_id(x_operation_id)

    bot = (
        await db.execute(
            select(Bot).where(Bot.id == bot_id, Bot.workspace_id == workspace_id)
        )
    ).scalar_one_or_none()
    if bot is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "BOT_NOT_FOUND", "message": "Бот не найден"},
        )

    if operation_uuid is not None:
        existing_version = (
            await db.execute(
                select(BotVersion).where(
                    BotVersion.workspace_id == workspace_id,
                    BotVersion.bot_id == bot_id,
                    BotVersion.operation_id == operation_uuid,
                )
            )
        ).scalar_one_or_none()
        if existing_version is not None:
            return BotResponse(
                id=bot.id,
                workspace_id=bot.workspace_id,
                name=bot.name,
                status=bot.status,
                created_at=bot.created_at,
                current_version=existing_version.version,
            )

    current_version = (
        await db.execute(
            select(func.max(BotVersion.version)).where(
                BotVersion.workspace_id == workspace_id, BotVersion.bot_id == bot_id
            )
        )
    ).scalar_one()
    next_version = int(current_version or 0) + 1

    now = datetime.now(timezone.utc)
    version_row = BotVersion(
        workspace_id=workspace_id,
        bot_id=bot.id,
        version=next_version,
        instruction=body.instruction,
        settings=body.settings or {},
        operation_id=operation_uuid,
        created_at=now,
    )
    db.add(version_row)
    db.add(
        AuditLog(
            workspace_id=workspace_id,
            user_id=None,
            operation_id=operation_uuid,
            action="BOT_INSTRUCTION_UPDATED",
            resource_type="bot_version",
            resource_id=version_row.id,
            changes={
                "bot_id": str(bot.id),
                "version": next_version,
            },
        )
    )
    await db.commit()

    return BotResponse(
        id=bot.id,
        workspace_id=bot.workspace_id,
        name=bot.name,
        status=bot.status,
        created_at=bot.created_at,
        current_version=next_version,
    )


def _require_workspace_id(request: Request) -> uuid.UUID:
    raw = getattr(request.state, "workspace_id", None)
    if not raw:
        # Это должно быть отфильтровано middleware, но оставляем “страховку”.
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Нет X-Workspace-Id"},
        )
    return uuid.UUID(str(raw))


def _parse_operation_id(x_operation_id: str | None) -> uuid.UUID | None:
    if not x_operation_id:
        return None
    try:
        return uuid.UUID(x_operation_id)
    except Exception:
        return None
