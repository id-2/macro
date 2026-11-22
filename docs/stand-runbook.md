# Стенд Rox на этом Маке: имена, порты, вход и проверки

Короткий справочник для того, кто правит стенд и проверяет правку. Всё ниже
снято с живой машины 23 ноября 2026: рабочее дерево служб
`/Users/t/Projects/macro/wt-integration`, ветка
`integration/rox-enterprise-upstream`, проект контейнеров `rox-one`.
Секретов здесь нет: пароль базы и ключи лежат в
`infra/local/generated/one/local.generated.env`, в документ и в отчёты они не
попадают.

## Из чего собран стенд

- Файлы compose: `docker/docker-compose.yml` и
  `infra/local/generated/one/docker-compose.override.yml` (второй подставляет
  двоичные файлы служб).
- Окружение: `infra/local/generated/one/local.generated.env`.
- Каталог живого экземпляра — `infra/local/generated/one`; именно его
  показывает `docker compose ls` в строке проекта `rox-one`. Если проект
  поднят из другого экземпляра, каталог будет другим, а раскладка прежней.
- Сейчас стенд собран до переименования: служба выдаёт куки `local-macro-*`,
  а в базе `roxdb` лежат 143 записи пользователей с префиксом `macro|` (проверено
  23 ноября 2026 командой из раздела «Проверка после отката» в
  [журнале переименования](rebrand-migration.md)). Это состояние, а не образец.
- Тома не удалять: `docker compose down -v`, `just reset_local`,
  `just destroy_local` и `docker volume rm` на живом стенде стирают данные.
  Для повторного подъёма хватает `just run_local --instance one`.

## Публичные имена

- `https://localhost:24209/app/` — рабочий адрес. Прокси Caddy живёт в
  контейнере `rox-one-proxy-1` и слушает хост-порты `24209`, `443` и `24232`
  (внутри контейнера это `8443`).
- `https://ts-macbook-pro.blenny-gar.ts.net:24209/app/` — тот же стенд по
  имени машины в сети Tailscale. Сертификат покрывает и это имя.
- `https://app.rox.one/` отвечает `302` на `/app/`, `https://my.rox.one/` —
  `308`. Оба имени привязаны к `127.0.0.1` и `::1` в `/etc/hosts`, поэтому
  открываются только с этой машины. Если порт `443` занят чужой службой (так
  бывает с Tailscale), открывать адрес с портом:
  `https://app.rox.one:24209/app/`.
- `http://localhost:24208` — Mailpit, здесь лежат письма с кодом входа.
- `http://localhost:24205` — FusionAuth.
- Куки браузера прокси хранит в своём пространстве `rox-<instance>--`: службы
  видят обычные имена, а наружу имя получает приставку, чтобы два стенда на
  одной машине не делили сессию.

## Цепочка соединений

Браузер говорит только с прокси, а прокси разводит запросы по префиксам пути
на службы по их именам внутри сети контейнеров. Раскладка лежит в
`infra/local/generated/one/proxy/Caddyfile`; сокращённо так:

- `/app/*` — собранный сайт из `/srv/frontend` внутри прокси, без службы.
- `/auth/*` — `authentication-service:8080`.
- `/connection-gateway`, `/connection-gateway/*` — `connection_gateway:8080`,
  префикс снимается.
- `/contacts/*` — `contacts_service:8080`.
- `/dss/*` — `document_storage_service:8080` (маршрут звонков `/call` тоже
  живёт здесь и приходит без снятия префикса).
- `/email/*` — `email_service:8080`.
- `/notification/*` — `notification_service:8080`.
- `/mailpit/*` — `mailpit:8025`, так код входа читается и без отдельного
  порта.
- Дальше по тому же принципу: `/calendar/*`, `/unfurl/*`, `/image-proxy/*`,
  `/agent-harness/*`, `/preview`, `/scheduled-action`, `/cognition`, `/mcp`,
  `/websocket/*` (`websocket-service:6969`), `/sync/*`
  (`sync-service:8787`), `/lexical/*`, `/ai-editing/*`, `/local-storage/*`
  (`minio:8333`), `/static-file/*`, `/i/*` (`analytics-proxy:8098`).

Порты служб на хосте нужны только для прямых проверок; в обычной работе
браузер их не трогает.

## Порты шести служб

| Служба | Порт на хосте | Префикс через прокси | Контейнер |
| --- | --- | --- | --- |
| Аутентификация | `24211` | `/auth` | `rox-one-authentication-service-1` |
| Шлюз соединений | `24212` | `/connection-gateway` | `rox-one-connection_gateway-1` |
| Контакты | `24213` | `/contacts` | `rox-one-contacts_service-1` |
| Хранилище документов | `24215` | `/dss` | `rox-one-document_storage_service-1` |
| Почта | `24216` | `/email` | `rox-one-email_service-1` |
| Уведомления | `24217` | `/notification` | `rox-one-notification_service-1` |

Все шесть отвечают `200` на `GET /health` по своему порту. Соседние порты того
же окна: Postgres `24200`, Redis `24201` и `24202`, FusionAuth `24205`,
LocalStack `24206`, Mailpit `24207` и `24208`, прокси `24209` и `24232`,
Kafka `24222`, поиск `24233` и `24234`.

## Как войти по коду

Стенд без настоящей почты: письмо с кодом падает в Mailpit, а сам код
достаётся из него запросом. Три шага подряд.

1. Запросить код. Для нового адреса обязателен `handle`, для существующего он
   не нужен:

```bash
EMAIL=runbook-check@example.com
curl -sk -X POST https://localhost:24209/auth/login/passwordless \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"redirect_uri\":\"https://localhost:24209/app/\",\"handle\":\"runbookcheck\"}"
```

Ответ `{}` — это норма: код не возвращается клиенту, он ушёл письмом. Если
служба собрана с возвратом кода, в ответе будет поле `code`.

2. Достать код из последнего письма:

```bash
CODE=$(curl -s http://localhost:24208/api/v1/message/latest \
  | jq -r '.Text' | grep -oE '[0-9]{6}' | head -1)
echo "$CODE"
```

Тема письма — «Код для входа в Rox», отправитель `noreply@rox.one`.

3. Обменять код на сессию. `disable_redirect=true` возвращает токены телом, а
   не редиректом:

```bash
curl -sk "http://localhost:24211/oauth/passwordless/$CODE?email=$EMAIL&disable_redirect=true"
```

В ответе `access_token`, а в заголовках `Set-Cookie`. Имена кук зависят от
сборки: переименованная выдаёт `local-rox-access-token` и
`local-rox-refresh-token`, прежняя — `local-macro-access-token` и
`local-macro-refresh-token`. Что именно выдала служба, видно по заголовкам без
догадок.

Для браузера: положить полученные куки в контекст и до загрузки приложения
выставить в localStorage `rox:login` в `true` — без этой подсказки приложение
не начинает проверку личности, одной сессионной куки ему мало.

## Где журналы

- `infra/local/generated/one/run/up.log` — журнал последнего подъёма: что
  собиралось, на каком шаге остановилось. Точный путь к журналу последней
  задачи записан в `infra/local/generated/one/run/job.json` в поле `log`.
- `infra/local/generated/one/run/frontend.log` — журнал Vite. Рядом
  `frontend.pid`: если процесса с этим номером нет, Vite не работает, а сайт
  всё равно отдаётся из собранного набора в прокси.
- Служба: `docker logs --tail 200 rox-one-email_service-1` (имя контейнера
  берётся из `docker ps --filter name=rox-one-`).
- Прокси: `docker logs --tail 200 rox-one-proxy-1`. Здесь видно, куда ушёл
  запрос и почему получился `502`.
- Через средство запуска: `just run_local logs --service frontend --follow` —
  хвост журнала Vite; `just run_local logs --service email_service --follow` —
  журнал службы через compose; `just run_local logs` без службы — журнал
  последней задачи.

Две частые картины на этом стенде. В `up.log` строка вида
`binaries dir …/target/linux-out-roxd is missing: gmail_emulator,
outlook_emulator` означает, что подъём остановился на проверке двоичных
файлов: их собирает `cargo x build-services`. В `frontend.log` строка
`ERR_SERVER_ALREADY_LISTEN` означает, что Vite пытались поднять дважды:
сайт при этом живёт на собранном наборе, а живой пересборки нет, и
`just run_local restart-frontend` поднимает её заново.

## Три проверки после любой правки

1. Стенд поднят и службы отвечают:

```bash
docker ps --filter name=rox-one- --format '{{.Names}}\t{{.Status}}'
for p in 24211 24212 24213 24215 24216 24217; do
  printf '%s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:$p/health"
done
curl -sk -o /dev/null -w '%{http_code}\n' https://localhost:24209/app/
```

Семь `200` подряд — норма. Любой другой код называет службу или адрес,
которые правка сломала.

2. Вход по коду проходит целиком, то есть работают аутентификация, почта,
   FusionAuth и прокси разом. Повторить три шага из раздела «Как войти по
   коду» и убедиться, что третий шаг вернул `access_token`, а в заголовках
   есть `Set-Cookie`.

3. Старое имя не вернулось. Из корня дерева переименования:

```bash
cd /Users/t/Projects/macro/wt-rebrand-code
bash scripts/check-old-brand.sh
```

Код возврата `0` — остатков нет. Скрипт печатает найденные места и завершает
работу с ненулевым кодом, если старое имя попало в код, SQL или имя файла.
Одно место печатается всегда, пока живёт подмена имени поля в
`crates/rox_auth/src/middleware/decode_jwt.rs` (`macro_user_id` и
`root_macro_id`): это известный остаток для старых токенов, а не новая утечка.
