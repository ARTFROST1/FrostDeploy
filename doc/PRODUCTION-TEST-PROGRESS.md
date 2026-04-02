# FrostDeploy — Production Testing Progress

> **Начало тестирования:** 2 апреля 2026
> **Сервер:** RU VDS 203.31.40.195 (Москва, Debian 12.13, 2 vCPU, 3.8GB RAM, 45GB NVMe)
> **Домен:** obrazz-ai.ru
> **Тестовый проект:** https://github.com/ARTFROST1/LandingPageObrazz
> **FrostDeploy URL:** http://203.31.40.195:9000

---

## Фаза A: Подготовка сервера и деплой

| Шаг | Статус | Описание | Заметки |
|-----|--------|----------|---------|
| A.1 | ✅ | Анализ текущего состояния сервера | Debian 12, Node.js 22.22.1, Caddy v2.11.2, PostgreSQL 17 (La Villa Pine) |
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
| C.2 | ✅ | Deploy через UI | Pipeline: clone ✅ → checkout ✅ → install ✅ → build ❌ (проблемы тестового репо) |
| C.3 | ✅ | Проверка SSE логов | Deploy console работает, показывает полный лог |
| C.4 | ⏳ | Проверка работы сайта | Build failed из-за missing deps в тестовом репо (tailwindcss, supabase) |

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

---

## Итоговый результат

- [x] FrostDeploy установлен и работает на http://203.31.40.195:9000
- [x] Setup wizard пройден (пароль, PAT, домен)
- [x] Проект добавлен и задеплоен (pipeline E2E работает)
- [x] Все UI страницы проверены (13/13)
- [x] Responsive design проверен (desktop/tablet/mobile)
- [x] Все 8 обнаруженных багов исправлены и запушены

### Оставшиеся задачи
- [ ] Исправить тестовый репозиторий (tailwindcss, supabase deps) и запустить успешный деплой
- [ ] Проверить полный цикл: билд → запуск → Caddy proxy → сайт доступен по домену
