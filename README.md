<h1 align="center">🧊 FrostDeploy</h1>

<p align="center">
  <strong>Self-hosted deploy platform — мини-Vercel на вашем VDS</strong><br/>
  Деплой в один клик • Real-time логи • Auto-SSL • Мониторинг<br/>
  <em>Без Docker. Просто Node.js + SQLite + Caddy.</em>
</p>

<p align="center">
  <a href="#-установка-за-2-минуты">Установка</a>&nbsp;&nbsp;•&nbsp;&nbsp;
  <a href="#-возможности">Возможности</a>&nbsp;&nbsp;•&nbsp;&nbsp;
  <a href="#-tech-stack">Tech Stack</a>&nbsp;&nbsp;•&nbsp;&nbsp;
  <a href="#-документация">Документация</a>&nbsp;&nbsp;•&nbsp;&nbsp;
  <a href="#-разработка">Разработка</a>
</p>

---

## 🚀 Установка за 2 минуты

Нужен VDS с **Ubuntu 22.04+** или **Debian 12+**, 1 vCPU, 1 GB RAM.

### Шаг 1. Подключитесь к серверу

```bash
ssh root@ваш-сервер
```

### Шаг 2. Запустите установщик

```bash
curl -fsSL https://raw.githubusercontent.com/ARTFROST1/FrostDeploy/main/scripts/install.sh | bash
```

> Скрипт автоматически установит Node.js 22, pnpm, Caddy, склонирует репозиторий, соберёт проект, создаст systemd-сервис и сгенерирует ключ шифрования.

### Шаг 3. Откройте в браузере

```
http://IP-вашего-сервера:9000
```

Запустится **мастер настройки** — создайте пароль администратора, вставьте GitHub PAT и укажите домен.

**Готово!** Теперь можно деплоить проекты.

<details>
<summary><strong>📋 Ручная установка (пошагово)</strong></summary>

Если вы хотите установить всё вручную:

```bash
# 1. Установите зависимости
apt update && apt install -y git curl

# 2. Установите Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# 3. Установите pnpm
corepack enable && corepack prepare pnpm@latest --activate

# 4. Установите Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  > /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# 5. Склонируйте и соберите
git clone https://github.com/ARTFROST1/FrostDeploy.git /opt/frostdeploy
cd /opt/frostdeploy
pnpm install --frozen-lockfile
pnpm build

# 6. Настройте окружение
mkdir -p /var/lib/frostdeploy/backups
cp .env.example .env
# Отредактируйте .env — обязательно сгенерируйте ENCRYPTION_KEY:
# openssl rand -hex 32
nano .env

# 7. Примените миграции БД
pnpm db:migrate

# 8. Установите systemd-сервис
cp scripts/frostdeploy.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now frostdeploy

# 9. Откройте http://IP:9000
```

</details>

---

## ✨ Возможности

| | Функция | Описание |
|---|---------|----------|
| 🔍 | **Автоопределение фреймворка** | Next.js, Astro, Nuxt, SvelteKit, Remix, статика |
| 🚀 | **Деплой в один клик** | `git clone → install → build → rsync → restart` |
| 📡 | **Real-time логи** | Стриминг через SSE прямо в дашборде |
| 🔄 | **Мгновенный откат** | Возврат к любому предыдущему деплою |
| 🌐 | **Auto-SSL** | Caddy + Let's Encrypt, настройка домена через UI |
| 🔐 | **Шифрование секретов** | AES-256-GCM для env-переменных |
| 📊 | **Мониторинг** | CPU, RAM, диск — в реальном времени |
| ⚙️ | **systemd-юниты** | Автоматическое создание сервисов для каждого проекта |

---

## 🛠 Tech Stack

| Компонент | Технология |
|-----------|------------|
| **API** | Node.js 22 + [Hono](https://hono.dev) 4 |
| **БД** | SQLite (WAL) + [Drizzle ORM](https://orm.drizzle.team) |
| **UI** | React 19 + Vite 6 + Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com) |
| **Proxy** | [Caddy](https://caddyserver.com) v2 — Admin API + auto-SSL |
| **Процессы** | systemd — авто-генерация unit-файлов |
| **Монорепо** | pnpm workspaces |

---

## 📖 Документация

| Документ | Описание |
|----------|----------|
| **[Полное руководство](doc/FULL-GUIDE.md)** | Установка, настройка, архитектура, troubleshooting |
| [PRD](doc/PRD.md) | Требования к продукту |
| [Tech Stack](doc/spec/TECH-STACK.md) | Детали технологического стека |
| [Database](doc/spec/DATABASE.md) | Схема базы данных |
| [UI/UX](doc/spec/UI-UX.md) | Спецификация интерфейса |
| [Implementation](doc/implementation/IMPLEMENTATION.md) | План реализации |

---

## 📁 Структура проекта

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

## 💻 Разработка

```bash
git clone https://github.com/ARTFROST1/FrostDeploy.git
cd FrostDeploy
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

| Команда | Действие |
|---------|----------|
| `pnpm dev` | Dev-сервер (API на :9000 + UI на :5173) |
| `pnpm build` | Сборка для продакшена |
| `pnpm test` | Тесты (Vitest) |
| `pnpm lint` | ESLint |

---

## 🗺 Roadmap

| Версия | Что внутри |
|--------|------------|
| **v0.1 (MVP)** ✅ | Node.js + Static, Dashboard, Deploy engine, Caddy proxy, Auth, Мониторинг |
| **v0.2** | Webhooks, CLI, Telegram-уведомления, Zero-downtime deploys |
| **v0.3** | Docker-проекты, Preview Deployments, Monorepo support |
| **v0.4** | 2FA, Audit log, Python / Go / Rust |
| **v1.0** | Multi-user, API keys, Плагины |

---

## 🤝 Contributing

```bash
git checkout -b feat/amazing-feature
git commit -m 'feat: add amazing feature'
git push origin feat/amazing-feature
# Откройте Pull Request
```

---

## 📄 Лицензия

[MIT](LICENSE)
