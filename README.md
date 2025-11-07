# actual-events

Stream Actual Budget changes over Server-Sent Events (SSE) and WebSockets by diffing consecutive syncs. Downstream services (e.g., auto-reconcile, auto-categorise) can react instantly without polling.

## Features

- SSE endpoint (`/events`) with filterable event types and resumable `Last-Event-ID`.
- WebSocket endpoint (`/ws`) for duplex filter updates and ping/pong keepalive.
- Optional `/nudge` endpoint to trigger an immediate scan.
- Filters by entity, event type, account, payee, category, rule, with regex support.
- Docker image with health check and budget cache volume.

## Requirements

- Node.js ≥ 20.
- Actual Budget server + credentials.
- Lookback window (default 60 days) suitable for your dataset.

## Installation

```bash
git clone https://github.com/rjlee/actual-events.git
cd actual-events
npm install
```

Optional git hooks:

```bash
npm run prepare
```

### Docker quick start

```bash
cp .env.example .env
docker build -t actual-events .
mkdir -p data/budget
docker run -d --env-file .env \
  -p 4000:3000 \
  -v "$(pwd)/data:/app/data" \
  actual-events
```

Prebuilt images: `ghcr.io/rjlee/actual-events:<tag>`.

## Configuration

- `.env` – required credentials and server options (`ACTUAL_SERVER_URL`, `ACTUAL_PASSWORD`, `ACTUAL_SYNC_ID`, etc.).
- `config.yaml`/`config.json` – optional defaults (see `config.example.yaml`).

Precedence: CLI flags > environment variables > config file.

Common settings:

| Setting             | Description                            | Default         |
| ------------------- | -------------------------------------- | --------------- |
| `HTTP_PORT`         | HTTP port                              | `3000`          |
| `BUDGET_DIR`        | Local cache directory                  | `./data/budget` |
| `LOOKBACK_DAYS`     | Transaction diff window                | `60`            |
| `SCAN_INTERVAL_MS`  | Periodic scan interval                 | `15000`         |
| `EVENTS_AUTH_TOKEN` | Optional Bearer auth for all endpoints | unset           |
| `CORS_ORIGINS`      | Comma-separated allowlist, `*` allowed | `*`             |

## Usage

### Local run

```bash
npm start           # foreground
npm start -- --daemonize --pid-file ./data/events.pid --log-file ./data/events.log
```

When daemonised, stop via `kill "$(cat ./data/events.pid)"`.

### Endpoints

- `GET /events` – SSE stream. Supports comma-separated filters (`entities`, `events`, `accounts`, `payees`, `categories`, `categoryGroups`, `rules`) and `useRegex=true/false`.
- `GET /ws` – WebSocket stream with the same filters. Runtime filter updates use `{ "type": "filter", ... }`.
- `POST /nudge` – Trigger an on-demand scan (requires auth if enabled).

See [`EVENTS.md`](EVENTS.md) for event payload reference.

## Testing & linting

```bash
npm test
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

## Docker

```bash
# Latest image
docker pull ghcr.io/rjlee/actual-events:latest

# Run with env file
docker run --rm --env-file .env \
  -p 4000:3000 \
  -v "$(pwd)/data:/app/data" \
  ghcr.io/rjlee/actual-events:latest
```

## Image tags

- `ghcr.io/rjlee/actual-events:<semver>` – pinned to a specific Actual API version.
- `ghcr.io/rjlee/actual-events:latest` – newest supported release.

## Tips

- Use `SCAN_INTERVAL_MS=0` and rely solely on `/nudge` for on-demand sync triggers.
- Combine with Docker Compose and set `ACTUAL_IMAGE_TAG` to pin all services to matching API binaries.

## License

MIT © contributors.
