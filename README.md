# ruxsatnoma-docs

Документация проекта **«Ruxsatnoma-urmon.uz»** — государственной системы выдачи электронных разрешений на пользование землями лесного фонда Республики Узбекистан.

## Что в репозитории

| Путь | Содержание |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | **Точка входа** — состояние проекта, принятые решения, чего нельзя делать, риски |
| [`plans/`](plans/00-roadmap.md) | **Дорожная карта и планы фаз** — начинать отсюда, если приступаешь к работе |
| [`tz/`](tz/) | **Полный разбор нового ТЗ в markdown** — 21 файл |
| [`architecture/diagrams.md`](architecture/diagrams.md) | **Архитектура в схемах** — полная картина + 12 срезов на Mermaid, готовы к вставке в Excalidraw |
| [`architecture/database.md`](architecture/database.md) | **Схема БД** — разделение баз и схем, критичные constraint'ы, индексы под SLA, права и RLS |
| [`architecture/modules.md`](architecture/modules.md) | **Границы модулей** внутри `core` — правила импорта, матрица зависимостей, владельцы пакетов |
| [`architecture/contracts.md`](architecture/contracts.md) | **Контракты** `core` ↔ `integration` — REST, события AMQP, интерфейс платёжного адаптера |
| [`architecture/api-design.md`](architecture/api-design.md) | **Дизайн внешнего API** — пути, форматы, пагинация, коды, идемпотентность |
| [`architecture/security.md`](architecture/security.md) | **Модель безопасности** — аутентификация, RBAC и ABAC, прокурорский контур, аудит, ЭЦП |
| [`architecture/infrastructure.md`](architecture/infrastructure.md) | **Инфраструктура** — окружения, nginx, образы, CI/CD, секреты, резервирование |
| [`architecture/observability.md`](architecture/observability.md) | **Наблюдаемость** — логи, метрики, трассировка, health-checks, оповещения |
| [`architecture/migration.md`](architecture/migration.md) | **Миграция данных** — соответствия полей и статусов, фазы перехода, сверка, откат |
| [`architecture/engineering-standards.md`](architecture/engineering-standards.md) | **Инженерные стандарты** — Python и FastAPI, DDD выборочно, SOLID, тесты, Ruff, mypy, pytest |
| [`design/`](design/design-system.md) | **Дизайн** — дизайн-система, карта из 94 экранов, потоки пользователей |
| [`qa/questions-to-customer.md`](qa/questions-to-customer.md) | **Вопросы Заказчику** — накопительный документ для отправки: блокеры, пробелы, расхождения |
| `ruxsatnoma-new-tz.docx` | Новое ТЗ, 52 листа, узбекская кириллица, действует с 1 августа 2026 |
| `ruxsatnoma-old-tz.pdf` | Старое ТЗ 2021 г., 67 страниц — по нему работает действующая платформа |

Разбор в `tz/` сделан так, чтобы к исходным `.docx` и `.pdf` больше не приходилось возвращаться: каждый файл ссылается на пункты оригинала, все таблицы, формулы, статусы, коды ошибок и приложения перенесены целиком.

**Точка входа:** [`CLAUDE.md`](CLAUDE.md) — состояние проекта, принятые решения, риски. Навигация по разбору ТЗ — [`tz/README.md`](tz/README.md).

**Самое важное:** [`tz/18-gaps-and-open-questions.md`](tz/18-gaps-and-open-questions.md) — пробелы и противоречия ТЗ, открытые вопросы Заказчику, архитектурные развилки.

## О системе

| | |
|---|---|
| Полное имя | Система выдачи онлайн-билетов (разрешений) на выпас скота на пастбищных землях лесного фонда и сенокошение |
| Условное имя | «Ruxsatnoma» АТ |
| Код системы | `00011558.РухсатномаАТ` |
| Домен | `ruxsatnoma-urmon.uz` |
| Заказчик | Агентство по увеличению лесов и зелёных зон, борьбе с опустыниванием |
| Исполнитель | ГУ «Центр цифровизации лесного хозяйства» |

**Масштаб:** 12 подсистем (основная — из 14 модулей), 27 сценариев использования, 12 внешних интеграций, 84 организации, до 1000 одновременных пользователей, ≥ 30 000 разрешений в год.

**Виды деятельности:** выпас скота, сенокошение, размещение пчелиных ульев, рекреация и культурно-просветительское использование, сбор дров/сучьев/хвороста, научные исследования.

## Репозитории проекта

| Репозиторий | Назначение |
|---|---|
| [`ruxsatnoma-core`](https://github.com/Stat-Forest/ruxsatnoma-core) | Модульный монолит: IAM, заявки, GIS, rule engine, разрешения, платежи, инспектор, отчёты, витрина прокурора |
| [`ruxsatnoma-integration`](https://github.com/Stat-Forest/ruxsatnoma-integration) | Адаптеры к внешним ИС, очереди, outbox и DLQ, обмен с «Raqamli nazorat» |
| [`ruxsatnoma-frontend`](https://github.com/Stat-Forest/ruxsatnoma-frontend) | Фронтенд, Next.js |
| [`ruxsatnoma-gis`](https://github.com/Stat-Forest/ruxsatnoma-gis) | Зарезервирован на случай выделения GIS в отдельный сервис |
| [`ruxsatnoma-payment`](https://github.com/Stat-Forest/ruxsatnoma-payment) | Зарезервирован на случай выделения платежей |
| `ruxsatnoma-docs` | Этот репозиторий |
| `ruxsatnoma-old` | Код действующей платформы, только как справочник |

## Контекст

Действующая платформа — Django-монолит на Django templates, без отдельного фронтенда, работает по старому ТЗ 2021 года и покрывает 2 сценария из 27. Переписывается с нуля.

Обследование действующей платформы и сравнение старого ТЗ с новым — в [`tz/19-legacy.md`](tz/19-legacy.md), аудит кода — в [`tz/20-legacy-code-audit.md`](tz/20-legacy-code-audit.md).

Архитектурные решения и схемы — в [`architecture/diagrams.md`](architecture/diagrams.md).

## Команда

4 разработчика: **3 backend + 1 frontend**. Технический лидер отвечает за архитектуру, DevOps, дизайн, бэкенд и фронтенд.

Дизайна пока нет — дизайн-система создаётся с нуля. Требования к интерфейсу (единая дизайн-система, responsive, WCAG 2.2 AA, 5 языков) — в [`tz/12-nfr.md`](tz/12-nfr.md), раздел 4.1.7.
