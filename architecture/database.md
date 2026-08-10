# Схема базы данных

PostgreSQL 18 + PostGIS 3.6. Две базы: `ruxsatnoma_core` и `ruxsatnoma_integration`.

Модель данных из ТЗ — [`../tz/11-data-model.md`](../tz/11-data-model.md), 33 сущности. Здесь то, чего в ТЗ нет: физическая схема, ограничения целостности, индексы и права.

> **Статус документа.** Здесь — решения и обоснования: почему схема устроена так, какие ограничения где живут и почему. Полное описание всех 50 таблиц с колонками и ER-диаграммами вынесено в отдельный документ: **[`database-schema.md`](database-schema.md)**.
>
> 10 августа 2026 схема **проверена на живой базе** — PostgreSQL 18.1 + PostGIS 3.6, накатывается без ошибок. Результаты и три найденных дефекта — в разделе 11.
>
> **Реализация — через Alembic силами разработчиков.** Сырого DDL в репозитории кода нет: миграции пишет владелец сервиса, это его зона. Техлид отвечает за описание схемы, а не за её реализацию — см. [`../CLAUDE.md`](../CLAUDE.md), раздел «Разделение труда».

---

## 1. Общие правила

| Правило | Как |
|---|---|
| Первичные ключи | `uuid` с `gen_random_uuid()`. Исключение — справочники с внешними кодами, там натуральный ключ |
| Время | Только `timestamptz`. Хранение в UTC, отображение в UTC+5 — требование п. 4.3.6 ТЗ. Источник времени — NTP |
| Деньги | Только `numeric(18,2)`. **Никогда `float` и `int`** — старая система считала через `int()` и теряла копейки |
| Площади | `numeric(12,4)` гектаров. Геометрия — источник истины, площадь денормализована для скорости |
| Периоды | `daterange` — разрешения выдаются по датам, не по моментам |
| Тексты-перечисления | `text` + `CHECK` со списком значений. Не `enum` — его больно менять миграцией |
| Мягкое удаление | Нет. Вместо него `status` со значением `ARCHIVED`. ТЗ запрещает удаление данных всем, кроме администратора |
| Имена | `snake_case`, таблицы в единственном числе: `application`, `permit`, `contour` |
| Обязательные поля везде | `created_at`, `updated_at`, `created_by`, `updated_by` |

Все таблицы, участвующие в миграции, дополнительно несут `legacy_id bigint` и `legacy_table text` — чтобы в любой момент проследить строку до старой базы. См. [`diagrams.md`](diagrams.md), схема 10.

---

## 2. Разделение баз и схем

### База `ruxsatnoma_core`

| Схема | Таблицы | Модуль |
|---|---|---|
| `iam` | `user_account`, `role`, `permission`, `role_permission`, `organization`, `applicant`, `delegation`, `session` | iam |
| `geo` | `layer`, `contour`, `contour_version`, `occupancy` | gis |
| `rules` | `norm`, `tariff`, `season_calendar`, `rotation_plan`, `bhm_history` | rules |
| `app` | `application`, `application_status_history`, `application_document`, `calculation`, `contract` | application |
| `permit` | `permit`, `permit_template`, `signature`, `forest_ticket` | permit, signature |
| `pay` | `invoice`, `payment_intent`, `provider_transaction`, `bank_statement`, `bank_statement_line`, `reconciliation`, `allocation`, `refund` | payment |
| `insp` | `inspection_task`, `inspection_act`, `checklist_template`, `media`, `violation_case` | inspection |
| `rep` | `report_form`, `report`, `report_column` | reporting |
| `nsi` | `classifier`, `classifier_value` | classifiers |
| `audit` | `audit_log`, `risk_indicator`, `oversight_event`, `outbox_message` | audit, outbox |
| `arch` | `archive_item` | archive |

Схема = модуль. **Модуль пишет только в свою схему.** Чужие данные читает через публичный API модуля или через явно выданные view. Это и есть шов, по которому `geo` и `pay` можно будет вынести в отдельные сервисы.

### База `ruxsatnoma_integration`

| Схема | Таблицы |
|---|---|
| `outbox` | `message`, `delivery_attempt`, `dlq_message` |
| `inbox` | `webhook_event`, `idempotency_key` |
| `adapter` | `provider_config`, `adapter_state`, `circuit_state`, `certificate` |
| `contract` | `api_contract`, `contract_version` |

Отдельная база нужна, чтобы падение и переполнение очередей не задевало основную.

---

## 3. Роли и права в СУБД

```sql
-- owner of the core schemas, full DML
CREATE ROLE app_core LOGIN PASSWORD :'core_pw';

-- prosecutor: read-only, no write privileges whatsoever
CREATE ROLE oversight_ro LOGIN PASSWORD :'ro_pw';
GRANT USAGE ON SCHEMA iam, geo, rules, app, permit, pay, insp, rep, nsi, audit, arch TO oversight_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA iam, geo, rules, app, permit, pay, insp, rep, nsi, audit, arch TO oversight_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE app_core IN SCHEMA app, permit, pay GRANT SELECT ON TABLES TO oversight_ro;

-- belt and braces: an accidental GRANT still leaves no write access
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA
    iam, geo, rules, app, permit, pay, insp, rep, nsi, audit, arch FROM oversight_ro;

-- owner of the integration database
CREATE ROLE app_integration LOGIN PASSWORD :'int_pw';

-- migration scripts, used only during the cutover window
CREATE ROLE migrator LOGIN PASSWORD :'mig_pw';
```

`core` держит **два пула соединений**: обычный под `app_core` и отдельный под `oversight_ro`. Запросы под ролью «Прокурор» роутятся во второй. Это и есть выполнение требования приложения 6 ТЗ без отдельного сервиса.

### Территориальное ограничение прокурора на уровне СУБД

Дополнительно к проверке в приложении включаем RLS — тогда даже ошибка в коде не покажет чужую область:

```sql
ALTER TABLE app.application ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_territory_ro ON app.application
    FOR SELECT TO oversight_ro
    USING (
        territory_code = current_setting('app.territory_code', true)
        OR current_setting('app.territory_scope', true) = 'REPUBLIC'
    );
```

`core` выставляет `SET LOCAL app.territory_code` в начале транзакции из данных, полученных от «Raqamli nazorat». Аналогичные политики — на `permit`, `pay.invoice`, `insp.inspection_act`, `audit.audit_log`.

Две оговорки, о которых легко забыть:

- **Владелец таблицы обходит RLS.** `app_core` владеет схемами, поэтому политики на него не действуют — обычная работа системы не замедляется. Для `oversight_ro` они действуют, потому что он не владелец. Это ровно то поведение, которое нужно, но при отладке выглядит неочевидно.
- **`territory_code` денормализован** на все таблицы, по которым фильтрует прокурор: `application`, `permit`, `invoice`, `inspection_act`, `audit_log`. Без этого политика превращается в подзапрос с джойном и убивает требование «поиск ≤ 3 секунды».

---

## 4. Ключевые ограничения целостности

Пять мест, где ошибка стоит дороже всего. Все проверки — **на уровне СУБД**, а не приложения.

### 4.1. Одна активная заявка на связку заявитель + контур + вид деятельности + период

Прямое требование ТЗ (модуль 10.1): «через constraint СУБД». KPI — ноль дубликатов.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE app.application
ADD CONSTRAINT application_no_active_duplicate
EXCLUDE USING gist (
    applicant_id   WITH =,
    contour_id     WITH =,
    activity_type  WITH =,
    period         WITH &&
)
WHERE (status IN (
    'SUBMITTED','IN_REVIEW','PENDING_INFO','CONTRACT_DRAFT',
    'APPROVED','INVOICED','PAID','PERMIT_ISSUED'
));
```

Нарушение → приложение отдаёт `409` и код `ERR-APP-002` с номером существующей заявки.

### 4.2. Площадь не занята чужим активным разрешением

Это не constraint — площадь считается геометрией. Но есть гонка: две заявки одновременно проходят проверку и обе создаются. Закрываем блокировкой по контуру внутри транзакции:

```sql
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended(contour_id::text, 0));

-- free area on the contour for the given period
SELECT ST_Area(
         ST_Difference(c.geometry,
                       COALESCE(ST_Union(o.geometry), 'POLYGON EMPTY'::geometry)
         )::geography
       ) / 10000 AS available_ha
FROM geo.contour c
LEFT JOIN geo.occupancy o
       ON o.contour_id = c.id
      AND o.period && $2::daterange
      AND o.status = 'ACTIVE'
WHERE c.id = $1
GROUP BY c.geometry;

-- validations, calculation, INSERT application, INSERT occupancy
COMMIT;
```

Блокировка держится до конца транзакции и снимается автоматически. Заявки на разные контуры друг друга не ждут.

### 4.3. Аудит нельзя изменить и удалить

Требование п. 4.2.4: «системному администратору не предоставляется право изменять и удалять журналы».

```sql
REVOKE UPDATE, DELETE, TRUNCATE ON audit.audit_log FROM PUBLIC, app_core;

CREATE OR REPLACE FUNCTION audit.deny_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only (RI-06)'
        USING ERRCODE = 'insufficient_privilege';
END $$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
    BEFORE UPDATE OR DELETE ON audit.audit_log
    FOR EACH ROW EXECUTE FUNCTION audit.deny_mutation();
```

Попытка ловится приложением и порождает риск-индикатор `RI-06` критического уровня с оповещением SOC.

### 4.4. Серия и номер разрешения не повторяются

Требование сценария С11: «неповторяемость гарантируется на уровне СУБД».

```sql
ALTER TABLE permit.permit ADD CONSTRAINT permit_series_number_unique UNIQUE (series, number);
```

Генерация номера — через `SEQUENCE` на серию, не через `MAX(number)+1`.

### 4.5. Активное разрешение обязано быть связано с GIS

KPI — 100 % активных разрешений с валидной геометрией и `contour_id`.

```sql
ALTER TABLE permit.permit ADD CONSTRAINT permit_gis_bound CHECK (
    status <> 'ACTIVE' OR (contour_id IS NOT NULL AND geometry IS NOT NULL AND ST_IsValid(geometry))
);
```

---

## 5. Ключевые таблицы

Приведены только неочевидные поля. Полный перечень сущностей — в [`../tz/11-data-model.md`](../tz/11-data-model.md).

### `app.application`

```sql
CREATE TABLE app.application (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    number            text NOT NULL UNIQUE,           -- A-00001, generated by a SEQUENCE
    applicant_id      uuid NOT NULL REFERENCES iam.applicant,
    organization_id   uuid NOT NULL REFERENCES iam.organization,
    territory_code    text NOT NULL,                  -- denormalised for ABAC and RLS
    activity_type     text NOT NULL,                  -- one of the 6 activity types
    contour_id        uuid REFERENCES geo.contour,
    geometry          geometry(MultiPolygon, 4326),
    period            daterange NOT NULL,
    status            text NOT NULL,
    channel           text NOT NULL,                  -- PORTAL | MYGOV
    assignee_id       uuid REFERENCES iam.user_account,
    sla_deadline      timestamptz,
    sla_paused_at     timestamptz,                    -- PENDING_INFO pauses the SLA timer
    reject_reason     text,                           -- RJ-01…RJ-15
    reject_legal_base text,
    legacy_id         bigint,
    legacy_table      text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    created_by        uuid,
    updated_at        timestamptz NOT NULL DEFAULT now(),
    updated_by        uuid
);
```

### `app.calculation` — воспроизводимость расчёта

```sql
CREATE TABLE app.calculation (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  uuid NOT NULL REFERENCES app.application,
    rule_version    text NOT NULL,          -- norm and tariff version at calculation time
    input_snapshot  jsonb NOT NULL,         -- every input the calculation was fed
    max_sb          numeric(12,2) NOT NULL,
    active_permits_sb numeric(12,2) NOT NULL,
    remaining_sb    numeric(12,2) NOT NULL,
    used_sb         numeric(12,2) NOT NULL,
    amount          numeric(18,2) NOT NULL,
    bhm_value       numeric(18,2) NOT NULL, -- base unit value at calculation time
    is_legacy       boolean NOT NULL DEFAULT false,   -- migrated from the legacy system, must not be recalculated
    created_at      timestamptz NOT NULL DEFAULT now()
);
```

`input_snapshot` и `rule_version` — прямое требование п. 4.2.15: одинаковый вход даёт одинаковый результат, и любой расчёт можно объяснить задним числом.

### `geo.occupancy` — занятость контура

```sql
CREATE TABLE geo.occupancy (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contour_id     uuid NOT NULL REFERENCES geo.contour,
    application_id uuid REFERENCES app.application,
    permit_id      uuid REFERENCES permit.permit,
    geometry       geometry(MultiPolygon, 4326) NOT NULL,
    period         daterange NOT NULL,
    sb_load        numeric(12,2) NOT NULL,   -- load in conditional heads
    status         text NOT NULL,            -- ACTIVE | RELEASED
    created_at     timestamptz NOT NULL DEFAULT now(),
    CHECK (ST_IsValid(geometry))
);
```

Резервируется при переходе заявки в `SUBMITTED`, освобождается при `REJECTED`, `CANCELLED`, `EXPIRED_UNPAID` и по истечении срока разрешения.

### `rules.norm` и `rules.tariff` — версионирование

Обе таблицы несут `effective_from date NOT NULL`, `effective_to date`, `rule_version text NOT NULL`, `approval_doc_id uuid NOT NULL`, `status text NOT NULL`.

Без `approval_doc_id` перевод в `Published` блокируется триггером — требование сценария С18.

Изменение нормы **не пересчитывает** ранее выданные разрешения: они держатся за старый `rule_version` через `calculation`.

### `audit.audit_log` — партиционирование

```sql
CREATE TABLE audit.audit_log (
    id            bigint GENERATED ALWAYS AS IDENTITY,
    occurred_at   timestamptz NOT NULL DEFAULT now(),
    actor_id      uuid,
    actor_role    text,
    territory_code text,
    action        text NOT NULL,
    object_type   text NOT NULL,
    object_id     uuid,
    old_value     jsonb,
    new_value     jsonb,
    ip            inet,
    device        text,
    correlation_id uuid,
    legal_base    text,
    PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);
```

Секции по месяцам, хранение не менее 3 лет — 36 активных секций. Создание следующей секции — регламентным заданием `core-worker`.

### `audit.outbox_message` — надёжная доставка

```sql
CREATE TABLE audit.outbox_message (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    topic          text NOT NULL,          -- events | risk.detected | notify
    routing_key    text NOT NULL,          -- application.submitted, permit.issued …
    payload        jsonb NOT NULL,
    idempotency_key text NOT NULL UNIQUE,
    correlation_id uuid NOT NULL,
    status         text NOT NULL DEFAULT 'PENDING',
    attempts       int NOT NULL DEFAULT 0,
    next_attempt_at timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON audit.outbox_message (status, next_attempt_at) WHERE status = 'PENDING';
```

Запись в outbox идёт **в той же транзакции**, что и действие с аудитом — иначе теряются события при падении между коммитом и отправкой.

---

## 6. Пространственные данные

| Решение | Значение |
|---|---|
| SRID хранения | `4326` (WGS 84) — предварительно, зависит от ответа на вопрос **О8** |
| SRID расчёта площадей | Приведение к `geography` — даёт метры без выбора проекции |
| Тип геометрии | `MultiPolygon` для контуров и занятости, `Point` для GPS инспектора |
| Валидация | `CHECK (ST_IsValid(geometry))` на всех таблицах с геометрией |
| Индексы | `GIST` на каждом столбце геометрии |
| Тайлы | `ST_AsMVT` прямо из PostGIS, кэш в Redis |

```sql
CREATE INDEX contour_geom_gix    ON geo.contour   USING gist (geometry);
CREATE INDEX occupancy_geom_gix  ON geo.occupancy USING gist (geometry);
CREATE INDEX occupancy_lookup    ON geo.occupancy USING gist (contour_id, period)
    WHERE status = 'ACTIVE';
```

Последний индекс — рабочая лошадь проверки лимита. Он должен покрывать запрос из п. 4.2 целиком.

---

## 7. Индексы под требования производительности

Показатели из п. 4.1.4 ТЗ: p95 API ≤ 500 мс, GIS ≤ 3 с, проверка overlap ≤ 5 с, поиск прокурора ≤ 3 с, при 1000 одновременных пользователей.

### Рабочие списки

```sql
-- executor worklist: territory + status + deadline
CREATE INDEX application_worklist ON app.application (territory_code, status, sla_deadline)
    WHERE status IN ('SUBMITTED','IN_REVIEW','PENDING_INFO');

-- applicant cabinet listing
CREATE INDEX application_by_applicant ON app.application (applicant_id, created_at DESC);

-- assigned to an executor
CREATE INDEX application_by_assignee ON app.application (assignee_id, status)
    WHERE assignee_id IS NOT NULL;
```

### Публичная проверка разрешения по QR — ≤ 3 секунды

Отдельный индекс не нужен: `UNIQUE (series, number)` из п. 4.4 уже создаёт btree и покрывает поиск. Если профилирование покажет, что дорого обращение к куче за статусом, заменить ограничение на покрывающий уникальный индекс:

```sql
CREATE UNIQUE INDEX permit_series_number_uniq
    ON permit.permit (series, number) INCLUDE (status, valid_until);
```

и не объявлять `UNIQUE` отдельным ограничением.

### Фильтры прокурора — ≤ 3 секунды

Перечень фильтров задан сценарием С22: ЖШШИР/СТИР, номер разрешения, ID контура, территория, период, статус, сумма, ответственный сотрудник, тип риска.

```sql
CREATE INDEX application_prosecutor ON app.application (territory_code, created_at DESC, status);
CREATE INDEX applicant_by_pinfl     ON iam.applicant (pinfl);
CREATE INDEX applicant_by_tin       ON iam.applicant (tin);
CREATE INDEX permit_by_contour      ON permit.permit (contour_id, status);
CREATE INDEX invoice_by_amount      ON pay.invoice (territory_code, amount);
CREATE INDEX risk_by_code           ON audit.risk_indicator (code, detected_at DESC);
CREATE INDEX audit_by_actor         ON audit.audit_log (actor_id, occurred_at DESC);
CREATE INDEX audit_by_object        ON audit.audit_log (object_type, object_id, occurred_at DESC);
```

### Полнотекстовый поиск

ТЗ (п. 4.2.3) требует полнотекстовый поиск **с учётом морфологии**. Готовых словарей узбекского для PostgreSQL нет — это отдельная задача, вынесена в открытые вопросы. На старте — `pg_trgm` по наименованиям, что покрывает опечатки и частичные совпадения:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX applicant_name_trgm ON iam.applicant USING gin (full_name gin_trgm_ops);
CREATE INDEX organization_name_trgm ON iam.organization USING gin (name gin_trgm_ops);
```

### Сверка платежей

```sql
CREATE INDEX txn_by_external      ON pay.provider_transaction (external_id);
CREATE INDEX txn_unreconciled     ON pay.provider_transaction (created_at)
    WHERE status = 'PAID' AND reconciliation_id IS NULL;
CREATE INDEX stmt_line_by_amount  ON pay.bank_statement_line (statement_date, amount);
```

---

## 8. Резервирование

| Параметр | Значение | Источник |
|---|---|---|
| Архивация WAL | Непрерывная, PITR | п. 4.1.1.3, RPO ≤ 15 минут |
| Полная копия | Еженедельно | п. 4.2.14 |
| Инкрементальная | Ежедневно | п. 4.2.14 |
| Хранение копий | Не менее 1 месяца | п. 4.3.2.4 |
| Репликация | Потоковая на резервную площадку | RTO ≤ 4 часа |
| Проверка восстановления | Планово, с протоколом | сценарий С24 |

Требование п. 4.3.2.4 «резервная копия раз в 2 недели» несовместимо с RPO ≤ 15 минут — берём строгий вариант. Это расхождение **Р2** в файле Заказчику.

---

## 9. Что зависит от ответов Заказчика

| Вопрос | Что меняется в схеме |
|---|---|
| **О8** — система координат | SRID во всех таблицах с геометрией |
| **Б1** — есть ли цифровые контуры | Наличие `geometry` у мигрированных контуров, объём `geo.contour` |
| **Н1** — коэффициенты условных голов | Структура справочника видов скота и коэффициентов |
| **П1, П5** — модуль договора | Появится или нет таблица `app.contract`, сейчас заложена |
| **О9** — охота | Седьмой вид деятельности и таблица динамических полей формы |
| **О10** — сбор за рассмотрение | Второй тип инвойса и дополнительный статус заявки перед `SUBMITTED` |
| **О11** — внутренний кошелёк | Появятся или нет `pay.account_balance` и `pay.account_card` |
| **П9** — порог k-anonymity | Значение в конфигурации агрегатов открытой статистики |

Полный список — [`../qa/questions-to-customer.md`](../qa/questions-to-customer.md).

---

## 10. Порядок работ по схеме

1. Расширения: `postgis`, `btree_gist`, `pg_trgm`, `pgcrypto`
2. Роли и права, два пула соединений в `core`
3. Схемы `nsi` и `iam` — без них не стартует ничего
4. `geo` — контуры, слои, занятость, пространственные индексы
5. `rules` — норма, тариф, версионирование
6. `app` — заявка, расчёт, статус-машина, **exclusion constraint**
7. `audit` — партиционирование, триггер неизменяемости, outbox
8. `permit`, `pay` — разрешение и платежи
9. `insp`, `rep`, `arch` — инспекция, отчёты, архив
10. RLS-политики для роли прокурора
11. База `integration` — outbox, inbox, adapter

Пункты 1–7 — критический путь. Пока их нет, остальные модули писать не на чем.

---

## 11. Результаты проверки на живой базе

Проверено 10 августа 2026 на PostgreSQL **18.1** и PostGIS **3.6** (`USE_GEOS=1 USE_PROJ=1 USE_STATS=1`).

### 11.1. Что подтвердилось

| Проверка | Результат |
|---|---|
| `btree_gist` принимает `uuid` в `EXCLUDE` | ✅ Ограничение создаётся. Главный риск схемы снят |
| Заявка с пересекающимся периодом отбивается | ✅ `exclusion_violation` |
| Заявка в терминальном статусе не блокирует новую | ✅ Частичный индекс по `WHERE status IN (...)` работает как задумано |
| Триггер неизменяемости аудита | ✅ `UPDATE` и `DELETE` отбиваются с `insufficient_privilege` |
| Расчёт площади через `geography` | ✅ Полигон под Ташкентом даёт 9294,50 га |

Запасной вариант из задачи 0.7 шага 5 — приведение `applicant_id` к `text` или составной хеш — **не понадобился**.

### 11.2. Две находки, которых не было в плане

**Образа `postgis/postgis:18-3.6` под arm64 не существует.** Официальный образ для PostgreSQL 18 собран только под amd64, а машины разработки — Apple Silicon. Используем `imresamu/postgis:18-3.6`: тот же Dockerfile, мультиархитектурная сборка, автор — мейнтейнер официального репозитория. Зафиксировано в `docker-compose.yml`.

**Триггер вешается на родительскую таблицу, а не на каждую партицию.** Проверено отдельно: row-level триггер, объявленный на партиционированной `audit.audit_log`, срабатывает на всех партициях и **автоматически наследуется теми, что созданы позже**. Значит регламентному заданию, которое создаёт очередную месячную секцию, не нужно вешать триггер заново — иначе любая забытая секция стала бы дырой в защите аудита. Учесть в задаче 1.4.

### 11.3. Полная схема написана и собрана

10 августа полный DDL написан по двум источникам — ограничения, индексы и ключевые поля из этого документа, состав остальных сущностей из [`../tz/11-data-model.md`](../tz/11-data-model.md) — и накатан на чистую базу целиком, одной командой `docker compose up`.

| Показатель | Значение |
|---|---|
| Файлов DDL | 17, применяются по порядку имён |
| Таблиц | 62, из них 12 — месячные секции журнала аудита |
| Индексов | 268 |
| Ограничений `CHECK` | 300 |
| Внешних ключей | 122 |
| `EXCLUDE`-ограничений | 8 |
| RLS-политик | 5 |

Ошибок при накатке нет. Восемь инвариантов проверены тестом `db/test/test_constraints.sql`: дубликат заявки отбивается, заявка в терминальном статусе новую не блокирует, журнал аудита не поддаётся `UPDATE`, `DELETE` и `TRUNCATE`, номер разрешения уникален и связан с валидной геометрией, все денежные столбцы `numeric`, у роли `oversight_ro` нет ни одного права на запись.

### 11.4. Три ошибки в этом документе, найденные при сборке

**`approval_doc_id uuid NOT NULL` у нормы и тарифа (раздел 5) — неисполнимо.** Сценарий С18 создаёт черновик нормы до того, как появится документ геоботанического исследования, поэтому с `NOT NULL` черновик невозможно вставить физически. Поле сделано nullable; требование «без документа нет публикации» несёт ограничение `norm_published_requires_approval`, которое дополнительно требует утверждающего и время утверждения.

**Индексы `applicant_by_pinfl` и `applicant_by_tin` (раздел 7) — неуникальные.** Значит база не запрещает завести одного и того же человека заявителем дважды. Перенесены как есть, дословно. Уникальность добавлена только на `iam.user_account`, где она однозначна: один аккаунт на человека. Нужна ли она на `applicant` — вопрос к обсуждению, менять индексы следует сначала здесь.

**Ссылки `geo.occupancy` на `app.application` и `permit.permit` невыполнимы в порядке применения.** `geo` идёт третьим файлом, а таблицы, на которые он ссылается, появляются пятым и седьмым. Колонки объявлены как `uuid` без `REFERENCES`, внешние ключи навешиваются последним файлом `95-constraints.sql`.
