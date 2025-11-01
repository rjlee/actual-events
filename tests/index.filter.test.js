const { compileFilter } = require('../src/filter');

test('compileFilter filters by entity, event, and account', () => {
  const filter = compileFilter({
    entities: 'transaction',
    events: 'transaction.updated',
    accounts: 'acc1,acc2',
  });
  const pass = {
    entity: 'transaction',
    type: 'transaction.updated',
    after: { account: 'acc1' },
  };
  const failEnt = { ...pass, entity: 'account' };
  const failEvt = { ...pass, type: 'transaction.created' };
  const failAcct = { ...pass, after: { account: 'accX' } };
  expect(filter(pass)).toBe(true);
  expect(filter(failEnt)).toBe(false);
  expect(filter(failEvt)).toBe(false);
  expect(filter(failAcct)).toBe(false);
});

test('compileFilter supports regex for events', () => {
  const filter = compileFilter({
    entities: 'transaction',
    events: '^transaction\\.',
    useRegex: true,
  });
  expect(filter({ entity: 'transaction', type: 'transaction.updated' })).toBe(
    true,
  );
  expect(filter({ entity: 'transaction', type: 'account.updated' })).toBe(
    false,
  );
});
