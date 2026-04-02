---
title: "Implementation Plan — FrostDeploy v0.1 (MVP)"
summary: "Полный пошаговый план реализации self-hosted универсальной платформы деплоя FrostDeploy: 9 фаз, 67 задач, от инициализации до продакшена"
status: Draft
date: 2026-04-01
author: "@artfrost"
sources:
  - ../PRD.md
  - ../TECH-STACK.md
  - ../DATABASE.md
  - ../UI-UX.md
  - ../PROJECT-STRUCTURE.md
  - ../../DEPLOY-PLATFORM-RESEARCH.md
  - ../../COMPETITORS-CODE-ANALYSIS.md
---

# Implementation Plan: FrostDeploy v0.1 (MVP)

## Содержание

1. [Анализ функциональности](#1-анализ-функциональности)
2. [Фаза 0 — Инициализация проекта](#2-фаза-0--инициализация-проекта)
3. [Фаза 1 — API-сервер (ядро)](#3-фаза-1--api-сервер-ядро)
4. [Фаза 2 — Deploy Engine](#4-фаза-2--deploy-engine)
5. [Фаза 3 — Proxy Manager (Caddy)](#5-фаза-3--proxy-manager-caddy)
6. [Фаза 4 — UI: каркас и аутентификация](#6-фаза-4--ui-каркас-и-аутентификация)
7. [Фаза 5 — UI: Dashboard и проекты](#7-фаза-5--ui-dashboard-и-проекты)
8. [Фаза 6 — UI: деплой и логи](#8-фаза-6--ui-деплой-и-логи)
9. [Фаза 7 — Интеграция и первый деплой](#9-фаза-7--интеграция-и-первый-деплой)
10. [Фаза 8 — Hardening](#10-фаза-8--hardening)
11. [Зависимости между фазами](#11-зависимости-между-фазами)
12. [Критический путь](#12-критический-путь)
13. [Общая оценка сложности](#13-общая-оценка-сложности)
14. [Чеклист готовности к продакшену](#14-чеклист-готовности-к-продакшену)

---

## 1. Анализ функциональности

### 1.1. Карта функций MVP

На основе PRD.md (раздел 7 — Scope MVP v0.1) реализуются следующие модули:

| # | Модуль | FR-ссылки | Приоритет | Тип |
|---|--------|-----------|:---------:|-----|
| 1 | Мастер установки | FR-700–FR-702 | P0 | Full-stack |
| 2 | Аутентификация | FR-600–FR-603 | P0 | Backend + UI |
| 3 | Добавление проекта | FR-200–FR-204, FR-207 | P0 | Full-stack |
| 4 | Автоопределение фреймворка | FR-201 | P0 | Backend |
| 5 | Настройка домена | FR-400–FR-404 | P0 | Backend |
| 6 | Деплой по коммиту | FR-300–FR-307 | P0 | Backend |
| 7 | Список коммитов | FR-301 | P0 | Backend + UI |
| 8 | Откат | US-023 | P0 | Full-stack |
| 9 | Env-переменные | FR-207 | P0 | Full-stack |
| 10 | Системные метрики | FR-500–FR-501 | P1 | Backend + UI |
| 11 | Логи сервисов | FR-502 | P1 | Backend + UI |
| 12 | История деплоев | FR-307 | P0 | Full-stack |

### 1.2. Технический стек (сводка из TECH-STACK.md)

| Слой | Технология | Версия |
|------|------------|--------|
| Runtime | Node.js | 22 LTS |
| API | Hono | 4.x |
| ORM | Drizzle ORM | 0.39.x |
| БД | SQLite (WAL) | better-sqlite3 |
| Валидация | Zod | 3.24.x |
| UI Framework | React | 19.x |
| Стили | Tailwind CSS | 4.x |
| UI-компоненты | shadcn/ui | Radix + Tailwind |
| Роутинг | React Router | 7.x |
| State | TanStack Query | 5.x |
| Build | Vite | 6.x |
| Proxy | Caddy | 2.9+ |
| Процессы | systemd | OS |
| Package Manager | pnpm | 9.x |
| Тесты | Vitest | 3.x |

### 1.3. Структура пакетов (из PROJECT-STRUCTURE.md)

```
frostdeploy/
├── packages/shared/   ← типы, Zod-валидаторы, константы (лист DAG)
├── packages/db/       ← Drizzle-схема, миграции, SQLite-клиент
├── server/            ← Hono API, сервисы, очередь деплоев
├── ui/                ← React SPA, shadcn/ui
└── doc/               ← документация
```

---

## 2. Фаза 0 — Инициализация проекта ✅

> **Цель:** Рабочий монорепозиторий с настроенным tooling, типами и схемой БД.
> **Результат:** `pnpm install && pnpm test` проходит без ошибок; БД создаётся; типы экспортируются.

---

### 0.1 — Инициализация pnpm workspace и корневого package.json (Complexity: M) ✅

**Файлы:**
- `package.json` (создать)
- `pnpm-workspace.yaml` (создать)
- `.npmrc` (создать)

**Описание:**
Создать корневой `package.json` с полем `"private": true`, `"type": "module"`, скриптами `dev`, `build`, `test`, `lint`, `db:migrate`, `db:seed`, `db:studio`. Настроить `pnpm-workspace.yaml` с пакетами `packages/*`, `server`, `ui`. В `.npmrc` установить `shamefully-hoist=false`, `strict-peer-dependencies=true`.

**Acceptance Criteria:**
- `pnpm install` завершается без ошибок в пустом воркспейсе
- `pnpm -r list` показывает все 4 пакета

**Зависимости:** нет

---

### 0.2 — Базовый tsconfig.base.json и per-package конфиги (Complexity: M) ✅

**Файлы:**
- `tsconfig.base.json` (создать)
- `packages/shared/tsconfig.json` (создать)
- `packages/db/tsconfig.json` (создать)
- `server/tsconfig.json` (создать)
- `ui/tsconfig.json` (создать)

**Описание:**
Создать базовый `tsconfig.base.json` с настройками: `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `strict: true`, `isolatedModules: true`. Каждый пакет наследует через `extends` и добавляет свои настройки (`rootDir`, `outDir`, `types`, `jsx` для ui).

**Acceptance Criteria:**
- `tsc --noEmit` проходит во всех пакетах (при наличии минимального `index.ts`)
- Path aliases разрешаются корректно

**Зависимости:** 0.1

---

### 0.3 — ESLint 9 flat config (Complexity: S) ✅

**Файлы:**
- `eslint.config.mjs` (создать)

**Описание:**
Настроить единый ESLint 9 flat config с `typescript-eslint` и `eslint-plugin-react`. Правила: `@typescript-eslint/no-unused-vars` с `argsIgnorePattern: '^_'`. Исключить `**/dist/`, `**/node_modules/`.

**Acceptance Criteria:**
- `pnpm lint` запускается и проходит без ошибок на пустых файлах
- Линтинг ловит ошибки типов (`let x: string = 5`)

**Зависимости:** 0.1, 0.2

---

### 0.4 — Prettier (Complexity: S) ✅

**Файлы:**
- `.prettierrc` (создать)
- `.prettierignore` (создать)

**Описание:**
Создать конфигурацию Prettier: `semi: true`, `singleQuote: true`, `trailingComma: all`, `printWidth: 100`, `tabWidth: 2`. Игнорировать `dist/`, `node_modules/`, `*.md`, `pnpm-lock.yaml`.

**Acceptance Criteria:**
- `pnpm prettier --check .` проходит
- Форматирование применяется через `pnpm prettier --write .`

**Зависимости:** 0.1

---

### 0.5 — .env.example и .gitignore (Complexity: S) ✅

**Файлы:**
- `.env.example` (создать)
- `.gitignore` (создать)

**Описание:**
`.env.example` с переменными: `DATABASE_PATH`, `PORT` (9000), `SESSION_SECRET`, `ENCRYPTION_KEY`, `GITHUB_PAT`, `NODE_ENV`. `.gitignore`: стандартный Node.js + `*.db`, `*.db-wal`, `*.db-shm`, `dist/`, `.env`.

**Acceptance Criteria:**
- `.env` и `*.db` файлы не попадают в git
- Новый разработчик может скопировать `.env.example` → `.env` и запустить проект

**Зависимости:** нет

---

### 0.6 — Пакет packages/shared: типы и константы (Complexity: L) ✅

**Файлы:**
- `packages/shared/package.json` (создать)
- `packages/shared/src/index.ts` (создать)
- `packages/shared/src/types/project.ts` (создать)
- `packages/shared/src/types/deployment.ts` (создать)
- `packages/shared/src/types/env-variable.ts` (создать)
- `packages/shared/src/types/domain.ts` (создать)
- `packages/shared/src/types/settings.ts` (создать)
- `packages/shared/src/types/system.ts` (создать)
- `packages/shared/src/types/api.ts` (создать)
- `packages/shared/src/types/index.ts` (создать)
- `packages/shared/src/constants/frameworks.ts` (создать)
- `packages/shared/src/constants/ports.ts` (создать)
- `packages/shared/src/constants/deploy-steps.ts` (создать)
- `packages/shared/src/constants/index.ts` (создать)

**Описание:**
Реализовать все TypeScript-типы сущностей по DATABASE.md: `Project`, `ProjectStatus` (`created | active | deploying | error | stopped`), `Deployment`, `DeployStatus` (`queued | building | deploying | success | failed | cancelled`), `TriggeredBy`, `EnvVariable`, `Domain`, `SslStatus`, `Settings`, `SystemMetrics`, `ApiResponse<T>`, `ApiError`. Константы: `FRAMEWORKS` (таблица детекции из PRD FR-201), `PORT_RANGE_START` (4321), `PORT_RANGE_END` (4399), `DEPLOY_STEPS`.

**Acceptance Criteria:**
- `import { type Project, FRAMEWORKS, PORT_RANGE_START } from '@fd/shared'` — компилируется
- Barrel-экспорт через `index.ts` на каждом уровне
- Нет runtime-зависимостей кроме `zod`

**Зависимости:** 0.1, 0.2

---

### 0.7 — Пакет packages/shared: Zod-валидаторы (Complexity: M) ✅

**Файлы:**
- `packages/shared/src/validators/project.ts` (создать)
- `packages/shared/src/validators/deployment.ts` (создать)
- `packages/shared/src/validators/env-variable.ts` (создать)
- `packages/shared/src/validators/auth.ts` (создать)
- `packages/shared/src/validators/index.ts` (создать)

**Описание:**
Создать Zod-схемы для валидации API-запросов: `createProjectSchema` (repo_url, branch, name, domain?, env_vars?), `updateProjectSchema` (partial), `triggerDeploySchema` (sha?, force?), `createEnvVarSchema` (key, value, is_secret), `loginSchema` (password), `setupSchema` (password, github_pat, platform_domain). Все схемы должны использоваться и на сервере (@hono/zod-validator), и на клиенте (форм-валидация).

**Acceptance Criteria:**
- `createProjectSchema.parse({...})` корректно валидирует входные данные
- Невалидные данные вызывают `ZodError` с описательными сообщениями
- Валидаторы экспортируются из `@fd/shared`

**Зависимости:** 0.6

---

### 0.8 — Пакет packages/db: Drizzle-схема 6 таблиц (Complexity: L) ✅

**Файлы:**
- `packages/db/package.json` (создать)
- `packages/db/drizzle.config.ts` (создать)
- `packages/db/src/index.ts` (создать)
- `packages/db/src/schema/projects.ts` (создать)
- `packages/db/src/schema/deployments.ts` (создать)
- `packages/db/src/schema/env-variables.ts` (создать)
- `packages/db/src/schema/domains.ts` (создать)
- `packages/db/src/schema/settings.ts` (создать)
- `packages/db/src/schema/deploy-locks.ts` (создать)
- `packages/db/src/schema/relations.ts` (создать)
- `packages/db/src/schema/index.ts` (создать)
- `packages/db/src/client.ts` (создать)

**Описание:**
Реализовать полную Drizzle ORM схему всех 6 таблиц из DATABASE.md: `projects` (17 столбцов, CHECK на status), `deployments` (иммутабельная история), `env_variables` (encrypted_value, UNIQUE(project_id, key)), `domains` (FQDN + SSL-статус), `settings` (key-value, is_encrypted), `deploy_locks` (per-project mutex). Создать `client.ts` с фабрикой `createDb()`: подключение `better-sqlite3`, установка PRAGMA (WAL, busy_timeout=5000, synchronous=NORMAL, foreign_keys=ON, cache_size=-20000, temp_store=MEMORY). Объявить relations (projects 1→N deployments, env_variables, domains; projects 1→1 deploy_locks).

**Acceptance Criteria:**
- `drizzle-kit generate` генерирует SQL-миграцию без ошибок
- `createDb(':memory:')` возвращает рабочий экземпляр Drizzle
- Все 6 таблиц и индексы присутствуют в сгенерированном SQL

**Зависимости:** 0.6

---

### 0.9 — Первая миграция и проверка схемы (Complexity: M) ✅

**Файлы:**
- `packages/db/src/migrations/0000_initial.sql` (генерируется drizzle-kit)
- `packages/db/src/seed.ts` (создать)

**Описание:**
Выполнить `drizzle-kit generate` для создания первой миграции (`0000_initial.sql`) со всеми таблицами и индексами. Создать `seed.ts` с тестовыми данными: 2 проекта (Astro SSR на порту 4321, Express API на 4322), 5 деплоев (3 success, 1 failed, 1 building), 3 env-переменных. Добавить скрипты `db:migrate` и `db:seed` в корневой `package.json`.

**Acceptance Criteria:**
- `pnpm db:migrate` создаёт файл `data.db` с 6 таблицами
- `pnpm db:seed` заполняет тестовыми данными
- `sqlite3 data.db ".tables"` — показывает все 6 таблиц
- `sqlite3 data.db "PRAGMA journal_mode"` — возвращает `wal`

**Зависимости:** 0.8

---

### 0.10 — Vitest: настройка и первые тесты (Complexity: M) ✅

**Файлы:**
- `vitest.workspace.ts` (создать)
- `packages/shared/vitest.config.ts` (создать)
- `packages/db/vitest.config.ts` (создать)
- `packages/shared/src/validators/__tests__/project.test.ts` (создать)
- `packages/db/src/__tests__/schema.test.ts` (создать)

**Описание:**
Настроить Vitest workspace для запуска тестов во всех пакетах одной командой. Написать тесты для `shared`: валидация `createProjectSchema` (valid input, invalid repo_url, missing fields). Написать тесты для `db`: создание in-memory БД, вставка проекта, чтение, каскадное удаление.

**Acceptance Criteria:**
- `pnpm test` запускает тесты во всех пакетах
- Минимум 5 тестов проходят (3 для validators, 2 для db)
- Тесты `db` используют in-memory SQLite (не файловую БД)

**Зависимости:** 0.7, 0.9

---

### 0.11 — Husky + lint-staged (Complexity: S) ✅

**Файлы:**
- `.husky/pre-commit` (создать)
- `package.json` (изменить — добавить lint-staged конфиг)

**Описание:**
Настроить Husky для pre-commit hook: запуск `lint-staged` на staged-файлах. `lint-staged`: `*.ts` → `eslint --fix`, `*.{ts,json,md}` → `prettier --write`.

**Acceptance Criteria:**
- При коммите файл с ошибками ESLint — коммит блокируется
- Prettier автоматически форматирует staged-файлы

**Зависимости:** 0.3, 0.4

---

## 3. Фаза 1 — API-сервер (ядро) ✅

> **Цель:** Работающий Hono API-сервер с аутентификацией, CRUD проектов, метриками, детекцией фреймворков.
> **Результат:** `curl http://localhost:9000/api/projects` возвращает JSON-список проектов (при наличии auth-cookie).

---

### 1.1 — Инициализация Hono-сервера с точкой входа (Complexity: M) ✅

**Файлы:**
- `server/package.json` (создать)
- `server/src/index.ts` (создать)

**Описание:**
Создать `server/package.json` с зависимостями: `hono`, `@hono/node-server`, `@hono/zod-validator`, `drizzle-orm`, `better-sqlite3`, `zod`, `ejs`, `@fd/shared`, `@fd/db`. Точка входа `src/index.ts`: создание Hono app, вызов `createDb()`, запуск сервера на порту из `process.env.PORT` (default 9000). Добавить скрипт `dev: tsx watch src/index.ts`.

**Acceptance Criteria:**
- `pnpm --filter @fd/server dev` запускает сервер на :9000
- `curl http://localhost:9000/` возвращает ответ (200 или redirect)
- Hot-reload работает при изменении файлов

**Зависимости:** 0.8, 0.9

---

### 1.2 — Middleware: error handler, logger, CORS (Complexity: M) ✅

**Файлы:**
- `server/src/middleware/error-handler.ts` (создать)
- `server/src/middleware/logger.ts` (создать)
- `server/src/index.ts` (изменить — подключить middleware)

**Описание:**
`error-handler.ts`: глобальный `onError`-обработчик, возвращающий `ApiError`-совместимый JSON: `{ success: false, error: { code, message, details? } }`. В dev-режиме — stack trace в `details`, в production — только сообщение. `logger.ts`: логирование каждого запроса в формате `METHOD /path STATUS DURATIONms`. CORS: разрешить `localhost:5173` (Vite dev server) в dev-режиме.

**Acceptance Criteria:**
- Намеренный `throw new Error('test')` в маршруте → JSON с `{ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } }`
- Каждый запрос логируется в stdout: `GET /api/projects 200 12ms`
- Запросы с Vite dev server (localhost:5173) не блокируются CORS

**Зависимости:** 1.1

---

### 1.3 — Auth middleware: HMAC-SHA256 cookie-сессия (Complexity: L) ✅

**Файлы:**
- `server/src/lib/crypto.ts` (создать)
- `server/src/middleware/auth.ts` (создать)

**Описание:**
`crypto.ts`: функции `hashPassword(plain)` → SHA-256 hex, `verifyPassword(plain, hash)`, `signSession(payload, secret)` → HMAC-SHA256 подписанная строка, `verifySession(token, secret)` → payload | null. `auth.ts`: Hono middleware, проверяющий cookie `fd_session`. Пропускает `/api/auth/login`, `/api/setup`. При невалидной/отсутствующей сессии → 401. TTL сессии: 24 часа.

**Acceptance Criteria:**
- Запросы без cookie → 401 `{ error: 'Unauthorized' }`
- Запросы к `/api/auth/login` проходят без cookie
- Подписанная cookie не может быть подделана (HMAC-верификация)
- Истёкшая сессия (> 24ч) → 401

**Зависимости:** 1.2

---

### 1.4 — Auth routes: login, logout, check (Complexity: M) ✅

**Файлы:**
- `server/src/routes/auth.ts` (создать)
- `server/src/routes/index.ts` (создать — регистрация маршрутов)

**Описание:**
`POST /api/auth/login`: принимает `{ password }`, верифицирует против хеша в settings, выдаёт подписанную cookie `fd_session` (HttpOnly, SameSite=Lax, Secure в production, Max-Age=86400). Rate-limiting: 5 попыток в минуту с одного IP (in-memory Map с TTL). `POST /api/auth/logout`: очищает cookie. `GET /api/auth/check`: возвращает `{ authenticated: true }` если сессия валидна.

**Acceptance Criteria:**
```bash
# Login
curl -X POST http://localhost:9000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"test123"}' -c cookies.txt
# → 200 + Set-Cookie: fd_session=...

# Check
curl http://localhost:9000/api/auth/check -b cookies.txt
# → { "authenticated": true }

# Rate limit (6-я попытка)
# → 429 { "error": "Too many attempts" }
```

**Зависимости:** 1.3

---

### 1.5 — Settings service + routes (Complexity: M) ✅

**Файлы:**
- `server/src/services/settings-service.ts` (создать)
- `server/src/routes/settings.ts` (создать)

**Описание:**
Сервис для работы с таблицей `settings`: `getSetting(key)`, `setSetting(key, value, isEncrypted?)`, `getAllSettings()`, `isSetupCompleted()`. Для зашифрованных значений (github_pat, session_secret) использовать AES-256-GCM из `crypto.ts` (добавить функции `encrypt(plaintext, key)` → `iv:ciphertext:tag` base64, `decrypt(encrypted, key)` → plaintext). Маршруты: `GET /api/settings` (возвращает все настройки, зашифрованные — маскированные), `PUT /api/settings` (обновление), `POST /api/setup` (первоначальная настройка: создание password_hash, сохранение PAT, домена, генерация session_secret).

**Acceptance Criteria:**
```bash
# Setup (первый запуск)
curl -X POST http://localhost:9000/api/setup \
  -H "Content-Type: application/json" \
  -d '{"password":"securepass","github_pat":"ghp_xxx","platform_domain":"deploy.example.com"}'
# → 200 { "success": true }

# Get settings
curl http://localhost:9000/api/settings -b cookies.txt
# → { "platform_domain": "deploy.example.com", "github_pat": "ghp_•••••••" }
```
- Повторный вызов `/api/setup` при `setup_completed=true` → 409
- github_pat хранится в БД зашифрованным (проверка через sqlite3)

**Зависимости:** 1.3, 1.4

---

### 1.6 — Projects CRUD service + routes (Complexity: L) ✅

**Файлы:**
- `server/src/services/project-service.ts` (создать)
- `server/src/routes/projects.ts` (создать)

**Описание:**
Сервис: `listProjects()` — все проекты с последним деплоем; `getProject(id)` — один проект с доменами; `createProject(data)` — валидация Zod, назначение свободного порта из диапазона 4321–4399 (SELECT MAX(port) + 1 или поиск «дырки»), генерация `src_dir` (`/var/www/{name}-src`), `runtime_dir` (`/var/www/{name}`), `service_name` (`frostdeploy-{name}`); `updateProject(id, data)` — partial update; `deleteProject(id)` — каскадно (БД + в будущих фазах: остановка сервиса, удаление файлов). Маршруты: `GET /api/projects`, `POST /api/projects`, `GET /api/projects/:id`, `PUT /api/projects/:id`, `DELETE /api/projects/:id`. Env-переменные: `GET /api/projects/:id/env` (маскированные значения), `PUT /api/projects/:id/env` (bulk upsert).

**Acceptance Criteria:**
```bash
# Create project
curl -X POST http://localhost:9000/api/projects -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/user/my-site","branch":"main","name":"my-site"}'
# → 201 { "id": "a1b2c3d4...", "port": 4321, ... }

# List
curl http://localhost:9000/api/projects -b cookies.txt
# → [{ "id": "...", "name": "my-site", "status": "created", ... }]

# Delete
curl -X DELETE http://localhost:9000/api/projects/a1b2c3d4 -b cookies.txt
# → 200 { "deleted": true }
```
- Порт назначается автоматически, уникальность гарантирована UNIQUE constraint
- При нехватке портов (все 4321–4399 заняты) → 409

**Зависимости:** 1.4, 0.7

---

### 1.7 — Framework detector service (Complexity: M) ✅

**Файлы:**
- `server/src/services/detector-service.ts` (создать)
- `server/src/routes/projects.ts` (изменить — добавить POST /api/detect)

**Описание:**
Сервис `detectFramework(repoUrl, pat)`: клонирование в temp-директорию (`/tmp/fd-detect-{random}`), чтение `package.json` (dependencies, devDependencies, scripts), проверка конфиг-файлов (`astro.config.*`, `next.config.*`, `nuxt.config.*`, `svelte.config.*`, `remix.config.*`). Приоритет детекции из PRD: 1) deps → 2) config files → 3) scripts.start → 4) static fallback. Возвращает: `{ framework, buildCmd, startCmd, outputDir }`. Очистка temp-директории после детекции. Маршрут: `POST /api/detect` с `{ repo_url, branch? }`.

**Acceptance Criteria:**
```bash
curl -X POST http://localhost:9000/api/detect -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/withastro/astro-starter"}'
# → { "framework": "astro-ssr", "buildCmd": "npm run build", "startCmd": "node dist/server/entry.mjs", "outputDir": "dist" }
```
- Определяет все фреймворки из таблицы PRD FR-201
- Temp-директория удаляется после детекции
- Timeout: 30 секунд на clone + анализ

**Зависимости:** 1.1

---

### 1.8 — System metrics service (Complexity: M) ✅

**Файлы:**
- `server/src/services/system-service.ts` (создать)
- `server/src/routes/system.ts` (создать)

**Описание:**
Реализовать сбор системных метрик (FR-500): CPU% (парсинг `/proc/stat`, два замера с интервалом 100ms), RAM (парсинг `/proc/meminfo`: MemTotal, MemAvailable → used/total), диск (`df -h /` → used/total), uptime (`/proc/uptime`), версия Node.js (`process.version`). Маршрут: `GET /api/system` → `{ cpu: number, ram: { used, total }, disk: { used, total }, uptime: number, nodeVersion: string }`. Маршрут: `GET /api/system/logs/:serviceName` — чтение `journalctl -u {serviceName} -n 200 --no-pager --output=json` (FR-502). Логи привязаны к `system` namespace, не к `projects`, т.к. сервис идентифицируется по `service_name`.

**Acceptance Criteria:**
```bash
curl http://localhost:9000/api/system -b cookies.txt
# → { "cpu": 12.5, "ram": { "used": 1200, "total": 4000 }, "disk": { "used": 15, "total": 40 }, "uptime": 123456, "nodeVersion": "v22.x.x" }
```
- Метрики возвращаются за < 200ms
- На macOS (dev) — graceful fallback (mock или частичные данные) вместо ошибки

**Зависимости:** 1.2

---

### 1.9 — GitHub integration service (Complexity: M) ✅

**Файлы:**
- `server/src/services/git-service.ts` (создать)
- `server/src/routes/projects.ts` (изменить — добавить GET /api/projects/:id/commits)

**Описание:**
Сервис `getCommits(repoUrl, branch, pat)`: запрос к GitHub API (`GET /repos/{owner}/{repo}/commits?sha={branch}&per_page=15`), парсинг ответа → `{ sha, message, author, date }[]`. Кеширование ответа: 60 секунд (in-memory Map). Использование conditional requests (ETag/If-None-Match) для экономии rate limit. Маршрут: `GET /api/projects/:id/commits` → JSON-массив коммитов с пометкой текущего деплоя (`isCurrent: true`).

**Acceptance Criteria:**
```bash
curl http://localhost:9000/api/projects/abc123/commits -b cookies.txt
# → [{ "sha": "a1b2c3d...", "message": "fix: navbar", "author": "artfrost", "date": "...", "isCurrent": true }, ...]
```
- Возвращает до 15 коммитов
- Повторный запрос в течение 60 сек не обращается к GitHub API (кеш)
- При невалидном PAT → 401 с понятным сообщением

**Зависимости:** 1.5 (нужен PAT из settings)

---

### 1.10 — SSE helper utility (Complexity: S) ✅

**Файлы:**
- `server/src/lib/sse.ts` (создать)

**Описание:**
Утилиты для Server-Sent Events: `formatSSEEvent(data)` → `data: ${JSON.stringify(data)}\n\n`, `createDeployStream(c)` — создание SSE-ответа через `streamSSE()` из Hono. Типы событий: `step` (шаг pipeline), `log` (строка лога), `status` (смена статуса), `complete` (завершение), `error` (ошибка). Каждое событие содержит `timestamp`, `step`, `message`.

**Acceptance Criteria:**
- SSE-helper генерирует валидный SSE-формат (проверка через `curl` с `Accept: text/event-stream`)
- Типы событий соответствуют `DeployStep` из `@fd/shared`

**Зависимости:** 1.1

---

### 1.11 — Serve static files из ui/dist (Complexity: S) ✅

**Файлы:**
- `server/src/index.ts` (изменить — добавить serveStatic)

**Описание:**
В production-режиме (`NODE_ENV=production`) Hono-сервер раздаёт собранный SPA из `ui/dist/` через `serveStatic()` middleware. Все маршруты, не начинающиеся с `/api/`, возвращают `index.html` (SPA fallback). В dev-режиме — пропуск (фронтенд работает через Vite dev server).

**Acceptance Criteria:**
- При `NODE_ENV=production` и наличии `ui/dist/index.html`: `curl http://localhost:9000/` → HTML-страница
- API-маршруты продолжают работать: `curl http://localhost:9000/api/projects` → JSON
- SPA fallback: `curl http://localhost:9000/projects/abc` → `index.html`

**Зависимости:** 1.1

---

## 4. Фаза 2 — Deploy Engine ✅

> **Цель:** Полный pipeline деплоя: git → build → rsync → restart → health check. SSE-стриминг логов.
> **Результат:** `POST /api/projects/:id/deploy` запускает деплой, логи стримятся через SSE, результат записывается в БД.

---

### 2.1 — Git service: clone, fetch, checkout (Complexity: M) ✅

**Файлы:**
- `server/src/services/git-service.ts` (изменить — добавить clone/fetch/checkout)
- `server/src/lib/exec.ts` (создать)

**Описание:**
Расширить git-сервис функциями: `cloneRepo(repoUrl, pat, targetDir)` — `git clone https://{PAT}@github.com/...` в `src_dir`; `fetchOrigin(srcDir)` — `git fetch origin`; `checkoutSha(srcDir, sha)` — `git checkout {sha}`. `exec.ts`: обёртка `child_process.spawn` → Promise с стримингом stdout/stderr, таймаутом (настраиваемым), логированием. Возвращает `{ stdout, stderr, exitCode }`.

**Acceptance Criteria:**
- `cloneRepo()` клонирует публичный репозиторий в указанную директорию
- `checkoutSha()` переключает на конкретный коммит
- При ошибке (невалидный URL, нет доступа) → выбрасывает описательную ошибку
- `execCommand()` завершается по timeout (default 5 минут)

**Зависимости:** 1.9

---

### 2.2 — Build service: npm ci + npm run build (Complexity: M) ✅

**Файлы:**
- `server/src/services/build-service.ts` (создать)

**Описание:**
Сервис `buildProject(srcDir, buildCmd)`: выполнение `npm ci --ignore-scripts` (FR NFR-305) в `src_dir`, затем выполнение `buildCmd` (по умолчанию `npm run build`). Стриминг stdout/stderr через callback (для SSE). Поддержка `onLog(line: string)` callback для real-time передачи логов. Таймаут: 10 минут на всю сборку.

> **Реализация:** В коде `installDeps()` и `runBuild()` реализованы как отдельные функции. Deploy pipeline эмитит `install` и `build` как раздельные SSE-шаги (события `step: 'install'` и `step: 'build'`), что позволяет UI отображать прогресс каждого этапа независимо.

**Acceptance Criteria:**
- `buildProject('/path/to/project', 'npm run build')` выполняет сборку
- Каждая строка stdout передаётся в `onLog` callback
- При ошибке сборки (exit code ≠ 0) → выбрасывает ошибку с последними 50 строками stderr
- `npm ci` запускается с `--ignore-scripts`

**Зависимости:** 2.1

---

### 2.3 — Rsync service: синхронизация артефактов (Complexity: S) ✅

**Файлы:**
- `server/src/lib/rsync.ts` (создать)

**Описание:**
Реализовать функцию `syncFiles(srcDir, runtimeDir, outputDir)`: выполнение `rsync -a --delete {srcDir}/{outputDir}/ {runtimeDir}/`, копирование `package.json` и `package-lock.json` в runtime, выполнение `npm ci --omit=dev` в runtime-директории (только production-зависимости). Паттерн «модель двух директорий» из DEPLOY-PLATFORM-RESEARCH.md.

**Acceptance Criteria:**
- После `syncFiles()` в runtime-директории находятся только production-файлы
- Старые файлы из runtime удаляются (`--delete`)
- `node_modules` в runtime содержит только production-зависимости

**Зависимости:** 2.1

---

### 2.4 — Systemd service: unit files, start/stop/restart (Complexity: L) ✅

**Файлы:**
- `server/src/lib/systemd.ts` (создать)
- `server/src/templates/systemd.service.ejs` (создать)

**Описание:**
`systemd.ts`: функции `createUnit(project)` — генерация systemd-юнита из EJS-шаблона (User=frostdeploy, WorkingDirectory=runtimeDir, ExecStart=startCmd, EnvironmentFile, Restart=on-failure, CPUQuota, MemoryMax), запись в `/etc/systemd/system/frostdeploy-{name}.service`, `systemctl daemon-reload`; `startService(name)`, `stopService(name)`, `restartService(name)`, `getStatus(name)` — обёртки для `systemctl`; `readLogs(name, lines=200)` — `journalctl -u {name} -n {lines} --no-pager`. Шаблон EJS с параметрами из TechStack раздел 5.2.

**Acceptance Criteria:**
- `createUnit(project)` создаёт валидный systemd-юнит файл
- `systemd-analyze verify frostdeploy-{name}.service` — без ошибок (на Linux)
- `restartService()` перезапускает сервис и возвращает управление после запуска
- `readLogs()` возвращает массив строк из journalctl
- На macOS (dev) — stub/mock с предупреждением в логах

**Зависимости:** 1.1

---

### 2.5 — Deploy orchestrator (полный pipeline) (Complexity: XL) ✅

**Файлы:**
- `server/src/services/deploy-service.ts` (создать)
- `server/src/queue/deploy-worker.ts` (создать)

**Описание:**
Главный компонент: `executePipeline(project, sha, onEvent)` — оркестрация всех шагов деплоя: 1) lock (INSERT deploy_locks), 2) создание записи deployments со статусом `queued`, 3) git fetch + checkout, 4) npm ci + build, 5) rsync → runtime, 6) npm ci --omit=dev в runtime, 7) systemctl restart, 8) health check (HTTP GET 127.0.0.1:{port}/, до 5 попыток с интервалом 2 сек), 9) обновление project.current_sha и status, 10) unlock (DELETE deploy_locks). Каждый шаг генерирует SSE-событие через `onEvent`. При ошибке на любом шаге: статус → `failed`, lock снимается, текущий runtime не затрагивается. Глобальный таймаут: 10 минут (FR-306).

**Acceptance Criteria:**
- Полный pipeline на тестовом проекте завершается за < 60 секунд (NFR-метрика M-002)
- При ошибке на шаге build → статус `failed`, lock снят, runtime нетронут (NFR-402)
- SSE-events содержат: step name, статус (⏳/✅/❌), timestamp, message
- Health check проходит: HTTP 200 от порта проекта
- Запись в deployments: commit_sha, duration_ms, logs, status

**Зависимости:** 2.1, 2.2, 2.3, 2.4

---

### 2.6 — Deploy queue: per-project mutex (Complexity: M) ✅

**Файлы:**
- `server/src/queue/deploy-queue.ts` (создать)

**Описание:**
In-process очередь на основе `Map<projectId, DeployJob>` + таблица `deploy_locks` для персистентности. `enqueue(projectId, sha)`: проверка deploy_locks в БД → если заблокирован → HTTP 409 с информацией о текущем деплое; иначе → INSERT lock → запуск pipeline. `complete(projectId)`: DELETE lock из БД, удаление из Map. При старте сервера: проверка orphaned locks (locked_at > 10 минут) → принудительная очистка. Разные проекты МОГУТ деплоиться параллельно (FR-302).

**Acceptance Criteria:**
- Два одновременных POST deploy для одного проекта → первый 200, второй 409
- Два одновременных POST deploy для разных проектов → оба 200
- При краше сервера и рестарте → orphaned locks очищаются
- `409` ответ содержит: `{ error: "Deploy in progress", deployId: "...", startedAt: "..." }`

**Зависимости:** 2.5

---

### 2.7 — Deploy SSE endpoint (real-time logs) (Complexity: M) ✅

**Файлы:**
- `server/src/routes/deploys.ts` (создать)

**Описание:**
Маршруты деплоя: `POST /api/projects/:id/deploy` — принимает `{ sha?, force? }`, ставит в очередь, стартует SSE-стрим; `GET /api/projects/:id/deploy/stream` — подключение к SSE-стриму текущего деплоя проекта; `GET /api/projects/:id/deployments` — история деплоев (пагинация, ORDER BY created_at DESC); `GET /api/projects/:id/deployments/:deployId` — детали одного деплоя с полным логом.

**Acceptance Criteria:**
```bash
# Start deploy and stream logs
curl -N -H "Accept: text/event-stream" \
  http://localhost:9000/api/projects/abc/deploy/stream -b cookies.txt
# → data: {"step":"fetch","status":"running","message":"Fetching origin...","timestamp":"..."}
# → data: {"step":"fetch","status":"success","message":"Fetched in 1.2s","timestamp":"..."}
# → data: {"step":"build","status":"running","message":"Running npm ci...","timestamp":"..."}
# ...

# Deploy history
curl http://localhost:9000/api/projects/abc/deployments -b cookies.txt
# → [{ "id":"...", "commitSha":"a1b2c3d", "status":"success", "durationMs":45000, ... }]
```

**Зависимости:** 2.5, 2.6, 1.10

---

### 2.8 — Rollback route (Complexity: S) ✅

**Файлы:**
- `server/src/routes/deploys.ts` (изменить — добавить rollback)

**Описание:**
`POST /api/projects/:id/rollback/:sha` — запуск деплоя указанного коммита с `triggered_by: 'rollback'`. Внутри — тот же `executePipeline`, но SHA берётся из параметра, а не latest. Валидация: SHA должен существовать в истории деплоев проекта (хотя бы один success).

**Acceptance Criteria:**
```bash
curl -X POST http://localhost:9000/api/projects/abc/rollback/a1b2c3d -b cookies.txt
# → 200 { "deploymentId": "..." }
```
- Rollback создаёт запись в deployments с `triggered_by: 'rollback'`
- Невалидный SHA → 400 с описанием

**Зависимости:** 2.7

---

### 2.9 — Build skip optimization (Complexity: S) ✅

**Файлы:**
- `server/src/services/deploy-service.ts` (изменить)

**Описание:**
Оптимизация FR-304: если `project.currentSha === sha` и `force` не установлен, сборка полностью пропускается. Pipeline возвращается немедленно, эмитируя SSE status-событие «Already deployed — skipping build» без создания записи в `deployments`. Если `force: true` — выполняется полный pipeline независимо от совпадения SHA.

**Acceptance Criteria:**
- Deploy того же SHA без `force` → мгновенный ответ «Already deployed»
- Deploy того же SHA с `force: true` → полная пересборка
- SSE-лог содержит сообщение о skip

**Зависимости:** 2.5

---

## 5. Фаза 3 — Proxy Manager (Caddy) ✅

> **Цель:** Автоматическое управление Caddy: добавление/удаление маршрутов, DNS-верификация, авто-SSL.
> **Результат:** При добавлении домена к проекту Caddy автоматически проксирует трафик и получает SSL-сертификат.

---

### 3.1 — Caddy config generator (Complexity: L) ✅

**Файлы:**
- `server/src/lib/caddy.ts` (создать)
- `server/src/templates/caddyfile.ejs` (создать)

**Описание:**
Двойная стратегия из TECH-STACK.md: Caddyfile для базовой конфигурации + Admin API для динамических маршрутов. `caddy.ts`: функция `generateRouteConfig(domain, port, isStatic, runtimeDir?, outputDir?)` — для SSR-проектов: reverse_proxy, для static: file_server. Конфиг включает: `encode gzip zstd`, JSON access log (`/var/log/caddy/{project}-access.log`, roll_size 50mb, roll_keep 5). Формат — JSON для Admin API (POST `http://localhost:2019/config/apps/http/servers/srv0/routes`).

**Acceptance Criteria:**
- `generateRouteConfig('example.com', 4321, false)` → валидный JSON для Caddy Admin API
- `generateRouteConfig('static.com', 0, true, '/var/www/blog', 'dist')` → file_server конфиг
- Конфиг включает gzip/zstd и JSON access log

**Зависимости:** 1.1

---

### 3.2 — Add/remove project domain в Caddy (Complexity: M) ✅

**Файлы:**
- `server/src/services/proxy-service.ts` (создать)

**Описание:**
`addRoute(domain, port, isStatic, ...)`: POST к Caddy Admin API для добавления маршрута + настройка JSON access log. `removeRoute(domain)`: DELETE маршрута по `@id`. `reloadCaddy()` в `caddy.ts`: вызов `caddy reload` для применения изменений Caddyfile. Validate-before-apply (NFR-401): при ошибке от Admin API — откат, логирование, возврат ошибки пользователю. Сохранение конфигурации в файл как backup.

**Acceptance Criteria:**
- `addRoute('app.example.com', 4321, false)` → маршрут появляется в Caddy config
- `removeRoute('app.example.com')` → маршрут удалён
- При невалидном конфиге → ошибка, Caddy не затронут
- На macOS (dev) — mock Caddy Admin API с логированием

**Зависимости:** 3.1

---

### 3.3 — SSL status check (Complexity: S) ✅

**Файлы:**
- `server/src/services/proxy-service.ts` (изменить — добавить SSL check)

**Описание:**
Функция `checkSslStatus(db, domain)`: запрос к Caddy Admin API для получения статуса сертификата (`GET /config/apps/tls/certificates/automate`). Маппинг: если домен в списке и DNS верифицирован (`verified_at` установлен) → `active`; если в списке, но DNS не верифицирован → `provisioning`; не в списке → `pending`; ошибка → `error`. Обновление поля `ssl_status` в таблице `domains`.

**Acceptance Criteria:**
- Для домена с валидным SSL → `{ sslStatus: 'active' }`
- Для нового домена (ожидает ACME) → `{ sslStatus: 'provisioning' }`
- Статус обновляется в БД

**Зависимости:** 3.2

---

### 3.4 — Domain DNS verification (Complexity: M) ✅

**Файлы:**
- `server/src/services/proxy-service.ts` (изменить — добавить DNS verification)

**Описание:**
Функция `verifyDns(domain, expectedIp)`: выполнение `dig +short A {domain}`, сравнение результата с IP сервера (определяется через `curl ifconfig.me` или из settings). Реализация FR-402: повторная проверка каждые 30 секунд до 10 минут. Результат сохраняется в `domains.verified_at`. Маршрут обновления статуса домена → DNS-инструкции пользователю: «Добавьте A-запись: {domain} → {serverIp}».

**Acceptance Criteria:**
- `verifyDns('app.example.com', '1.2.3.4')` → `true` если dig вернёт `1.2.3.4`
- При несовпадении → `false` + инструкции для пользователя
- `domains.verified_at` обновляется при успешной верификации

**Зависимости:** 3.2

---

### 3.5 — Caddy service: reload, validate (Complexity: S) ✅

**Файлы:**
- `server/src/lib/caddy.ts` (изменить — добавить validate/reload)

**Описание:**
Функции: `validateConfig()` — запрос к Caddy Admin API `GET /config/` для проверки доступности и валидности текущей конфигурации; `reloadCaddy()` — `caddy reload --config /etc/caddy/Caddyfile`; `getCaddyStatus()` — проверка что Caddy-процесс работает (`systemctl is-active caddy`). Используется на этапе интеграции для проверки здоровья прокси после изменений.

**Acceptance Criteria:**
- `validateConfig()` возвращает `true` если конфиг валиден
- `getCaddyStatus()` → `'active'` или `'inactive'`
- На macOS (dev) — stub с предупреждением

**Зависимости:** 3.1

---

## 6. Фаза 4 — UI: каркас и аутентификация ✅

> **Цель:** Работающий React SPA с авторизацией, sidebar-навигацией и API-клиентом.
> **Результат:** Пользователь может войти по паролю и видеть пустой dashboard с sidebar.

---

### 4.1 — Инициализация ui/ с Vite + React 19 + Tailwind + shadcn/ui (Complexity: L) ✅

**Файлы:**
- `ui/package.json` (создать)
- `ui/index.html` (создать)
- `ui/vite.config.ts` (создать)
- `ui/components.json` (создать)
- `ui/src/main.tsx` (создать)
- `ui/src/app.tsx` (создать)
- `ui/src/styles/globals.css` (создать)

**Описание:**
Инициализировать Vite-проект с React 19, настроить `@tailwindcss/vite` для Tailwind CSS 4, настроить shadcn/ui через `components.json` (стиль: new-york, цветовая схема: zinc). `globals.css`: CSS-переменные из UI-UX.md раздел 2.1 (dark theme: `--background: 240 10% 4%`, `--foreground: 0 0% 98%`, все статус-цвета). `index.html`: шрифты Inter + JetBrains Mono (Google Fonts или self-hosted). `vite.config.ts`: proxy `/api` → `http://localhost:9000` в dev-режиме.

**Acceptance Criteria:**
- `pnpm --filter @fd/ui dev` запускает Vite на :5173
- Страница открывается с тёмным фоном (#09090b) и белым текстом
- Hot-reload работает
- Proxy: `fetch('/api/system')` проксируется на :9000

**Зависимости:** 0.1, 0.2

---

### 4.2 — React Router: route tree (Complexity: M) ✅

**Файлы:**
- `ui/src/router.tsx` (создать)

**Описание:**
Настроить React Router 7 с `createBrowserRouter`. Маршруты из UI-UX.md раздел 3.2: `/login`, `/setup`, `/` (dashboard), `/projects/new`, `/projects/:id` (с вложенными: `/deploys`, `/deploys/:deployId`, `/env`, `/logs`, `/settings`), `/settings`. Два layout: full-screen (login, setup) и AppLayout (остальные). Placeholder-компоненты для всех маршрутов — `<div>Page Name</div>`.

**Acceptance Criteria:**
- Все маршруты из UI-UX.md разрешаются в React Router
- Переход между маршрутами работает через `useNavigate` / `<Link>`
- Неизвестный маршрут → 404 страница

**Зависимости:** 4.1

---

### 4.3 — TanStack Query + API client module (Complexity: M) ✅

**Файлы:**
- `ui/src/app.tsx` (изменить — добавить QueryClientProvider)
- `ui/src/api/client.ts` (создать)
- `ui/src/api/auth.ts` (создать)
- `ui/src/api/projects.ts` (создать)
- `ui/src/api/system.ts` (создать)
- `ui/src/api/deploys.ts` (создать)
- `ui/src/api/settings.ts` (создать)

**Описание:**
Настроить TanStack Query 5 с `QueryClient` (default staleTime: 30 сек, default retry: 1). API-клиент: обёртка `fetch` с base URL, автоматическим `Content-Type: application/json`, обработкой 401 → redirect на `/login`. Модуль для каждой группы эндпоинтов: `auth.ts` (login, logout, check), `projects.ts` (fetchProjects, createProject, etc.), `deploys.ts` (triggerDeploy, fetchDeployments), `system.ts` (fetchSystemMetrics), `settings.ts` (fetchSettings, updateSettings).

**Acceptance Criteria:**
- `useQuery({ queryKey: ['projects'], queryFn: fetchProjects })` — возвращает список проектов
- При 401 → автоматический redirect на `/login`
- Кеширование: повторный запрос за < 30 сек не обращается к серверу

**Зависимости:** 4.1

---

### 4.4 — Login page (Complexity: M) ✅

**Файлы:**
- `ui/src/pages/login.tsx` (создать)
- `ui/src/components/ui/button.tsx` (создать — из shadcn/ui)
- `ui/src/components/ui/input.tsx` (создать — из shadcn/ui)
- `ui/src/components/ui/card.tsx` (создать — из shadcn/ui)

**Описание:**
Реализовать страницу авторизации по wireframe из UI-UX.md раздел 4.1: полноэкранный layout, центрированная карточка с логотипом «❄ FrostDeploy», поле пароля (Input type=password), кнопка «Войти» (Button primary). При ошибке — toast с «Неверный пароль». При rate-limit — toast с «Слишком много попыток. Попробуйте через N секунд». При успехе — redirect на `/`. Подсказка внизу: «Забыли пароль? Сбросьте через CLI: frostdeploy reset-password». Toast-уведомления реализованы через библиотеку Sonner (`<Toaster>` подключён в `main.tsx`).

**Acceptance Criteria:**
- Ввод пароля + Enter → POST `/api/auth/login`
- Успехный вход → redirect на `/`
- Неверный пароль → красный toast
- Визуально: тёмный фон, карточка по центру, шрифт Inter

**Зависимости:** 4.2, 4.3

---

### 4.5 — App shell: sidebar + main content area (Complexity: L) ✅

**Файлы:**
- `ui/src/components/app-layout.tsx` (создать)
- `ui/src/components/sidebar.tsx` (создать)
- `ui/src/components/sidebar-project-item.tsx` (создать)
- `ui/src/components/ui/separator.tsx` (создать — из shadcn/ui)
- `ui/src/components/ui/scroll-area.tsx` (создать — из shadcn/ui)
- `ui/src/components/ui/tooltip.tsx` (создать — из shadcn/ui)
- `ui/src/lib/utils.ts` (создать)
- `ui/src/lib/constants.ts` (создать)

**Описание:**
AppLayout из UI-UX.md раздел 3.1: sidebar (240px, фиксированный) + main (flex-1, max-width 1280px). Sidebar: логотип «FrostDeploy» + иконка снежинки, ссылка Dashboard, динамический список проектов с цветовыми индикаторами статуса (зелёный=active, синий=deploying, красный=error, серый=created/stopped), кнопка «+ Новый» (ведёт на `/projects/new`), Настройки (внизу). `utils.ts`: функция `cn()` = clsx + tailwind-merge, `formatRelativeTime()`, `formatDuration()`, `truncate()`, `shortSha()`. `constants.ts`: `POLLING_INTERVALS`, `FRAMEWORK_ICONS`, `STATUS_COLORS`, `STATUS_TEXT_COLORS`.

**Acceptance Criteria:**
- Sidebar отображает проекты динамически (из API)
- Клик по проекту → переход на `/projects/:id`
- Текущий маршрут подсвечен в sidebar
- На экранах < 768px sidebar сворачивается (mobile responsive)
- Цветовая схема соответствует UI-UX.md раздел 2.1

**Зависимости:** 4.3, 4.4

---

### 4.6 — AuthGuard component (Complexity: S) ✅

**Файлы:**
- `ui/src/components/auth-guard.tsx` (создать)

**Описание:**
Компонент-обёртка для защищённых маршрутов. При монтировании сначала проверяет `GET /api/settings/setup-status` — если setup не завершён, redirect на `/setup`. Затем проверяет `GET /api/auth/check` — если 401, redirect на `/login`. Если оба check пройдены → рендерит children. Во время проверки — показывает skeleton / loading. Используется в AppLayout как wrapper.

**Acceptance Criteria:**
- Прямой переход на `/` без авторизации → redirect на `/login`
- После login → перенаправление на изначально запрошенный маршрут
- Skeleton отображается во время проверки сессии

**Зависимости:** 4.3

---

### 4.7 — Setup wizard page (Complexity: M) ✅

**Файлы:**
- `ui/src/pages/setup.tsx` (создать)

**Описание:**
Мастер первоначальной настройки из UI-UX.md раздел 4.2: 3 шага (Пароль → GitHub PAT → Домен). Шаг 1: два поля пароля (password + confirm, ≥ 8 символов). Шаг 2: поле PAT, при вводе — валидация через GitHub API (GET /user). Шаг 3: поле домена (FQDN). Кастомный step indicator (нумерованные кружки с соединительными линиями, реализован inline в `setup.tsx`). Кнопки «Назад» / «Далее» / «Завершить». POST `/api/setup` при финализации. После успеха → redirect на `/` (сервер автоматически устанавливает cookie сессии при setup).

**Acceptance Criteria:**
- Wizard проходится в 3 шага с валидацией на каждом
- PAT валидируется через GitHub API (показывается имя пользователя при успехе)
- «Завершить» → POST /api/setup → redirect `/` (auto-login через session cookie)
- При уже выполненном setup → redirect на `/`

**Зависимости:** 4.2, 4.3

---

### 4.8 — Базовая адаптивная вёрстка (Complexity: M) ✅

**Файлы:**
- `ui/src/components/app-layout.tsx` (изменить)
- `ui/src/components/sidebar.tsx` (изменить)
- `ui/src/hooks/use-sidebar.ts` (создать)

**Описание:**
`use-sidebar.ts`: кастомный хук для управления состоянием sidebar (open/collapsed/hidden) в зависимости от viewport и пользовательского действия. Адаптивность из UI-UX.md раздел 7: на desktop (≥ 1024px) — sidebar развёрнут (240px); на планшетах (768–1023px) — sidebar свёрнут (56px, только иконки); на мобильных (< 768px) — sidebar скрыт, доступ через hamburger menu (Sheet/Drawer). Контент-область: padding 24px (desktop), 16px (mobile). Кнопка collapse/expand sidebar.

**Acceptance Criteria:**
- На 1440px: sidebar 240px + контент
- На 900px: sidebar 56px (иконки), tooltip при наведении
- На 375px: sidebar скрыт, hamburger-меню, контент full-width
- Переход плавный (transition 200ms)

**Зависимости:** 4.5

---

## 7. Фаза 5 — UI: Dashboard и проекты ✅

> **Цель:** Рабочий dashboard с метриками и полный CRUD проектов через UI.
> **Результат:** Пользователь видит все проекты, может добавить новый через wizard, просматривать детали проекта.

---

### 5.1 — Dashboard page (Complexity: L) ✅

**Файлы:**
- `ui/src/pages/dashboard.tsx` (создать)
- `ui/src/components/metric-card.tsx` (создать)
- `ui/src/components/project-card.tsx` (создать)
- `ui/src/components/status-badge.tsx` (создать)
- `ui/src/components/ui/badge.tsx` (создать — из shadcn/ui)
- `ui/src/components/ui/skeleton.tsx` (создать — из shadcn/ui)
- `ui/src/hooks/use-system-metrics.ts` (создать)

**Описание:**
Dashboard из UI-UX.md раздел 4.3: верхний ряд — 4 MetricCard (Проекты, CPU%, RAM used/total, Disk used/total). Секция «Проекты» — карточки ProjectCard: иконка фреймворка, имя, домен (ссылка), статус (StatusBadge), время последнего деплоя, кнопка «Deploy ▶» (quick deploy latest). Секция «Последние деплои» — таблица 5 записей. Метрики: polling каждые 10 секунд через `useSystemMetrics()`. Кнопка «+ Новый проект» в заголовке.

**Acceptance Criteria:**
- MetricCards показывают актуальные CPU/RAM/Disk
- ProjectCards отображают все проекты с корректными статусами
- «Deploy ▶» → POST /api/projects/:id/deploy → toast «Deploy started»
- Skeleton при загрузке
- Кнопка «+ Новый проект» → `/projects/new`

**Зависимости:** 4.5, 4.6

---

### 5.2 — New Project wizard (Complexity: XL) ✅

**Файлы:**
- `ui/src/pages/new-project.tsx` (создать)
- `ui/src/components/ui/select.tsx` (создать — из shadcn/ui)
- `ui/src/components/ui/tabs.tsx` (создать — из shadcn/ui)
- `ui/src/components/env-var-editor.tsx` (создать)

**Описание:**
Wizard создания проекта из UI-UX.md раздел 4.4: 4 шага (Repo → Config → Env → Review). Шаг 1: поле repo_url + branch (Select с опциями), при вводе URL — debounce 500ms → POST /api/detect → показать badge с фреймворком. Шаг 2: name (auto из repo), build_cmd, start_cmd, port (auto), domain (optional) — предзаполнено из detect. Шаг 3: EnvVarEditor — динамическая таблица key-value, кнопка «+ Добавить», toggle секрет. Шаг 4: итоговая сводка всех полей (read-only), кнопка «Создать проект» → POST /api/projects → redirect на `/projects/:id`.

**Acceptance Criteria:**
- URL ввод → auto-detect фреймворка → предзаполнение полей
- Все 4 шага навигируются вперёд/назад
- Валидация на каждом шаге (repo_url обязателен, name обязательно)
- «Создать проект» → проект появляется в sidebar и dashboard
- EnvVarEditor позволяет добавить/удалить переменные, toggle show/hide

**Зависимости:** 5.1, 4.3

---

### 5.3 — Project detail page с tabs (Complexity: L) ✅

**Файлы:**
- `ui/src/pages/project-overview.tsx` (создать)
- `ui/src/components/commit-card.tsx` (создать)
- `ui/src/components/ui/dropdown-menu.tsx` (создать — из shadcn/ui)

**Описание:**
Страница проекта из UI-UX.md раздел 4.5: заголовок с именем + кнопка «Deploy latest ▶», система табов (Обзор | Деплои | Env | Логи | Настройки). Tab «Обзор»: 4 info-карточки (статус+SHA+фреймворк+порт, домен+SSL, последний деплой, uptime), секция «Последние коммиты» — CommitCard × 15 (SHA 7 символов, сообщение, автор, время, кнопка Deploy для каждого, подсветка текущего). CommitCard: моноширинный SHA, `text-muted-foreground`, кнопка Deploy у каждого коммита.

**Acceptance Criteria:**
- Табы переключают содержимое, URL обновляется
- Карточки показывают актуальные данные проекта
- Список коммитов загружается из GitHub API
- «Deploy latest ▶» → запуск деплоя последнего коммита
- Кнопка Deploy у конкретного коммита → деплой этого SHA

**Зависимости:** 5.1, 4.2

---

### 5.4 — Project settings page (Complexity: M) ✅

**Файлы:**
- `ui/src/pages/project-settings.tsx` (создать)
- `ui/src/components/confirm-dialog.tsx` (создать)
- `ui/src/components/ui/dialog.tsx` (создать — из shadcn/ui)
- `ui/src/components/ui/alert.tsx` (создать — из shadcn/ui)

**Описание:**
Настройки проекта из UI-UX.md раздел 4.8: форма редактирования (name, branch, build_cmd, start_cmd, domain, port — частично read-only). Danger Zone: кнопка «Удалить проект» (красная) → ConfirmDialog с подтверждением (ввод имени проекта). При удалении → POST DELETE /api/projects/:id → redirect на `/`.

**Acceptance Criteria:**
- Поля предзаполнены текущими значениями проекта
- «Сохранить» → PUT /api/projects/:id → toast «Saved»
- «Удалить проект» → диалог с вводом имени → DELETE → redirect
- Без ввода имени кнопка удаления неактивна

**Зависимости:** 5.3

---

### 5.5 — Platform settings page (Complexity: M) ✅

**Файлы:**
- `ui/src/pages/platform-settings.tsx` (создать)
- `ui/src/components/ui/switch.tsx` (создать — из shadcn/ui)

**Описание:**
Настройки платформы из UI-UX.md раздел 4.9: информация о сервере (Node.js version, uptime, DB size), форма GitHub PAT (маскированное поле, кнопка «Обновить»), смена пароля (старый + новый + подтверждение), домен платформы. При обновлении PAT — ревалидация через GitHub API.

**Acceptance Criteria:**
- Текущие настройки загружаются из API
- PAT маскирован (ghp_•••••)
- Смена пароля с валидацией (≥ 8 символов, совпадение)
- «Сохранить» → PUT /api/settings → toast

**Зависимости:** 4.5, 4.3

---

## 8. Фаза 6 — UI: деплой и логи ✅

> **Цель:** Real-time консоль деплоя, история деплоев, env-переменные, логи сервисов.
> **Результат:** Пользователь видит лог деплоя в real-time, просматривает историю, управляет env-переменными.

---

### 6.1 — Deploy console page (SSE terminal) (Complexity: XL) ✅

**Файлы:**
- `ui/src/pages/deploy-console.tsx` (создать)
- `ui/src/components/deploy-log.tsx` (создать)
- `ui/src/components/deploy-progress.tsx` (создать)
- `ui/src/hooks/use-sse.ts` (создать)

**Описание:**
Консоль деплоя из UI-UX.md раздел 4.7: терминальный эмулятор (чёрный фон `#0a0a0a`, моноширинный шрифт JetBrains Mono 12px, зелёный текст для success, красный для error). `useSSE(url)` hook: подключение к SSE endpoint, парсинг событий, автореконнект при обрыве. `DeployProgress`: визуальный прогресс 6 шагов pipeline (fetch → checkout → install → build → sync → restart → health) — каждый шаг показывает статус (⏳ pending, 🔄 running, ✅ done, ❌ failed). `DeployLog`: ScrollArea с автоскроллом вниз, каждая строка — timestamp + message.

**Acceptance Criteria:**
- SSE подключается и показывает логи в real-time
- Каждый шаг pipeline визуализирован в DeployProgress
- Автоскролл к последним логам
- При завершении (success/failed) — итоговый статус и длительность
- При обрыве соединения — автореконнект через 3 секунды

**Зависимости:** 4.2, 4.3

---

### 6.2 — Deploy history table (Complexity: M) ✅

**Файлы:**
- `ui/src/pages/project-deploys.tsx` (создать)
- `ui/src/components/ui/table.tsx` (создать — из shadcn/ui)

**Описание:**
Таблица истории деплоев из UI-UX.md раздел 4.6: столбцы — дата (relative time), commit SHA (7 символов, моношрифт), сообщение коммита, статус (StatusBadge), длительность, triggered_by (manual/rollback). Сортировка по дате DESC. Пагинация (20 записей на страницу). Клик по строке → переход на `/projects/:id/deploys/:deployId` (deploy console с историческим логом).

**Acceptance Criteria:**
- Таблица отображает все деплои проекта
- Правильная цветовая кодировка статусов (зелёный=success, красный=failed, синий=building)
- Клик по строке → страница деплоя с полным логом
- Пагинация работает при > 20 записей

**Зависимости:** 5.3

---

### 6.3 — Commit list с deploy buttons (Complexity: M) ✅

**Файлы:**
- `ui/src/pages/project-overview.tsx` (изменить — расширить функционал)

**Описание:**
Расширить секцию коммитов на overview-странице: подсветка текущего задеплоенного коммита (граница accent, badge «текущий»), кнопка «Deploy ▶» у каждого коммита, подсветка коммитов из истории деплоев (если деплоился — показать статус). При клике Deploy → toast «Deploy started» + redirect на deploy console. Кнопка «Rollback» у предыдущих задеплоенных коммитов.

**Acceptance Criteria:**
- Текущий SHA подсвечен зелёной границей + badge
- Каждый коммит имеет кнопку Deploy
- При наличии успешного деплоя — кнопка «Rollback» вместо «Deploy»
- Клик Deploy → trigger + redirect на SSE-лог

**Зависимости:** 5.3, 6.1

---

### 6.4 — Env vars editor (Complexity: M) ✅

**Файлы:**
- `ui/src/pages/project-env.tsx` (создать)

**Описание:**
Таб «Env» из UI-UX.md: таблица env-переменных (key, value, is_secret). Поля value: маскированы для секретов (••••••), кнопка eye/eye-off для toggle. Кнопка «+ Добавить» → новая строка. Кнопка удаления (trash) у каждой строки с ConfirmDialog. Кнопка «Сохранить изменения» → PUT /api/projects/:id/env (bulk upsert). Валидация: key — `^[A-Z_][A-Z0-9_]*$`, value — не пустое.

**Acceptance Criteria:**
- Отображение текущих env-переменных с маскировкой секретов
- Добавление/удаление/редактирование переменных
- «Сохранить» → bulk upsert → toast «Saved»
- Невалидный key (строчные буквы) → ошибка валидации
- Toggle show/hide работает per-variable

**Зависимости:** 5.3

---

### 6.5 — Service logs viewer (Complexity: M) ✅

**Файлы:**
- `ui/src/pages/project-logs.tsx` (создать)

**Описание:**
Таб «Логи» из UI-UX.md: терминальный вид (аналогичный deploy console, но для journalctl). Запрос `GET /api/projects/:id/logs` → последние 200 строк. Polling каждые 5 секунд (`refetchInterval: 5000`). Кнопка «Очистить» (визуально, не удаляет из journalctl). Фильтр по времени (последние 1ч / 6ч / 24ч / 7д). Каждая строка — timestamp + level (INFO/WARN/ERROR) + message.

**Acceptance Criteria:**
- Загрузка последних 200 строк из journalctl
- Автообновление каждые 5 секунд
- Фильтрация по времени работает
- Цветовая кодировка уровней (INFO=серый, WARN=жёлтый, ERROR=красный)
- Автоскролл к новым записям

**Зависимости:** 5.3

---

### 6.6 — Real-time status updates (Complexity: M) ✅

**Файлы:**
- `ui/src/hooks/use-deploy-status.ts` (создать)
- `ui/src/components/project-card.tsx` (изменить)
- `ui/src/components/sidebar-project-item.tsx` (изменить)

**Описание:**
Hook `useDeployStatus(projectId)`: polling текущего статуса проекта каждые 5 секунд (`refetchInterval: 5000`). При статусе `deploying` → увеличить частоту до каждых 2 секунд. Обновление StatusBadge в ProjectCard и SidebarProjectItem в реальном времени. При завершении деплоя — инвалидация кеша проектов и деплоев  (invalidateQueries).

**Acceptance Criteria:**
- При старте деплоя → статус в sidebar меняется на «deploying» (синяя пульсация)
- При завершении → обновление до «active» (зелёный) или «error» (красный)
- Dashboard обновляется без ручного обновления страницы

**Зависимости:** 5.1, 6.1

---

### 6.7 — Rollback UI (Complexity: S) ✅

**Файлы:**
- `ui/src/pages/project-overview.tsx` (изменить — расширить rollback)

**Описание:**
Кнопка «Откатить» на overview-странице и в таблице деплоев: при клике → ConfirmDialog «Откатить к коммиту {sha}?» → POST /api/projects/:id/rollback/:sha → redirect на deploy console. Кнопка доступна только для коммитов с успешным деплоем в истории.

**Acceptance Criteria:**
- Кнопка «Откатить» видна у предыдущих success-деплоев
- Подтверждение → POST rollback → SSE-лог
- В истории деплоев rollback-запись помечена как `triggered_by: 'rollback'`

**Зависимости:** 6.3

---

## 9. Фаза 7 — Интеграция и первый деплой ✅

> **Цель:** End-to-end проверка всей системы: от добавления проекта до работающего сайта.
> **Результат:** Реальный проект (Astro SSR) успешно задеплоен через FrostDeploy.

---

### 7.1 — End-to-end test: add → deploy → verify (Complexity: L) ✅

**Файлы:**
- `server/src/__tests__/e2e/deploy.test.ts` (создать)

**Описание:**
Написать комплексный интеграционный тест: 1) POST setup (создание пароля, PAT), 2) POST login, 3) POST /api/projects (создание проекта с реальным тестовым репозиторием), 4) POST /api/projects/:id/deploy, 5) подключение к SSE → ожидание all steps complete, 6) GET /api/projects/:id → status=active, current_sha not null, 7) GET /api/projects/:id/deployments → последний deployment status=success. Тест использует in-memory SQLite, mock для systemd/caddy.

**Acceptance Criteria:**
- Тест проходит за < 30 секунд с mock-git (локальный bare repo)
- Все шаги pipeline выполняются последовательно
- Финальный статус проекта: `active`
- Deployment: `status: success`, `duration_ms > 0`

**Зависимости:** Фазы 1–3

---

### 7.2 — Caddy auto-config при создании/удалении проекта (Complexity: M) ✅

**Файлы:**
- `server/src/services/project-service.ts` (изменить)

**Описание:**
Интегрировать proxy-service в lifecycle проекта: при `createProject()` с доменом → автоматический вызов `addRoute()` для Caddy + запуск DNS-верификации. При `deleteProject()` → `removeRoute()` для Caddy + очистка ВСЕХ связанных записей из таблицы `domains` (не только `project.domain`, а все домены проекта). При `updateProject()` с изменением домена → remove старого + add нового. Обработка ошибок: если Caddy недоступен — проект создаётся, но отмечается warning.

**Acceptance Criteria:**
- Создание проекта с доменом → маршрут появляется в Caddy
- Удаление проекта → маршрут удаляется из Caddy
- Ошибка Caddy → проект создан, warning в логах, статус домена `pending`

**Зависимости:** Фазы 1, 3

---

### 7.3 — systemd unit auto-creation при создании проекта (Complexity: M) ✅

**Файлы:**
- `server/src/services/project-service.ts` (изменить)

**Описание:**
Интегрировать systemd-lib в lifecycle проекта: при `createProject()` → `createUnit(project)` для создания systemd-юнита. При `deleteProject()` → `stopService()` + удаление юнита + `daemon-reload`. Создание директорий: `mkdirSync(srcDir)`, `mkdirSync(runtimeDir)` (с проверкой на существование).

**Acceptance Criteria:**
- Создание проекта → файл `/etc/systemd/system/frostdeploy-{name}.service` создан
- Удаление проекта → сервис остановлен, файл удалён
- `systemctl status frostdeploy-{name}` → loaded (inactive)
- Директории `src_dir` и `runtime_dir` созданы

**Зависимости:** Фазы 1, 2 (systemd service)

---

### 7.4 — Setup wizard (first-run flow) (Complexity: M) ✅

**Файлы:**
- `server/src/routes/settings.ts` (изменить — setup detection)
- `ui/src/components/auth-guard.tsx` (изменить — setup redirect)

**Описание:**
При первом запуске (нет БД или отсутствует session secret) — все маршруты редиректят на `/setup`. После завершения setup wizard → session secret создан → обычная работа. Server-side: middleware в `auth.ts` проверяет наличие строки `session_secret` в таблице `settings` — если строка отсутствует, возвращает 403 с кодом `SETUP_REQUIRED` (все маршруты кроме `/api/setup`). Client-side: AuthGuard проверяет ответ и редиректит на `/setup`.

**Acceptance Criteria:**
- Чистый запуск (нет data.db) → автоматический redirect на `/setup`
- После setup → обычная работа, повторный доступ к `/setup` → redirect на `/`
- Пустая БД корректно инициализируется при setup

**Зависимости:** 4.7, 1.5

---

### 7.5 — Error handling pass (Complexity: L) ✅

**Файлы:**
- `server/src/middleware/error-handler.ts` (изменить)
- `ui/src/components/ui/alert.tsx` (изменить)
- Все pages/ (проход по всем страницам)

**Описание:**
Систематический проход по всем error-сценариям: API-ответы с ошибками (400, 401, 403, 404, 409, 429, 500) → понятные сообщения для пользователя. В production-режиме (`NODE_ENV === 'production'`) error-handler возвращает дружелюбные русскоязычные сообщения; в development-режиме — оригинальные сообщения ошибок для удобства отладки. Retry-logic для transient ошибок (network, 500). Empty states: нет проектов → приглашение создать первый; нет деплоев → инструкция; нет commits → проверить PAT. UI: компонент `Alert` для предупреждений на уровне страницы. Toast для операций (success/error). Loading states с Skeleton для всех данных.

**Acceptance Criteria:**
- Каждая API-ошибка показывает понятное сообщение (не «Internal Server Error»)
- Network error → toast «Нет связи с сервером, повторяем...» + retry
- Пустые состояния: осмысленные заглушки на всех страницах
- Плавная деградация: ошибка одного компонента не ломает всю страницу

**Зависимости:** Фазы 4–6

---

## 10. Фаза 8 — Hardening ✅

> **Цель:** Подготовка к production: безопасность, бэкапы, установочный скрипт, документация.
> **Результат:** FrostDeploy готов к установке на production VDS.

---

### 8.1 — Security audit: Zod-валидация всех маршрутов, CSRF, rate-limiting (Complexity: L) ✅

**Файлы:**
- Все файлы в `server/src/routes/` (проверка и доработка)
- `server/src/middleware/rate-limit.ts` (создать)

**Описание:**
Аудит безопасности: 1) Zod-валидация на ВСЕХ маршрутах, принимающих input (body, params, query) через `@hono/zod-validator`. 2) Глобальный rate-limiter: 100 req/min/IP для API, 5 req/min/IP для auth. 3) CSRF-защита: SameSite=Lax cookie + проверка Origin/Referer header для мутирующих запросов. 4) Sanitization: strip HTML из пользовательских строк (name, domain). 5) Security headers: X-Content-Type-Options, X-Frame-Options, CSP.

**Acceptance Criteria:**
- Все POST/PUT/DELETE маршруты валидируют input через Zod
- Запрос с невалидным body → 400 с описанием ошибок
- 6-й auth-запрос в минуту → 429
- SQL injection через name поле → отклонено валидацией
- Security headers присутствуют в ответах

**Зависимости:** Фаза 7

---

### 8.2 — Backup/restore functionality (Complexity: M) ✅

**Файлы:**
- `server/src/services/backup-service.ts` (создать)
- `server/src/routes/settings.ts` (изменить — добавить маршруты backup)

**Описание:**
Бэкап SQLite БД: функция `createBackup()` — использовать `sqlite3 .backup` API для hot-backup (без остановки) в `/var/lib/frostdeploy/backups/data-{timestamp}.db`. Функция `restoreBackup(path)` — остановка сервера, замена data.db, перезапуск. Маршруты: `POST /api/backups` (создать), `GET /api/backups` (список), `POST /api/backups/:id/restore` (восстановить). Автоматический бэкап: ежедневный через setTimeout/setInterval (задача cron слишком тяжёла для MVP).

**Acceptance Criteria:**
- `POST /api/backups` создаёт копию БД без блокировки
- Список бэкапов показывает дату, размер
- Restore восстанавливает БД из файла
- Бэкап-файлы ротируются (хранить последние 7)

**Зависимости:** 1.5

---

### 8.3 — Install script (install.sh) (Complexity: L) ✅

**Файлы:**
- `scripts/install.sh` (создать)

**Описание:**
Установочный скрипт для чистого VDS: 1) проверка ОС (Ubuntu 22.04+ / Debian 12+), 2) проверка Node.js 20+, установка если нет (через NodeSource), 3) установка Caddy (через apt repo), 4) установка pnpm, 5) создание пользователя `frostdeploy`, 6) клонирование репозитория в `/opt/frostdeploy`, 7) `pnpm install && pnpm build`, 8) создание systemd-юнита для FrostDeploy, 9) настройка Caddy base config, 10) запуск FrostDeploy → вывод URL + промпт для setup wizard. Скрипт идемпотентен (можно запускать повторно для обновления).

**Acceptance Criteria:**
- `curl -fsSL https://... | bash` → FrostDeploy запущен на порту 9000
- Проверки: ОС, Node.js, Caddy — при невыполнении → ошибка с инструкцией
- systemd-юнит создан: `systemctl status frostdeploy` → active
- Лог установки: каждый шаг с ✅/❌

**Зависимости:** Фаза 7

---

### 8.4 — Systemd unit для FrostDeploy (Complexity: S) ✅

**Файлы:**
- `scripts/frostdeploy.service` (создать)

**Описание:**
systemd-юнит для самого FrostDeploy: `User=frostdeploy`, `WorkingDirectory=/opt/frostdeploy`, `ExecStart=/usr/bin/node server/dist/index.js`, `EnvironmentFile=/opt/frostdeploy/.env`, `Restart=on-failure`, `RestartSec=5`, `After=network.target caddy.service`. Юнит включается через `install.sh`.

**Acceptance Criteria:**
- `systemctl start frostdeploy` → сервер запускается
- `systemctl restart frostdeploy` → перезапуск без потери данных
- При краше → автоматический перезапуск через 5 секунд
- `journalctl -u frostdeploy` → полные логи

**Зависимости:** 8.3

---

### 8.5 — README.md для репозитория (Complexity: M) ✅

**Файлы:**
- `README.md` (создать)

**Описание:**
Написать README для GitHub-репозитория: описание проекта (elevator pitch из PRD), скриншот dashboard (placeholder), Quick Start (install.sh + setup wizard), Development (git clone → pnpm install → pnpm dev), Architecture overview (ASCII-диаграмма из TechStack), Supported Frameworks таблица, Roadmap (v0.1–v1.0 из PRD), Contributing, License (MIT).

**Acceptance Criteria:**
- README содержит: описание, установку, разработку, архитектуру
- Quick Start: от чистого VDS до работающей платформы за 4 команды
- Таблица поддерживаемых фреймворков из PRD
- Лицензия MIT

**Зависимости:** нет

---

### 8.6 — Performance: SQLite PRAGMA tuning, query optimization (Complexity: M) ✅

**Файлы:**
- `packages/db/src/client.ts` (изменить — проверка PRAGMA)
- `server/src/services/project-service.ts` (изменить — оптимизация запросов)

**Описание:**
Проверить и оптимизировать: 1) PRAGMA из DATABASE.md раздел 1 — подтвердить все 7 директив. 2) Запрос listProjects с JOIN на последний deployment (подзапрос с LIMIT 1). 3) Индексы: убедиться что все индексы из DATABASE.md раздел 5 присутствуют. 4) Размер SQLite-файла < 1 MB при 5 проектах × 100 деплоев (NFR-202). 5) Замерить время критических запросов: < 10ms для SELECT, < 50ms для INSERT.

**Acceptance Criteria:**
- `sqlite3 data.db "PRAGMA journal_mode"` → `wal`
- `EXPLAIN QUERY PLAN SELECT ... FROM projects` → использует индексы
- Размер data.db после seed (2 проекта, 5 деплоев) → < 100 KB
- GET /api/projects latency → < 20ms (на dev-машине)

**Зависимости:** 0.9

---

## 11. Зависимости между фазами

```
                    ┌──────────────────────┐
                    │    Phase 0           │
                    │  Инициализация       │
                    │  (Foundation)        │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │    Phase 1           │
                    │  API-сервер (ядро)   │
                    └───┬──────┬───────┬───┘
                        │      │       │
              ┌─────────▼──┐   │   ┌───▼───────────┐
              │  Phase 2   │   │   │   Phase 3     │
              │  Deploy    │   │   │   Proxy Mgr   │
              │  Engine    │   │   │   (Caddy)     │
              └─────┬──────┘   │   └───┬───────────┘
                    │          │       │
                    │   ┌──────▼───────────┐
                    │   │    Phase 4       │
                    │   │  UI: каркас +    │
                    │   │  аутентификация  │
                    │   └───┬──────┬───────┘
                    │       │      │
                    │  ┌────▼──┐ ┌─▼───────┐
                    │  │Ph. 5  │ │ Ph. 6   │
                    │  │UI:    │ │ UI:     │
                    │  │Dashb. │ │ Deploy  │
                    │  │Proj.  │ │ Logs    │
                    │  └───┬───┘ └──┬──────┘
                    │      │        │
                    └──────┼────────┘
                           │
                    ┌──────▼───────────┐
                    │    Phase 7       │
                    │  Интеграция +    │
                    │  первый деплой   │
                    └──────┬───────────┘
                           │
                    ┌──────▼───────────┐
                    │    Phase 8       │
                    │  Hardening       │
                    └──────────────────┘
```

### Правила зависимостей

| Фаза | Зависит от | Обоснование |
|------|------------|-------------|
| 0 | — | Стартовая точка, нет зависимостей |
| 1 | 0 | Нужен workspace, типы, БД-схема |
| 2 | 1 | Нужен API-сервер, git-сервис, exec-утилита |
| 3 | 1 | Нужен API-сервер для управления Caddy |
| 4 | 0, 1 (auth) | Нужен workspace для ui/; auth API для login |
| 5 | 4, 1 | Нужен AppLayout + API для проектов и метрик |
| 6 | 4, 2 | Нужен AppLayout + Deploy Engine для SSE |
| 7 | 1–6 | Интеграция всех компонентов |
| 8 | 7 | Hardening после полной интеграции |

### Параллелизация

Фазы, которые МОЖНО разрабатывать параллельно:
- **Phase 2 + Phase 3** — независимые backend-подсистемы (после Phase 1)
- **Phase 4** — может стартовать параллельно с Phase 2/3 (нужен только auth из Phase 1)
- **Phase 5 + Phase 6** — независимые UI-секции (после Phase 4)

---

## 12. Критический путь

Критический путь — самая длинная цепочка зависимостей, определяющая минимальное время реализации:

```
Phase 0 → Phase 1 → Phase 2 → Phase 7 → Phase 8
   │          │         │         │         │
  [M]        [L]       [XL]     [L]       [L]
```

### Задачи на критическом пути

1. **0.8** — Drizzle-схема (L) — блокирует все работы с БД
2. **1.6** — Projects CRUD (L) — блокирует весь workflow проектов
3. **2.5** — Deploy orchestrator (XL) — ядро системы, самая сложная задача
4. **2.7** — Deploy SSE endpoint (M) — связывает engine с UI
5. **7.1** — E2E test (L) — подтверждение работоспособности
6. **8.1** — Security audit (L) — блокирует production release

### Рекомендации по ускорению

- Начать Phase 4 (UI каркас) сразу после 1.4 (auth routes), не ждать весь Phase 1
- Phase 3 (Caddy) может разрабатываться параллельно с Phase 2 (Deploy Engine)
- Phase 5 и Phase 6 — параллельно (разные разработчики / разные дни)

---

## 13. Общая оценка сложности

### Сводная таблица по фазам

| Фаза | Название | S | M | L | XL | Всего задач |
|:----:|----------|:-:|:-:|:-:|:--:|:-----------:|
| 0 | Инициализация | 3 | 5 | 2 | 0 | 11 |
| 1 | API-сервер | 2 | 7 | 2 | 0 | 11 |
| 2 | Deploy Engine | 2 | 4 | 1 | 1 | 9* |
| 3 | Proxy Manager | 2 | 2 | 1 | 0 | 5 |
| 4 | UI: каркас | 1 | 4 | 2 | 0 | 8* |
| 5 | UI: Dashboard | 0 | 3 | 1 | 1 | 5 |
| 6 | UI: деплой/логи | 1 | 4 | 0 | 1 | 7* |
| 7 | Интеграция | 0 | 3 | 2 | 0 | 5 |
| 8 | Hardening | 1 | 3 | 2 | 0 | 6 |
| **Итого** | | **12** | **35** | **13** | **3** | **67** |

*Примечание: некоторые задачи имеют дробное число файлов на доработку*

### Оценка трудозатрат

| Complexity | Часов (оценка) | Количество | Итого часов |
|:----------:|:--------------:|:----------:|:-----------:|
| S (< 1ч) | ~0.5 | 12 | ~6 |
| M (1–3ч) | ~2 | 35 | ~70 |
| L (3–8ч) | ~5 | 13 | ~65 |
| XL (8ч+) | ~10 | 3 | ~30 |
| **Итого** | | **67** | **~171 часов** |

### Распределение по типам

| Тип | Задач | % |
|-----|:-----:|:-:|
| Backend | 30 | 45% |
| Frontend | 25 | 37% |
| Infra / DevOps | 7 | 10% |
| Testing / Docs | 5 | 8% |

---

## 14. Чеклист готовности к продакшену

> Все пункты должны быть выполнены перед тегом `v0.1.0`.

### Функциональность

- [x] Setup wizard работает на чистом VDS
- [x] Login/logout, сессии, rate-limiting
- [x] CRUD проектов (create, read, update, delete)
- [x] Framework detection (11 фреймворков)
- [x] Deploy полный pipeline: git → build → rsync → restart → health check
- [x] SSE-стриминг логов деплоя
- [x] Deploy history
- [x] Rollback к предыдущему коммиту
- [x] Env-переменные (CRUD, шифрование, маскировка)
- [x] Caddy: домены, авто-SSL, DNS-верификация
- [x] Системные метрики (CPU, RAM, Disk)
- [x] Journalctl-логи через UI
- [x] Per-project deploy mutex (no parallel deploys)

### Безопасность

- [x] Zod-валидация на всех API-маршрутах
- [x] HMAC-SHA256 сессии с TTL 24ч
- [x] Rate-limiting (auth: 5/min, API: 100/min)
- [x] AES-256-GCM шифрование секретов в БД
- [x] npm ci --ignore-scripts при сборке
- [x] cgroups-изоляция проектов (CPUQuota, MemoryMax)
- [x] Security headers (X-Content-Type-Options, X-Frame-Options, CSP)
- [x] CSRF-защита (SameSite cookie + Origin check)

### Производительность

- [x] API latency (median) < 100ms
- [x] Dashboard TTI < 2 секунды
- [x] Deploy Astro SSR < 60 секунд
- [x] Idle RSS < 100MB
- [x] SQLite WAL-режим с оптимальными PRAGMA

### Надёжность

- [x] Validate-before-apply для Caddy конфигов
- [x] Ошибка сборки → runtime не затронут
- [x] Orphaned deploy locks очищаются при старте
- [x] FrostDeploy systemd unit: Restart=on-failure
- [x] BД backup API работает

### Качество кода

- [x] ESLint — 0 ошибок
- [x] TypeScript strict — 0 ошибок
- [x] Vitest — все тесты проходят
- [x] E2E тест: add → deploy → verify passing

### Документация и деплой

- [x] README.md с quickstart
- [ ] install.sh скрипт протестирован на Ubuntu 22.04
- [x] .env.example с описанием всех переменных
- [x] systemd unit для FrostDeploy

### Миграция

- [ ] LaVillaPine успешно мигрирован на FrostDeploy
- [ ] SFOTKAI успешно мигрирован на FrostDeploy
- [ ] Оба проекта работают стабильно 24+ часа

---

## Примечания по согласованности (Reconciliation Notes)

### Проверка покрытия PRD

Все 12 функций MVP (PRD раздел 7.1) имеют соответствующие задачи:

| MVP-функция | Фазы покрытия |
|-------------|---------------|
| Мастер установки | 1.5, 4.7, 7.4 |
| Аутентификация | 1.3, 1.4, 4.4, 4.6 |
| Добавление проекта | 1.6, 5.2, 7.3 |
| Автоопределение | 1.7 |
| Настройка домена | 3.1–3.5, 7.2 |
| Деплой по коммиту | 2.1–2.7 |
| Список коммитов | 1.9, 5.3, 6.3 |
| Откат | 2.8, 6.7 |
| Env-переменные | 1.6, 5.2, 6.4 |
| Системные метрики | 1.8, 5.1 |
| Логи сервисов | 1.8, 6.5 |
| История деплоев | 2.7, 6.2 |

### Проверка технологий

Все технологии из TECH-STACK.md используются в задачах: Hono 4 (1.1), Drizzle (0.8), SQLite WAL (0.9), Zod (0.7, 8.1), React 19 (4.1), Tailwind 4 (4.1), shadcn/ui (4.4+), React Router 7 (4.2), TanStack Query 5 (4.3), Vite 6 (4.1), Caddy (3.1–3.5), systemd (2.4), rsync (2.3), Vitest (0.10).

### Проверка БД

Все 6 таблиц из DATABASE.md описаны в 0.8. Все индексы учтены в 8.6. Шифрование секретов — 1.5, 1.6.

### Проверка UI

Все страницы из UI-UX.md покрыты: login (4.4), setup (4.7), dashboard (5.1), project-new (5.2), project-overview (5.3), project-deploys (6.2), deploy-console (6.1), project-env (6.4), project-logs (6.5), project-settings (5.4), settings (5.5).

### Проверка структуры

Все пакеты из PROJECT-STRUCTURE.md: shared (0.6, 0.7), db (0.8, 0.9), server (фаза 1–3), ui (фаза 4–6).
