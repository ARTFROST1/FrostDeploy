# FrostDeploy — Исследование универсальной self-hosted платформы деплоя

> **Дата**: 31 марта 2026  
> **Автор**: @artfrost  
> **Статус**: Исследование / RFC  
> **Рабочее название**: FrostDeploy

---

## Содержание

1. [Введение и цель исследования](#1-введение-и-цель-исследования)
2. [Анализ текущих админ-панелей](#2-анализ-текущих-админ-панелей)
3. [Общие паттерны](#3-общие-паттерны)
4. [Анализ конкурентов](#4-анализ-конкурентов)
5. [Проектирование архитектуры универсальной платформы](#5-проектирование-архитектуры-универсальной-платформы)
6. [Детектирование фреймворков](#6-детектирование-фреймворков)
7. [Процесс деплоя](#7-процесс-деплоя)
8. [Процесс настройки проекта (user flow)](#8-процесс-настройки-проекта-user-flow)
9. [Управление доменами](#9-управление-доменами)
10. [Технологический стек платформы](#10-технологический-стек-платформы)
11. [Отличия от конкурентов](#11-отличия-от-конкурентов)
12. [Риски и вызовы](#12-риски-и-вызовы)
13. [MVP скоуп](#13-mvp-скоуп)
14. [Будущие фичи](#14-будущие-фичи)
15. [Заключение](#15-заключение)

---

## 1. Введение и цель исследования

В двух существующих проектах — **LaVillaPine** (Astro SSR на VDS) и **SFOTKAI** (SolidStart админка на VDS) — реализованы собственные админ-панели для управления деплоем. Обе панели решают одну и ту же задачу: дать возможность деплоить код через веб-интерфейс без SSH-доступа к серверу.

**Проблема**: логика деплоя дублируется в каждом проекте. При добавлении нового проекта на VDS придётся снова писать админку с нуля или копировать код.

**Цель исследования**: спроектировать универсальную self-hosted платформу деплоя (условное название — **FrostDeploy**), которая:

- Запускается как отдельный сервис на VDS
- Управляет деплоем любых Node.js-проектов
- Заменяет встроенные админки в LaVillaPine и SFOTKAI
- Предоставляет единый дашборд для всех проектов
- Работает по принципу «мини-Vercel на своём сервере»

---

## 2. Анализ текущих админ-панелей

### 2.1. LaVillaPine Admin (Astro SSR)

**Стек**: Astro SSR + Node standalone mode + Caddy reverse proxy + systemd

#### Архитектура

- **Модель двух директорий**: `/var/www/lavillapine-src` (git clone, сборка) → rsync → `/var/www/lavillapine` (рантайм)
- Astro middleware защищает маршруты `/admin/*` и `/api/admin/*`
- **Аутентификация**: SHA-256 хеш пароля в env-переменной, HMAC-SHA256 подписанные cookie-сессии (Web Crypto API), TTL 24 часа, rate-limit 5 попыток/мин/IP
- **Админка встроена в сам Astro-проект** — один процесс, один порт (4321)

#### Процесс деплоя

```
1. POST /api/admin/deploy/ с опциональным {sha}
2. Защита от параллельных деплоев (in-memory флаг `deploying`, возвращает 409)
3. git fetch origin → git pull origin main (или git checkout {sha})
4. npm ci --omit=dev → npm run build
5. rsync -a --delete dist/ в рантайм-директорию → cp package.json → npm ci --omit=dev в рантайме
6. Ответ отправляется клиенту ПЕРВЫМ, затем setTimeout(() => systemctl restart, 500ms)
7. Сервис убивает сам себя → systemd перезапускает → страница автообновляется через 5 секунд
```

#### Ключевая проблема

Админка является частью приложения. Когда она запускает деплой, она перезапускает сама себя. Трюк с `setTimeout` — это обходное решение (workaround), а не архитектурное решение.

#### Функциональность

| Функция | Реализация |
|---|---|
| Мониторинг системы | CPU (через `/proc/stat`), RAM (`/proc/meminfo`), диск (`df -h`), статус сервиса (`systemctl`), версия Node, текущий SHA |
| Коммиты | GitHub API с PAT, кеш 60 сек, последние 15, подсветка текущего деплоя |
| Трафик | Парсинг JSON access log Caddy, фильтрация по хосту, почасовой график (Chart.js), статус-коды, топ страниц (фильтрация ботов/ассетов) |
| Логи | `journalctl` для systemd-юнита сервиса |
| Инструменты | Просмотр sitemap, IndexNow push, быстрые ссылки |
| UI | Одностраничный дизайн — всё на одной Astro-странице с inline `<script>` блоками |

---

### 2.2. SFOTKAI Admin (SolidStart SPA)

**Стек**: SolidStart 1.0 + Vinxi + Tailwind + Kobalte + TanStack Table + ky HTTP client

#### Архитектура

- **Отдельный пакет** (`@sfotkai/admin`) в монорепозитории
- SPA-режим (SSR отключён), node-server пресет, порт 4323
- **Аутентификация**: JWT Bearer токен в localStorage, реактивные SolidJS-сигналы, общение с backend API
- **Админка — это ОТДЕЛЬНЫЙ сервис** от основного API/бота/миниапп

#### Процесс деплоя

```
1. Запрос к api/admin/deploy на бэкенд API
2. Бэкенд выполняет: git pull → npm ci → npm run build → rsync → systemctl restart
3. Вывод деплоя отображается как стриминг шагов
4. После деплоя: автообновление системной информации и списка коммитов через 5 секунд
```

#### Функциональность

| Функция | Реализация |
|---|---|
| Навигация | Полное SPA с боковой панелью (12 маршрутов) |
| Дашборд | Статистика (пользователи, генерации, выручка, активные сегодня) из backend API |
| Деплой | Карточки системы (RAM, Disk, Uptime, Commit SHA), бейджи статусов сервисов, список коммитов с кнопками деплоя, консоль вывода деплоя, секция логов с выбором сервиса (API, Bot, MiniApp, Admin, Caddy) |
| Трафик | Аналитика source/medium/campaign из бэкенда (не из логов) |
| Обслуживание | Переключатель maintenance mode с сообщением и плановым временем окончания |
| Компоненты | DataTable, Modal, ConfirmDialog, Pagination, StatCard |

#### Ключевое отличие от LaVillaPine

Админка — отдельный сервис, аутентификация на JWT (не cookie), мониторинг нескольких сервисов, трафик из БД приложения, а не из логов.

---

## 3. Общие паттерны

Несмотря на различия в стеке, оба проекта используют одни и те же инфраструктурные паттерны:

| Паттерн | LaVillaPine | SFOTKAI | Комментарий |
|---|:---:|:---:|---|
| Модель двух директорий (src + runtime) | ✅ | ✅ | Разделение исходников и рантайма |
| rsync для чистого деплоя | ✅ | ✅ | Атомарная замена файлов |
| Git-based деплой (pull/checkout по SHA) | ✅ | ✅ | Откат к любому коммиту |
| systemd для управления процессами | ✅ | ✅ | Автоперезапуск, логирование |
| Caddy для reverse proxy + SSL | ✅ | ✅ | Автоматические Let's Encrypt сертификаты |
| Защита от параллельных деплоев | ✅ (in-memory флаг) | ✅ | Предотвращение конфликтов |
| Системные метрики (CPU/RAM/Disk) | ✅ (чтение /proc) | ✅ (отдельный system API) | Мониторинг здоровья сервера |
| Коммиты через GitHub API | ✅ (PAT, кеш) | ✅ | Выбор коммита для деплоя |
| Логи сервера через journalctl | ✅ | ✅ (мульти-сервис) | Просмотр логов без SSH |
| Проблема самоперезапуска | ✅ (setTimeout hack) | ⚠️ (менее критично) | Решается вынесением в отдельный сервис |

**Вывод**: паттерны настолько совпадают, что извлечение их в отдельную платформу — естественный шаг эволюции.

---

## 4. Анализ конкурентов

### 4.1. Vercel

- **Тип**: Managed cloud PaaS, serverless-first
- **Детекция**: Автоматическое определение фреймворка из `package.json` и конфиг-файлов
- **Деплой**: Каждый деплой = иммутабельный артефакт, распределённый по edge CDN + serverless functions
- **Методы деплоя**: git push, CLI (`vercel --prod`), deploy hooks, REST API
- **Откат**: Моментальный — промоутинг предыдущего деплоймента
- **Изоляция**: Платформа ПОЛНОСТЬЮ отделена от приложений (работает на инфраструктуре Vercel)
- **Env vars**: Раздельные для Production/Preview/Development

### 4.2. Render

- **Тип**: Managed cloud PaaS, container-based
- **Детекция**: Пользователь указывает build/start команды (без магического авто-определения)
- **Деплой**: 3-шаговый пайплайн: build → pre-deploy (миграции) → start
- **Zero-downtime**: Новый контейнер стартует → LB переключается → старый получает SIGTERM
- **Отличия**: Деплой по commit SHA, пропуск деплоя через `[skip render]`
- **IaC**: Infrastructure-as-Code через `render.yaml` Blueprints
- **Мониторинг**: Syslog streaming + OpenTelemetry + метрики дашборд

### 4.3. Heroku

- **Тип**: Managed cloud PaaS, изобрёл 12-factor app
- **Детекция**: Buildpacks автоматически определяют язык из файлов проекта
- **Модель**: buildpack → slug (иммутабельный артефакт) → dyno (эфемерный контейнер)
- **Деплой**: `git push heroku main` — основной метод
- **Откат**: Нумерованные релизы с моментальным откатом (`heroku releases:rollback`)
- **Пайплайны**: staging → production промоутинг
- **Env vars**: Config vars, инжектятся при старте dyno

### 4.4. Coolify (self-hosted)

- **Тип**: Self-hosted open-source PaaS на собственных серверах
- **Архитектура**: Docker-based, деплоит всё что имеет Dockerfile/Compose
- **Деплой**: Push to deploy через git (GitHub/GitLab/Bitbucket/Gitea)
- **Proxy**: Caddy или Traefik для reverse proxy + auto SSL
- **Важно**: Работает НА том же сервере, что и приложения (Laravel + UI)
- **Масштабирование**: Single server, multi-server, Docker Swarm
- **Оценка**: Самый функционально богатый self-hosted вариант

### 4.5. CapRover (self-hosted)

- **Тип**: Docker Swarm обёртка с веб-интерфейсом
- **Детекция**: Файл `captain-definition` для определения фреймворка
- **DNS**: Wildcard DNS паттерн для автоматических поддоменов
- **Деплой**: CapRover CLI отправляет git-коммиты на сервер для сборки
- **Оценка**: Проще Coolify, но менее функционален

### Сравнительная таблица

| Критерий | Vercel | Render | Heroku | Coolify | CapRover | **FrostDeploy** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Self-hosted | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Docker обязателен | — | — | — | ✅ | ✅ | ❌ |
| Авто-детекция фреймворка | ✅ | ❌ | ✅ | ⚠️ | ⚠️ | ✅ |
| Zero-downtime deploy | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ (v2) |
| Моментальный откат | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Встроенная аналитика трафика | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Мониторинг системы | ❌ (managed) | ✅ | ❌ | ✅ | ⚠️ | ✅ |
| IaC / конфиг-файл | ✅ (`vercel.json`) | ✅ (`render.yaml`) | ✅ (`Procfile`) | ⚠️ | ⚠️ | ✅ (v2) |
| Минимальные ресурсы | — | — | — | Средние (Docker + PG) | Средние (Docker) | Низкие (Node + SQLite) |
| Стоимость | $20+/мес | $7+/мес | $7+/мес | $0 (VDS) | $0 (VDS) | $0 (VDS) |

---

## 5. Проектирование архитектуры универсальной платформы

### Основные принципы

1. **Платформа работает как независимый сервис** — отдельный процесс, отдельный порт, никогда не перезапускается при деплое пользовательских приложений
2. **Self-hosted на VDS** — работает на собственных серверах пользователя (как Coolify/CapRover)
3. **Framework-agnostic** — детектирует и собирает любой Node.js-проект (Astro, Next.js, Nuxt, SvelteKit, Express и т.д.)
4. **Git-native** — подключается к GitHub-репозиториям, деплоит по коммиту
5. **Модель двух директорий** — проверенный паттерн из существующих проектов
6. **Caddy для маршрутизации** — авто-SSL, reverse proxy для каждого проекта
7. **systemd для управления процессами** — один сервис на проект

### Высокоуровневая архитектура

```
FrostDeploy (независимый сервис, порт 9000)
│
├── Web UI (админ-дашборд)
│   ├── Список проектов
│   ├── Добавление проекта (GitHub URL + домен)
│   ├── На проект: коммиты, деплой, логи, метрики
│   └── Настройки (GitHub PAT, конфигурация сервера)
│
├── API-слой
│   ├── /api/projects              — CRUD операции
│   ├── /api/projects/:id/deploy   — запуск деплоя
│   ├── /api/projects/:id/commits  — коммиты из GitHub
│   ├── /api/projects/:id/logs     — journalctl
│   ├── /api/projects/:id/metrics  — CPU/RAM/disk
│   └── /api/system                — глобальный статус системы
│
├── Build Engine
│   ├── Детектор фреймворка (package.json → build/start команды)
│   ├── Build-пайплайн (git clone/pull → npm install → build)
│   ├── Деплоер артефактов (rsync в рантайм-директорию)
│   └── Менеджер сервисов (создание/перезапуск systemd-юнитов)
│
├── Менеджер Reverse Proxy
│   ├── Генератор конфигов Caddy
│   ├── Маппинг домен → порт
│   └── Управление SSL-сертификатами (авто через Caddy)
│
└── База данных (SQLite)
    ├── Projects   (id, name, repo_url, domain, port, framework, ...)
    ├── Deployments (id, project_id, commit_sha, status, logs, duration)
    └── Settings    (github_pat, ...)
```

### Схема взаимодействия компонентов

```
┌──────────────────────────────────────────────────────────────────┐
│                        VDS Server                                │
│                                                                  │
│  ┌─────────────────────┐     ┌──────────────────────────────┐   │
│  │   FrostDeploy:9000  │     │        Caddy                 │   │
│  │   (Node.js + SQLite)├────►│   *.domain.com → 127.0.0.1:X │   │
│  │                     │     │   frostdeploy.domain → :9000  │   │
│  │  ┌───────┐ ┌─────┐ │     └──────────┬───────────────────┘   │
│  │  │Web UI │ │ API │ │                 │                        │
│  │  └───────┘ └──┬──┘ │                 │                        │
│  │               │     │     ┌──────────▼───────────────────┐   │
│  │  ┌────────────▼──┐  │     │        Проекты               │   │
│  │  │ Build Engine  │  │     │                               │   │
│  │  │  ┌──────────┐ │  │     │  ┌─────────────┐             │   │
│  │  │  │ Detector │ │  │     │  │ LaVillaPine │ :4321       │   │
│  │  │  ├──────────┤ │  │     │  │ (systemd)   │             │   │
│  │  │  │ Builder  │ │  │     │  ├─────────────┤             │   │
│  │  │  ├──────────┤ │  │     │  │ SFOTKAI API │ :4322       │   │
│  │  │  │ Deployer │ │  │     │  │ (systemd)   │             │   │
│  │  │  ├──────────┤ │  │     │  ├─────────────┤             │   │
│  │  │  │ systemd  │─┼──┼────►│  │ Project N   │ :43XX       │   │
│  │  │  │ manager  │ │  │     │  │ (systemd)   │             │   │
│  │  │  └──────────┘ │  │     │  └─────────────┘             │   │
│  │  └───────────────┘  │     └──────────────────────────────┘   │
│  └─────────────────────┘                                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Детектирование фреймворков

### Приоритетный алгоритм

```
1. Прочитать package.json из репозитория
2. Проверить dependencies / devDependencies:
   ├── "astro"           → Astro
   │   build: npm run build
   │   start: node dist/server/entry.mjs ИЛИ static
   ├── "next"            → Next.js
   │   build: npm run build
   │   start: npm start
   ├── "@sveltejs/kit"   → SvelteKit
   │   build: npm run build
   │   start: node build
   ├── "nuxt"            → Nuxt
   │   build: npm run build
   │   start: node .output/server/index.mjs
   ├── "express"         → Node.js server (Express)
   ├── "fastify"         → Node.js server (Fastify)
   └── "koa"             → Node.js server (Koa)
       start: npm start

3. Проверить наличие конфиг-файлов:
   ├── astro.config.*    → Astro
   ├── next.config.*     → Next.js
   ├── svelte.config.*   → SvelteKit
   └── nuxt.config.*     → Nuxt

4. Проверить наличие Dockerfile → Docker-based деплой

5. Fallback: статический сайт
   build: npm run build
   serve: dist/ через Caddy (static file server)
```

### Таблица детекции

| Фреймворк | Маркер в dependencies | Конфиг-файл | Build-команда | Start-команда | Выходная директория |
|---|---|---|---|---|---|
| Astro (SSR) | `astro` | `astro.config.*` | `npm run build` | `node dist/server/entry.mjs` | `dist/` |
| Astro (Static) | `astro` | `astro.config.*` | `npm run build` | — (static) | `dist/` |
| Next.js | `next` | `next.config.*` | `npm run build` | `npm start` | `.next/` |
| SvelteKit | `@sveltejs/kit` | `svelte.config.*` | `npm run build` | `node build` | `build/` |
| Nuxt | `nuxt` | `nuxt.config.*` | `npm run build` | `node .output/server/index.mjs` | `.output/` |
| Express / Fastify / Koa | `express` / `fastify` / `koa` | — | — | `npm start` | — |
| Статический сайт | — | — | `npm run build` | — (Caddy static) | `dist/` или `build/` |

### 6.1. Поддерживаемые языки и фреймворки

FrostDeploy не ограничивается только Node.js. Ниже — полный план поддержки языков и фреймворков по версиям:

#### Node.js экосистема (primary, полная поддержка с v0.1)

| Фреймворк | Тип | Маркер | Примечание |
|---|---|---|---|
| **Astro** (SSR + Static) | Fullstack / Static | `astro` в dependencies | Определение SSR vs Static по `output` в конфиге |
| **Next.js** | Fullstack | `next` в dependencies | standalone mode для self-hosted |
| **Nuxt** | Fullstack | `nuxt` в dependencies | `.output/server/index.mjs` |
| **SvelteKit** | Fullstack | `@sveltejs/kit` в dependencies | adapter-node |
| **Remix** | Fullstack | `@remix-run/node` в dependencies | express adapter |
| **Express / Fastify / Koa / NestJS** | API / Server | Соответствующий пакет в deps | `npm start` |
| **Любой npm-проект с start-скриптом** | Универсальный | `scripts.start` в package.json | Fallback-стратегия |

#### Python (v0.2)

| Фреймворк | Маркер | Build | Start |
|---|---|---|---|
| **Django** | `django` в requirements.txt | `pip install -r requirements.txt` + `collectstatic` | `gunicorn {project}.wsgi` |
| **Flask** | `flask` в requirements.txt | `pip install -r requirements.txt` | `gunicorn app:app` |
| **FastAPI** | `fastapi` в requirements.txt / pyproject.toml | `pip install -r requirements.txt` | `uvicorn main:app --host 0.0.0.0` |
| **Любой Python-проект** | `requirements.txt` или `pyproject.toml` | pip install | Gunicorn / Uvicorn |

> **Стратегия сборки**: через Nixpacks → Docker-образ. Nixpacks автоопределяет Python-проект и генерирует оптимальный Dockerfile.

#### Go (v0.3)

| Тип | Маркер | Build | Start |
|---|---|---|---|
| **Любой Go-проект** | `go.mod` | `go build -o app .` | `./app` (скомпилированный бинарник) |

> **Стратегия**: Nixpacks → multi-stage Docker build (builder + scratch/alpine). Go компилируется в единственный бинарник — минимальный образ.

#### Статические сайты (day 1, v0.1)

| Генератор | Маркер | Build | Serve |
|---|---|---|---|
| **Hugo** | `hugo` CLI или `config.toml` | `hugo --minify` | Caddy static file server |
| **Jekyll** | `Gemfile` с `jekyll` | `bundle exec jekyll build` | Caddy static file server |
| **Eleventy** | `@11ty/eleventy` в deps | `npx eleventy` | Caddy static file server |
| **Vite static** | `vite` в deps, нет SSR | `npm run build` | Caddy static file server |
| **Любой static** | Нет server dependencies | `npm run build` (если есть) | Caddy static file server |

> **Ключевое преимущество**: статические сайты обслуживаются напрямую Caddy без запуска Node.js-процесса. Это экономит RAM и CPU.

#### Rust (v0.4)

| Тип | Маркер | Build | Start |
|---|---|---|---|
| **Cargo-проект** | `Cargo.toml` | `cargo build --release` | `./target/release/{binary}` |

> **Стратегия**: Nixpacks → multi-stage Docker build. Rust компилируется долго, но результат — один бинарник.

#### PHP (v0.4)

| Фреймворк | Маркер | Build | Start |
|---|---|---|---|
| **Laravel** | `composer.json` с `laravel/framework` | `composer install` + `php artisan` | FrankenPHP или Caddy PHP |
| **WordPress** | `wp-config.php` или `composer.json` с `wordpress` | `composer install` | FrankenPHP / Caddy PHP |

> **Стратегия**: FrankenPHP (встроен в Caddy) позволяет запускать PHP без отдельного php-fpm.

#### Docker (v0.3)

| Тип | Маркер | Build | Start |
|---|---|---|---|
| **Любой проект с Dockerfile** | `Dockerfile` в корне | `docker build -t {name}:{sha} .` | `docker run` с маппингом портов |

> **Fallback**: если в проекте есть Dockerfile и FrostDeploy не может автоопределить фреймворк, используется Docker-based деплой.

#### Приоритет детекции (обновлённый)

```
1. package.json        → Node.js экосистема (наш оптимизированный путь)
2. requirements.txt    → Python (Nixpacks)
3. pyproject.toml      → Python (Nixpacks)
4. go.mod              → Go (Nixpacks)
5. Cargo.toml          → Rust (Nixpacks)
6. composer.json       → PHP (Nixpacks/FrankenPHP)
7. Dockerfile          → Docker (прямой build)
8. Нет маркеров        → Static fallback (Caddy file server)
```

#### Матрица версий поддержки

| Язык / Фреймворк | v0.1 (MVP) | v0.2 | v0.3 | v0.4 |
|---|:---:|:---:|:---:|:---:|
| Node.js (все фреймворки) | ✅ | ✅ | ✅ | ✅ |
| Статические сайты | ✅ | ✅ | ✅ | ✅ |
| Python (Django, Flask, FastAPI) | — | ✅ | ✅ | ✅ |
| Go | — | — | ✅ | ✅ |
| Docker (Dockerfile) | — | — | ✅ | ✅ |
| Rust | — | — | — | ✅ |
| PHP (Laravel, WordPress) | — | — | — | ✅ |

---

### Определение SSR vs Static для Astro

```javascript
// Читаем astro.config.mjs
// Если output: 'server' или output: 'hybrid' → SSR (нужен Node.js процесс)
// Если output: 'static' или отсутствует → Static (отдаём через Caddy)

// Дополнительно проверяем наличие adapter:
// @astrojs/node → SSR, node standalone
// @astrojs/vercel → не поддерживается (managed platform)
// отсутствует → static
```

---

## 7. Процесс деплоя

### По��аговый алгоритм

```
Пользователь нажимает "Деплой" →

 1. Заблокировать проект (предотвращение параллельных деплоев)
 2. В SRC_DIR:
    ├── git fetch origin
    └── git checkout {sha} ИЛИ git pull origin main
 3. npm ci
 4. Фреймворк-специфичная команда сборки (npm run build)
 5. rsync -a --delete {build_output}/ RUNTIME_DIR/
 6. cp package.json package-lock.json → RUNTIME_DIR/
 7. cd RUNTIME_DIR && npm ci --omit=dev
 8. systemctl restart {project-service}
 9. Health check: curl http://127.0.0.1:{port}/
10. Обновить запись деплоя (success/fail, длительность, логи)
11. Разблокировать проект
```

### Диаграмма состояний деплоя

```
┌──────────┐    запрос     ┌──────────┐   клонирование   ┌──────────┐
│  IDLE    ├──────────────►│ LOCKED   ├─────────────────►│ FETCHING │
└──────────┘               └──────────┘                  └────┬─────┘
     ▲                                                        │
     │                                                        ▼
┌────┴─────┐   health OK   ┌──────────┐    rsync        ┌──────────┐
│ DEPLOYED ◄───────────────┤RESTARTING◄─────────────────┤ BUILDING │
└──────────┘               └──────────┘                  └──────────┘
     ▲                          │
     │          health FAIL     ▼
     │                     ┌──────────┐
     └─────────────────────┤  FAILED  │
       (откат к пред. SHA) └──────────┘
```

### Логирование деплоя

Каждый шаг пишется в реальном времени через Server-Sent Events (SSE):

```
[12:00:01] ▶ Запуск деплоя коммита a1b2c3d
[12:00:01] ⏳ git fetch origin...
[12:00:03] ✅ git fetch завершён
[12:00:03] ⏳ git checkout a1b2c3d...
[12:00:03] ✅ Checkout выполнен
[12:00:03] ⏳ npm ci...
[12:00:15] ✅ Зависимости установлены (12 сек)
[12:00:15] ⏳ npm run build...
[12:00:28] ✅ Сборка завершена (13 сек)
[12:00:28] ⏳ rsync в рантайм-директорию...
[12:00:29] ✅ rsync завершён
[12:00:29] ⏳ npm ci --omit=dev в рантайме...
[12:00:35] ✅ Production-зависимости установлены
[12:00:35] ⏳ systemctl restart project-service...
[12:00:36] ⏳ Health check...
[12:00:37] ✅ Health check пройден (HTTP 200)
[12:00:37] 🎉 Деплой завершён успешно за 36 сек
```

---

## 8. Процесс настройки проекта (user flow)

### Пошаговый сценарий

```
 1. Пользователь открывает дашборд FrostDeploy
 2. Нажимает "Новый проект"
 3. Вставляет GitHub repo URL (напр. https://github.com/user/repo)
 4. Платформа детектирует фреймворк, показывает определённый стек
 5. Пользователь подтверждает/корректирует build & start команды
 6. Пользователь вводит кастомный домен
 7. Платформа показывает DNS-записи для настройки:
    ├── A record:     domain.com     → IP сервера
    └── CNAME record: www.domain.com → domain.com
 8. Пользователь настраивает DNS у регистратора
 9. Платформа проверяет DNS-пропагацию
10. Платформа создаёт: systemd-сервис, конфиг Caddy, директории
11. Автоматически запускается первый build & deploy
12. Платформа показывает прогресс деплоя в реальном времени
13. Готово — сайт доступен по https://domain.com
```

### UI Flow (wireframe)

```
┌─────────────────────────────────────────────────────────┐
│  FrostDeploy                              [Settings] [+]│
├─────────┬───────────────────────────────────────────────┤
│         │                                               │
│ Projects│   ┌─── Новый проект ───────────────────────┐  │
│         │   │                                        │  │
│ > LaVil │   │  GitHub URL:                           │  │
│   SFOT  │   │  ┌──────────────────────────────────┐  │  │
│   Blog  │   │  │ https://github.com/user/repo     │  │  │
│         │   │  └──────────────────────────────────┘  │  │
│         │   │                                        │  │
│         │   │  🔍 Обнаружен: Astro SSR (node)       │  │
│         │   │                                        │  │
│         │   │  Build:  npm run build                 │  │
│         │   │  Start:  node dist/server/entry.mjs    │  │
│         │   │  Port:   4325 (авто)                   │  │
│         │   │                                        │  │
│         │   │  Домен:                                │  │
│         │   │  ┌──────────────────────────────────┐  │  │
│         │   │  │ mysite.com                       │  │  │
│         │   │  └──────────────────────────────────┘  │  │
│         │   │                                        │  │
│         │   │  Env Variables:                        │  │
│         │   │  ┌────────────┐ ┌──────────────────┐  │  │
│         │   │  │ DATABASE_  │ │ /path/to/db      │  │  │
│         │   │  └────────────┘ └──────────────────┘  │  │
│         │   │  [+ Добавить переменную]               │  │
│         │   │                                        │  │
│         │   │           [Создать проект]              │  │
│         │   └────────────────────────────────────────┘  │
│         │                                               │
└─────────┴───────────────────────────────────────────────┘
```

---

## 9. Управление доменами

### Назначение портов

Каждый проект получает уникальный порт, автоматически назначаемый из пула:

```
Диапазон портов: 4321 — 4399 (до 79 проектов на сервер)
Автоназначение: берётся первый свободный порт из диапазона
Хранение: поле port в таблице Projects (SQLite)
```

### Генерация конфигурации Caddy

Для каждого проекта автоматически генерируется блок Caddyfile:

```caddyfile
# Проект: LaVillaPine
# Создан: 2026-03-31
lavillapine.com {
    redir https://www.lavillapine.com{uri} permanent
}

www.lavillapine.com {
    encode gzip zstd
    reverse_proxy 127.0.0.1:4321
    log {
        output file /var/log/caddy/lavillapine-access.log {
            roll_size 50mb
            roll_keep 5
        }
        format json
    }
}
```

### DNS-верификация

```javascript
// Платформа проверяет DNS перед активацией проекта:
// 1. dig +short A domain.com → должен вернуть IP сервера
// 2. dig +short CNAME www.domain.com → должен вернуть domain.com
// 3. Повторная проверка каждые 30 сек до 10 мин
// 4. После подтверждения — автоматическая выдача SSL через Caddy (Let's Encrypt)
```

### Управление SSL

- SSL полностью управляется Caddy (автоматический ACME через Let's Encrypt)
- Не требуется никаких ручных действий — сертификаты выпускаются при первом запросе
- Автообновление сертификатов встроено в Caddy
- При невозможности выдачи (DNS не настроен) — Caddy сообщает об ошибке, платформа показывает статус

---

## 10. Технологический стек платформы

### Выбор технологий

| Слой | Технология | Обоснование |
|---|---|---|
| **Runtime** | Node.js | Тот же рантайм, что и у деплоимых приложений — минимизация зависимостей |
| **API-фреймворк** | Hono или Fastify | Легковесный, быстрый, TypeScript-first |
| **UI** | React или Solid + Tailwind | SPA, обслуживается из того же процесса |
| **База данных** | SQLite (через better-sqlite3 или Drizzle) | Zero-config, идеально для single-server |
| **Процессы** | systemd | Нативный для Linux, автоперезапуск, cgroups |
| **Reverse proxy** | Caddy | Auto-SSL, простая конфигурация, JSON API |
| **Рантайм деплоя** | Прямые child_process + rsync | Без Docker, минимум overhead |
| **Стриминг логов** | Server-Sent Events (SSE) | Простой real-time канал без WebSocket |
| **Аутентификация** | HMAC-SHA256 cookie sessions | Пр��веренный паттерн из LaVillaPine |
> **Nixpacks (опциональная стратегия сборки)**: По результатам анализа кода Coolify (см. [COMPETITORS-CODE-ANALYSIS.md](./COMPETITORS-CODE-ANALYSIS.md)), рассматривается интеграция **Nixpacks** — инструмента автодетекции языка и генерации Docker-образов. Nixpacks анализирует исходный код проекта, автоматически определяет язык (Python, Go, Rust, Ruby, Java, .NET, PHP и 20+ других) и создаёт оптимизированный Dockerfile без ручной конфигурации. Это позволяет FrostDeploy поддерживать мульти-язычные проекты без написания собственных buildpack'ов для каждого языка. В MVP (v0.1) используется встроенная детекция для Node.js; начиная с v0.2 Nixpacks подключается для Python и далее расширяется.
### Nixpacks как опциональная стратегия сборки

> **Источник**: анализ кода Coolify (см. `COMPETITORS-CODE-ANALYSIS.md`)

**Nixpacks** — это open-source инструмент (разработан Railway), который автоматически определяет язык/фреймворк проекта и генерирует оптимальный Docker-образ. Coolify использует Nixpacks как основную стратегию сборки.

**Как это работает**:
```
nixpacks build . -o image-name
├── Анализирует файлы проекта (package.json, requirements.txt, go.mod, etc.)
├── Определяет язык и фреймворк
├── Автоматически генерирует multi-stage Dockerfile
├── Собирает Docker-образ с правильными зависимостями
└── Поддерживает: Node.js, Python, Go, Rust, Ruby, Java, PHP, .NET, Haskell, Zig, и др.
```

**Применение в FrostDeploy**:
- **Node.js** (v0.1): собственный нативный путь (без Docker, без Nixpacks) — быстрее, легче
- **Python, Go, Rust, PHP** (v0.2–v0.4): Nixpacks автогенерирует Docker-образ → `docker run`
- **Преимущество**: не нужно писать свой код детекции для каждого языка — Nixpacks покрывает ~20 языков из коробки
- **Требование**: Docker Engine должен быть установлен для не-Node.js проектов

| Язык | Без Nixpacks (свой код) | С Nixpacks |
|---|---|---|
| Node.js | ✅ Оптимизированный нативный путь | Возможен, но избыточен |
| Python | ❌ Нужен свой detector + builder | ✅ Автоматически |
| Go | ❌ Нужен свой detector + builder | ✅ Автоматически |
| Rust | ❌ Нужен свой detector + builder | ✅ Автоматически |
| PHP | ❌ Нужен свой detector + builder | ✅ Автоматически |

**Вывод**: Nixpacks — стратегический инструмент для мульти-языковой поддержки FrostDeploy без экспоненциального роста кодовой базы.

### Структура проекта (предварительная)

```
frostdeploy/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Точка входа
│   ├── config.ts             # Конфигурация платформы
│   ├── db/
│   │   ├── schema.ts         # SQLite-схема (Drizzle)
│   │   └── migrations/       # Миграции
│   ├── api/
│   │   ├── projects.ts       # CRUD проектов
│   │   ├── deploy.ts         # Запуск/статус деплоя
│   │   ├── commits.ts        # GitHub коммиты
│   │   ├── logs.ts           # journalctl логи
│   │   ├── metrics.ts        # Системные метрики
│   │   └── auth.ts           # Аутентификация
│   ├── engine/
│   │   ├── detector.ts       # Детекция фреймворка
│   │   ├── builder.ts        # Build-пайплайн
│   │   ├── deployer.ts       # rsync + файловые операции
│   │   └── service.ts        # systemd-менеджер
│   ├── proxy/
│   │   └── caddy.ts          # Генерация конфига Caddy
│   └── ui/                   # Фронтенд (SPA)
│       ├── App.tsx
│       ├── pages/
│       └── components/
├── templates/
│   ├── systemd.service.ejs   # Шаблон systemd-юнита
│   └── caddyfile.ejs         # Шаблон блока Caddy
└── data/
    └── frostdeploy.db        # SQLite база
```

### Схема базы данных

```sql
CREATE TABLE projects (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    name          TEXT NOT NULL,
    repo_url      TEXT NOT NULL,
    branch        TEXT NOT NULL DEFAULT 'main',
    domain        TEXT UNIQUE,
    port          INTEGER UNIQUE NOT NULL,
    framework     TEXT,          -- 'astro-ssr', 'nextjs', 'static', etc.
    build_cmd     TEXT,          -- 'npm run build'
    start_cmd     TEXT,          -- 'node dist/server/entry.mjs'
    output_dir    TEXT,          -- 'dist/'
    env_vars      TEXT,          -- JSON: {"KEY": "value", ...}
    src_dir       TEXT NOT NULL, -- /var/www/{name}-src
    runtime_dir   TEXT NOT NULL, -- /var/www/{name}
    service_name  TEXT NOT NULL, -- systemd unit name
    current_sha   TEXT,
    status        TEXT NOT NULL DEFAULT 'created', -- created, active, deploying, error
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE deployments (
    id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
    project_id    TEXT NOT NULL REFERENCES projects(id),
    commit_sha    TEXT NOT NULL,
    commit_msg    TEXT,
    status        TEXT NOT NULL DEFAULT 'pending', -- pending, building, deploying, success, failed
    logs          TEXT,          -- Полный лог деплоя
    duration_ms   INTEGER,
    error         TEXT,
    triggered_by  TEXT DEFAULT 'manual', -- manual, webhook, cli
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
    key           TEXT PRIMARY KEY,
    value         TEXT NOT NULL,
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Индексы
CREATE INDEX idx_deployments_project ON deployments(project_id, created_at DESC);
CREATE INDEX idx_projects_domain ON projects(domain);
```

---

## 11. Отличия от конкурентов

### Ключевые дифференциаторы FrostDeploy

| # | Отличие | Описание | vs Coolify | vs CapRover |
|---|---|---|---|---|
| 1 | **Без Docker** | Прямые Node.js-сборки — проще, меньше ресурсов | Coolify требует Docker | CapRover требует Docker Swarm |
| 2 | **Заточен под Node.js/JS** | Не пытается быть всем для всех — оптимизирован для JS-экосистемы | Coolify — универсальный | CapRover — универсальный |
| 3 | **Встроенная аналитика трафика** | Парсинг Caddy access log, визуализация по страницам, статус-кодам, рефереррам | Нет встроенной аналитики | Нет встроенной аналитики |
| 4 | **Встроенный мониторинг** | CPU/RAM/disk на проект через cgroups | Базовые метрики | Минимальные метрики |
| 5 | **Минимальный footprint** | SQLite + Node.js, нет PostgreSQL, Redis, Docker Engine | PostgreSQL + Docker | Docker + Nginx/Traefik |
| 6 | **CLI + Web UI** | Оба интерфейса с первого дня | Web UI + API | Web UI + CLI |

### Позиционирование

```
                    Сложность/Универсальность →
                    
     Простой                                 Сложный
        │                                       │
  ┌─────┤                                       │
  │     │   FrostDeploy                         │
  │Self │   (Node.js, без Docker,               │  Coolify
  │Host │    лёгкий, JS-first)                  │  (Docker, универсальный,
  │     │                                       │   полнофункциональный)
  │     │              CapRover                 │
  │     │              (Docker Swarm,           │
  │     │               средняя сложность)      │
  └─────┤                                       │
        │                                       │
  ┌─────┤                                       │
  │     │                                       │
  │Cloud│   Render          Vercel              │
  │     │   (простой PaaS)  (serverless-first)  │
  │     │                   Heroku              │
  │     │                   (классика)          │
  └─────┤                                       │
        │                                       │
```

---

## 12. Риски и вызо��ы

### 12.1. Безопасность (КРИТИЧНЫЙ)

**Проблема**: Сборка напрямую на хосте (не в контейнерах) означает, что злонамеренный `package.json` может выполнить произвольный код во время `npm install` (через `postinstall`-скрипты).

**Митигация**:
- Запуск сборок от непривилегированного пользователя (отдельный юзер на проект)
- Использование Linux namespaces для частичной изоляции
- `npm ci --ignore-scripts` с ручным запуском допустимых скриптов
- В будущем — опциональная поддержка Docker-сборок для полной изоляции
- Ограничение сети во время сборки (iptables / nftables)

### 12.2. Изоляция ресурсов

**Проблема**: Без контейнеров один проект может исчерпать все ресурсы сервера.

**Митигация**:
- systemd cgroups: `CPUQuota=`, `MemoryMax=`, `MemoryHigh=` в юнит-файлах
- Предупреждения при превышении порогов (80% CPU, 90% RAM)
- Автоматические алерты в Telegram

### 12.3. Управление портами

**Проблема**: Необходимо отслеживать и автоматически назначать уникальные порты.

**Решение**: Пул портов 4321–4399 в SQLite, атомарное назначение через транзакцию.

### 12.4. Управление конфигурацией Caddy

**Проблема**: Программное обновление Caddyfile и перезагрузка.

**Решение**:
- Использование Caddy Admin API (JSON) вместо прямого редактирования Caddyfile
- ИЛИ шаблонная генерация Caddyfile + `caddy reload`
- Версионирование конфигов для отката

### 12.5. Multi-server

**Проблема**: Изначально — только один сервер. Мульти-сервер добавляет значительную сложность.

**Решение**: Отложить на v2. В MVP — только single-server.

### 12.6. Поддержка монорепозиториев

**Проблема**: Проекты в монорепо требуют сборки из поддиректории.

**Решение**: Поле `root_dir` в проекте (по умолчанию `/`), все команды выполняются из этой поддиректории.

### Матрица рисков

| Риск | Вероятность | Влияние | Приоритет | Митигация |
|---|:---:|:---:|:---:|---|
| Выполнение произвольного кода при сборке | Средняя | Критическое | P0 | Непривилегированный юзер + namespaces |
| Исчерпание ресурсов одним проектом | Высокая | Высокое | P0 | systemd cgroups |
| Конфликт портов | Низкая | Среднее | P1 | Атомарное назначение из пула |
| Поломка конфига Caddy | Средняя | Высокое | P1 | Версионирование + валидация |
| Потеря данных SQLite | Низкая | Критическое | P0 | WAL-режим + регулярные бекапы |
| Зависание сборки | Средняя | Среднее | P1 | Таймаут на сборку (10 мин) |

---

## 13. MVP скоуп

### Минимально жизнеспособный продукт (v0.1)

| # | Функция | Описание | Приоритет |
|---|---|---|:---:|
| 1 | Добавление проекта | GitHub URL, ручные build/start команды | P0 |
| 2 | Детекция фреймворка | Автоопределение команд из `package.json` | P0 |
| 3 | Настройка домена | Инструкции DNS, верификация, генерация конфига Caddy | P0 |
| 4 | Деплой по коммиту | Выбор SHA или latest, полный build pipeline | P0 |
| 5 | Логи деплоя в реальном времени | SSE-стриминг шагов сборки | P0 |
| 6 | Системные метрики | CPU, RAM, диск — общие и на проект | P1 |
| 7 | Логи сервисов | Просмотр journalctl через UI | P1 |
| 8 | Список коммитов | GitHub API, выбор коммита для деплоя | P0 |
| 9 | Откат | Деплой предыдущего коммита | P0 |
| 10 | Env-переменные | Per-project переменные окружения | P0 |

### Что НЕ входит в MVP

- GitHub webhooks / auto-deploy
- Preview deployments
- Docker-based сборка
- Multi-server
- Уведомления (Telegram, email)
- Кастомные build pipelines
- Управление базами данных
- Multi-user / команды
- Аналитика трафика (перенесена в v0.2)
- CLI-интерфейс (перенесён в v0.2)

---

## 14. Будущие фичи

### Дорожная карта

#### v0.2 — Автоматизация и мониторинг

- GitHub webhooks для auto-deploy при push в main
- Аналитика трафика: парсинг Caddy access log, визуализация (как в LaVillaPine)
- CLI-интерфейс: `frostdeploy deploy`, `frostdeploy logs`, `frostdeploy status`
- Уведомления в Telegram: успех/провал деплоя, алерты по ресурсам
- Maintenance mode для каждого проекта

#### v0.3 — Preview Deployments

- Деплой из PR-веток с автоматическим поддоменом: `pr-42.project.domain.com`
- Автоматическая очистка после мержа PR
- Комментарий в PR с ссылкой на preview

#### v0.4 — Изоляция и безопасность

- Docker-based build isolation (опционально)
- Песочница для сборки через Linux namespaces
- Audit log: кто, когда, что деплоил
- 2FA для доступа к дашборду

#### v0.5 — Multi-server

- Управление несколькими серверами из одного дашборда
- SSH-agent подключение к удалённым серверам
- Распределение проектов по серверам
- Мониторинг здоровья всех серверов

#### v1.0 — Полнофункциональная платформа

- Кастомные build pipelines (YAML конфиг)
- Управление базами данных (PostgreSQL бекапы, миграции)
- Multi-user с ролями (admin, developer, viewer)
- API-ключи для интеграций
- Infrastructure-as-Code (`frostdeploy.yaml` в репозитории)
- Маркетплейс плагинов

---

## 15. Заключение

### Что мы имеем сейчас

Два проекта (LaVillaPine и SFOTKAI) с дублирующейся логикой деплоя. Оба используют одни и те же проверенные паттерны: модель двух директорий, rsync, systemd, Caddy, Git-based деплой. Ключевая проблема LaVillaPine — админка встроена в приложение и перезапускает сама себя.

### Что предлагается

Универсальная self-hosted платформа **FrostDeploy**, которая:

- Извлекает общие паттерны в отдельный независимый сервис
- Решает проблему самоперезапуска архитектурно (платформа ≠ приложение)
- Позволяет управлять любым количеством Node.js-проектов из одного дашборда
- Не требует Docker (в отличие от Coolify и CapRover)
- Минимальна по ресурсам (Node.js + SQLite vs PostgreSQL + Docker)
- Даёт встроенную аналитику и мониторинг

### Следующие шаги

1. **Создать PRD** на основе этого исследования
2. **Определить Tech Stack** — финальный выбор: Hono vs Fastify, React vs Solid
3. **Спроектировать схему БД** — детализация SQLite-схемы
4. **Изучить Nixpacks integration для мульти-язычной поддержки** — оценить сложность интеграции, протестировать на Python/Go-проектах
5. **Реализовать прототип Build Engine** — детектор + builder + deployer
6. **Собрать MVP** — минимальный UI + API + Build Engine
7. **Миграция LaVillaPine** — первый проект на платформе
8. **Миграция SFOTKAI** — второй проект

---

> **Примечание**: Данный документ является исследовательским и служит основой для PRD. Все архитектурные решения подлежат обсуждению и могут быть изменены на этапе проектирования.
