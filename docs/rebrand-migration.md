# Переименование Macro в Rox: что изменилось и как откатиться

Журнал переименования для того, кто выкладывает и откатывает сборку.
Записи проверены на ветке `rebrand/rox-identifiers` рабочего дерева
`/Users/t/Projects/macro/wt-rebrand-code` и на живом стенде
(проект контейнеров `rox-one`, 23 ноября 2026). Старое имя в коде, SQL и
именах файлов ловит гейт `scripts/check-old-brand.sh`; запускать его из
корня этого дерева.

Секретов здесь нет и быть не должно: ни паролей, ни ключей, ни кусков токенов.

## Что переименовано

### Идентификатор пользователя

Было `macro|you@example.com`, стало `rox|you@example.com`. Новые значения
всегда с префиксом `rox` (константа `ROX_PREFIX` в
`crates/rox_user_id/src/user_id.rs`), а прежние значения в базе переносит
миграция
`crates/rox_db_client/migrations/20261122193000_rename_user_id_prefix.sql`.
Она переписывает только значения, которые целиком являются одним
идентификатором, снимает и восстанавливает внешние ключи, а неизменяемые
журналы `enterprise_audit` и `slack_import_job` оставляет как есть.
Строгий порядок `user1 < user2` в `contacts_connections` держится тем, что обе
колонки переписываются одним оператором.

Разбор принимает оба префикса: `RoxUserIdStr::parse_from_str` читает и
`macro|…`, и `rox|…`. Поэтому идентификатор, выданный до переименования,
продолжает разбираться, а сессии, выпущенные до переключения, не обрываются;
вход заново нужен только там, где сменилось имя куки, и после выхода, который
гасит старые куки.

Отображаемые имена системных ботов переводит отдельная миграция
`crates/rox_db_client/migrations/20261118000000_rebrand_system_bot_names.sql`;
адрес `@macro` при этом остаётся рабочим.

### Куки сессии

`macro-access-token` и `macro-refresh-token` стали `rox-access-token` и
`rox-refresh-token`; вне продажи к имени добавляется `dev-` или `local-`
(`crates/rox_auth/src/constant.rs`). Старые имена сервер продолжает читать
вторым вариантом (`access_token_cookie_names()[1]`), а
`services/authentication_service/src/api/utils.rs`
(`expired_legacy_session_cookies`) гасит их при выходе и повороте сессии:
иначе браузер продолжал бы предъявлять отменённую сессию.

Прокси стенда хранит куки браузера в своём пространстве `rox-<instance>--`
(`tooling/xtask/crates/xtask_local/src/local/proxy.rs`). Прежнее пространство
`macro-<instance>--` новый прокси не читает и отбрасывает. Куки, оставшиеся в
браузере от прежней сборки, поэтому не продлевают вход: нужен новый.

Привязка браузера для MCP живёт в куке `__Host-rox_mcp_oauth`
(`services/mcp_auth_proxy/src/inbound/axum_router.rs`); прокси стенда
дописывает перед ней приставку экземпляра.

### Глубокие ссылки

Схема `macro://` стала `rox://`. Обратный адрес настольного входа задан в
`apps/web/src/lib/core/auth/native-auth.ts` (`rox:///login`), мобильный
возврат — там же (`rox://android-auth/<id>`). Схемы объявлены в
`apps/web/tauri/src-tauri/tauri.conf.json`,
`apps/web/tauri/desktop-cef/tauri.conf.json`,
`apps/web/tauri/src-tauri/Info.ios.plist` и
`apps/web/tauri/android_auth_plugin/android/src/main/AndroidManifest.xml`.
Старая схема `macro` остаётся зарегистрированной рядом с новой, чтобы старые
ссылки из писем и чатов продолжали открывать приложение.

### Ключи API и ключи репозиториев

Новый ключ API начинается с `rox-key-` перед самим JWT: константа
`API_TOKEN_PREFIX` и снятие приставки `strip_api_token_prefix` в
`crates/rox_auth/src/rox_api_token.rs`. Приставку код снимает, поэтому ключ без
неё тоже проходит проверку. Но ключ, выданный до переименования, несёт поле
`macro_user_id`, а код читает `rox_user_id`, и подмены имени нет — такой ключ
нужно перевыпустить.

Ключ git по HTTP был `mrt_` плюс 64 шестнадцатеричных знака, стал `rox_` плюс
столько же (`crates/agent_credentials/src/repo_token.rs`). Старый ключ
проверку не проходит: его нужно перевыпустить.

Внутренний заголовок вызова `x-macro-internal-call` стал
`x-rox-internal-call`; старый принимается на чтение, чтобы работник
расшифровки, выпущенный до переименования, продолжал доходить
(`crates/call/src/inbound/axum_router.rs`).

### База данных

Имя локальной базы `macrodb` стало `roxdb`: строка подключения собирается в
`tooling/xtask/crates/xtask_local/src/local/db.rs`, и в живом контейнере
`rox-one-postgres-1` база называется `roxdb` — это видно командой
`docker exec rox-one-postgres-1 psql -U user -l`. Переименование базы не
переносит данные: значения в ней меняет миграция выше, поэтому имя базы и
содержимое расходятся независимо.

Две заготовки называют базу по-своему: `docker/docker-compose.local-e2e.yml`
подключается к `macrodb`, а `docker/Dockerfile.dev.sqlx` — к `roxdb_rebrand`
(третье имя, только для сборки метаданных sqlx).

### Образы контейнеров

Локальные образы `macro-local-*` стали `rox-local-*`: `rox-local-rust-services:dev`
и `rox-local-headless-chrome:dev` в `docker/docker-compose.yml`; образ времени
выполнения собирается как `rox-local-runtime:<ключ>` и помечается меткой
`com.rox.local-runtime-key`
(`tooling/xtask/crates/xtask_local/src/local/build/runtime_image.rs`).

На этом Маке рядом лежат старые теги `macro-local-runtime:dev`,
`macro-local-opensearch:*`, `macro-local-lexical-service:*`,
`macro-sdk-webhook-relay:*` и образы прежнего проекта `macro-rox-*`. Живой
проект `rox-one` их не использует, но и не удаляет: они и есть запасной путь
отката.

### Прочее

- Класс подписи в письме: разметка Rox ставит `rox-email-signature`
  (`crates/email/src/domain/service/signature.rs`), а разборщик принимает и
  старый `macro-email-signature` (`packages/email-renderer/src/core/html.ts`).
- Гейт старого имени: `scripts/check-old-brand.sh`. Rust-слово `macro_rules`
  и подобное он пропускает, настоящие остатки печатает и завершает работу
  с ненулевым кодом.

## Что осталось под старым именем намеренно

- Схема глубоких ссылок `macro` — чтобы старые ссылки открывались.
- Префикс `macro|` в разборе идентификатора и имена полей-подмен
  `macro_user_id` и `root_macro_id` в токенах — чтобы жили сессии и ключи,
  выданные до переименования.
- Куки `macro-access-token` и `macro-refresh-token` — читаются, но не
  выдаются; гасятся при выходе.
- Заголовок `x-macro-internal-call` — читается на время выкладки.
- Класс `macro-email-signature` — читается в письмах, написанных раньше.
- Адрес бота `@macro` — по нему люди пишут в бота, менять его нельзя.
- Образы компьютеров `macro-box:latest` и `macro-box-agent:latest` — их
  подставляет окружение стенда `infra/local/generated/rox/local.generated.env`
  в рабочем дереве `wt-integration`.

## Что остаётся доделать

Лямбды FusionAuth, которые наполняют JWT, в этой ветке выдают поле
`rox_user_id` со значением `rox|<email>`
(`infra/stacks/fusionauth-instance/templates/populate_jwt.js` и
`populate_jwt_local.js`). Чтение токена принимает и прежнее имя поля: у
`RoxAccessToken` стоят `#[serde(alias = "macro_user_id")]` и
`#[serde(alias = "root_macro_id")]`
(`crates/rox_auth/src/middleware/decode_jwt.rs`), поэтому окно поломки между
новой сборкой и старой лямбдой закрыто.

Пункт закрывается, когда правленые лямбды применены на стенде и вход по коду
на стенде проходит. Пока лямбды не применены, стенд выдаёт `macro_user_id` с
`macro|`, и это тоже рабочий вариант.

Пока подмена имени поля живёт в коде, гейт `scripts/check-old-brand.sh`
печатает это место как остаток старого имени и завершается с ненулевым кодом:
это ожидаемо, пока он не научится пропускать строки-подмены.

## Что нужно для отката

Откат возвращает три вещи: данные, образы и исходники. Готовить его нужно
до выкладки, иначе возвращаться некуда: у миграции
`20261122193000_rename_user_id_prefix.sql` нет обратного файла.

### Копия базы

Снять копию до выкладки:

```bash
docker exec rox-one-postgres-1 pg_dump -U user -d roxdb -Fc \
  -f /tmp/roxdb-before-rebrand.dump
docker cp rox-one-postgres-1:/tmp/roxdb-before-rebrand.dump \
  ./roxdb-before-rebrand.dump
```

Копия несёт и таблицу `_sqlx_migrations`, то есть вместе с данными
возвращается и список применённых миграций. Вернуть её так:

```bash
docker cp ./roxdb-before-rebrand.dump rox-one-postgres-1:/tmp/restore.dump
docker exec rox-one-postgres-1 pg_restore -U user -d roxdb --clean --if-exists \
  /tmp/restore.dump
```

Перед восстановлением остановить службы, которые пишут в базу, иначе
`--clean` упрётся в занятые объекты.

### Тег образа

Сборка, которая работала до переименования, ссылается на `macro-local-*` в
своих файлах compose. Эти теги нельзя удалять, а если их перезапишет новая
сборка, старую сборку будет нечем поднять. Проверить, что они на месте:

```bash
docker image ls 'macro-local-*'
```

На этом Маке сейчас есть `macro-local-runtime:dev`,
`macro-local-opensearch:*`, `macro-local-lexical-service:*`,
`macro-local-sync-service:*` и `macro-sdk-webhook-relay:*`;
`macro-local-rust-services:dev` появится, только если её собирали. Существующий
образ закрепить отдельным именем, чтобы пересборка его не затёрла:

```bash
docker tag macro-local-runtime:dev macro-local-runtime:pre-rebrand
```

Если тег уже удалён, вернуть его можно только сборкой прежнего исходника, а не
переименованием текущего образа.

### Откат исходников

Переименование начинается для этой ветки с коммита
`2d5c69aafa5b45dd4291c1218c4934d451c1f0e0` — это голова `main`, от которой
ветка пошла своим первым коммитом `d63e2cf141 feat: rebrand product display as
Rox`. Текущее дерево не сбрасывать: сборку отката поднять отдельным рабочим
деревом, чтобы не потерять несохранённую работу и не тащить переименование в
сборку.

```bash
git -C /Users/t/Projects/macro/wt-rebrand-code rev-parse HEAD > /tmp/rox-rebrand-head
git -C /Users/t/Projects/macro/wt-rebrand-code worktree add \
  /Users/t/Projects/macro/wt-rebrand-rollback \
  2d5c69aafa5b45dd4291c1218c4934d451c1f0e0
cd /Users/t/Projects/macro/wt-rebrand-rollback
cargo x build-services
docker build -f docker/Dockerfile.dev --target services_bundle \
  -t macro-local-rust-services:dev .
```

Голова `main` не несёт ни переименования, ни работы предприятия, слитой после
него. Если нужна только отмена переименования, а работа предприятия остаётся,
дерево берётся не с `main`, а с последнего коммита перед первым коммитом
переименования в вашей ветке; точка отката записывается до выкладки.

Стенд запускает двоичные файлы из того каталога, который ему передали.
Пересобранные файлы подставляются явно:

```bash
cd /Users/t/Projects/macro/wt-integration
just run_local --instance one \
  --binaries-dir /Users/t/Projects/macro/wt-rebrand-rollback/target/linux-out-roxd
```

## Проверка после отката

Три проверки, каждая отвечает на свой вопрос.

1. Службы поднялись и живы:

```bash
docker ps --filter name=rox-one- --format '{{.Names}}\t{{.Status}}'
for p in 24211 24212 24213 24215 24216 24217; do
  printf '%s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:$p/health"
done
```

Шесть строк должны быть `200`, и сайт тоже:

```bash
curl -sk -o /dev/null -w '%{http_code}\n' https://localhost:24209/app/
```

2. База и код согласны по префиксу:

```bash
docker exec rox-one-postgres-1 psql -U user -d roxdb -Atc \
  "select split_part(id,'|',1), count(*) from \"User\" group by 1 order by 2 desc"
```

После откатившейся сборки ожидается одна строка `macro|`; после
переименованной — одна строка `rox|`. Смесь двух префиксов означает, что
данные и код разъехались: вернуть копию базы из раздела выше.

3. Вход по коду выдаёт то, что ждёт сборка:

```bash
EMAIL=runbook-check@example.com
curl -sk -X POST https://localhost:24209/auth/login/passwordless \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"redirect_uri\":\"https://localhost:24209/app/\",\"handle\":\"runbookcheck\"}"
CODE=$(curl -s http://localhost:24208/api/v1/message/latest \
  | jq -r '.Text' | grep -oE '[0-9]{6}' | head -1)
curl -sk "http://localhost:24211/oauth/passwordless/$CODE?email=$EMAIL&disable_redirect=true" \
  | jq -r '.access_token' | cut -d. -f2 \
  | tr '_-' '/+' \
  | awk '{n=length($0)%4; if(n>0) printf "%s%s\n", $0, substr("==",1,4-n); else print}' \
  | base64 -d 2>/dev/null \
  | jq -r '.macro_user_id // .rox_user_id'
```

Печатается префикс, который сейчас стоит в базе и в лямбде: после полного
отката это `macro|`, после переименования — `rox|`. Если префикс расходится с
результатом проверки 2, сборка и данные разъехались. Не `200` на третьем шаге
— смотреть журнал `docker logs --tail 200 rox-one-authentication-service-1`.

Гейт `scripts/check-old-brand.sh` после отката намеренно падает: старые имена
вернулись вместе с исходниками. Как проверку отката его не использовать.
