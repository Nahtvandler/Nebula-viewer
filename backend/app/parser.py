"""Разбор nebula3 ResultSet в {nodes, edges}.

Вся возня со спецификой NebulaGraph изолирована здесь (постановка §4, §7):
  - VID бывает строкой или int64 -> на выходе всегда строка;
  - у вершины может быть несколько тегов, свойства сгруппированы по тегам;
  - значения приходят в ValueWrapper -> разворачиваем в python-типы;
  - у рёбер нет неявного id -> id = (src, dst, rank, type);
  - пустые/NULL и разные типы VID в одном ответе не должны ронять парсер.
"""

from __future__ import annotations

import os
from typing import Any

from .models import GraphEdge, GraphNode

# Приоритет свойств для человекочитаемой подписи узла.
# path выше key: у OutboundCall/ApiEndpoint нет name/title, но есть осмысленный
# path (роут вызова/эндпоинта) — его и показываем, а не технический хэш key.
_LABEL_KEYS = ("name", "title", "path", "file_path", "key", "id")


def _get_props(node: Any, tag: str) -> dict[str, Any]:
    """Свойства тега вершины. В nebula3-python метод исторически называется
    ``properties`` в свежих версиях и ``propertys`` в старых — пробуем оба."""
    getter = getattr(node, "properties", None) or getattr(node, "propertys", None)
    if getter is None:
        return {}
    try:
        raw = getter(tag)
    except Exception:
        return {}
    return {k: unwrap(v) for k, v in (raw or {}).items()}


def unwrap(value: Any) -> Any:
    """Развернуть ValueWrapper (или уже готовый python-тип) в JSON-совместимое."""
    # Уже примитив/None — отдаём как есть.
    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    # Не ValueWrapper — не знаем, что это; приводим к строке безопасно.
    if not hasattr(value, "is_null"):
        return _safe_str(value)

    try:
        if value.is_null() or value.is_empty():
            return None
        if value.is_bool():
            return value.as_bool()
        if value.is_int():
            return value.as_int()
        if value.is_double():
            return value.as_double()
        if value.is_string():
            return value.as_string()
        if value.is_list():
            return [unwrap(v) for v in value.as_list()]
        if value.is_set():
            return [unwrap(v) for v in value.as_set()]
        if value.is_map():
            return {k: unwrap(v) for k, v in value.as_map().items()}
        if value.is_time():
            return _fmt_time(value.as_time())
        if value.is_date():
            return _fmt_date(value.as_date())
        if value.is_datetime():
            return _fmt_datetime(value.as_datetime())
    except Exception:
        return _safe_str(value)

    return _safe_str(value)


def vid_to_str(value: Any) -> str:
    """VID -> строка (строковые и int64 приводим единообразно)."""
    unwrapped = unwrap(value)
    if unwrapped is None:
        return ""
    return str(unwrapped)


def node_to_dict(node: Any) -> GraphNode | None:
    """nebula3 Node -> GraphNode. None, если это не вершина."""
    try:
        vid = vid_to_str(node.get_id())
    except Exception:
        return None
    if not vid:
        return None

    try:
        tags = list(node.tags())
    except Exception:
        tags = []

    props: dict[str, Any] = {}
    for tag in tags:
        for key, val in _get_props(node, tag).items():
            # Плоская карта свойств; коллизии имён между тегами крайне редки.
            props.setdefault(key, val)

    return GraphNode(id=vid, tags=tags, label=_pick_label(vid, tags, props), props=props)


def edge_to_dict(rel: Any) -> GraphEdge | None:
    """nebula3 Relationship -> GraphEdge. None, если это не ребро."""
    try:
        src = vid_to_str(rel.start_vertex_id())
        dst = vid_to_str(rel.end_vertex_id())
        etype = rel.edge_name()
        rank = int(rel.ranking())
    except Exception:
        return None

    try:
        props = {k: unwrap(v) for k, v in (rel.properties() or {}).items()}
    except Exception:
        props = {}

    edge_id = f"{src}-{dst}-{rank}-{etype}"
    return GraphEdge(id=edge_id, source=src, target=dst, type=etype, rank=rank, props=props)


def _walk_value(value: Any, nodes: dict[str, GraphNode], edges: dict[str, GraphEdge]) -> None:
    """Рекурсивно вытащить из значения все вершины/рёбра (вкл. path, list, map)."""
    if value is None or not hasattr(value, "is_null"):
        return
    try:
        if value.is_null() or value.is_empty():
            return
        if value.is_vertex():
            node = node_to_dict(value.as_node())
            if node:
                nodes[node.id] = node
            return
        if value.is_edge():
            edge = edge_to_dict(value.as_relationship())
            if edge:
                edges[edge.id] = edge
            return
        if value.is_path():
            _walk_path(value.as_path(), nodes, edges)
            return
        if value.is_list():
            for item in value.as_list():
                _walk_value(item, nodes, edges)
            return
        if value.is_set():
            for item in value.as_set():
                _walk_value(item, nodes, edges)
            return
        if value.is_map():
            for item in value.as_map().values():
                _walk_value(item, nodes, edges)
            return
    except Exception:
        # Спорное значение просто пропускаем — не роняем весь ответ.
        return


def _walk_path(path: Any, nodes: dict[str, GraphNode], edges: dict[str, GraphEdge]) -> None:
    try:
        for raw_node in path.nodes():
            node = node_to_dict(raw_node)
            if node:
                nodes[node.id] = node
    except Exception:
        pass
    try:
        for raw_rel in path.relationships():
            edge = edge_to_dict(raw_rel)
            if edge:
                edges[edge.id] = edge
    except Exception:
        pass


def parse_result_set(result: Any, max_elements: int | None = None) -> tuple[list[GraphNode], list[GraphEdge], bool]:
    """Обойти все колонки всех строк ResultSet, собрать уникальные узлы/рёбра.

    Возвращает (nodes, edges, truncated).
    """
    nodes: dict[str, GraphNode] = {}
    edges: dict[str, GraphEdge] = {}
    truncated = False

    try:
        row_count = result.row_size()
    except Exception:
        row_count = 0

    for i in range(row_count):
        try:
            row_values = result.row_values(i)
        except Exception:
            continue
        for value in row_values:
            _walk_value(value, nodes, edges)
        if max_elements and (len(nodes) + len(edges)) >= max_elements:
            truncated = True
            break

    # Оставляем только рёбра, оба конца которых присутствуют среди узлов —
    # чтобы на канвасе не было "висящих" рёбер.
    clean_edges = [e for e in edges.values() if e.source in nodes and e.target in nodes]
    return list(nodes.values()), clean_edges, truncated


# --- helpers -------------------------------------------------------------


def _pick_label(vid: str, tags: list[str], props: dict[str, Any]) -> str:
    for key in _LABEL_KEYS:
        val = props.get(key)
        if val is None or val == "":
            continue
        text = str(val)
        # Базовое имя показываем только для ФАЙЛОВЫХ путей; API-роут (path)
        # оставляем целиком — во фронте длинное всё равно обрежется ellipsis'ом.
        if key == "file_path" and ("/" in text or "\\" in text):
            return os.path.basename(text.replace("\\", "/"))
        return text
    if tags:
        return f"{tags[0]}:{vid}"
    return vid


def _safe_str(value: Any) -> str:
    try:
        return str(value)
    except Exception:
        return ""


def _fmt_date(d: Any) -> str:
    try:
        return f"{d.get_year():04d}-{d.get_month():02d}-{d.get_day():02d}"
    except Exception:
        return _safe_str(d)


def _fmt_time(t: Any) -> str:
    try:
        return f"{t.get_hour():02d}:{t.get_minute():02d}:{t.get_sec():02d}"
    except Exception:
        return _safe_str(t)


def _fmt_datetime(dt: Any) -> str:
    try:
        return (
            f"{dt.get_year():04d}-{dt.get_month():02d}-{dt.get_day():02d}"
            f"T{dt.get_hour():02d}:{dt.get_minute():02d}:{dt.get_sec():02d}"
        )
    except Exception:
        return _safe_str(dt)
