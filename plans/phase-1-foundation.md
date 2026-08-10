# Фаза 1 — Фундамент

> **Для агентов:** используйте `superpowers:subagent-driven-development` или `superpowers:executing-plans`. Шаги отмечены чекбоксами `- [ ]`.

**Цель:** пользователь входит через OneID и E-IMZO, администратор управляет пользователями и ролями, каждое действие попадает в аудит и в очередь событий.

**Архитектура:** три разработчика работают параллельно. Точки соприкосновения — публичные API модулей `iam` и `shared`, они появляются первыми.

**Стек:** Python 3.13, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, PostgreSQL 18, Redis, RabbitMQ.

## Глобальные ограничения

Полный список — [`00-roadmap.md`](00-roadmap.md). Критичные для этой фазы:

- В коде только английский. Проверяется `check_english_only.py`.
- Время — только `timestamptz`. Ruff-правило `DTZ` запрещает наивные даты.
- Каждое действие пишет аудит **в той же транзакции**.
- Модуль работает только со своей схемой БД. Проверяется `import-linter`.
- Наружу из модуля не выходят объекты SQLAlchemy.
- TDD: падающий тест → минимальная реализация → зелёный тест → коммит.
- Тесты на реальном PostgreSQL через testcontainers. SQLite не используется.

## Предусловия

Фаза 0 завершена: окружение поднимается, DDL накатан, инструменты настроены, [`../architecture/modules.md`](../architecture/modules.md) и [`../architecture/contracts.md`](../architecture/contracts.md) написаны.

## Структура файлов

| Файл | Ответственность |
|---|---|
| `core/shared/audit/` | Append-only журнал, запись в транзакции действия |
| `core/shared/outbox/` | Исходящие события, релей в RabbitMQ |
| `core/shared/classifiers/` | Справочники НСИ |
| `core/modules/iam/` | Пользователи, роли, организации, заявители, полномочия |
| `core/api/middleware/` | JWT, RBAC и ABAC, `Correlation-Id`, выбор пула соединений |
| `core/api/errors.py` | Доменные исключения → HTTP-ответ по приложению 8 ТЗ |
| `core/db/session.py` | Два пула: `app_core` и `oversight_ro` |
| `integration/adapters/base.py` | Общий контракт адаптера |
| `integration/adapters/oneid.py` | OIDC |
| `integration/adapters/eimzo.py` | Проверка PKCS7, CRL и OCSP |
| `integration/resilience/` | Retry, backoff, circuit breaker, DLQ |

## Порядок

```
1.3 каркас core ──┬──> 1.4 аудит ──> 1.5 outbox
                  │
1.1 nsi ──────────┼──> 1.2 iam ──┬──> 1.9 вход ──> 1.10 регистрация
                  │              └──> 1.11 RBAC и ABAC ──> 1.12 пулы и RLS
1.6 каркас integration ──┬──> 1.7 OneID              │
                         └──> 1.8 E-IMZO             └──> 1.13 администрирование
                                                          1.14 резервное копирование
1.15 фронтенд ── идёт параллельно, отставая на задачу
```

Задачи **1.3** и **1.6** блокируют всё остальное — делаются первыми.

---

## Задача 1.3 — Каркас `core`

**Кто:** технический лидер
**Файлы:**
- Создать: `core/api/main.py`, `core/api/errors.py`, `core/api/middleware/correlation.py`, `core/db/session.py`, `core/settings.py`
- Тест: `tests/unit/test_errors.py`, `tests/integration/test_health.py`

**Produces:**
- `DomainError` с полями `code: str`, `message_key: str`, `details: dict`
- `get_session() -> AsyncSession` — пул `app_core`
- `GET /health/live`, `/health/ready`, `/health/startup`

- [ ] **Шаг 1: Написать падающий тест на преобразование доменной ошибки**

```python
# tests/unit/test_errors.py
def test_domain_error_maps_to_http_response() -> None:
    error = NormNotPublished(contour_id="018f2c")
    response = to_http_response(error, correlation_id="018f2d")

    assert response.status_code == 422
    assert response.body["error"]["code"] == "ERR-NORM-001"
    assert response.body["error"]["message_key"] == "errors.norm.not_published"
    assert response.body["error"]["correlation_id"] == "018f2d"
```

- [ ] **Шаг 2: Запустить, убедиться что падает**

`pytest tests/unit/test_errors.py -v` → `NameError: NormNotPublished`

- [ ] **Шаг 3: Реализовать иерархию исключений**

```python
# core/api/errors.py
class DomainError(Exception):
    code: str
    message_key: str
    http_status: int = 422

    def __init__(self, **details: object) -> None:
        self.details = details
        super().__init__(self.code)


class NormNotPublished(DomainError):
    code = "ERR-NORM-001"
    message_key = "errors.norm.not_published"
```

Полный перечень кодов — [`../tz/14-errors-classifiers.md`](../tz/14-errors-classifiers.md). Завести классы для всех 25 кодов сразу: они понадобятся во всех модулях, а добавлять по одному дорого.

- [ ] **Шаг 4: Запустить, убедиться что проходит**

- [ ] **Шаг 5: Middleware `Correlation-Id`**

Читает `X-Correlation-Id` из заголовка (его ставит nginx как `$request_id`), при отсутствии генерирует. Кладёт в контекст запроса и в контекст structlog. Возвращает в ответе.

- [ ] **Шаг 6: Тест на три health-эндпоинта**

```python
# tests/integration/test_health.py
async def test_ready_reports_dependency_status(client: AsyncClient) -> None:
    response = await client.get("/health/ready")

    assert response.status_code == 200
    body = response.json()
    assert body["checks"]["database"]["status"] == "ok"
    assert "latency_ms" in body["checks"]["database"]
```

Различие эндпоинтов — [`../architecture/observability.md`](../architecture/observability.md), раздел 5.

- [ ] **Шаг 7: Реализовать, прогнать, закоммитить**

```bash
git add core/api core/db core/settings.py tests/
git commit -m "feat(core): application skeleton with error handling and health checks"
```

---

## Задача 1.6 — Каркас `integration`

**Кто:** Backend 3
**Файлы:**
- Создать: `integration/api/main.py`, `integration/adapters/base.py`, `integration/resilience/retry.py`, `integration/resilience/circuit.py`, `integration/outbox/relay.py`
- Тест: `tests/unit/test_retry.py`, `tests/unit/test_circuit.py`

**Produces:**
- `Adapter` — протокол внешнего адаптера
- `with_retry(fn, attempts=5)` — экспоненциальный backoff 1, 2, 4, 8 минут
- `CircuitBreaker` с состояниями `closed`, `open`, `half_open`

- [ ] **Шаг 1: Тест на экспоненциальный backoff**

```python
# tests/unit/test_retry.py
async def test_retry_uses_exponential_backoff() -> None:
    delays: list[float] = []
    calls = 0

    async def failing() -> None:
        nonlocal calls
        calls += 1
        raise ExternalServiceError("timeout")

    with pytest.raises(ExternalServiceError):
        await with_retry(failing, attempts=4, sleep=delays.append)

    assert calls == 4
    assert delays == [60, 120, 240]
```

- [ ] **Шаг 2: Запустить, убедиться что падает**

- [ ] **Шаг 3: Реализовать `with_retry`**

- [ ] **Шаг 4: Тест на circuit breaker**

```python
# tests/unit/test_circuit.py
async def test_circuit_opens_after_threshold() -> None:
    breaker = CircuitBreaker(threshold=3, reset_after=60)

    for _ in range(3):
        with suppress(ExternalServiceError):
            await breaker.call(always_failing)

    assert breaker.state == "open"
    with pytest.raises(CircuitOpen):
        await breaker.call(always_failing)
```

- [ ] **Шаг 5: Реализовать, прогнать**

- [ ] **Шаг 6: Протокол адаптера**

```python
# integration/adapters/base.py
class Adapter(Protocol):
    """Common contract for every external system adapter."""

    system_code: str
    timeout_seconds: float = 10.0

    async def health(self) -> AdapterHealth:
        """Report whether the external system is reachable."""
```

- [ ] **Шаг 7: Коммит**

```bash
git commit -m "feat(integration): adapter contract, retry and circuit breaker"
```

---

## Задача 1.4 — Аудит

**Кто:** технический лидер
**Consumes:** каркас `core` из 1.3
**Produces:** `audit.write(session, action, object_type, object_id, old, new) -> None`

Самая ответственная задача фазы: на аудите держится вся юридическая значимость системы.

- [ ] **Шаг 1: Тест — запись аудита откатывается вместе с действием**

Требование п. 4.2.4: запись вносится в рамках одной транзакции с действием.

```python
# tests/integration/test_audit.py
async def test_audit_rolls_back_with_the_action(session: AsyncSession) -> None:
    with suppress(RuntimeError):
        async with session.begin():
            await session.execute(insert(Organization).values(name="Test"))
            await audit.write(session, action="organization.created", object_type="organization")
            raise RuntimeError("simulated failure")

    count = await session.scalar(select(func.count()).select_from(AuditLog))
    assert count == 0
```

- [ ] **Шаг 2: Запустить, убедиться что падает**

- [ ] **Шаг 3: Реализовать `audit.write`**

Принимает открытую сессию, не создаёт свою транзакцию. Заполняет `actor_id`, `actor_role`, `territory_code`, `ip`, `device`, `correlation_id` из контекста запроса.

- [ ] **Шаг 4: Тест — аудит нельзя изменить**

```python
async def test_audit_log_rejects_update(session: AsyncSession) -> None:
    entry = await audit.write(session, action="test", object_type="test")
    await session.commit()

    with pytest.raises(InsufficientPrivilege):
        await session.execute(
            text("UPDATE audit.audit_log SET action = 'tampered' WHERE id = :id"),
            {"id": entry.id},
        )
```

- [ ] **Шаг 5: Тест — аудит нельзя удалить**

Аналогично, с `DELETE`.

- [ ] **Шаг 6: Прогнать все три, убедиться что зелено**

Если тесты 4 и 5 проходят без реализации — значит триггер из задачи 0.7 не создался. Это ошибка в DDL.

- [ ] **Шаг 7: Задание создания следующей секции**

Партиционирование по месяцам. Регламентное задание `core-worker` создаёт секцию на следующий месяц заранее. Без него первого числа система перестанет писать аудит.

- [ ] **Шаг 8: Коммит**

```bash
git commit -m "feat(audit): append-only log written inside the action transaction"
```

---

## Задача 1.5 — Outbox

**Кто:** технический лидер
**Consumes:** аудит из 1.4
**Produces:** `outbox.publish(session, routing_key, payload, idempotency_key) -> None`

- [ ] **Шаг 1: Тест — событие пишется в той же транзакции**

```python
async def test_event_is_not_published_when_transaction_fails(session: AsyncSession) -> None:
    with suppress(RuntimeError):
        async with session.begin():
            await outbox.publish(session, "application.submitted", {"id": "018f2c"}, "key-1")
            raise RuntimeError("simulated failure")

    count = await session.scalar(select(func.count()).select_from(OutboxMessage))
    assert count == 0
```

- [ ] **Шаг 2: Тест на идемпотентность**

```python
async def test_duplicate_idempotency_key_is_rejected(session: AsyncSession) -> None:
    await outbox.publish(session, "application.submitted", {}, "key-1")
    await session.commit()

    with pytest.raises(IntegrityError):
        await outbox.publish(session, "application.submitted", {}, "key-1")
        await session.commit()
```

- [ ] **Шаг 3: Реализовать `outbox.publish`**

- [ ] **Шаг 4: Релей**

Читает `PENDING` со сроком `next_attempt_at`, публикует в RabbitMQ, помечает `SENT`. При отказе — увеличивает `attempts` и переносит `next_attempt_at` по экспоненте. После исчерпания — `dlq`.

Ключи маршрутизации — [`../architecture/contracts.md`](../architecture/contracts.md), раздел «События AMQP».

- [ ] **Шаг 5: Тест релея с реальным RabbitMQ**

- [ ] **Шаг 6: Коммит**

```bash
git commit -m "feat(outbox): transactional outbox with relay and DLQ"
```

---

## Задача 1.1 — Схема `nsi`

**Кто:** Backend 1
**Produces:** `classifiers.get(type, code)`, `classifiers.list(type, on_date)`

Четырнадцать справочников из п. 4.1.10 ТЗ. Без них не стартует ни один модуль.

- [ ] **Шаг 1: Тест — значение классификатора не удаляется, если используется**

Требование сценария С23, п. 23.3.

```python
async def test_used_classifier_value_is_archived_not_deleted(session: AsyncSession) -> None:
    value = await classifiers.create(session, type="activity_type", code="GRAZING")
    await link_to_application(session, value)

    await classifiers.delete(session, value.id)

    reloaded = await classifiers.get(session, "activity_type", "GRAZING")
    assert reloaded.status == "ARCHIVED"
```

- [ ] **Шаг 2: Реализовать, прогнать**

- [ ] **Шаг 3: Тест на период действия**

Классификатор версионируется: `effective_from`, `effective_to`. `list(type, on_date)` возвращает действовавшие на дату.

- [ ] **Шаг 4: Заполнить справочники начальными данными**

Виды деятельности, виды скота и возрастные группы, области и районы, коды организаций, типы документов, причины отказа `RJ-01`…`RJ-15`, типы нарушений, ISO-3166-1.

Организации — из выгрузки задачи 0.4, 90 строк.

- [ ] **Шаг 5: Синхронизация с cs.egov.uz**

Через адаптер в `integration`, регламентным заданием.

- [ ] **Шаг 6: Коммит**

---

## Задача 1.2 — Схема `iam`

**Кто:** Backend 1
**Consumes:** `nsi` из 1.1
**Produces:** `iam.get_user(id)`, `iam.get_applicant(pinfl)`, `iam.get_organization(id)`, `iam.has_permission(user, action, object)`

- [ ] **Шаг 1: Тест — пользователь с незавершёнными делами не удаляется**

Требование сценария С23, п. 23.2.

```python
async def test_user_with_open_work_cannot_be_deleted(session: AsyncSession) -> None:
    user = await iam.create_user(session, full_name="Test", role="EXECUTOR")
    await assign_application(session, user)

    with pytest.raises(UserHasOpenWork):
        await iam.delete_user(session, user.id)
```

- [ ] **Шаг 2: Реализовать, прогнать**

- [ ] **Шаг 3: Тест — изменение данных не меняет подписанные документы**

Требование п. 4.2.1.1: при изменении персональных данных данные в уже подписанных документах не меняются. Значит документ хранит снимок, а не ссылку.

- [ ] **Шаг 4: Иерархия организаций**

84 организации с вышестоящими. Тест на отсутствие циклов.

- [ ] **Шаг 5: Полномочия представителя юрлица**

Доверенность, срок, объём. Истечение срока снимает права автоматически.

- [ ] **Шаг 6: Коммит**

---

## Задача 1.11 — RBAC и ABAC

**Кто:** технический лидер
**Consumes:** `iam` из 1.2
**Produces:** middleware `require(action, object_type)`, `apply_scope(query, user)`

Матрица прав — приложение 4 ТЗ, 16 объектов на 10 ролей.

- [ ] **Шаг 1: Тест — сотрудник не видит чужую организацию**

```python
async def test_executor_cannot_read_other_organization(session: AsyncSession) -> None:
    samarkand = await create_user(session, role="EXECUTOR", organization="samarkand")
    fergana_application = await create_application(session, organization="fergana")

    visible = await apply_scope(select(Application), samarkand)
    ids = await session.scalars(visible)

    assert fergana_application.id not in ids
```

- [ ] **Шаг 2: Тест — заявитель видит только свои заявки**

- [ ] **Шаг 3: Тест — прокурор ограничен территорией**

```python
async def test_prosecutor_scope_is_limited_to_territory(session: AsyncSession) -> None:
    prosecutor = await create_user(session, role="PROSECUTOR", territory_code="1027")
    other = await create_application(session, territory_code="0303")

    visible = await apply_scope(select(Application), prosecutor)
    assert other.id not in await session.scalars(visible)
```

- [ ] **Шаг 4: Тест — уровень `REPUBLIC` снимает ограничение**

- [ ] **Шаг 5: Реализовать, прогнать все четыре**

- [ ] **Шаг 6: Таблица прав из матрицы приложения 4**

Данными, не кодом. Администратор видит список нераспределённых функций — требование п. 4.2.1.2.

- [ ] **Шаг 7: Коммит**

```bash
git commit -m "feat(iam): RBAC and ABAC with territory and organisation scoping"
```

---

## Задача 1.12 — Два пула соединений и RLS

**Кто:** технический лидер
**Consumes:** 1.11
**Produces:** `get_readonly_session() -> AsyncSession`

Реализация требования приложения 6 ТЗ без отдельного сервиса.

- [ ] **Шаг 1: Тест — под `oversight_ro` запись падает**

```python
async def test_readonly_pool_rejects_writes(readonly_session: AsyncSession) -> None:
    with pytest.raises(InsufficientPrivilege):
        await readonly_session.execute(
            text("INSERT INTO app.application (id) VALUES (gen_random_uuid())")
        )
```

- [ ] **Шаг 2: Реализовать второй пул**

Отдельный `engine` с учётными данными `oversight_ro`. Middleware выбирает пул по роли: `PROSECUTOR` → только `readonly`.

- [ ] **Шаг 3: Тест — RLS не показывает чужую территорию**

```python
async def test_rls_hides_other_territory(readonly_session: AsyncSession) -> None:
    await readonly_session.execute(text("SET LOCAL app.territory_code = '1027'"))
    rows = await readonly_session.scalars(select(Application))

    assert all(row.territory_code == "1027" for row in rows)
```

- [ ] **Шаг 4: Тест — любой write под ролью прокурора даёт 403**

```python
@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
async def test_prosecutor_write_returns_forbidden(client: AsyncClient, method: str) -> None:
    response = await client.request(method, "/api/v1/applications", headers=prosecutor_token())

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ERR-ACL-003"
```

- [ ] **Шаг 5: Прогнать все, убедиться что зелено**

- [ ] **Шаг 6: Коммит**

```bash
git commit -m "feat(core): read-only connection pool and row level security for prosecutor role"
```

---

## Задача 1.7 — Адаптер OneID

**Кто:** Backend 3
**Consumes:** каркас `integration` из 1.6
**Produces:** `POST /internal/v1/oneid/exchange` по [`../architecture/contracts.md`](../architecture/contracts.md)

- [ ] **Шаг 1: Тест на обмен кода на профиль с заглушкой**
- [ ] **Шаг 2: Тест — недоступность возвращает `ERR-INT-001`**
- [ ] **Шаг 3: Реализовать OIDC-поток**
- [ ] **Шаг 4: Проверить на тестовом контуре**

Зависит от вопроса **О3** — есть ли sandbox. Если нет, работаем на заглушке до получения доступа.

- [ ] **Шаг 5: Коммит**

---

## Задача 1.8 — Адаптер E-IMZO

**Кто:** Backend 3
**Produces:** `POST /internal/v1/eimzo/verify`

- [ ] **Шаг 1: Тест — валидная подпись возвращает `valid: true` и данные сертификата**
- [ ] **Шаг 2: Тест — просроченный сертификат даёт `ERR-AUTH-004`**
- [ ] **Шаг 3: Тест — отозванный в CRL даёт `ERR-AUTH-004`**
- [ ] **Шаг 4: Тест — hash не совпадает с `expected_hash` → `ERR-SIGN-001`**
- [ ] **Шаг 5: Реализовать проверку PKCS7 по O'z DSt 1092:2009**
- [ ] **Шаг 6: Реализовать проверку CRL и OCSP**

Сервис **не хранит** результат — это stateless-проверка. Хранение `signature` в `core`.

- [ ] **Шаг 7: Коммит**

---

## Задача 1.9 — Аутентификация

**Кто:** Backend 1
**Consumes:** 1.2, 1.7, 1.8, 1.11
**Produces:** `POST /api/v1/auth/oneid`, `/auth/eimzo`, `/auth/password`, `/auth/refresh`

Сценарий **С1**.

- [ ] **Шаг 1: Тест — вход через OneID выдаёт JWT с ролью и территорией**
- [ ] **Шаг 2: Тест — пять неудачных попыток блокируют учётную запись**

```python
async def test_account_locks_after_five_failed_attempts(client: AsyncClient) -> None:
    for _ in range(5):
        await client.post("/api/v1/auth/password", json=wrong_credentials())

    response = await client.post("/api/v1/auth/password", json=correct_credentials())

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "ERR-AUTH-003"
```

- [ ] **Шаг 3: Тест — внутренний сотрудник без MFA не входит**
- [ ] **Шаг 4: Тест — заявителю пароль не выдаётся**
- [ ] **Шаг 5: Тест — срок сессии прокурора 30 минут**
- [ ] **Шаг 6: Реализовать, прогнать**
- [ ] **Шаг 7: Сессии в Redis, инвалидация при снятии роли**
- [ ] **Шаг 8: Коммит**

---

## Задача 1.10 — Регистрация

**Кто:** Backend 1
**Consumes:** 1.9
**Produces:** `POST /api/v1/auth/register`, `/auth/verify-otp`

Сценарий **С2**.

- [ ] **Шаг 1: Тест — автозаполнение из реестра по ЖШШИР**
- [ ] **Шаг 2: Тест — реестр недоступен, данные вводятся вручную**

Требование п. 2.4 сценария С2: сверка ставится в очередь.

- [ ] **Шаг 3: Тест — повторная регистрация по тому же ЖШШИР перенаправляет на вход**
- [ ] **Шаг 4: Тест — OTP с TTL и ограничением частоты**
- [ ] **Шаг 5: Реализовать, прогнать**
- [ ] **Шаг 6: Коммит**

---

## Задача 1.13 — Администрирование

**Кто:** Backend 1
**Consumes:** 1.2, 1.11
Сценарий **С23**.

- [ ] **Шаг 1: Тест — роль с активными пользователями не удаляется**
- [ ] **Шаг 2: Тест — роли с одинаковым набором функций выявляются**
- [ ] **Шаг 3: Тест — список нераспределённых функций непуст, если функция не покрыта**
- [ ] **Шаг 4: Тест — все действия администратора попадают в аудит**

Требование п. 23.10: системный администратор не может скрыть свои действия.

- [ ] **Шаг 5: Реализовать CRUD пользователей, ролей, организаций, классификаторов**
- [ ] **Шаг 6: Ежемесячный пересмотр прав регламентным заданием**
- [ ] **Шаг 7: Коммит**

---

## Задача 1.14 — Резервное копирование

**Кто:** технический лидер
Сценарий **С24**.

- [ ] **Шаг 1: Тест — перед восстановлением создаётся копия текущего состояния**

Требование п. 24.5.

- [ ] **Шаг 2: Тест — попытка изменить журнал даёт `RI-06`**
- [ ] **Шаг 3: Реализовать расписание, ручное создание, восстановление**
- [ ] **Шаг 4: Реализовать просмотр журналов с фильтрами**
- [ ] **Шаг 5: Оповещение при неуспешном копировании**
- [ ] **Шаг 6: Коммит**

---

## Задача 1.15 — Фронтенд

**Кто:** Frontend
**Consumes:** 1.9, 1.10, 1.13

Экраны — [`../design/screens.md`](../design/screens.md).

- [ ] **Шаг 1: Токены дизайн-системы в проект**
- [ ] **Шаг 2: Базовые компоненты: кнопка, поле, таблица, модальное окно, тост**

Все состояния, включая загрузку и фокус. Требование: повторное нажатие не отправляет форму дважды.

- [ ] **Шаг 3: Вход — три способа**
- [ ] **Шаг 4: Регистрация с OTP**
- [ ] **Шаг 5: Каркас личного кабинета: меню, breadcrumb, уведомления, профиль**
- [ ] **Шаг 6: Экраны администрирования**
- [ ] **Шаг 7: Генерация типизированного клиента из OpenAPI**
- [ ] **Шаг 8: Проверка доступности: клавиатура, фокус, контраст, screen reader**
- [ ] **Шаг 9: Коммит**

---

## Готово, когда

- [ ] Пользователь входит через OneID
- [ ] Пользователь входит через E-IMZO
- [ ] Внутренний сотрудник входит по паролю с MFA, без MFA не входит
- [ ] Пять неудачных попыток блокируют учётную запись
- [ ] Заявитель регистрируется с автозаполнением из реестра
- [ ] Администратор заводит пользователей, роли, организации, классификаторы
- [ ] Сотрудник не видит данные чужой организации
- [ ] Прокурор не видит данные чужой территории
- [ ] Любая операция записи под ролью прокурора возвращает `403`
- [ ] Под пользователем `oversight_ro` любой `INSERT` падает с отказом прав
- [ ] Каждое действие пишет аудит в той же транзакции
- [ ] Аудит нельзя изменить и удалить
- [ ] Событие попадает в outbox и доставляется в RabbitMQ
- [ ] При отказе внешнего сервиса срабатывают retry и circuit breaker
- [ ] Все девять шагов CI зелёные

## Следующая фаза

[`phase-2-gis-and-rules.md`](phase-2-gis-and-rules.md). Фаза зависит от блокеров **Б1**, **Б2**, **Н1–Н3** и **О8**. Если к её началу ответов нет — начинать с задач 2.1, 2.2 и 2.3, которые дают редактор и импорт контуров и не требуют готовых данных.
