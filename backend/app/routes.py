from __future__ import annotations

import time

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from .config import settings
from .models import (
    EdgeTypeInfo,
    ExpandRequest,
    GraphResult,
    GraphStats,
    HealthInfo,
    QueryRequest,
    SchemaInfo,
    SpacesInfo,
    TableData,
    TagInfo,
)
from .nebula_client import NebulaError, client
from .parser import build_table, parse_result_set, unwrap

router = APIRouter(prefix="/api")


def _error_response(exc: NebulaError):
    return JSONResponse(
        status_code=200,
        content={"error": str(exc.args[0]), "code": exc.args[1] if len(exc.args) > 1 else None},
    )


def _run_graph_query(ngql: str, space: str) -> GraphResult:
    started = time.perf_counter()
    result = client.execute(ngql, space=space)
    nodes, edges, truncated = parse_result_set(result, settings.max_elements)
    raw = build_table(result)
    latency = (time.perf_counter() - started) * 1000
    return GraphResult(
        nodes=nodes,
        edges=edges,
        table=TableData(**raw) if raw else None,
        stats=GraphStats(
            nodes=len(nodes),
            edges=len(edges),
            latency_ms=round(latency, 1),
            truncated=truncated,
        ),
    )


@router.post("/query")
def run_query(req: QueryRequest):
    query = (req.query or "").strip()
    if not query:
        return JSONResponse(status_code=400, content={"error": "Пустой запрос", "code": None})
    space = req.space or settings.nebula_space
    try:
        return _run_graph_query(query, space)
    except NebulaError as exc:
        return _error_response(exc)


@router.post("/expand")
def expand(req: ExpandRequest):
    space = req.space or settings.nebula_space
    vid = client.format_vid(req.vid, space)
    if req.direction == "out":
        pattern = f"(v)-[e{_edge_filter(req.edge_types)}]->(n)"
    elif req.direction == "in":
        pattern = f"(v)<-[e{_edge_filter(req.edge_types)}]-(n)"
    else:
        pattern = f"(v)-[e{_edge_filter(req.edge_types)}]-(n)"
    limit = max(1, min(req.limit, settings.max_elements))
    ngql = f"MATCH {pattern} WHERE id(v) == {vid} RETURN v, e, n LIMIT {limit}"
    try:
        return _run_graph_query(ngql, space)
    except NebulaError as exc:
        return _error_response(exc)


def _edge_filter(edge_types: list[str] | None) -> str:
    if not edge_types:
        return ""
    safe = [t for t in edge_types if t.replace("_", "").isalnum()]
    return (":" + "|".join(safe)) if safe else ""


@router.get("/spaces", response_model=SpacesInfo)
def spaces() -> SpacesInfo:
    try:
        names = client.list_spaces()
    except NebulaError:
        names = []
    return SpacesInfo(spaces=names, current=settings.nebula_space)


@router.get("/schema", response_model=SchemaInfo)
def schema(space: str | None = None) -> SchemaInfo:
    space = space or settings.nebula_space
    tags = _show_names("SHOW TAGS", space)
    edge_types = _show_names("SHOW EDGES", space)
    counts = _stats_counts(space)
    return SchemaInfo(
        space=space,
        tags=[TagInfo(name=t, count=counts.get(("Tag", t))) for t in tags],
        edge_types=[EdgeTypeInfo(name=e, count=counts.get(("Edge", e))) for e in edge_types],
    )


def _show_names(stmt: str, space: str) -> list[str]:
    try:
        result = client.execute(stmt, space=space)
    except NebulaError:
        return []
    names: list[str] = []
    for i in range(result.row_size()):
        try:
            names.append(str(unwrap(result.row_values(i)[0])))
        except Exception:
            continue
    return names


def _stats_counts(space: str) -> dict[tuple[str, str], int]:
    """Счётчики из SHOW STATS (если джоба статистики уже выполнялась)."""
    counts: dict[tuple[str, str], int] = {}
    try:
        result = client.execute_raw("SHOW STATS", space=space)
    except Exception:
        return counts
    if not result.is_succeeded():
        return counts
    keys = [k.lower() for k in result.keys()]
    try:
        i_type, i_name, i_count = keys.index("type"), keys.index("name"), keys.index("count")
    except ValueError:
        return counts
    for i in range(result.row_size()):
        try:
            row = result.row_values(i)
            counts[(str(unwrap(row[i_type])), str(unwrap(row[i_name])))] = int(unwrap(row[i_count]))
        except Exception:
            continue
    return counts


@router.get("/health", response_model=HealthInfo)
def health() -> HealthInfo:
    address = f"{settings.nebula_host}:{settings.nebula_port}"
    try:
        client.execute("YIELD 1 AS ok")
        return HealthInfo(connected=True, space=settings.nebula_space, address=address)
    except Exception as exc:  # noqa: BLE001
        return HealthInfo(
            connected=False,
            space=settings.nebula_space,
            address=address,
            error=str(exc),
        )
