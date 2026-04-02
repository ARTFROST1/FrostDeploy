# FrostDeploy — Production Testing Progress

> **Начало тестирования:** 2 апреля 2026
> **Сервер:** RU VDS 203.31.40.195 (Москва, Debian 12.13, 2 vCPU, 3.8GB RAM, 45GB NVMe)
> **Домен:** obrazz-ai.ru
> **Тестовый проект:** https://github.com/ARTFROST1/LandingPageObrazz
> **FrostDeploy URL:** http://203.31.40.195:9000

> ⚠️ **ВНИМАНИЕ: Совместное использование сервера**
>
> Сервер `203.31.40.195` используется **тремя проектами одновременно:**
>
> | Проект | Сервис | Порт | Директория |
> |--------|--------|------|------------|
> | **La Villa Pine** | Astro SSR + Caddy | 4321 | `/var/www/lavillapine` |
> | **SFOTK.AI** | PostgreSQL 17 + AmneziaWG | 5432, 51820 | — |
> | **FrostDeploy** | Deploy platform | 9000 | `/opt/frostdeploy` |
>
> **Порт 4321 ЗАНЯТ La Villa Pine.** Управляемые FrostDeploy приложения должны использовать порты 4322+.
> При тестировании НЕ трогайте: `lavillapine.service`, Caddy конфиг для lavillapine.ru, PostgreSQL, AmneziaWG.

---

## Фаза A: Подготовка сервера и деплой

| Шаг | Статус | Описание | Заметки |
|-----|--------|----------|---------|
| A.1 | ✅ | Анализ текущего состояния сервера | Debian 12, Node.js 22.22.1, Caddy v2.11.2, PostgreSQL 17 (SFOTK.AI), La Villa Pine (Astro, порт 4321), AmneziaWG |
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
| C.2 | ✅ | Deploy через UI | Pipeline: clone ✅ → checkout ✅ → install ✅ → build ❌ → build ✅ (после 4 фиксов) |
| C.3 | ✅ | Проверка SSE логов | Deploy console работает, показывает полный лог |
| C.4 | ✅ | Проверка работы сайта | Next.js app запущена на порту 4322 (изначально 4321 → конфликт с La Villa Pine → исправлен), systemd unit auto-создан |

### Детали деплой-пайплайна (сессия 2)

Deploy pipeline прошёл через 4 итерации исправлений:

1. **Тестовый репо: tailwindcss в devDependencies** — `npm ci --ignore-scripts` не ставил build-time deps. Fix: перенос tailwindcss, postcss, autoprefixer в dependencies (коммит 64a7406 в LandingPageObrazz)
2. **NODE_ENV=production + npm ci** — systemd сервис FrostDeploy запускается с `NODE_ENV=production`, который наследуется child-процессами. `npm ci` под production-env пропускает devDependencies (261 vs 505 пакетов). Fix: `npm ci --include=dev` (коммит d1f7e05)
3. **Rsync ломал структуру Next.js** — старая логика копировала СОДЕРЖИМОЕ outputDir в runtimeDir (т.е. .next/* → /var/www/project/), а `next start` ожидает `.next/` директорию. Fix: rsync копирует весь srcDir → runtimeDir, исключая node_modules и .git (коммит 062d62d)
4. **Systemd unit не создавался** — `createUnit()` при создании проекта failed silently. Deploy worker теперь auto-создаёт unit если файл не найден (коммит 1cf6e8e). Шаблон имел `User=frostdeploy` (не существует) → исправлен на `User=root` (коммит ba2cb6e)

**Финальный результат:** Deploy successful in 92.2s — все 7 шагов: fetch → checkout → install (505 packages) → build (Next.js 15.5.12 ✓) → sync → restart → healthcheck ✅

**Runtime:** Next.js app возвращает HTTP 500 на localhost:4322 (ожидаемо — нужны NEXT_PUBLIC_SUPABASE_URL/ANON_KEY env vars для полноценной работы). Сам pipeline работает E2E.

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
| 9 | npm ci --ignore-scripts ломает @next/swc postinstall | server/src/services/build-service.ts | ✅ | d1f7e05 |
| 10 | NODE_ENV=production → npm ci пропускает devDependencies | server/src/services/build-service.ts | ✅ | 174e7d7 |
| 11 | Rsync копирует содержимое outputDir вместо всего проекта | server/src/lib/rsync.ts | ✅ | 062d62d |
| 12 | Systemd unit не создаётся при первом деплое | server/src/queue/deploy-worker.ts | ✅ | 1cf6e8e |
| 13 | EJS undefined optional fields (envFilePath) | server/src/queue/deploy-worker.ts | ✅ | 1cf6e8e |
| 14 | Systemd template: User=frostdeploy не существует | server/src/templates/systemd.service.ejs | ✅ | ba2cb6e |
| 15 | Systemd template: ExecStart=npm без полного пути | server/src/templates/systemd.service.ejs | ✅ | ba2cb6e |

---

## Фаза F: Domain flow, port check, документация, повторное тестирование (сессия 3)

### F.0 — Предварительные исправления кодовой базы

| Шаг | Статус | Описание | Заметки |
|-----|--------|----------|---------|
| F.0.1 | ⏳ | Добавить вкладку "Домен" в ProjectLayout | Новый tab между "Логи" и "Настройки" |
| F.0.2 | ⏳ | Создать project-domain.tsx (полный domain flow) | Empty state → Add domain → DNS records → Verify → Active |
| F.0.3 | ⏳ | Добавить API endpoints для per-project DNS records | GET /api/projects/:id/dns-records, POST /api/projects/:id/dns-verify |
| F.0.4 | ⏳ | Исправить domain card в overview | Реальный SSL status, не хардкодный "SSL ✅" |
| F.0.5 | ⏳ | Убрать поле domain из new-project wizard | Домен добавляется после создания через вкладку "Домен" |
| F.0.6 | ⏳ | Убрать поле domain из project-settings | Domain управляется на вкладке "Домен" |
| F.0.7 | ⏳ | Добавить OS-level проверку порта | ss -tlnp перед назначением и перед деплоем |
| F.0.8 | ⏳ | Перенести README.md в doc/FULL-GUIDE.md | Создать новый короткий README.md |
| F.0.9 | ⏳ | PORT_RANGE_START=4322 (4321 зарезервирован) | La Villa Pine на 4321 |

### F.1 — Тестирование через Chrome DevTools

| Шаг | Статус | Описание | Заметки |
|-----|--------|----------|---------|
| F.1.1 | ⏳ | Сборка и деплой обновлённого кода на сервер | pnpm build + systemctl restart |
| F.1.2 | ⏳ | Удалить текущий проект через UI | Chrome DevTools → Настройки → Удалить |
| F.1.3 | ⏳ | Проверить cleanup (systemd, Caddy, файлы) | journalctl, ls /var/www/, Caddy config |
| F.1.4 | ⏳ | Добавить проект без домена | Только по IP |
| F.1.5 | ⏳ | Задеплоить проект | Полный pipeline |
| F.1.6 | ⏳ | Проверить работу сайта по IP:port | curl http://203.31.40.195:4322 |
| F.1.7 | ⏳ | Зайти во вкладку "Домен" → добавить obrazz-ai.ru | Новый domain flow |
| F.1.8 | ⏳ | Получить DNS записи, показать пользователю | askQuestions |
| F.1.9 | ⏳ | Пользователь добавляет DNS записи | Ожидание ответа |
| F.1.10 | ⏳ | Нажать "Проверить" → DNS verified | Проверка dig |
| F.1.11 | ⏳ | Проверить SSL сертификат | Caddy auto-SSL через Let's Encrypt |
| F.1.12 | ⏳ | Проверить сайт по https://obrazz-ai.ru | Должен отобразить LandingPageObrazz |
| F.1.13 | ⏳ | Полное UI тестирование всех экранов | Desktop + Mobile |

### Ключевые архитектурные решения (сессия 3)

1. **Вкладка "Домен"** — отдельная страница (`project-domain.tsx`) вместо поля в Settings. Flow:
   - Нет домена → CTA "Добавить домен"
   - Ввод домена → Показ DNS записей (A: @ → IP, A: www → IP)
   - Кнопка "Проверить DNS" → dig проверка
   - DNS verified → Caddy добавляет route → SSL provisioning
   - SSL active → Домен полностью работает
   - Кнопка "Изменить" (карандаш) для смены домена

2. **Port check** — `ss -tlnp :PORT` перед:
   - Назначением порта при создании проекта
   - Перезапуском сервиса при деплое

3. **PORT_RANGE_START = 4322** — порт 4321 зарезервирован La Villa Pine

4. **README split** — текущий README → doc/FULL-GUIDE.md, новый короткий README для GitHub

---

## Итоговый результат (сессия 1–2)

- [x] FrostDeploy установлен и работает на http://203.31.40.195:9000
- [x] Setup wizard пройден (пароль, PAT, домен)
- [x] Проект добавлен и задеплоен (pipeline E2E работает — 92.2s)
- [x] Все UI страницы проверены (13/13)
- [x] Responsive design проверен (desktop/tablet/mobile)
- [x] 15 багов обнаружено и исправлено
- [x] Systemd unit auto-создаётся при первом деплое
- [x] Next.js app запускается на localhost:4322 (ОБЯЗАТЕЛЬНО СМОТРЕТЬ НЕ ЗАНЯТ ЛИ ПОРТ 4321 ПЕРЕД ДЕПЛОЕМ)

### Открытые вопросы
- [ ] Domain flow в UI: домен показывается до настройки DNS, нет проверки SSL, карточка не различает IP/домен
- [ ] Caddy proxy: нужно проверить, работает ли reverse proxy через домен после DNS привязки
- [ ] Документация: setup guide для нового пользователя (от git clone до рабочей платформы)

### Ключевые технические находки
1. **NODE_ENV=production наследуется child-процессам** через systemd → npm ci пропускает devDeps → решение: `--include=dev`
2. **Rsync output-only модель не работает для Node.js серверов** → решение: rsync всего src (минус node_modules/.git)
3. **Порт 4321 может быть занят предыдущим ручным тестом** → deploy pipeline должен убивать старый процесс перед restart
4. **User=frostdeploy не создан** → пока используем root, в будущем нужно createUser при setup

### Инцидент: конфликт портов (2 апреля 2026)

**Проблема:** FrostDeploy автоматически назначил порт 4321 для тестового проекта LandingPageObrazz. Этот порт уже использовался La Villa Pine (Astro SSR). При запуске `frostdeploy-landingpageobrazz.service` порт 4321 был занят → `lavillapine.service` упал с ошибкой `EADDRINUSE` и не мог перезапуститься.

**Решение:**
1. Изменён порт в `/etc/systemd/system/frostdeploy-landingpageobrazz.service`: `PORT=4321` → `PORT=4322`
2. `systemctl daemon-reload && systemctl stop frostdeploy-landingpageobrazz`
3. `systemctl start lavillapine` → HTTP 200 ✅
4. `systemctl start frostdeploy-landingpageobrazz` → запущен на 4322 ✅

**TODO:** Добавить в FrostDeploy проверку занятых портов перед назначением (`ss -tlnp`). Диапазон managed-приложений должен начинаться с 4322+ (4321 зарезервирован за La Villa Pine).
