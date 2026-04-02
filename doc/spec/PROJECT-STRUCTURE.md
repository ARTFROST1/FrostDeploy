---
title: "Project Structure — FrostDeploy"
summary: "Полная структура проекта FrostDeploy: каталоги, файлы, граф зависимостей, конфигурации, соглашения по именованию"
status: Draft
date: 2026-04-01
author: "@artfrost"
sources:
  - PRD.md
  - TECH-STACK.md
  - DATABASE.md
  - UI-UX.md
---

# Project Structure: FrostDeploy

## Содержание

1. [Обзор](#1-обзор)
2. [Корневая структура](#2-корневая-структура)
3. [Пакет `packages/shared`](#3-пакет-packagesshared)
4. [Пакет `packages/db`](#4-пакет-packagesdb)
5. [Серверный пакет `server/`](#5-серверный-пакет-server)
6. [Клиентский пакет `ui/`](#6-клиентский-пакет-ui)
7. [Граф зависимостей](#7-граф-зависимостей)
8. [Конфигурационные файлы](#8-конфигурационные-файлы)
9. [Скрипты](#9-скрипты)
10. [Файловая система на сервере пользователя](#10-файловая-система-на-сервере-пользователя)
11. [Соглашения по именованию](#11-соглашения-по-именованию)
12. [Тестовая структура](#12-тестовая-структура)

---

## 1. Обзор

### Назначение документа

Документ описывает полную файловую структуру проекта FrostDeploy — self-hosted универсальной платформы деплоя. Содержит дерево каталогов каждого пакета, назначение каждого файла и папки, граф зависимостей, конфигурации, скрипты и соглашения.

### Философия структуры

| Принцип | Описание |
|---|---|
| **Explicit > Implicit** | Каждое архитектурное решение задокументировано. Никаких «все и так знают» |
| **DAG-зависимости** | Зависимости между пакетами — строгий направленный ациклический граф без циклов |
| **Single Source of Truth** | Типы — в `shared`, схема БД — в `db`, маршруты API — в `server`, UI-компоненты — в `ui` |
| **Аддитивность** | Миграции БД только добавляются, документация только дополняется |
| **Синхронизированные контракты** | Изменение схемы → обновление типов → маршрутов → UI — в одном коммите |
| **Минимальная вложенность** | Не более 4 уровней вложенности от корня до файла |

### Архитектура

Монорепозиторий на pnpm workspaces с четырьмя пакетами:

- **`packages/shared`** — типы, константы, Zod-валидаторы (лист DAG, ноль зависимостей)
- **`packages/db`** — Drizzle-схема, миграции, клиент SQLite (зависит от `shared`)
- **`server`** — Hono 4 API-сервер (зависит от `shared`, `db`)
- **`ui`** — React 19 SPA (зависит только от `shared`, общается с `server` через HTTP API)

---

## 2. Корневая структура

```
frostdeploy/
├── packages/                       # Переиспользуемые внутренние пакеты
│   ├── shared/                     # Типы, константы, валидаторы (лист DAG)
│   └── db/                         # Drizzle-схема, миграции, клиент SQLite
├── server/                         # Hono API-сервер (backend)
├── ui/                             # React SPA (frontend)
├── doc/                            # Внутренняя документация проекта
│   ├── PRD.md                      # Product Requirements Document
│   ├── TECH-STACK.md               # Технологический стек
│   ├── DATABASE.md                 # Схема базы данных
│   ├── UI-UX.md                    # UI/UX спецификация
│   ├── PROJECT-STRUCTURE.md        # Этот документ
│   ├── docs.json                   # Реестр документации (навигация)
│   └── implementation/             # Планы реализации по фазам
├── scripts/                        # Скрипты автоматизации
│   └── setup-dev.sh               # Настройка dev-окружения (git hooks, .env)
├── pnpm-workspace.yaml             # Определение воркспейсов pnpm
├── package.json                    # Корневой манифест: scripts, devDependencies
├── tsconfig.base.json              # Базовый TypeScript-конфиг (наследуется всеми пакетами)
├── eslint.config.mjs               # ESLint 9 flat config (единый для всего монорепо)
├── .prettierrc                     # Конфигурация Prettier
├── vitest.workspace.ts             # Vitest workspace config (запуск тестов всех пакетов)
├── .env.example                    # Пример переменных окружения для разработки
├── .gitignore                      # Игнорируемые файлы Git
├── AGENTS.md                       # Руководство для AI-агентов и контрибьюторов
├── LICENSE                         # Лицензия MIT
└── README.md                       # Описание проекта, quickstart
```

**Пояснения:**

| Каталог / Файл | Назначение |
|---|---|
| `packages/` | Внутренние библиотеки — чистые, переиспользуемые пакеты без side effects |
| `server/` | Самостоятельный backend-пакет; в продакшене раздаёт собранный `ui/dist` |
| `ui/` | Самостоятельный frontend-пакет; в dev — Vite dev server на отдельном порту |
| `doc/` | Внутренняя документация (PRD, TechStack, DB, UI/UX, Structure, Implementation) |
| `scripts/` | Shell/JS скрипты для автоматизации (настройки, генерации, CI) |
| `AGENTS.md` | Порядок чтения документов, правила для контрибьюторов и AI-агентов |

---

## 3. Пакет `packages/shared`

### Назначение

Лист DAG — пакет с нулевыми внутренними зависимостями. Содержит типы, константы и Zod-валидаторы, используемые **всеми** остальными пакетами. Единственная внешняя зависимость — `zod`.

### Ограничения

- ❌ Никакого I/O (файловая система, сеть, БД)
- ❌ Никаких runtime-зависимостей кроме `zod`
- ✅ Только чистые функции, типы и константы
- ✅ Barrel-экспорт через `index.ts` на каждом уровне

### Дерево файлов

```
packages/shared/
├── src/
│   ├── types/                          # TypeScript-типы всех сущностей
│   │   ├── project.ts                  # Project, ProjectStatus, Framework
│   │   ├── deployment.ts               # Deployment, DeployStatus, DeployStep, TriggeredBy
│   │   ├── env-variable.ts             # EnvVariable (без encrypted_value — только key, isSecret)
│   │   ├── domain.ts                   # Domain, SslStatus
│   │   ├── settings.ts                 # Settings, SettingsKey
│   │   ├── system.ts                   # SystemMetrics (cpu, ram, disk, uptime)
│   │   ├── api.ts                      # ApiResponse<T>, ApiError, PaginatedResponse<T>
│   │   └── index.ts                    # Barrel: re-export всех типов
│   ├── constants/                      # Неизменяемые значения
│   │   ├── frameworks.ts              # FRAMEWORKS: Record<Framework, { buildCmd, startCmd, marker }>
│   │   ├── ports.ts                    # PORT_RANGE_START (4321), PORT_RANGE_END (4399)
│   │   ├── deploy-steps.ts            # DEPLOY_STEPS: ['fetch','checkout','install','build','sync','restart']
│   │   └── index.ts                    # Barrel: re-export всех констант
│   ├── validators/                     # Zod-схемы для валидации данных
│   │   ├── project.ts                  # createProjectSchema, updateProjectSchema, detectRepoSchema
│   │   ├── deployment.ts               # triggerDeploySchema, cancelDeploySchema
│   │   ├── env-variable.ts             # createEnvVarSchema, updateEnvVarsSchema
│   │   ├── auth.ts                     # loginSchema, setupSchema, changePasswordSchema
│   │   └── index.ts                    # Barrel: re-export всех валидаторов
│   └── index.ts                        # Главный barrel: export * из types, constants, validators
├── package.json                        # name: "@fd/shared", dependencies: { zod }
├── tsconfig.json                       # extends ../../tsconfig.base.json
└── vitest.config.ts                    # Тесты валидаторов
```

### Barrel-экспорт

Каждый подкаталог имеет `index.ts`, реэкспортирующий всё содержимое. Потребители импортируют из корня пакета:

```typescript
import { type Project, type Deployment, FRAMEWORKS, createProjectSchema } from '@fd/shared';
```

### package.json

```json
{
  "name": "@fd/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "zod": "^3.24"
  }
}
```

---

## 4. Пакет `packages/db`

### Назначение

Слой данных: Drizzle ORM-схема 6 таблиц, SQL-миграции, фабрика подключения к SQLite, seed-данные. Зависит от `@fd/shared` (типы).

### Дерево файлов

```
packages/db/
├── src/
│   ├── schema/                         # Drizzle-определения таблиц (единая точка правды для БД)
│   │   ├── projects.ts                 # Таблица projects: 17 столбцов, CHECK на status
│   │   ├── deployments.ts              # Таблица deployments: иммутабельная история деплоев
│   │   ├── env-variables.ts            # Таблица env_variables: зашифрованные значения (AES-256-GCM)
│   │   ├── domains.ts                  # Таблица domains: FQDN + SSL-статус
│   │   ├── settings.ts                 # Таблица settings: key-value глобальных настроек
│   │   ├── deploy-locks.ts             # Таблица deploy_locks: per-project мьютекс деплоя
│   │   ├── relations.ts                # Drizzle relations: projects → deployments, env_variables, domains
│   │   └── index.ts                    # Barrel: export всех таблиц и relations
│   ├── migrations/                     # SQL-миграции (автогенерация через drizzle-kit)
│   │   └── 0000_initial.sql            # Первая миграция: CREATE TABLE × 6, индексы
│   ├── client.ts                       # createDb(): фабрика подключения SQLite + WAL PRAGMA
│   ├── seed.ts                         # Seed-данные для dev: 2 проекта, 5 деплоев, env-переменные
│   ├── utils.ts                        # randomHex(bytes) — утилита генерации hex-ID
│   ├── migrate.ts                      # CLI-скрипт запуска миграций (drizzle-orm migrator)
│   └── index.ts                        # Barrel: export { createDb, schema, relations }
├── drizzle.config.ts                   # Конфигурация drizzle-kit: dialect, schema path, out dir
├── package.json                        # name: "@fd/db", deps: drizzle-orm, better-sqlite3, @fd/shared
├── tsconfig.json                       # extends ../../tsconfig.base.json
└── vitest.config.ts                    # Тесты: in-memory SQLite
```

### Ключевые файлы

| Файл | Описание |
|---|---|
| `client.ts` | Создаёт подключение `better-sqlite3` → Drizzle ORM. Устанавливает PRAGMA: `journal_mode=WAL`, `busy_timeout=5000`, `synchronous=NORMAL`, `foreign_keys=ON`, `cache_size=-20000`, `temp_store=MEMORY` |
| `seed.ts` | Генерирует тестовые данные: 2 проекта (Astro SSR, Express API), 5 деплоев, 3 env-переменных. Используется скриптом `pnpm db:seed` |
| `relations.ts` | Декларативные связи Drizzle: `projects` 1→N `deployments`, `projects` 1→N `env_variables`, `projects` 1→N `domains`, `projects` 1→1 `deploy_locks` |
| `utils.ts` | `randomHex(bytes)` — генерация hex-строк для ID сущностей |
| `migrate.ts` | CLI-скрипт запуска миграций через `drizzle-orm/better-sqlite3/migrator` |
| `migrations/` | Только добавление файлов, никогда не редактирование существующих. Каждая миграция — атомарная |

### package.json

```json
{
  "name": "@fd/db",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@fd/shared": "workspace:*",
    "drizzle-orm": "^0.39",
    "better-sqlite3": "^11.8"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30",
    "drizzle-zod": "^0.7",
    "@types/better-sqlite3": "^7.6"
  }
}
```

---

## 5. Серверный пакет `server/`

### Назначение

Hono 4 API-сервер: HTTP-маршруты, бизнес-логика, очередь деплоев, интеграция с systemd/Caddy/git/rsync. В продакшене раздаёт собранный `ui/dist` через `serveStatic()`.

### Архитектура: Routes → Services → DB

| Слой | Знает о | Не знает о |
|---|---|---|
| `routes/` | HTTP (запросы/ответы), Services | SQL, бизнес-правила |
| `services/` | Бизнес-логика, DB | HTTP, запросы/ответы |
| `lib/` | Внешние системы (Caddy, systemd, git) | HTTP, бизнес-логика |
| `queue/` | Оркестрация деплоя, Services | HTTP |

### Дерево файлов

```
server/
├── src/
│   ├── routes/                             # HTTP-обработчики (тонкий слой)
│   │   ├── projects.ts                     # GET /api/projects, POST /api/projects, PUT /api/projects/:id,
│   │   │                                   # DELETE /api/projects/:id, GET /api/projects/:id/commits,
│   │   │                                   # POST /api/projects/detect
│   │   ├── deploys.ts                      # POST /api/projects/:id/deploy, GET /api/projects/:id/deploy/stream (SSE),
│   │   │                                   # GET /api/projects/:id/deployments, GET /api/projects/:id/deployments/:deployId,
│   │   │                                   # POST /api/projects/:id/rollback/:sha,
│   │   │                                   # POST /api/projects/:id/deploys/:deployId/cancel  ⚠️ Phase 3+
│   │   ├── system.ts                       # GET /api/system (CPU, RAM, диск, uptime, версии)
│   │   ├── settings.ts                     # GET /api/settings, PUT /api/settings, POST /api/setup
│   │   ├── auth.ts                         # POST /api/auth/login, POST /api/auth/logout, GET /api/auth/check
│   │   └── index.ts                        # Регистрация всех маршрутов на Hono-приложении
│   │
│   ├── services/                           # Бизнес-логика (фабричные функции)
│   │   ├── project-service.ts              # createProject, deleteProject, updateProject, listProjects
│   │   │                                   # Создание директорий, systemd-юнита, Caddy-конфига
│   │   ├── deploy-service.ts               # executePipeline: fetch → checkout → install → build → sync → restart → health
│   │   │                                   # SSE-стриминг шагов, запись в deployments, управление lock
│   │   ├── proxy-service.ts                # addRoute, removeRoute, getRoutes, checkSslStatus,
│   │   │                                   # verifyDns, verifyDnsWithRetry, getServerIp
│   │   │                                   # Управление Caddy через Admin API (http://localhost:2019)
│   │   ├── system-service.ts               # getMetrics: парсинг /proc/stat, /proc/meminfo, df
│   │   │                                   # getServiceStatus: systemctl status каждого проекта
│   │   ├── git-service.ts                  # cloneRepo, fetchOrigin, checkoutSha, getCommits (GitHub API)
│   │   │                                   # Авторизация через PAT, кеширование коммитов (60 сек)
│   │   ├── detector-service.ts             # detectFramework: анализ package.json, конфиг-файлов
│   │                                       # Возвращает framework, buildCmd, startCmd, outputDir
│   │
│   │   └── settings-service.ts             # Settings CRUD, шифрование чувствительных настроек,
│   │                                       # проверка setup_completed
│   │
│   ├── middleware/                          # Hono middleware
│   │   ├── auth.ts                         # authMiddleware: проверка HMAC-SHA256 cookie, TTL 24ч
│   │   │                                   # Пропускает /api/auth/login, /api/setup
│   │   ├── error-handler.ts                # onError: глобальная обработка, структурированный JSON-ответ
│   │   │                                   # Логирование ошибок, stack trace только в dev
│   │   └── logger.ts                       # Логирование: method, path, status, duration (мс)
│   │
│   ├── lib/                                # Утилиты для работы с внешними системами
│   │   ├── caddy.ts                        # generateRouteConfig(), generateLogConfig(), generateBaseCaddyfile()
│   │   │                                   # validateConfig(), reloadCaddy(), getCaddyStatus()
│   │   │                                   # HTTP-запросы к Caddy Admin API (localhost:2019)
│   │   ├── systemd.ts                      # createUnit(), start(), stop(), restart(), status(), readLogs()
│   │   │                                   # Обёртки для systemctl и journalctl через child_process
│   │   ├── rsync.ts                        # syncFiles(): rsync -a --delete src/dist/ → runtime/
│   │   │                                   # Атомарная синхронизация артефактов сборки
│   │   ├── crypto.ts                       # encrypt(), decrypt() — AES-256-GCM
│   │   │                                   # hashPassword(), verifyPassword() — SHA-256
│   │   │                                   # signSession(), verifySession() — HMAC-SHA256
│   │   ├── sse.ts                          # formatSSEEvent(), createDeployStream()
│   │   │                                   # Утилиты для Server-Sent Events деплоя
│   │   └── exec.ts                         # execCommand(): обёртка child_process.spawn → Promise
│   │                                       # Стриминг stdout/stderr, таймаут, логирование
│   │
│   ├── queue/                              # Очередь деплоев (in-process)
│   │   ├── deploy-queue.ts                 # DeployQueue: Map<projectId, DeployJob>
│   │   │                                   # enqueue() — per-project mutex, HTTP 409 при конфликте
│   │   │                                   # complete() — снятие lock, обновление статуса
│   │   └── deploy-worker.ts                # executeDeployPipeline(): последовательные шаги
│   │                                       # Каждый шаг → SSE-событие + запись в logs
│   │                                       # Таймаут: 10 мин на весь pipeline
│   │
│   ├── templates/                          # EJS-шаблоны для генерации конфигов
│   │   ├── systemd.service.ejs             # Шаблон systemd-юнита: User, WorkingDirectory, ExecStart,
│   │   │                                   # EnvironmentFile, CPUQuota, MemoryMax, Restart=on-failure
│   │   └── caddyfile.ejs                   # Шаблон Caddy-блока: reverse_proxy, encode, log
│   │
│   └── index.ts                            # Точка входа: создание Hono app, регистрация middleware,
│                                           # подключение маршрутов, serveStatic(ui/dist), serve(:9000)
│
├── package.json                            # name: "@fd/server", deps: hono, drizzle-orm, @fd/shared, @fd/db
├── tsconfig.json                           # extends ../../tsconfig.base.json, types: ["node"]
└── vitest.config.ts                        # Тесты: services с in-memory SQLite, routes с supertest
```

### Маршруты API (сводка)

| Метод | Путь | Файл | Описание |
|---|---|---|---|
| POST | `/api/auth/login` | `auth.ts` | Авторизация по паролю → HMAC-cookie |
| POST | `/api/auth/logout` | `auth.ts` | Завершение сессии |
| GET | `/api/auth/check` | `auth.ts` | Проверка статуса аутентификации |
| POST | `/api/setup` | `settings.ts` | Первоначальная настройка (wizard) |
| GET | `/api/settings` | `settings.ts` | Глобальные настройки |
| PUT | `/api/settings` | `settings.ts` | Обновление настроек |
| GET | `/api/projects` | `projects.ts` | Список проектов |
| POST | `/api/projects` | `projects.ts` | Создание проекта |
| GET | `/api/projects/:id` | `projects.ts` | Детали проекта |
| PUT | `/api/projects/:id` | `projects.ts` | Обновление проекта |
| DELETE | `/api/projects/:id` | `projects.ts` | Удаление проекта (каскад) |
| POST | `/api/projects/detect` | `projects.ts` | Автоопределение фреймворка по repo URL |
| GET | `/api/projects/:id/commits` | `projects.ts` | Список коммитов (GitHub API) |
| POST | `/api/projects/:id/deploy` | `deploys.ts` | Запуск деплоя (SHA опционально) |
| GET | `/api/projects/:id/deploy/stream` | `deploys.ts` | SSE-стрим логов активного деплоя |
| GET | `/api/projects/:id/deployments` | `deploys.ts` | История деплоев (пагинация) |
| GET | `/api/projects/:id/deployments/:did` | `deploys.ts` | Детали деплоя + полный лог |
| POST | `/api/projects/:id/rollback/:sha` | `deploys.ts` | Откат к предыдущему SHA |
| POST | `/api/projects/:id/deploys/:did/cancel` | `deploys.ts` | Отмена активного деплоя *(Phase 3+, не реализовано)* |
| GET | `/api/system/logs/:serviceName` | `system.ts` | Логи journalctl сервиса |
| GET | `/api/projects/:id/env` | `projects.ts` | Env-переменные проекта |
| PUT | `/api/projects/:id/env` | `projects.ts` | Обновление env-переменных |
| GET | `/api/system` | `system.ts` | Системные метрики (CPU, RAM, диск) |
| GET | `/health` | `index.ts` | Health check (без аутентификации) |

### package.json

```json
{
  "name": "@fd/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@fd/shared": "workspace:*",
    "@fd/db": "workspace:*",
    "hono": "^4.7",
    "@hono/node-server": "^1.14",
    "@hono/zod-validator": "^0.5",
    "drizzle-orm": "^0.39",
    "better-sqlite3": "^11.8",
    "zod": "^3.24",
    "ejs": "^3.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6",
    "@types/ejs": "^3.1",
    "tsx": "^4.19"
  }
}
```

---

## 6. Клиентский пакет `ui/`

### Назначение

React 19 SPA — дашборд для управления проектами, деплоями, мониторингом. Собирается через Vite, стилизуется Tailwind CSS 4 + shadcn/ui. Общается с `server` исключительно через HTTP API (Hono RPC client).

### Ограничения

- ❌ Не импортирует `@fd/db` (общение с БД только через API)
- ✅ Импортирует только `@fd/shared` (типы, валидаторы, константы)

### Дерево файлов

```
ui/
├── src/
│   ├── pages/                              # Страницы (по одной на маршрут)
│   │   ├── login.tsx                       # /login — авторизация по паролю
│   │   ├── setup.tsx                       # /setup — мастер настройки (3 шага: пароль, PAT, домен)
│   │   ├── dashboard.tsx                   # / — список проектов + MetricCards (CPU, RAM, диск)
│   │   ├── new-project.tsx                 # /projects/new — wizard создания (4 шага: repo, config, env, review)
│   │   ├── project-overview.tsx            # /projects/:id — обзор: статус, домен, коммиты, последний деплой
│   │   ├── project-deploys.tsx             # /projects/:id/deploys — таблица истории деплоев (пагинация)
│   │   ├── deploy-console.tsx              # /projects/:id/deploys/:deployId — SSE-лог в терминальном стиле
│   │   ├── project-env.tsx                 # /projects/:id/env — CRUD переменных окружения
│   │   ├── project-logs.tsx                # /projects/:id/logs — journalctl логи (polling 5 сек)
│   │   ├── project-settings.tsx            # /projects/:id/settings — конфигурация + Danger Zone
│   │   ├── platform-settings.tsx           # /settings — PAT, пароль, информация о сервере
│   │   └── not-found.tsx                   # 404 — страница для несуществующих маршрутов
│   │
│   ├── components/                         # Переиспользуемые компоненты
│   │   ├── ui/                             # shadcn/ui — копируемые примитивы (Radix + Tailwind)
│   │   │   ├── button.tsx                  # Кнопки: primary, secondary, destructive, ghost, outline
│   │   │   ├── card.tsx                    # Контейнер с тенью и скруглением
│   │   │   ├── badge.tsx                   # Метки статусов
│   │   │   ├── table.tsx                   # Таблица: Header, Body, Row, Cell
│   │   │   ├── tabs.tsx                    # Вкладки (навигация внутри страницы проекта)
│   │   │   ├── dialog.tsx                  # Модальные окна (подтверждения, формы)
│   │   │   ├── input.tsx                   # Текстовое поле ввода
│   │   │   ├── select.tsx                  # Выпадающий список
│   │   │   ├── toast.tsx                   # Уведомления (success, error, info)
│   │   │   ├── toaster.tsx                 # Провайдер toast-уведомлений
│   │   │   ├── tooltip.tsx                 # Подсказки при наведении
│   │   │   ├── skeleton.tsx                # Загрузочное состояние (placeholder)
│   │   │   ├── scroll-area.tsx             # Область прокрутки (логи, списки)
│   │   │   ├── separator.tsx               # Горизонтальная и вертикальная линия-разделитель
│   │   │   ├── switch.tsx                  # Переключатель (show/hide secret)
│   │   │   ├── dropdown-menu.tsx           # Контекстное меню
│   │   │   ├── alert.tsx                   # Предупреждения на уровне страницы
│   │   │   └── progress.tsx                # Прогресс-бар (индикатор деплоя)
│   │   │
│   │   ├── status-badge.tsx                # StatusBadge: статус с цветовой кодировкой и пульсацией
│   │   ├── commit-card.tsx                 # CommitCard: SHA, сообщение, автор, кнопка Deploy
│   │   ├── metric-card.tsx                 # MetricCard: иконка, значение, прогресс-бар с порогами
│   │   ├── deploy-log.tsx                  # DeployLog: терминальный эмулятор (чёрный фон, моношрифт, автоскролл)
│   │   ├── deploy-progress.tsx             # DeployProgress: визуальный прогресс 6 шагов pipeline
│   │   ├── project-card.tsx                # ProjectCard: карточка проекта на дашборде (иконка, статус, домен)
│   │   ├── env-var-editor.tsx              # EnvVarEditor: таблица key-value, маскировка секретов, CRUD
│   │   ├── confirm-dialog.tsx              # ConfirmDialog: деструктивные действия, опционально requireTyping
│   │   ├── sidebar.tsx                     # Sidebar: логотип, навигация, динамический список проектов
│   │   ├── sidebar-project-item.tsx        # SidebarProjectItem: проект в sidebar со статусной иконкой
│   │   ├── auth-guard.tsx                  # AuthGuard: проверка setup-status и auth, редиректы
│   │   ├── project-layout.tsx              # ProjectLayout: layout страницы проекта с табами
│   │   └── app-layout.tsx                  # AppLayout: sidebar + main content area + breadcrumbs
│   │
│   ├── api/                                # API-клиент (Hono RPC, типизированный)
│   │   ├── client.ts                       # hc<AppType>('/api') — типобезопасный HTTP-клиент
│   │   ├── projects.ts                     # fetchProjects(), createProject(), updateProject(), deleteProject()
│   │   ├── deploys.ts                      # triggerDeploy(), fetchDeployments(), cancelDeploy()
│   │   ├── system.ts                       # fetchSystemMetrics(), fetchProjectLogs()
│   │   ├── auth.ts                         # login(), logout(), setup()
│   │   └── settings.ts                     # fetchSettings(), updateSettings()
│   │
│   ├── hooks/                              # React-хуки
│   │   ├── use-sse.ts                      # useSSE(url): подписка на SSE-стрим, автореконнект
│   │   ├── use-deploy-status.ts            # useDeployStatus(projectId): текущий деплой проекта
│   │   ├── use-system-metrics.ts           # useSystemMetrics(): polling метрик каждые 10 сек
│   │   └── use-sidebar.ts                  # useSidebar(): управление состоянием sidebar (open/collapsed/hidden)
│   │
│   ├── lib/                                # Утилиты
│   │   ├── utils.ts                        # cn() = clsx + tailwind-merge; formatRelativeTime(); formatDuration(); truncate(); shortSha()
│   │   └── constants.ts                    # POLLING_INTERVALS, FRAMEWORK_ICONS, STATUS_COLORS, STATUS_TEXT_COLORS
│   │
│   ├── styles/                             # Стили
│   │   └── globals.css                     # @import "tailwindcss"; CSS-переменные (--background, --accent, etc.)
│   │
│   ├── router.tsx                          # React Router 7: createBrowserRouter, определение всех маршрутов
│   ├── app.tsx                             # <QueryClientProvider> + <RouterProvider>
│   └── main.tsx                            # ReactDOM.createRoot → <App />
│
├── index.html                              # HTML-шаблон Vite: <div id="root">, шрифты Inter + JetBrains Mono
├── vite.config.ts                          # plugins: react, tailwind; server.proxy: /api → localhost:9000
├── components.json                         # Конфигурация shadcn/ui: стиль, путь компонентов, алиасы
├── package.json                            # name: "@fd/ui", deps: react, react-router, tanstack-query, hono
├── tsconfig.json                           # extends ../../tsconfig.base.json, jsx: react-jsx, lib: DOM
└── vitest.config.ts                        # Тесты компонентов + хуков
```

### Маршруты (сводка из UI-UX.md)

| Маршрут | Страница | Layout |
|---|---|---|
| `/login` | `login.tsx` | Full-screen (без sidebar) |
| `/setup` | `setup.tsx` | Full-screen (без sidebar) |
| `/` | `dashboard.tsx` | AppLayout (sidebar + content) |
| `/projects/new` | `new-project.tsx` | AppLayout |
| `/projects/:id` | `project-overview.tsx` | AppLayout + Tabs |
| `/projects/:id/deploys` | `project-deploys.tsx` | AppLayout + Tabs |
| `/projects/:id/deploys/:deployId` | `deploy-console.tsx` | AppLayout |
| `/projects/:id/env` | `project-env.tsx` | AppLayout + Tabs |
| `/projects/:id/logs` | `project-logs.tsx` | AppLayout + Tabs |
| `/projects/:id/settings` | `project-settings.tsx` | AppLayout + Tabs |
| `/settings` | `platform-settings.tsx` | AppLayout |

### package.json

```json
{
  "name": "@fd/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@fd/shared": "workspace:*",
    "react": "^19.1",
    "react-dom": "^19.1",
    "react-router": "^7.5",
    "@tanstack/react-query": "^5.68",
    "hono": "^4.7",
    "clsx": "^2.1",
    "tailwind-merge": "^3.0",
    "lucide-react": "^0.475"
  },
  "devDependencies": {
    "vite": "^6.2",
    "@vitejs/plugin-react": "^4.4",
    "tailwindcss": "^4.1",
    "@tailwindcss/vite": "^4.1",
    "@types/react": "^19.1",
    "@types/react-dom": "^19.1"
  }
}
```

---

## 7. Граф зависимостей

### ASCII DAG

```
                    ┌──────────────────┐
                    │   @fd/shared     │  ← лист DAG: 0 внутренних зависимостей
                    │   types, zod,    │     единственная внешняя: zod
                    │   constants      │
                    └────┬─────────┬───┘
                         │         │
                         │         │
                    ┌────▼────┐    │
                    │  @fd/db │    │
                    │  drizzle│    │
                    │  sqlite │    │
                    └────┬────┘    │
                         │         │
                    ┌────▼────┐    │
                    │@fd/server│   │
                    │  hono   │    │
                    │  API    │    │
                    └────┬────┘    │
                         │    ┌───▼─────┐
                         │    │ @fd/ui  │
                         │    │  react  │
                         │    │  vite   │
                         │    └─────────┘
                         │         ▲
                         │         │ HTTP API (runtime)
                         └─────────┘
                     server раздаёт ui/dist в production
```

### Правила зависимостей

| Правило | Описание |
|---|---|
| `shared` → ничего | Лист графа. Только `zod` как внешняя зависимость |
| `db` → `shared` | Использует типы и константы из `shared` |
| `server` → `shared`, `db` | Использует типы, валидаторы из `shared`; схему и клиент из `db` |
| `ui` → `shared` | Использует типы, валидаторы, константы. **Не импортирует `db`** |
| `ui` ↔ `server` | Только через HTTP API. В dev: Vite proxy. В production: `serveStatic()` |

### Граф в production

```
Node.js процесс (:9000)
├── server/dist/         — API-сервер (Hono)
├── ui/dist/             — статика React SPA (раздаётся Hono serveStatic)
├── packages/db/         — SQLite-клиент (in-process)
└── packages/shared/     — типы (compile-time only)
```

---

## 8. Конфигурационные файлы

### 8.1. pnpm-workspace.yaml

```yaml
packages:
  - "packages/*"
  - "server"
  - "ui"
```

Определяет 4 воркспейса: `packages/shared`, `packages/db`, `server`, `ui`.

### 8.2. package.json (корневой)

```json
{
  "name": "frostdeploy",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "...",
    "build": "...",
    "test": "...",
    "lint": "...",
    "db:migrate": "...",
    "db:seed": "...",
    "db:studio": "..."
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3.0",
    "eslint": "^9.0",
    "prettier": "^3.5",
    "husky": "^9.0",
    "lint-staged": "^15.0",
    "typescript-eslint": "^8.0",
    "eslint-plugin-react": "^7.37",
    "concurrently": "^9.0"
  }
}
```

### 8.3. tsconfig.base.json

Базовый TypeScript-конфиг, наследуемый всеми пакетами:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true
  }
}
```

Каждый пакет дополняет через `"extends": "../../tsconfig.base.json"`:

| Пакет | Дополнения |
|---|---|
| `packages/shared` | `rootDir: ./src`, `outDir: ./dist` |
| `packages/db` | `rootDir: ./src`, `outDir: ./dist`, `types: ["node"]` |
| `server` | `rootDir: ./src`, `outDir: ./dist`, `types: ["node"]` |
| `ui` | `lib: ["ES2022", "DOM", "DOM.Iterable"]`, `jsx: "react-jsx"`, `types: ["vite/client"]` |

### 8.4. eslint.config.mjs

ESLint 9 flat config — единый для всего монорепо:

```javascript
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';

export default tseslint.config(
  tseslint.configs.recommended,
  reactPlugin.configs.flat.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  { ignores: ['**/dist/', '**/node_modules/'] }
);
```

### 8.5. .prettierrc

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

### 8.6. vitest.workspace.ts

```typescript
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/shared/vitest.config.ts',
  'packages/db/vitest.config.ts',
  'server/vitest.config.ts',
  'ui/vitest.config.ts',
]);
```

### 8.7. vite.config.ts (ui/)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:9000',
    },
  },
  build: {
    outDir: 'dist',
  },
});
```

### 8.8. drizzle.config.ts (packages/db/)

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema/index.ts',
  out: './src/migrations',
});
```

### 8.9. .env.example

```bash
# Среда
NODE_ENV=development

# Сервер FrostDeploy
PORT=9000
DATABASE_URL=./data/frostdeploy.db

# GitHub
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Шифрование (генерируется при setup)
ENCRYPTION_KEY=

# Сессия (генерируется при setup)
SESSION_SECRET=
```

### 8.10. .gitignore

```
node_modules/
dist/
*.db
*.db-wal
*.db-shm
.env
.env.local
coverage/
.turbo/
```

### Сводная таблица конфигов

| Файл | Расположение | Назначение |
|---|---|---|
| `pnpm-workspace.yaml` | Корень | Определение воркспейсов монорепо |
| `package.json` | Корень + каждый пакет | Зависимости, скрипты |
| `tsconfig.base.json` | Корень | Базовый TypeScript-конфиг |
| `tsconfig.json` | Каждый пакет | Пакет-специфичный TS-конфиг (`extends base`) |
| `eslint.config.mjs` | Корень | Единый ESLint 9 flat config |
| `.prettierrc` | Корень | Единый стиль форматирования |
| `vitest.workspace.ts` | Корень | Запуск тестов всех пакетов |
| `vitest.config.ts` | Каждый пакет | Пакет-специфичная конфигурация тестов |
| `vite.config.ts` | `ui/` | Сборка фронтенда, proxy, плагины |
| `drizzle.config.ts` | `packages/db/` | Миграции Drizzle: схема, output |
| `components.json` | `ui/` | Конфигурация shadcn/ui |
| `.env.example` | Корень | Пример переменных окружения |
| `.gitignore` | Корень | Игнорируемые файлы |

---

## 9. Скрипты

### Корневые скрипты (package.json)

| Скрипт | Команда | Описание |
|---|---|---|
| `dev` | `concurrently "pnpm --filter @fd/server dev" "pnpm --filter @fd/ui dev"` | Параллельный запуск server (tsx watch) + ui (Vite dev) |
| `build` | `pnpm -r run build` | Сборка всех пакетов (shared → db → server → ui) |
| `test` | `vitest run` | Запуск тестов всех пакетов через workspace config |
| `test:watch` | `vitest` | Тесты в watch-режиме |
| `test:coverage` | `vitest run --coverage` | Тесты с отчётом покрытия |
| `lint` | `eslint .` | Линтинг всего монорепо |
| `lint:fix` | `eslint . --fix` | Линтинг с автофиксом |
| `format` | `prettier --write .` | Форматирование всех файлов |
| `db:generate` | `pnpm --filter @fd/db drizzle-kit generate` | Генерация SQL-миграций из diff схемы |
| `db:migrate` | `pnpm --filter @fd/db drizzle-kit migrate` | Применение миграций к БД |
| `db:seed` | `pnpm --filter @fd/db tsx src/seed.ts` | Заполнение БД тестовыми данными |
| `db:studio` | `pnpm --filter @fd/db drizzle-kit studio` | GUI для просмотра БД (Drizzle Studio) |
| `typecheck` | `pnpm -r run typecheck` | Проверка типов во всех пакетах |
| `prepare` | `husky` | Установка Git-хуков (pre-commit: lint-staged) |

### Порядок сборки

Сборка уважает DAG-зависимости пакетов:

```
1. packages/shared   (0 зависимостей)
2. packages/db       (зависит от shared)
3. server            (зависит от shared, db)
4. ui                (зависит от shared)
```

Шаги 3 и 4 могут выполняться параллельно.

---

## 10. Файловая система на сервере пользователя

### Расположение FrostDeploy

При установке на VDS создаётся следующая структура:

```
/opt/frostdeploy/                           # Код платформы (результат установки)
├── node_modules/                           # Зависимости
├── server/dist/                            # Скомпилированный backend
├── ui/dist/                                # Собранный frontend (статика)
├── packages/                               # Внутренние пакеты
└── package.json

/var/lib/frostdeploy/                       # Данные платформы (персистентные)
├── data.db                                 # SQLite база данных (WAL-режим)
├── data.db-wal                             # WAL-журнал (при активной записи)
├── data.db-shm                             # Shared memory (при WAL)
├── encryption.key                          # Мастер-ключ шифрования (600 permissions)
└── backups/                                # Автобэкапы БД
    └── data-2026-04-01.db                  # Бэкап SQLite (.backup API)
```

### Данные управляемых проектов

```
/var/www/{project}-src/                     # Исходники проекта (git clone)
├── .git/                                   # Git-репозиторий
├── package.json                            # Манифест проекта
├── node_modules/                           # Все зависимости (dev + prod)
├── src/                                    # Исходный код
└── dist/                                   # Артефакты сборки (npm run build)

/var/www/{project}/                         # Runtime-директория (только production)
├── dist/                                   # Синхронизированные артефакты (rsync)
├── package.json                            # Для npm ci --omit=dev
├── node_modules/                           # Только production-зависимости
└── .env                                    # EnvironmentFile для systemd (расшифрованные env vars)
```

**Принцип двух директорий:** сборка в `-src/` никогда не влияет на работающий процесс в runtime-директории. Атомарная синхронизация через `rsync -a --delete` происходит только при успешной сборке.

### systemd-сервисы

```
/etc/systemd/system/
├── frostdeploy.service                     # Основной сервис платформы
│                                           # ExecStart: node /opt/frostdeploy/server/dist/index.js
│                                           # Port: 9000, Restart=on-failure, User=frostdeploy
│
├── frostdeploy-lavillapine.service         # Сервис проекта LaVillaPine
│                                           # ExecStart: node dist/server/entry.mjs
│                                           # Port: 4321, CPUQuota=100%, MemoryMax=512M
│
├── frostdeploy-sfotkai.service             # Сервис проекта SFOTKAI
│                                           # ExecStart: npm start
│                                           # Port: 4322, CPUQuota=100%, MemoryMax=512M
│
└── ...                                     # По одному юниту на каждый управляемый проект
```

### Caddy

```
/etc/caddy/
├── Caddyfile                               # Базовая конфигурация (global options)
│                                           # admin localhost:2019
│                                           # email admin@example.com
│
└── conf.d/                                 # Динамические конфиги (опционально, если файловый подход)
    └── ...                                 # Или: управление через Caddy Admin API (JSON)
```

**Стратегия:** Базовый `Caddyfile` — статичный. Маршруты проектов — через Caddy Admin API (`POST http://localhost:2019/config/...`).

### Сводная таблица путей

| Путь | Назначение | Создаётся при |
|---|---|---|
| `/opt/frostdeploy/` | Код FrostDeploy | Установка (`npx frostdeploy init`) |
| `/var/lib/frostdeploy/data.db` | SQLite БД | Первый запуск |
| `/var/lib/frostdeploy/encryption.key` | Мастер-ключ AES-256 | Setup Wizard |
| `/var/www/{name}-src/` | Исходники проекта | Создание проекта |
| `/var/www/{name}/` | Runtime проекта | Создание проекта |
| `/etc/systemd/system/frostdeploy.service` | Сервис платформы | Установка |
| `/etc/systemd/system/frostdeploy-{name}.service` | Сервис проекта | Создание проекта |
| `/etc/caddy/Caddyfile` | Базовый конфиг Caddy | Установка |

---

## 11. Соглашения по именованию

### Файлы и каталоги

| Категория | Формат | Пример |
|---|---|---|
| Каталоги | `kebab-case` | `deploy-locks/`, `env-var-editor/` |
| Файлы TypeScript | `kebab-case.ts` | `project-service.ts`, `deploy-queue.ts` |
| Файлы React-компонентов | `kebab-case.tsx` | `status-badge.tsx`, `metric-card.tsx` |
| Тестовые файлы | `{name}.test.ts` / `{name}.test.tsx` | `project-service.test.ts` |
| Конфигурации | `kebab-case` + специфичное расширение | `drizzle.config.ts`, `vite.config.ts` |
| Шаблоны EJS | `kebab-case.ejs` | `systemd.service.ejs` |
| SQL-миграции | `{NNNN}_{description}.sql` | `0000_initial.sql` |

### TypeScript-код

| Категория | Формат | Пример |
|---|---|---|
| Типы и интерфейсы | `PascalCase` | `Project`, `DeployStatus`, `SystemMetrics` |
| Enum-значения | `PascalCase` (значения `kebab-case`) | `type Framework = 'astro-ssr' \| 'nextjs' \| 'nuxt'` |
| Функции | `camelCase` | `createProject()`, `verifyDns()`, `hashPassword()` |
| Фабричные функции | `camelCase` с суффиксом цели | `createDb()`, `projectServiceFactory()` |
| Переменные | `camelCase` | `projectId`, `commitSha`, `isSecret` |
| Константы | `UPPER_SNAKE_CASE` | `PORT_RANGE_START`, `DEPLOY_STEPS`, `POLLING_INTERVAL` |
| Zod-схемы | `camelCase` + суффикс `Schema` | `createProjectSchema`, `loginSchema` |
| React-компоненты | `PascalCase` | `StatusBadge`, `DeployLog`, `MetricCard` |
| React-хуки | `camelCase` с префиксом `use` | `useSSE()`, `useDeployStatus()` |
| API-функции | `camelCase` с глаголом | `fetchProjects()`, `triggerDeploy()` |

### БД

| Категория | Формат | Пример |
|---|---|---|
| Таблицы | `snake_case`, множественное число | `projects`, `deployments`, `env_variables` |
| Столбцы | `snake_case` | `commit_sha`, `created_at`, `is_secret` |
| Primary Key | `id` (TEXT, 16-символьный hex) | `a1b2c3d4e5f6a7b8` |
| Foreign Key | `{entity_singular}_id` | `project_id`, `deployment_id` |
| Индексы | `idx_{table}_{columns}` | `idx_deployments_project_created` |
| Boolean-столбцы | `is_` префикс, INTEGER (0/1) | `is_secret`, `is_primary`, `is_encrypted` |

### npm-пакеты

| Пакет | Имя | Описание |
|---|---|---|
| `packages/shared` | `@fd/shared` | Типы, константы, валидаторы |
| `packages/db` | `@fd/db` | Drizzle-схема, клиент SQLite |
| `server` | `@fd/server` | Hono API-сервер |
| `ui` | `@fd/ui` | React SPA дашборд |

### systemd-сервисы

| Категория | Формат | Пример |
|---|---|---|
| Сервис платформы | `frostdeploy.service` | `frostdeploy.service` |
| Сервис проекта | `frostdeploy-{name}.service` | `frostdeploy-lavillapine.service` |
| EnvironmentFile | `/var/www/{name}/.env` | `/var/www/lavillapine/.env` |

---

## 12. Тестовая структура

### Стратегия размещения

Тесты размещаются рядом с тестируемым кодом в каталогах `__tests__/`:

```
server/
├── src/
│   ├── services/
│   │   ├── project-service.ts
│   │   ├── deploy-service.ts
│   │   └── __tests__/
│   │       ├── project-service.test.ts     # Unit-тесты бизнес-логики проектов
│   │       └── deploy-service.test.ts      # Unit-тесты pipeline деплоя (mock child_process)
│   ├── routes/
│   │   ├── projects.ts
│   │   └── __tests__/
│   │       └── projects.test.ts            # Integration-тесты API-эндпоинтов
│   ├── lib/
│   │   ├── crypto.ts
│   │   └── __tests__/
│   │       └── crypto.test.ts              # Unit-тесты шифрования, хеширования
│   └── middleware/
│       └── __tests__/
│           └── auth.test.ts                # Unit-тесты middleware авторизации

packages/shared/
├── src/
│   └── validators/
│       ├── project.ts
│       └── __tests__/
│           └── project.test.ts             # Unit-тесты Zod-валидаторов

packages/db/
├── src/
│   ├── schema/
│   │   └── __tests__/
│   │       └── schema.test.ts              # Тесты: миграции создают корректные таблицы
│   └── __tests__/
│       └── client.test.ts                  # Тесты: подключение, WAL PRAGMA, CRUD

ui/
├── src/
│   ├── components/
│   │   ├── __tests__/
│   │   │   ├── status-badge.test.tsx       # Тесты рендеринга компонентов
│   │   │   └── deploy-log.test.tsx         # Тесты автоскролла, SSE-обновлений
│   │   └── ...
│   └── hooks/
│       └── __tests__/
│           └── use-sse.test.ts             # Тесты SSE-хука: подключение, реконнект
```

### Соглашения по тестам

| Правило | Описание |
|---|---|
| Имя файла | `{module}.test.ts` или `{module}.test.tsx` |
| Расположение | `__tests__/` рядом с тестируемым модулем |
| Фреймворк | Vitest (совместим с Jest API) |
| БД в тестах | In-memory SQLite (`:memory:`) — чистая БД для каждого теста |
| Тесты services | Реальная in-memory БД, мокированные child_process и fetch |
| Тесты routes | Integration: полный HTTP-запрос через Hono `app.request()` |
| Тесты UI | `@testing-library/react` для компонентов, `vi.mock` для API |
| Покрытие | `@vitest/coverage-v8`, цель ≥ 80% для services и validators |

### Тестовая пирамида MVP

```
          ┌──────────┐
          │   E2E    │  ← v0.2 (Playwright: полные сценарии в браузере)
          ├──────────┤
        ┌─┤Integration├─┐  ← routes + services + in-memory DB
        │ └──────────┘ │
      ┌─┤    Unit      ├─┐  ← validators, crypto, services (mocked deps)
      │ └──────────────┘ │
      └──────────────────┘
```

---

## Примечания по согласованности (Reconciliation Notes)

### Структура vs TechStack

- TechStack.md использует `packages/server/` и `packages/web/` внутри `packages/`. В данном документе `server/` и `ui/` вынесены на верхний уровень для удобства навигации, при этом `pnpm-workspace.yaml` включает оба паттерна: `"packages/*"` + `"server"` + `"ui"`.
- TechStack использует scope `@fd/` для пакетов — сохранён.

### Компоненты vs UI-UX

- Все компоненты из UI-UX.md (StatusBadge, CommitCard, MetricCard, DeployLog, ProjectCard, EnvVarEditor, ConfirmDialog, SidebarProjectItem) имеют соответствующие файлы в `ui/src/components/`.
- Добавлены инфраструктурные компоненты: `app-layout.tsx`, `sidebar.tsx`, `deploy-progress.tsx`, `toaster.tsx`.

### Маршруты vs UI-UX

- Все 11 маршрутов из UI-UX.md (login, setup, dashboard, project-new, project-overview, project-deploys, deploy-console, project-env, project-logs, project-settings, settings) имеют соответствующие файлы в `ui/src/pages/`.

### Таблицы vs DatabaseSchema

- Все 6 таблиц из DATABASE.md (projects, deployments, env_variables, domains, settings, deploy_locks) имеют соответствующие файлы в `packages/db/src/schema/`. Добавлен `relations.ts` для Drizzle-связей.

### Модули vs PRD

- Dashboard (FR-100—102) → `dashboard.tsx` + `metric-card.tsx` + `project-card.tsx`
- Project Management (FR-200—207) → `project-service.ts` + `projects.ts` (routes)
- Deploy Engine (FR-300—307) → `deploy-service.ts` + `deploy-queue.ts` + `deploy-worker.ts`
- Proxy Manager (FR-400—404) → `proxy-service.ts` + `caddy.ts` *(⚠️ Phase 3 — файлы ещё не созданы)*
- Monitoring (FR-500—502) → `system-service.ts` + `system.ts` (routes)
- Auth (FR-600—603) → `auth.ts` (routes) + `auth.ts` (middleware) + `crypto.ts`
- Setup Wizard (FR-700—702) → `setup.tsx` + `settings.ts` (routes)

---

## Статистика структуры

| Метрика | Значение |
|---|---|
| Всего каталогов | 33 |
| Всего файлов | 131 |
| **Итого (каталоги + файлы)** | **164** |

**Разбивка по пакетам:**

| Пакет | Каталоги | Файлы |
|---|---|---|
| Корень проекта | 5 | 12 |
| `packages/shared` | 4 | 19 |
| `packages/db` | 3 | 14 |
| `server` | 7 | 30 |
| `ui` | 9 | 56 |
| `doc/` | 1 | — |
| `scripts/` | 1 | — |
