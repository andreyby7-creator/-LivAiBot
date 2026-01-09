from __future__ import annotations

from fastapi.testclient import TestClient

from auth_src.config.settings import Settings
from auth_src.main import create_app


def test_healthz() -> None:
    app = create_app(Settings())
    client = TestClient(app)
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
