from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки бэкенда.

    Дефолты рассчитаны на подключение к уже поднятой NebulaGraph из
    rsm-extractor (контейнер graphd в сети rsm-extractor_default).
    """

    model_config = SettingsConfigDict(env_prefix="", env_file=".env", extra="ignore")

    nebula_host: str = Field(default="nebula-graphd", alias="NEBULA_HOST")
    nebula_port: int = Field(default=9669, alias="NEBULA_PORT")
    nebula_user: str = Field(default="root", alias="NEBULA_USER")
    nebula_password: str = Field(default="nebula", alias="NEBULA_PASSWORD")
    nebula_space: str = Field(default="rsm_graph_poc", alias="NEBULA_SPACE")

    # Размер пула сессий (реюз, без открытия сессии на каждый запрос).
    pool_size: int = Field(default=8, alias="NEBULA_POOL_SIZE")

    # Жёсткий предел на число элементов в ответе, чтобы не подвесить фронт.
    max_elements: int = Field(default=2000, alias="MAX_ELEMENTS")

    # CORS: список origin через запятую ("*" — разрешить всё, для dev).
    cors_origins: str = Field(default="*", alias="CORS_ORIGINS")

    @property
    def cors_origin_list(self) -> list[str]:
        raw = self.cors_origins.strip()
        if raw in ("", "*"):
            return ["*"]
        return [item.strip() for item in raw.split(",") if item.strip()]


settings = Settings()
