Actual Events: Event Reference

This document describes the events emitted by the `actual-events` sidecar and the payloads you can expect over SSE and WebSocket.

Transport
- SSE endpoint: `GET /events`
- WebSocket endpoint: `ws://host:PORT/ws`
- Both transports deliver the same JSON event payloads.

Common Event Envelope
- `id` (string): monotonically increasing id within the process lifetime.
- `type` (string): the event type, e.g. `transaction.created`.
- `entity` (string): domain of the change, e.g. `transaction`, `account`.
- `before` (object, optional): previous snapshot (for `updated` and `deleted`).
- `after` (object, optional): new snapshot (for `created` and `updated`).
- `meta.detectedAt` (ISO string): when the change was detected.

Accounts
- `account.created`: `after` contains the account.
- `account.updated`: `before` and `after` contain the account.
- `account.deleted`: `before` contains the last known snapshot.
- `account.closed` / `account.reopened`: specialized updates when `closed` flips.

Minimal account fields you may see:
{
  "id": "acc_…",
  "name": "Current Account",
  "offbudget": false,
  "closed": false
}

Transactions (within LOOKBACK_DAYS window)
- `transaction.created`: `after` is the new transaction.
- `transaction.updated`: `before` and `after` provided.
- `transaction.deleted`: `before` contains last known transaction within the lookback window.
- `transaction.cleared` / `transaction.uncleared`: specialized updates when `cleared` flips.
- `transaction.reconciled` / `transaction.unreconciled`: specialized updates when `reconciled` flips.
- `transfer.linked` / `transfer.unlinked` / `transfer.updated`: specialized updates when `transfer_id` changes.

Selected transaction fields included in change detection:
{
  "id": "tx_…",
  "account": "acc_…",
  "amount": -123400,
  "date": "2025-10-10",
  "payee": "payee_…",
  "category": "cat_…",
  "cleared": true,
  "reconciled": false,
  "notes": "optional",
  "transfer_id": null,
  "is_child": false,
  "is_parent": false
}

Payees
- `payee.created`, `payee.updated`, `payee.deleted`

Minimal payee fields:
{ "id": "payee_…", "name": "Some Payee", "transfer_acct": null }

Categories & Groups
- `category.created`, `category.updated`, `category.deleted`
- `categoryGroup.created`, `categoryGroup.updated`, `categoryGroup.deleted`

Category fields:
{ "id": "cat_…", "name": "Groceries", "hidden": false, "group_id": "grp_…" }

CategoryGroup fields:
{ "id": "grp_…", "name": "Everyday", "hidden": false }

Rules
- `rule.created`, `rule.updated`, `rule.deleted`

Note: The exact shape of rules may evolve; the sidecar fingerprints core fields (`id`, `stage`, `conditions`, `actions`).

Sync/system
- `sync.started`, `sync.completed`, `sync.failed`
- `scan.noop`: emitted when a scan cycle finds no changes.

Filters
You can filter events server-side to reduce client load.

- SSE query params: `entities`, `events`, `accounts`, `payees`, `categories`, `categoryGroups`, `rules`, `useRegex`
  - Values are comma-separated lists. `useRegex=true` enables regex matching for `entities` and `events`.
- WebSocket query params: same as SSE.
- WebSocket runtime update: send a JSON message
{
  "type": "filter",
  "entities": "transaction,account",
  "events": "^transaction\\.",
  "accounts": "acc_1,acc_2",
  "useRegex": true
}

Notes
- Deletions are detected within the configured transaction lookback window.
- Payloads reflect the Actual API objects; additional fields may be present.
- The sidecar emits at-least-once. Use `id` to deduplicate if needed.

