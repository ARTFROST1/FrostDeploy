---
title: "Database Schema — FrostDeploy"
summary: "Полная схема базы данных SQLite для self-hosted платформы деплоя FrostDeploy: таблицы, индексы, миграции, шифрование, бэкапы"
status: Draft
date: 2026-03-31
author: "@artfrost"
version: "1.0"
sources:
  - PRD.md
  - TECH-STACK.md
  - ../DEPLOY-PLATFORM-RESEARCH.md
  - ../COMPETITORS-CODE-ANALYSIS.md
---

# Database Schema: FrostDeploy

## Содержание

1. [Обзор](#1-обзор)
2. [Принципы проектирования](#2-принципы-проектирования)
3. [ER-диаграмма](#3-er-диаграмма)
4. [Таблицы (полные определения)](#4-таблицы-полные-определения)
5. [Индексы](#5-индексы)
6. [Миграции](#6-миграции)
7. [Запросы](#7-запросы)
8. [Шифрование секретов](#8-шифрование-секретов)
9. [Бэкапы](#9-бэкапы)
10. [Ограничения и масштабирование](#10-ограничения-и-масштабирование)
11. [Сравнение с конкурентами](#11-сравнение-с-конкурентами)

---

## 1. Обзор

### Назначение документа

Документ описывает полную схему базы данных FrostDeploy — self-hosted универсальной платформы деплоя. Содержит определения таблиц, индексов, связей, стратегию миграций, механизм шифрования секретов, бэкап-стратегию и ключевые запросы с примерами Drizzle ORM.

### Выбор SQLite

**Движок:** SQLite 3.x (встроен через `better-sqlite3`)
**Режим:** WAL (Write-Ahead Logging)
**Файл:** `/var/lib/frostdeploy/data.db`
**ORM:** Drizzle ORM 0.39.x (`drizzle-orm` + `better-sqlite3`)

**Обоснование** (подробно в TechStack.md):

- **Zero-config** — встроен в npm-пакет, не требует отдельного сервиса
- **0 MB RAM** — in-process, не потребляет ресурсы в idle
- **ACID-транзакции** — полная поддержка через WAL-режим
- **Concurrent reads** — WAL позволяет параллельное чтение при записи
- **Достаточный масштаб** — ≤79 проектов × ≤100 деплоев = <8000 строк, < 50 MB

### Конфигурация WAL

При инициализации подключения выполняются PRAGMA-директивы:

```sql
PRAGMA journal_mode = WAL;          -- Write-Ahead Logging для concurrent reads
PRAGMA busy_timeout = 5000;         -- Ожидание 5 сек при блокировке writer
PRAGMA synchronous = NORMAL;        -- Баланс скорости и надёжности (WAL-safe)
PRAGMA cache_size = -20000;         -- 20 MB кеш страниц в памяти
PRAGMA foreign_keys = ON;           -- Принудительная проверка FK-ссылок
PRAGMA temp_store = MEMORY;         -- Временные таблицы в RAM
PRAGMA wal_autocheckpoint = 1000;   -- Checkpoint каждые 1000 страниц
```

---

## 2. Принципы проектирования

### Naming Conventions

| Объект | Правило | Пример |
|---|---|---|
| Таблицы | snake_case, множественное число | `projects`, `deployments` |
| Столбцы | snake_case | `commit_sha`, `created_at` |
| Primary Key | `id` (TEXT, hex-строка 16 символов) | `a1b2c3d4e5f6a7b8` |
| Foreign Key | `{entity}_id` | `project_id` |
| Timestamps | ISO 8601 UTC, TEXT | `2026-03-31T12:00:00Z` |
| Индексы | `idx_{table}_{columns}` | `idx_deployments_project_created` |
| Boolean | INTEGER (0/1), префикс `is_` | `is_secret`, `is_primary` |

### Стратегии данных

| Принцип | Описание |
|---|---|
| **ID-генерация** | `lower(hex(randomblob(8)))` — 16-символьный hex, без внешних зависимостей |
| **Timestamps** | `datetime('now')` — ISO 8601 UTC, TEXT-тип для совместимости |
| **Soft delete** | Не используется в MVP. Удаление — физическое (`DELETE`). Деплои — иммутабельные (никогда не удаляются) |
| **Иммутабельность деплоев** | Записи в `deployments` никогда не удаляются и не модифицируются после завершения (кроме обновления `status`, `logs`, `duration_ms`, `error` во время выполнения) |
| **Шифрование секретов** | AES-256-GCM для значений env-переменных и чувствительных настроек |
| **Enum-значения** | CHECK-constraint со списком допустимых значений (TEXT-тип) |

---

## 3. ER-диаграмма

```
┌───────────────────────┐       ┌───────────────────────────────┐
│       settings        │       │           projects            │
├───────────────────────┤       ├───────────────────────────────┤
│ PK key          TEXT  │       │ PK id              TEXT       │
│    value         TEXT │       │    name             TEXT       │
│    is_encrypted  INT  │       │    repo_url         TEXT       │
│    updated_at    TEXT │       │    branch           TEXT       │
└───────────────────────┘       │    domain           TEXT       │
                                │    port             INT        │
                                │    framework        TEXT       │
                                │    build_cmd        TEXT       │
                                │    start_cmd        TEXT       │
                                │    output_dir       TEXT       │
                                │    src_dir          TEXT       │
                                │    runtime_dir      TEXT       │
                                │    service_name     TEXT       │
                                │    current_sha      TEXT       │
                                │    status           TEXT       │
                                │    created_at       TEXT       │
                                │    updated_at       TEXT       │
                                └──────┬──┬──┬──────────────────┘
                                       │  │  │
                      ┌────────────────┘  │  └────────────────┐
                      │                   │                    │
                      ▼                   ▼                    ▼
┌─────────────────────────┐ ┌──────────────────────┐ ┌────────────────────┐
│     env_variables       │ │     deployments      │ │      domains       │
├─────────────────────────┤ ├──────────────────────┤ ├────────────────────┤
│ PK id            TEXT   │ │ PK id          TEXT  │ │ PK id        TEXT  │
│ FK project_id    TEXT   │ │ FK project_id  TEXT  │ │ FK project_id TEXT │
│    key           TEXT   │ │    commit_sha  TEXT  │ │    domain     TEXT │
│    encrypted_value TEXT │ │    commit_msg  TEXT  │ │    is_primary INT  │
│    is_secret     INT    │ │    status      TEXT  │ │    ssl_status TEXT │
│    created_at    TEXT   │ │    logs        TEXT  │ │    verified_at TEXT│
│    updated_at    TEXT   │ │    duration_ms INT   │ │    created_at TEXT │
└─────────────────────────┘ │    error       TEXT  │ │    updated_at TEXT │
                            │    triggered_by TEXT │ └────────────────────┘
                            │    started_at  TEXT  │
                            │    finished_at TEXT  │          │
                            │    created_at  TEXT  │          │
                            └──────────┬───────────┘          │
                                       │                      │
                                       ▼                      │
                            ┌──────────────────────┐          │
                            │    deploy_locks      │          │
                            ├──────────────────────┤          │
                            │ FK project_id  TEXT  │ (UNIQUE) │
                            │ FK deployment_id TEXT│          │
                            │    locked_at   TEXT  │          │
                            └──────────────────────┘          │

Связи:
  projects  1───*  deployments     (ON DELETE CASCADE)
  projects  1───*  env_variables   (ON DELETE CASCADE)
  projects  1───*  domains         (ON DELETE CASCADE)
  projects  1───0..1 deploy_locks  (ON DELETE CASCADE)
  deployments 1───0..1 deploy_locks (ON DELETE SET NULL)
```

---

## 4. Таблицы (полные определения)

### 4.1. Таблица `projects`

**Назначение:** Основная сущность платформы — зарегистрированный проект для деплоя.

#### DDL (SQL)

```sql
CREATE TABLE projects (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    name          TEXT NOT NULL,
    repo_url      TEXT NOT NULL,
    branch        TEXT NOT NULL DEFAULT 'main',
    domain        TEXT,
    port          INTEGER UNIQUE NOT NULL,
    framework     TEXT,
    build_cmd     TEXT,
    start_cmd     TEXT,
    output_dir    TEXT DEFAULT 'dist',
    src_dir       TEXT NOT NULL,
    runtime_dir   TEXT NOT NULL,
    service_name  TEXT NOT NULL UNIQUE,
    current_sha   TEXT,
    status        TEXT NOT NULL DEFAULT 'created'
                  CHECK (status IN ('created', 'active', 'deploying', 'error', 'stopped')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### Drizzle Schema (TypeScript)

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const projects = sqliteTable('projects', {
  id:          text('id').primaryKey().$defaultFn(() => randomHex(8)),
  name:        text('name').notNull(),
  repoUrl:     text('repo_url').notNull(),
  branch:      text('branch').notNull().default('main'),
  domain:      text('domain'),
  port:        integer('port').unique().notNull(),
  framework:   text('framework'),
  buildCmd:    text('build_cmd'),
  startCmd:    text('start_cmd'),
  outputDir:   text('output_dir').default('dist'),
  srcDir:      text('src_dir').notNull(),
  runtimeDir:  text('runtime_dir').notNull(),
  serviceName: text('service_name').notNull().unique(),
  currentSha:  text('current_sha'),
  status:      text('status', {
                 enum: ['created', 'active', 'deploying', 'error', 'stopped'],
               }).notNull().default('created'),
  createdAt:   text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt:   text('updated_at').notNull().default(sql`(datetime('now'))`),
});
```

#### Определения столбцов

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | TEXT | Нет | `hex(randomblob(8))` | PK, 16-символьный hex |
| `name` | TEXT | Нет | — | Имя проекта (из имени репозитория) |
| `repo_url` | TEXT | Нет | — | URL GitHub-репозитория |
| `branch` | TEXT | Нет | `'main'` | Ветка для деплоя |
| `domain` | TEXT | Да | `NULL` | Привязанный домен (может отсутствовать) |
| `port` | INTEGER | Нет | — | Порт приложения (4321–4399), уникальный |
| `framework` | TEXT | Да | `NULL` | Определённый фреймворк: `astro-ssr`, `astro-static`, `nextjs`, `nuxt`, `sveltekit`, `remix`, `express`, `fastify`, `koa`, `nestjs`, `static` |
| `build_cmd` | TEXT | Да | `NULL` | Команда сборки, напр. `npm run build` |
| `start_cmd` | TEXT | Да | `NULL` | Команда запуска, напр. `node dist/server/entry.mjs` |
| `output_dir` | TEXT | Да | `'dist'` | Директория с артефактами сборки. Default `'dist'` задаётся на уровне Drizzle (`.default('dist')`) и DDL (`DEFAULT 'dist'`) |
| `src_dir` | TEXT | Нет | — | Путь к исходникам: `/var/www/{name}-src` |
| `runtime_dir` | TEXT | Нет | — | Путь к рантайму: `/var/www/{name}` |
| `service_name` | TEXT | Нет | — | Имя systemd-юнита, уникальное |
| `current_sha` | TEXT | Да | `NULL` | SHA текущего задеплоенного коммита |
| `status` | TEXT | Нет | `'created'` | Статус проекта: `created`, `active`, `deploying`, `error`, `stopped` |
| `created_at` | TEXT | Нет | `datetime('now')` | Время создания (ISO 8601 UTC) |
| `updated_at` | TEXT | Нет | `datetime('now')` | Время обновления (ISO 8601 UTC) |

**Бизнес-правила:**
- `port` должен быть в диапазоне 4321–4399 (CHECK не добавлен — валидация на уровне приложения, диапазон может быть изменён в settings)
- `service_name` генерируется как `frostdeploy-{name}` и должен быть уникальным
- При удалении проекта каскадно удаляются: deployments, env_variables, domains, deploy_locks

---

### 4.2. Таблица `deployments`

**Назначение:** Иммутабельная история деплоев. Каждая строка — один запуск pipeline.

#### DDL (SQL)

```sql
CREATE TABLE deployments (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    commit_sha    TEXT NOT NULL,
    commit_msg    TEXT,
    status        TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'building', 'deploying', 'success', 'failed', 'cancelled')),
    logs          TEXT,
    duration_ms   INTEGER,
    error         TEXT,
    triggered_by  TEXT NOT NULL DEFAULT 'manual'
                  CHECK (triggered_by IN ('manual', 'webhook', 'rollback', 'cli')),
    started_at    TEXT,
    finished_at   TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### Drizzle Schema (TypeScript)

```typescript
export const deployments = sqliteTable('deployments', {
  id:          text('id').primaryKey().$defaultFn(() => randomHex(8)),
  projectId:   text('project_id').notNull()
                 .references(() => projects.id, { onDelete: 'cascade' }),
  commitSha:   text('commit_sha').notNull(),
  commitMsg:   text('commit_msg'),
  status:      text('status', {
                 enum: ['queued', 'building', 'deploying', 'success', 'failed', 'cancelled'],
               }).notNull().default('queued'),
  logs:        text('logs'),
  durationMs:  integer('duration_ms'),
  error:       text('error'),
  triggeredBy: text('triggered_by', {
                 enum: ['manual', 'webhook', 'rollback', 'cli'],
               }).notNull().default('manual'),
  startedAt:   text('started_at'),
  finishedAt:  text('finished_at'),
  createdAt:   text('created_at').notNull().default(sql`(datetime('now'))`),
});
```

#### Определения столбцов

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | TEXT | Нет | `hex(randomblob(8))` | PK деплоя |
| `project_id` | TEXT | Нет | — | FK → `projects.id` |
| `commit_sha` | TEXT | Нет | — | Полный SHA коммита (40 символов) |
| `commit_msg` | TEXT | Да | `NULL` | Первая строка сообщения коммита |
| `status` | TEXT | Нет | `'queued'` | Статус: `queued`, `building`, `deploying`, `success`, `failed`, `cancelled` |
| `logs` | TEXT | Да | `NULL` | Полный лог деплоя (текст с таймстампами) |
| `duration_ms` | INTEGER | Да | `NULL` | Длительность деплоя в миллисекундах |
| `error` | TEXT | Да | `NULL` | Описание ошибки (при `status = 'failed'`) |
| `triggered_by` | TEXT | Нет | `'manual'` | Источник: `manual`, `webhook`, `rollback`, `cli` |
| `started_at` | TEXT | Да | `NULL` | Время начала выполнения (ISO 8601 UTC) |
| `finished_at` | TEXT | Да | `NULL` | Время завершения (ISO 8601 UTC) |
| `created_at` | TEXT | Нет | `datetime('now')` | Время постановки в очередь |

**Диаграмма состояний деплоя:**

```
queued → building → deploying → success
  │         │          │
  │         │          └──→ failed
  │         └─────────────→ failed
  └───────────────────────→ cancelled
```

**Бизнес-правила:**
- Записи иммутабельны после перехода в терминальный статус (`success`, `failed`, `cancelled`)
- `logs` заполняется инкрементально во время деплоя (append)
- `duration_ms` вычисляется как `finished_at - started_at`
- Таймаут деплоя: 10 минут (600000 мс) — при превышении статус → `failed`

---

### 4.3. Таблица `env_variables`

**Назначение:** Переменные окружения проектов. Значения секретов хранятся в зашифрованном виде (AES-256-GCM).

#### DDL (SQL)

```sql
CREATE TABLE env_variables (
    id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key             TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    is_secret       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(project_id, key)
);
```

#### Drizzle Schema (TypeScript)

```typescript
export const envVariables = sqliteTable('env_variables', {
  id:             text('id').primaryKey().$defaultFn(() => randomHex(8)),
  projectId:      text('project_id').notNull()
                    .references(() => projects.id, { onDelete: 'cascade' }),
  key:            text('key').notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  isSecret:       integer('is_secret', { mode: 'boolean' }).notNull().default(true),
  createdAt:      text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt:      text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  uniqueProjectKey: unique().on(table.projectId, table.key),
}));
```

#### Определения столбцов

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | TEXT | Нет | `hex(randomblob(8))` | PK |
| `project_id` | TEXT | Нет | — | FK → `projects.id` |
| `key` | TEXT | Нет | — | Имя переменной (напр. `DATABASE_URL`) |
| `encrypted_value` | TEXT | Нет | — | Зашифрованное значение (AES-256-GCM, base64) |
| `is_secret` | INTEGER | Нет | `1` | `1` — маскировать в UI, `0` — показывать |
| `created_at` | TEXT | Нет | `datetime('now')` | Время создания |
| `updated_at` | TEXT | Нет | `datetime('now')` | Время обновления |

**Бизнес-правила:**
- Пара `(project_id, key)` уникальна — нельзя дублировать имя переменной в рамках проекта
- Все значения хранятся зашифрованными через AES-256-GCM (см. раздел 8)
- При `is_secret = 1` UI показывает `••••••••` вместо значения
- При деплое: расшифровка → запись в systemd EnvironmentFile → передача процессу

---

### 4.4. Таблица `domains`

**Назначение:** Домены, привязанные к проектам. Проект может иметь несколько доменов (основной + алиасы).

#### DDL (SQL)

```sql
CREATE TABLE domains (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    domain        TEXT NOT NULL UNIQUE,
    is_primary    INTEGER NOT NULL DEFAULT 0,
    ssl_status    TEXT NOT NULL DEFAULT 'pending'
                  CHECK (ssl_status IN ('pending', 'provisioning', 'active', 'error')),
    verified_at   TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### Drizzle Schema (TypeScript)

```typescript
export const domains = sqliteTable('domains', {
  id:         text('id').primaryKey().$defaultFn(() => randomHex(8)),
  projectId:  text('project_id').notNull()
                .references(() => projects.id, { onDelete: 'cascade' }),
  domain:     text('domain').notNull().unique(),
  isPrimary:  integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  sslStatus:  text('ssl_status', {
                enum: ['pending', 'provisioning', 'active', 'error'],
              }).notNull().default('pending'),
  verifiedAt: text('verified_at'),
  createdAt:  text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt:  text('updated_at').notNull().default(sql`(datetime('now'))`),
});
```

#### Определения столбцов

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | TEXT | Нет | `hex(randomblob(8))` | PK |
| `project_id` | TEXT | Нет | — | FK → `projects.id` |
| `domain` | TEXT | Нет | — | FQDN (напр. `app.example.com`), глобально уникален |
| `is_primary` | INTEGER | Нет | `0` | `1` — основной домен проекта |
| `ssl_status` | TEXT | Нет | `'pending'` | Статус SSL: `pending`, `provisioning`, `active`, `error` |
| `verified_at` | TEXT | Да | `NULL` | Время верификации DNS (ISO 8601 UTC) |
| `created_at` | TEXT | Нет | `datetime('now')` | Время создания |
| `updated_at` | TEXT | Нет | `datetime('now')` | Время обновления |

**Бизнес-правила:**
- Домен глобально уникален — один домен привязан к одному проекту
- Только один домен на проект может быть `is_primary = 1` (контроль на уровне приложения)
- Верификация: `dig +short A {domain}` должен вернуть IP сервера
- SSL провизионируется автоматически через Caddy (ACME / Let's Encrypt)
- Поле `projects.domain` содержит основной домен для быстрого доступа (денормализация)

---

### 4.5. Таблица `settings`

**Назначение:** Key-value хранилище глобальных настроек платформы. Чувствительные значения хранятся зашифрованными.

#### DDL (SQL)

```sql
CREATE TABLE settings (
    key           TEXT PRIMARY KEY,
    value         TEXT NOT NULL,
    is_encrypted  INTEGER NOT NULL DEFAULT 0,
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### Drizzle Schema (TypeScript)

```typescript
export const settings = sqliteTable('settings', {
  key:         text('key').primaryKey(),
  value:       text('value').notNull(),
  isEncrypted: integer('is_encrypted', { mode: 'boolean' }).notNull().default(false),
  updatedAt:   text('updated_at').notNull().default(sql`(datetime('now'))`),
});
```

#### Определения столбцов

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `key` | TEXT | Нет | — | PK, имя настройки |
| `value` | TEXT | Нет | — | Значение (открытое или зашифрованное) |
| `is_encrypted` | INTEGER | Нет | `0` | `1` — значение зашифровано AES-256-GCM |
| `updated_at` | TEXT | Нет | `datetime('now')` | Время обновления |

**Предопределённые ключи:**

| Ключ | Зашифрован | Описание |
|---|---|---|
| `admin_password_hash` | Нет | SHA-256 хеш пароля администратора |
| `github_pat` | Да | GitHub Personal Access Token |
| `platform_domain` | Нет | Домен дашборда FrostDeploy |
| `server_name` | Нет | Имя сервера (для UI) |
| `port_range_start` | Нет | Начало диапазона портов (по умолч. `4321`) |
| `port_range_end` | Нет | Конец диапазона портов (по умолч. `4399`) |
| `encryption_key_id` | Нет | Идентификатор текущего ключа шифрования (для ротации) |
| `setup_completed` | Нет | `true` — первоначальная настройка завершена |
| `session_secret` | Нет | Секрет для HMAC-подписи cookie. Хранится незашифрованным — auth middleware читает его напрямую при каждом запросе; шифрование создало бы циклическую зависимость (ключ шифрования и секрет сессии служат разным целям) |

---

### 4.6. Таблица `deploy_locks`

**Назначение:** Per-project мьютекс деплоя. Предотвращает параллельные деплои одного проекта (FR-302).

#### DDL (SQL)

```sql
CREATE TABLE deploy_locks (
    project_id    TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
    deployment_id TEXT REFERENCES deployments(id) ON DELETE SET NULL,
    locked_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
```

#### Drizzle Schema (TypeScript)

```typescript
export const deployLocks = sqliteTable('deploy_locks', {
  projectId:    text('project_id').notNull().unique()
                  .references(() => projects.id, { onDelete: 'cascade' }),
  deploymentId: text('deployment_id')
                  .references(() => deployments.id, { onDelete: 'set null' }),
  lockedAt:     text('locked_at').notNull().default(sql`(datetime('now'))`),
});
```

#### Определения столбцов

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `project_id` | TEXT | Нет | — | FK → `projects.id`, UNIQUE — только один лок на проект |
| `deployment_id` | TEXT | Да | `NULL` | FK → `deployments.id`, текущий активный деплой |
| `locked_at` | TEXT | Нет | `datetime('now')` | Время установки блокировки |

> **Примечание (PK):** Таблица `deploy_locks` не имеет явного PRIMARY KEY. В реализации Drizzle `projectId` использует `.unique()`, а не `.primaryKey()`. SQLite автоматически создаёт скрытый `rowid` как implicit PK. Constraint `UNIQUE` на `project_id` гарантирует один лок на проект.

**Бизнес-правила:**
- Наличие строки = проект заблокирован для деплоя
- При запросе деплоя: проверка `SELECT ... WHERE project_id = ?`
  - Строка есть → HTTP 409 Conflict
  - Строки нет → `INSERT` лок, начать деплой
- По завершении деплоя (success/failed/cancelled) → `DELETE` лок
- Таймаут: если `locked_at` старше 10 минут — лок считается «зависшим» и может быть принудительно снят
- `deployment_id` позволяет показать пользователю, какой именно деплой заблокировал проект

---

## 5. Индексы

### Сводная таблица индексов

```sql
-- projects
CREATE UNIQUE INDEX idx_projects_port ON projects(port);
CREATE UNIQUE INDEX idx_projects_service_name ON projects(service_name);
CREATE INDEX idx_projects_status ON projects(status);

-- deployments
CREATE INDEX idx_deployments_project_created ON deployments(project_id, created_at DESC);
CREATE INDEX idx_deployments_project_status ON deployments(project_id, status);
CREATE INDEX idx_deployments_status ON deployments(status);

-- env_variables
CREATE INDEX idx_env_variables_project ON env_variables(project_id);
CREATE UNIQUE INDEX idx_env_variables_project_key ON env_variables(project_id, key);

-- domains
CREATE UNIQUE INDEX idx_domains_domain ON domains(domain);
CREATE INDEX idx_domains_project ON domains(project_id);

-- deploy_locks
CREATE UNIQUE INDEX idx_deploy_locks_project ON deploy_locks(project_id);
```

### Обоснование индексов

| Индекс | Таблица | Паттерн запроса | Обоснование |
|---|---|---|---|
| `idx_projects_port` | projects | `WHERE port = ?` | UNIQUE constraint; проверка при назначении порта |
| `idx_projects_service_name` | projects | `WHERE service_name = ?` | UNIQUE constraint; поиск по systemd-юниту |
| `idx_projects_status` | projects | `WHERE status = 'active'` | Дашборд: фильтрация проектов по статусу |
| `idx_deployments_project_created` | deployments | `WHERE project_id = ? ORDER BY created_at DESC` | История деплоев проекта (пагинация) — самый частый запрос |
| `idx_deployments_project_status` | deployments | `WHERE project_id = ? AND status = ?` | Поиск активного деплоя; подсчёт success/failed |
| `idx_deployments_status` | deployments | `WHERE status IN ('queued', 'building', 'deploying')` | Поиск незавершённых деплоев при старте (recovery) |
| `idx_env_variables_project` | env_variables | `WHERE project_id = ?` | Все env vars проекта для деплоя |
| `idx_env_variables_project_key` | env_variables | `WHERE project_id = ? AND key = ?` | UNIQUE constraint; upsert переменной |
| `idx_domains_domain` | domains | `WHERE domain = ?` | UNIQUE constraint; проверка уникальности домена |
| `idx_domains_project` | domains | `WHERE project_id = ?` | Все домены проекта |
| `idx_deploy_locks_project` | deploy_locks | `WHERE project_id = ?` | UNIQUE constraint; проверка лока (каждый деплой) |

---

## 6. Миграции

### Стратегия миграций

**Инструмент:** `drizzle-kit` — автогенерация SQL-миграций из diff'а Drizzle-схемы.

**Директория:** `src/db/migrations/`

**Формат имени файла:** `XXXX_description.sql` (автогенерируется drizzle-kit)

```
src/db/
├── schema.ts              — Drizzle-определения таблиц
├── index.ts               — Инициализация подключения + PRAGMA
├── seed.ts                — Начальные данные (settings)
└── migrations/
    ├── 0000_initial.sql   — Создание всех таблиц MVP
    ├── 0001_add_domains.sql
    └── meta/
        └── _journal.json  — Журнал применённых миграций
```

### Drizzle Config

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '/var/lib/frostdeploy/data.db',
  },
});
```

### Workflow миграций

```
1. Изменить schema.ts
2. drizzle-kit generate     → SQL-миграция в migrations/
3. drizzle-kit migrate      → Применить на dev-БД
4. Тестирование
5. Деплой → миграция применяется при старте приложения
```

### Применение миграций при старте

```typescript
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index';

// Вызывается при старте приложения
migrate(db, { migrationsFolder: './src/db/migrations' });
```

### Правила миграций

| Правило | Описание |
|---|---|
| **Forward-only** | Миграции идут только вперёд. Откат — через новую миграцию |
| **Идемпотентность** | `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` |
| **Атомарность** | Каждая миграция — одна транзакция SQLite |
| **Без потерь данных** | Удаление столбцов — через создание новой таблицы + копирование (SQLite не поддерживает `DROP COLUMN` до 3.35) |
| **Тестирование** | Каждая миграция проверяется на пустой БД (fresh) и на БД с данными (upgrade) |

### Начальный seed

При первом запуске (Setup Wizard) `settings` заполняется:

```typescript
// src/db/seed.ts
export function seedSettings(db: Database, config: SetupConfig) {
  const insert = db.insert(settings).values;

  insert({ key: 'admin_password_hash', value: config.passwordHash, isEncrypted: false });
  insert({ key: 'github_pat', value: encrypt(config.githubPat), isEncrypted: true });
  insert({ key: 'platform_domain', value: config.domain, isEncrypted: false });
  insert({ key: 'port_range_start', value: '4321', isEncrypted: false });
  insert({ key: 'port_range_end', value: '4399', isEncrypted: false });
  insert({ key: 'setup_completed', value: 'true', isEncrypted: false });
  insert({ key: 'session_secret', value: config.sessionSecret, isEncrypted: false });
}
```

---

## 7. Запросы

### 7.1. Список проектов с последним деплоем

**Паттерн:** Дашборд — отображение всех проектов со статусом последнего деплоя (FR-100, FR-102).

```typescript
import { db } from '../db';
import { projects, deployments } from '../db/schema';
import { eq, desc, sql } from 'drizzle-orm';

// Subquery: последний деплой каждого проекта
const latestDeploy = db
  .select({
    projectId: deployments.projectId,
    status: deployments.status,
    commitSha: deployments.commitSha,
    createdAt: sql`MAX(${deployments.createdAt})`.as('latest_created'),
  })
  .from(deployments)
  .groupBy(deployments.projectId)
  .as('latest_deploy');

// Основной запрос
const projectsWithDeploy = await db
  .select({
    id: projects.id,
    name: projects.name,
    domain: projects.domain,
    status: projects.status,
    currentSha: projects.currentSha,
    framework: projects.framework,
    lastDeployStatus: latestDeploy.status,
    lastDeployAt: latestDeploy.createdAt,
  })
  .from(projects)
  .leftJoin(latestDeploy, eq(projects.id, latestDeploy.projectId))
  .orderBy(desc(projects.updatedAt));
```

**Эквивалентный SQL:**

```sql
SELECT
  p.id, p.name, p.domain, p.status, p.current_sha, p.framework,
  ld.status AS last_deploy_status,
  ld.latest_created AS last_deploy_at
FROM projects p
LEFT JOIN (
  SELECT project_id, status, commit_sha,
         MAX(created_at) AS latest_created
  FROM deployments
  GROUP BY project_id
) ld ON p.id = ld.project_id
ORDER BY p.updated_at DESC;
```

### 7.2. История деплоев проекта (пагинация)

**Паттерн:** Страница проекта — таблица деплоев (FR-307, US-032).

```typescript
const PAGE_SIZE = 20;

async function getDeployHistory(projectId: string, page: number) {
  const offset = (page - 1) * PAGE_SIZE;

  const rows = await db
    .select({
      id: deployments.id,
      commitSha: deployments.commitSha,
      commitMsg: deployments.commitMsg,
      status: deployments.status,
      durationMs: deployments.durationMs,
      triggeredBy: deployments.triggeredBy,
      createdAt: deployments.createdAt,
    })
    .from(deployments)
    .where(eq(deployments.projectId, projectId))
    .orderBy(desc(deployments.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  // Общее число деплоев для пагинации
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(deployments)
    .where(eq(deployments.projectId, projectId));

  return { rows, total, page, pageSize: PAGE_SIZE };
}
```

**Используемый индекс:** `idx_deployments_project_created (project_id, created_at DESC)`

### 7.3. Проверка deploy lock

**Паттерн:** Перед запуском деплоя — проверка мьютекса (FR-302).

```typescript
import { deployLocks } from '../db/schema';

async function acquireDeployLock(
  projectId: string,
  deploymentId: string,
): Promise<boolean> {
  try {
    await db.insert(deployLocks).values({
      projectId,
      deploymentId,
      lockedAt: new Date().toISOString(),
    });
    return true; // Лок получен
  } catch (err) {
    // UNIQUE constraint violation → проект уже заблокирован
    return false;
  }
}

async function releaseDeployLock(projectId: string): Promise<void> {
  await db.delete(deployLocks).where(eq(deployLocks.projectId, projectId));
}

// Получение информации о текущем локе (для HTTP 409)
async function getDeployLock(projectId: string) {
  return db
    .select()
    .from(deployLocks)
    .where(eq(deployLocks.projectId, projectId))
    .get();
}
```

**Используемый индекс:** `idx_deploy_locks_project (project_id)` — UNIQUE

### 7.4. Получение проекта с env-переменными

**Паттерн:** Деплой — получить проект и расшифровать env vars для EnvironmentFile.

```typescript
import { decrypt } from '../lib/crypto';

async function getProjectWithEnv(projectId: string) {
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  if (!project) return null;

  const envVars = await db
    .select()
    .from(envVariables)
    .where(eq(envVariables.projectId, projectId));

  // Расшифровка значений
  const decryptedEnv = envVars.map((v) => ({
    key: v.key,
    value: decrypt(v.encryptedValue),
    isSecret: v.isSecret,
  }));

  return { ...project, envVars: decryptedEnv };
}
```

**Используемый индекс:** `idx_env_variables_project (project_id)`

### 7.5. Агрегации для дашборда

**Паттерн:** Дашборд — общие метрики платформы (всего проектов, деплоев, success rate).

```typescript
async function getDashboardStats() {
  const [projectStats] = await db
    .select({
      totalProjects: sql<number>`COUNT(*)`,
      activeProjects: sql<number>`SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)`,
    })
    .from(projects);

  const [deployStats] = await db
    .select({
      totalDeploys: sql<number>`COUNT(*)`,
      successDeploys: sql<number>`SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)`,
      failedDeploys: sql<number>`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)`,
      recentDeploys: sql<number>`SUM(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 ELSE 0 END)`,
    })
    .from(deployments);

  const successRate = deployStats.totalDeploys > 0
    ? Math.round((deployStats.successDeploys / deployStats.totalDeploys) * 100)
    : 0;

  return { ...projectStats, ...deployStats, successRate };
}
```

**Эквивалентный SQL:**

```sql
-- Статистика проектов
SELECT
  COUNT(*) AS total_projects,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_projects
FROM projects;

-- Статистика деплоев
SELECT
  COUNT(*) AS total_deploys,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_deploys,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_deploys,
  SUM(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 ELSE 0 END) AS recent_deploys
FROM deployments;
```

### 7.6. Очистка зависших локов

**Паттерн:** Периодическая задача — снятие локов старше 10 минут (защита от зависших деплоев).

```typescript
async function cleanupStaleLocks(): Promise<number> {
  const result = await db
    .delete(deployLocks)
    .where(sql`locked_at < datetime('now', '-10 minutes')`);

  return result.changes; // Количество снятых локов
}
```

---

## 8. Шифрование секретов

### Алгоритм

**AES-256-GCM** — аутентифицированное шифрование с ассоциированными данными (AEAD).

| Параметр | Значение |
|---|---|
| Алгоритм | AES-256-GCM |
| Длина ключа | 256 бит (32 байта) |
| IV (Initialization Vector) | 12 байт, случайный для каждого шифрования |
| Auth Tag | 16 байт |
| Формат хранения | `base64(iv).base64(ciphertext).base64(authTag)` (три сегмента через точку) |

### Ключ шифрования

Мастер-ключ **не хранится в БД**. Он передаётся через переменную окружения:

```bash
# /etc/frostdeploy/env
ENCRYPTION_KEY=<произвольная строка>
```

Ключ может быть любой строкой — он пропускается через SHA-256 для получения ровно 32 байт (256 бит). Это удобнее для пользователя, чем требование точного hex-формата.

Генерация ключа при установке:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Реализация

```typescript
// src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function deriveKey(key: string): Buffer {
  // Derive exactly 32 bytes from any string via SHA-256
  return createHash('sha256').update(key).digest();
}

export function encrypt(plaintext: string, key: string): string {
  const derivedKey = deriveKey(key);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Формат: три base64-сегмента через точку
  return `${iv.toString('base64')}.${encrypted.toString('base64')}.${tag.toString('base64')}`;
}

export function decrypt(encrypted: string, key: string): string {
  const parts = encrypted.split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const [ivB64, ciphertextB64, tagB64] = parts;
  const derivedKey = deriveKey(key);
  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}
```

### Поток данных

```
Пользователь вводит значение в UI
       │
       ▼
API: encrypt(value) → encrypted_value (base64)
       │
       ▼
SQLite: INSERT INTO env_variables (encrypted_value = '...')
       │
       ▼
Деплой: SELECT → decrypt(encrypted_value) → plaintext
       │
       ▼
Запись в /etc/frostdeploy/envfiles/{project}.env
       │
       ▼
systemd: EnvironmentFile=/etc/frostdeploy/envfiles/{project}.env
```

### Ротация ключей

В MVP ротация ключей не реализована. При необходимости (v0.2+):

1. Генерировать новый ключ
2. Расшифровать все значения старым ключом
3. Зашифровать все значения новым ключом
4. Обновить `ENCRYPTION_KEY`
5. Обновить `encryption_key_id` в settings

---

## 9. Бэкапы

### Стратегия

SQLite — один файл. Бэкап — копия файла. Но просто `cp` небезопасно при активной записи (WAL-режим).

### Безопасный бэкап через `.backup`

```bash
# Бэкап без остановки сервера (SQLite online backup API)
sqlite3 /var/lib/frostdeploy/data.db ".backup /var/lib/frostdeploy/backups/data-$(date +%Y%m%d-%H%M%S).db"
```

**Как работает:** SQLite `.backup` использует Online Backup API — создаёт консистентный snapshot БД, даже если сервер активно пишет данные. WAL-лог учитывается.

### Автоматический бэкап (cron)

```bash
# /etc/cron.d/frostdeploy-backup
# Бэкап каждые 6 часов, хранение последних 7 копий
0 */6 * * * root sqlite3 /var/lib/frostdeploy/data.db \
  ".backup /var/lib/frostdeploy/backups/data-$(date +\%Y\%m\%d-\%H\%M\%S).db" \
  && find /var/lib/frostdeploy/backups/ -name "data-*.db" -mtime +2 -delete
```

### WAL Checkpoint

Периодический checkpoint переносит данные из WAL-лога в основной файл:

```sql
-- Ручной checkpoint (обычно не нужен — SQLite делает автоматически)
PRAGMA wal_checkpoint(TRUNCATE);
```

**Рекомендуется:** выполнять `PRAGMA wal_checkpoint(TRUNCATE)` перед бэкапом для минимального размера файла.

### Структура директорий

```
/var/lib/frostdeploy/
├── data.db           — Основная БД
├── data.db-wal       — WAL-лог (автоматический)
├── data.db-shm       — Shared memory файл (автоматический)
└── backups/
    ├── data-20260331-060000.db
    ├── data-20260331-120000.db
    └── data-20260331-180000.db
```

### Восстановление

```bash
# Остановить сервис
systemctl stop frostdeploy

# Восстановить из бэкапа
cp /var/lib/frostdeploy/backups/data-20260331-120000.db /var/lib/frostdeploy/data.db

# Удалить WAL/SHM (будут пересозданы)
rm -f /var/lib/frostdeploy/data.db-wal /var/lib/frostdeploy/data.db-shm

# Запустить сервис
systemctl start frostdeploy
```

---

## 10. Ограничения и масштабирование

### Лимиты SQLite

| Параметр | Лимит SQLite | FrostDeploy (ожидание) | Запас |
|---|---|---|---|
| Максимальный размер БД | 281 TB | < 50 MB (6 мес) | Огромный |
| Максимум строк в таблице | 2^64 | < 10 000 | Огромный |
| Concurrent readers | Неограниченно (WAL) | 1–5 | OK |
| Concurrent writers | 1 (серийно) | 1 | OK |
| Максимум столбцов | 2000 | 17 (projects) | OK |
| Размер BLOB/TEXT | 1 GB | < 10 MB (logs) | OK |

### Когда SQLite недостаточно

| Триггер | Описание | Решение |
|---|---|---|
| Multi-server (v0.5) | Несколько серверов пишут в одну БД | Миграция на PostgreSQL через Drizzle (смена dialect) |
| Multi-user (v1.0) | Конкурентные write-операции нескольких пользователей | PostgreSQL или SQLite в server-mode (Turso) |
| > 100 000 деплоев | Тяжёлые агрегации, аналитика | PostgreSQL с GIN/BRIN индексами |
| > 1 GB размер БД | Замедление бэкапов, checkpoint | Архивация старых деплоев + PostgreSQL |

### Путь миграции SQLite → PostgreSQL

Drizzle ORM поддерживает смену dialect без переписывания бизнес-логики:

```
1. Изменить dialect в drizzle.config.ts: 'sqlite' → 'pg'
2. Обновить схему: text() → varchar(), integer() → serial() и т.д.
3. Сгенерировать новые миграции
4. Написать скрипт переноса данных (sqlite → pg)
5. Обновить PRAGMA → SET параметры PG
```

**Важно:** Архитектура запросов через Drizzle ORM и Zod-валидации остаётся полностью совместимой. Меняется только слой подключения и DDL.

### Оптимизация для MVP

| Проблема | Решение |
|---|---|
| Рост таблицы `deployments.logs` | Ограничить хранение логов: 50 последних деплоев с полными логами, остальные — усечённые |
| Медленные агрегации | Для дашборда: кеширование на уровне TanStack Query (staleTime: 30 сек) |
| WAL-файл растёт | `PRAGMA wal_autocheckpoint = 1000` — автоматический checkpoint |

---

## 11. Сравнение с конкурентами

| Критерий | FrostDeploy (SQLite) | Coolify (PostgreSQL) | CapRover (JSON files) |
|---|---|---|---|
| **Движок** | SQLite 3.x (WAL) | PostgreSQL 15 | JSON-файлы на диске |
| **ORM** | Drizzle ORM | Eloquent (Laravel) | Нет (ручной R/W) |
| **Таблиц** | 6 | 200+ (миграций) | — |
| **Транзакции** | ACID | ACID | Нет |
| **Concurrent writes** | 1 (серийно) | Множество | Глобальный mutex |
| **RAM overhead** | 0 MB (in-process) | 50–100 MB | 0 MB |
| **Бэкапы** | `.backup` (одна команда) | `pg_dump` / pg_basebackup | `cp` JSON-файлов |
| **Миграции** | drizzle-kit (автогенерация) | Laravel migrations (200+) | Нет |
| **Шифрование** | AES-256-GCM (env vars) | AES-256-CBC (Laravel encrypt) | Нет |
| **Масштабируемость** | 1 сервер, 1 writer | Multi-server, multi-tenant | 1 сервер |
| **Установка** | Встроен (npm-пакет) | Отдельный сервис + конфиг | Встроен |
| **Типизация** | End-to-end (Drizzle → Zod → Hono) | Runtime (PHP types) | Нет |
| **Восстановление** | cp файла + systemctl start | pg_restore | cp файлов |

### Ключевые trade-offs

**FrostDeploy vs Coolify:**
- Coolify покрывает multi-server, multi-tenant, 350+ сервисов — но требует PG + Redis + 2 GB RAM
- FrostDeploy оптимизирован для single-server, single-user с нулевым overhead хранилища
- Путь миграции на PG заложен через Drizzle при достижении лимитов

**FrostDeploy vs CapRover:**
- CapRover использует JSON-файлы без транзакций и с глобальным мьютексом (все деплои последовательны)
- FrostDeploy предлагает per-project мьютекс (параллельные деплои разных проектов) и ACID-транзакции
- SQLite строго превосходит JSON-хранилище в целостности данных и производительности запросов

---

## Версионирование

| Версия | Дата | Изменения |
|---|---|---|
| 1.0 | 2026-03-31 | Первоначальная версия: 6 таблиц, 11 индексов, полная документация |

## Примечания по согласованности

### Соответствие PRD.md

| PRD-требование | Покрытие в схеме |
|---|---|
| FR-200: Создание проекта | Таблица `projects` — все поля из PRD |
| FR-207: Зашифрованные env vars | Таблица `env_variables` + AES-256-GCM |
| FR-302: Per-project mutex | Таблица `deploy_locks` |
| FR-307: История деплоев | Таблица `deployments` — все поля |
| FR-600: Пароль SHA-256 | `settings.admin_password_hash` |
| FR-601: HMAC-cookie | `settings.session_secret` (незашифрован, см. раздел 4.5) |
| FR-700: Setup Wizard | `settings.setup_completed` |
| US-011: Привязка домена | Таблица `domains` |
| NFR-302: AES-256 enc | Раздел 8 |
| NFR-400: WAL-режим | Раздел 1, PRAGMA-конфигурация |

### Соответствие TechStack.md

| TechStack-решение | Реализация в схеме |
|---|---|
| SQLite + WAL | Движок БД, PRAGMA-конфигурация |
| Drizzle ORM | Определения таблиц в TypeScript |
| better-sqlite3 | Драйвер (через Drizzle) |
| drizzle-zod | Генерация Zod-валидаторов из схемы |
| drizzle-kit | Автогенерация миграций |

### Глоссарий (из PRD)

Все термины PRD-глоссария корректно отражены в схеме:
- **Build Engine** → поля `build_cmd`, `start_cmd`, `output_dir` в `projects`
- **Commit SHA** → `current_sha` (projects), `commit_sha` (deployments)
- **Модель двух директорий** → `src_dir`, `runtime_dir` в `projects`
- **Per-project lock** → таблица `deploy_locks`
- **PAT** → `settings.github_pat` (зашифрован)
- **WAL** → PRAGMA-конфигурация
