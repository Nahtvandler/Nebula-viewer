# Nebula Viewer

Тонкий кастомный вьювер NebulaGraph, заточенный под нашу схему графа: ввёл nGQL → увидел граф →
кликнул по узлу → раскрылись соседи → посмотрел свойства. Аналитику (centrality, communities, пути)
сознательно не делаем — это остаётся за networkx/Gephi.

Стиль в духе Neo4j Browser: каждый запуск запроса создаёт отдельную «секцию» (frame) с графом.

## Стек

- **Frontend**: React 18 + TypeScript + Vite, граф на [cytoscape.js](https://js.cytoscape.org/) +
  fcose-раскладка, TanStack Query, Zustand. Тёмная/светлая темы, шрифты IBM Plex.
- **Backend**: FastAPI + [nebula3-python](https://github.com/vesoft-inc/nebula-python). Пул соединений
  с переиспользованием сессий, парсер `ResultSet → {nodes, edges}`.
- **Docker Compose**: два образа (backend + nginx-frontend), подключается к **уже поднятой** NebulaGraph.

## Быстрый старт

Предполагается, что NebulaGraph уже запущена (например, из `rsm-extractor/docker-compose.yml`:
контейнер `nebula-graphd` слушает `:9669`, пространство `rsm_graph_poc`).

```bash
cp .env.example .env          # при необходимости поправьте адрес/сеть/креды
docker compose up --build
```

Откройте http://localhost:8080 . В шапке — статус подключения и селектор пространства.
Пример запроса уже подставлен:

```ngql
MATCH (v:Component)-[e]->(n)
RETURN v, e, n LIMIT 50
```

Нажмите **Выполнить** (или `Ctrl`/`Cmd`+`Enter`).

## Основные сценарии

1. **Запрос → граф.** Ввели nGQL, выполнили — увидели подграф.
2. **Раскрытие.** Двойной клик по узлу (или ПКМ → «Раскрыть соседей») подтягивает соседей через
   `/api/expand`; уже присутствующие узлы не дублируются.
3. **Инспекция.** Клик по узлу/ребру → панель справа со всеми тегами/типом и свойствами.

## Подключение к Nebula

Backend по умолчанию ходит на `nebula-graphd:9669`, а compose присоединяется к внешней сети
`rsm-extractor_default`, чтобы видеть контейнер graphd по имени. Всё переопределяется через `.env`:

| Переменная        | Назначение                                  | Дефолт                 |
|-------------------|---------------------------------------------|------------------------|
| `NEBULA_HOST`     | Хост graphd                                 | `nebula-graphd`        |
| `NEBULA_PORT`     | Порт graphd                                 | `9669`                 |
| `NEBULA_USER`     | Пользователь                                | `root`                 |
| `NEBULA_PASSWORD` | Пароль                                      | `nebula`               |
| `NEBULA_SPACE`    | Пространство                                | `rsm_graph_poc`        |
| `NEBULA_NETWORK`  | Внешняя docker-сеть с graphd                | `rsm-extractor_default`|
| `FRONTEND_PORT`   | Порт фронта на хосте                        | `8080`                 |
| `BACKEND_PORT`    | Порт бэкенда на хосте (для отладки)         | `8010`                 |

**Nebula не в общей сети?** Уберите блок `networks` (external) из `docker-compose.yml` и укажите адрес,
доступный из контейнера, например `NEBULA_HOST=host.docker.internal`, `NEBULA_PORT=9669`.

Имя сети можно узнать: `docker network ls | grep nebula` (обычно `<папка>_default`).

## API бэкенда

| Метод | Путь           | Описание                                             |
|-------|----------------|------------------------------------------------------|
| POST  | `/api/query`   | Выполнить произвольный nGQL → `{nodes, edges, stats}`|
| POST  | `/api/expand`  | Соседи по `vid` (`direction`, `edge_types`, `limit`) |
| GET   | `/api/schema`  | Теги и типы рёбер пространства (для сайдбара)         |
| GET   | `/api/health`  | Статус подключения                                   |

Модель данных на фронте (постановка §5):

```json
{
  "nodes": [{ "id": "<vid>", "tags": ["Component"], "label": "payment-api", "props": { "...": "..." } }],
  "edges": [{ "id": "<src>-<dst>-<rank>-<type>", "source": "<vid>", "target": "<vid>",
              "type": "EXPOSES", "rank": 0, "props": {} }]
}
```

`id` узла и ребра — всегда строки (критично для дедупа на фронте). Ребро идентифицируется
тройкой `(src, dst, rank)` + тип.

## Разработка без Docker

```bash
# backend
cd backend
uv venv && uv pip install -e ".[dev]"
uv run uvicorn app.main:app --reload --port 8000   # нужен доступ к Nebula (NEBULA_HOST=localhost)

# frontend (в другом терминале)
cd frontend
npm install
npm run dev            # http://localhost:5173, /api проксируется на :8000
```

Тесты парсера:

```bash
cd backend && uv run pytest
```

## Специфика NebulaGraph (учтено в парсере)

- **VID строка или int64** — на фронте всегда строка; квотирование в `/expand` по типу пространства.
- **Несколько тегов на вершине** — свойства сгруппированы по тегам; подпись = `name/key/path/id`.
- **ValueWrapper** — значения разворачиваются вручную с проверкой типа.
- **Идентичность ребра** — `(src, dst, rank)` + тип, без неявного id.
- **NULL/пустые/смешанные VID** — не роняют парсер, приводятся/пропускаются.
