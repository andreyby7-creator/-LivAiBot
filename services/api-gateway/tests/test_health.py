from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from src.config.settings import Settings
from src.main import create_app
from src.security.jwt import issue_access_token


def test_healthz() -> None:
    app = create_app(Settings(readiness_strict=False, proxy_enabled=False))
    client = TestClient(app)
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
    assert r.headers.get("X-Trace-Id")
    assert r.headers.get("X-Operation-Id")


def test_readyz() -> None:
    app = create_app(Settings(readiness_strict=False, proxy_enabled=False))
    client = TestClient(app)
    r = client.get("/readyz")
    assert r.status_code == 200
    payload = r.json()
    assert payload["status"] == "ready"
    assert payload["checks"]["postgres"]["ok"] is True
    assert payload["checks"]["redis"]["ok"] is True


def test_trace_id_is_propagated() -> None:
    app = create_app(Settings(readiness_strict=False, proxy_enabled=False))
    client = TestClient(app)
    trace_id = "test-trace-id"
    r = client.get("/healthz", headers={"X-Trace-Id": trace_id})
    assert r.status_code == 200
    assert r.headers["X-Trace-Id"] == trace_id


def test_legacy_request_id_header_is_accepted() -> None:
    app = create_app(Settings(readiness_strict=False, proxy_enabled=False))
    client = TestClient(app)
    legacy_id = "legacy-request-id"
    r = client.get("/healthz", headers={"X-Request-Id": legacy_id})
    assert r.status_code == 200
    assert r.headers["X-Trace-Id"] == legacy_id


def test_operation_id_is_propagated() -> None:
    app = create_app(Settings(readiness_strict=False, proxy_enabled=False))
    client = TestClient(app)
    op_id = str(uuid.uuid4())
    r = client.get("/healthz", headers={"X-Operation-Id": op_id})
    assert r.status_code == 200
    assert r.headers["X-Operation-Id"] == op_id


def test_v1_requires_auth_by_default() -> None:
    app = create_app(Settings(readiness_strict=False, proxy_enabled=False))
    client = TestClient(app)
    r = client.get("/v1/bots")
    assert r.status_code == 401
    assert r.json()["code"] == "UNAUTHORIZED"


def test_v1_auth_routes_are_public() -> None:
    app = create_app(Settings(readiness_strict=False, proxy_enabled=False))
    client = TestClient(app)
    # proxy выключен => stub 501, но не 401
    r = client.get("/v1/auth/healthz")
    assert r.status_code == 501


def test_auth_injects_workspace_context_headers() -> None:
    settings = Settings(readiness_strict=False, proxy_enabled=False, jwt_secret="test", jwt_issuer="issuer")
    app = create_app(settings)
    client = TestClient(app)

    token = issue_access_token(
        secret="test",
        issuer="issuer",
        user_id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
        ttl_seconds=60,
    )
    r = client.get("/v1/bots/anything", headers={"Authorization": f"Bearer {token}"})
    # proxy выключен => stub 501, но middleware уже должен был пропустить
    assert r.status_code == 501
