# VibeRay

Живая 3D-карта настроения и проблем города. Жители отмечают, как им в их районе, и сообщают о реальных
проблемах — мусор, ямы, тёмные дворы, пробки. Соседи подтверждают, а город видит, чем живёт каждый район.
Первый город — **Костанай** (18 районов по данным OpenStreetMap).

Сайт: https://dodoser34.github.io/VibeRay/ — работает в демо-режиме, без сервера.

---

## Что умеет

| Раздел | Что внутри |
|---|---|
| **Карта** | 3D-город из районов; цвет и высота района — его настроение; слои «Районы / Настроение / Проблемы»; время суток как в городе; скрываемые боковые панели |
| **Настроение** | отметка одним касанием (7 вариантов); публично — только среднее по району и только от 5 отметок |
| **Проблемы** | категория, точка на карте, описание, до 3 фото; подтверждения соседей; статусы «новая → подтверждена → в работе → решена», модерация спама и дублей («отклонена») |
| **Статистика** | карточка района (настроение, динамика, проблемы) и дашборд города за месяц, год, все годы; сравнение двух районов |
| **Профиль** | вход и регистрация; публично только ник и аватар; мои сообщения, уведомления, свой район |
| **О проекте, поддержка** | история идеи на прокрутке, ответы на вопросы, форма обращения |
| **Языки** | русский и английский, переключаются флагами без перезагрузки |

---

## Быстрый старт

Нужен только **Node.js 24 LTS** (вместе с ним ставится npm).

```bash
cd frontend
npm install
npm run dev
```

Откройте http://localhost:5173. Бэкенд не нужен: запросы обслуживает фейковый API в браузере
(`frontend/src/demo-data`). Демо-вход: **demo@viberay.kz / demo12345** (кнопка «Заполнить» на форме входа).

| Команда (в `frontend/`) | Что делает |
|---|---|
| `npm run dev` | dev-сервер с горячей перезагрузкой |
| `npm run build` | сборка в `frontend/dist` |
| `npm run preview` | посмотреть собранную версию |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

Перед коммитом: `npm run lint`, `npm run build` и `npx prettier --check src` — без ошибок.

---

## Что используется и где

### Программы

| Что | Зачем | Когда нужно |
|---|---|---|
| Node.js 24 LTS + npm | сборка и запуск фронтенда | сейчас |
| Git | версии, публикация на GitHub Pages | сейчас |
| Python 3.12+ | бэкенд | когда появится бэкенд |
| Blender | правка 3D-комнаты для «О проекте» (`.blend`) | только для 3D-модели |

### Фронтенд — `frontend/package.json`

Ставится одной командой `npm install`, версии закреплены в `package-lock.json`.

| Библиотека | Где используется |
|---|---|
| **react**, **react-dom** 19 | весь интерфейс: страницы `src/pages`, модули `src/features`, UI-кит `src/shared/ui` |
| **react-router** 8 | маршруты `src/app/router.jsx` (карта, район, проблема, статистика, о проекте, поддержка, настройки, 404) |
| **three** | 3D: карта `src/features/map/scene`, город на главной `src/features/hero/scene`, история `src/features/story/scene` |
| **gsap**, **@gsap/react** | анимации: перелёты камеры, появление панелей, переходы страниц, скролл-история (ScrollTrigger), заголовки по словам (SplitText), смена языка; пресеты — `src/shared/animations` |
| vite 8, @vitejs/plugin-react | сборка и dev-сервер (`frontend/vite.config.js`) |
| eslint 9 + @eslint/js, eslint-plugin-react, eslint-plugin-react-hooks, globals | проверка кода (`frontend/eslint.config.js`) |
| prettier | форматирование (`frontend/.prettierrc`) |

Стили — CSS Modules и CSS-переменные (`src/styles/tokens.css`), без CSS-фреймворков.

### Бэкенд — `backend/requirements.txt`, `backend/requirements-dev.txt`

Кода бэкенда пока нет — файлы фиксируют утверждённый стек и версии. **База данных ещё не выбрана** —
её драйвер, ORM и миграции добавятся после выбора.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows; на macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
```

| Библиотека | Зачем |
|---|---|
| fastapi, uvicorn | REST API (`/api/v1`) и сервер |
| pydantic, pydantic-settings, email-validator | схемы запросов и ответов, конфиг из `.env` |
| pyjwt, argon2-cffi | токены входа и хеши паролей |
| python-multipart, pillow | загрузка фото, ресайз, удаление EXIF (геометки) |
| pytest, pytest-asyncio, httpx, ruff | тесты и линтер (только `requirements-dev.txt`) |

Скрипту схемы дорог `backend/scripts/build_streets.py` пакеты не нужны — только стандартная библиотека Python.

### Данные

Районы, улицы и вода — **OpenStreetMap** (лицензия ODbL, подпись «© участники OpenStreetMap» на карте).
Снимок Костаная лежит в двух копиях: `backend/data/cities/kostanay` (для бэкенда) и
`frontend/src/demo-data/cities/kostanay` (для демо-режима). Обновить схему дорог (обе копии сразу):

```bash
python backend/scripts/build_streets.py kostanay
```

---

## Структура

```
VibeRay/
├── README.md               # этот файл
├── CLAUDE.md               # правила проекта (локальный, в .gitignore)
├── ARCHITECTURE.md         # архитектура: папки, модель данных, API, алгоритмы, 3D, языки
├── docs/                   # DECISIONS.md — журнал решений, CHANGELOG.md — журнал изменений, 3d/ — .blend
├── .github/workflows/      # deploy-pages.yml — сборка и публикация сайта
├── frontend/               # React + Vite + Three.js + GSAP
│   ├── public/             # favicon, 3D-модель комнаты (models/story-room.glb)
│   └── src/
│       ├── main.jsx        # точка входа (первым подключается язык интерфейса)
│       ├── app/            # оболочка, маршруты, таб-бар, переходы между страницами
│       ├── pages/          # страницы: главная, карта, о проекте, поддержка, настройки, 404
│       ├── features/       # модули: auth, hero, map, mood, notifications, problems, settings, stats, story, support
│       ├── shared/         # API-клиент, UI-кит, анимации, хуки, утилиты, справочники кодов
│       ├── adaptations/    # отличия для телефонов, планшетов, 2K/4K, сенсорных экранов
│       ├── texts/          # весь текст сайта: ru/ и en/ (одинаковые ключи)
│       ├── demo-data/      # демо-режим: геоданные, демо-аккаунт, фейковый API
│       └── styles/         # токены (цвета, отступы, шрифты), reset, глобальные стили
└── backend/                # FastAPI (план): requirements, данные городов, скрипты
```

Подробно — [ARCHITECTURE.md](ARCHITECTURE.md), раздел 3.

---

## Демо-режим и настоящий сервер

По умолчанию сайт работает без бэкенда: все запросы обрабатывает `frontend/src/demo-data/api` с той же
валидацией и кодами ошибок, что у будущего API. Данные живут до перезагрузки страницы.

Когда появится бэкенд — в `frontend/.env` поставить `VITE_USE_MOCKS=false`, запросы пойдут на `/api/v1`.

## Публикация

Push в ветку `main` → GitHub Actions (`.github/workflows/deploy-pages.yml`) проверяет код линтером,
собирает фронтенд в демо-режиме и выкладывает на GitHub Pages. В настройках репозитория: Pages → Source →
GitHub Actions.

---

## Документация

- `CLAUDE.md` — правила: стек, запреты, стиль кода, приватность, чек-лист перед завершением задачи
  (локальный файл, в репозиторий не попадает — см. `.gitignore`).
- [ARCHITECTURE.md](ARCHITECTURE.md) — как всё устроено.
- [docs/DECISIONS.md](docs/DECISIONS.md) — почему решили именно так.
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — что и когда менялось на сайте.
- [frontend/src/texts/README.md](frontend/src/texts/README.md) — как править тексты сайта.
- [frontend/src/demo-data/README.md](frontend/src/demo-data/README.md) — демо-данные.
- [frontend/src/adaptations/README.md](frontend/src/adaptations/README.md) — адаптация под устройства.
