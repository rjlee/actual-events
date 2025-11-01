jest.mock('@actual-app/api');

const api = require('@actual-app/api');
const { EventBus } = require('../src/events');
const { Scanner } = require('../src/scanner');

describe('Scanner payee and category diffs', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('emits payee created/updated/deleted and category/group created', async () => {
    api.sync.mockResolvedValue();
    api.getAccounts.mockResolvedValue([]);
    api.getTransactions.mockResolvedValue([]);
    // First scan: one payee, one category/group
    api.getPayees.mockResolvedValueOnce([{ id: 'p1', name: 'One' }]);
    api.getCategories.mockResolvedValueOnce([
      { id: 'c1', name: 'Cat', group_id: 'g1' },
    ]);
    api.getCategoryGroups.mockResolvedValueOnce([{ id: 'g1', name: 'Group' }]);
    // Second scan: payee renamed, categories unchanged
    api.getPayees.mockResolvedValueOnce([{ id: 'p1', name: 'Renamed' }]);
    api.getCategories.mockResolvedValueOnce([
      { id: 'c1', name: 'Cat', group_id: 'g1' },
    ]);
    api.getCategoryGroups.mockResolvedValueOnce([{ id: 'g1', name: 'Group' }]);
    // Third scan: payee deleted
    api.getPayees.mockResolvedValueOnce([]);
    api.getCategories.mockResolvedValueOnce([
      { id: 'c1', name: 'Cat', group_id: 'g1' },
    ]);
    api.getCategoryGroups.mockResolvedValueOnce([{ id: 'g1', name: 'Group' }]);

    const bus = new EventBus(20);
    const types = [];
    bus.addSink((ev) => types.push(ev.type));
    const scanner = new Scanner(bus, { lookbackDays: 30 });

    await scanner.scanOnce();
    await scanner.scanOnce();
    await scanner.scanOnce();

    expect(types).toEqual(
      expect.arrayContaining([
        'payee.created',
        'category.created',
        'categoryGroup.created',
        'payee.updated',
        'payee.deleted',
      ]),
    );
  });
});
