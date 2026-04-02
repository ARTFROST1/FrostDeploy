<p align="center">
  <img src="Globe," width="80" alt="FrostDeploy" />
</p>

<h1 align="center">FrostDeploy</h1>

<p align="center">
  <strong>Self-hosted deploy platform — мини-Vercel на вашем VDS.</strong><br/>
  Деплой в один клик, real-time логи, auto-SSL, мониторинг.<br/>
  <em>Без Docker. Node.js + SQLite + Caddy.</em>
</p>

<p align="center">
  <a href="#возможности">Возможности</a> ·
  <a href="#быстрый-старт">Быстрый старт</a> ·
  <a href="#документация">Документация</a> ·
  <a href="#tech-stack">Tech Stack</a> ·
  <a href="#contributing">Contributing</a>
</p>

---

## Возможности

- 🔍 **Автоопределение фреймворка** — Next.js, Astro, Nuxt, SvelteKit, Remix и др.
- 🚀 **Деплой из GitHub в один клик** — clone → install → build → rsync → restart
- 📡 **Real-time логи** через SSE прямо в дашборде
- 🔄 **Мгновенный откат** к предыдущему коммиту
- 🌐 **Auto-SSL** — Caddy + Let's Encrypt, настройка домена через UI
- 🔐 **Шифрование секретов** — AES-256 для env-переменных
- 📊 **Мониторинг** — CPU, RAM, диск в реальном времени
- ⚙️ **systemd-юниты** — авто-создание для каждого проекта

---

## Быстрый старт

```bash
# Одна команда от root — установит всё (Node.js, pnpm, Caddy)
curl -fsSL https://raw.githubusercontent.com/artfrost/frostdeploy/main/scripts/install.sh | bash
```

После установки откройте `http://<IP>:9000` → мастер настройки (пароль, GitHub PAT, домен).

> **Требования:** Debian 12+ / Ubuntu 22.04+, 1+ vCPU, 1+ GB RAM, root-доступ.
> Подробная установка → [doc/FULL-GUIDE.md](doc/FULL-GUIDE.md#ручная-установка)

---

## Tech Stack

| Компонент | Технология |
|-----------|------------|
| API | Node.js 22 + [Hono](https://hono.dev) 4 |
| БД | SQLite (WAL) + [Drizzle ORM](https://orm.drizzle.team) |
| UI | React 19 + Vite 6 + Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com) |
| Proxy | [Caddy](https://caddyserver.com) v2 (Admin API + auto-SSL) |
| Процессы | systemd (авто-генерация unit-файлов) |
| Монорепо | pnpm workspaces |

---

## Документация

| Документ | Описание |
|----------|----------|
| [Полное руководство](doc/FULL-GUIDE.md) | Установка, настройка, архитектура, troubleshooting |
| [PRD](doc/PRD.md) | Требования к продукту |
| [Tech Stack](doc/spec/TECH-STACK.md) | Детали технологического стека |
| [Database](doc/spec/DATABASE.md) | Схема базы данных |
| [UI/UX](doc/spec/UI-UX.md) | Спецификация интерфейса |
| [Implementation](doc/implementation/IMPLEMENTATION.md) | План реализации |
| [Testing Progress](doc/PRODUCTION-TEST-PROGRESS.md) | Прогресс продакшен-тестирования |

---

## Структура проекта

```
frostdeploy/
├── packages/
│   ├── shared/     # Типы, валидаторы, константы
│   └── db/         # Drizzle ORM — схема, миграции
├── server/         # Hono API, сервисы, очередь деплоев
├── ui/             # React SPA — дашборд
├── scripts/        # install.sh, systemd-шаблон
└── doc/            # Документация
```

---

## Разработка

```bash
git clone https://github.com/artfrost/frostdeploy.git
cd frostdeploy
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

| Команда | Действие |
|---------|----------|
| `pnpm dev` | Dev-сервер (API + UI) |
| `pnpm build` | Сборка для продакшена |
| `pnpm test` | Тесты (Vitest) |
| `pnpm lint` | ESLint |

---

## Roadmap

| Версия | Фичи |
|--------|-------|
| **v0.1 (MVP)** ✅ | Node.js + Static, Dashboard, Deploy engine, Proxy, Auth, Мониторинг |
| **v0.2** | Webhooks, CLI, Telegram-уведомления, Zero-downtime, Python |
| **v0.3** | Docker, Preview Deployments, Monorepo support |
| **v0.4** | 2FA, Audit log, Go, Rust |
| **v1.0** | Multi-user, API keys, Plugins |

---

## Contributing

```bash
git checkout -b feat/amazing-feature
git commit -m 'feat: add amazing feature'
git push origin feat/amazing-feature
# Откройте Pull Request
```

## Лицензия

[MIT](LICENSE)
