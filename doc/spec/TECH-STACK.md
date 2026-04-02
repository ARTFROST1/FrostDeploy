---
title: "TechStack — FrostDeploy"
summary: "Технологический стек self-hosted универсальной платформы деплоя FrostDeploy: runtime, фреймворки, БД, инфраструктура, DevOps"
status: Draft
date: 2026-03-31
author: "@artfrost"
sources:
  - PRD.md
  - ../DEPLOY-PLATFORM-RESEARCH.md
  - ../COMPETITORS-CODE-ANALYSIS.md
---

# TechStack: FrostDeploy

## Содержание

1. [Обзор](#1-обзор)
2. [Принципы выбора технологий](#2-принципы-выбора-технологий)
3. [Серверная часть (Backend)](#3-серверная-часть-backend)
4. [Клиентская часть (Frontend)](#4-клиентская-часть-frontend)
5. [Инфраструктура](#5-инфраструктура)
6. [Мульти-языковая поддержка](#6-мульти-языковая-поддержка)
7. [Безопасность](#7-безопасность)
8. [DevOps и сборка](#8-devops-и-сборка)
9. [Граф зависимостей пакетов](#9-граф-зависимостей-пакетов)
10. [Таблица всех зависимостей](#10-таблица-всех-зависимостей)
11. [Альтернативы и отвергнутые решения](#11-альтернативы-и-отвергнутые-решения)

---

## 1. Обзор

### Назначение документа

Документ фиксирует полный технологический стек FrostDeploy — self-hosted платформы деплоя для инди-разработчиков. Содержит финальный выбор технологий для каждого слоя, обоснование решений, матрицу совместимости версий и полный список зависимостей.

### Архитектурный контур

```
┌─────────────────────────────────────────────────────────────────┐
│                          VDS Server                             │
│                                                                 │
│  ┌──────────────────────────┐    ┌───────────────────────────┐  │
│  │   FrostDeploy :9000      │    │         Caddy 2.9         │  │
│  │   (Node.js 22 + SQLite)  ├───►│   domain → 127.0.0.1:X   │  │
│  │                          │    │   auto-SSL (ACME)         │  │
│  │  ┌────────┐  ┌────────┐ │    └──────────┬────────────────┘  │
│  │  │React   │  │Hono API│ │               │                    │
│  │  │SPA     │  │        │ │    ┌──────────▼────────────────┐  │
│  │  └────────┘  └───┬────┘ │    │    Управляемые проекты    │  │
│  │              ┌────▼────┐ │    │  ┌──────────┐             │  │
│  │              │ Build   │ │    │  │ App A    │ :4321       │  │
│  │              │ Engine  │─┼───►│  │ (systemd)│             │  │
│  │              │ + Queue │ │    │  ├──────────┤             │  │
│  │              └────┬────┘ │    │  │ App B    │ :4322       │  │
│  │              ┌────▼────┐ │    │  │ (systemd)│             │  │
│  │              │ SQLite  │ │    │  └──────────┘             │  │
│  │              │ (WAL)   │ │    └───────────────────────────┘  │
│  │              └─────────┘ │                                    │
│  └──────────────────────────┘                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Ключевые NFR из PRD

| Требование | Цель |
|---|---|
| Время отклика API (медиана) | < 100 мс |
| TTI дашборда | < 2 секунды |
| RSS процесса (idle) | < 100 MB |
| Минимальные ресурсы сервера | 1 CPU / 1 GB RAM / 20 GB SSD |
| Размер БД (6 мес, 5 проектов × 100 деплоев) | < 50 MB |
| Время деплоя Astro SSR проекта | < 60 секунд |

---

## 2. Принципы выбора технологий

### Критерии отбора

| # | Принцип | Описание | Пример применения |
|---|---|---|---|
| 1 | **Минимальные ресурсы** | Платформа работает на бюджетном VDS (1 CPU / 1 GB); каждый мегабайт на счету | SQLite вместо PostgreSQL; нет Redis |
| 2 | **Zero-config** | Технология должна работать без внешних зависимостей и сложной настройки | SQLite вместо PG; Caddy вместо Nginx + Certbot |
| 3 | **Production-ready** | Только стабильные LTS/stable-релизы; никаких canary/beta | Node.js 22 LTS; React 19 stable |
| 4 | **TypeScript-first** | Весь кодовая база — TypeScript; типы из коробки или через DefinitelyTyped | Hono (TS-native); Drizzle (TS-native) |
| 5 | **Единый рантайм** | Платформа работает на том же Node.js, что и деплоимые приложения | Одна установка Node.js на сервер |
| 6 | **Минимум абстракций** | Предпочтение инструментам с простым API; без магии и implicit behavior | Hono вместо NestJS; Drizzle вместо TypeORM |
| 7 | **Battle-tested паттерны** | Архитектурные решения, проверенные в LaVillaPine, SFOTKAI, Coolify и CapRover | Модель двух директорий; systemd cgroups; Caddy Admin API |

### Правило выбора

> Если технология A тяжелее технологии B, но не даёт критического преимущества для нашего масштаба (1 сервер, 1 пользователь, ≤79 проектов) — выбираем B.

---

## 3. Серверная часть (Backend)

### 3.1. Runtime — Node.js 22 LTS

| Параметр | Значение |
|---|---|
| **Технология** | Node.js |
| **Версия** | 22 LTS (22.x) |
| **Статус** | Принятое решение |
| **Документация** | https://nodejs.org/docs/latest-v22.x/api/ |

**Обоснование:**

1. **Единый рантайм** — FrostDeploy управляет Node.js-проектами; использование того же рантайма минимизирует зависимости на сервере.
2. **LTS до апреля 2027** — стабильная поддержка на весь цикл разработки MVP и v0.2.
3. **Производительность** — V8 с JIT, достаточная для ≤79 проектов на одном сервере.
4. **Экосистема** — npm содержит все необходимые пакеты для работы с systemd, файловой системой, процессами.
5. **Совместимость** — все целевые фреймворки (Astro, Next.js, Nuxt, SvelteKit) работают на Node.js.

**Почему не Node.js 20:** Node.js 22 — актуальный LTS с EOL в апреле 2027. Node.js 20 (EOL апрель 2026) близок к завершению поддержки; начинать проект на нём нерационально.

### 3.2. API-фреймворк — Hono

**Финальный выбор: Hono 4.x**

| Критерий | Hono 4.x | Fastify 5.x | Победитель |
|---|---|---|---|
| **Размер бандла** | ~14 KB (core) | ~2 MB (с зависимостями) | Hono |
| **TypeScript** | Нативный, написан на TS | Нативные типы, но JS-ядро | Hono |
| **Типизация роутов** | End-to-end type safety (RPC) | Через JSON Schema / TypeBox | Hono |
| **Middleware** | Встроенные: cors, logger, cookie, jwt, csrf | Экосистема плагинов | Ничья |
| **SSE-поддержка** | Встроенный `streamSSE()` хелпер | Через `@fastify/sse` плагин | Hono |
| **Статический файл-сервер** | `serveStatic()` middleware | `@fastify/static` плагин | Ничья |
| **Скорость** | ~150k req/s (Node.js) | ~75k req/s (Node.js) | Hono |
| **Валидация** | Zod-middleware из коробки | Ajv + TypeBox | Hono (для нашего стека) |
| **Зрелость** | v4 (2024), активное развитие | v5 (2024), 10+ лет в продакшене | Fastify |
| **Экосистема плагинов** | Растёт, но меньше Fastify | Обширная, 200+ плагинов | Fastify |
| **Мульти-рантайм** | Bun, Deno, Cloudflare Workers, Node.js | Только Node.js | Hono |
| **Обслуживание SPA** | Статика + fallback на index.html | Статика + rewrite | Ничья |

**Обоснование выбора Hono:**

1. **SSE из коробки** — критично для real-time логов деплоя (FR-303). `streamSSE()` в Hono — натуральный API без дополнительных пакетов.
2. **End-to-end type safety** — Hono RPC позволяет клиенту получать типы API без codegen. При React SPA + Hono backend — полная типизация от API до компонента.
3. **Минимальный footprint** — 14 KB core c переводе на нашу NFR (< 100 MB idle RSS).
4. **Zod-интеграция** — `@hono/zod-validator` валидирует запросы с теми же Zod-схемами, что используются для SQLite (Drizzle + Zod).
5. **Простота** — для API с ~16 эндпоинтами (PRD FR-эндпоинты) Hono минимальнее Fastify.

**Компромисс:** Fastify более зрелый (10+ лет, миллионы скачиваний). Hono моложе, но активно развивается (52k+ GitHub stars, CloudFlare/Vercel backing). Для нашего масштаба зрелость Fastify избыточна, а преимущества Hono (SSE, типы, размер) критичны.

**Установка:**
```bash
pnpm add hono @hono/node-server @hono/zod-validator
```

### 3.3. База данных — SQLite (WAL-режим)

| Параметр | Значение |
|---|---|
| **Технология** | SQLite |
| **Режим** | WAL (Write-Ahead Logging) |
| **Драйвер** | better-sqlite3 (через Drizzle) |
| **Статус** | Принятое решение |

**Обоснование vs PostgreSQL:**

| Критерий | SQLite (WAL) | PostgreSQL | Для FrostDeploy |
|---|---|---|---|
| Установка | Встроен в пакет npm | Отдельный сервис + конфигурация | SQLite ✓ |
| RAM (idle) | 0 MB (in-process) | ~50–100 MB | SQLite ✓ |
| Concurrent reads | ✅ (WAL-режим) | ✅ | Ничья |
| Concurrent writes | Один writer (достаточно) | Множество | Ничья (1 сервер) |
| Транзакции | ACID | ACID | Ничья |
| Бекапы | `.backup` API, cp файла | `pg_dump`, потоковая репликация | SQLite проще |
| Масштаб | До ~1 TB / миллионы строк | Петабайты | SQLite достаточно |
| Индексы | B-Tree | B-Tree, GIN, GiST, BRIN | SQLite достаточно |
| JSON-запросы | `json_extract()` | `jsonb`, мощные операторы | PostgreSQL лучше |
| Full-text search | FTS5 | tsvector | Ничья |

**Для FrostDeploy** (5–79 проектов, ≤100 деплоев/проект): SQLite покрывает все потребности без overhead'a PostgreSQL. Coolify требует PostgreSQL из-за multi-server, multi-tenant, 200+ таблиц — у нас 3 таблицы.

**Конфигурация WAL:**
```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -20000;   -- 20 MB кеш
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;
```

### 3.4. ORM / Query Builder — Drizzle ORM

**Финальный выбор: Drizzle ORM 0.39.x**

| Критерий | Drizzle ORM | better-sqlite3 (raw) | Kysely | Победитель |
|---|---|---|---|---|
| **Type safety** | Полный: схема → типы → запросы | Нет (требуется ручная типизация) | Полный | Drizzle / Kysely |
| **Схема как код** | TS-файлы → SQL миграции | Ручной SQL | TS-типы, но нет генерации схем | Drizzle |
| **Миграции** | `drizzle-kit` (автогенерация) | Ручные SQL-файлы | Ручные + хелперы | Drizzle |
| **Zod-интеграция** | `drizzle-zod` — схема → Zod-типы | Нет | Нет | Drizzle |
| **SQL-контроль** | SQL-like API + raw SQL | Полный контроль | SQL-like API + raw SQL | Ничья |
| **Overhead** | Минимальный (~50 KB) | Нулевой | Минимальный (~30 KB) | better-sqlite3 |
| **DX** | Отличный: авто-миграции, studio | Простой, но ручной | Хороший | Drizzle |
| **SQLite-поддержка** | Первоклассная (через better-sqlite3) | Нативная | Первоклассная | Ничья |

**Обоснование выбора Drizzle:**

1. **Единые типы от БД до API** — Drizzle-схема генерирует TypeScript-типы и Zod-валидаторы. Один `projects` table = тип `Project` + Zod `insertProjectSchema`. Это попадает в Hono-валидацию без дублирования.
2. **Автоматические миграции** — `drizzle-kit generate` создаёт SQL-миграции из diff'а схемы. Не нужно писать миграции вручную.
3. **better-sqlite3 под капотом** — Drizzle использует `better-sqlite3` как драйвер для SQLite, получая его производительность (синхронный API, zero-copy).
4. **Минимальный overhead** — в отличие от TypeORM/Prisma, Drizzle не добавляет тяжёлый рантайм.

**Почему не raw better-sqlite3:** Для 3 таблиц raw SQL работает, но при росте схемы (v0.2+: webhooks, audit_log, templates) отсутствие типизации и мигратора станет болью.

**Почему не Kysely:** Kysely — отличный query builder, но Drizzle даёт больше: схема как код, автомиграции, Zod-интеграция. Для нашего фулл-стек TypeScript-проекта Drizzle покрывает больше потребностей.

**Установка:**
```bash
pnpm add drizzle-orm better-sqlite3
pnpm add -D drizzle-kit @types/better-sqlite3
```

### 3.5. Очередь задач деплоя

**Решение: In-process очередь на основе Map + Worker Threads**

Для MVP не нужен Redis / BullMQ. Деплой — это CPU-bound операция (npm ci, npm run build), которая уже выполняется через `child_process.spawn`. Очередь нужна только для:

1. **Per-project mutex** — один деплой на проект одновременно.
2. **Параллельность между проектами** — проекты A и B могут деплоиться одновременно.
3. **Очередь ожидания** — если проект A уже деплоится, новый запрос возвращает HTTP 409.

**Реализация:**

```
DeployQueue (in-process):
├── activeDeploys: Map<projectId, DeployJob>    — текущие деплои
├── enqueue(projectId, sha):
│   ├── Если projectId в activeDeploys → HTTP 409
│   └── Иначе → добавить в activeDeploys → запустить pipeline
├── complete(projectId):
│   └── Удалить из activeDeploys
└── Pipeline выполняется в основном потоке через child_process.spawn
    (сами операции — git, npm, rsync — уже внешние процессы)
```

**Почему не BullMQ:** BullMQ требует Redis или SQLite-адаптер (экспериментальный). Для MVP на одном сервере in-process Map достаточен. При масштабировании (v0.5, multi-server) — миграция на BullMQ с SQLite-бэкендом.

**Почему не Worker Threads для pipeline:** Шаги деплоя (git, npm, rsync, systemctl) — это внешние процессы (`child_process.spawn`), которые итак не блокируют event loop Node.js. Worker Thread добавит сложность маршалинга данных без выигрыша.

### 3.6. Валидация — Zod

| Параметр | Значение |
|---|---|
| **Технология** | Zod |
| **Версия** | 3.24.x |
| **Роль** | Валидация входных данных API, генерация типов из Drizzle-схемы |

**Связка:** Drizzle-схема → `drizzle-zod` → Zod-схема → `@hono/zod-validator` → типизированный API.

```
SQLite table (Drizzle)
       │
       ▼
  Zod schema (drizzle-zod)
       │
       ├── Hono validator (API input)
       ├── TypeScript types (shared)
       └── Frontend form validation
```

**Установка:**
```bash
pnpm add zod
```

---

## 4. Клиентская часть (Frontend)

### 4.1. UI-фреймворк — React

**Финальный выбор: React 19.x**

| Критерий | React 19 | SolidJS 1.9 | Победитель |
|---|---|---|---|
| **Экосистема** | Крупнейшая: тысячи библиотек, компонентов, инструментов | Растущая, но значительно меньше | React |
| **Hono RPC-интеграция** | `@tanstack/react-query` + Hono client = типизированные запросы | TanStack Query для Solid есть, но менее стабилен | React |
| **UI-библиотеки** | shadcn/ui, Radix, Headless UI — wealth of choice | Kobalte (аналог Radix), но меньше выбор | React |
| **Разработчики в команде** | Знакомство глубокое (SFOTKAI использует Solid, но React знаком шире) | Используется в SFOTKAI | Ничья |
| **Bundle size** | ~40 KB (React + ReactDOM, gzip) | ~7 KB (gzip) | Solid |
| **Производительность (рендеринг)** | Virtual DOM, хороший для большинства UI | Fine-grained reactivity, быстрее | Solid |
| **SSR** | Поддержка из коробки (не нужна для SPA) | Поддержка через SolidStart | Ничья |
| **Стабильность API** | React 19 — stable, зрелый API | Solid 2.0 в разработке (потенциальные breaking changes) | React |
| **Найм / контрибьюторы** | Крупнейший пул разработчиков | Нишевый | React |
| **DevTools** | React DevTools — зрелые, полнофункциональные | Solid DevTools — базовые | React |

**Обоснование выбора React:**

1. **Экосистема critical для dashboarb-UI** — FrostDeploy Dashboard включает: таблицы (TanStack Table), графики метрик, markdown-рендеринг логов, real-time обновления. React-экосистема покрывает всё это зрелыми, протестированными библиотеками.
2. **shadcn/ui** — предоставляет production-ready компоненты (Dialog, Table, Form, Toast, Tabs), стилизованные через Tailwind. Для Solid аналога такого уровня нет.
3. **Hono RPC + React Query** — связка `hono/client` + `@tanstack/react-query` даёт end-to-end типизацию от API до компонента с кешированием, инвалидацией, оптимистичными обновлениями.
4. **Стабильность** — React 19 stable; Solid 2.0 в разработке. Для продукта, который должен работать и развиваться год+, стабильность важнее теоретической скорости рендеринга.

**Компромисс:** SolidJS меньше по размеру (7 vs 40 KB) и быстрее в рендеринге. Для админ-дашборда с ~10 маршрутами и ≤1 пользователем одновременно эти преимущества несущественны. Экосистема и DX React перевешивают.

**Установка:**
```bash
pnpm add react react-dom
pnpm add -D @types/react @types/react-dom
```

### 4.2. Стилизация — Tailwind CSS 4.x

| Параметр | Значение |
|---|---|
| **Технология** | Tailwind CSS |
| **Версия** | 4.x |
| **Статус** | Принятое решение |

**Обоснование:** Utility-first CSS; минимальный CSS-бандл (tree-shake неиспользуемых классов); идеальная совместимость с shadcn/ui; TypeScript-config в v4; используется в обоих существующих проектах (LaVillaPine, SFOTKAI).

**Установка:**
```bash
pnpm add -D tailwindcss @tailwindcss/vite
```

### 4.3. UI-компоненты — shadcn/ui

| Параметр | Значение |
|---|---|
| **Технология** | shadcn/ui |
| **Зависимости** | Radix UI primitives + Tailwind CSS |
| **Роль** | Готовые компоненты: Button, Dialog, Table, Form, Toast, Tabs, Card, Badge |

**Обоснование:** shadcn/ui — не npm-пакет, а коллекция копируемых компонентов. Полный контроль над кодом, стилизация через Tailwind, accessibility из коробки (Radix примитивы), zero-runtime overhead.

### 4.4. Роутинг — React Router 7.x

| Параметр | Значение |
|---|---|
| **Технология** | React Router |
| **Версия** | 7.x |
| **Режим** | SPA (client-side routing) |

**Маршруты дашборда:**

```
/login                          — Авторизация
/                               — Dashboard (список проектов + метрики)
/projects/new                   — Создание проекта
/projects/:id                   — Обзор проекта
/projects/:id/deploys           — История деплоев
/projects/:id/deploys/:deployId — Логи деплоя (SSE)
/projects/:id/env               — Переменные окружения
/projects/:id/logs              — Логи сервиса (journalctl)
/projects/:id/settings          — Настройки проекта
/settings                       — Настройки платформы
```

**Установка:**
```bash
pnpm add react-router
```

### 4.5. State Management — TanStack Query

| Параметр | Значение |
|---|---|
| **Технология** | TanStack Query (React Query) |
| **Версия** | 5.x |
| **Роль** | Серверное состояние: кеширование, инвалидация, polling, оптимистичные обновления |

**Обоснование:** Для админ-дашборда 95% состояния — серверное (проекты, деплои, метрики, логи). TanStack Query управляет этим нативно: автоматическое кеширование, интервальный refetch для метрик (каждые 10 сек), инвалидация после мутаций. Отдельный state manager (Zustand, Jotai) не нужен — достаточно React context для UI-состояния (тема, sidebar).

**Связка с Hono RPC:**
```typescript
// Типобезопасный клиент: типы API → типы React-компонентов
const client = hc<AppType>('/api')
const { data } = useQuery({
  queryKey: ['projects'],
  queryFn: () => client.projects.$get().then(r => r.json())
})
// data: Project[] — полная типизация без codegen
```

**Установка:**
```bash
pnpm add @tanstack/react-query
```

### 4.6. Build Tool — Vite

| Параметр | Значение |
|---|---|
| **Технология** | Vite |
| **Версия** | 6.x |
| **Роль** | Сборка фронтенда (dev server + production build) |

**Обоснование:** Стандарт де-факто для React SPA. HMR в dev, оптимизированный build в production (Rollup), поддержка Tailwind v4 через `@tailwindcss/vite`.

**Установка:**
```bash
pnpm add -D vite @vitejs/plugin-react
```

---

## 5. Инфраструктура

### 5.1. Reverse Proxy — Caddy 2.9+

| Параметр | Значение |
|---|---|
| **Технология** | Caddy |
| **Версия** | 2.9+ |
| **Статус** | Принятое решение |
| **Документация** | https://caddyserver.com/docs/ |

**Роль в FrostDeploy:**

1. **Reverse proxy** — маршрутизация доменов на порты проектов (domain.com → 127.0.0.1:4321).
2. **Авто-SSL** — встроенный ACME (Let's Encrypt) без Certbot, без ручной конфигурации.
3. **Сжатие** — gzip/zstd для всех ответов.
4. **Access-логирование** — JSON access log для аналитики трафика (v0.2).
5. **Статический файл-сервер** — для static-проектов (Astro Static, Hugo, Eleventy) Caddy раздаёт файлы напрямую, без Node.js-процесса.

**Сравнение с альтернативами:**

| Критерий | Caddy | Nginx | Traefik |
|---|---|---|---|
| Авто-SSL | ✅ Встроенный ACME | ❌ Нужен Certbot | ✅ Встроенный ACME |
| Конфигурация | Caddyfile / JSON API | nginx.conf (сложный) | YAML/TOML |
| Hot reload | `caddy reload` / Admin API | `nginx -s reload` | File watcher |
| Программное управление | **Admin API (REST)** | Файлы + exec | REST API |
| Footprint | ~20 MB RAM | ~20 MB RAM | ~50 MB RAM |
| JSON-логи | ✅ Нативные | ✅ (log_format json) | ✅ |
| Wildcard SSL | ✅ DNS challenge | ❌ | ✅ DNS challenge |

**Admin API — ключевое преимущество:**

FrostDeploy программно управляет маршрутами Caddy через Admin API, а не через редактирование файлов:

```bash
# Добавить маршрут для проекта
curl -X POST http://localhost:2019/config/apps/http/servers/srv0/routes \
  -H "Content-Type: application/json" \
  -d '{"match":[{"host":["domain.com"]}],"handle":[{"handler":"reverse_proxy","upstreams":[{"dial":"127.0.0.1:4321"}]}]}'

# Валидация: Caddy автоматически валидирует конфиг при POST
# Если невалидный — вернёт ошибку, конфиг не изменится
```

**Стратегия конфигурации (двойная):**

| Режим | Использование |
|---|---|
| **Caddyfile** | Базовая конфигурация (global options, FrostDeploy маршрут) |
| **Admin API (JSON)** | Динамическое добавление/удаление маршрутов проектов |

Это комбинирует читаемость Caddyfile для статической конфигурации и программируемость Admin API для динамических операций.

### 5.2. Управление процессами — systemd

| Параметр | Значение |
|---|---|
| **Технология** | systemd |
| **Статус** | Принятое решение |
| **Требования к ОС** | Ubuntu 22.04+ / Debian 12+ |

**Роли:**

1. **Управление проектами** — каждый проект = один systemd-юнит (`frostdeploy-{name}.service`).
2. **Автоперезапуск** — `Restart=on-failure`: при краше процесса systemd перезапускает его.
3. **Изоляция ресурсов** — cgroups через директивы `CPUQuota`, `MemoryMax`, `MemoryHigh`.
4. **Логирование** — `journalctl -u frostdeploy-{name}` для чтения логов через UI.
5. **Переменные окружения** — `EnvironmentFile` для безопасной передачи env-переменных.

**Шаблон systemd-юнита (EJS):**

```ini
[Unit]
Description=FrostDeploy: <%= name %>
After=network.target

[Service]
Type=simple
User=frostdeploy
Group=frostdeploy
WorkingDirectory=<%= runtimeDir %>
ExecStart=<%= startCmd %>
EnvironmentFile=<%= envFile %>
Restart=on-failure
RestartSec=5
CPUQuota=<%= cpuQuota %>
MemoryMax=<%= memoryMax %>
MemoryHigh=<%= memoryHigh %>

StandardOutput=journal
StandardError=journal
SyslogIdentifier=<%= serviceName %>

[Install]
WantedBy=multi-user.target
```

**Управление:**
```bash
systemctl start frostdeploy-myapp     # Старт
systemctl stop frostdeploy-myapp      # Остановка
systemctl restart frostdeploy-myapp   # Перезапуск (деплой)
systemctl status frostdeploy-myapp    # Статус
journalctl -u frostdeploy-myapp -n 200 --no-pager  # Логи
```

### 5.3. Синхронизация файлов — rsync

| Параметр | Значение |
|---|---|
| **Технология** | rsync |
| **Роль** | Атомарный перенос артефактов сборки из src_dir в runtime_dir |

**Модель двух директорий:**

```
/var/www/{project}-src/     ← git clone, npm ci, npm run build
        │
        │  rsync -a --delete dist/ → runtime/
        ▼
/var/www/{project}/         ← runtime: только production-файлы
```

**Принцип:** Сборка никогда не влияет на работающий процесс. runtime-директория обновляется ТОЛЬКО при успешной сборке. Если сборка упала — runtime остаётся нетронутым.

**Команды:**
```bash
# Копирование артефактов сборки
rsync -a --delete ${srcDir}/dist/ ${runtimeDir}/

# Копирование package.json для production-зависимостей
cp ${srcDir}/package.json ${srcDir}/package-lock.json ${runtimeDir}/

# Установка только production-зависимостей в runtime
cd ${runtimeDir} && npm ci --omit=dev
```

### 5.4. Git — работа с репозиториями

| Параметр | Значение |
|---|---|
| **Технология** | Git (CLI через child_process) |
| **Авторизация** | GitHub PAT (HTTPS clone) |

**Операции:**
```bash
# Первый clone
git clone https://{PAT}@github.com/{owner}/{repo}.git ${srcDir}

# Последующие деплои
cd ${srcDir}
git fetch origin
git checkout ${targetSha}    # Деплой конкретного коммита
# ИЛИ
git pull origin ${branch}    # Деплой последнего коммита ветки
```

**GitHub API (для UI):**
```
GET https://api.github.com/repos/{owner}/{repo}/commits?sha={branch}&per_page=15
Authorization: Bearer {PAT}
```

---

## 6. Мульти-языковая поддержка

### 6.1. Nixpacks — когда и зачем

| Параметр | Значение |
|---|---|
| **Технология** | Nixpacks |
| **Версия** | latest |
| **Роль** | Авто-детекция языка + генерация Docker-образа для не-Node.js проектов |
| **Доступен с** | v0.2 |
| **Требование** | Docker Engine |

**Как работает Nixpacks:**

```
Исходный код проекта
       │
       ▼
 nixpacks build . -o image-name
       │
       ├── Анализ файлов (requirements.txt, go.mod, Cargo.toml...)
       ├── Определение языка и фреймворка
       ├── Генерация оптимального multi-stage Dockerfile
       └── Сборка Docker-образа
       │
       ▼
 docker run -d -p {port}:{containerPort} image-name
```

**Какие языки покрывает Nixpacks:** Node.js, Python, Go, Rust, Ruby, Java, PHP, .NET, Haskell, Zig, Crystal, Elixir, Dart, Swift, Scala, Clojure — 20+ языков.

### 6.2. Нативный путь vs Nixpacks — таблица решений

| Критерий | Нативный путь (Node.js) | Nixpacks путь |
|---|---|---|
| **Когда используется** | `package.json` обнаружен | Нет `package.json` ИЛИ не-JS проект |
| **Требует Docker** | ❌ | ✅ |
| **Скорость деплоя** | Быстрая (нет Docker build) | Медленнее (Docker build + run) |
| **Потребление ресурсов** | Минимальное (нативный процесс) | Выше (Docker container overhead) |
| **Изоляция** | systemd cgroups | Docker container (полная) |
| **Поддерживаемые языки** | Только Node.js + Static | 20+ языков |
| **Кеш зависимостей** | `node_modules` на диске | Docker layer cache |
| **Управление процессом** | systemd | Docker + systemd (для контейнера) |

**Матрица решений по типу проекта:**

| Маркер в проекте | Путь | Стратегия | Версия |
|---|---|---|---|
| `package.json` с Node.js deps | Нативный | npm ci → build → rsync → systemd | v0.1 |
| `package.json` без server deps | Нативный | npm ci → build → Caddy static | v0.1 |
| `requirements.txt` / `pyproject.toml` | Nixpacks | Docker-образ → docker run | v0.2 |
| `go.mod` | Nixpacks | Docker-образ → docker run | v0.3 |
| `Cargo.toml` | Nixpacks | Docker-образ → docker run | v0.4 |
| `composer.json` | Nixpacks | Docker-образ → docker run | v0.4 |
| `Dockerfile` | Docker | docker build → docker run | v0.3 |
| Нет маркеров | Нативный | Caddy static file server (fallback) | v0.1 |

### 6.3. Docker как fallback

Docker не требуется для MVP (v0.1). Устанавливается опционально начиная с v0.2 для мульти-языковой поддержки:

```
v0.1: Node.js + Static         → Docker НЕ нужен
v0.2: + Python (Nixpacks)      → Docker НУЖЕН (если есть Python-проекты)
v0.3: + Go, Dockerfile         → Docker НУЖЕН
v0.4: + Rust, PHP              → Docker НУЖЕН
```

**Принцип:** Docker — инструмент для мульти-языковых проектов. Для Node.js-проектов Docker никогда не используется (нативный путь всегда быстрее и легче).

---

## 7. Безопасность

### 7.1. Аутентификация — HMAC-SHA256 cookie sessions

| Параметр | Значение MVP (v0.1) | Значение v0.2+ |
|---|---|---|
| **Модель** | Single-user (один пароль) | + API tokens |
| **Хранение пароля** | SHA-256 хеш в `settings` | SHA-256 хеш |
| **Сессия** | HMAC-SHA256 подписанная cookie | + Bearer API tokens |
| **TTL** | 24 часа | Настраиваемый |
| **Rate-limit** | 5 попыток/мин/IP | + TOTP 2FA (v0.4) |

**Архитектура сессии:**

```
Login:
  1. POST /api/auth/login { password }
  2. Сервер: SHA-256(password) === stored_hash ?
  3. Да → Set-Cookie: session=HMAC-SHA256(payload, SECRET)
  4. Нет → 401 + rate-limit counter++

Каждый запрос:
  1. Cookie: session={token}
  2. Сервер: HMAC-SHA256.verify(token, SECRET)
  3. Валидный → пропустить
  4. Невалидный / истёк → 401
```

**Проверенный паттерн:** Идентичная схема работает в LaVillaPine (Astro SSR) в production. Web Crypto API (Node.js `crypto` модуль) для HMAC — стандарт без внешних зависимостей.

### 7.2. Шифрование секретов — AES-256-GCM

| Параметр | Значение |
|---|---|
| **Алгоритм** | AES-256-GCM |
| **Что шифруется** | Env-переменные проектов, GitHub PAT |
| **Ключ** | Генерируется при Setup Wizard, хранится в файле вне БД |
| **Реализация** | Node.js `crypto.createCipheriv` / `crypto.createDecipheriv` |

**Хранение в SQLite:**
```
env_vars = AES-256-GCM( JSON.stringify({ DB_URL: "...", API_KEY: "..." }), MASTER_KEY )
```

**Принцип:** Данные зашифрованы at rest. В UI значения отображаются как `•••••••` (маскированы). Расшифровка происходит только при: (1) генерации EnvironmentFile для systemd; (2) передаче в build-процесс.

### 7.3. Изоляция процессов — systemd cgroups

| Механизм | Директива | Описание |
|---|---|---|
| **Ограничение CPU** | `CPUQuota=100%` | Максимум 1 ядро на проект (настраиваемо) |
| **Ограничение RAM** | `MemoryMax=512M` | Hard limit — при превышении OOM killer |
| **Предупреждение RAM** | `MemoryHigh=384M` | Throttling при приближении к лимиту |
| **Непривилегированный юзер** | `User=frostdeploy` | Сборка и рантайм от не-root пользователя |
| **Изоляция temp** | `PrivateTmp=true` | Каждый процесс видит свой /tmp |

**Безопасность сборки:**
```bash
# npm ci с --ignore-scripts предотвращает выполнение postinstall-скриптов
npm ci --ignore-scripts

# Ограничение сети во время сборки (v0.3)
# iptables -A OUTPUT -m owner --uid-owner frostdeploy -j DROP  (кроме npm registry)
```

---

## 8. DevOps и сборка

### 8.1. Монорепозиторий — pnpm workspaces

| Параметр | Значение |
|---|---|
| **Менеджер пакетов** | pnpm 10.x |
| **Структура** | pnpm workspaces (монорепо) |

**Структура проекта:**

```
frostdeploy/
├── pnpm-workspace.yaml
├── package.json              # Корневой: scripts, devDependencies
├── tsconfig.base.json        # Базовый TypeScript-конфиг
│
├── server/                   # Backend: Hono + Drizzle + SQLite
│   ├── package.json
│   ├── tsconfig.json         # extends ../tsconfig.base.json
│   └── src/
│       ├── index.ts
│       ├── lib/
│       ├── routes/
│       ├── services/
│       ├── middleware/
│       ├── queue/
│       └── templates/
│
├── ui/                       # Frontend: React + Vite + Tailwind
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── pages/
│       └── components/
│
├── packages/
│   ├── db/                   # Drizzle-схема, миграции (drizzle-kit)
│   │   ├── package.json
│   │   ├── drizzle.config.ts
│   │   └── src/
│   │
│   └── shared/               # Общие типы, Zod-схемы, утилиты
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│
├── templates/
│   └── systemd.service.ejs
│
└── data/
    └── frostdeploy.db        # SQLite (создаётся при первом запуске)
```

**pnpm-workspace.yaml:**
```yaml
packages:
  - "packages/*"
  - "server"
  - "ui"
```

**Обоснование pnpm по сравнению с npm / yarn:**

| Критерий | pnpm | npm | yarn |
|---|---|---|---|
| Disk usage | Символьные ссылки, дедупликация | Копирование, node_modules раздут | PnP или node_modules |
| Workspaces | ✅ Нативные | ✅ (с v7) | ✅ |
| Скорость установки | Быстрее npm на ~40% | Базовая | Сравнимо с pnpm |
| Strict node_modules | ✅ (предотвращает phantom deps) | ❌ (hoisting проблемы) | ✅ (PnP) |
| Lock-файл | pnpm-lock.yaml | package-lock.json | yarn.lock |

### 8.2. TypeScript Config — наследование

**tsconfig.base.json (корень):**
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
    "sourceMap": true
  }
}
```

**server/tsconfig.json:**
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

**ui/tsconfig.json:**
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vite/client"]
  },
  "include": ["src/**/*"]
}
```

### 8.3. Linting / Formatting

| Инструмент | Версия | Роль | Конфигурация |
|---|---|---|---|
| **ESLint** | 9.x | Линтинг TS/TSX | Flat config (`eslint.config.mjs`) |
| **Prettier** | 3.x | Форматирование | `.prettierrc` |
| **lint-staged** | 15.x | Pre-commit хуки | Только изменённые файлы |
| **husky** | 9.x | Git hooks | Pre-commit: lint + format |

**ESLint flat config:**
```javascript
// eslint.config.mjs
import tseslint from 'typescript-eslint'
import reactPlugin from 'eslint-plugin-react'

export default tseslint.config(
  tseslint.configs.recommended,
  reactPlugin.configs.flat.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    }
  }
)
```

### 8.4. Тестирование — Vitest

| Параметр | Значение |
|---|---|
| **Технология** | Vitest |
| **Версия** | 3.x |
| **Роль** | Unit-тесты, integration-тесты |

**Обоснование:** Vitest совместим с Jest API, но использует Vite для трансформации — нативная поддержка TypeScript, ESM, без дополнительной конфигурации. Для монорепо с Vite-фронтендом — естественный выбор.

**Установка:**
```bash
pnpm add -D vitest
```

**Скрипты:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## 9. Граф зависимостей пакетов

```
                    ┌──────────────────┐
                    │  frostdeploy     │
                    │  (root)          │
                    │  pnpm workspace  │
                    └───────┬──────────┘
                            │
              ┌─────────────┼──────────────┐
              │             │              │
              ▼             ▼              ▼
     ┌────────────┐  ┌───────────┐  ┌──────────┐
     │  server     │  │ ui        │  │ packages/│
     │  (backend)  │  │ (frontend)│  │ shared   │
     └──────┬─────┘  └─────┬─────┘  └─────┬────┘
            │               │              │
            │               │       ┌──────┴──────┐
            │               │       │  zod        │
            │               │       │  (schemas)  │
            │               │       └─────────────┘
            │               │
     ┌──────┴──────┐  ┌────┴────┐
     │ hono        │  │ react   │
     │ @hono/node  │  │ react-  │
     │ @hono/zod   │  │ dom     │
     └──────┬──────┘  ├─────────┤
            │         │ tailwind│
     ┌──────┴──────┐  │ shadcn/ │
     │ drizzle-orm │  │ ui      │
     │ better-     │  ├─────────┤
     │ sqlite3     │  │ react-  │
     └─────────────┘  │ router  │
                      │ tanstack│
                      │ query   │
                      └─────────┘

packages/db:
└── drizzle-kit (миграции)

Общие devDependencies (корень):
├── typescript 5.7+
├── vitest 3.x
├── eslint 9.x
├── prettier 3.x
├── husky 9.x
└── lint-staged 15.x
```

---

## 10. Таблица всех зависимостей

### Backend (`server/`)

| Пакет | Версия | Назначение | Лицензия |
|---|---|---|---|
| `hono` | ^4.7 | HTTP-фреймворк | MIT |
| `@hono/node-server` | ^1.14 | Node.js-адаптер для Hono | MIT |
| `@hono/zod-validator` | ^0.5 | Zod-валидация для Hono | MIT |
| `drizzle-orm` | ^0.39 | ORM / query builder для SQLite | Apache-2.0 |
| `better-sqlite3` | ^11.8 | Нативный SQLite-драйвер (N-API) | MIT |
| `zod` | ^3.24 | Валидация и типизация данных | MIT |
| `ejs` | ^5.0 | Шаблонизация systemd-юнитов | Apache-2.0 |

**Установка:**
```bash
cd server
pnpm add hono @hono/node-server @hono/zod-validator drizzle-orm better-sqlite3 zod ejs
```

### Backend devDependencies (`server/`)

| Пакет | Версия | Назначение | Лицензия |
|---|---|---|---|
| `@types/better-sqlite3` | ^7.6 | TypeScript-типы для better-sqlite3 | MIT |
| `@types/ejs` | ^3.1 | TypeScript-типы для EJS | MIT |
| `@types/node` | ^25.5 | TypeScript-типы для Node.js | MIT |
| `tsx` | ^4.19 | Запуск TypeScript без компиляции (dev) | MIT |

**Установка:**
```bash
cd server
pnpm add -D @types/better-sqlite3 @types/ejs @types/node tsx
```

### Database (`packages/db`)

| Пакет | Версия | Назначение | Лицензия |
|---|---|---|---|
| `drizzle-kit` | ^0.30 | Генерация SQL-миграций из TS-схемы | MIT |

**Установка:**
```bash
cd packages/db
pnpm add -D drizzle-kit
```

### Frontend (`ui/`)

| Пакет | Версия | Назначение | Лицензия |
|---|---|---|---|
| `react` | ^19.1 | UI-библиотека | MIT |
| `react-dom` | ^19.1 | DOM-рендеринг React | MIT |
| `react-router` | ^7.5 | Client-side маршрутизация | MIT |
| `@tanstack/react-query` | ^5.68 | Серверное состояние, кеширование | MIT |
| `hono` | ^4.7 | Hono RPC client (типизированные запросы) | MIT |
| `clsx` | ^2.1 | Утилита для className (shadcn/ui) | MIT |
| `tailwind-merge` | ^3.0 | Merge Tailwind-классов без конфликтов | MIT |
| `lucide-react` | ^0.475 | Иконки (SVG, tree-shakeable) | ISC |

**Установка:**
```bash
cd ui
pnpm add react react-dom react-router @tanstack/react-query hono clsx tailwind-merge lucide-react
```

### Frontend devDependencies (`ui/`)

| Пакет | Версия | Назначение | Лицензия |
|---|---|---|---|
| `vite` | ^6.2 | Bundler / dev server | MIT |
| `@vitejs/plugin-react` | ^4.4 | React-плагин для Vite (JSX, HMR) | MIT |
| `tailwindcss` | ^4.1 | Utility-first CSS | MIT |
| `@tailwindcss/vite` | ^4.1 | Tailwind-плагин для Vite | MIT |
| `@types/react` | ^19.1 | TypeScript-типы для React | MIT |
| `@types/react-dom` | ^19.1 | TypeScript-типы для React DOM | MIT |

**Установка:**
```bash
cd ui
pnpm add -D vite @vitejs/plugin-react tailwindcss @tailwindcss/vite @types/react @types/react-dom
```

### Shared (`packages/shared`)

| Пакет | Версия | Назначение | Лицензия |
|---|---|---|---|
| `zod` | ^3.24 | Общие Zod-схемы (API контракт) | MIT |

### Root devDependencies

| Пакет | Версия | Назначение | Лицензия |
|---|---|---|---|
| `typescript` | ^5.7 | Компилятор TypeScript | Apache-2.0 |
| `vitest` | ^3.1 | Тестирование (unit + integration) | MIT |
| `eslint` | ^9.24 | Линтинг | MIT |
| `typescript-eslint` | ^8.30 | ESLint-правила для TypeScript | MIT |
| `eslint-plugin-react` | ^7.37 | ESLint-правила для React | MIT |
| `prettier` | ^3.5 | Форматирование кода | MIT |
| `husky` | ^9.1 | Git hooks | MIT |
| `lint-staged` | ^15.5 | Lint только изменённых файлов | MIT |

**Установка:**
```bash
# В корне монорепо
pnpm add -D typescript vitest eslint typescript-eslint eslint-plugin-react prettier husky lint-staged
```

---

## 11. Альтернативы и отвергнутые решения

### 11.1. Отвергнутые фреймворки

| Технология | Рассматривалась для | Причина отклонения |
|---|---|---|
| **Express 5** | API-фреймворк | Минималистичный, но нет встроенных типов, нет SSE-хелпера, нет валидации. Каждая фича — отдельный middleware. Hono покрывает всё из коробки. |
| **NestJS** | API-фреймворк | Тяжёлый (Angular-подобная архитектура, DI, декораторы). Для ~16 эндпоинтов — overkill. Hono проще в 10x. |
| **Koa** | API-фреймворк | Хороший, но middleware-стек менее развит чем Hono; нет типизации роутов; нет Zod-интеграции из коробки. |

### 11.2. Отвергнутые базы данных

| Технология | Причина отклонения |
|---|---|
| **PostgreSQL** | Требует отдельного сервиса (50–100 MB RAM idle). Coolify использует PG потому что multi-server, multi-tenant, 200+ таблиц. У FrostDeploy — 3 таблицы, 1 сервер, 1 пользователь. PostgreSQL — пушка по воробьям. |
| **MySQL / MariaDB** | Те же проблемы что PG: отдельный процесс, overhead. Плюс исторически слабее в JSON-операциях и типизации. |
| **Redis** | Coolify использует Redis для очередей (Horizon) и кеша. У нас нет очередей (in-process Map), кеш не нужен (SQLite достаточно быстрая для наших объёмов). |
| **JSON-файлы** | CapRover хранит всё в JSON. Нет транзакций, нет индексов, нет concurrent access, потеря при crash. SQLite решает все эти проблемы при zero-config. |
| **LevelDB / RocksDB** | Key-value store — неудобен для реляционных запросов (JOIN, WHERE, ORDER BY), которые нужны для deployments (фильтрация по проекту, сортировка по дате). |

### 11.3. Отвергнутые ORM / Query Builders

| Технология | Причина отклонения |
|---|---|
| **Prisma** | Тяжёлый рантайм (Rust query engine ~15 MB), медленнее Drizzle для SQLite, требует codegen. |
| **TypeORM** | Избыточен, тяжёлый, исторически нестабильные миграции, устаревающий. |
| **Knex.js** | Хороший query builder, но без type safety. Drizzle даёт то же + типы + миграции. |
| **Raw better-sqlite3** | Работает, но no type safety, no auto-migrations, manual Zod integration. При росте схемы (v0.2+) станет больно. |

### 11.4. Отвергнутые SPA-фреймворки

| Технология | Причина отклонения |
|---|---|
| **SolidJS** | Меньше бандл (7 vs 40 KB), быстрее рендеринг, но: экосистема UI-компонентов значительно беднее; нет shadcn/ui; TanStack Query для Solid менее стабилен; Solid 2.0 в разработке (breaking changes). Для админ-дашборда экосистема важнее скорости рендеринга. |
| **Vue 3** | Хороший фреймворк, но: не используется в текущих проектах; Hono RPC-интеграция слабее; TypeScript-поддержка хуже чем React 19. |
| **Svelte 5** | Runes — новая парадигма, ещё стабилизируется. Экосистема UI-компонентов меньше React. |
| **HTMX + Alpine** | Серверный рендеринг — отличный подход, но: FrostDeploy требует real-time обновлений (SSE-логи, метрики), сложных таблиц (TanStack Table). SPA лучше подходит для интерактивного дашборда. |

### 11.5. Отвергнутые инфраструктурные решения

| Технология | Причина отклонения |
|---|---|
| **Docker-first (как Coolify/CapRover)** | Docker добавляет overhead RAM/CPU/disk; для Node.js-проектов нативная сборка быстрее и проще. Docker добавляется опционально в v0.3 для мульти-языковых проектов. |
| **Nginx + Certbot** | Nginx требует ручной конфигурации SSL (Certbot), сложный conf-синтаксис, нет Admin API. Caddy — auto-SSL, простой Caddyfile, программный Admin API. |
| **Traefik** | Тяжелее Caddy (~50 vs ~20 MB RAM), сложнее в конфигурации. Coolify использует Traefik потому что он интегрирован с Docker labels. У нас нет Docker → Traefik не даёт преимуществ. |
| **PM2** | Менеджер процессов для Node.js. Дублирует функциональность systemd (autorestart, logging). systemd — стандарт Linux, не требует установки, имеет cgroups. PM2 — лишний слой. |
| **BullMQ + Redis** | Мощная очередь задач, но требует Redis. Для MVP с per-project mutex на одном сервере — in-process Map достаточно. BullMQ рассматривается для v0.5 (multi-server). |
| **WebSocket (Socket.IO / ws)** | Для real-time логов. SSE проще: одностороннее соединение, нет handshake, нативный API браузера (EventSource), работает через стандартный HTTP. Для нашего use case (server → client стриминг логов) SSE идеален. |

### 11.6. Сводная таблица решений

| Слой | Выбрано | Альтернатива 1 | Альтернатива 2 | Статус |
|---|---|---|---|---|
| Runtime | Node.js 22 LTS | — | — | ✅ Принято |
| API | **Hono 4** | Fastify 5 | Express 5 | ✅ Валидировано |
| UI | **React 19** | SolidJS 1.9 | Vue 3 | ✅ Валидировано |
| DB | SQLite (WAL) | PostgreSQL | — | ✅ Принято |
| ORM | **Drizzle ORM** | Kysely | better-sqlite3 (raw) | ✅ Валидировано |
| Стилизация | Tailwind CSS 4 | — | — | ✅ Принято |
| Proxy | Caddy 2.9+ | Nginx | Traefik | ✅ Принято |
| Процессы | systemd | PM2 | Docker | ✅ Принято |
| Очередь | In-process Map | BullMQ | — | ✅ Принято (MVP) |
| Real-time | SSE | WebSocket | — | ✅ Принято |
| Auth | HMAC-SHA256 cookie | JWT | — | ✅ Принято |
| Build | child_process + rsync | Docker | — | ✅ Принято |
| Мульти-язык | Nixpacks (v0.2+) | Buildpacks | — | ✅ Принято |
| Тесты | Vitest 3 | Jest | — | ✅ Принято |
| Монорепо | pnpm workspaces | npm workspaces | Turborepo | ✅ Принято |

---

## Матрица совместимости

| Компонент A | Компонент B | Версия A | Версия B | Статус |
|---|---|---|---|---|
| Node.js | Hono | 22 LTS | 4.7 | ✅ OK |
| Node.js | better-sqlite3 | 22 LTS | 11.8 | ✅ OK (N-API) |
| Hono | @hono/zod-validator | 4.7 | 0.5 | ✅ OK |
| Drizzle ORM | better-sqlite3 | 0.39 | 11.8 | ✅ OK |
| Drizzle ORM | drizzle-kit | 0.39 | 0.30 | ✅ OK |
| Zod | @hono/zod-validator | 3.24 | 0.5 | ✅ OK |
| React | react-dom | 19.1 | 19.1 | ✅ OK |
| React | react-router | 19.1 | 7.5 | ✅ OK |
| React | @tanstack/react-query | 19.1 | 5.68 | ✅ OK |
| Vite | @vitejs/plugin-react | 6.2 | 4.4 | ✅ OK |
| Vite | Tailwind CSS (@tailwindcss/vite) | 6.2 | 4.1 | ✅ OK |
| TypeScript | ESLint (typescript-eslint) | 5.7 | 8.30 | ✅ OK |
| Vitest | Vite | 3.1 | 6.2 | ✅ OK |

---

## Lockfiles и CI

### Стратегия lockfile'ов

| Менеджер | Файл | Коммитится | Назначение |
|---|---|---|---|
| pnpm | `pnpm-lock.yaml` | ✅ Да | Фиксирует точные версии зависимостей |

**Правило:** `pnpm-lock.yaml` ВСЕГДА коммитится. `pnpm install --frozen-lockfile` в CI гарантирует детерминированную сборку.

### CI-валидация (GitHub Actions)

```yaml
name: CI
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

### Стратегия обновления зависимостей

| Инструмент | Назначение |
|---|---|
| **Renovate Bot** | Автоматические PR при обновлении зависимостей |
| **pnpm outdated** | Ручная проверка устаревших пакетов |

**Renovate-конфигурация:** Major-обновления — manual review; minor/patch — automerge при зелёном CI.

---

## Допущения

| # | Допущение | Обоснование |
|---|---|---|
| 1 | Node.js 22 LTS будет поддерживаться до апреля 2027 | Официальный Release Schedule |
| 2 | Hono 4.x API стабилен и не будет breaking changes в minor-версиях | Hono следует semver |
| 3 | Drizzle ORM к v1.0 стабилизирует API | Drizzle в активной разработке, но SQLite-адаптер зрелый |
| 4 | SQLite достаточен для ≤79 проектов с историей деплоев | Подтверждено анализом: 5000 строк deployments ≈ 10 MB |
| 5 | Caddy Admin API стабилен и обратно совместим | Caddy v2 API стабилен с 2020 года |
| 6 | shadcn/ui компоненты совместимы с React 19 | Подтверждено документацией shadcn/ui |

---

## Источники

- Node.js 22 LTS: https://nodejs.org/docs/latest-v22.x/api/
- Hono: https://hono.dev/docs/
- Drizzle ORM: https://orm.drizzle.team/docs/overview
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3
- SQLite WAL: https://www.sqlite.org/wal.html
- React 19: https://react.dev/
- Tailwind CSS 4: https://tailwindcss.com/docs
- shadcn/ui: https://ui.shadcn.com/
- Caddy: https://caddyserver.com/docs/
- Nixpacks: https://nixpacks.com/docs
- Vitest: https://vitest.dev/
- pnpm: https://pnpm.io/
- Zod: https://zod.dev/
