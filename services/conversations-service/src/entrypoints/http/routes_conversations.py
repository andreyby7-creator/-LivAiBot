from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import asc, desc, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from ...adapters.db.audit import AuditLog
from ...adapters.db.models import Message, Thread
from ...adapters.db.session import get_db_session

router = APIRouter(prefix="/v1/conversations", tags=["conversations"])


class ThreadCreateRequest(BaseModel):
    bot_id: uuid.UUID | None = None


class ThreadResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    bot_id: uuid.UUID | None
    status: str
    created_at: datetime


class ThreadsListResponse(BaseModel):
    items: list[ThreadResponse]


class MessageResponse(BaseModel):
    id: uuid.UUID
    thread_id: uuid.UUID
    role: str
    content: str
    created_at: datetime
    operation_id: uuid.UUID | None = None


class MessagesListResponse(BaseModel):
    items: list[MessageResponse]


class TurnRequest(BaseModel):
    content: str = Field(min_length=1, max_length=50_000)


class TurnResponse(BaseModel):
    thread_id: uuid.UUID
    user_message: MessageResponse
    assistant_message: MessageResponse


@router.post("/threads", response_model=ThreadResponse, status_code=201)
async def create_thread(
    request: Request,
    body: ThreadCreateRequest,
    db: AsyncSession = Depends(get_db_session),
) -> ThreadResponse:
    workspace_id = _require_workspace_id(request)
    row = Thread(workspace_id=workspace_id, bot_id=body.bot_id, status="active")
    db.add(row)
    db.add(
        AuditLog(
            workspace_id=workspace_id,
            user_id=None,
            operation_id=None,
            action="THREAD_CREATED",
            resource_type="thread",
            resource_id=row.id,
            changes={"bot_id": str(body.bot_id) if body.bot_id else None},
        )
    )
    await db.commit()
    await db.refresh(row)
    return ThreadResponse(
        id=row.id,
        workspace_id=row.workspace_id,
        bot_id=row.bot_id,
        status=row.status,
        created_at=row.created_at,
    )


@router.get("/threads", response_model=ThreadsListResponse)
async def list_threads(
    request: Request,
    db: AsyncSession = Depends(get_db_session),
) -> ThreadsListResponse:
    workspace_id = _require_workspace_id(request)
    rows = (
        await db.execute(
            select(Thread)
            .where(Thread.workspace_id == workspace_id)
            .order_by(desc(Thread.created_at))
        )
    ).scalars()
    items = [
        ThreadResponse(
            id=t.id,
            workspace_id=t.workspace_id,
            bot_id=t.bot_id,
            status=t.status,
            created_at=t.created_at,
        )
        for t in rows
    ]
    return ThreadsListResponse(items=items)


@router.get("/threads/{thread_id}/messages", response_model=MessagesListResponse)
async def list_messages(
    request: Request,
    thread_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> MessagesListResponse:
    workspace_id = _require_workspace_id(request)
    _ = await _get_thread(db, workspace_id=workspace_id, thread_id=thread_id)

    rows = (
        await db.execute(
            select(Message)
            .where(Message.workspace_id == workspace_id, Message.thread_id == thread_id)
            .order_by(asc(Message.created_at))
        )
    ).scalars()
    items = [
        MessageResponse(
            id=m.id,
            thread_id=m.thread_id,
            role=m.role,
            content=m.content,
            created_at=m.created_at,
            operation_id=m.operation_id,
        )
        for m in rows
    ]
    return MessagesListResponse(items=items)


@router.post("/threads/{thread_id}/turn", response_model=TurnResponse)
async def turn(
    request: Request,
    thread_id: uuid.UUID,
    body: TurnRequest,
    db: AsyncSession = Depends(get_db_session),
    x_operation_id: str | None = Header(default=None, alias="X-Operation-Id"),
) -> TurnResponse:
    """Запускает “turn” (пока stub/эхо) и сохраняет user+assistant сообщения.

    Идемпотентность:
    - если `X-Operation-Id` уже встречался для этого треда,
      возвращаем уже сохранённый результат.
    """
    workspace_id = _require_workspace_id(request)
    thread = await _get_thread(db, workspace_id=workspace_id, thread_id=thread_id)

    operation_uuid = None
    if x_operation_id:
        try:
            operation_uuid = uuid.UUID(x_operation_id)
        except Exception:
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_OPERATION_ID",
                    "message": "Некорректный X-Operation-Id",
                },
            ) from None

    # Дедуп: если assistant уже есть по operation_id — возвращаем его
    # (и user, если есть).
    if operation_uuid is not None:
        existing = (
            await db.execute(
                select(Message)
                .where(
                    Message.workspace_id == workspace_id,
                    Message.thread_id == thread_id,
                    Message.operation_id == operation_uuid,
                    Message.role == "assistant",
                )
                .limit(1)
            )
        ).scalar_one_or_none()
        if existing is not None:
            user_existing = (
                await db.execute(
                    select(Message)
                    .where(
                        Message.workspace_id == workspace_id,
                        Message.thread_id == thread_id,
                        Message.operation_id == operation_uuid,
                        Message.role == "user",
                    )
                    .limit(1)
                )
            ).scalar_one_or_none()
            if user_existing is None:
                # редкий случай, но на всякий
                user_existing = Message(
                    workspace_id=workspace_id,
                    thread_id=thread_id,
                    bot_id=thread.bot_id,
                    role="user",
                    content=body.content,
                    operation_id=operation_uuid,
                    created_at=datetime.now(timezone.utc),
                )
            return TurnResponse(
                thread_id=thread_id,
                user_message=_to_msg(user_existing),
                assistant_message=_to_msg(existing),
            )

    now = datetime.now(timezone.utc)
    user_msg = Message(
        workspace_id=workspace_id,
        thread_id=thread_id,
        bot_id=thread.bot_id,
        role="user",
        content=body.content,
        operation_id=operation_uuid,
        created_at=now,
    )
    assistant_msg = Message(
        workspace_id=workspace_id,
        thread_id=thread_id,
        bot_id=thread.bot_id,
        role="assistant",
        content=f"Эхо: {body.content}",
        operation_id=operation_uuid,
        created_at=now,
    )

    db.add(user_msg)
    db.add(assistant_msg)
    db.add(
        AuditLog(
            workspace_id=workspace_id,
            user_id=None,
            operation_id=operation_uuid,
            action="TURN_EXECUTED",
            resource_type="thread",
            resource_id=thread_id,
            changes={"bot_id": str(thread.bot_id) if thread.bot_id else None},
        )
    )
    try:
        await db.commit()
    except IntegrityError:
        # Если поймали гонку по unique (operation_id, role) — значит уже сохранено,
        # пробуем дочитать.
        await db.rollback()
        if operation_uuid is None:
            raise
        existing = (
            await db.execute(
                select(Message)
                .where(
                    Message.workspace_id == workspace_id,
                    Message.thread_id == thread_id,
                    Message.operation_id == operation_uuid,
                    Message.role == "assistant",
                )
                .limit(1)
            )
        ).scalar_one()
        user_existing = (
            await db.execute(
                select(Message)
                .where(
                    Message.workspace_id == workspace_id,
                    Message.thread_id == thread_id,
                    Message.operation_id == operation_uuid,
                    Message.role == "user",
                )
                .limit(1)
            )
        ).scalar_one()
        return TurnResponse(
            thread_id=thread_id,
            user_message=_to_msg(user_existing),
            assistant_message=_to_msg(existing),
        )

    await db.refresh(user_msg)
    await db.refresh(assistant_msg)
    return TurnResponse(
        thread_id=thread_id,
        user_message=_to_msg(user_msg),
        assistant_message=_to_msg(assistant_msg),
    )


def _to_msg(m: Message) -> MessageResponse:
    return MessageResponse(
        id=m.id,
        thread_id=m.thread_id,
        role=m.role,
        content=m.content,
        created_at=m.created_at,
        operation_id=m.operation_id,
    )


async def _get_thread(
    db: AsyncSession, *, workspace_id: uuid.UUID, thread_id: uuid.UUID
) -> Thread:
    t = (
        await db.execute(
            select(Thread).where(
                Thread.id == thread_id, Thread.workspace_id == workspace_id
            )
        )
    ).scalar_one_or_none()
    if t is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "THREAD_NOT_FOUND", "message": "Тред не найден"},
        )
    return t


def _require_workspace_id(request: Request) -> uuid.UUID:
    raw = getattr(request.state, "workspace_id", None)
    if not raw:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Нет X-Workspace-Id"},
        )
    return uuid.UUID(str(raw))
