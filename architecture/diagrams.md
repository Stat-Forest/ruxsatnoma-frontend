# Архитектура Ruxsatnoma в схемах

Все схемы на Mermaid. Каждый блок самодостаточен — копируй один блок целиком (без строк с ```) и вставляй в **Excalidraw → меню → Mermaid to Excalidraw**, либо в [mermaid.live](https://mermaid.live).

> **Что конвертируется в Excalidraw:** `flowchart` и `sequenceDiagram`. Схемы 9 (`erDiagram`) в Excalidraw не перейдут — для неё есть вариант 9б на flowchart.

## Соглашения по оформлению

Единый стиль для всех схем:

1. **Зоны — рамками.** Клиенты, периметр, приложения, данные, внешние системы, надзорный периметр.
2. **Протокол подписан на стрелке.** `HTTPS`, `REST + JWT`, `SQL + PostGIS`, `AMQP`, `mTLS + ЭЦП`, `OIDC`.
3. **Что пересекает границу и в каком виде.** Это важнее самих стрелок: `PKCS7 → verdict`, `маскированные ПДн`, `только GET`, `SQL только SELECT`, `code → access_token → profile`.
4. **Очереди и топики названы по назначению**, а не просто «брокер».
5. **На переходах статусов подписано, кто их выполняет.**

## Содержание

| № | Схема | Тип |
|---|---|---|
| **0** | **Полная картина — весь поток на одном холсте** | flowchart |
| 1 | Контекст системы | flowchart |
| 2 | Два сервиса и зоны ответственности | flowchart |
| 3 | Модули внутри `core` | flowchart |
| 4 | Развёртывание и инфраструктура | flowchart |
| 5 | Подача заявки — сценарий С3 | sequence |
| 6 | Оплата и выдача разрешения — С9–С11 | sequence |
| 7 | Прокурорский контур — С22 | sequence |
| 8 | Статус-машина заявки | flowchart |
| 9 | Модель данных | erDiagram + flowchart |
| 10 | Миграция: маппинг старой БД в новую | flowchart |
| 11 | Миграция: фазы перехода | flowchart |
| 12 | Режим degraded при падении внешних систем | flowchart |

---

## 0. Полная картина

Весь поток на одном холсте: клиенты, периметр, оба сервиса с модулями и адаптерами, воркеры, данные, очереди, внешние системы и надзорный контур. Схемы 1–12 — это её отдельные срезы крупным планом.

Она большая. В Excalidraw после вставки удобно разложить зоны по горизонтали: клиенты слева, данные внизу, внешние системы справа.

```mermaid
flowchart LR
    subgraph clients["КЛИЕНТЫ"]
        cApplicant["Заявитель<br/>физ. и юр. лицо"]
        cStaff["Сотрудник лесхоза<br/>GIS и нормативный специалист"]
        cBoss["Руководитель<br/>уполномоченное лицо"]
        cInspector["Инспектор<br/>мобильное PWA"]
        cAdmin["Администратор"]
        cAnon["Аноним<br/>проверка QR, открытые данные"]
    end

    subgraph channel["ВНЕШНИЙ КАНАЛ"]
        chMygov["my.gov.uz<br/>портал госуслуг"]
    end

    subgraph edge["ПЕРИМЕТР"]
        eWaf["WAF и anti-DDoS<br/>вынесено на конец проекта"]
        eNginx["nginx — публичный vhost<br/>TLS, rate limit, CORS,<br/>Correlation-Id, лимит размера файла"]
        eNginxOv["nginx — закрытый vhost<br/>только ИМУТ, IP allowlist"]
    end

    subgraph feZone["FRONTEND — Next.js"]
        fePublic["Публичный портал<br/>SSR для SEO"]
        feCabinet["Личные кабинеты"]
        feMap["Карта, vector tiles"]
        fePwa["PWA инспектора<br/>offline IndexedDB"]
    end

    subgraph coreZone["CORE"]
        mwAuth["Middleware<br/>JWT, RBAC + ABAC"]
        mIam["iam"]
        mApp["application<br/>workflow, SLA"]
        mGis["gis<br/>контуры, слои, занятость"]
        mRule["rules<br/>норма, лимит, тариф"]
        mPermit["permit<br/>PDF/A, QR, серия и номер"]
        mSign["signature"]
        mPay["payment<br/>инвойс, сверка, 50 на 50, refund"]
        mInsp["inspection<br/>акты, нарушения"]
        mRep["reporting, dashboard"]
        mArch["archive, лесной билет"]
        mProsec["витрина прокурора<br/>только GET"]
        mRisk["детекторы RI-01…RI-15"]
        mAudit["audit append-only"]
        mOutbox["outbox"]
        coreWorker["core-worker<br/>истёкшие разрешения, сверка,<br/>архивация, пересчёт занятости"]
    end

    subgraph intZone["INTEGRATION"]
        iWebhook["приём webhook"]
        iBff["BFF my.gov.uz"]
        aOneid["адаптер OneID"]
        aEimzo["адаптер E-IMZO"]
        aPay["адаптеры платежей<br/>общий интерфейс"]
        aKadastr["адаптер Кадастра"]
        aVet["адаптер Ветеринарии"]
        aNsi["адаптер cs.egov.uz"]
        aSmart["адаптер Smart Forestry"]
        aSms["адаптер Eskiz и SMTP"]
        aRn["адаптер Raqamli nazorat"]
        iOutbox["outbox, retry, backoff,<br/>circuit breaker, DLQ"]
        intWorker["integration-worker"]
    end

    subgraph data["ДАННЫЕ"]
        pgCore[("PostgreSQL 18 + PostGIS<br/>база core")]
        poolRo[("пул read_only<br/>без INSERT, UPDATE, DELETE")]
        pgInt[("PostgreSQL<br/>база integration")]
        redis[("Redis<br/>сессии, rate limit, OTP")]
        mq[("RabbitMQ")]
        minio[("MinIO<br/>PDF/A, фото, видео")]
    end

    subgraph queues["ОЧЕРЕДИ"]
        qEvents["events<br/>application.*, permit.*,<br/>payment.*, audit.*"]
        qRisk["risk.detected<br/>RI-01…RI-15"]
        qNotify["notify<br/>SMS, email, in-app"]
        qDlq["dlq<br/>недоставленные"]
    end

    subgraph imut["ИМУТ — закрытая сеть"]
        prosecutor["Прокурор"]
        rnSys["Raqamli nazorat<br/>Генпрокуратура"]
    end

    subgraph ext["ВНЕШНИЕ СИСТЕМЫ"]
        xOneid["OneID"]
        xEimzo["E-IMZO, CRL и OCSP"]
        xPayme["Payme"]
        xClick["Click"]
        xUzum["Uzum"]
        xPaynet["Paynet"]
        xBank["Банк, выписка"]
        xKadastr["Кадастр, WFS"]
        xVet["Ветеринарная АТ"]
        xNsi["cs.egov.uz"]
        xSmart["Smart Forestry"]
        xEskiz["Eskiz.uz, SMTP"]
    end

    subgraph backup["РЕЗЕРВИРОВАНИЕ"]
        bWal["архивация WAL, PITR"]
        bCopy[("сервер копий")]
        bDr["резервная площадка<br/>RPO 15 мин, RTO 4 ч"]
    end

    cApplicant -- "HTTPS" --> eWaf
    cStaff -- "HTTPS" --> eWaf
    cBoss -- "HTTPS" --> eWaf
    cInspector -- "HTTPS, синхронизация offline" --> eWaf
    cAdmin -- "HTTPS" --> eWaf
    cAnon -- "HTTPS, без авторизации" --> eWaf
    eWaf --> eNginx

    eNginx -- "всё кроме /api и /webhooks" --> fePublic
    eNginx -- "/api/*" --> mwAuth
    eNginx -- "/webhooks/*" --> iWebhook
    eNginx -- "/bff/*" --> iBff
    chMygov -- "REST + OneID" --> eNginx
    fePublic --> feCabinet
    fePublic --> feMap
    fePublic --> fePwa

    mwAuth -- "user_id, роль, границы ABAC" --> mApp
    mwAuth --> mIam
    mwAuth --> mPermit
    mwAuth --> mInsp
    mwAuth --> mRep
    mwAuth -- "роль Прокурор" --> mProsec

    mIam -- "code → access_token → profile" --> aOneid
    aOneid -- "OIDC" --> xOneid
    mSign -- "PKCS7 → verdict" --> aEimzo
    aEimzo -- "проверка сертификата, CRL и OCSP" --> xEimzo

    mApp -- "contour_id, геометрия, период<br/>→ свободная площадь" --> mGis
    mGis -- "ST_IsValid, ST_Within,<br/>ST_Overlaps, ST_Area" --> pgCore
    mApp -- "площадь, состав скота<br/>→ MaxSB, RemainingSB, UsedSB" --> mRule
    mRule -- "норма и тариф по rule_version" --> pgCore
    mApp -- "INSERT + EXCLUDE constraint<br/>дубликат → 409" --> pgCore
    mApp -- "поголовье и ветстатус" --> aVet
    aVet -- "REST, при отказе — бумажный документ" --> xVet
    mGis -- "геометрия и права на контур" --> aKadastr
    aKadastr -- "WFS, REST" --> xKadastr
    mGis -- "vector tiles" --> feMap

    mApp -- "calculation_snapshot → инвойс" --> mPay
    mPay -- "invoice, payment_intent" --> pgCore
    cApplicant -- "оплата" --> xPayme
    cApplicant -- "оплата" --> xClick
    cApplicant -- "оплата" --> xUzum
    cApplicant -- "оплата" --> xPaynet
    xPayme -- "подписанный webhook<br/>+ Idempotency-Key" --> iWebhook
    xClick -- "подписанный webhook" --> iWebhook
    xUzum -- "подписанный webhook" --> iWebhook
    xPaynet -- "подписанный webhook" --> iWebhook
    iWebhook -- "проверка подписи<br/>и идемпотентности" --> aPay
    aPay -- "REST, платёж подтверждён" --> mPay
    xBank -- "выписка, файл или API" --> aPay
    mPay -- "PAID → выдать разрешение" --> mPermit

    mPermit -- "серия и номер,<br/>неповторяемость на уровне СУБД" --> pgCore
    mPermit -- "PDF/A + QR, immutable snapshot" --> minio
    mPermit -- "hash документа" --> mSign
    mSign -- "timestamp и hash подписи" --> pgCore

    fePwa -- "QR, GPS, чек-лист" --> mInsp
    mInsp -- "фото и видео<br/>+ время, GPS, устройство, hash" --> minio
    mInsp -- "акт и нарушение" --> pgCore

    iBff -- "REST, заявка из my.gov.uz" --> mApp
    mApp -- "статус заявки" --> iBff
    iBff -- "webhook, синхронизация статуса" --> chMygov

    mApp -- "кто, что, когда, IP" --> mAudit
    mPermit -- "кто, что, когда, IP" --> mAudit
    mPay -- "кто, что, когда, IP" --> mAudit
    mInsp -- "кто, что, когда, IP" --> mAudit
    mAudit -- "append-only, 3 года" --> pgCore
    mAudit -- "юридически значимые события" --> mOutbox
    mRisk -- "нарушение инварианта" --> mOutbox
    mPay -- "PAID без подтверждения → RI-01" --> mRisk
    mPermit -- "выдача без оплаты → RI-10" --> mRisk
    mRule -- "ретроактивное изменение → RI-04" --> mRisk
    mAudit -- "попытка изменить журнал → RI-06" --> mRisk

    mOutbox -- "AMQP" --> qEvents
    mOutbox -- "AMQP" --> qRisk
    mOutbox -- "AMQP" --> qNotify
    qEvents --> intWorker
    qRisk --> intWorker
    qNotify --> intWorker
    intWorker -- "не доставлено после ретраев" --> qDlq
    qDlq -- "предупреждение администратору" --> intWorker

    intWorker --> iOutbox
    iOutbox -- "состояние доставки" --> pgInt
    intWorker -- "текст уведомления" --> aSms
    aSms -- "REST" --> xEskiz
    intWorker -- "события и риск-индикаторы" --> aRn
    aRn -- "mTLS + ЭЦП<br/>POST /events, /risk-indicators" --> rnSys
    coreWorker -- "синхронизация классификаторов" --> aNsi
    aNsi -- "REST" --> xNsi
    intWorker -- "отраслевой обмен" --> aSmart
    aSmart -- "REST, event bus" --> xSmart

    prosecutor -- "HTTPS через ИМУТ,<br/>вход по ЭЦП или OneID" --> eNginxOv
    eNginxOv -- "только GET" --> mProsec
    mProsec -- "верификация по ЖШШИР<br/>ответ не кэшируется" --> aRn
    aRn -- "mTLS, POST /verify-officer" --> rnSys
    rnSys -- "должность, код территории,<br/>срок полномочий" --> aRn
    mProsec -- "SQL только SELECT" --> poolRo
    poolRo -- "SELECT в границах территории" --> pgCore
    mProsec -- "маскированные ПДн,<br/>watermark + user_id" --> prosecutor
    mProsec -- "журнал просмотров и экспорта" --> aRn

    coreWorker -- "истёкшие разрешения, сверка,<br/>архивация, пересчёт занятости" --> pgCore
    mArch -- "долговременное хранение" --> minio
    mRep -- "агрегаты и выгрузки" --> pgCore
    mwAuth -- "сессии, rate limit, OTP" --> redis

    pgCore --> bWal
    pgInt --> bWal
    bWal --> bCopy
    bCopy --> bDr
    pgCore -. "потоковая репликация" .-> bDr
```

---

## 1. Контекст системы

Кто с кем разговаривает. Внешних систем 12, они перечислены в [`../tz/05-integrations.md`](../tz/05-integrations.md).

```mermaid
flowchart TB
    subgraph people["ПОЛЬЗОВАТЕЛИ — публичный интернет"]
        applicant["Заявитель<br/>физ. и юр. лица"]
        staff["Сотрудник лесхоза<br/>GIS и нормативный специалист"]
        boss["Руководитель<br/>уполномоченное лицо"]
        inspector["Инспектор"]
        admin["Администратор"]
        anon["Аноним<br/>проверка QR, открытые данные"]
    end

    subgraph imutZone["ИМУТ — закрытая сеть"]
        prosecutor["Прокурор"]
        rn["Raqamli nazorat<br/>Генпрокуратура"]
    end

    subgraph system["RUXSATNOMA"]
        gw["nginx — публичный vhost<br/>TLS, rate limit, CORS,<br/>Correlation-Id, маршрутизация"]
        gwOv["nginx — закрытый vhost<br/>только ИМУТ, IP allowlist"]
        front["Frontend<br/>Next.js"]
        core["core"]
        integ["integration"]
    end

    subgraph external["ВНЕШНИЕ СИСТЕМЫ"]
        oneid["OneID"]
        eimzo["E-IMZO<br/>CRL и OCSP"]
        mygov["my.gov.uz"]
        kadastr["Кадастр и GIS"]
        vet["Ветеринарная АТ"]
        pay["Payme, Click, Uzum,<br/>Paynet, банк"]
        sms["Eskiz.uz, SMTP"]
        csegov["cs.egov.uz"]
        smart["Smart Forestry"]
    end

    applicant -- "HTTPS" --> gw
    staff -- "HTTPS" --> gw
    boss -- "HTTPS" --> gw
    inspector -- "HTTPS, offline sync" --> gw
    admin -- "HTTPS" --> gw
    anon -- "HTTPS, без авторизации" --> gw

    gw -- "всё кроме /api и /webhooks" --> front
    gw -- "/api/*, REST + JWT<br/>валидация и ABAC внутри core" --> core
    gw -- "/webhooks/*, /bff/*" --> integ

    core -- "REST, запрос наружу" --> integ
    integ -- "REST, ответ или код ошибки" --> core
    core -- "AMQP: события домена,<br/>риск-индикаторы RI-01…RI-15" --> integ

    prosecutor -- "HTTPS через ИМУТ<br/>только GET" --> gwOv
    gwOv -- "роль Прокурор,<br/>пул соединений read_only" --> core
    core -- "маскированные ПДн<br/>watermark + user_id" --> prosecutor

    integ -- "OIDC<br/>code → access_token → profile" --> oneid
    integ -- "PKCS7 → verdict<br/>CRL и OCSP" --> eimzo
    integ -- "REST + webhook<br/>заявка и статус" --> mygov
    integ -- "WFS, REST<br/>геометрия и права" --> kadastr
    integ -- "REST<br/>поголовье и ветстатус" --> vet
    integ -- "webhook + Idempotency-Key<br/>подтверждение платежа" --> pay
    integ -- "REST, текст уведомления" --> sms
    integ -- "REST, классификаторы" --> csegov
    integ -- "REST, event bus" --> smart

    integ -- "mTLS + ЭЦП<br/>events, risk-indicators, access-log" --> rn
    integ -- "mTLS<br/>verify-officer по ЖШШИР" --> rn
    rn -- "должность, код территории,<br/>срок полномочий" --> integ
```

---

## 2. Два сервиса и зоны ответственности

Прокурорская витрина — не отдельный сервис, а роль внутри `core` с отдельным пулом соединений и отдельным vhost. Обмен с «Raqamli nazorat» — исходящий поток в `integration`, он не зависит от того, зашёл прокурор или нет.

```mermaid
flowchart LR
    subgraph coreBox["ruxsatnoma-core"]
        direction TB
        c1["IAM<br/>пользователи, роли, RBAC и ABAC"]
        c2["Заявка и workflow<br/>статус-машина, SLA"]
        c3["GIS<br/>контуры, слои, занятость, тайлы"]
        c4["Rule engine<br/>нормы, лимиты, тарифы"]
        c5["Разрешение и документ<br/>PDF/A, QR, подписи"]
        c6["Платежи<br/>инвойс, сверка, распределение, возврат"]
        c7["Инспектор<br/>акты, нарушения, offline"]
        c8["Отчёты и dashboard"]
        c9["Архив, лесной билет, классификаторы"]
        c10["Аудит append-only"]
        c11["Витрина прокурора<br/>роль + пул read_only + только GET"]
        c12["Детекторы риск-индикаторов<br/>RI-01…RI-15"]
    end

    subgraph integBox["ruxsatnoma-integration"]
        direction TB
        i1["Адаптеры идентификации<br/>OneID, E-IMZO, ИМУТ"]
        i2["Адаптеры платежей<br/>Payme, Click, Uzum, Paynet<br/>единый интерфейс, +1 файл на провайдера"]
        i3["Адаптеры данных<br/>Кадастр, Ветеринария,<br/>cs.egov.uz, Smart Forestry"]
        i4["Outbox и inbox"]
        i5["Retry, backoff, circuit breaker, DLQ"]
        i6["Воркеры очередей<br/>SMS, email, push"]
        i7["BFF my.gov.uz"]
        i8["Обмен с Raqamli nazorat<br/>events, risk, access-log,<br/>verify-officer"]
    end

    front["ruxsatnoma-frontend<br/>Next.js"]

    front -- "REST + JWT" --> coreBox
    coreBox -- "REST<br/>verify ЭЦП, профиль OneID,<br/>запрос в Кадастр и Ветеринарию" --> integBox
    integBox -- "REST<br/>verdict, профиль, ответ или ERR-INT" --> coreBox
    integBox -- "REST<br/>заявка из my.gov.uz" --> coreBox
    coreBox -- "AMQP: application.*, permit.*,<br/>payment.*, audit.*, risk.detected" --> integBox
    integBox -- "REST<br/>верификация прокурора по ЖШШИР" --> coreBox
```

---

## 3. Модули внутри `core`

Границы модулей держим строго: пунктиром показаны швы, по которым `gis` и `payment` при необходимости выделяются в отдельные сервисы без переписывания.

```mermaid
flowchart TB
    subgraph api["Слой API"]
        rest["REST-контроллеры"]
        auth["Middleware: JWT, ABAC, Correlation-Id"]
    end

    subgraph domain["Доменные модули"]
        direction TB
        mIam["iam<br/>пользователи, роли, организации"]
        mApp["application<br/>заявка, workflow, SLA"]
        mGis["gis<br/>контуры, слои, занятость"]
        mRule["rules<br/>нормы, тарифы, расчёт"]
        mPermit["permit<br/>разрешение, шаблоны, QR"]
        mSign["signature<br/>хранение подписей"]
        mPay["payment<br/>инвойс, сверка,<br/>allocation 50 на 50, refund"]
        mInsp["inspection<br/>акты, нарушения"]
        mRep["reporting<br/>отчёты, dashboard"]
        mArch["archive<br/>архив, лесной билет"]
    end

    subgraph shared["Общее ядро"]
        audit["audit<br/>append-only журнал"]
        outbox["outbox<br/>исходящие события"]
        nsi["classifiers<br/>справочники НСИ"]
    end

    db[("PostgreSQL 18<br/>+ PostGIS 3.6")]

    rest -- "HTTP-запрос" --> auth
    auth -- "user_id, роль,<br/>границы ABAC" --> mApp
    auth -- "user_id, роль" --> mPermit
    auth -- "user_id, роль" --> mInsp
    auth -- "user_id, роль" --> mRep

    mApp -- "contour_id, геометрия,<br/>период → свободная площадь" --> mGis
    mApp -- "площадь, состав скота<br/>→ MaxSB, RemainingSB, Amount" --> mRule
    mApp -- "calculation_snapshot<br/>→ инвойс" --> mPay
    mApp -- "APPROVED + PAID<br/>→ создать разрешение" --> mPermit
    mPermit -- "hash документа<br/>→ сохранить подпись" --> mSign
    mInsp -- "permit_id<br/>→ статус разрешения" --> mPermit
    mRule -- "contour_id<br/>→ площадь и слои" --> mGis

    mApp -- "кто, что, когда, IP" --> audit
    mPermit -- "кто, что, когда, IP" --> audit
    mPay -- "кто, что, когда, IP" --> audit
    mInsp -- "кто, что, когда, IP" --> audit
    audit -- "юридически значимые<br/>события в очередь" --> outbox

    mIam -- "роли, организации" --> nsi
    mRule -- "виды деятельности,<br/>виды скота" --> nsi

    domain -- "SQL, одна транзакция<br/>на действие + аудит" --> db
    shared -- "SQL" --> db

    mGis -. "шов: своя схема,<br/>обращение только через API модуля" .- db
    mPay -. "шов: своя схема,<br/>обращение только через API модуля" .- db
```

---

## 4. Развёртывание и инфраструктура

Два периметра: публичный и закрытый надзорный. Между ними нет сетевого пути. На стрелках подписаны протокол и то, **что именно пересекает границу и в каком виде** — это важнее самих стрелок.

```mermaid
flowchart LR
    subgraph clients["КЛИЕНТЫ"]
        web["Web<br/>Next.js SSR"]
        pwa["PWA инспектора<br/>offline IndexedDB"]
        anon["Публичный портал<br/>проверка QR"]
    end

    subgraph edge["ПЕРИМЕТР"]
        waf["WAF<br/>anti-DDoS"]
        nginx["Nginx — публичный vhost<br/>TLS, rate limit, CORS,<br/>Correlation-Id, client_max_body_size,<br/>маршрутизация по префиксу"]
    end

    subgraph appzone["ПРИЛОЖЕНИЯ"]
        core["core-api<br/>JWT + ABAC внутри"]
        coreW["core-worker<br/>регламентные задания"]
        integ["integration-api<br/>webhooks и BFF"]
        worker["integration-worker<br/>outbox, retry, SMS, email"]
    end

    subgraph datazone["ДАННЫЕ"]
        pg[("PostgreSQL 18<br/>PostGIS 3.6")]
        redis[("Redis<br/>сессии, rate limit, OTP")]
        s3[("MinIO<br/>PDF/A, фото, видео")]
        mq[("RabbitMQ")]
    end

    subgraph ovzone["НАДЗОРНЫЙ ПЕРИМЕТР"]
        nginxOv["Nginx<br/>закрытый vhost<br/>IP allowlist"]
        pool[("Пул соединений<br/>пользователь read_only<br/>без INSERT, UPDATE, DELETE")]
    end

    subgraph imut["ИМУТ — закрытая сеть"]
        prosecutor["Рабочее место<br/>прокурора"]
        rn["Raqamli nazorat"]
    end

    subgraph ext["ВНЕШНИЕ СИСТЕМЫ"]
        oneid["OneID"]
        eimzo["E-IMZO<br/>CRL и OCSP"]
        paysys["Payme, Click, Uzum,<br/>Paynet, банк"]
        gov["my.gov.uz, Кадастр,<br/>Ветеринария, cs.egov.uz"]
        eskiz["Eskiz.uz, SMTP"]
    end

    subgraph backup["РЕЗЕРВИРОВАНИЕ"]
        wal["Архивация WAL"]
        bkp[("Сервер копий")]
        dr["Резервная площадка<br/>RPO 15 мин, RTO 4 ч"]
    end

    web -- "HTTPS" --> waf
    pwa -- "HTTPS" --> waf
    anon -- "HTTPS" --> waf
    waf --> nginx
    nginx -- "/api/*, REST + JWT" --> core
    nginx -- "/webhooks/*, /bff/*" --> integ

    core -- "REST<br/>запрос наружу" --> integ
    integ -- "REST<br/>ответ или код ошибки" --> core
    integ -- "AMQP" --> mq
    mq -- "AMQP" --> worker

    core -- "SQL + PostGIS" --> pg
    core -- "сессии, кэш, rate limit" --> redis
    core -- "S3 API" --> s3
    integ -- "SQL<br/>outbox и DLQ" --> pg
    core -- "AMQP<br/>события домена, риск-индикаторы" --> mq
    coreW -- "SQL, регламент по расписанию" --> pg

    integ -- "OIDC<br/>code → access_token → profile" --> oneid
    integ -- "PKCS7 → verdict<br/>CRL и OCSP" --> eimzo
    integ -- "webhook + Idempotency-Key" --> paysys
    integ -- "REST, WFS, SOAP" --> gov
    integ -- "SMS и email" --> eskiz

    prosecutor -- "HTTPS через ИМУТ" --> nginxOv
    nginxOv -- "только GET,<br/>роль Прокурор" --> core
    core -- "SQL только SELECT" --> pool
    pool -- "SELECT" --> pg
    core -- "маскированные ПДн<br/>watermark + user_id" --> prosecutor

    integ -- "mTLS<br/>verify-officer по ЖШШИР" --> rn
    rn -- "должность, код территории,<br/>срок полномочий" --> integ
    integ -- "mTLS + ЭЦП<br/>events, risk-indicators, access-log" --> rn

    pg --> wal
    wal --> bkp
    bkp --> dr
    pg -. "потоковая репликация" .-> dr
```

---

## 5. Подача заявки — сценарий С3

Самый нагруженный путь. Проверка укладывается в 5 секунд, вся заявка сохраняется за 3.

```mermaid
sequenceDiagram
    actor A as Заявитель
    participant F as Frontend
    participant G as nginx
    participant C as core
    participant I as integration
    participant DB as PostgreSQL
    participant RN as Raqamli nazorat

    A->>F: Выбирает вид деятельности и контур
    F->>G: POST /api/applications/check
    G->>C: маршрут /api/*

    C->>DB: ST_IsValid, ST_Within, ST_Overlaps
    DB-->>C: Геометрия валидна, пересечений нет
    C->>DB: Занятые площади на контуре за период
    DB-->>C: occupied_area_ha
    C->>C: MaxSB = floor(Oz x 0.85 / 3.74)
    C->>C: RemainingSB = MaxSB - ActivePermitsSB
    C->>C: UsedSB = sum(Count x Coef)

    alt UsedSB больше RemainingSB
        C-->>F: 422 ERR-NORM-002 и остаточный лимит
    else Проверка пройдена
        C->>C: Amount = БҲМ x coef x qty
        C-->>F: Расчёт и предварительная сумма
    end

    A->>F: Подписывает заявку ЭЦП
    F->>G: POST /api/applications
    G->>C: маршрут /api/*

    C->>I: POST /eimzo/verify
    I->>I: Проверка PKCS7, цепочки, CRL и OCSP
    I-->>C: Подпись действительна

    C->>DB: BEGIN
    C->>DB: INSERT application
    Note over C,DB: EXCLUDE constraint по<br/>applicant + contour + activity + период
    C->>DB: INSERT calculation с rule_version и snapshot
    C->>DB: INSERT signature
    C->>DB: INSERT audit_log
    C->>DB: INSERT outbox — надзорное событие
    C->>DB: COMMIT

    alt Пересечение с активной заявкой
        DB-->>C: Нарушение constraint
        C-->>F: 409 ERR-APP-002 и номер существующей заявки
    end

    C-->>F: application_id и статус SUBMITTED
    C--)I: Надзорное событие из outbox
    I--)RN: POST /events, mTLS + ЭЦП
    C--)I: Уведомление заявителю
    I--)A: SMS и in-app
```

---

## 6. Оплата и выдача разрешения — сценарии С9–С11

Ключевой инвариант: `PAID` ставит только обработчик подписанного webhook.

```mermaid
sequenceDiagram
    actor A as Заявитель
    participant C as core
    participant I as integration
    participant P as Payme и Paynet
    participant B as Банк
    participant S as E-IMZO
    participant RN as Raqamli nazorat

    Note over C: Заявка в статусе APPROVED
    C->>C: Формирует инвойс по calculation_snapshot
    C-->>A: Инвойс, 100 процентов предоплаты
    A->>P: Оплачивает

    P->>I: webhook с подписью и Idempotency-Key
    I->>I: Проверка подписи и идемпотентности

    alt Webhook повторный
        I-->>P: 200, повторно не обрабатываем
    else Первый webhook
        I->>C: Платёж подтверждён
        C->>C: invoice = PAID, заявка = PAID
        C->>C: Allocation 50 на 50 в ledger
        C--)I: Событие оплаты
        I--)RN: POST /events
    end

    Note over C: Формирование разрешения
    C->>C: Серия и номер, PDF/A, QR-код
    C->>S: Подпись руководителя хозяйства
    C->>S: Подпись главного лесничего
    C->>S: Подпись главного бухгалтера
    S-->>C: Подписи получены
    C->>I: Проверка сертификатов CRL и OCSP
    I-->>C: Сертификаты действительны

    alt Сертификат отозван или просрочен
        C->>C: Формирует RI-05
        C--)I: Риск-индикатор
        I--)RN: POST /risk-indicators
    end

    C->>C: immutable snapshot, статус ACTIVE
    C--)A: Разрешение в личном кабинете
    C--)I: Событие выдачи разрешения
    I--)RN: POST /events

    Note over B,C: Ежедневная сверка
    B->>I: Банковская выписка
    I->>C: Транзакции за день
    C->>C: Reconciliation

    alt Платёж есть в системе, нет в банке
        C->>C: Формирует RI-10 критический
        C--)I: Риск-индикатор
        I--)RN: POST /risk-indicators, не более 5 минут
    end
```

---

## 7. Прокурорский контур — сценарий С22

Верификация выполняется при **каждом** входе, ответ не кэшируется.

```mermaid
sequenceDiagram
    actor P as Прокурор
    participant N as nginx закрытый vhost
    participant C as core
    participant I as integration
    participant RN as Raqamli nazorat
    participant RO as пул read_only
    participant DB as PostgreSQL

    P->>N: Вход через ИМУТ
    N->>N: Проверка IP allowlist

    alt IP не в списке
        N-->>P: Отказ, соединение закрыто
    end

    N->>C: Вход по E-IMZO или OneID
    Note over C: Вход по паролю запрещён

    C->>I: Верификация по ЖШШИР
    I->>RN: POST /verify-officer, mTLS
    RN-->>I: Должность, код территории, срок полномочий
    I-->>C: Результат верификации
    Note over C,I: Ответ не кэшируется,<br/>спрашиваем при каждом входе

    alt Ответ отрицательный или отсутствует
        C->>DB: Запись в аудит
        C-->>P: 403 ERR-AUTH-005
    else Верификация пройдена
        C->>C: Роль Прокурор и граница ABAC по территории
        C-->>P: Сессия, TTL 30 минут
    end

    P->>C: Поиск и фильтрация
    C->>RO: SELECT в пределах территории
    RO->>DB: SELECT
    DB-->>RO: Строки
    RO-->>C: Результат за 3 секунды
    C->>DB: Запись действия в аудит
    C->>I: access-log
    I->>RN: POST /access-log
    C-->>P: Витрина, маскированные ПДн

    alt Попытка операции записи
        C-->>P: 403 ERR-ACL-003
        Note over RO,DB: Даже при ошибке в коде<br/>СУБД откажет: нет прав INSERT
        C->>DB: Критическая запись в аудит
        C->>I: RI-12
        I->>RN: POST /risk-indicators
    end

    P->>C: Экспорт отчёта
    C->>C: Проверка лимита объёма
    C->>C: Watermark и ID пользователя
    C-->>P: PDF или XLSX
    C->>I: access-log

    Note over C,RN: Постоянный поток, не зависит от прокурора
    C--)I: События и риск-индикаторы
    I--)RN: POST /events и /risk-indicators
```

---

## 8. Статус-машина заявки

Полное описание — [`../tz/09-state-machines.md`](../tz/09-state-machines.md). Статус `CONTRACT_DRAFT` в ТЗ упомянут, но не определён — вопрос П3.

```mermaid
flowchart TD
    DRAFT["DRAFT<br/>черновик, autosave"]
    SUBMITTED["SUBMITTED<br/>подписана ЭЦП"]
    IN_REVIEW["IN_REVIEW<br/>рассматривается"]
    PENDING_INFO["PENDING_INFO<br/>SLA-таймер остановлен"]
    CONTRACT["CONTRACT_DRAFT<br/>не определён в ТЗ"]
    RETURNED["RETURNED<br/>на исправление"]
    APPROVED["APPROVED<br/>решение руководителя"]
    INVOICED["INVOICED<br/>ожидание платежа"]
    PAID["PAID<br/>подтверждён провайдером"]
    ISSUED["PERMIT_ISSUED<br/>разрешение подписано"]
    CLOSED["CLOSED"]
    REJECTED["REJECTED<br/>с правовым основанием"]
    CANCELLED["CANCELLED"]
    EXPIRED["EXPIRED_UNPAID"]
    REFUND["REFUND_REQUESTED<br/>не определён в ТЗ"]
    ARCHIVED["ARCHIVED"]

    DRAFT -- "заявитель<br/>подписал ЭЦП" --> SUBMITTED
    DRAFT -- "заявитель" --> CANCELLED
    SUBMITTED -- "система<br/>автоназначение по территории" --> IN_REVIEW
    SUBMITTED -- "сотрудник<br/>документы неполны, RJ-01" --> RETURNED
    SUBMITTED -- "сотрудник<br/>RJ-03…RJ-12" --> REJECTED
    IN_REVIEW -- "сотрудник<br/>SLA-таймер на паузу" --> PENDING_INFO
    IN_REVIEW -- "сотрудник<br/>требуется договор" --> CONTRACT
    IN_REVIEW -- "руководитель<br/>решение + ЭЦП" --> APPROVED
    IN_REVIEW -- "руководитель<br/>основание + RJ-код" --> REJECTED
    IN_REVIEW -- "руководитель" --> RETURNED
    PENDING_INFO -- "заявитель ответил<br/>таймер возобновлён" --> IN_REVIEW
    PENDING_INFO -- "заявитель" --> CANCELLED
    RETURNED -- "заявитель исправил" --> SUBMITTED
    RETURNED -- "заявитель" --> CANCELLED
    CONTRACT -- "договор подписан ЭЦП" --> APPROVED
    APPROVED -- "система<br/>инвойс по snapshot" --> INVOICED
    INVOICED -- "система<br/>подписанный webhook" --> PAID
    INVOICED -- "система<br/>10 дней истекли" --> EXPIRED
    INVOICED -- "заявитель" --> CANCELLED
    PAID -- "уполномоченное лицо<br/>подписало разрешение" --> ISSUED
    PAID -- "заявитель или система" --> REFUND
    ISSUED -- "система<br/>срок истёк" --> CLOSED
    CLOSED -- "система, регламент" --> ARCHIVED
    REJECTED -- "система, регламент" --> ARCHIVED
    CANCELLED --> ARCHIVED
    EXPIRED --> ARCHIVED
```

---

## 9. Модель данных

33 сущности из приложения 7 ТЗ — [`../tz/11-data-model.md`](../tz/11-data-model.md). Сущность `contract` в ТЗ упомянута в связях, но не описана — вопрос П5.

### 9а. ER-диаграмма (для mermaid.live и GitHub, в Excalidraw не конвертируется)

```mermaid
erDiagram
    organization ||--o{ organization : "вышестоящая"
    organization ||--o{ user : "сотрудники"
    role ||--o{ user : "роль"
    user ||--o| applicant : "заявитель"

    applicant ||--o{ application : "подаёт"
    organization ||--o{ contour : "владеет"
    contour ||--o{ norm : "нормы"
    contour ||--o{ application : "участок"
    norm ||--o{ calculation : "правило"
    tariff ||--o{ calculation : "тариф"

    application ||--|| calculation : "расчёт"
    application ||--o{ invoice : "инвойсы"
    application ||--o| permit : "разрешение"
    application ||--o{ refund : "возвраты"
    application ||--o| forest_ticket : "лесной билет"

    invoice ||--o{ payment_intent : "попытки оплаты"
    payment_intent ||--o{ provider_transaction : "транзакции"
    provider_transaction ||--o{ allocation : "распределение"
    provider_transaction ||--o| reconciliation : "сверка"
    bank_statement ||--o{ reconciliation : "выписка"

    permit ||--o{ signature : "подписи"
    permit ||--o{ inspection_act : "инспекции"
    inspection_act ||--o{ media : "фото и видео"
    inspection_act ||--o| violation_case : "нарушение"

    report_form ||--o{ report : "заполнения"
    user ||--o{ notification : "уведомления"
    audit_log ||--o{ risk_indicator : "порождает"
    audit_log ||--o{ oversight_event : "порождает"
```

### 9б. Тот же граф на flowchart — конвертируется в Excalidraw

```mermaid
flowchart LR
    subgraph idn["Идентификация"]
        org["organization"]
        usr["user"]
        rol["role"]
        apl["applicant"]
    end

    subgraph geo["Пространственные данные"]
        cnt["contour"]
    end

    subgraph rul["Правила и расчёт"]
        nrm["norm"]
        trf["tariff"]
        cal["calculation"]
    end

    subgraph app["Заявка и разрешение"]
        apn["application"]
        ctr["contract — нет в ТЗ"]
        prm["permit"]
        sgn["signature"]
        tck["forest_ticket"]
    end

    subgraph pay["Платежи"]
        inv["invoice"]
        pin["payment_intent"]
        ptx["provider_transaction"]
        bst["bank_statement"]
        rec["reconciliation"]
        alc["allocation"]
        rfd["refund"]
    end

    subgraph ins["Инспекция"]
        act["inspection_act"]
        med["media"]
        vio["violation_case"]
    end

    subgraph cro["Сквозные"]
        aud["audit_log"]
        rsk["risk_indicator"]
        ove["oversight_event"]
        ntf["notification"]
        cls["classifier"]
        arc["archive_item"]
    end

    org -- "1 : N" --> usr
    rol -- "1 : N" --> usr
    usr -- "1 : 0..1" --> apl
    apl -- "1 : N подаёт" --> apn
    org -- "1 : N владеет" --> cnt
    cnt -- "1 : N нормы<br/>по видам деятельности" --> nrm
    cnt -- "1 : N участок заявки" --> apn
    nrm -- "rule_version" --> cal
    trf -- "effective_from/to" --> cal
    apn -- "1 : 1 расчёт<br/>+ input_snapshot" --> cal
    apn -- "1 : 0..1" --> ctr
    apn -- "1 : 0..1" --> prm
    apn -- "1 : 0..1" --> tck
    apn -- "1 : N" --> inv
    apn -- "1 : N" --> rfd
    prm -- "1 : N подписи<br/>hash + timestamp" --> sgn
    ctr -- "1 : N подписи" --> sgn
    inv -- "1 : N попытки оплаты" --> pin
    pin -- "1 : N транзакции" --> ptx
    ptx -- "1 : N доли 50 на 50" --> alc
    ptx -- "1 : 0..1 сверка" --> rec
    bst -- "1 : N строк выписки" --> rec
    prm -- "1 : N инспекции" --> act
    act -- "1 : N фото и видео<br/>+ GPS и hash" --> med
    act -- "1 : 0..1" --> vio
    aud -- "порождает" --> rsk
    aud -- "порождает" --> ove
```

---

## 10. Миграция: маппинг старой БД в новую

Старая схема — Django-монолит `urmonrental`. Разбор кода — [`../tz/20-legacy-code-audit.md`](../tz/20-legacy-code-audit.md).

```mermaid
flowchart LR
    subgraph old["Старая БД — PostgreSQL 12"]
        oRegion["region"]
        oDept["department"]
        oDeptAcc["department_account"]
        oUser["accounts_user"]
        oApp["application_application"]
        oReason["application_applicationreason<br/>поголовье скота"]
        oStatus["application_applicationstatus<br/>история статусов"]
        oInv["application_invoice"]
        oPaycom["payment_paycomtransaction"]
        oSet["application_settings<br/>одна строка"]
        oCont["application_contour<br/>без геометрии"]
        oMass["application_massive"]
        oHol["application_holidays"]
        oKey["application_applicationkey<br/>охота"]
        oBal["payment_accountbalance<br/>кошелёк"]
        oForest["forest, news, message,<br/>service, ecotourism"]
    end

    subgraph new["Новая БД — PostgreSQL 18 + PostGIS"]
        nOrg["organization"]
        nCls["classifier"]
        nUser["user"]
        nApl["applicant"]
        nApp["application"]
        nAud["audit_log"]
        nInv["invoice"]
        nPin["payment_intent"]
        nPtx["provider_transaction"]
        nCal["calculation"]
        nTrf["tariff — версионированный"]
        nCont["contour — статус Legacy"]
        nPrm["permit"]
    end

    drop["НЕ ПЕРЕНОСИТСЯ"]
    ask["РЕШЕНИЕ ЗАКАЗЧИКА"]

    oRegion -- "как есть<br/>тип region" --> nCls
    oDept -- "90 организаций<br/>+ иерархия" --> nOrg
    oDeptAcc -- "счёт, банк, МФО<br/>для allocation" --> nOrg
    oUser -- "ЖШШИР, паспорт, телефон<br/>БЕЗ паролей" --> nUser
    oUser -- "если подавал заявки" --> nApl
    oApp -- "реквизиты, статус<br/>+ legacy_id" --> nApp
    oApp -- "если статус 6<br/>разрешение выдано" --> nPrm
    oReason -- "поголовье по 12 группам" --> nApp
    oReason -- "суммы КАК ЕСТЬ<br/>метка legacy, НЕ пересчитывать" --> nCal
    oStatus -- "история → аудит<br/>append-only" --> nAud
    oInv -- "сумма, статус, срок" --> nInv
    oInv -- "тип оплаты, дата" --> nPin
    oPaycom -- "внешний ID, сумма, время" --> nPtx
    oSet -- "одна строка → одна версия<br/>effective_from/to" --> nTrf
    oCont -- "имя и лесхоз<br/>geometry = NULL" --> nCont
    oMass -- "как субконтур<br/>geometry = NULL" --> nCont
    oHol -- "праздничные дни" --> nCls

    oKey -- "вопрос О9" --> ask
    oBal -- "вопрос О11<br/>ненулевые остатки" --> ask
    oForest -- "мобильное приложение<br/>вне области работ" --> drop
```

### Что требует особого внимания

```mermaid
flowchart TD
    p1["Контуры без геометрии"] --> s1["Переносим как contour<br/>со статусом Legacy и NULL geometry.<br/>Новые заявки на них подавать нельзя,<br/>старые разрешения остаются привязанными"]

    p2["Settings — одна строка<br/>без истории версий"] --> s2["Создаём одну версию tariff<br/>с effective_from = дата запуска старой системы<br/>и effective_to = дата перехода"]

    p3["Суммы посчитаны через int()<br/>с отбрасыванием дробной части"] --> s3["НЕ пересчитывать.<br/>Переносим суммы как есть,<br/>в calculation.input_snapshot<br/>ставим метку legacy"]

    p4["10 старых статусов<br/>против 14 новых"] --> s4["Таблица соответствия.<br/>Статусы 1 и 9 аналога не имеют —<br/>зависят от ответа на вопрос О10"]

    p5["Действующие разрешения<br/>на момент перехода"] --> s5["Переносим первыми и с проверкой:<br/>QR-проверка и инспекция<br/>должны работать сразу"]

    p6["Сбор за рассмотрение заявки"] --> s6["Вопрос О10.<br/>Если отменяется — старые инвойсы<br/>типа 2 переносим как исторические"]

    p7["Охота и внутренний кошелёк"] --> s7["Вопросы О9 и О11.<br/>До ответа не переносим"]
```

---

## 11. Миграция: фазы перехода

Правило: **ни одна запись не теряется**. Старая БД до полного закрытия остаётся доступной только для чтения.

```mermaid
flowchart TD
    f0["Фаза 0 — Инвентаризация<br/>Снять дамп прода, посчитать строки,<br/>найти битые и осиротевшие записи,<br/>выгрузить фактические тарифы из Settings"]

    f1["Фаза 1 — Справочники<br/>90 организаций со счетами и ИНН,<br/>регионы, праздники, типы документов.<br/>Можно делать заранее, не мешает работе"]

    f2["Фаза 2 — Контуры<br/>Переносим как Legacy без геометрии.<br/>Параллельно грузим настоящие полигоны,<br/>когда GIS-подразделение их даст"]

    f3["Фаза 3 — Пользователи<br/>ЖШШИР, паспорт, телефон, организация.<br/>Пароли не переносим —<br/>вход через OneID или E-IMZO"]

    f4["Фаза 4 — История<br/>Завершённые заявки, разрешения,<br/>инвойсы, транзакции.<br/>Только для чтения и архива"]

    f5["Фаза 5 — Активные разрешения<br/>Те, что действуют на момент перехода.<br/>Должны работать сразу:<br/>QR, проверка, инспекция"]

    f6["Фаза 6 — Сверка<br/>Построчное сравнение количеств и сумм,<br/>отчёт о расхождениях,<br/>приёмка бухгалтерией"]

    f7["Фаза 7 — Переключение<br/>Старая система в режим read-only,<br/>трафик на новую"]

    f8["Фаза 8 — Параллельная работа<br/>Старая БД доступна для сверки<br/>минимум 6 месяцев"]

    d1{"Расхождения<br/>найдены?"}

    f0 --> f1 --> f2 --> f3 --> f4 --> f5 --> f6 --> d1
    d1 -- "да" --> fix["Разбор и повторный прогон<br/>миграционного скрипта"]
    fix --> f6
    d1 -- "нет" --> f7 --> f8

    note1["Каждая фаза — идемпотентный скрипт.<br/>Повторный запуск не создаёт дублей"]
    note2["Каждая перенесённая запись хранит<br/>legacy_id и legacy_table<br/>для обратной трассировки"]

    f0 -.- note1
    f4 -.- note2
```

---

## 12. Режим degraded при падении внешних систем

Требование п. 4.1.1.3 ТЗ: при недоступности внешнего сервиса система сохраняет основные функции.

```mermaid
flowchart TD
    req["Запрос к внешней системе"]
    cb{"Circuit breaker<br/>открыт?"}
    doCall["Синхронный вызов<br/>timeout 10 секунд"]
    ok{"Ответ<br/>получен?"}
    success["Обработка ответа"]
    retry["Retry с backoff<br/>1, 2, 4, 8 минут"]
    limit{"Попытки<br/>исчерпаны?"}
    dlq["Сообщение в DLQ"]
    alert["Предупреждение администратору"]
    degraded["Переход в режим degraded"]

    subgraph fallback["Поведение в degraded"]
        f1["OneID недоступен<br/>Вход сотрудников по логину и MFA"]
        f2["E-IMZO недоступен<br/>Заявка сохраняется как DRAFT"]
        f3["Ветеринарная АТ недоступна<br/>Бумажный документ и maker-checker"]
        f4["Платёжный провайдер недоступен<br/>Альтернативный способ оплаты"]
        f5["Raqamli nazorat недоступна<br/>События копятся в outbox"]
        f6["Кадастр недоступен<br/>Проверка откладывается, задание GIS-специалисту"]
    end

    req --> cb
    cb -- "нет" --> doCall
    cb -- "да" --> degraded
    doCall --> ok
    ok -- "да" --> success
    ok -- "нет" --> retry
    retry --> limit
    limit -- "нет" --> doCall
    limit -- "да" --> dlq
    dlq --> alert
    dlq --> degraded
    degraded --> fallback
```

---

## Как это открыть в Excalidraw

1. Скопировать содержимое одного блока — **без строк с тремя обратными кавычками**.
2. Открыть [excalidraw.com](https://excalidraw.com).
3. Меню в левом верхнем углу → **Mermaid to Excalidraw**.
4. Вставить, нажать **Insert**.

Для схем 9а (`erDiagram`) конвертация не сработает — используй вариант 9б или открой её в [mermaid.live](https://mermaid.live) и экспортируй в SVG.
