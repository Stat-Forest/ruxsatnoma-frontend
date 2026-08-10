# Фаза 3 — Заявка и разрешение

> **Для агентов:** используйте `superpowers:subagent-driven-development` или `superpowers:executing-plans`. Шаги отмечены чекбоксами `- [ ]`.

**Цель:** заявитель подаёт заявку через портал и через my.gov.uz, сотрудник рассматривает, руководитель утверждает, система выдаёт подписанное разрешение с QR-кодом.

**Архитектура:** ядро системы. Модуль `application` вызывает `geo`, `rules`, `payment` и `permit`; обратных вызовов нет. Здесь же реализуется единственное задокументированное нарушение шва — проверка занятости и создание заявки в одной транзакции.

## Предусловия

Фазы 1 и 2 завершены. Работают IAM, аудит, outbox, GIS, расчёт лимита.

## ⚠️ Открытые вопросы

| Вопрос | Что затрагивает |
|---|---|
| **П1, П2, П5** | Модуль договора. Если ответ подтвердит, что 10.4 — это договор, добавляется задача 3.17 |
| **П7** | Порядок и обязательность четырёх подписей на разрешении — задача 3.10 |
| **П6** | Формы разрешений для 4 видов деятельности из 6 — задача 3.9 |

**П3 и О5 закрыты 10 августа.** Определение статуса `CONTRACT_DRAFT` даёт Исполнитель при реализации модуля договора — статус-машина строится таблицей переходов, поэтому это изменение данных, а не кода. Состав первой очереди — выпас и сенокошение; механика делается сразу под все шесть видов.

## Структура файлов

| Файл | Ответственность |
|---|---|
| `core/modules/application/models.py` | `Application`, `ApplicationStatusHistory`, `ApplicationDocument`, `Calculation` |
| `core/modules/application/state_machine.py` | 14 статусов и переходы |
| `core/modules/application/service.py` | Подача, приём, рассмотрение, решение |
| `core/modules/application/sla.py` | Таймер, остановка, возобновление |
| `core/modules/application/assignment.py` | Автоназначение по территории |
| `core/modules/permit/models.py` | `Permit`, `PermitTemplate`, `ForestTicket` |
| `core/modules/permit/document.py` | Генерация PDF/A, QR-код |
| `core/modules/permit/numbering.py` | Серия и номер через `SEQUENCE` |
| `core/modules/signature/service.py` | Хранение подписей |
| `core/modules/search/` | Атрибутивный, полнотекстовый и пространственный поиск |
| `integration/adapters/mygov.py` | BFF |

## Порядок

```
3.1 схема app ── 3.2 статус-машина ── 3.3 constraint дубликатов
                                            │
                    ┌───────────────────────┴──────────┐
                    ▼                                  ▼
              3.4 подача ── 3.5 приём ── 3.6 рассмотрение ── 3.7 решение
                    │                                            │
                    │                                            ▼
3.8 схема permit ── 3.9 формирование ── 3.10 подписание ── 3.11 публичная проверка
                                                     └──── 3.12 приостановка

3.13 уведомления, 3.14 BFF my.gov.uz, 3.15 поиск — параллельно
3.16 фронтенд — отстаёт на задачу
```

---

## Задача 3.1 — Схема `app`

**Кто:** Backend 1
**Produces:** `application.get(id)`, `application.list(filters, scope)`

- [ ] **Шаг 1: Тест — заявка требует территории**

`territory_code` денормализован для ABAC и RLS — [`../architecture/database.md`](../architecture/database.md), раздел 3.

- [ ] **Шаг 2: Тест — расчёт хранится с `rule_version` и `input_snapshot`**

```python
async def test_calculation_stores_reproducible_snapshot(session: AsyncSession) -> None:
    application = await create_application(session)

    calculation = await application.get_calculation(session, application.id)

    assert calculation.rule_version
    assert calculation.input_snapshot["livestock"]
    assert calculation.input_snapshot["norm_id"]
```

- [ ] **Шаг 3: Реализовать модели**
- [ ] **Шаг 4: Индексы под рабочие списки**

Из [`../architecture/database.md`](../architecture/database.md), раздел 7.

- [ ] **Шаг 5: Коммит**

---

## Задача 3.2 — Статус-машина

**Кто:** Backend 1
**Consumes:** 3.1
**Produces:** `application.transition(id, action, actor, **payload)`

14 статусов, приложение 5 ТЗ. Разбор — [`../tz/09-state-machines.md`](../tz/09-state-machines.md).

- [ ] **Шаг 1: Тест — допустимый переход проходит**

```python
async def test_submitted_moves_to_in_review(session: AsyncSession) -> None:
    application = await create_application(session, status="SUBMITTED")

    await application.transition(session, application.id, "accept", actor=executor)

    assert (await reload(application)).status == "IN_REVIEW"
```

- [ ] **Шаг 2: Тест — недопустимый переход отклоняется**

Важнее первого. Проверить **каждый** запрещённый переход, не выборочно:

```python
@pytest.mark.parametrize(
    "from_status,action",
    [(s, a) for s in ALL_STATUSES for a in ALL_ACTIONS if (s, a) not in ALLOWED],
)
async def test_forbidden_transitions_are_rejected(
    session: AsyncSession, from_status: str, action: str
) -> None:
    application = await create_application(session, status=from_status)

    with pytest.raises(InvalidTransition):
        await application.transition(session, application.id, action, actor=admin)
```

- [ ] **Шаг 3: Тест — роль проверяется на переходе**

Утвердить может только руководитель, вернуть — сотрудник. Матрица из приложения 5.

- [ ] **Шаг 4: Тест — отказ требует кода и правового основания**

```python
async def test_rejection_requires_reason_and_legal_basis(session: AsyncSession) -> None:
    application = await create_application(session, status="IN_REVIEW")

    with pytest.raises(ReasonRequired):
        await application.transition(session, application.id, "reject", actor=head)
```

Требование п. 8.4 сценария С8.

- [ ] **Шаг 5: Тест — каждый переход пишет аудит и событие**

```python
async def test_every_transition_writes_audit_and_event(session: AsyncSession) -> None:
    application = await create_application(session, status="SUBMITTED")

    await application.transition(session, application.id, "accept", actor=executor)

    assert await count_audit_entries(session, application.id) == 1
    assert await count_outbox_messages(session, "application.accepted") == 1
```

- [ ] **Шаг 6: Реализовать статус-машину**

Таблицей переходов, а не цепочкой `if`. Тогда добавление `CONTRACT_DRAFT` по ответу на **П3** — строка данных.

- [ ] **Шаг 7: Коммит**

```bash
git commit -m "feat(application): state machine with role checks and audit on every transition"
```

---

## Задача 3.3 — Блокировка дубликатов

**Кто:** Backend 1
**Consumes:** 3.1

KPI ТЗ — ноль дубликатов. Constraint создан в фазе 0, здесь обрабатывается его нарушение.

- [ ] **Шаг 1: Тест — пересекающийся период отклоняется с номером существующей заявки**

```python
async def test_duplicate_returns_conflict_with_existing_number(client: AsyncClient) -> None:
    first = await submit_application(client, contour=C, period=("2026-05-01", "2026-09-01"))

    response = await submit_application(
        client, contour=C, period=("2026-07-01", "2026-10-01")
    )

    assert response.status_code == 409
    body = response.json()
    assert body["error"]["code"] == "ERR-APP-002"
    assert body["error"]["details"]["existing_application_number"] == first.number
```

Требование п. 3.4 сценария С3: возвращается **409 и номер существующей заявки**, не просто ошибка.

- [ ] **Шаг 2: Тест — другой заявитель на тот же контур проходит**

Constraint включает `applicant_id`. Занятость площади — отдельная проверка через `geo`.

- [ ] **Шаг 3: Тест — заявка в статусе `REJECTED` не блокирует новую**

Constraint частичный, только по активным статусам.

- [ ] **Шаг 4: Реализовать перехват `ExclusionViolation` и преобразование в `409`**
- [ ] **Шаг 5: Коммит**

---

## Задача 3.4 — Подача заявки

**Кто:** Backend 1
**Consumes:** 2.11, 3.2, 3.3
**Produces:** `POST /api/v1/applications/check`, `POST /api/v1/applications`

Сценарий **С3**, самый нагруженный путь системы.

- [ ] **Шаг 1: Тест — проверка возвращает полную расшифровку**

```python
async def test_check_returns_full_calculation_breakdown(client: AsyncClient) -> None:
    response = await client.post("/api/v1/applications/check", json=valid_request())

    data = response.json()["data"]
    for field in (
        "available_area_ha", "max_sb", "active_permits_sb",
        "remaining_sb", "used_sb", "amount", "rule_version",
    ):
        assert field in data
```

Расшифровка нужна экрану «Проверка итога» из мастера — [`../design/screens.md`](../design/screens.md).

- [ ] **Шаг 2: Тест — проверка ничего не создаёт**

- [ ] **Шаг 3: Тест — подача выполняется атомарно**

Единственное место, где сознательно трогаются два агрегата.

```python
async def test_submission_is_atomic(session: AsyncSession) -> None:
    with patch("core.modules.permit.reserve", side_effect=RuntimeError):
        with suppress(RuntimeError):
            await application.submit(session, valid_payload())

    assert await count_applications(session) == 0
    assert await count_occupancies(session) == 0
    assert await count_audit_entries(session) == 0
```

- [ ] **Шаг 4: Тест — черновик сохраняется без валидации**

Требование п. 3.5: незавершённая заявка сохраняется как `DRAFT` с autosave.

- [ ] **Шаг 5: Тест — подпись ЭЦП обязательна для отправки**

- [ ] **Шаг 6: Тест — пожарный запрет блокирует подачу**

`RJ-09`, требование модуля 10.14. Порождает `RI-13`, если разрешение всё же выдано.

- [ ] **Шаг 7: Реализовать подачу**

Порядок внутри транзакции: advisory lock → GIS-проверка → расчёт лимита → расчёт суммы → `INSERT application` → `INSERT calculation` → `INSERT signature` → резервирование занятости → аудит → outbox.

- [ ] **Шаг 8: Тест на время: полный путь ≤ 3 секунд**

- [ ] **Шаг 9: Коммит**

```bash
git commit -m "feat(application): submission with atomic GIS check, limit calculation and reservation"
```

---

## Задача 3.5 — Приём и назначение

**Кто:** Backend 1
**Consumes:** 3.2
Сценарий **С4**.

- [ ] **Шаг 1: Тест — заявка назначается по территории и виду деятельности**
- [ ] **Шаг 2: Тест — занятый сотрудник заменяется заместителем**

Требование п. 4.1.

- [ ] **Шаг 3: Тест — SLA-таймер запускается на 15 дней**
- [ ] **Шаг 4: Тест — нарушение SLA порождает `RI-07`**

```python
async def test_sla_violation_raises_indicator(session: AsyncSession) -> None:
    application = await create_application(session, sla_deadline=yesterday())

    await sla.check_deadlines(session)

    assert await risk_indicator_exists(session, "RI-07", application.id)
```

- [ ] **Шаг 5: Тест — неполные документы возвращают заявку с `RJ-01` и списком полей**
- [ ] **Шаг 6: Реализовать, прогнать**
- [ ] **Шаг 7: Регламентное задание проверки сроков в `core-worker`**
- [ ] **Шаг 8: Коммит**

---

## Задача 3.6 — Рассмотрение

**Кто:** Backend 1
**Consumes:** 2.12, 3.5
Сценарий **С5**.

- [ ] **Шаг 1: Тест — запрос дополнительной информации останавливает SLA**

```python
async def test_pending_info_pauses_sla_timer(session: AsyncSession) -> None:
    application = await create_application(session, status="IN_REVIEW")
    before = application.sla_deadline

    await application.transition(session, application.id, "request_info", actor=executor)
    await advance_clock(days=3)
    await application.transition(session, application.id, "info_received", actor=applicant)

    assert (await reload(application)).sla_deadline == before + timedelta(days=3)
```

Требование п. 5.3 сценария С5.

- [ ] **Шаг 2: Тест — недоступность внешнего сервиса включает maker-checker**

Требование п. 5, шаг 4: загружается бумажный документ, применяется двойное подтверждение, ситуация пишется в аудит.

- [ ] **Шаг 3: Тест — отрицательный ответ Ветеринарии готовит отказ `RJ-10`**
- [ ] **Шаг 4: Тест — расхождение с Кадастром формирует задание GIS-специалисту**
- [ ] **Шаг 5: Реализовать, прогнать**
- [ ] **Шаг 6: Коммит**

---

## Задача 3.7 — Решение руководителя

**Кто:** Backend 1
**Consumes:** 3.6
Сценарий **С8**.

- [ ] **Шаг 1: Тест — утверждение сверх лимита блокируется**

```python
async def test_approval_over_limit_is_blocked(session: AsyncSession) -> None:
    application = await create_application(session, used_sb=100, remaining_sb=20)

    with pytest.raises(LimitExceeded):
        await application.transition(session, application.id, "approve", actor=head)
```

- [ ] **Шаг 2: Тест — утверждение в порядке исключения порождает `RI-02`**

Требование п. 8.2.

- [ ] **Шаг 3: Тест — превышение полномочий направляет выше**

Требование п. 8.1: при превышении предела по сумме или площади заявка идёт вышестоящему.

- [ ] **Шаг 4: Тест — решение подписывается ЭЦП**
- [ ] **Шаг 5: Тест — делегирование заместителю фиксируется со сроком и объёмом**
- [ ] **Шаг 6: Реализовать, прогнать**
- [ ] **Шаг 7: Коммит**

---

## Задача 3.8 — Схема `permit`

**Кто:** технический лидер
**Produces:** `permit.get(id)`, `permit.find_by_number(series, number)`

- [ ] **Шаг 1: Тест — серия и номер уникальны**
- [ ] **Шаг 2: Тест — активное разрешение требует геометрии и контура**

KPI: 100 % активных разрешений связаны с GIS.

- [ ] **Шаг 3: Реализовать модели и шаблоны документов с версионированием**
- [ ] **Шаг 4: Коммит**

---

## Задача 3.9 — Формирование разрешения

**Кто:** технический лидер
**Consumes:** 3.7, 3.8
Сценарий **С11**.

⚠️ Формы для 4 видов деятельности из 6 отсутствуют — вопрос **П6**. Реализуем выпас и сенокос, шаблон делаем конфигурируемым.

- [ ] **Шаг 1: Тест — номер генерируется через `SEQUENCE`, не через `MAX+1`**

```python
async def test_permit_numbers_are_unique_under_concurrency(session_factory) -> None:
    results = await asyncio.gather(*[issue_permit() for _ in range(20)])
    numbers = [r.number for r in results]

    assert len(set(numbers)) == 20
```

- [ ] **Шаг 2: Тест — без подтверждённой оплаты разрешение не формируется**

```python
async def test_permit_requires_confirmed_payment(session: AsyncSession) -> None:
    application = await create_application(session, status="APPROVED", paid=False)

    with pytest.raises(PaymentNotConfirmed):
        await permit.issue(session, application.id)

    assert await risk_indicator_exists(session, "RI-10", application.id)
```

Требование п. 11.1 сценария С11.

- [ ] **Шаг 3: Тест — документ формируется в PDF/A**
- [ ] **Шаг 4: Тест — QR ведёт на публичную страницу проверки**
- [ ] **Шаг 5: Тест — используется версия шаблона на момент утверждения**

Требование п. 11.3.

- [ ] **Шаг 6: Тест — снимок неизменяем после подписания**
- [ ] **Шаг 7: Реализовать генерацию по форме приложения 1**
- [ ] **Шаг 8: Тест на время: ≤ 60 секунд от подтверждения**
- [ ] **Шаг 9: Коммит**

---

## Задача 3.10 — Подписание ЭЦП

**Кто:** технический лидер
**Consumes:** 1.8, 3.9

⚠️ Порядок и обязательность четырёх подписей не определены — вопрос **П7**. Реализуем как настраиваемый список подписантов.

- [ ] **Шаг 1: Тест — отозванный сертификат отклоняется и порождает `RI-05`**
- [ ] **Шаг 2: Тест — просроченный сертификат даёт `ERR-AUTH-004`**
- [ ] **Шаг 3: Тест — подпись хранится с timestamp и hash**
- [ ] **Шаг 4: Тест — hash документа совпадает с подписанным**
- [ ] **Шаг 5: Реализовать через адаптер из 1.8**
- [ ] **Шаг 6: Коммит**

---

## Задача 3.11 — Публичная проверка по QR

**Кто:** технический лидер
**Consumes:** 3.9
Сценарий **С12**.

- [ ] **Шаг 1: Тест — персональные данные маскированы**

```python
async def test_public_check_masks_personal_data(client: AsyncClient) -> None:
    response = await client.get("/public/v1/permits/verify?series=A&number=000042")

    data = response.json()["data"]
    assert data["holder_masked"] == "М. У. Т."
    assert "pinfl" not in data
    assert "passport" not in data
```

- [ ] **Шаг 2: Тест — несуществующее разрешение даёт понятный ответ**
- [ ] **Шаг 3: Тест — аннулированное показывает статус и дату**
- [ ] **Шаг 4: Тест — rate limit срабатывает**
- [ ] **Шаг 5: Тест на время: ≤ 3 секунд**
- [ ] **Шаг 6: Реализовать, прогнать**
- [ ] **Шаг 7: Коммит**

---

## Задача 3.12 — Приостановка и аннулирование

**Кто:** Backend 1
Сценарий **С13**.

- [ ] **Шаг 1: Тест — без правового основания операция блокируется**

Требование п. 13.3.

- [ ] **Шаг 2: Тест — аннулирование освобождает занятость и пересчитывает лимит**

```python
async def test_revocation_releases_occupancy(session: AsyncSession) -> None:
    permit_record = await issue_permit(session, area_ha=Decimal("50.0000"))
    before = await geo.get_available_area(session, permit_record.contour_id, period=P)

    await permit.revoke(session, permit_record.id, reason="RJ-14", legal_basis="court order")

    after = await geo.get_available_area(session, permit_record.contour_id, period=P)
    assert after.available_ha == before.available_ha + Decimal("50.0000")
```

Требование п. 13.5.

- [ ] **Шаг 3: Тест — снятие приостановки возвращает в `ACTIVE` с сохранением истории**
- [ ] **Шаг 4: Тест — истёкшие помечаются регламентным заданием**
- [ ] **Шаг 5: Реализовать, прогнать**
- [ ] **Шаг 6: Коммит**

---

## Задача 3.13 — Уведомления

**Кто:** Backend 3
Сценарий **С19**.

- [ ] **Шаг 1: Тест — юридически значимое уведомление доходит через in-app при отключённом канале**

Требование п. 19.3.

- [ ] **Шаг 2: Тест — при отказе SMS используется резервный канал**
- [ ] **Шаг 3: Тест — состояние доставки отслеживается**
- [ ] **Шаг 4: Реализовать шаблоны с многоязычным текстом**
- [ ] **Шаг 5: Коммит**

---

## Задача 3.14 — BFF my.gov.uz

**Кто:** Backend 3
Сценарий **С25**.

⚠️ Зависит от **Б5** — соглашения о взаимодействии.

- [ ] **Шаг 1: Тест — одинаковый вход даёт одинаковый результат в обоих каналах**

Требование AC-01 ТЗ, ключевое для этой задачи.

```python
async def test_both_channels_produce_identical_result(client: AsyncClient) -> None:
    portal = await submit_via_portal(client, payload)
    mygov = await submit_via_bff(client, same_payload_different_applicant)

    assert portal.amount == mygov.amount
    assert portal.calculation.rule_version == mygov.calculation.rule_version
```

- [ ] **Шаг 2: Тест — повторный запрос по `Idempotency-Key` не создаёт вторую заявку**
- [ ] **Шаг 3: Тест — недоставленный webhook попадает в DLQ**
- [ ] **Шаг 4: Реализовать, прогнать**
- [ ] **Шаг 5: Коммит**

---

## Задача 3.15 — Подсистема поиска

**Кто:** Backend 2
Подсистема 3 ТЗ, п. 4.2.3.

- [ ] **Шаг 1: Тест — поиск ограничен ролью и территорией**
- [ ] **Шаг 2: Тест — атрибутивный поиск по 12 полям**
- [ ] **Шаг 3: Тест — пространственный поиск по области на карте**
- [ ] **Шаг 4: Тест — сохранённый профиль фильтров применяется**
- [ ] **Шаг 5: Тест на время: ≤ 3 секунд**
- [ ] **Шаг 6: Реализовать через `pg_trgm`**

⚠️ Полнотекстовый поиск **с учётом морфологии** узбекского языка требует словарей, которых для PostgreSQL не существует. На старте — `pg_trgm`, что даёт частичные совпадения и устойчивость к опечаткам, но не морфологию. Ограничение согласовать с Заказчиком.

- [ ] **Шаг 7: Экспорт результатов в Excel, PDF, CSV**
- [ ] **Шаг 8: Коммит**

---

## Задача 3.16 — Фронтенд

**Кто:** Frontend
**Consumes:** 3.4–3.12

- [ ] **Шаг 1: Мастер подачи заявки, шесть шагов**

С autosave, возвратом назад, предупреждением о несохранённых данных.

- [ ] **Шаг 2: Экран «Проверка итога» с расшифровкой расчёта**
- [ ] **Шаг 3: Состояние конфликта на карте с объяснением**
- [ ] **Шаг 4: Кабинет заявителя: заявки, разрешения, платежи**
- [ ] **Шаг 5: Рабочий стол сотрудника с SLA-индикаторами**
- [ ] **Шаг 6: Экран решения руководителя с полным timeline**
- [ ] **Шаг 7: Публичная страница проверки по QR**
- [ ] **Шаг 8: Все экраны отказов по формату из п. 4.1.7**
- [ ] **Шаг 9: Коммит**

---

## Задача 3.17 — Договор ⚠️ условная

Выполняется **только при положительном ответе на П1**: подтверждении, что модуль 10.4 — это договор.

- [ ] Схема `app.contract`, атрибуты по ответу Заказчика
- [ ] Статус `CONTRACT_DRAFT` в статус-машину
- [ ] Формирование договора по форме Заказчика
- [ ] Подписание ЭЦП
- [ ] Связь `permit → contract` из приложения 7 ТЗ

Место под сущность уже заложено в схеме БД — [`../architecture/database.md`](../architecture/database.md), раздел 2.

---

## Готово, когда

- [ ] Заявитель подаёт заявку через портал и получает номер
- [ ] Заявитель подаёт заявку через my.gov.uz, результат идентичен
- [ ] Дубликат отклоняется с `409` и номером существующей заявки
- [ ] Проверка возвращает полную расшифровку расчёта
- [ ] Подача атомарна: при сбое не остаётся ни заявки, ни занятости, ни записи аудита
- [ ] Заявка автоматически назначается по территории, SLA-таймер идёт
- [ ] Запрос информации останавливает таймер, ответ возобновляет
- [ ] Нарушение SLA порождает `RI-07`
- [ ] Отказ невозможен без кода `RJ-*` и правового основания
- [ ] Утверждение сверх лимита блокируется, исключение порождает `RI-02`
- [ ] Разрешение не формируется без подтверждённой оплаты, попытка даёт `RI-10`
- [ ] Номер разрешения уникален при параллельной выдаче
- [ ] Разрешение подписывается ЭЦП, отозванный сертификат отклоняется с `RI-05`
- [ ] Публичная проверка по QR работает за 3 секунды с маскированием данных
- [ ] Аннулирование освобождает занятость и пересчитывает лимит
- [ ] Каждый переход статуса пишет аудит и событие
- [ ] Все девять шагов CI зелёные

## Следующая фаза

[`phase-4-payments.md`](phase-4-payments.md)
