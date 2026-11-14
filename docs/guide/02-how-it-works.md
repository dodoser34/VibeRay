# 2. Как всё устроено

## Общая схема

VibeRay состоит из одностраничного приложения (SPA) в браузере и REST API на сервере. Сейчас готов
фронтенд, бэкенд в планах.

```mermaid
flowchart TB
    subgraph browser["Браузер"]
        UI["React<br/>страницы, панели, формы"]
        SCENE["Three.js-сцена карты<br/>районы · метки · выбор кликом"]
        GSAP["GSAP<br/>камера, переходы, анимации"]
        API["shared/api<br/>fetch + JWT"]
        UI --> SCENE
        GSAP --> SCENE
        GSAP --> UI
        UI --> API
    end
    subgraph server["Сервер — план"]
        FAST["FastAPI<br/>api/v1 → services → models"]
        MEDIA["media/<br/>фото без EXIF"]
        DB[("База данных<br/>ещё не выбрана")]
        FAST --> DB
        FAST --> MEDIA
    end
    API -->|"HTTPS, JSON, /api/v1"| FAST
    STATIC["frontend/public/maps<br/>плитки карты (статика)"] --> SCENE
```

| Часть | Чем сделана | Состояние |
|---|---|---|
| Интерфейс | React 19, React Router 8, CSS Modules | работает |
| 3D-карта | Three.js | работает |
| Анимации | GSAP с плагинами ScrollTrigger и SplitText | работает |
| Сборка | Vite 8 | работает |
| REST API | FastAPI, Python 3.12+, Pydantic v2 | в планах |
| База данных | — | не выбрана, выбирает владелец проекта |
| Геоданные | OpenStreetMap и скрипты на Python | работают |

Карта рисуется на Three.js без картографических библиотек вроде Mapbox или Leaflet. Код написан на
JavaScript, стили — на CSS Modules без CSS-фреймворков.

## Как страница получает данные

Все запросы проходят через один клиент — `shared/api/client.js`. Компоненты сами в сеть не ходят: они
вызывают хук, хук — функцию запроса из `shared/api/endpoints/`, а клиент добавляет токен и разбирает ответ.

```mermaid
sequenceDiagram
    participant C as Компонент
    participant H as useRequest / хук фичи
    participant E as shared/api/endpoints
    participant CL as client.js
    participant S as FastAPI
    C->>H: нужны настроения районов
    H->>E: getCityMoods("kostanay", "day")
    E->>CL: GET /cities/kostanay/moods?period=day
    CL->>S: fetch + Authorization: Bearer
    S-->>CL: JSON
    CL-->>H: данные
    H-->>C: перерисовка
```

## Бэкенд

Бэкенд описан, но ещё не написан. Он будет устроен так:

```mermaid
flowchart LR
    R["api/v1<br/>роутеры: только HTTP,<br/>валидация, зависимости"] --> SV["services<br/>бизнес-логика"]
    SV --> MD["models<br/>таблицы БД"]
    R --> SC["schemas<br/>Pydantic: вход и выход"]
    SV --> UT["utils<br/>фото, гео"]
```

Роутеры только принимают HTTP-запросы, логика находится в `services`. Наружу данные отдаются через
Pydantic-схемы. Все адреса начинаются с `/api/v1`. Список запросов — в [разделе 9](09-data-and-api.md).

---

Назад: [1. Что такое VibeRay](01-what-is-viberay.md) · [Оглавление](README.md) · Дальше: [3. Структура проекта](03-project-structure.md)
