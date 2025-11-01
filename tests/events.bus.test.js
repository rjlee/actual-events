const { EventBus } = require('../src/events');

function fakeRes() {
  const writes = [];
  return {
    writes,
    write: (s) => writes.push(s),
    on: () => {},
  };
}

test('EventBus emits to sinks and SSE clients with filter', () => {
  const bus = new EventBus(10);
  const seen = [];
  bus.addSink((ev) => seen.push(ev));

  const res = fakeRes();
  const filter = (ev) => ev.entity === 'transaction';
  bus.addClient(res, undefined, filter);

  bus.emit('transaction.created', {
    entity: 'transaction',
    after: { id: 't1' },
  });
  bus.emit('account.created', { entity: 'account', after: { id: 'a1' } });

  expect(seen.map((e) => e.type)).toEqual([
    'transaction.created',
    'account.created',
  ]);
  const out = res.writes.join('');
  expect(out).toMatch(/event: transaction\.created/);
  expect(out).toMatch(/data: /);
  expect(out).not.toMatch(/event: account\.created/);
});
