from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class GraphNode(BaseModel):
    id: str  # VID как строка — всегда, критично для дедупа на фронте
    tags: list[str] = Field(default_factory=list)
    label: str
    props: dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    id: str  # "{src}-{dst}-{rank}-{type}" — стабильный id для дедупа
    source: str
    target: str
    type: str
    rank: int = 0
    props: dict[str, Any] = Field(default_factory=dict)


class GraphStats(BaseModel):
    nodes: int
    edges: int
    latency_ms: float | None = None
    truncated: bool = False


class TableData(BaseModel):
    """Сырая результирующая таблица запроса (как вкладка Table в Neo4j).

    columns — имена колонок RETURN; rows — строки, где ячейка это примитив
    (строка/число/bool/null) либо текстовый рендер вершины/ребра/пути
    (Neo4j-стиль `(:Tag {..})-[:TYPE {..}]->(:Tag {..})`).
    """

    columns: list[str] = Field(default_factory=list)
    rows: list[list[Any]] = Field(default_factory=list)
    truncated: bool = False


class GraphResult(BaseModel):
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)
    table: TableData | None = None
    stats: GraphStats


class QueryRequest(BaseModel):
    query: str
    space: str | None = None


class ExpandRequest(BaseModel):
    vid: str
    space: str | None = None
    edge_types: list[str] | None = None
    direction: Literal["both", "out", "in"] = "both"
    limit: int = 100


class SpacesInfo(BaseModel):
    spaces: list[str] = Field(default_factory=list)
    current: str


class TagInfo(BaseModel):
    name: str
    count: int | None = None


class EdgeTypeInfo(BaseModel):
    name: str
    count: int | None = None


class SchemaInfo(BaseModel):
    space: str
    tags: list[TagInfo] = Field(default_factory=list)
    edge_types: list[EdgeTypeInfo] = Field(default_factory=list)


class HealthInfo(BaseModel):
    connected: bool
    space: str
    address: str
    version: str | None = None
    error: str | None = None


class QueryError(BaseModel):
    error: str
    code: int | None = None
