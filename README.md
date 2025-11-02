# Actual Events

Exposes Actual Budget change events over Server‑Sent Events (SSE) by periodically syncing and diffing accounts and recent transactions.

Endpoints

- GET /events: SSE stream (with CORS + optional Bearer auth). Supports Last-Event-ID to replay recent events.
  - Optional query filters (comma-separated lists unless noted): `entities`, `events`, `accounts`, `payees`, `categories`, `categoryGroups`, `rules`, and `useRegex` (boolean).
    - entities: transaction, account, payee, category, categoryGroup, rule, sync, scan
    - events: (e.g.) transaction.created, account.updated, transfer.linked
    - accounts: account ids (filters transactions by `account` and accounts by `id`)
    - payees: payee ids
    - categories: category ids
    - categoryGroups: category group ids
    - rules: rule ids
    - useRegex: if true, interpret `entities` and `events` as regular expressions (comma-separated patterns). Accepted values: true/1/yes/on and false/0/no/off (case-insensitive). Invalid regex patterns return HTTP 400 with an error message.
- WebSocket: ws://host:PORT/ws?entities=...&events=...&accounts=... (same auth via Authorization: Bearer <token>, Origin checked against CORS allowlist)
  - Same filters as SSE, including `useRegex` with the same boolean values and strict regex validation.
  - Runtime updates: send a JSON message to update filters
    - { "type": "filter", "entities": "transaction,account", "events": "transaction.updated", "accounts": "acc_1,acc_2", "useRegex": false }
    - Acks: { "type": "filter.ack", "ok": true } on success; { "type": "filter.ack", "ok": false, "error": "..." } on invalid filters (e.g., bad regex).
  - If the initial WS query contains an invalid regex, the server sends { "type": "error", "error": "..." } and closes the connection.
    - Ping/pong: send { "type": "ping" } and receive { "type": "pong", ts }
- GET /healthz: liveness check.
- POST /nudge (optional): triggers an immediate scan.

Event types

- Accounts:
  - account.created, account.updated, account.deleted
  - account.closed, account.reopened (specialized updates on `closed` flag)
- Transactions (within LOOKBACK_DAYS window):
  - transaction.created, transaction.updated, transaction.deleted
  - transaction.cleared, transaction.uncleared (cleared flag flips)
  - transaction.reconciled, transaction.unreconciled (reconciled flag flips)
  - transfer.linked, transfer.unlinked, transfer.updated (transfer_id changes)
- Payees:
  - payee.created, payee.updated, payee.deleted
- Categories & Groups:
  - category.created, category.updated, category.deleted
  - categoryGroup.created, categoryGroup.updated, categoryGroup.deleted
- Rules:
  - rule.created, rule.updated, rule.deleted
- Sync/system:
  - sync.started, sync.completed, sync.failed (per scan cycle)
  - scan.noop (no changes in a cycle)

Event schema

- id: monotonically increasing integer as string.
- type: transaction.created|updated|deleted, account.created|updated|deleted
- entity: transaction|account
- before: previous snapshot (omitted on created)
- after: new snapshot (omitted on deleted)
- meta: { detectedAt }

Config

- ACTUAL_SERVER_URL, ACTUAL_PASSWORD, ACTUAL_SYNC_ID, ACTUAL_BUDGET_ENCRYPTION_PASSWORD (optional)
- BUDGET_DIR: where to cache the budget locally (default ./data/budget)
- LOOKBACK_DAYS: transaction window to scan (default 60)
- SCAN_INTERVAL_MS: scan interval in ms (default 15000)
- PORT: HTTP port (default 4000)
- LOG_LEVEL: error|warn|info|debug (default info)
- AUTH_TOKEN: optional Bearer token required for /events, /nudge, and WS (omit to disable auth)
- CORS_ORIGINS: comma-separated origins allowlist for CORS and WS Origin checks (use \* to allow any)

Run

- npm install
- cp .env.example .env and fill values
- npm start

Quick example (Node SSE client)

```sh
node -e "const EventSource=require('eventsource');const es=new EventSource('http://localhost:4000/events');es.onmessage=msg=>console.log(msg.data)"
```

For more complete usage (auth, filters, reconnect), see the example app in `examples/sse-consumer`.

Event Reference

See `EVENTS.md` for a complete description of all event types, payloads, and server-side filters.

Daemon mode (background)

- Start without external tools:
  - node src/index.js --daemonize --pid-file ./data/events.pid --log-file ./data/events.log
  - Writes the child PID to `./data/events.pid` and logs to `./data/events.log`.
- Stop:
  - kill "$(cat ./data/events.pid)"
- Optional flags/env:
  - `--scan-interval-ms <ms>`: override scan interval. Set to `0` to disable the periodic timer (use POST `/nudge` to trigger scans).
  - `--pid-file <path>` or `PID_FILE` env: path for the daemon PID (default: none).
  - `--log-file <path>` or `LOG_FILE` env: file for stdout/stderr when daemonized (default: ignored).
  - `DAEMONIZE=true` env can be used in place of `--daemonize`.

## Docker

- Pull latest image: `docker pull ghcr.io/rjlee/actual-events:latest`
- Run with env file:
  - `docker run --rm --env-file .env ghcr.io/rjlee/actual-events:latest`
- Persist cache data by mounting `./data` to `/app/data`
- Or via compose: `docker-compose up -d`

## API-Versioned Images

Actual Budget's server and `@actual-app/api` should be compatible. This project publishes API‑specific images so you can pick an image that matches your server:

- Exact pin: `ghcr.io/rjlee/actual-events:api-25.2.1`
- Minor alias: `ghcr.io/rjlee/actual-events:api-25.2`
- Major alias: `ghcr.io/rjlee/actual-events:api-25`

The Dockerfile accepts a build arg `ACTUAL_API_VERSION` and CI publishes images for the latest patch of the last two API majors (stable only, no nightly/rc/edge). Each build also publishes rolling aliases for the minor and major lines. Images include labels:

- `io.actual.api.version` — the `@actual-app/api` version
- `org.opencontainers.image.revision` — git SHA
- `org.opencontainers.image.version` — app version

### Examples

- Run with a specific API line: `docker run --rm --env-file .env ghcr.io/rjlee/actual-events:api-25`
- Pin exact API patch: `docker run --rm --env-file .env ghcr.io/rjlee/actual-events:api-25.2.1`

## Release Strategy

- **App releases (semantic‑release):**
  - Tags: `<app-version>`, `<major>.<minor>`, `<major>`, `latest`.
- **API matrix images (compatibility):**
  - Scope: latest patch of the last two stable `@actual-app/api` majors.
  - Tags per image: `api-<patch>`, `api-<minor>`, `api-<major>`.

## Choosing an Image Tag

- **You know your server’s API major (recommended):** use `api-<MAJOR>` (e.g. `api-25`).
- **You need a specific API patch:** use `api-<MAJOR.MINOR.PATCH>`.
- **Only care about the app release:** use `<app-version>` or `latest`.
