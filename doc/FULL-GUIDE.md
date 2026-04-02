> Этот файл перенесён из корневого README.md. Актуальный краткий README — в корне репозитория.

<p align="center">
  <img src="Globe," width="80" alt="FrostDeploy logo" />
</p>

<h1 align="center">FrostDeploy — Полное руководство</h1>

<p align="center">
  <strong>Мини-Vercel на вашем собственном VDS.</strong><br/>
  Один self-hosted сервис заменяет все самописные админки и ручной SSH-деплой.<br/>
  Автоопределение фреймворка · деплой в один клик · откат · real-time логи · мониторинг<br/>
  <em>Без Docker — Node.js + SQLite + Caddy.</em>
</p>

<p align="center">
  <a href="#обзор">Обзор</a> ·
  <a href="#быстрый-старт">Быстрый старт</a> ·
  <a href="#ручная-установка">Ручная установка</a> ·
  <a href="#архитектура">Архитектура</a> ·
  <a href="#разработка">Разработка</a> ·
  <a href="#известные-проблемы-и-решения">Troubleshooting</a> ·
  <a href="#roadmap">Roadmap</a>
</p>

---

<!-- TODO: screenshot of the dashboard -->

## Обзор

FrostDeploy — self-hosted платформа деплоя для инди-разработчиков и небольших команд. Позволяет деплоить, управлять и мониторить веб-проекты через единый дашборд на собственном сервере — без зависимости от облачных PaaS и **без Docker**.

**Что умеет:**

- 🔍 Автоопределение фреймворка (Next.js, Astro, Nuxt, SvelteKit и др.)
- 🚀 Деплой из GitHub в один клик (git clone → install → build → rsync → restart)
- 📡 Real-time логи деплоя через SSE
- 🔄 Мгновенный откат к предыдущему коммиту
- 🌐 Автоматическая настройка Caddy reverse proxy + SSL через Let's Encrypt
- 🔐 Зашифрованные переменные окружения (AES-256)
- 📊 Системные метрики (CPU, RAM, диск)
- 📦 systemd-юниты для каждого проекта (авто-создание)

**Технологический стек:**

| Компонент | Технология |
|-----------|------------|
| API-сервер | Node.js 22 LTS + Hono 4 |
| База данных | SQLite (WAL-режим) + Drizzle ORM |
| UI | React 19 + Vite 6 + TanStack Query + Tailwind CSS 4 + shadcn/ui |
| Reverse Proxy | Caddy v2 (Admin API на localhost:2019) |
| Процессы | systemd (авто-генерация unit-файлов) |
| Монорепозиторий | pnpm workspaces |

---

## Требования

| Компонент | Минимум | Рекомендуется |
|-----------|---------|---------------|
| ОС | Debian 12+ или Ubuntu 22.04+ | Debian 12 |
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2+ GB |
| Диск | 20 GB SSD | 40+ GB NVMe |
| Node.js | 22+ (LTS) | 22.x |
| pnpm | 10+ | 10.x |
| Caddy | v2.9+ | Последняя стабильная |
| rsync | Установлен | — |
| git | Установлен | — |
| Доступ | root (или sudo) | root |

---

## Быстрый старт

Автоматическая установка на чистом VDS одной командой:

```bash
# Запустить от root — скрипт установит все зависимости (Node.js, pnpm, Caddy)
curl -fsSL https://raw.githubusercontent.com/artfrost/frostdeploy/main/scripts/install.sh | bash
```

Скрипт выполнит:
1. Проверку ОС (Debian 12+ / Ubuntu 22.04+)
2. Установку Node.js 22, pnpm, Caddy, git (если не установлены)
3. Создание пользователя `frostdeploy`
4. Клонирование в `/opt/frostdeploy`
5. Установку зависимостей и сборку (`pnpm install && pnpm build`)
6. Создание `.env` с авто-сгенерированным `ENCRYPTION_KEY`
7. Установку и запуск systemd-сервиса
8. Настройку Caddy с Admin API

После установки откройте `http://<IP-сервера>:9000` в браузере для запуска мастера настройки.

---

## Ручная установка

Если вы предпочитаете пошаговый контроль:

### 1. Подготовка сервера

```bash
# Убедитесь, что установлены зависимости
node -v   # >= 22.x
pnpm -v   # >= 10.x
caddy version
rsync --version
git --version
```

### 2. Клонирование проекта

```bash
git clone https://github.com/artfrost/frostdeploy.git /opt/frostdeploy
cd /opt/frostdeploy
```

### 3. Установка зависимостей и сборка

```bash
pnpm install --frozen-lockfile
pnpm build
```

> `pnpm build` собирает UI (Vite → `ui/dist/`) и компилирует сервер (TypeScript → `server/dist/`).

### 4. Конфигурация .env

Создайте файл `.env`:

```bash
nano /opt/frostdeploy/.env
```

Содержимое `.env`:

```env
NODE_ENV=production
PORT=9000
DATABASE_PATH=/var/lib/frostdeploy/data.db
BACKUP_DIR=/var/lib/frostdeploy/backups
ENCRYPTION_KEY=<32-байта-hex, сгенерируйте: openssl rand -hex 32>
```

| Переменная | Описание | Обязательная |
|------------|----------|:------------:|
| `NODE_ENV` | Режим (`production` или `development`) | Да |
| `PORT` | Порт API-сервера FrostDeploy | Да (по умолчанию 9000) |
| `DATABASE_PATH` | Путь к файлу SQLite | Да |
| `BACKUP_DIR` | Директория для бэкапов БД | Да |
| `ENCRYPTION_KEY` | Ключ шифрования env-переменных проектов (hex, 32 байта) | Да |

### 5. Создание директорий данных

```bash
mkdir -p /var/lib/frostdeploy/backups
mkdir -p /var/lib/frostdeploy/env
chmod 600 /opt/frostdeploy/.env
```

### 6. Настройка systemd-сервиса

Скопируйте готовый unit-файл:

```bash
cp /opt/frostdeploy/scripts/frostdeploy.service /etc/systemd/system/frostdeploy.service
```

Содержимое unit-файла:

```ini
[Unit]
Description=FrostDeploy - Self-hosted deploy platform
After=network.target caddy.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/frostdeploy
ExecStart=/usr/bin/node server/dist/index.js
EnvironmentFile=/opt/frostdeploy/.env
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=frostdeploy
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

> **Примечание:** В шаблоне `User=frostdeploy`, но если системный пользователь `frostdeploy` не создан, используйте `User=root`. Для продакшена рекомендуется создать отдельного пользователя (см. скрипт `install.sh`).

Активируйте и запустите:

```bash
systemctl daemon-reload
systemctl enable frostdeploy
systemctl start frostdeploy
```

Проверка:

```bash
systemctl status frostdeploy
journalctl -u frostdeploy -f   # Логи в реальном времени
```

### 7. Настройка Caddy

FrostDeploy управляет маршрутами Caddy программно через **Admin API** (порт 2019). Минимальный Caddyfile:

```caddyfile
{
    admin localhost:2019
    log {
        output file /var/log/caddy/caddy.log {
            roll_size 50mb
            roll_keep 5
        }
        format json
    }
}
```

```bash
# Записать конфиг (если не настроен)
echo '{
    admin localhost:2019
    log {
        output file /var/log/caddy/caddy.log {
            roll_size 50mb
            roll_keep 5
        }
        format json
    }
}' > /etc/caddy/Caddyfile

# Перезапустить Caddy
systemctl enable caddy
systemctl restart caddy
```

FrostDeploy при деплое проекта автоматически добавляет маршрут через Caddy Admin API:
- `домен → reverse_proxy localhost:<порт_проекта>`
- SSL-сертификат через Let's Encrypt (при наличии домена и DNS)

### 8. Проверка работоспособности

```bash
curl -s http://localhost:9000   # Должен вернуть HTML дашборда
```

---

## Мастер первоначальной настройки

При первом открытии `http://<IP>:9000` запускается **Setup Wizard** из трёх шагов:

### Шаг 1 — Создание пароля администратора
Введите пароль для входа в дашборд. Пароль хранится как SHA-256-хеш.

### Шаг 2 — GitHub Personal Access Token
Введите [GitHub PAT](https://github.com/settings/tokens) с доступом к нужным репозиториям. Поддерживаются форматы:
- Classic: `ghp_...`
- Fine-grained: `github_pat_...`

### Шаг 3 — Адрес платформы
Укажите IP-адрес или домен сервера (например, `203.31.40.195` или `deploy.example.com`). Используется для формирования ссылок в интерфейсе.

После завершения мастера вы попадёте в дашборд.

---

## Деплой проекта — пошаговый пример

### 1. Добавление проекта

В дашборде нажмите **«Добавить проект»** и пройдите 4-шаговый визард:

1. **Репозиторий** — URL GitHub-репозитория (например, `https://github.com/user/my-app`)
2. **Настройки** — ветка, фреймворк (автоопределение), build-команда, start-команда, порт
3. **Env-переменные** — добавьте необходимые переменные окружения
4. **Обзор** — проверьте и подтвердите

Система автоматически:
- Определит фреймворк по `package.json`
- Предложит build/start команды
- Назначит свободный порт из диапазона 4322–4400

### 2. Запуск деплоя

Нажмите **«Deploy»** на странице проекта. Pipeline:

```
fetch → checkout → install (npm ci --include=dev) → build → sync → env → restart → healthcheck
```

Логи отображаются в реальном времени через SSE.

### 3. Привязка домена

Управление доменом осуществляется через отдельную вкладку **«Домен»** на странице проекта:

1. **Добавление домена** — откройте вкладку «Домен» и введите доменное имя
2. **Настройка DNS** — создайте A-запись, указывающую на IP-адрес сервера
3. **Проверка DNS** — нажмите «Проверить DNS» — система верифицирует запись через команду `dig`
4. **Автоматическая настройка** — после успешной проверки DNS FrostDeploy автоматически добавляет маршрут в Caddy и запрашивает SSL-сертификат через Let's Encrypt
5. **Статус SSL** — система опрашивает статус сертификата каждые 5 секунд до его активации

---

## Структура проекта

```
frostdeploy/
├── packages/
│   ├── shared/          # Общие типы, Zod-валидаторы, константы
│   └── db/              # Drizzle ORM — схема, миграции, клиент SQLite
├── server/              # Hono API, сервисы, очередь деплоев
│   └── src/
│       ├── routes/      # auth, projects, deploys, settings, system, backups
│       ├── services/    # build, deploy, git, project, proxy, system, settings
│       ├── queue/       # deploy-queue, deploy-worker
│       ├── templates/   # EJS-шаблон systemd.service
│       ├── lib/         # caddy, rsync, утилиты
│       └── middleware/  # auth middleware
├── ui/                  # React SPA — дашборд
│   └── src/
│       ├── pages/       # dashboard, login, setup, project/*
│       ├── components/  # UI-компоненты (shadcn/ui)
│       └── lib/         # API-клиент, утилиты
├── scripts/
│   ├── install.sh       # Скрипт автоустановки
│   └── frostdeploy.service  # Шаблон systemd-юнита
└── doc/                 # Документация
    ├── PRD.md
    ├── PRODUCTION-TEST-PROGRESS.md
    ├── spec/            # TECH-STACK, DATABASE, UI-UX, PROJECT-STRUCTURE
    └── implementation/  # IMPLEMENTATION.md — план реализации
```

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                          VDS Server                             │
│                                                                 │
│  ┌──────────────────────────┐    ┌───────────────────────────┐  │
│  │   FrostDeploy :9000      │    │         Caddy v2          │  │
│  │   (Node.js 22 + SQLite)  ├───►│   domain → 127.0.0.1:X   │  │
│  │                          │    │   auto-SSL (ACME)         │  │
│  │  ┌────────┐  ┌────────┐ │    └──────────┬────────────────┘  │
│  │  │React   │  │Hono API│ │               │                    │
│  │  │SPA     │  │        │ │    ┌──────────▼────────────────┐  │
│  │  └────────┘  └───┬────┘ │    │    Управляемые проекты    │  │
│  │              ┌────▼────┐ │    │  ┌──────────┐             │  │
│  │              │ Build   │ │    │  │ App A    │ :4322       │  │
│  │              │ Engine  │─┼───►│  │ (systemd)│             │  │
│  │              │ + Queue │ │    │  ├──────────┤             │  │
│  │              └────┬────┘ │    │  │ App B    │ :4323       │  │
│  │              ┌────▼────┐ │    │  │ (systemd)│             │  │
│  │              │ SQLite  │ │    │  └──────────┘             │  │
│  │              │ (WAL)   │ │    └───────────────────────────┘  │
│  │              └─────────┘ │                                    │
│  └──────────────────────────┘                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Deploy Pipeline

Каждый деплой проходит через 8 шагов:

1. **fetch** — `git clone` (первый раз) или `git fetch` (обновление) в `/var/www/<name>-src`
2. **checkout** — `git checkout <sha>` нужного коммита
3. **install** — `npm ci --include=dev` (с dev-зависимостями, т.к. нужны build-time пакеты)
4. **build** — `npm run build` (или кастомная build-команда)
5. **sync** — `rsync` всей srcDir → runtimeDir (`/var/www/<name>`), исключая `node_modules/` и `.git/`
6. **env** — записывает env-переменные проекта в `/var/lib/frostdeploy/env/{name}.env`
7. **restart** — `npm ci --omit=dev` в runtimeDir + `systemctl restart <unit>`
8. **healthcheck** — HTTP-запрос к localhost:port, ожидание ответа

### Управление процессами

- Каждый проект создаёт свой **systemd unit** из EJS-шаблона
- Unit автоматически создаётся при первом деплое (если файл не найден)
- Env-переменные передаются через `EnvironmentFile`
- Для проектов с env-переменными FrostDeploy генерирует env-файл в `/var/lib/frostdeploy/env/{name}.env` и подключает его через `EnvironmentFile` в systemd-юните
- Порты назначаются из диапазона **4322–4400**

### Caddy интеграция

- Caddy управляется через **Admin API** на `localhost:2019`
- Маршруты добавляются/удаляются программно при привязке домена
- SSL-сертификаты получаются автоматически через Let's Encrypt (ACME)

---

## Поддерживаемые фреймворки

| Категория | Поддержка | Стратегия |
|-----------|:---------:|-----------|
| **Node.js** (Astro, Next.js, Nuxt, SvelteKit, Remix, Express, Fastify, Koa, NestJS) | ✅ | `npm ci` → `build` → `rsync` → systemd |
| **Статические сайты** (Vite, Eleventy, Hugo, Jekyll) | ✅ | `npm run build` → Caddy file server |
| Любой npm-проект с `scripts.start` | ✅ | Fallback: `npm ci` → `npm start` |
| Python, Go, Rust, PHP, Docker | ❌ MVP | Запланировано v0.2–v0.4 через Nixpacks |

### Автоопределение фреймворков

| Фреймворк | Маркер | Build | Start |
|-----------|--------|-------|-------|
| Next.js | `next` в dependencies | `npm run build` | `npm start` |
| Astro (SSR) | `astro` в dependencies | `npm run build` | `node dist/server/entry.mjs` |
| Nuxt | `nuxt` в dependencies | `npm run build` | `node .output/server/index.mjs` |
| SvelteKit | `@sveltejs/kit` | `npm run build` | `node build` |
| Remix | `@remix-run/node` | `npm run build` | `npm start` |
| Express / Fastify / NestJS | Пакет в deps | — | `npm start` |

---

## Известные проблемы и решения

> На основе продакшен-тестирования на Debian 12 VDS (2 vCPU, 3.8 GB RAM). Все 18 обнаруженных багов исправлены. Подробности в [doc/PRODUCTION-TEST-PROGRESS.md](doc/PRODUCTION-TEST-PROGRESS.md).

### NODE_ENV=production наследуется дочерним процессам

**Проблема:** systemd запускает FrostDeploy с `NODE_ENV=production`. Когда build-engine вызывает `npm ci` для пользовательского проекта, переменная наследуется → npm пропускает devDependencies → сборка падает (нет tailwindcss, postcss и др.).

**Решение:** FrostDeploy использует `npm ci --include=dev` при установке зависимостей проекта, чтобы гарантировать установку build-time пакетов.

### Rsync-модель для Node.js-серверов

**Проблема:** Копирование только output-директории (например, `.next/`) ломает структуру проекта — `next start` ожидает `.next/` внутри корня проекта, рядом с `next.config.js`, `package.json` и т.д.

**Решение:** Rsync копирует всю srcDir в runtimeDir, исключая `node_modules/` и `.git/`. Затем в runtimeDir выполняется `npm ci --omit=dev` для установки production-зависимостей.

### Systemd-юнит User

**Проблема:** Шаблон содержит `User=frostdeploy`, но пользователь может не существовать на сервере.

**Решение:** В текущей версии используется `User=root`. Скрипт `install.sh` автоматически создаёт пользователя `frostdeploy`. При ручной установке — либо создайте пользователя, либо укажите `User=root`.

### Cookie Secure-флаг на HTTP

**Проблема:** Если FrostDeploy работает по HTTP (без SSL для самой платформы), cookie с флагом `Secure` отклоняется браузером → невозможно войти в дашборд.

**Решение:** Secure-флаг устанавливается только при `NODE_ENV=production` И наличии HTTPS. При работе по HTTP (`http://<IP>:9000`) cookie работает без Secure.

### Порт занят после ручного тестирования

**Проблема:** Если процесс проекта был запущен вручную (не через systemd), порт может быть занят при деплое.

**Решение:** Найдите и завершите процесс:

```bash
lsof -i :4322   # Найти PID
kill <PID>       # Завершить процесс
```

### `--ignore-scripts` и @next/swc

**Проблема:** Флаг `--ignore-scripts` при `npm ci` пропускает postinstall-скрипт `@next/swc`, необходимый для компиляции — сборка Next.js падает.

**Решение:** `--ignore-scripts` убран из build-service. Lifecycle-скрипты выполняются нормально.

---

## Полезные команды

```bash
# Статус FrostDeploy
systemctl status frostdeploy

# Логи FrostDeploy (в реальном времени)
journalctl -u frostdeploy -f

# Перезапуск FrostDeploy
systemctl restart frostdeploy

# Логи проекта (пример для проекта "my-app")
journalctl -u frostdeploy-my-app -f

# Проверка Caddy
curl -s http://localhost:2019/config/ | jq .

# Проверка порта проекта
curl -s http://localhost:4322

# Создать бэкап БД через API
curl -X POST http://localhost:9000/api/backups

# Список бэкапов
curl http://localhost:9000/api/backups

# Бэкапы хранятся в
ls /var/lib/frostdeploy/backups/

# Просмотр SQLite-базы
sqlite3 /var/lib/frostdeploy/data.db ".tables"
```

---

## Разработка

### Локальная настройка

```bash
git clone https://github.com/artfrost/frostdeploy.git
cd frostdeploy
pnpm install
nano .env              # Создайте и настройте переменные
pnpm db:migrate         # Миграции БД
pnpm dev                # Запуск dev-сервера
```

### Структура монорепозитория

| Пакет | Описание | Dev-команда |
|-------|----------|-------------|
| `server/` | Hono API + build engine + deploy queue | `pnpm --filter @fd/server dev` (tsx watch) |
| `ui/` | React SPA — дашборд | `pnpm --filter @fd/ui dev` (Vite :5173) |
| `packages/db/` | Drizzle ORM — схема и миграции | `pnpm db:migrate`, `pnpm db:studio` |
| `packages/shared/` | Общие типы и утилиты | Импортируется server и ui |

### Скрипты

```bash
pnpm build         # Сборка всех пакетов
pnpm test          # Запуск тестов (Vitest)
pnpm lint          # ESLint
pnpm format        # Prettier
pnpm db:migrate    # Миграции БД
pnpm db:studio     # Drizzle Studio (просмотр БД в браузере)
```

### Технологии разработки

- **Runtime:** Node.js 22 LTS
- **Фреймворк:** Hono 4 (`@hono/node-server`, `@hono/zod-validator`)
- **БД:** SQLite (WAL) через `better-sqlite3` + Drizzle ORM
- **UI:** React 19, Vite 6, TanStack Query 5, React Router 7
- **Стили:** Tailwind CSS 4 + shadcn/ui (Radix UI)
- **Тесты:** Vitest 3
- **Линтинг:** ESLint 9 (flat config) + Prettier
- **Пакетный менеджер:** pnpm 10 (workspaces)

---

## Roadmap

| Версия | Основные фичи |
|--------|---------------|
| **v0.1** (MVP) ✅ | Node.js + Static, Dashboard, Deploy engine, Proxy manager, Auth, Мониторинг |
| **v0.2** | Webhooks, Analytics, CLI, Telegram-уведомления, Zero-downtime deploys, Python (Nixpacks) |
| **v0.3** | Go, Docker, Preview Deployments, Monorepo support |
| **v0.4** | Rust, PHP (FrankenPHP), 2FA, Audit log |
| **v0.5** | Multi-server (SSH) |
| **v1.0** | Multi-user, API keys, IaC, Marketplace, Plugins |

---

## Contributing

Вклад приветствуется! Откройте issue или отправьте pull request.

1. Форкните репозиторий
2. Создайте feature-ветку (`git checkout -b feat/amazing-feature`)
3. Закоммитьте изменения (`git commit -m 'feat: add amazing feature'`)
4. Запушьте ветку (`git push origin feat/amazing-feature`)
5. Откройте Pull Request

## Лицензия

[MIT](LICENSE)
