function toSet(str) {
  if (!str) return null;
  const arr = String(str)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return arr.length ? new Set(arr) : null;
}

function toRegexList(str) {
  if (!str) return null;
  const arr = String(str)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    const regs = arr.map((p) => new RegExp(p));
    return regs.length ? regs : null;
  } catch {
    return null;
  }
}

function compileFilter({
  entities,
  events,
  accounts,
  payees,
  categories,
  categoryGroups,
  rules,
  useRegex,
}) {
  const entSet = useRegex ? null : toSet(entities);
  const evtSet = useRegex ? null : toSet(events);
  const acctSet = toSet(accounts);
  const payeeSet = toSet(payees);
  const catSet = toSet(categories);
  const catGroupSet = toSet(categoryGroups);
  const ruleSet = toSet(rules);
  const entRegs = useRegex ? toRegexList(entities) : null;
  const evtRegs = useRegex ? toRegexList(events) : null;
  return (ev) => {
    if (entSet && !entSet.has(ev.entity)) return false;
    if (entRegs && !entRegs.some((r) => r.test(ev.entity))) return false;
    if (evtSet && !evtSet.has(ev.type)) return false;
    if (evtRegs && !evtRegs.some((r) => r.test(ev.type))) return false;
    if (acctSet) {
      if (ev.entity === 'transaction') {
        const acc = ev.after?.account || ev.before?.account || null;
        if (!acc || !acctSet.has(acc)) return false;
      } else if (ev.entity === 'account') {
        const id = ev.after?.id || ev.before?.id || null;
        if (!id || !acctSet.has(id)) return false;
      }
    }
    if (payeeSet) {
      if (ev.entity === 'transaction') {
        const py = ev.after?.payee || ev.before?.payee || null;
        if (!py || !payeeSet.has(String(py))) return false;
      } else if (ev.entity === 'payee') {
        const id = ev.after?.id || ev.before?.id || null;
        if (!id || !payeeSet.has(id)) return false;
      }
    }
    if (catSet) {
      if (ev.entity === 'transaction') {
        const cat = ev.after?.category || ev.before?.category || null;
        if (!cat || !catSet.has(String(cat))) return false;
      } else if (ev.entity === 'category') {
        const id = ev.after?.id || ev.before?.id || null;
        if (!id || !catSet.has(id)) return false;
      }
    }
    if (catGroupSet) {
      if (ev.entity === 'category') {
        const gid = ev.after?.group_id || ev.before?.group_id || null;
        if (!gid || !catGroupSet.has(String(gid))) return false;
      } else if (ev.entity === 'categoryGroup') {
        const id = ev.after?.id || ev.before?.id || null;
        if (!id || !catGroupSet.has(id)) return false;
      }
    }
    if (ruleSet && ev.entity === 'rule') {
      const id = ev.after?.id || ev.before?.id || null;
      if (!id || !ruleSet.has(id)) return false;
    }
    return true;
  };
}

module.exports = { compileFilter, toSet, toRegexList };
