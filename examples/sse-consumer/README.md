SSE Consumer Example

Simple Node client that connects to the actual-events SSE endpoint and logs events.

Setup

- cd actual-events/examples/sse-consumer
- npm install
- Create a .env file with (adjust as needed):

```
EVENTS_HOST=http://localhost:4000
# If your server requires a bearer token
# EVENTS_AUTH_TOKEN=your-token

# Optional filters
# ENTITIES=transaction,account
# EVENTS=^transaction\.
# ACCOUNTS=acc_123,acc_456
# USE_REGEX=true
```

Run

- npm start

You should see events printed as they are detected. Adjust filters to narrow down to entities/events/accounts of interest.
