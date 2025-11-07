const logger = require('./logger');

class EventBus {
  constructor(maxBuffer = 1000) {
    // SSE clients: { res, filter }
    this.clients = new Set();
    this.buffer = [];
    this.nextId = 1;
    this.maxBuffer = maxBuffer;
    this.sinks = new Set();
  }

  addClient(res, lastEventId, filter = () => true) {
    // Replay if client sent Last-Event-ID
    if (lastEventId) {
      const since = parseInt(lastEventId, 10) || 0;
      for (const ev of this.buffer) {
        if (parseInt(ev.id, 10) > since) {
          try {
            if (filter(ev)) {
              res.write(`id: ${ev.id}\n`);
              res.write(`event: ${ev.type}\n`);
              res.write(`data: ${JSON.stringify(ev)}\n\n`);
            }
          } catch {
            /* ignore */
          }
        }
      }
    }
    const client = { res, filter };
    this.clients.add(client);
    res.on('close', () => {
      this.clients.delete(client);
    });
  }

  emit(type, payload) {
    const ev = {
      id: String(this.nextId++),
      type,
      ...payload,
      meta: { ...(payload?.meta || {}), detectedAt: new Date().toISOString() },
    };
    this.buffer.push(ev);
    if (this.buffer.length > this.maxBuffer) this.buffer.shift();
    for (const client of this.clients) {
      try {
        if (client.filter(ev)) {
          client.res.write(`id: ${ev.id}\n`);
          client.res.write(`event: ${ev.type}\n`);
          client.res.write(`data: ${JSON.stringify(ev)}\n\n`);
        }
      } catch {
        logger.debug('client write failed; dropping client');
        this.clients.delete(client);
      }
    }
    for (const fn of this.sinks) {
      try {
        fn(ev);
      } catch {
        /* ignore */
      }
    }
  }

  addSink(fn) {
    if (typeof fn === 'function') this.sinks.add(fn);
    return () => this.sinks.delete(fn);
  }
}

module.exports = { EventBus };
