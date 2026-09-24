from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.game import router as game_router
from app.api.media import router as media_router
from app.api.rooms import router as rooms_router
from app.realtime.routes import router as realtime_router
from app.settings import settings


def create_app() -> FastAPI:
    application = FastAPI(title=settings.app_name)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(health_router, prefix="/api")
    application.include_router(rooms_router, prefix="/api")
    application.include_router(game_router, prefix="/api")
    application.include_router(media_router, prefix="/api")
    application.include_router(realtime_router)
    return application


app = create_app()
