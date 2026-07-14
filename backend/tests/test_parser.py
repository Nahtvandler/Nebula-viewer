"""Юниты парсера на фейковых ValueWrapper (без живой Nebula).

Фейки повторяют ровно тот срез API nebula3-python, который использует parser.py.
"""

from __future__ import annotations

from app.parser import edge_to_dict, node_to_dict, parse_result_set, unwrap, vid_to_str


class FakeValue:
    """Мимикрия ValueWrapper: ровно один kind установлен."""

    def __init__(self, kind: str, payload=None):
        self._kind = kind
        self._payload = payload

    def is_null(self):
        return self._kind == "null"

    def is_empty(self):
        return self._kind == "empty"

    def is_bool(self):
        return self._kind == "bool"

    def is_int(self):
        return self._kind == "int"

    def is_double(self):
        return self._kind == "double"

    def is_string(self):
        return self._kind == "string"

    def is_list(self):
        return self._kind == "list"

    def is_set(self):
        return self._kind == "set"

    def is_map(self):
        return self._kind == "map"

    def is_time(self):
        return False

    def is_date(self):
        return False

    def is_datetime(self):
        return False

    def is_vertex(self):
        return self._kind == "vertex"

    def is_edge(self):
        return self._kind == "edge"

    def is_path(self):
        return self._kind == "path"

    def as_bool(self):
        return self._payload

    def as_int(self):
        return self._payload

    def as_double(self):
        return self._payload

    def as_string(self):
        return self._payload

    def as_list(self):
        return self._payload

    def as_set(self):
        return self._payload

    def as_map(self):
        return self._payload

    def as_node(self):
        return self._payload

    def as_relationship(self):
        return self._payload

    def as_path(self):
        return self._payload


class FakeNode:
    def __init__(self, vid, tags, props_by_tag):
        self._vid = vid
        self._tags = tags
        self._props = props_by_tag

    def get_id(self):
        return self._vid if isinstance(self._vid, FakeValue) else FakeValue("string", self._vid)

    def tags(self):
        return list(self._tags)

    def properties(self, tag):
        return self._props.get(tag, {})


class FakeRel:
    def __init__(self, src, dst, name, rank, props):
        self._src, self._dst, self._name, self._rank, self._props = src, dst, name, rank, props

    def start_vertex_id(self):
        return self._src if isinstance(self._src, FakeValue) else FakeValue("string", self._src)

    def end_vertex_id(self):
        return self._dst if isinstance(self._dst, FakeValue) else FakeValue("string", self._dst)

    def edge_name(self):
        return self._name

    def ranking(self):
        return self._rank

    def properties(self):
        return self._props


class FakePath:
    def __init__(self, nodes, rels):
        self._nodes, self._rels = nodes, rels

    def nodes(self):
        return self._nodes

    def relationships(self):
        return self._rels


class FakeResultSet:
    def __init__(self, rows, keys=None):
        self._rows = rows
        self._keys = keys or []

    def row_size(self):
        return len(self._rows)

    def row_values(self, i):
        return self._rows[i]

    def keys(self):
        return self._keys


def sval(v):
    return FakeValue("string", v)


def ival(v):
    return FakeValue("int", v)


def vertex(vid, tags, props):
    return FakeValue("vertex", FakeNode(vid, tags, props))


def edge(src, dst, name, rank=0, props=None):
    return FakeValue("edge", FakeRel(src, dst, name, rank, {k: sval(x) for k, x in (props or {}).items()}))


# --- tests ---------------------------------------------------------------


def test_unwrap_primitives_and_nested():
    assert unwrap(sval("x")) == "x"
    assert unwrap(ival(30)) == 30
    assert unwrap(FakeValue("null")) is None
    assert unwrap(FakeValue("list", [sval("a"), ival(2)])) == ["a", 2]
    assert unwrap(FakeValue("map", {"k": sval("v")})) == {"k": "v"}


def test_vid_string_and_int_both_to_str():
    assert vid_to_str(sval("sys-billing")) == "sys-billing"
    assert vid_to_str(ival(42)) == "42"


def test_node_multi_tag_props_flattened_and_label():
    node = node_to_dict(
        FakeNode("cmp-1", ["Component", "System"], {
            "Component": {"name": sval("payment-api"), "language": sval("Java")},
            "System": {"owner": sval("core")},
        })
    )
    assert node is not None
    assert node.id == "cmp-1"
    assert set(node.tags) == {"Component", "System"}
    assert node.label == "payment-api"  # взято из name
    assert node.props["language"] == "Java"
    assert node.props["owner"] == "core"


def test_node_label_falls_back_to_basename_for_path():
    node = node_to_dict(FakeNode("git-1", ["GitFile"], {
        "GitFile": {"file_path": sval("src/main/java/billing/ChargeController.java")},
    }))
    assert node.label == "ChargeController.java"


def test_node_label_falls_back_to_tag_and_vid():
    node = node_to_dict(FakeNode("x-1", ["DTO"], {"DTO": {}}))
    assert node.label == "DTO:x-1"


def test_edge_identity_is_src_dst_rank_type():
    e = edge_to_dict(FakeRel("a", "b", "FOLLOWS", 2, {}))
    assert e.id == "a-b-2-FOLLOWS"
    assert e.source == "a" and e.target == "b" and e.rank == 2


def test_parse_result_set_dedups_and_drops_dangling_edges():
    rows = [
        [vertex("a", ["Component"], {"Component": {"name": sval("A")}}),
         edge("a", "b", "CONTAINS"),
         vertex("b", ["Module"], {"Module": {"name": sval("B")}})],
        # тот же узел a и то же ребро a-b -> должны схлопнуться
        [vertex("a", ["Component"], {"Component": {"name": sval("A")}}),
         edge("a", "b", "CONTAINS")],
        # ребро в никуда: c нет среди узлов -> должно быть отброшено
        [edge("a", "c", "EXPOSES")],
    ]
    nodes, edges, truncated = parse_result_set(FakeResultSet(rows))
    assert {n.id for n in nodes} == {"a", "b"}
    assert len(edges) == 1
    assert edges[0].id == "a-b-0-CONTAINS"
    assert truncated is False


def test_parse_result_set_handles_path_and_null():
    path = FakeValue("path", FakePath(
        nodes=[FakeNode("p1", ["System"], {"System": {"name": sval("Sys")}}),
               FakeNode("p2", ["Module"], {"Module": {"name": sval("Mod")}})],
        rels=[FakeRel("p1", "p2", "CONTAINS", 0, {})],
    ))
    rows = [[FakeValue("null"), path]]
    nodes, edges, _ = parse_result_set(FakeResultSet(rows))
    assert {n.id for n in nodes} == {"p1", "p2"}
    assert len(edges) == 1
