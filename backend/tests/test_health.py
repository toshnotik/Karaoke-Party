import asyncio

from httpx import ASGITransport, AsyncClient, Response

from app.main import app


async def _get_health() -> Response:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        return await client.get("/api/health")


def test_health_returns_ok() -> None:
    response = asyncio.run(_get_health())

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
