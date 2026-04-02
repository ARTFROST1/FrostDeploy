# Анализ кода конкурентов — Coolify & CapRover

> **Дата**: 31 марта 2026  
> **Автор**: @artfrost  
> **Статус**: Завершённый анализ  
> **Цель**: Глубокий технический анализ исходного кода Coolify и CapRover для проектирования архитектуры FrostDeploy

---

## Содержание

1. [Введение](#1-введение)
2. [Coolify — детальный анализ кода](#2-coolify--детальный-анализ-кода)
3. [CapRover — детальный анализ кода](#3-caprover--детальный-анализ-кода)
4. [Сравнение архитектур](#4-сравнение-архитектур)
5. [Уроки для FrostDeploy — что берём, что не берём](#5-уроки-для-frostdeploy--что-берём-что-не-берём)
6. [Уточнённая архитектура FrostDeploy](#6-уточнённая-архитектура-frostdeploy)

---

## 1. Введение

Для глубокого понимания архитектурных решений в self-hosted PaaS-платформах были склонированы два ведущих open-source проекта в директорию `_research/`:

```
FrostDeploy/_research/
├── coolify/     — PHP/Laravel-based, полнофункциональная платформа
└── caprover/    — Node.js/TypeScript, Docker Swarm обёртка
```

Анализ проводился по следующим осям:

- **Технологический стек** — языки, фреймворки, зависимости
- **Архитектура** — монолит/модули, хранение данных, коммуникация
- **Pipeline деплоя** — от нажатия кнопки до работающего приложения
- **Управление прокси** — маршрутизация, SSL, домены
- **Безопасность** — аутентификация, изоляция, секреты
- **Масштабирование** — single/multi-server, очереди, concurrency
- **Паттерны проектирования** — переиспользуемые архитектурные решения

Цель — не копировать чужой код, а извлечь проверенные архитектурные решения и избежать известных ловушек.

---

## 2. Coolify — детальный анализ кода

### 2.1. Технологический стек

| Компонент | Технология | Версия |
|---|---|---|
| **Язык** | PHP | 8.4 |
| **Фреймворк** | Laravel | 12 |
| **UI-реактивность** | Livewire | 3 |
| **JS-интерактивность** | Alpine.js | — |
| **CSS** | Tailwind CSS | 4 |
| **Очереди** | Laravel Horizon | 5 |
| **WebSockets** | Soketi | — |
| **БД** | PostgreSQL | 15 |
| **Кеш/Очередь-бэкенд** | Redis | 7 |
| **Reverse Proxy** | Traefik или Caddy | per server |
| **Аутентификация** | Fortify + Sanctum + Socialite | — |

**Ключевое наблюдение**: Coolify — это полноценный Laravel-монолит с тяжёлой инфраструктурой (PG + Redis + Soketi). Минимальные требования к серверу — 2 CPU / 2 GB RAM только для самой платформы.

### 2.2. Архитектура приложения

#### Монолитный подход

Coolify — классическое Laravel-приложение, где весь код живёт в одном проекте. Однако внутри используется чёткая модульная организация:

```
app/
├── Actions/           — Бизнес-логика (Actions pattern)
│   ├── Application/   — Деплой, рестарт, стоп приложений
│   ├── Database/      — Управление БД (Postgres, MySQL, Redis, etc.)
│   ├── Server/        — Управление серверами, SSH-подключение
│   ├── Service/       — Управление сервисами (compose-based)
│   ├── Proxy/         — Конфигурация Traefik/Caddy
│   └── ...
├── Models/            — Eloquent-модели (200+ миграций)
├── Livewire/          — UI-компоненты (реактивные формы)
├── Jobs/              — Queue-задачи (деплой, сборка)
├── Events/            — Событийная система
└── Listeners/         — Обработчики событий
```

#### Actions Pattern (lorisleiva/laravel-actions)

Ключевой архитектурный выбор Coolify — паттерн Actions. Вместо традиционных Laravel-сервисов или «толстых» контроллеров, вся бизнес-логика инкапсулирована в однозадачные классы:

```
Actions/Application/
├── DeployApplication.php        — Полный pipeline деплоя
├── StopApplication.php          — Остановка контейнера
├── RestartApplication.php       — Перезапуск контейнера
├── BuildImage.php               — Сборка Docker-образа
├── GenerateNixpacksConfs.php    — Генерация Nixpacks-конфигов
├── RollbackApplication.php      — Откат к предыдущей версии
└── CheckGitIfBuildNeeded.php    — Проверка необходимости новой сборки
```

**Преимущество**: Каждый Action — самодостаточная единица с чёткой ответственностью. Легко тестировать, легко переиспользовать, легко вызывать из контроллеров, queue jobs, API, CLI или Livewire-компонентов.

**Урок для FrostDeploy**: Паттерн Actions отлично ложится на любую архитектуру. В Node.js/TypeScript это можно реализовать как модули с единственной экспортируемой функцией (use case pattern).

#### Иерархия данных

Coolify использует жёсткую иерархию для организации ресурсов:

```
Team (команда)
└── Project (проект)
    └── Environment (окружение: production, staging, dev)
        ├── Application (приложение — то, что деплоится)
        ├── Service (запущенный compose-стек)
        └── Database (standalone БД: PG, MySQL, Redis, Mongo, etc.)
```

**Анализ**: Для single-user self-hosted решения как FrostDeploy иерархия Team → Project → Environment избыточна. Достаточно плоской структуры: Project → Deployment. Но если планируется мульти-user в v1.0, стоит заложить Team уже на уровне схемы.

### 2.3. Pipeline деплоя (детальный разбор)

Деплой Coolify — это queue job (Laravel Horizon), который выполняется на worker'е с приоритетом `high` и таймаутом 1 час. Ниже — пошаговый разбор:

#### Шаг 1: Очередь и блокировка

```
ApplicationDeploymentJob dispatched → Horizon worker берёт из 'high' очереди
├── Таймаут: 3600 секунд (1 час)
├── Количество попыток: 1 (без повторов)
└── Уникальность: по application_id + environment_id
```

**Важно**: Деплой никогда не блокирует веб-интерфейс. Пользователь сразу видит статус "Building..." и может наблюдать логи в реальном времени через WebSocket.

#### Шаг 2: Валидация сервера и SSH

```
1. Проверить, что сервер доступен (status check)
2. Загрузить приватный SSH-ключ: privateKey.storeInFileSystem()
3. Установить SSH-подключение (phpseclib)
4. Проверить Docker: version, buildx, BuildKit capabilities
```

**Решение**: Coolify НЕ устанавливает агенты на целевые серверы. Весь менеджмент — через SSH. Это значительно упрощает setup для пользователя (не нужно ничего ставить на таргет-сервер).

**Урок для FrostDeploy**: SSH-first подход — отличная идея для мульти-серверного сценария (v0.5). Для single-server MVP это не нужно — мы работаем локально.

#### Шаг 3: Определение стратегии сборки

```
decide_what_to_do() →
├── nixpacks     (авто-определение языка, авто-генерация Dockerfile)
├── dockerfile   (Dockerfile из репозитория)
├── static       (nginx:alpine для статических сайтов)
├── compose      (docker-compose.yml из репозитория)
└── dockerimage  (предсобранный образ из registry)
```

**Nixpacks** — ключевая инновация Coolify. Это open-source инструмент (от Railway), который:
1. Анализирует исходники проекта
2. Определяет язык и фреймворк
3. Автоматически генерирует оптимальный Dockerfile
4. Поддерживает Node.js, Python, Go, Rust, Ruby, Java, PHP, .NET, Haskell, Zig и др.

```
generate_nixpacks_confs() →
├── Определить язык (package.json → Node, requirements.txt → Python, go.mod → Go)
├── Определить фреймворк (Next.js, Django, Flask, etc.)
├── Сгенерировать Dockerfile с правильными шагами:
│   ├── Install dependencies
│   ├── Build step
│   └── Start command
└── Применить пользовательские env-переменные и настройки
```

**Урок для FrostDeploy**: Nixpacks может полностью заменить наш ручной detector.ts для мульти-языковой поддержки. Вместо написания логики детекции для каждого фреймворка — делегируем Nixpacks, а для Node.js оставляем свой оптимизированный путь (без Docker).

#### Шаг 4: Проверка необходимости сборки

```
check_git_if_build_needed() →
├── Получить текущий commit SHA на сервере
├── Сравнить с целевым SHA
├── Если совпадают И force_rebuild != true → пропустить сборку
└── Если отличаются → продолжить
```

**Оптимизация**: Coolify не пересобирает образ, если коммит не изменился. Это экономит время и ресурсы. В FrostDeploy мы уже храним `current_sha` в таблице projects — аналогичная логика.

#### Шаг 5: Клонирование и сборка

```
clone_repository() →
├── git clone через SSH (phpseclib) ИЛИ
├── git pull если директория уже существует
└── git checkout {target_sha}

prepare_builder_image() →
├── Эфемерный build-контейнер (отдельный от runtime)
└── Включает все build-зависимости (node, gcc, etc.)

build_image() →
├── docker build --build-arg ... --secret ... -t {image_name}:{tag}
├── Стриминг логов сборки через WebSocket
└── Push в локальный Docker registry (если multi-server)
```

#### Шаг 6: Rolling Update

```
rolling_update() →
├── docker compose up -d  (новый контейнер с новым образом)
├── health_check():
│   ├── HTTP GET → ожидаем 200 (настраиваемые retries и интервал)
│   ├── ИЛИ exec команда внутри контейнера
│   └── Таймаут: настраиваемый (по умолчанию 120 сек)
├── Если healthy → останавливаем старый контейнер
├── Если unhealthy → останавливаем НОВЫЙ, старый продолжает работать
└── Fallback: stop-then-start (для проектов без health check)
```

**Критически важно**: Rolling update обеспечивает zero-downtime deploy. Старый контейнер работает, пока новый не прошёл health check. Это один из ключевых недостатков текущей архитектуры FrostDeploy (rsync + systemctl restart = downtime).

#### Шаг 7: Post-deployment

```
post_deployment() →
├── Выполнить post-deploy команды (миграции, кеш, etc.)
├── Обновить статус: FINISHED / FAILED
├── Обновить commit SHA в записи приложения
├── Отправить GitHub deployment status (через API)
└── Отправить уведомления (Telegram, Discord, email)
```

### 2.4. Управление прокси (Traefik)

Coolify использует **Traefik v3.6** как reverse proxy:

```
Конфигурация Traefik в Coolify:
├── Docker-контейнер на каждом сервере
├── Entrypoints: HTTP (80), HTTPS (443)
├── Let's Encrypt: встроенный ACME resolver (httpChallenge или tlsChallenge)
├── Dynamic configuration: file provider (не Docker labels!)
│   ├── Файловые конфиги генерируются для каждого приложения
│   ├── Роутеры: Host(`domain.com`) → service
│   ├── Сервисы: loadBalancer → server URL
│   └── Middleware: redirect-to-https, headers, rate-limit
├── Dashboard: опционально включён для администраторов
└── Обновление конфига: hot-reload (file watcher)
```

**Альтернативно**: Coolify поддерживает **Caddy** как proxy, выбор делается per server. Caddy настраивается аналогично — через генерацию конфиг-файлов.

**Сравнение с FrostDeploy**: Мы выбрали Caddy — и это правильное решение. Caddy проще в конфигурации, имеет встроенный ACME без дополнительных настроек, и Caddy Admin API позволяет программно менять конфигурацию без перезагрузки.

### 2.5. Аутентификация и безопасность

```
Стек аутентификации Coolify:
├── Laravel Fortify — headless auth backend
│   ├── Login / Register / Password reset
│   ├── Two-Factor Authentication (TOTP)
│   └── Email verification
├── Laravel Sanctum — API-токены
│   ├── Abilities: read, write, deploy
│   ├── Token-based auth для API/CLI
│   └── SPA cookie-based auth для WebUI
├── Laravel Socialite — OAuth
│   ├── GitHub
│   ├── Google
│   ├── Discord
│   └── Расширяемый через провайдеры
└── Роли и команды:
    ├── Team owner → полный доступ
    ├── Team admin → управление проектами
    ├── Team member → деплой и просмотр
    └── Viewer → только просмотр
```

**Урок для FrostDeploy**: Для MVP достаточно single-user с HMAC-cookie (как в LaVillaPine). Но при проектировании API стоит сразу заложить token-based auth (аналог Sanctum abilities) — пригодится для CLI и webhooks.

### 2.6. Модель данных (PostgreSQL)

Coolify хранит всё в PostgreSQL (200+ Laravel-миграций). Ключевые таблицы:

```
Ядро:
├── teams                      — Команды (multi-tenant)
├── projects                   — Проекты (принадлежат team)
├── environments               — Окружения внутри проекта
├── applications               — Деплоимые приложения
├── application_settings       — Настройки приложений
├── application_deployment_queues — История деплоев + логи

Серверы:
├── servers                    — Целевые серверы (SSH credentials)
├── server_settings            — Настройки серверов
├── private_keys               — SSH-ключи (зашифрованные)

Сервисы:
├── services                   — Compose-based сервисы
├── service_applications       — Приложения внутри сервиса
├── service_databases          — БД внутри сервиса

Standalone БД:
├── standalone_postgresqls     — Standalone PostgreSQL
├── standalone_mysqls          — Standalone MySQL
├── standalone_redis           — Standalone Redis
├── standalone_mongodbs        — Standalone MongoDB
├── standalone_mariadbs        — Standalone MariaDB

Переменные окружения:
├── environment_variables      — Полиморфные env vars
│   └── Связь через morphable type:
│       ├── application
│       ├── service
│       ├── standalone_postgresql
│       └── ... (любой ресурс)

Прокси и домены:
├── server_proxy_settings      — Настройки прокси per server
├── ※ Нет отдельной таблицы доменов — домены хранятся в полях приложений
```

**Паттерн полиморфных env vars**: Одна таблица `environment_variables` с полями `morphable_type` + `morphable_id` хранит переменные для любого типа ресурса. Это элегантно, но в SQLite не нужно — достаточно JSON-поля или отдельной таблицы `project_env_vars`.

### 2.7. Сервисный каталог (Templates)

Coolify поставляется с **350+ предопределёнными compose-шаблонами** для популярных сервисов:

```
Примеры:
├── Базы данных: PostgreSQL, MySQL, MongoDB, Redis, ClickHouse
├── CMS: WordPress, Ghost, Strapi, Directus
├── Мониторинг: Grafana, Prometheus, Uptime Kuma
├── DevOps: GitLab, Gitea, Drone CI, n8n
├── Хранение: MinIO, Nextcloud
└── И ещё ~340 сервисов
```

Каждый шаблон — это JSON с compose YAML, переменными окружения и UI-мета-данными. Пользователь выбирает сервис → Coolify генерирует compose → деплоит.

**Урок для FrostDeploy**: Сервисный каталог — мощная фича, но для MVP она не нужна. Можно добавить в v1.0 если будет спрос. Однако архитектуру стоит заложить так, чтобы добавление шаблонов было тривиальным.

### 2.8. Ключевые паттерны Coolify

| # | Паттерн | Описание | Применимость для FrostDeploy |
|---|---|---|---|
| 1 | **Actions** | Вся бизнес-логика в однозадачных классах | ✅ Берём (use case modules) |
| 2 | **Queue-driven deploys** | Деплой через очередь, не блокирует UI | ✅ Берём (worker thread / queue) |
| 3 | **SSH-first** | Управление серверами без агентов | ⏳ v0.5 (multi-server) |
| 4 | **Nixpacks auto-detect** | Автоопределение языка → Dockerfile | ✅ Берём как опцию для не-Node.js |
| 5 | **Config hash** | Хеш конфигурации для drift detection | ⏳ v0.3 |
| 6 | **Rolling update** | Zero-downtime через health check | ⏳ v0.2 (для Docker-based) |
| 7 | **Полиморфные env vars** | Одна таблица для всех типов ресурсов | ❌ Избыточно (JSON-поле OK) |
| 8 | **Template marketplace** | 350+ compose-шаблонов | ⏳ v1.0 |
| 9 | **Event-driven UI** | WebSocket для real-time обновлений | ✅ Берём (SSE — проще) |
| 10 | **Proxy as sidecar** | Прокси = Docker-контейнер рядом с платформой | ❌ У нас Caddy нативно |

---

## 3. CapRover — детальный анализ кода

### 3.1. Технологический стек

| Компонент | Технология | Версия |
|---|---|---|
| **Язык** | TypeScript | 5.8 |
| **Рантайм** | Node.js | 22 |
| **HTTP-фреймворк** | Express | 5.1 |
| **Docker API** | dockerode | — |
| **Оркестрация** | Docker Swarm | — |
| **Reverse Proxy** | Nginx | 1.27 (Docker image) |
| **SSL** | Certbot | Container |
| **Хранение данных** | JSON files (configstore) | — |
| **Аутентификация** | JWT | — |
| **Шаблонизация конфигов** | EJS | — |

**Ключевое наблюдение**: CapRover — это single-process Node.js приложение без внешних БД. Всё состояние — в JSON-файлах. Простота архитектуры поразительна, но и ограничения тоже очевидны.

### 3.2. Архитектура приложения

#### Карта исходного кода

```
src/
├── server.ts              — Точка входа: install mode vs run mode
├── app.ts                 — Express setup, middleware, routing
│
├── docker/
│   ├── DockerApi.ts       — Ядро: все Docker-операции через dockerode
│   │   ├── createService()
│   │   ├── updateService()    — Обновление Swarm-сервиса (деплой)
│   │   ├── pushImage()
│   │   ├── buildImageFromDockerFile()
│   │   └── ... (60+ методов)
│   └── DockerUtils.ts     — SSH-выполнение команд на worker-нодах
│
├── user/
│   ├── ServiceManager.ts  — ★ ЦЕНТРАЛЬНЫЙ ОРКЕСТРАТОР ★
│   │   ├── deployNewVersion()     — Основной pipeline деплоя
│   │   ├── enableSslForApp()      — Включение SSL
│   │   ├── addCustomDomain()      — Кастомные домены
│   │   ├── createApp()            — Создание приложения
│   │   ├── removeApp()            — Удаление приложения
│   │   └── updateAppSettings()    — Настройки приложения
│   │
│   ├── ImageMaker.ts      — Pipeline сборки образов
│   │   ├── extractSourceAndBuild()
│   │   ├── getBuildLogs()
│   │   └── resolveDockerFile()    — captain-definition → Dockerfile
│   │
│   ├── UserManager.ts     — Facade: композиция всех менеджеров
│   ├── Authenticator.ts   — JWT: issueToken, validateToken
│   │
│   ├── TemplateHelper.ts  — Шаблонные приложения (node, python, ruby, php)
│   ├── BuildLog.ts        — Circular buffer для логов сборки
│   │
│   └── system/
│       ├── CaptainManager.ts       — Системная инициализация, health checks
│       ├── LoadBalancerManager.ts   — ★ ГЕНЕРАТОР NGINX-КОНФИГОВ ★
│       │   ├── rePopulateNginxConfigFile()
│       │   ├── sendReloadSignal()   — nginx -s reload
│       │   └── testNginxConfig()    — nginx -t (валидация)
│       ├── CertbotManager.ts       — Let's Encrypt через certbot
│       │   ├── enableSsl()
│       │   ├── renewCerts()
│       │   └── domainVerification
│       └── DomainResolveChecker.ts  — Проверка владения доменом
│
├── datastore/
│   ├── DataStore.ts           — Корневое хранилище: пароли, домены, SSL
│   ├── AppsDataStore.ts       — CRUD приложений, версионирование
│   │   ├── getAppDefinition()
│   │   ├── createNewApp()
│   │   ├── setDeployedVersion()
│   │   └── getAppEnvVars()
│   └── RegistriesDataStore.ts — Docker registries
│
├── routes/
│   ├── login/LoginRouter.ts   — Маршрут аутентификации
│   └── user/                  — CRUD-маршруты приложений, системы, etc.
│
└── utils/
    ├── CaptainConstants.ts    — ★ ВСЕ КОНСТАНТЫ ★
    │   ├── Пути: /captain/data/, /captain/temp/
    │   ├── Порты: 3000 (API), 80/443 (nginx)
    │   ├── Имена сервисов: captain-captain, captain-nginx
    │   └── Конфиг Docker labels
    ├── CaptainInstaller.ts    — First-run: swarm init, nginx, services
    ├── GitHelper.ts           — Git clone (HTTPS + SSH)
    └── Encryptor.ts           — Шифрование секретов
```

#### Ключевые архитектурные наблюдения

1. **God Object: `ServiceManager.ts`** — содержит всю бизнес-логику: деплой, SSL, домены, настройки. Это антипаттерн, но для простого проекта работает.

2. **Facade: `UserManager.ts`** — композиция ServiceManager + CaptainManager + DockerApi. Все маршруты работают через него.

3. **Всё состояние в JSON** — configstore сохраняет всё в `/captain/data/config-captain.json`. Нет SQL, нет миграций, нет транзакций. При падении во время записи — возможна потеря данных.

4. **Nginx в Docker** — nginx работает как Docker-контейнер. CapRover генерирует конфиги через EJS, проверяет `nginx -t`, и при успехе делает `nginx -s reload`.

### 3.3. Pipeline деплоя (детальный разбор)

#### Шаг 1: Приём запроса

```
Три источника деплоя:
├── Web Panel: POST /api/v2/user/apps/appData/{appName}/
├── Webhook:   POST /api/v2/user/apps/webhooks/triggerbuild
└── CLI:       caprover deploy (отправляет тот же POST)
```

#### Шаг 2: Mutex и очередь

```
Глобальный mutex (один build за раз на весь сервер!):
├── mutex.lock() → ожидание завершения предыдущей сборки
├── Для одного и того же приложения: last-write-wins
│   (если пришёл новый деплой — текущий отменяется)
└── Нет приоритетов, нет параллельных сборок
```

**КРИТИЧЕСКИЙ НЕДОСТАТОК**: Глобальный mutex означает, что при 10 приложениях деплои выполняются строго последовательно. Если одна сборка занимает 5 минут, остальные ждут. Это принципиально неприемлемо при масштабировании.

**Урок для FrostDeploy**: Необходим per-project mutex (как у Coolify: по application_id), а не глобальный. Это позволит параллельные сборки разных проектов.

#### Шаг 3: Версионирование

```
Инкремент версии в JSON-store:
├── currentVersion = app.deployedVersion + 1
├── Сохранение в configstore
└── Версия используется как Docker image tag
```

**Интересный подход**: CapRover использует инкрементальные числовые версии (1, 2, 3...), а не commit SHA. Это проще, но теряет связь с git-историей.

**Урок для FrostDeploy**: Лучше использовать commit SHA (короткий, 7 символов) как версию — сохраняет связь с git и позволяет точный откат.

#### Шаг 4: Извлечение исходников

```
extractSourceAndBuild() →
├── Uploaded tar → extract в /captain/temp/{app}/{version}/
├── Git repo → GitHelper.clone() (HTTPS или SSH)
│   ├── HTTPS: git clone https://token@github.com/user/repo
│   └── SSH: git clone git@github.com:user/repo (с SSH key)
└── Captain-definition content → записать в temp dir
```

#### Шаг 5: Определение стратегии (captain-definition v2)

```
captain-definition — JSON в корне проекта:

{
  "schemaVersion": 2,
  // Ровно ОДНО из:
  "imageName": "nginx:latest",         // → pull и деплой
  "dockerfileLines": ["FROM node:22"], // → inline Dockerfile
  "dockerfilePath": "./Dockerfile",     // → файл из репозитория
  "templateId": "node/22"              // → встроенный шаблон
}
```

**Шаблоны (templateId)**:
```
Встроенные шаблоны CapRover:
├── node/22      — Node.js 22 (npm install → npm start)
├── python/3     — Python 3 (pip install → gunicorn)
├── ruby/3       — Ruby 3 (bundle install → rails server)
├── php/8        — PHP 8 (composer install → apache)
└── ... (ограниченный набор)
```

**Сравнение с Coolify**: captain-definition — это CapRover-специфичный формат, привязывающий пользователя к платформе. Coolify с Nixpacks не требует дополнительных файлов в репозитории — всё определяется автоматически. FrostDeploy должен работать как Coolify: автоопределение без специальных файлов.

#### Шаг 6: Docker build

```
buildImageFromDockerFile() →
├── docker build -t captain--{appName}:{version} .
├── Стриминг логов через circular buffer (BuildLog.ts)
│   ├── Максимум: последние 1500 строк
│   └── Доступ через API: GET /api/v2/user/apps/appData/{app}/buildlog
└── Ожидание завершения (promise)
```

#### Шаг 7: Push и обновление Swarm-сервиса

```
if (registry configured):
    docker push captain--{appName}:{version}

docker service update --image captain--{appName}:{version} srv-captain--{appName}
├── Docker Swarm выполняет rolling update
├── Параметры: updateParallelism=1, updateDelay=2s
└── Rollback при failure: docker service rollback
```

#### Шаг 8: Регенерация Nginx-конфига

```
LoadBalancerManager.rePopulateNginxConfigFile() →
├── Для КАЖДОГО приложения:
│   ├── Загрузить app definition из configstore
│   ├── Рендеринг EJS-шаблона → nginx config block
│   │   ├── server_name: {appName}.{rootDomain}
│   │   ├── proxy_pass: http://srv-captain--{appName}:{containerPort}
│   │   ├── SSL: listen 443 ssl; ssl_certificate ...
│   │   └── Custom headers, redirect rules
│   └── Записать в /etc/nginx/conf.d/{appName}.conf
├── nginx -t (валидация конфигурации)
│   ├── Если OK → nginx -s reload (atomic swap)
│   └── Если FAIL → откат к предыдущему конфигу + error
└── Готово
```

**Атомарность nginx-конфигов**: CapRover генерирует весь nginx-конфиг заново для каждого деплоя. Это безопасно (nginx -t валидирует перед применением), но расточительно. Coolify генерирует per-app конфиги и подключает через include.

**Урок для FrostDeploy**: Модель per-app конфигов + include = оптимальнее. Caddy Admin API ещё лучше — программное обновление маршрутов без перезагрузки.

### 3.4. Управление доменами и SSL

#### Доменная модель

```
Wildcard DNS pattern:
├── Пользователь настраивает *.yourdomain.com → IP сервера
├── Каждое приложение автоматически получает: {app}.yourdomain.com
├── Кастомные домены: пользователь добавляет CNAME → {app}.yourdomain.com
└── Проверка владения: DomainResolveChecker

DomainResolveChecker:
├── Генерирует UUID verification token
├── Создаёт файл /.well-known/captain-{uuid} на nginx
├── Проверяет: HTTP GET http://domain.com/.well-known/captain-{uuid}
├── Если получен правильный ответ → домен подтверждён
└── Если нет → ошибка "DNS not configured"
```

**Сравнение**: CapRover требует wildcard DNS (*.domain.com → IP), что упрощает автоматические поддомены, но требует от пользователя настройки wildcard-записи. FrostDeploy использует индивидуальные A-записи, что проще для пользователя, но требует ручной настройки каждого домена.

#### SSL через Certbot

```
CertbotManager.enableSsl():
├── Certbot запущен как спящий Docker-контейнер
├── Для получения сертификата:
│   ├── certbot certonly --webroot -w /captain/letsencrypt/
│   ├── Nginx уже настроен проксировать /.well-known/acme-challenge/
│   └── Сертификаты сохраняются в /captain/letsencrypt/live/{domain}/
├── Обновление nginx-конфига с SSL-сертификатами
├── Автообновление: cron job (certbot renew)
└── Проблема: certbot не поддерживает wildcard с HTTP challenge
    (нужен DNS challenge, а это требует DNS API)
```

**КРИТИЧЕСКИЙ НЕДОСТАТОК**: Certbot через Docker-контейнер — это костыль. Caddy имеет встроенный ACME с автоматическим получением и обновлением сертификатов. Одна строка в Caddyfile заменяет всю CertbotManager.

### 3.5. Хранение данных (JSON files)

```
/captain/data/
├── config-captain.json     — Глобальная конфигурация
│   ├── hashedPassword       — SHA-256 пароль администратора
│   ├── rootDomain           — Корневой домен
│   ├── hasRootSsl           — SSL для корневого домена
│   └── ...
├── config-apps.json        — Все приложения
│   ├── appDefinitions: {
│   │   "my-app": {
│   │       "deployedVersion": 5,
│   │       "envVars": [...],
│   │       "volumes": [...],
│   │       "ports": [...],
│   │       "customDomain": [...],
│   │       "hasSsl": true,
│   │       "containerHttpPort": 3000,
│   │       ...
│   │   }
│   │ }
│   └── ...
└── config-registries.json  — Docker registries
```

**Проблемы JSON-хранилища**:
1. **Нет транзакций** — при падении во время записи файл может быть повреждён
2. **Нет индексов** — поиск O(n) по всем приложениям
3. **Нет concurrent access** — чтение и запись не защищены (кроме mutex)
4. **Нет миграций** — изменение схемы требует ручной обработки
5. **Нет бекапов** — потеря файла = потеря всего состояния

**Урок для FrostDeploy**: SQLite с WAL-режимом — правильный выбор. Транзакции, индексы, concurrent reads, автоматические бекапы через `.backup`.

### 3.6. Аутентификация

```
Authenticator.ts:
├── Single-user: один пароль администратора
├── SHA-256 хеш пароля в config-captain.json
├── JWT-токен: jsonwebtoken.sign({ data: hashedPassword }, salt)
├── Валидация: каждый запрос → verify JWT → check hashed password match
├── Middleware: isAuth() → проверка req.headers.x-captain-auth
└── Смена пароля: новый хеш → новый salt → все старые JWT инвалидируются
```

**Простая, но эффективная модель**: Single-user + JWT достаточно для self-hosted. FrostDeploy использует аналогичный подход (cookie sessions вместо JWT).

### 3.7. Ключевые паттерны CapRover

| # | Паттерн | Описание | Применимость для FrostDeploy |
|---|---|---|---|
| 1 | **Single-process** | Весь сервер — один Node.js-процесс | ✅ Берём (простота) |
| 2 | **EJS шаблоны для proxy** | Шаблонная генерация nginx-конфигов | ⚠️ Частично (EJS для systemd, Caddy API) |
| 3 | **captain-definition** | Единый файл конфигурации деплоя | ❌ Не берём (автоопределение лучше) |
| 4 | **Atomic nginx reload** | nginx -t → swap → HUP | ✅ Концепция: validate before apply |
| 5 | **Circular buffer logs** | Ограниченный буфер для build-логов | ⚠️ Лучше SSE + персистентное хранение |
| 6 | **Numeric versioning** | Инкрементальные номера версий | ❌ SHA-based лучше |
| 7 | **Global mutex** | Один билд за раз | ❌ Per-project mutex |
| 8 | **Domain verification** | UUID-файл + HTTP-проверка | ✅ Берём (но через DNS dig) |
| 9 | **JSON datastore** | Файловое хранение, zero-config | ❌ SQLite лучше |
| 10 | **Install vs Run** | Два режима запуска: первичная настройка и штатная работа | ✅ Берём |

---

## 4. Сравнение архитектур

### 4.1. Высокоуровневое сравнение

| Аспект | Coolify | CapRover | FrostDeploy (план) |
|---|---|---|---|
| **Язык** | PHP 8.4 | TypeScript / Node.js | TypeScript / Node.js |
| **Фреймворк** | Laravel 12 | Express 5.1 | Hono / Fastify |
| **БД** | PostgreSQL | JSON files | SQLite |
| **Очереди** | Redis + Horizon | In-process mutex | Worker thread / BullMQ |
| **Proxy** | Traefik / Caddy | Nginx (Docker) | Caddy (native) |
| **SSL** | ACME (Traefik/Caddy) | Certbot (Docker) | ACME (Caddy built-in) |
| **Контейнеризация** | Docker обязателен | Docker Swarm обязателен | Опционально (v0.3) |
| **Изоляция** | Docker контейнеры | Docker Swarm | systemd cgroups |
| **Multi-server** | SSH, без агентов | Docker Swarm join | SSH (v0.5) |
| **UI** | Livewire + Alpine | jQuery + vanilla JS | React/Solid SPA |
| **Real-time** | Soketi WebSockets | HTTP polling | SSE |
| **Auth** | Fortify + Sanctum + OAuth | JWT single-user | HMAC cookies → tokens |
| **Templates** | 350+ compose YAML | ~10 Dockerfile шаблонов | — (MVP) |
| **Build strategy** | Nixpacks / Dockerfile / Compose | captain-definition | Автоопределение + Nixpacks |

### 4.2. Сравнение Build Pipeline

```
                    Coolify                          CapRover
                    ──────                          ────────
Trigger:            Web / API / Webhook / Git       Web / Webhook / CLI
Queue:              Redis + Horizon (parallel)      In-process mutex (serial!)
Source:             Git clone via SSH                Git clone / tar upload
Detection:          Nixpacks / Dockerfile / Compose  captain-definition
Build:              Docker BuildKit                  Docker build
Health check:       HTTP / CMD (configurable)        Нет (Swarm managed)
Deploy:             Rolling update (new → check →    Swarm service update
                    stop old)
Rollback:           Redeploy old image              Manual
Zero-downtime:      ✅ (rolling update)              ⚠️ (Swarm-зависимый)
Logs:               WebSocket (real-time)            HTTP polling (buffer)

                    FrostDeploy (план)
                    ──────────────────
Trigger:            Web / API / CLI → Webhook (v0.2)
Queue:              Per-project lock (worker thread)
Source:             Git clone/pull (SSH key)
Detection:          package.json анализ → Nixpacks fallback
Build:              npm ci + npm run build (native) → Docker (v0.3)
Health check:       HTTP GET / process alive
Deploy:             rsync + systemctl restart → rolling update (v0.2)
Rollback:           Redeploy previous SHA
Zero-downtime:      v0.2 (dual-directory swap)
Logs:               SSE (real-time)
```

### 4.3. Сравнение моделей данных

```
Coolify (PostgreSQL):                    CapRover (JSON files):
┌─────────────────────┐                  ┌──────────────────────┐
│ 200+ миграций       │                  │ config-captain.json  │
│ ~50 таблиц          │                  │ config-apps.json     │
│ Полиморфные связи   │                  │ config-registries.json│
│ Full ACID           │                  │ БЕЗ транзакций       │
│ Индексы, FK         │                  │ БЕЗ индексов         │
│ Бекапы через pg_dump│                  │ Бекап: cp *.json     │
└─────────────────────┘                  └──────────────────────┘

FrostDeploy (SQLite):
┌──────────────────────┐
│ ~5 таблиц            │
│ WAL-режим (concurrency)
│ ACID транзакции      │
│ Индексы              │
│ Бекап: .backup       │
│ Zero-config          │
└──────────────────────┘
```

### 4.4. Сравнение proxy-стратегий

| Характеристика | Coolify (Traefik) | CapRover (Nginx) | FrostDeploy (Caddy) |
|---|---|---|---|
| **Запуск** | Docker-контейнер | Docker-контейнер | Нативный binary |
| **SSL** | ACME встроен | Certbot (отдельный) | ACME встроен |
| **Конфигурация** | YAML/TOML файлы | EJS → nginx conf | Caddyfile / JSON API |
| **Hot reload** | File watcher | nginx -t → HUP | caddy reload / API |
| **Wildcard SSL** | DNS challenge | Не поддерживает | DNS challenge |
| **Сложность** | Средняя | Высокая | Низкая |
| **Footprint** | ~50 MB RAM | ~20 MB RAM | ~20 MB RAM |
| **Программное управление** | REST API | Файлы + exec | REST API (Admin API) |

**Вывод**: Caddy — оптимальный выбор для FrostDeploy. Встроенный ACME, простая конфигурация, программный Admin API, лёгкий footprint.

---

## 5. Уроки для FrostDeploy — что берём, что не берём

### 5.1. Что берём из Coolify

| # | Решение | Обоснование | Приоритет |
|---|---|---|:---:|
| 1 | **Actions pattern** (use case modules) | Чистая архитектура, тестируемость, переиспользуемость | MVP |
| 2 | **Queue-driven deployments** | Деплой не блокирует UI; можно параллелить | MVP |
| 3 | **Per-application deployment lock** | Предотвращает конфликты (НЕ глобальный mutex как у CapRover) | MVP |
| 4 | **Nixpacks для мульти-языковой поддержки** | Автоопределение Python, Go, Rust без написания кастомных пакеров | v0.2–v0.3 |
| 5 | **Config hash для drift detection** | Понимаем, изменился ли конфиг с последнего деплоя | v0.3 |
| 6 | **SSH-first для multi-server** | Управление удалёнными серверами без агентов | v0.5 |
| 7 | **Event-driven UI** (WebSocket → SSE) | Реальное время: логи деплоя, статусы, метрики | MVP |
| 8 | **Build skip при совпадении SHA** | Если коммит не изменился — не пересобираем | MVP |
| 9 | **Post-deploy hooks** | Миграции, очистка кеша, уведомления | v0.2 |
| 10 | **GitHub deployment status** | Обновление статуса деплоя прямо в GitHub | v0.2 |

### 5.2. Что берём из CapRover

| # | Решение | Обоснование | Приоритет |
|---|---|---|:---:|
| 1 | **Single-process simplicity** | Один Node.js-процесс, zero-config запуск | MVP |
| 2 | **Install vs Run режимы** | При первом запуске — wizard настройки, далее — штатный режим | MVP |
| 3 | **EJS-шаблоны для конфигов** | Генерация systemd-юнитов и Caddy-блоков из шаблонов | MVP |
| 4 | **Validate-before-apply** | Как nginx -t: проверяем конфиг перед применением | MVP |
| 5 | **Domain verification** | Проверка, что DNS указывает на наш сервер | MVP |
| 6 | **Three deploy sources** | Web panel + Webhook + CLI — гибкость | v0.2 |
| 7 | **Circular buffer для build логов** | Ограничение памяти при хранении логов в runtime | MVP |

### 5.3. Что НЕ берём

| # | Решение | Источник | Причина отказа |
|---|---|---|---|
| 1 | **Docker обязателен** | Оба | FrostDeploy работает без Docker в MVP (нативные сборки) |
| 2 | **PostgreSQL** | Coolify | Избыточно для single-server; SQLite достаточно |
| 3 | **Redis для очередей** | Coolify | Overkill; worker thread или BullMQ с SQLite-адаптером |
| 4 | **Docker Swarm** | CapRover | Добавляет сложность, не даёт преимуществ для single-server |
| 5 | **JSON files для данных** | CapRover | Нет транзакций, нет индексов, не масштабируется |
| 6 | **captain-definition** | CapRover | Vendor lock-in; автоопределение лучше |
| 7 | **Certbot (Docker)** | CapRover | Caddy имеет встроенный ACME, certbot не нужен |
| 8 | **Global mutex** | CapRover | Серийные сборки = bottleneck; per-project locking |
| 9 | **Полиморфные env vars** | Coolify | Elegantно, но избыточно; JSON-поле в SQLite OK |
| 10 | **350+ шаблонов** | Coolify | Огромный scope; в MVP не нужно, можно добавить в v1.0 |
| 11 | **Nginx (Docker)** | CapRover | Caddy нативный — проще, встроенный ACME |
| 12 | **PHP / Laravel** | Coolify | Node.js — тот же рантайм, что и деплоимые приложения |

### 5.4. Ключевые инсайты

#### Инсайт 1: Nixpacks — game changer для мульти-языковой поддержки

Вместо написания детекторов для каждого языка (Python, Go, Rust, PHP), можно:
1. Для Node.js — использовать наш оптимизированный нативный путь (без Docker)
2. Для остальных языков — делегировать Nixpacks, который сгенерирует Docker-образ

Это позволяет поддержать ~20 языков разом с минимальным кодом.

#### Инсайт 2: SSH-first — отложить, но заложить

Coolify управляет серверами через SSH — это значит, что не нужен агент на целевом сервере. Для MVP FrostDeploy работает локально, но API и абстракции стоит проектировать с учётом будущего SSH-выполнения.

#### Инсайт 3: Queue isolation критична

Coolify изолирует деплои по `application_id` — два приложения собираются параллельно, но одно приложение никогда не собирается дважды одновременно. CapRover с глобальным mutex — антипаттерн.

FrostDeploy: per-project lock через SQLite advisory lock или in-memory Map.

#### Инсайт 4: Build skip экономит ресурсы

Обе платформы проверяют, нужна ли пересборка. Coolify сравнивает commit SHA, CapRover — версию. FrostDeploy: если `current_sha === target_sha && force !== true` → skip.

#### Инсайт 5: Proxy as sidecar vs native

Coolify и CapRover запускают прокси в Docker-контейнере рядом с платформой. FrostDeploy использует нативный Caddy — это проще, легче, и не требует Docker.

---

## 6. Уточнённая архитектура FrostDeploy

### 6.1. Архитектурные решения по результатам анализа

На основе анализа кода Coolify и CapRover, уточняем архитектуру FrostDeploy:

```
FrostDeploy v0.1 (MVP):
├── Нативные Node.js-сборки (без Docker)
├── Автоопределение фреймворка из package.json
├── Per-project deployment lock
├── SSE для real-time логов
├── SQLite + WAL для хранения данных
├── Caddy native для proxy + auto-SSL
├── systemd для управления процессами
├── Install wizard при первом запуске
└── Validate-before-apply для всех конфигов

FrostDeploy v0.2 (Автоматизация):
├── Webhooks (GitHub push → auto-deploy)
├── Post-deploy hooks (миграции, кеш)
├── Nixpacks для Python-проектов
├── Health check с rollback
├── SSE-уведомления в Telegram
└── GitHub deployment status API

FrostDeploy v0.3 (Мульти-язык):
├── Nixpacks для Go, Rust, PHP (Docker-based build)
├── Docker-based deploy (Dockerfile)
├── Config hash для drift detection
├── CLI: frostdeploy deploy / logs / status
└── Preview deployments

FrostDeploy v0.5 (Multi-server):
├── SSH-first management (по модели Coolify)
├── Распределение проектов по серверам
├── Централизованный дашборд
└── SSH key management (зашифрованное хранение)
```

### 6.2. Компонентная диаграмма (уточнённая)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FrostDeploy v0.1                           │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    HTTP Server (Hono/Fastify)                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │   │
│  │  │ Web UI   │  │ REST API │  │ SSE      │  │ Webhooks   │  │   │
│  │  │ (SPA)    │  │ /api/*   │  │ /events  │  │ /hooks/*   │  │   │
│  │  └──────────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │   │
│  └──────────────────────┼────────────┼───────────────┼──────────┘   │
│                         │            │               │              │
│  ┌──────────────────────▼────────────▼───────────────▼──────────┐   │
│  │                       Use Cases (Actions)                     │   │
│  │                                                               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │ DeployProject│  │ CreateProject│  │ DetectFramework  │   │   │
│  │  ├──────────────┤  ├──────────────┤  ├──────────────────┤   │   │
│  │  │ StopProject  │  │ DeleteProject│  │ ConfigureProxy   │   │   │
│  │  ├──────────────┤  ├──────────────┤  ├──────────────────┤   │   │
│  │  │ RollbackDeploy│ │ ListCommits  │  │ VerifyDomain     │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │   │
│  └──────────────────────────┬────────────────────────────────────┘   │
│                              │                                       │
│  ┌───────────────┐  ┌───────▼───────┐  ┌───────────────────────┐   │
│  │ SQLite (WAL)  │  │ Build Engine  │  │ Caddy Manager         │   │
│  │               │  │               │  │                       │   │
│  │ projects      │  │ git clone/pull│  │ Admin API             │   │
│  │ deployments   │  │ npm ci        │  │ Route management      │   │
│  │ settings      │  │ npm run build │  │ Auto-SSL (ACME)       │   │
│  │               │  │ rsync         │  │ Validate-before-apply │   │
│  └───────────────┘  │ health check  │  └───────────────────────┘   │
│                      └───────┬───────┘                              │
│                              │                                       │
│  ┌───────────────────────────▼───────────────────────────────────┐   │
│  │                    systemd Manager                            │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │   │
│  │  │ Create unit │  │ Restart     │  │ Read logs   │          │   │
│  │  │ (EJS → .svc)│  │ (systemctl) │  │ (journalctl)│          │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │   │
│  └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3. Build Pipeline (уточнённый)

Учитывая уроки Coolify (queue isolation, build skip, rolling update) и CapRover (validate-before-apply):

```
Деплой v0.1 (нативный, для Node.js):
──────────────────────────────────────
 1. [LOCK]     Проверить project lock (per-project, не global)
 2. [SKIP?]    Если current_sha === target_sha && !force → SKIP
 3. [FETCH]    git fetch origin → git checkout {sha}
 4. [INSTALL]  npm ci (в src_dir)
 5. [BUILD]    framework-specific build command
 6. [SYNC]     rsync -a --delete {output}/ → runtime_dir/
 7. [DEPS]     cp package*.json → runtime_dir/ && npm ci --omit=dev
 8. [VALIDATE] Проверить, что start_cmd запускает процесс
 9. [RESTART]  systemctl restart {service}
10. [HEALTH]   HTTP GET 127.0.0.1:{port}/ (retries: 5, interval: 2s)
11. [UPDATE]   Обновить current_sha, deployment status
12. [UNLOCK]   Снять lock
13. [NOTIFY]   SSE event: deployment_complete

При ошибке на любом шаге:
├── Записать ошибку в deployment log
├── Статус → FAILED
├── Снять lock
└── SSE event: deployment_failed

Деплой v0.3 (Docker-based, для Python/Go/Rust через Nixpacks):
───────────────────────────────────────────────────────────────
 1. [LOCK]     Per-project lock
 2. [SKIP?]    SHA check
 3. [FETCH]    git fetch → checkout
 4. [DETECT]   Nixpacks detect → сгенерировать Dockerfile
 5. [BUILD]    docker build -t {project}:{sha7} .
 6. [STOP]     docker stop {old_container}
 7. [RUN]      docker run -d --name {project} -p {port}:{port} {image}
 8. [HEALTH]   HTTP health check
 9. [PROXY]    Обновить Caddy → маршрут на Docker-контейнер
10. [CLEANUP]  Удалить старые образы (оставить последние 3)
11. [UPDATE]   Записи в БД
12. [UNLOCK]   Снять lock
```

### 6.4. Решения, требующие дальнейшей проработки

| # | Вопрос | Варианты | Рекомендация |
|---|---|---|---|
| 1 | **UI-фреймворк** | React vs Solid vs Svelte | Solid (опыт из SFOTKAI) или React (экосистема) |
| 2 | **API-фреймворк** | Hono vs Fastify | Hono (легче, Web Standards, Bun-ready) |
| 3 | **Deployment queue** | Worker thread vs BullMQ | Worker thread (zero deps для MVP) |
| 4 | **Nixpacks integration** | CLI call vs library | CLI call (`npx nixpacks build .`) |
| 5 | **Health check strategy** | HTTP-only vs HTTP + process | HTTP с fallback на process.alive |
| 6 | **Caddy management** | Caddyfile + reload vs Admin API | Admin API (программный, atomic) |
| 7 | **Rolling update (v0.2)** | Dual-port-swap vs symlink-swap | Dual-process с port swap |
| 8 | **Multi-site install** | npm global vs Docker image | npm global + curl installer |

### 6.5. Минимальный рабочий прототип (PoC)

Для валидации архитектуры — реализовать в первую очередь:

```
PoC scope (1–2 дня):
├── detector.ts — прочитать package.json, определить фреймворк, вернуть build/start
├── builder.ts  — git pull → npm ci → npm run build → rsync
├── service.ts  — сгенерировать systemd-юнит (EJS), systemctl enable/start
├── caddy.ts    — добавить маршрут через Caddy Admin API
└── deploy.ts   — оркестратор: lock → detect → build → deploy → health → unlock

Без UI — только CLI-скрипт или curl-вызовы.
Если PoC работает — строим полноценный MVP.
```

---

## Приложения

### A. Полезные ссылки

| Ресурс | URL |
|---|---|
| Coolify (GitHub) | https://github.com/coollabsio/coolify |
| CapRover (GitHub) | https://github.com/caprover/caprover |
| Nixpacks | https://nixpacks.com |
| Caddy Admin API | https://caddyserver.com/docs/api |
| phpseclib (SSH library) | https://phpseclib.com |
| dockerode (Docker API) | https://github.com/apocas/dockerode |
| lorisleiva/laravel-actions | https://laravelactions.com |

### B. Глоссарий

| Термин | Определение |
|---|---|
| **PaaS** | Platform as a Service — платформа, предоставляющая инфраструктуру для деплоя |
| **Nixpacks** | Open-source инструмент для автоопределения языка и генерации Docker-образов |
| **Rolling update** | Стратегия обновления: новый инстанс стартует до остановки старого |
| **ACME** | Протокол автоматического получения SSL-сертификатов (Let's Encrypt) |
| **BuildKit** | Оптимизированный build-движок Docker с кешированием слоёв |
| **WAL** | Write-Ahead Logging — режим SQLite для concurrent reads |
| **Advisory lock** | Механизм блокировки, не связанный с конкретной строкой таблицы |
| **Health check** | Автоматическая проверка работоспособности сервиса после деплоя |
| **Drift detection** | Обнаружение расхождений между желаемым и фактическим состоянием |
| **captain-definition** | Файл конфигурации деплоя, специфичный для CapRover |

### C. Метрики анализа кода

| Метрика | Coolify | CapRover |
|---|---|---|
| Размер репозитория | ~580 MB | ~45 MB |
| Основной язык | PHP (~60%), Blade (~25%) | TypeScript (~95%) |
| Количество файлов (src) | ~2000+ | ~60 |
| Миграции БД | 200+ | 0 (JSON) |
| Тесты | Pest + Dusk (browser) | Jest |
| Docker-зависимость | Обязательна | Обязательна |
| Минимальная RAM для платформы | ~500 MB | ~200 MB |
| Время холодного старта | ~10 сек (Laravel boot) | ~2 сек (Node.js) |

---

> **Итого**: Анализ кода Coolify и CapRover подтвердил правильность архитектурного направления FrostDeploy — лёгкий Node.js single-process, SQLite, Caddy, нативные сборки для JS с опциональным Docker/Nixpacks для мульти-языковой поддержки. Основные заимствования: Actions pattern, queue isolation, build skip, validate-before-apply, SSE real-time. Основные избегания: глобальный mutex, JSON-хранилище, Docker-зависимость в MVP, vendor-specific конфигурационные файлы.
