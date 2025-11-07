# actual-events

Stream Actual Budget changes over Server-Sent Events (SSE) and WebSockets by diffing consecutive syncs. Downstream services can subscribe for near real-time updates without polling.

## Features

- `/events` SSE endpoint with resumable `Last-Event-ID` and rich filtering.
- `/ws` WebSocket endpoint for bidirectional filter updates and ping/pong keepalive.
- Optional `/nudge` endpoint to trigger an immediate scan.
- Docker image with built-in health check and persistent budget cache volume.

## Requirements

- Node.js ≥ 22.
- Actual Budget server credentials (`ACTUAL_SERVER_URL`, `ACTUAL_PASSWORD`, `ACTUAL_SYNC_ID`).
- Suitable lookback window (`LOOKBACK_DAYS`) for your dataset and import cadence.

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

Published images live at `ghcr.io/rjlee/actual-events:<tag>` (see [Image tags](#image-tags)).

## Configuration

- `.env` – primary configuration, copy from `.env.example`.
- `config.yaml` / `config.yml` / `config.json` – optional defaults, copy from `config.example.yaml`.

Precedence: CLI flags > environment variables > config file.

| Setting             | Description                                       | Default         |
| ------------------- | ------------------------------------------------- | --------------- |
| `BUDGET_DIR`        | Budget cache directory                            | `./data/budget` |
| `LOOKBACK_DAYS`     | Historical window to diff for changes             | `60`            |
| `SCAN_INTERVAL_MS`  | Periodic scan interval in milliseconds            | `15000`         |
| `HTTP_PORT`         | HTTP listen port                                  | `3000`          |
| `LOG_LEVEL`         | Pino log level                                    | `info`          |
| `EVENTS_AUTH_TOKEN` | Bearer token required for SSE/WS/nudge endpoints  | unset           |
| `CORS_ORIGINS`      | Comma-separated CORS allowlist (`*` to allow all) | `*`             |

## Usage

### CLI modes

- Foreground server: `npm start`
- Daemonised server: `npm start -- --daemonize --pid-file ./data/events.pid --log-file ./data/events.log`

### Endpoints

- `GET /events` – SSE stream with filters (`entities`, `events`, `accounts`, `payees`, `categories`, `categoryGroups`, `rules`) and optional `useRegex=true`.
- `GET /ws` – WebSocket stream; send `{ "type": "filter", ... }` to update subscriptions.
- `POST /nudge` – Trigger an immediate diff scan (requires auth when `EVENTS_AUTH_TOKEN` set).

See [`EVENTS.md`](EVENTS.md) for payload reference.

### Docker

```bash
docker run --rm --env-file .env \
  -p 4000:3000 \
  -v "$(pwd)/data:/app/data" \
  ghcr.io/rjlee/actual-events:latest
```

## Testing & linting

```bash
npm test
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

## Image tags

- `ghcr.io/rjlee/actual-events:<semver>` – pinned to a specific `@actual-app/api` release.
- `ghcr.io/rjlee/actual-events:latest` – highest supported API version.

See [rjlee/actual-auto-ci](https://github.com/rjlee/actual-auto-ci) for tagging policy and release automation.

## License

MIT © contributors.
