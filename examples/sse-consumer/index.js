require('dotenv').config();
const EventSource = require('eventsource');

const HOST = process.env.EVENTS_HOST || 'http://localhost:4000';
const TOKEN = process.env.EVENTS_AUTH_TOKEN; // optional
const ENTITIES = process.env.ENTITIES; // e.g. 'transaction,account'
const EVENTS = process.env.EVENTS; // e.g. '^transaction\\.' (works only if server-side useRegex=true)
const ACCOUNTS = process.env.ACCOUNTS; // comma-separated account ids
const USE_REGEX = process.env.USE_REGEX === 'true' ? 'true' : undefined;

const params = new URLSearchParams();
if (ENTITIES) params.set('entities', ENTITIES);
if (EVENTS) params.set('events', EVENTS);
if (ACCOUNTS) params.set('accounts', ACCOUNTS);
if (USE_REGEX) params.set('useRegex', USE_REGEX);

const url = `${HOST}/events${params.toString() ? '?' + params.toString() : ''}`;
const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

console.log('Connecting to SSE:', url);
const es = new EventSource(url, { headers });

es.onopen = () => console.log('SSE connected');
es.onerror = (err) => console.error('SSE error', err);
es.onmessage = (msg) => {
  try {
    const ev = JSON.parse(msg.data);
    console.log(`[${ev.type}]`, ev);
  } catch (e) {
    console.log('raw:', msg.data);
  }
};
