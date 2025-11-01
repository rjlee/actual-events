WS Consumer Example

Simple Node client that connects to the actual-events WebSocket endpoint and logs events. Supports initial filters via query string and runtime filter updates via a message.

Setup

- cd actual-events/examples/ws-consumer
- npm install
- Create a .env file with (adjust as needed):

```
EVENTS_HOST=http://localhost:4000
# If your server requires a bearer token
# AUTH_TOKEN=your-token
# If your server restricts Origin, set one that matches CORS_ORIGINS
# ORIGIN=http://localhost:3000

# Optional initial WS filters (comma-separated)
# ENTITIES=transaction,account
# EVENTS=^transaction\.
# ACCOUNTS=acc_123,acc_456
# PAYEES=
# CATEGORIES=
# CATEGORY_GROUPS=
# RULES=
# USE_REGEX=true

# Optional runtime filter update (sent after connect)
# UPDATE_ENTITIES=transaction
# UPDATE_EVENTS=transaction.updated
# UPDATE_ACCOUNTS=acc_123
# UPDATE_USE_REGEX=false
```

Run

- npm start

You should see events printed as they are detected. Use the UPDATE\_\* variables to change filters at runtime.
