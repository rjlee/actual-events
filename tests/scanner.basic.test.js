jest.mock('@actual-app/api', () => ({
  init: jest.fn(),
  downloadBudget: jest.fn(),
  sync: jest.fn(),
  shutdown: jest.fn(),
  getAccounts: jest.fn(),
  getTransactions: jest.fn(),
  getPayees: jest.fn(),
  getCategories: jest.fn(),
  getCategoryGroups: jest.fn(),
  getRules: jest.fn(),
}));

const api = require('@actual-app/api');
const { EventBus } = require('../src/events');
const { Scanner } = require('../src/scanner');

describe('Scanner emits basic events', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('account.created and transaction.created then transaction.cleared', async () => {
    api.getAccounts.mockResolvedValue([{ id: 'A', name: 'Acct A' }]);
    api.sync.mockResolvedValue();
    // First pass: one txn uncleared
    api.getTransactions.mockResolvedValueOnce([
      {
        id: 't1',
        account: 'A',
        amount: -1000,
        date: '2025-10-10',
        cleared: false,
      },
    ]);
    // Second pass: same txn cleared
    api.getTransactions.mockResolvedValueOnce([
      {
        id: 't1',
        account: 'A',
        amount: -1000,
        date: '2025-10-10',
        cleared: true,
      },
    ]);
    api.getPayees.mockResolvedValue([]);
    api.getCategories.mockResolvedValue([]);
    api.getCategoryGroups.mockResolvedValue([]);
    api.getRules.mockResolvedValue([]);

    const bus = new EventBus(10);
    const types = [];
    bus.addSink((ev) => types.push(ev.type));
    const scanner = new Scanner(bus, { lookbackDays: 90 });

    await scanner.scanOnce();
    await scanner.scanOnce();

    expect(types).toEqual(
      expect.arrayContaining([
        'account.created',
        'transaction.created',
        'transaction.updated',
        'transaction.cleared',
      ]),
    );
  });
});
