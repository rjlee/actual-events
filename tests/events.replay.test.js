const { EventBus } = require('../src/events');

function fakeRes() {
  const writes = [];
  return {
    writes,
    write: (s) => writes.push(s),
    on: () => {},
  };
}

test('SSE replay respects Last-Event-ID and filters', () => {
  const bus = new EventBus(10);
  // Emit two events
  bus.emit('account.created', { entity: 'account', after: { id: 'a1' } }); // id 1
  bus.emit('transaction.created', {
    entity: 'transaction',
    after: { id: 't1', account: 'acc1' },
  }); // id 2

  // Client asks for replay since id=1 and only transactions
  const res = fakeRes();
  const filter = (ev) => ev.entity === 'transaction';
  bus.addClient(res, '1', filter);

  const out = res.writes.join('');
  expect(out).toMatch(/event: transaction\.created/);
  expect(out).not.toMatch(/event: account\.created/);
});
