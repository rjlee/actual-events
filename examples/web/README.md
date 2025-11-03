Web UI Example (React)

A minimal browser-based example that connects to actual-events via SSE or WebSocket and displays incoming events.

Notes

- If your server enforces EVENTS_AUTH_TOKEN (Bearer auth), browsers cannot send the Authorization header for SSE or WS directly.
  - For a quick demo, temporarily unset EVENTS_AUTH_TOKEN in the server .env, or
  - Front the server with a proxy that injects the header, or
  - Extend the server to accept a token via query string (not implemented by default for security).
- CORS: ensure your page origin is present in CORS_ORIGINS, or use `*`.

Run

- Open `index.html` directly in a browser, or serve it via a simple static server:
  - `npx serve .` (from this directory) or any other static file host.
- Set the Host and Filters, then click Connect SSE or Connect WS.
