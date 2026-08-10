# Фаза 4 — Платежи

> **Для агентов:** используйте `superpowers:subagent-driven-development` или `superpowers:executing-plans`.

**Цель:** заявитель платит любым из четырёх провайдеров, деньги распределяются 50 на 50, бухгалтер видит сверку с банковской выпиской.

**Архитектура:** платёжный домен — модуль `payment` в `core`. Адаптеры провайдеров — в `integration` за общим интерфейсом. Обоснование разделения — [`../architecture/contracts.md`](../architecture/contracts.md).

## Предусловия

Фаза 3 завершена: заявка доходит до статуса `APPROVED`.

## ⚠️ Блокеры

| Вопрос | Что без него |
|---|---|
| **О10** — сбор за рассмотрение отменяется или сохраняется | Второй тип инвойса и статус перед `SUBMITTED` |
| **Н5** — реквизиты счетов для распределения | Задача 4.7. Частично закрыто выгрузкой 0.4 |
| **Н4** — льготные категории | Задача 4.10 |

Payme и Paynet работают в действующей системе — образцы интеграции в `../ruxsatnoma-old/apps/payment/`.

## Главный инвариант фазы

> Статус `PAID` ставит **только** обработчик подписанного webhook. KPI ТЗ — ноль ручных отметок.

Всё в этой фазе подчинено ему. Тест на инвариант пишется первым, до любой реализации.

## Структура файлов

| Файл | Ответственность |
|---|---|
| `core/modules/payment/models.py` | `Invoice`, `PaymentIntent`, `ProviderTransaction`, `BankStatement`, `Reconciliation`, `Allocation`, `Refund` |
| `core/modules/payment/service.py` | Инвойс, подтверждение, распределение |
| `core/modules/payment/reconciliation.py` | Сверка с выпиской |
| `core/modules/payment/refund.py` | Возврат, льготы |
| `integration/adapters/payment/base.py` | `PaymentAdapter` |
| `integration/adapters/payment/payme.py`, `click.py`, `uzum.py`, `paynet.py` | Провайдеры |

---

## Задача 4.1 — Схема `pay`

**Кто:** Backend 3

- [ ] **Шаг 1: Тест — инвариант `PAID`**

Первый тест фазы, до любой реализации.

```python
async def test_paid_status_requires_provider_confirmation(session: AsyncSession) -> None:
    invoice = await create_invoice(session)

    with pytest.raises(DomainError) as error:
        await payment.mark_paid(session, invoice.id, source="manual")

    assert error.value.code == "ERR-PAY-001"
```

- [ ] **Шаг 2: Тест — деньги хранятся в `numeric(18,2)`**

```python
async def test_money_precision_is_preserved(session: AsyncSession) -> None:
    invoice = await create_invoice(session, amount=Money(Decimal("1250000.99")))

    assert (await reload(invoice)).amount == Money(Decimal("1250000.99"))
```

Старая система теряла копейки на `int()` — см. [`../tz/20-legacy-code-audit.md`](../tz/20-legacy-code-audit.md), п. 6.4.

- [ ] **Шаг 3: Реализовать модели**

Семь сущностей из приложения 7 ТЗ.

- [ ] **Шаг 4: Индексы под сверку**
- [ ] **Шаг 5: Коммит**

---

## Задача 4.2 — Интерфейс платёжного адаптера

**Кто:** Backend 3
**Produces:** `PaymentAdapter` из [`../architecture/contracts.md`](../architecture/contracts.md)

- [ ] **Шаг 1: Тест — адаптер с неверной подписью не обрабатывается**

```python
async def test_invalid_signature_is_rejected(adapter: PaymentAdapter) -> None:
    assert not adapter.verify_signature(tampered_headers(), body)
```

- [ ] **Шаг 2: Тест — все реализации взаимозаменяемы**

```python
@pytest.mark.parametrize("adapter", [PaymeAdapter(), ClickAdapter(), UzumAdapter(), PaynetAdapter()])
def test_adapters_satisfy_protocol(adapter: PaymentAdapter) -> None:
    assert isinstance(adapter, PaymentAdapter)
    assert adapter.provider_code in {"PAYME", "CLICK", "UZUM", "PAYNET"}
```

Принцип подстановки: `core` не знает, какой провайдер обслуживает платёж.

- [ ] **Шаг 3: Реализовать протокол и базовый класс**
- [ ] **Шаг 4: Конфигурация провайдера со ссылкой на секрет, не значением**
- [ ] **Шаг 5: Коммит**

---

## Задача 4.3 — Адаптеры провайдеров

**Кто:** Backend 3
**Consumes:** 4.2

Форматы берутся из технических инструкций по платёжным системам, имеющихся у Исполнителя (**Б4** закрыт 10 августа). Payme и Paynet — образцы в старом коде.

- [ ] **Шаг 1: Payme — тест на разбор webhook, реализация**
- [ ] **Шаг 2: Click — то же**
- [ ] **Шаг 3: Uzum — то же**
- [ ] **Шаг 4: Paynet — то же**
- [ ] **Шаг 5: Тест — добавление пятого провайдера не трогает `core`**

```python
def test_new_provider_requires_no_core_changes() -> None:
    registry = load_adapters()
    registry.register(FakeProviderAdapter())

    assert "FAKE" in registry.available()
```

Смысл всей задачи 4.2 — этот тест.

- [ ] **Шаг 6: Коммит**

---

## Задача 4.4 — Формирование инвойса

**Кто:** Backend 3
Сценарий **С9**.

- [ ] **Шаг 1: Тест — сумма берётся из `calculation_snapshot`, не пересчитывается**
- [ ] **Шаг 2: Тест — 100 % предоплата, частичная оплата не принимается**
- [ ] **Шаг 3: Тест — срок оплаты 10 дней, по истечении заявка приостанавливается**
- [ ] **Шаг 4: Реализовать, прогнать**
- [ ] **Шаг 5: Коммит**

---

## Задача 4.5 — Обработка webhook

**Кто:** Backend 3
**Consumes:** 4.3, 4.4

- [ ] **Шаг 1: Тест — повторный webhook не создаёт вторую транзакцию**

```python
async def test_duplicate_webhook_is_ignored(client: AsyncClient) -> None:
    payload = signed_webhook(external_id="txn-1")

    first = await client.post("/webhooks/payme", json=payload)
    second = await client.post("/webhooks/payme", json=payload)

    assert first.status_code == second.status_code == 200
    assert await count_transactions(external_id="txn-1") == 1
```

- [ ] **Шаг 2: Тест — неподписанный webhook отбрасывается и пишется в аудит**
- [ ] **Шаг 3: Тест — несовпадение суммы даёт `ERR-PAY-003` и расхождение**
- [ ] **Шаг 4: Тест — подтверждение двигает статус заявки**
- [ ] **Шаг 5: Реализовать, прогнать**
- [ ] **Шаг 6: Тест на время: отражение платежа ≤ 30 минут**
- [ ] **Шаг 7: Коммит**

---

## Задача 4.6 — Ручная отметка оплаты

**Кто:** Backend 3
Требование п. 9.4 сценария С9 — исключительный порядок.

- [ ] **Шаг 1: Тест — без банковского документа операция блокируется**
- [ ] **Шаг 2: Тест — требуется подтверждение второго лица**
- [ ] **Шаг 3: Тест — операция автоматически порождает `RI-01`**

```python
async def test_manual_paid_raises_risk_indicator(session: AsyncSession) -> None:
    await payment.mark_paid_manually(
        session, invoice_id=I, bank_document=doc, maker=accountant, checker=head
    )

    assert await risk_indicator_exists(session, "RI-01", I)
```

- [ ] **Шаг 4: Реализовать, прогнать**
- [ ] **Шаг 5: Метрика `manual_paid_total` — должна оставаться нулём**
- [ ] **Шаг 6: Коммит**

---

## Задача 4.7 — Распределение 50 на 50

**Кто:** Backend 3
Сценарий **С10**.

- [ ] **Шаг 1: Тест — нечётная копейка не теряется**

```python
def test_allocation_preserves_odd_kopeck() -> None:
    parts = calculate_allocation(Money(Decimal("1000000.01")))

    assert len(parts) == 2
    assert sum(p.amount for p in parts) == Decimal("1000000.01")
```

Классическое место потери денег при делении пополам.

- [ ] **Шаг 2: Тест — записи попадают в allocation ledger со счетами получателей**
- [ ] **Шаг 3: Тест — изменение соотношения сохраняет историю**
- [ ] **Шаг 4: Реализовать, прогнать**
- [ ] **Шаг 5: Коммит**

---

## Задача 4.8 — Сверка с банковской выпиской

**Кто:** Backend 3
Сценарий **С10**.

- [ ] **Шаг 1: Тест — совпавшие записи помечаются `RECONCILED`**
- [ ] **Шаг 2: Тест — платёж в системе без записи в банке порождает `RI-10`**

Требование п. 10.2.

- [ ] **Шаг 3: Тест — платёж в банке без записи в системе попадает в «неизвестные»**
- [ ] **Шаг 4: Реализовать загрузку выписки файлом и через API**
- [ ] **Шаг 5: Ежедневная автоматическая сверка в `core-worker`**
- [ ] **Шаг 6: Ежедневный и ежемесячный отчёт**
- [ ] **Шаг 7: Коммит**

---

## Задача 4.9 — Возврат платежа

**Кто:** Backend 3
Сценарий **С14**.

- [ ] **Шаг 1: Тест — отклонение от формулы блокируется и порождает `RI-11`**

```python
async def test_refund_outside_formula_is_blocked(session: AsyncSession) -> None:
    with pytest.raises(RefundFormulaViolation):
        await refund.approve(session, refund_id=R, amount=Money(Decimal("999999.00")))

    assert await risk_indicator_exists(session, "RI-11", R)
```

- [ ] **Шаг 2: Тест — требуется maker-checker**
- [ ] **Шаг 3: Тест — нарушение 20 рабочих дней порождает `RI-07`**
- [ ] **Шаг 4: Реализовать, прогнать**
- [ ] **Шаг 5: Коммит**

---

## Задача 4.10 — Льготы

**Кто:** Backend 3
⚠️ Категории по вопросу **Н4**.

- [ ] **Шаг 1: Тест — льготный коэффициент фиксируется в snapshot**

Требование п. 14.4.

- [ ] **Шаг 2: Реестр категорий и подтверждающих документов**
- [ ] **Шаг 3: Коммит**

---

## Задача 4.11 — Фронтенд

**Кто:** Frontend

- [ ] **Шаг 1: Выбор способа оплаты**
- [ ] **Шаг 2: История платежей и чеки**
- [ ] **Шаг 3: Кабинет бухгалтера: счета, транзакции, сверка, расхождения**
- [ ] **Шаг 4: Экран возврата с расчётом и контролем срока**
- [ ] **Шаг 5: Коммит**

---

## Готово, когда

- [ ] Заявитель платит через любой из четырёх провайдеров
- [ ] `PAID` устанавливается **только** подписанным webhook
- [ ] Повторный webhook не создаёт вторую транзакцию
- [ ] Несовпадение суммы даёт `ERR-PAY-003` и расхождение бухгалтеру
- [ ] Ручная отметка требует документа, второго лица и порождает `RI-01`
- [ ] Распределение 50 на 50 не теряет копейку
- [ ] Ежедневная сверка находит расхождения
- [ ] Платёж без записи в банке порождает `RI-10`
- [ ] Возврат вне формулы блокируется и порождает `RI-11`
- [ ] Добавление пятого провайдера не требует изменений в `core`
- [ ] Метрика `manual_paid_total` равна нулю

## Следующая фаза

[`phase-5-inspection-and-oversight.md`](phase-5-inspection-and-oversight.md)
