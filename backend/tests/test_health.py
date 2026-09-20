import asyncio

from httpx import ASGITransport, AsyncClient, Response

from app.main import app


async def _get_health() -> Response:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        return await client.get("/api/health")


async def _preflight(origin: str) -> Response:
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as client:
        return await client.options(
            "/api/health",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "GET",
            },
        )


def test_health_returns_ok() -> None:
    response = asyncio.run(_get_health())

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_private_lan_frontend_origin_is_allowed_in_development() -> None:
    response = asyncio.run(_preflight("http://192.168.1.42:5173"))

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://192.168.1.42:5173"


def test_unconfigured_public_origin_is_not_allowed() -> None:
    response = asyncio.run(_preflight("https://untrusted.example"))

    assert "access-control-allow-origin" not in response.headers
