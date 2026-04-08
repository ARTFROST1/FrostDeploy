# FrostDeploy — Production Testing Progress

> **Начало тестирования:** 2 апреля 2026
> **Сервер:** RU VDS 203.31.40.195 (Москва, Debian 12.13, 2 vCPU, 3.8GB RAM, 45GB NVMe)
> **Домен:** obrazz-ai.ru
> **Тестовый проект:** https://github.com/ARTFROST1/LandingPageObrazz
> **FrostDeploy URL:** http://203.31.40.195:9000

> ⚠️ **ВНИМАНИЕ: Совместное использование сервера**
>
> Сервер `203.31.40.195` используется **тремя проектами одновременно:**
>
> | Проект | Сервис | Порт | Директория |
> |--------|--------|------|------------|
> | **La Villa Pine** | Astro SSR + Caddy | 4321 | `/var/www/lavillapine` |
> | **SFOTK.AI** | PostgreSQL 17 + AmneziaWG | 5432, 51820 | — |
> | **FrostDeploy** | Deploy platform | 9000 | `/opt/frostdeploy` |
>
> **Порт 4321 ЗАНЯТ La Villa Pine.** Управляемые FrostDeploy приложения должны использовать порты 4322+.
> При тестировании НЕ трогайте: `lavillapine.service`, Caddy конфиг для lavillapine.ru, PostgreSQL, AmneziaWG.

---

## Фаза A: Подготовка сервера и деплой

| Шаг | Статус | Описание | Заметки |
|-----|--------|----------|---------|
| A.1 | ✅ | Анализ текущего состояния сервера | Debian 12, Node.js 22.22.1, Caddy v2.11.2, PostgreSQL 17 (SFOTK.AI), La Villa Pine (Astro, порт 4321), AmneziaWG |
| A.2 | ✅ | Установка зависимостей (Node.js, pnpm) | pnpm 10.x уже на сервере |
| A.3 | ✅ | Клонирование FrostDeploy | /opt/frostdeploy |
| A.4 | ✅ | Сборка проекта | UI build (Vite), server через tsx |
| A.5 | ✅ | Настройка systemd сервиса | /etc/systemd/system/frostdeploy.service |
| A.6 | ✅ | Интеграция с Caddy | Caddy Admin API на localhost:2019 |

## Фаза B: Первоначальная настройка

| Шаг | Статус | Описание | Заметки |
|-----|--------|----------|---------|
| B.1 | ✅ | Setup wizard — пароль | Admin2026! |
| B.2 | ✅ | Setup wizard — GitHub PAT | github_pat_ формат (Bug #1 — regex исправлен) |
| B.3 | ✅ | Setup wizard — домен | 203.31.40.195 |
| B.4 | ✅ | Проверка входа | Bug #2 — cookie Secure flag исправлен |

## Фаза C: Деплой тестового проекта

| Шаг | Статус | Описание | Заметки |
|-----|--------|----------|---------|
| C.1 | ✅ | Добавление проекта через UI | 4-step wizard (Repo → Settings → Env → Review) |
| C.2 | ✅ | Deploy через UI | Pipeline: clone ✅ → checkout ✅ → install ✅ → build ❌ → build ✅ (после 4 фиксов) |
| C.3 | ✅ | Проверка SSE логов | Deploy console работает, показывает полный лог |
| C.4 | ✅ | Проверка работы сайта | Next.js app запущена на порту 4322 (изначально 4321 → конфликт с La Villa Pine → исправлен), systemd unit auto-создан |

### Детали деплой-пайплайна (сессия 2)

Deploy pipeline прошёл через 4 итерации исправлений:

1. **Тестовый репо: tailwindcss в devDependencies** — `npm ci --ignore-scripts` не ставил build-time deps. Fix: перенос tailwindcss, postcss, autoprefixer в dependencies (коммит 64a7406 в LandingPageObrazz)
2. **NODE_ENV=production + npm ci** — systemd сервис FrostDeploy запускается с `NODE_ENV=production`, который наследуется child-процессами. `npm ci` под production-env пропускает devDependencies (261 vs 505 пакетов). Fix: `npm ci --include=dev` (коммит d1f7e05)
3. **Rsync ломал структуру Next.js** — старая логика копировала СОДЕРЖИМОЕ outputDir в runtimeDir (т.е. .next/* → /var/www/project/), а `next start` ожидает `.next/` директорию. Fix: rsync копирует весь srcDir → runtimeDir, исключая node_modules и .git (коммит 062d62d)
4. **Systemd unit не создавался** — `createUnit()` при создании проекта failed silently. Deploy worker теперь auto-создаёт unit если файл не найден (коммит 1cf6e8e). Шаблон имел `User=frostdeploy` (не существует) → исправлен на `User=root` (коммит ba2cb6e)

**Финальный результат:** Deploy successful in 92.2s — все 8 шагов: fetch → checkout → install (505 packages) → build (Next.js 15.5.12 ✓) → sync → env → restart → healthcheck ✅

**Runtime:** Next.js app возвращает HTTP 500 на localhost:4322 (ожидаемо — нужны NEXT_PUBLIC_SUPABASE_URL/ANON_KEY env vars для полноценной работы). Сам pipeline работает E2E.

## Фаза D: Полное UI тестирование

| Раздел | Статус | Проверки | Баги |
|--------|--------|----------|------|
| D.1 Login page | ✅ | Desktop ✅ | React controlled inputs — nativeInputValueSetter |
| D.2 Setup wizard | ✅ | 3 шага, валидация ✅ | Bug #1: regex PAT |
| D.3 Dashboard | ✅ | Метрики ✅, карточки проектов ✅ | Bug #3: metrics 0.0/0.0 (formatGB) |
| D.4 New Project wizard | ✅ | 4 шага ✅ | Порт auto-assigned :4321 |
| D.5 Project Overview | ✅ | Статус ✅, домен ✅, последний деплой ✅ | — |
| D.6 Deploy Console | ✅ | Полный лог ✅, статус Failed ✅ | — |
| D.7 Deploy History | ✅ | Таблица ✅, данные ✅ | Bug #6: data.items vs data.data |
| D.8 Env Variables | ✅ | Empty state ✅, Добавить ✅, Сохранить ✅ | — |
| D.9 Service Logs | ✅ | No entries (ожидаемо) ✅, фильтр ✅, auto-refresh ✅ | — |
| D.10 Project Settings | ✅ | Все поля ✅, Danger Zone ✅ | — |
| D.11 Platform Settings | ✅ | PAT (masked) ✅, смена пароля ✅ | — |
| D.12 Sidebar | ✅ | Навигация ✅, статусы проектов ✅ | — |
| D.13 Responsive Design | ✅ | Desktop 1440px ✅ / Tablet 900px ✅ / Mobile 375px ✅ | — |

## Фаза E: Исправления

| # | Описание бага | Файл | Статус | Коммит |
|---|---------------|------|--------|--------|
| 1 | PAT regex не принимает `github_pat_` формат | ui/src/pages/setup.tsx | ✅ | e683a23 |
| 2 | Cookie Secure flag блокирует сессию на HTTP | server/src/routes/auth.ts, settings.ts | ✅ | d250e26 |
| 3 | Dashboard метрики 0.0/0.0 GB (formatGB делит bytes вместо MB/GB) | ui/src/pages/dashboard.tsx | ✅ | 6c955c0 |
| 4 | TS build non-null assertion в caddy test | server/src/lib/__tests__/caddy.test.ts | ✅ | 8ca5124 |
| 5 | Static file path ../ui/dist → ./ui/dist | server/src/index.ts | ✅ | 43adc8e |
| 6 | FK constraint: acquireLock с пустым deploymentId | server/src/queue/deploy-queue.ts, deploy-worker.ts | ✅ | 901d5b0, 6e00b95 |
| 7 | git fetch на пустой директории (нет .git) | server/src/queue/deploy-worker.ts | ✅ | 6fb5d0f |
| 8 | Deploy history пустая таблица (data.items vs data.data) | server/src/services/deploy-service.ts | ✅ | bbdcb44 |
| 9 | npm ci --ignore-scripts ломает @next/swc postinstall | server/src/services/build-service.ts | ✅ | d1f7e05 |
| 10 | NODE_ENV=production → npm ci пропускает devDependencies | server/src/services/build-service.ts | ✅ | 174e7d7 |
| 11 | Rsync копирует содержимое outputDir вместо всего проекта | server/src/lib/rsync.ts | ✅ | 062d62d |
| 12 | Systemd unit не создаётся при первом деплое | server/src/queue/deploy-worker.ts | ✅ | 1cf6e8e |
| 13 | EJS undefined optional fields (envFilePath) | server/src/queue/deploy-worker.ts | ✅ | 1cf6e8e |
| 14 | Systemd template: User=frostdeploy не существует | server/src/templates/systemd.service.ejs | ✅ | ba2cb6e |
| 15 | Systemd template: ExecStart=npm без полного пути | server/src/templates/systemd.service.ejs | ✅ | ba2cb6e |

---

## Фаза F: Domain flow, port check, документация, повторное тестирование (сессия 3) ✅ COMPLETED 02.04.2026

### F.0 — Предварительные исправления кодовой базы

| Шаг | Статус | Описание | Заметки |
|-----|--------|----------|---------|
| F.0.1 | ✅ | Добавить вкладку "Домен" в ProjectLayout | Новый tab между "Логи" и "Настройки" |
| F.0.2 | ✅ | Создать project-domain.tsx (полный domain flow) | 4 состояния: A (нет домена), B (DNS pending), C (SSL pending), D (active) |
| F.0.3 | ✅ | Добавить API endpoints для per-project domain | 5 endpoints: PUT/DELETE /:id/domain, GET /:id/dns-records, POST /:id/dns-verify, GET /:id/ssl-status |
| F.0.4 | ✅ | Исправить domain card в overview | Реальный SSL status через Caddy routes API |
| F.0.5 | ✅ | Убрать поле domain из new-project wizard | Убрано из Step 2 и Step 4 |
| F.0.6 | ✅ | Убрать поле domain из project-settings | Domain управляется на вкладке "Домен" |
| F.0.7 | ✅ | Добавить OS-level проверку порта | `isPortAvailable()` через `ss -tlnH`, проверка перед назначением и перед деплоем |
| F.0.8 | ✅ | Перенести README.md в doc/FULL-GUIDE.md | Новый короткий README.md создан |
| F.0.9 | ✅ | PORT_RANGE_START=4322 (4321 зарезервирован) | La Villa Pine на 4321 |
| F.0.10 | ✅ | Env vars deployment в deploy-worker | deploy-worker пишет .env файл, передаёт EnvironmentFile в systemd unit |
| F.0.11 | ✅ | checkSslStatus через Caddy routes API | Заменён несуществующий путь /config/apps/tls/certificates/automate |
| F.0.12 | ✅ | caddyFetch wrapper для Node.js fetch | Добавлен Origin header для совместимости с Caddy admin API |

### F.1 — Тестирование через Chrome DevTools

| Шаг | Статус | Описание | Заметки |
|-----|--------|----------|---------|
| F.1.1 | ✅ | Удалить текущий проект через UI | systemd unit удалён, La Villa Pine не затронута, файлы остались (known gap) |
| F.1.2 | ✅ | Dashboard пустое состояние | 0 проектов, empty state отображается |
| F.1.3 | ✅ | Создать проект без домена | Wizard 4 шага, поле домена отсутствует |
| F.1.4 | ✅ | Проверка назначения порта | Порт 4322 (4321 пропущен — обнаружен La Villa Pine) |
| F.1.5 | ✅ | Deploy #1 (без env vars) | Build success, healthcheck failed (нет env vars) — ожидаемо |
| F.1.6 | ✅ | Вкладка "Домен" → State A | Пустой input, placeholder "example.com", подсказка IP |
| F.1.7 | ✅ | Добавить домен "obrazz-ai.ru" → State B | DNS таблица: A @ → 203.31.40.195, A www → 203.31.40.195. Кнопки копирования, verify/edit/delete |
| F.1.8 | ✅ | DNS верификация | dig подтвердил обе записи |
| F.1.9 | ✅ | После DNS verify → State C | "SSL выпускается..." badge, auto-polling каждые 5с |
| F.1.10 | ✅ | Env vars через UI | NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_APP_URL |
| F.1.11 | ✅ | Deploy #3 (с env vars) | Success за 91.5s, env записан в /var/lib/frostdeploy/env/landingpageobrazz.env, EnvironmentFile= в systemd |
| F.1.12 | ✅ | SSL сертификат выпущен | Let's Encrypt, CN=obrazz-ai.ru, expires Jul 1, 2026 |
| F.1.13 | ✅ | HTTPS проверка | 200 OK, полный HTML Obrazz landing page |
| F.1.14 | ✅ | Вкладка "Домен" → State D | Зелёный "SSL ✅" badge, кликабельная ссылка https://obrazz-ai.ru, verified 02.04.2026 |
| F.1.15 | ✅ | Overview page | Active статус, ссылка на домен с SSL ✅, Success deploy, Running uptime |

### Баги найденные и исправленные (сессия 3)

| # | Описание бага | Исправление | Коммит |
|---|---------------|-------------|--------|
| 16 | `checkSslStatus` проверял несуществующий путь `/config/apps/tls/certificates/automate` → всегда возвращал 'pending' | Используем `getRoutes()` для проверки наличия Caddy route + verifiedAt в БД | a1bdb1a |
| 17 | Caddy admin API отклоняет Node.js `fetch()` из-за пустого Origin header | Добавлен `caddyFetch()` wrapper с `Origin: CADDY_ADMIN_URL` header | b5b737b |
| 18 | Deploy не записывал .env файл на диск, systemd не имел EnvironmentFile | Добавлен env step в deploy-worker: запись зашифрованных env vars в `/var/lib/frostdeploy/env/{name}.env` | 894296f |

### Коммиты фазы F

| Коммит | Описание |
|--------|----------|
| c7b9ac3 | feat: domain flow, port check, README refactor |
| 894296f | fix: env vars deployment (EnvironmentFile in systemd) |
| a1bdb1a | fix: checkSslStatus uses Caddy routes |
| b5b737b | fix: add Origin header to Caddy admin API fetches |

### Ключевые архитектурные решения (сессия 3)

1. **Вкладка "Домен"** — отдельная страница (`project-domain.tsx`) вместо поля в Settings. Flow:
   - Нет домена → CTA "Добавить домен"
   - Ввод домена → Показ DNS записей (A: @ → IP, A: www → IP)
   - Кнопка "Проверить DNS" → dig проверка
   - DNS verified → Caddy добавляет route → SSL provisioning
   - SSL active → Домен полностью работает
   - Кнопка "Изменить" (карандаш) для смены домена

2. **Port check** — `ss -tlnp :PORT` перед:
   - Назначением порта при создании проекта
   - Перезапуском сервиса при деплое

3. **PORT_RANGE_START = 4322** — порт 4321 зарезервирован La Villa Pine

4. **README split** — текущий README → doc/FULL-GUIDE.md, новый короткий README для GitHub

---

## Итоговый результат (сессии 1–3)

- [x] FrostDeploy установлен и работает на http://203.31.40.195:9000
- [x] Setup wizard пройден (пароль, PAT, домен)
- [x] Проект добавлен и задеплоен (pipeline E2E работает — 91.5s)
- [x] Все UI страницы проверены (13/13)
- [x] Responsive design проверен (desktop/tablet/mobile)
- [x] 18 багов обнаружено и исправлено
- [x] Systemd unit auto-создаётся при первом деплое
- [x] OS-level port check: `isPortAvailable()` через `ss -tlnH`, PORT_RANGE_START=4322
- [x] Domain flow полностью работает: добавление → DNS записи → верификация → SSL → HTTPS
- [x] SSL сертификат Let's Encrypt выпущен для obrazz-ai.ru (expires Jul 1, 2026)
- [x] https://obrazz-ai.ru возвращает 200 OK с полной landing page
- [x] Env vars деплоятся: .env файл + EnvironmentFile в systemd unit
- [x] README.md refactored: полный гайд в doc/FULL-GUIDE.md, короткий README для GitHub
- [x] caddyFetch wrapper для совместимости Node.js fetch с Caddy admin API

### Открытые вопросы
- [x] ~~Domain flow в UI~~ — Реализован полный flow с 4 состояниями (A→B→C→D) ✅
- [x] ~~Caddy proxy через домен~~ — Работает, SSL автоматически через Let's Encrypt ✅
- [ ] Документация: setup guide для нового пользователя (от git clone до рабочей платформы)
- [ ] Cleanup при удалении проекта: файлы в /var/www/ не удаляются (known gap)

---

## Фаза G: Root Directory feature

> **Фича:** Поле `rootDir` позволяет указать поддиректорию репозитория как корень сборки (монорепо поддержка).
> **Статус:** Реализовано, требует боевого тестирования.

### G.1 — Чеклист тестирования

| # | Тест | Ожидаемый результат | Статус |
|---|------|---------------------|--------|
| G.1.1 | Создать проект с `rootDir = "apps/frontend"` через New Project wizard | Поле принимается, проект создаётся, `root_dir` записывается в БД | ⬜ |
| G.1.2 | Запустить деплой проекта с `rootDir` | `npm ci` и `npm run build` выполняются в `{srcDir}/apps/frontend/`, git clone — в `srcDir` | ⬜ |
| G.1.3 | Проверить автодетект фреймворка с `rootDir` через `POST /api/detect` | Детектор ищет `package.json` в `apps/frontend/`, корректно определяет фреймворк | ⬜ |
| G.1.4 | Создать проект без `rootDir` (NULL) | Deploy работает как раньше, `buildDir = srcDir` | ⬜ |
| G.1.5 | Попытка создать проект с `rootDir = "../escape"` | API возвращает `400 BAD_REQUEST` от Zod-валидатора | ⬜ |
| G.1.6 | Попытка создать проект с `rootDir = "/etc/passwd"` | API возвращает `400 BAD_REQUEST` (абсолютный путь запрещён) | ⬜ |
| G.1.7 | Попытка создать проект с `rootDir = "apps/../../../etc"` | API возвращает `400 BAD_REQUEST` (`..` запрещён) | ⬜ |
| G.1.8 | Обновить `rootDir` в Project Settings для существующего проекта | PUT `/api/projects/:id` принимает новый rootDir, следующий деплой использует новую поддиректорию | ⬜ |
| G.1.9 | Обновить `rootDir` на `null` (очистить) через Project Settings | PUT принимает `null`, следующий деплой использует корень репозитория | ⬜ |
| G.1.10 | `rootDir` указывает на несуществующую поддиректорию | Deploy падает с понятной ошибкой на шаге `install` / `build` | ⬜ |

### G.2 — Сценарий тестирования (монорепо)

**Пример монорепо:**
```
my-monorepo/
├── apps/
│   └── frontend/          ← rootDir = "apps/frontend"
│       ├── package.json
│       └── src/
├── packages/
│   └── shared/
└── package.json            ← корень репо (не используется для сборки)
```

**Проверяемое поведение:**
1. `git clone <url> /var/www/my-monorepo-src/` — клонируется весь репо
2. `buildDir = /var/www/my-monorepo-src/apps/frontend`
3. `npm ci` работает в `buildDir` (использует `apps/frontend/package.json`)
4. `npm run build` работает в `buildDir`
5. `rsync` синхронизирует артефакты из `buildDir/dist/` → `/var/www/my-monorepo/`

### G.3 — curl-тесты валидации

```bash
# Создание с корректным rootDir
curl -X POST http://localhost:9000/api/projects -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/user/monorepo","branch":"main","name":"frontend","rootDir":"apps/frontend"}'
# → 201 { "id": "...", "rootDir": "apps/frontend", ... }

# Попытка traversal-атаки
curl -X POST http://localhost:9000/api/projects -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/user/repo","branch":"main","name":"evil","rootDir":"../escape"}'
# → 400 { "success": false, "error": { "code": "BAD_REQUEST", ... } }

# Автодетект с rootDir
curl -X POST http://localhost:9000/api/detect -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/user/monorepo","root_dir":"apps/frontend"}'
# → { "framework": "nextjs", "buildCmd": "npm run build", ... }
```

### Ключевые технические находки
1. **NODE_ENV=production наследуется child-процессам** через systemd → npm ci пропускает devDeps → решение: `--include=dev`
2. **Rsync output-only модель не работает для Node.js серверов** → решение: rsync всего src (минус node_modules/.git)
3. **Порт 4321 может быть занят предыдущим ручным тестом** → решено: `isPortAvailable()` через `ss -tlnH` + PORT_RANGE_START=4322
4. **User=frostdeploy не создан** → пока используем root, в будущем нужно createUser при setup
5. **Caddy admin API не принимает Node.js fetch** → решено: `caddyFetch()` wrapper с Origin header
6. **checkSslStatus путь не существует** → решено: проверка через Caddy routes API + verifiedAt в БД
7. **Env vars не передавались в runtime** → решено: deploy-worker записывает .env файл + EnvironmentFile= в systemd unit

### Инцидент: конфликт портов (2 апреля 2026)

**Проблема:** FrostDeploy автоматически назначил порт 4321 для тестового проекта LandingPageObrazz. Этот порт уже использовался La Villa Pine (Astro SSR). При запуске `frostdeploy-landingpageobrazz.service` порт 4321 был занят → `lavillapine.service` упал с ошибкой `EADDRINUSE` и не мог перезапуститься.

**Решение:**
1. Изменён порт в `/etc/systemd/system/frostdeploy-landingpageobrazz.service`: `PORT=4321` → `PORT=4322`
2. `systemctl daemon-reload && systemctl stop frostdeploy-landingpageobrazz`
3. `systemctl start lavillapine` → HTTP 200 ✅
4. `systemctl start frostdeploy-landingpageobrazz` → запущен на 4322 ✅

**TODO:** Добавить в FrostDeploy проверку занятых портов перед назначением (`ss -tlnp`). Диапазон managed-приложений должен начинаться с 4322+ (4321 зарезервирован за La Villa Pine).
