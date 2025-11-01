require('dotenv').config();
const WebSocket = require('ws');

const HOST = process.env.EVENTS_HOST || 'http://localhost:4000';
const TOKEN = process.env.AUTH_TOKEN; // optional

// Optional initial query filters
const ENTITIES = process.env.ENTITIES; // e.g. 'transaction,account'
const EVENTS = process.env.EVENTS; // e.g. '^transaction\\.' if USE_REGEX=true on server
const ACCOUNTS = process.env.ACCOUNTS; // e.g. 'acc_1,acc_2'
const PAYEES = process.env.PAYEES;
const CATEGORIES = process.env.CATEGORIES;
const CATEGORY_GROUPS = process.env.CATEGORY_GROUPS;
const RULES = process.env.RULES;
const USE_REGEX = process.env.USE_REGEX === 'true';

const params = new URLSearchParams();
if (ENTITIES) params.set('entities', ENTITIES);
if (EVENTS) params.set('events', EVENTS);
if (ACCOUNTS) params.set('accounts', ACCOUNTS);
if (PAYEES) params.set('payees', PAYEES);
if (CATEGORIES) params.set('categories', CATEGORIES);
if (CATEGORY_GROUPS) params.set('categoryGroups', CATEGORY_GROUPS);
if (RULES) params.set('rules', RULES);
if (USE_REGEX) params.set('useRegex', 'true');

const wsUrl =
  HOST.replace(/^http/, 'ws') +
  `/ws${params.toString() ? '?' + params.toString() : ''}`;
const headers = {};
if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
// Optional: if your server checks Origin, set it to an allowed value
if (process.env.ORIGIN) headers['Origin'] = process.env.ORIGIN;

console.log('Connecting WS:', wsUrl);
const ws = new WebSocket(wsUrl, { headers });

ws.on('open', () => {
  console.log('WS connected');
  // Example: send a ping every 30s
  setInterval(() => {
    try {
      ws.send(JSON.stringify({ type: 'ping' }));
    } catch (e) {
      // Ignore transient send errors (e.g., socket not ready)
      // but surface in debug logs for troubleshooting.
      // Use console.debug to avoid noisy output in normal runs.
      console.debug('WS ping send failed:', e && e.message ? e.message : e);
    }
  }, 30000);
  // Example: update filters at runtime from env UPDATE_* variables
  if (
    process.env.UPDATE_ENTITIES ||
    process.env.UPDATE_EVENTS ||
    process.env.UPDATE_ACCOUNTS ||
    process.env.UPDATE_PAYEES ||
    process.env.UPDATE_CATEGORIES ||
    process.env.UPDATE_CATEGORY_GROUPS ||
    process.env.UPDATE_RULES
  ) {
    const msg = {
      type: 'filter',
      entities: process.env.UPDATE_ENTITIES,
      events: process.env.UPDATE_EVENTS,
      accounts: process.env.UPDATE_ACCOUNTS,
      payees: process.env.UPDATE_PAYEES,
      categories: process.env.UPDATE_CATEGORIES,
      categoryGroups: process.env.UPDATE_CATEGORY_GROUPS,
      rules: process.env.UPDATE_RULES,
      useRegex: process.env.UPDATE_USE_REGEX === 'true',
    };
    console.log('Sending runtime filter update:', msg);
    ws.send(JSON.stringify(msg));
  }
});

ws.on('message', (data) => {
  try {
    const ev = JSON.parse(String(data));
    console.log(`[${ev.type}]`, ev);
  } catch (e) {
    console.log('raw:', String(data));
  }
});

ws.on('error', (err) => {
  console.error('WS error', err.message || err);
});

ws.on('close', (code) => {
  console.log('WS closed', code);
});
