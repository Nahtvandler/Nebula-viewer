from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .nebula_client import client
from .routes import router

logger = logging.getLogger("nebula_viewer")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        client.connect()
        logger.info("Подключён пул к %s:%s", settings.nebula_host, settings.nebula_port)
    except Exception as exc:  # noqa: BLE001
        # Не валим старт: /health покажет проблему, Nebula может подняться позже.
        logger.warning("Пул к Nebula не поднялся на старте: %s", exc)
    yield
    client.close()


app = FastAPI(title="Nebula Viewer API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {"service": "nebula-viewer-backend", "space": settings.nebula_space}
