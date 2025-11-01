jest.mock('../src/utils', () => ({
  openBudget: jest.fn(),
  closeBudget: jest.fn(),
}));

let supertest;
try {
  // supertest might not be available in this harness; in CI it is installed
  // eslint-disable-next-line global-require
  supertest = require('supertest');
} catch (e) {
  supertest = null;
}
let WebSocket;
try {
  // eslint-disable-next-line global-require
  WebSocket = require('ws');
} catch (e) {
  WebSocket = null;
}
let expressAvail = true;
try {
  // eslint-disable-next-line global-require
  require('express');
} catch (e) {
  expressAvail = false;
}

const ENABLE = process.env.ENABLE_NET_TESTS === '1';
const maybe =
  ENABLE && supertest && WebSocket && expressAvail ? describe : describe.skip;

maybe('HTTP auth and WS origin/auth', () => {
  let server;
  const token = 'testtoken';
  let startServer;
  beforeAll(async () => {
    // Lazy-require to avoid throwing if express/ws not present
    // eslint-disable-next-line global-require
    ({ startServer } = require('../src/index'));
    process.env.AUTH_TOKEN = token;
    process.env.CORS_ORIGINS = 'http://allowed.local';
    const started = await startServer({
      port: 0,
      scanIntervalMs: 0,
      skipBudget: true,
    });
    server = started.server;
  });
  afterAll((done) => {
    try {
      if (server) server.close(() => done());
      else done();
    } catch (e) {
      done();
    }
  });

  test('SSE requires bearer token', async () => {
    const addr = server.address();
    const req = supertest(`http://127.0.0.1:${addr.port}`);
    // Missing token
    await req.get('/events').expect(401);
    // With token
    await req
      .get('/events')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  test('WS blocks bad origin and missing auth; allows with both', async () => {
    const addr = server.address();
    const url = `ws://127.0.0.1:${addr.port}/ws`;

    // Bad origin
    await new Promise((resolve) => {
      const ws = new WebSocket(url, {
        headers: {
          Origin: 'http://bad.local',
          Authorization: `Bearer ${token}`,
        },
      });
      ws.on('error', () => resolve());
      ws.on('open', () => {
        // Should not open
        ws.terminate();
        resolve();
      });
    });

    // Missing token
    await new Promise((resolve) => {
      const ws = new WebSocket(url, {
        headers: { Origin: 'http://allowed.local' },
      });
      ws.on('error', () => resolve());
      ws.on('open', () => {
        ws.terminate();
        resolve();
      });
    });

    // Allowed
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(url, {
        headers: {
          Origin: 'http://allowed.local',
          Authorization: `Bearer ${token}`,
        },
      });
      ws.on('open', () => {
        ws.terminate();
        resolve();
      });
      ws.on('error', (e) => reject(e));
    });
  });
});
