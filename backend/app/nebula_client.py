"""Клиент NebulaGraph: пул соединений + переиспользуемые сессии.

Сессия nebula3 не потокобезопасна, поэтому держим небольшой пул сессий
(LifoQueue) и берём/возвращаем по одной на запрос. Пул соединений
переиспользуется (постановка §4) — сессии не открываются на каждый вызов
заново, а живут в очереди.
"""

from __future__ import annotations

import queue
import threading
from contextlib import contextmanager
from typing import Iterator

from nebula3.Config import Config
from nebula3.gclient.net import ConnectionPool

from .config import settings


class NebulaError(RuntimeError):
    pass


class NebulaClient:
    def __init__(self) -> None:
        self._pool: ConnectionPool | None = None
        self._sessions: queue.LifoQueue = queue.LifoQueue()
        self._lock = threading.Lock()
        self._vid_types: dict[str, str] = {}

    # --- lifecycle -------------------------------------------------------

    def connect(self) -> None:
        config = Config()
        config.max_connection_pool_size = settings.pool_size
        pool = ConnectionPool()
        ok = pool.init([(settings.nebula_host, settings.nebula_port)], config)
        if not ok:
            raise NebulaError(
                f"Не удалось инициализировать пул к "
                f"{settings.nebula_host}:{settings.nebula_port}"
            )
        self._pool = pool

    def close(self) -> None:
        while not self._sessions.empty():
            try:
                self._sessions.get_nowait().release()
            except Exception:
                pass
        if self._pool is not None:
            self._pool.close()
            self._pool = None

    def reconnect(self) -> None:
        """Пересоздать пул: сбросить протухшие сессии/соединения и поднять заново.
        Нужен, когда graphd перезапустился ПОСЛЕ создания пула — тогда пул не
        None, но его соединения мертвы, и ленивого _ensure_pool недостаточно."""
        with self._lock:
            self.close()
            self.connect()

    # --- session pool ----------------------------------------------------

    def _ensure_pool(self) -> None:
        """Лениво поднять пул, если он ещё не инициализирован. Позволяет бэкенду
        самому переподключиться, если Nebula поднялась позже старта (гонка при
        рестарте контейнеров) — без ручного перезапуска бэкенда."""
        if self._pool is not None:
            return
        with self._lock:
            if self._pool is None:
                self.connect()

    def _new_session(self):
        self._ensure_pool()
        if self._pool is None:
            raise NebulaError("Пул соединений не инициализирован")
        session = self._pool.get_session(settings.nebula_user, settings.nebula_password)
        # Пытаемся привязать дефолтное пространство, но НЕ роняем сессию, если
        # его нет: каждый запрос всё равно делает USE нужного space в рамках
        # своего чекаута. Иначе неверный/отсутствующий NEBULA_SPACE полностью
        # блокирует бэкенд, хотя фронт передаёт корректное пространство сам.
        try:
            session.execute(f"USE `{settings.nebula_space}`")
        except Exception:
            pass
        return session

    @contextmanager
    def _session(self) -> Iterator:
        try:
            session = self._sessions.get_nowait()
        except queue.Empty:
            session = self._new_session()
        broken = False
        try:
            yield session
        except Exception:
            broken = True
            raise
        finally:
            if broken:
                try:
                    session.release()
                except Exception:
                    pass
            else:
                self._sessions.put(session)

    # --- queries ---------------------------------------------------------

    def _run(self, ngql: str, space: str | None):
        with self._session() as session:
            if space:
                used = session.execute(f"USE `{space}`")
                if not used.is_succeeded():
                    raise NebulaError(used.error_msg(), used.error_code())
            return session.execute(ngql)

    def execute(self, ngql: str, space: str | None = None):
        """Выполнить nGQL, вернуть ResultSet. Бросает NebulaError при ошибке.

        Если задан ``space`` — сессия переключается на него (``USE``) в рамках
        того же чекаута. При обрыве соединения/протухшей сессии (напр. graphd
        перезапустился) — один раз пересоздаём пул и повторяем запрос.
        """
        try:
            result = self._run(ngql, space)
        except NebulaError:
            raise  # ошибка уровня запроса (синтаксис, нет пространства) — не реконнектим
        except Exception:
            self.reconnect()
            result = self._run(ngql, space)
        if not result.is_succeeded():
            if _is_session_error(result.error_msg()):
                self.reconnect()
                result = self._run(ngql, space)
            if not result.is_succeeded():
                raise NebulaError(result.error_msg(), result.error_code())
        return result

    def execute_raw(self, ngql: str, space: str | None = None):
        """Выполнить nGQL и вернуть ResultSet как есть (без проверки успеха)."""
        try:
            with self._session() as session:
                if space:
                    used = session.execute(f"USE `{space}`")
                    if not used.is_succeeded():
                        return used
                return session.execute(ngql)
        except Exception:
            self.reconnect()
            with self._session() as session:
                if space:
                    session.execute(f"USE `{space}`")
                return session.execute(ngql)

    def list_spaces(self) -> list[str]:
        """Список пространств (SHOW SPACES)."""
        from .parser import unwrap

        result = self.execute("SHOW SPACES")
        names: list[str] = []
        for i in range(result.row_size()):
            try:
                names.append(str(unwrap(result.row_values(i)[0])))
            except Exception:
                continue
        return names

    # --- schema helpers --------------------------------------------------

    def vid_type(self, space: str) -> str:
        """Тип VID пространства (FIXED_STRING(n) / INT64). Кэшируется по space."""
        cached = self._vid_types.get(space)
        if cached is not None:
            return cached
        with self._lock:
            cached = self._vid_types.get(space)
            if cached is not None:
                return cached
            vid_type = "FIXED_STRING"
            try:
                result = self.execute(f"DESC SPACE `{space}`")
                keys = [k.lower() for k in result.keys()]
                if "vid_type" in keys and result.row_size() > 0:
                    from .parser import unwrap

                    idx = keys.index("vid_type")
                    raw = unwrap(result.row_values(0)[idx])
                    if raw:
                        vid_type = str(raw)
            except Exception:
                pass
            self._vid_types[space] = vid_type
            return vid_type

    def format_vid(self, vid: str, space: str) -> str:
        """Экранировать VID для подстановки в nGQL по типу пространства.

        Строковый VID -> "...", целочисленный -> без кавычек.
        """
        vtype = self.vid_type(space).upper()
        if "INT" in vtype:
            digits = str(vid).strip()
            try:
                return str(int(digits))
            except ValueError:
                # Пришёл нечисловой vid для int-пространства — вернём как есть.
                return digits
        escaped = (
            str(vid)
            .replace("\\", "\\\\")
            .replace('"', '\\"')
            .replace("\n", "\\n")
            .replace("\r", "\\r")
        )
        return f'"{escaped}"'


def _is_session_error(msg: str | None) -> bool:
    """Похоже ли на протухшую/невалидную сессию или обрыв соединения —
    тогда имеет смысл пересоздать пул и повторить (а не отдавать ошибку)."""
    m = (msg or "").lower()
    return any(k in m for k in ("session", "expired", "broken", "connection", "closed"))


client = NebulaClient()
