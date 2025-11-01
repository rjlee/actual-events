const api = require('@actual-app/api');
const logger = require('./logger');
const { formatYMD } = require('./utils');

function txFingerprint(tx) {
  const pick = {
    id: tx.id,
    account: tx.account,
    amount: tx.amount,
    date: tx.date,
    payee: tx.payee || null,
    category: tx.category || null,
    cleared: !!tx.cleared,
    reconciled: !!tx.reconciled,
    notes: tx.notes || null,
    transfer_id: tx.transfer_id || null,
    is_child: !!tx.is_child,
    is_parent: !!tx.is_parent,
  };
  return JSON.stringify(pick);
}

function acctFingerprint(acct) {
  const pick = {
    id: acct.id,
    name: acct.name,
    offbudget: !!acct.offbudget,
    closed: !!acct.closed,
  };
  return JSON.stringify(pick);
}

function payeeFingerprint(p) {
  const pick = {
    id: p.id,
    name: p.name,
    transfer_acct: p.transfer_acct || null,
  };
  return JSON.stringify(pick);
}

function categoryFingerprint(c) {
  const pick = {
    id: c.id,
    name: c.name,
    hidden: !!c.hidden,
    group_id: c.group_id || null,
  };
  return JSON.stringify(pick);
}

function categoryGroupFingerprint(g) {
  const pick = {
    id: g.id,
    name: g.name,
    hidden: !!g.hidden,
  };
  return JSON.stringify(pick);
}

function ruleFingerprint(r) {
  const pick = {
    id: r.id,
    // Minimal fields; expand as needed
    stage: r.stage || null,
    conditions: r.conditions ? JSON.stringify(r.conditions) : null,
    actions: r.actions ? JSON.stringify(r.actions) : null,
  };
  return JSON.stringify(pick);
}

class Scanner {
  constructor(bus, { lookbackDays = 60 } = {}) {
    this.bus = bus;
    this.lookbackDays = lookbackDays;
    this.prevTx = new Map();
    this.prevAcct = new Map();
    this.prevPayee = new Map();
    this.prevCat = new Map();
    this.prevCatGroup = new Map();
    this.prevRule = new Map();
    this.scanning = false;
  }

  async scanOnce() {
    if (this.scanning) return;
    this.scanning = true;
    let changes = 0;
    try {
      this.bus.emit('sync.started', { entity: 'sync' });
      await api.sync().catch(() => {});
      // Accounts diff
      const accounts = await api.getAccounts();
      const currAcct = new Map(accounts.map((a) => [a.id, acctFingerprint(a)]));
      // Created
      for (const a of accounts) {
        if (!this.prevAcct.has(a.id)) {
          this.bus.emit('account.created', { entity: 'account', after: a });
          changes++;
        } else if (this.prevAcct.get(a.id) !== currAcct.get(a.id)) {
          const before = JSON.parse(this.prevAcct.get(a.id));
          this.bus.emit('account.updated', {
            entity: 'account',
            before,
            after: a,
          });
          // Specialized events
          if (!!before.closed !== !!a.closed) {
            this.bus.emit(a.closed ? 'account.closed' : 'account.reopened', {
              entity: 'account',
              before,
              after: a,
            });
          }
          changes++;
        }
      }
      // Deleted (closed or truly missing)
      for (const id of this.prevAcct.keys()) {
        if (!currAcct.has(id)) {
          const before = JSON.parse(this.prevAcct.get(id));
          this.bus.emit('account.deleted', { entity: 'account', before });
          changes++;
        }
      }
      this.prevAcct = currAcct;

      // Payees diff
      try {
        const payees = await api.getPayees();
        const currPayee = new Map(
          payees.map((p) => [p.id, payeeFingerprint(p)]),
        );
        for (const p of payees) {
          if (!this.prevPayee.has(p.id)) {
            this.bus.emit('payee.created', { entity: 'payee', after: p });
            changes++;
          } else if (this.prevPayee.get(p.id) !== currPayee.get(p.id)) {
            const before = JSON.parse(this.prevPayee.get(p.id));
            this.bus.emit('payee.updated', {
              entity: 'payee',
              before,
              after: p,
            });
            changes++;
          }
        }
        for (const id of this.prevPayee.keys()) {
          if (!currPayee.has(id)) {
            const before = JSON.parse(this.prevPayee.get(id));
            this.bus.emit('payee.deleted', { entity: 'payee', before });
            changes++;
          }
        }
        this.prevPayee = currPayee;
      } catch (e) {
        logger.warn('payees scan failed:', e?.message || e);
      }

      // Categories & groups diff
      try {
        const cats = await api.getCategories();
        const groups = await api.getCategoryGroups();
        const currCat = new Map(
          cats.map((c) => [c.id, categoryFingerprint(c)]),
        );
        const currGroup = new Map(
          groups.map((g) => [g.id, categoryGroupFingerprint(g)]),
        );
        for (const c of cats) {
          if (!this.prevCat.has(c.id)) {
            this.bus.emit('category.created', { entity: 'category', after: c });
            changes++;
          } else if (this.prevCat.get(c.id) !== currCat.get(c.id)) {
            const before = JSON.parse(this.prevCat.get(c.id));
            this.bus.emit('category.updated', {
              entity: 'category',
              before,
              after: c,
            });
            changes++;
          }
        }
        for (const id of this.prevCat.keys()) {
          if (!currCat.has(id)) {
            const before = JSON.parse(this.prevCat.get(id));
            this.bus.emit('category.deleted', { entity: 'category', before });
            changes++;
          }
        }
        for (const g of groups) {
          if (!this.prevCatGroup.has(g.id)) {
            this.bus.emit('categoryGroup.created', {
              entity: 'categoryGroup',
              after: g,
            });
            changes++;
          } else if (this.prevCatGroup.get(g.id) !== currGroup.get(g.id)) {
            const before = JSON.parse(this.prevCatGroup.get(g.id));
            this.bus.emit('categoryGroup.updated', {
              entity: 'categoryGroup',
              before,
              after: g,
            });
            changes++;
          }
        }
        for (const id of this.prevCatGroup.keys()) {
          if (!currGroup.has(id)) {
            const before = JSON.parse(this.prevCatGroup.get(id));
            this.bus.emit('categoryGroup.deleted', {
              entity: 'categoryGroup',
              before,
            });
            changes++;
          }
        }
        this.prevCat = currCat;
        this.prevCatGroup = currGroup;
      } catch (e) {
        logger.warn('categories scan failed:', e?.message || e);
      }

      // Rules diff
      try {
        const rules = await api.getRules();
        const currRule = new Map(rules.map((r) => [r.id, ruleFingerprint(r)]));
        for (const r of rules) {
          if (!this.prevRule.has(r.id)) {
            this.bus.emit('rule.created', { entity: 'rule', after: r });
            changes++;
          } else if (this.prevRule.get(r.id) !== currRule.get(r.id)) {
            const before = JSON.parse(this.prevRule.get(r.id));
            this.bus.emit('rule.updated', { entity: 'rule', before, after: r });
            changes++;
          }
        }
        for (const id of this.prevRule.keys()) {
          if (!currRule.has(id)) {
            const before = JSON.parse(this.prevRule.get(id));
            this.bus.emit('rule.deleted', { entity: 'rule', before });
            changes++;
          }
        }
        this.prevRule = currRule;
      } catch (e) {
        logger.warn('rules scan failed:', e?.message || e);
      }

      // Transactions diff (recent window)
      const now = Date.now();
      const start = new Date(now - this.lookbackDays * 24 * 60 * 60 * 1000);
      const startYMD = formatYMD(start);
      const endYMD = formatYMD(now);
      const txMap = new Map();
      for (const acct of accounts) {
        try {
          const txns = await api.getTransactions(acct.id, startYMD, endYMD);
          for (const t of txns) {
            txMap.set(t.id, { t, f: txFingerprint(t) });
          }
        } catch (e) {
          logger.warn(`tx fetch failed for ${acct.name}:`, e?.message || e);
        }
      }
      // Created/updated
      for (const { t, f } of txMap.values()) {
        if (!this.prevTx.has(t.id)) {
          this.bus.emit('transaction.created', {
            entity: 'transaction',
            after: t,
          });
          changes++;
        } else if (this.prevTx.get(t.id) !== f) {
          const before = JSON.parse(this.prevTx.get(t.id));
          this.bus.emit('transaction.updated', {
            entity: 'transaction',
            before,
            after: t,
          });
          // Specialized transaction events
          if (!!before.cleared !== !!t.cleared) {
            this.bus.emit(
              t.cleared ? 'transaction.cleared' : 'transaction.uncleared',
              {
                entity: 'transaction',
                before,
                after: t,
              },
            );
          }
          if (!!before.reconciled !== !!t.reconciled) {
            this.bus.emit(
              t.reconciled
                ? 'transaction.reconciled'
                : 'transaction.unreconciled',
              { entity: 'transaction', before, after: t },
            );
          }
          const bTrans = before.transfer_id || null;
          const aTrans = t.transfer_id || null;
          if (!bTrans && aTrans) {
            this.bus.emit('transfer.linked', {
              entity: 'transaction',
              before,
              after: t,
            });
          } else if (bTrans && !aTrans) {
            this.bus.emit('transfer.unlinked', {
              entity: 'transaction',
              before,
              after: t,
            });
          } else if (bTrans && aTrans && bTrans !== aTrans) {
            this.bus.emit('transfer.updated', {
              entity: 'transaction',
              before,
              after: t,
            });
          }
          changes++;
        }
      }
      // Deleted within window
      for (const [id, f] of this.prevTx) {
        if (!txMap.has(id)) {
          const before = JSON.parse(f);
          this.bus.emit('transaction.deleted', {
            entity: 'transaction',
            before,
          });
          changes++;
        }
      }
      // Update previous
      this.prevTx = new Map(
        Array.from(txMap.entries()).map(([id, v]) => [id, v.f]),
      );
      if (changes === 0) {
        this.bus.emit('scan.noop', { entity: 'scan' });
      }
      this.bus.emit('sync.completed', { entity: 'sync' });
    } catch (e) {
      logger.warn('scan failed:', e?.message || e);
      this.bus.emit('sync.failed', {
        entity: 'sync',
        error: e?.message || String(e),
      });
    } finally {
      this.scanning = false;
    }
  }
}

module.exports = { Scanner };
