#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const logger = require('./logger');
const { openBudget, closeBudget, parseBool } = require('./utils');
const { EventBus } = require('./events');
const { Scanner } = require('./scanner');
const { compileFilter } = require('./filter');
const { originAllowed, authorizeHeader } = require('./security');

// compileFilter imported from ./filter for testability without requiring express/ws

async function startServer({
  port = parseInt(process.env.PORT || process.env.port || '4000', 10),
  lookbackDays = parseInt(process.env.LOOKBACK_DAYS || '60', 10),
  scanIntervalMs = parseInt(process.env.SCAN_INTERVAL_MS || '15000', 10),
  skipBudget = false,
} = {}) {
  const app = express();

  if (!skipBudget) {
    await openBudget();
  }

  const bus = new EventBus(1000);
  const scanner = new Scanner(bus, { lookbackDays });

  // CORS & auth
  const allowed = (process.env.CORS_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const corsOptions = {
    origin: function (origin, cb) {
      if (!origin) return cb(null, true);
      if (allowed.includes('*') || allowed.includes(origin))
        return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: false,
  };
  app.use(cors(corsOptions));

  const requireAuth = (req, res, next) => {
    const token = process.env.AUTH_TOKEN;
    if (!token) return next();
    if (authorizeHeader(req.headers['authorization'] || '', token))
      return next();
    res.status(401).json({ error: 'Unauthorized' });
  };

  app.get('/healthz', (req, res) => {
    res.json({ ok: true });
  });

  app.get('/events', requireAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const lastId = req.header('Last-Event-ID') || undefined;
    try {
      const filter = compileFilter(
        {
          entities: req.query.entities,
          events: req.query.events,
          accounts: req.query.accounts,
          payees: req.query.payees,
          categories: req.query.categories,
          categoryGroups: req.query.categoryGroups,
          rules: req.query.rules,
          useRegex: parseBool(req.query.useRegex),
        },
        { strictRegex: true },
      );
      bus.addClient(res, lastId, filter);
    } catch (e) {
      res.status(400).json({ error: e?.message || 'Invalid filters' });
    }
  });

  app.post('/nudge', requireAuth, express.json(), async (req, res) => {
    await scanner.scanOnce();
    res.json({ ok: true });
  });

  const server = http.createServer(app);
  // WebSocket support at /ws
  const wss = new WebSocketServer({ noServer: true });
  const wsClients = new Set(); // { ws, filter }

  server.on('upgrade', (req, socket, head) => {
    const { url, headers } = req;
    if (!url || !url.startsWith('/ws')) {
      socket.destroy();
      return;
    }
    if (!originAllowed(allowed, headers.origin)) {
      socket.destroy();
      return;
    }
    const expected = process.env.AUTH_TOKEN;
    if (expected) {
      if (!authorizeHeader(headers['authorization'] || '', expected)) {
        socket.destroy();
        return;
      }
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws, req) => {
    // Parse filters from query string
    let filter = () => true;
    try {
      const u = new URL(req.url, 'http://localhost');
      filter = compileFilter(
        {
          entities: u.searchParams.get('entities') || undefined,
          events: u.searchParams.get('events') || undefined,
          accounts: u.searchParams.get('accounts') || undefined,
          payees: u.searchParams.get('payees') || undefined,
          categories: u.searchParams.get('categories') || undefined,
          categoryGroups: u.searchParams.get('categoryGroups') || undefined,
          rules: u.searchParams.get('rules') || undefined,
          useRegex: parseBool(u.searchParams.get('useRegex')),
        },
        { strictRegex: true },
      );
    } catch (e) {
      try {
        ws.send(
          JSON.stringify({
            type: 'error',
            error: e?.message || 'Invalid filters',
          }),
        );
      } catch (err) {
        /* ignore */ void 0;
      }
      ws.close(1008, 'Invalid filters');
      return;
    }
    const client = { ws, filter };
    wsClients.add(client);
    // Optional: replay recent buffer
    try {
      for (const ev of bus.buffer) {
        if (client.filter(ev)) ws.send(JSON.stringify(ev));
      }
    } catch (e) {
      /* ignore */ void 0;
    }
    ws.on('message', (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data && (data.type === 'filter' || data.type === 'subscribe')) {
          try {
            client.filter = compileFilter(
              {
                entities: data.entities,
                events: data.events,
                accounts: data.accounts,
                payees: data.payees,
                categories: data.categories,
                categoryGroups: data.categoryGroups,
                rules: data.rules,
                useRegex: parseBool(data.useRegex),
              },
              { strictRegex: true },
            );
            ws.send(JSON.stringify({ type: 'filter.ack', ok: true }));
          } catch (e) {
            ws.send(
              JSON.stringify({
                type: 'filter.ack',
                ok: false,
                error: e?.message || 'Invalid filters',
              }),
            );
          }
        } else if (data && data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        }
      } catch (e) {
        /* ignore */ void 0;
      }
    });
    ws.on('close', () => wsClients.delete(client));
  });

  // Broadcast events to WS as well
  bus.addSink((ev) => {
    const data = JSON.stringify(ev);
    for (const client of wsClients) {
      try {
        if (client.filter(ev) && client.ws.readyState === 1)
          client.ws.send(data);
      } catch (e) {
        /* ignore */ void 0;
      }
    }
  });

  server.listen(port, () => {
    logger.info(`actual-events listening on :${port}`);
  });

  // Start periodic scanning
  let timer = null;
  if (scanIntervalMs > 0) {
    timer = setInterval(
      () => {
        scanner.scanOnce();
      },
      Math.max(1000, scanIntervalMs),
    );
  }

  const shutdown = async (sig) => {
    logger.info(`received ${sig}, shutting down`);
    if (timer) clearInterval(timer);
    server.close(() => logger.info('HTTP server closed'));
    if (!skipBudget) await closeBudget();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return { server, wss, shutdown: () => shutdown('TEST') };
}

async function main() {
  const argv = process.argv.slice(2);
  const has = (flag) => argv.includes(flag);
  const get = (flag) => {
    const i = argv.indexOf(flag);
    if (i !== -1 && i + 1 < argv.length) return argv[i + 1];
    return undefined;
  };

  const daemonize =
    has('--daemonize') || /^true$/i.test(process.env.DAEMONIZE || '');
  const isChild = has('--child');
  // Allow overriding scan interval via CLI
  const scanArg = get('--scan-interval-ms');
  if (scanArg) process.env.SCAN_INTERVAL_MS = scanArg;

  if (daemonize && !isChild) {
    const logFile = get('--log-file') || process.env.LOG_FILE;
    let out = 'ignore';
    let err = 'ignore';
    try {
      if (logFile) {
        const abs = path.isAbsolute(logFile)
          ? logFile
          : path.join(process.cwd(), logFile);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        const fd = fs.openSync(abs, 'a');
        out = fd;
        err = fd;
      }
    } catch (e) {
      // fall back to ignoring output
    }
    const childArgs = argv.filter((a) => a !== '--daemonize');
    childArgs.push('--child');
    const child = spawn(process.execPath, [__filename, ...childArgs], {
      detached: true,
      stdio: ['ignore', out, err],
      env: process.env,
    });
    child.unref();
    // Child will write pid-file after successful start; parent exits
    process.exit(0);
  }

  // In foreground (or child process), start normally
  await startServer();

  // If running as daemon child, write pid file after server starts
  if (isChild) {
    const pidFile = get('--pid-file') || process.env.PID_FILE;
    if (pidFile) {
      try {
        const abs = path.isAbsolute(pidFile)
          ? pidFile
          : path.join(process.cwd(), pidFile);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, String(process.pid));
      } catch (e) {
        // ignore pid write errors
      }
    }
  }
}

if (require.main === module) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  });
}

module.exports = { main, startServer };
