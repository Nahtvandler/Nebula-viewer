# syntax=docker/dockerfile:1
FROM python:3.11-slim

# uv — быстрый менеджер пакетов
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_SYSTEM_PYTHON=1 \
    UV_COMPILE_BYTECODE=1

WORKDIR /app

# Ставим зависимости отдельным слоем для кэша
COPY pyproject.toml ./
RUN uv pip install --system fastapi "uvicorn[standard]" nebula3-python "pydantic>=2.9" "pydantic-settings>=2.6"

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
