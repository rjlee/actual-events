const { compileFilter, toRegexList, toSet } = require('../src/filter');

describe('filter helpers', () => {
  test('toSet returns Set for comma-separated input and null for empty', () => {
    expect(toSet('a, b ,c')).toEqual(new Set(['a', 'b', 'c']));
    expect(toSet('')).toBeNull();
    expect(toSet(null)).toBeNull();
  });

  test('toRegexList returns null on invalid pattern when not strict', () => {
    expect(toRegexList('foo,(bar', { strict: false })).toBeNull();
  });

  test('toRegexList throws with code when strict', () => {
    try {
      toRegexList('foo,(bar', { strict: true });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.code).toBe('INVALID_REGEX');
      expect(err.message).toMatch(/Invalid regex pattern: \(bar/);
    }
  });
});

describe('compileFilter', () => {
  test('handles regex compilation and invalid patterns with strict mode', () => {
    const filter = compileFilter(
      {
        entities: 'transaction,account',
        events: '^transaction\\.(created|updated)$',
        useRegex: true,
      },
      { strictRegex: true },
    );

    expect(
      filter({
        entity: 'transaction',
        type: 'transaction.updated',
      }),
    ).toBe(true);

    expect(
      filter({
        entity: 'transaction',
        type: 'account.updated',
      }),
    ).toBe(false);

    expect(() =>
      compileFilter(
        { entities: '(unclosed', useRegex: true },
        { strictRegex: true },
      ),
    ).toThrow(/Invalid regex pattern/);
  });

  test('enforces account, payee, category, group, and rule filters', () => {
    const filter = compileFilter({
      accounts: 'acct-1',
      payees: 'pay-1',
      categories: 'cat-1',
      categoryGroups: 'group-1',
      rules: 'rule-1',
    });

    // Transaction needs matching account, payee, and category
    expect(
      filter({
        entity: 'transaction',
        after: { account: 'acct-1', payee: 'pay-1', category: 'cat-1' },
      }),
    ).toBe(true);
    expect(
      filter({
        entity: 'transaction',
        after: { account: 'acct-X', payee: 'pay-1', category: 'cat-1' },
      }),
    ).toBe(false);

    // Account entity should match by id
    expect(
      filter({
        entity: 'account',
        after: { id: 'acct-1' },
      }),
    ).toBe(true);
    expect(
      filter({
        entity: 'account',
        after: {},
      }),
    ).toBe(false);

    // Payee entity should match by id
    expect(
      filter({
        entity: 'payee',
        after: { id: 'pay-1' },
      }),
    ).toBe(true);
    expect(
      filter({
        entity: 'payee',
        after: { id: 'pay-X' },
      }),
    ).toBe(false);

    // Category must match id and group_id
    expect(
      filter({
        entity: 'category',
        after: { id: 'cat-1', group_id: 'group-1' },
      }),
    ).toBe(true);
    expect(
      filter({
        entity: 'category',
        after: { id: 'cat-1' },
      }),
    ).toBe(false);

    // Category group entity should match id
    expect(
      filter({
        entity: 'categoryGroup',
        after: { id: 'group-1' },
      }),
    ).toBe(true);
    expect(
      filter({
        entity: 'categoryGroup',
        after: {},
      }),
    ).toBe(false);

    // Rule entity filtered by id
    expect(
      filter({
        entity: 'rule',
        after: { id: 'rule-1' },
      }),
    ).toBe(true);
    expect(
      filter({
        entity: 'rule',
        after: { id: 'rule-X' },
      }),
    ).toBe(false);
  });

  test('falls back to allowing all when regex parsing fails without strict mode', () => {
    const filter = compileFilter({
      entities: '(transaction',
      useRegex: true,
    });

    expect(
      filter({
        entity: 'anything',
        type: 'transaction.updated',
      }),
    ).toBe(true);
  });
});
