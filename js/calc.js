// Pure maths: prices, bill shares, dish claims and the kitchen cook sheet.

export const going = (guests) => guests.filter((g) => g.status === 'yes');
export const headcount = (guests) => going(guests).reduce((n, g) => n + (Number(g.party) || 1), 0);

export function findItem(ev, line) {
  const sec = ev.menu?.sections?.find((s) => s.id === line.sec);
  const item = sec?.items.find((i) => i.id === line.item);
  return { sec, item };
}

// Chosen modifier choices for a line, in menu order: [{mod, choice}]
export function lineChoices(ev, line) {
  const { sec } = findItem(ev, line);
  const out = [];
  for (const mod of sec?.mods || []) {
    for (const cid of line.mods?.[mod.id] || []) {
      const choice = mod.choices.find((c) => c.id === cid);
      if (choice) out.push({ mod, choice });
    }
  }
  return out;
}

export function linePrice(ev, line) {
  const { item } = findItem(ev, line);
  if (!item) return 0;
  return (Number(item.price) || 0) + lineChoices(ev, line).reduce((s, c) => s + (Number(c.choice.price) || 0), 0);
}

export const sharedTotal = (ev) => (ev.costs?.shared || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);

export function bill(ev, guest, guests) {
  const isGoing = guest.status === 'yes';
  const food = isGoing ? (guest.lines || []).reduce((s, l) => s + linePrice(ev, l), 0) : 0;
  const heads = headcount(guests);
  const shared = isGoing && heads ? (sharedTotal(ev) / heads) * (Number(guest.party) || 1) : 0;
  return { food, shared, total: food + shared };
}

export function grandTotal(ev, guests) {
  return guests.reduce((s, g) => s + bill(ev, g, guests).total, 0);
}

// Who has claimed each suggested dish, plus dishes guests added themselves.
export function bringBoard(ev, guests) {
  const active = guests.filter((g) => g.status !== 'no');
  const items = (ev.bring?.items || []).map((it) => {
    const claims = [];
    for (const g of active) for (const b of g.brings || []) if (b.itemId === it.id) claims.push({ gid: g.id, name: g.name, bid: b.id });
    return { ...it, claims, left: Math.max(0, (Number(it.qty) || 1) - claims.length) };
  });
  const extras = [];
  for (const g of active) for (const b of g.brings || []) if (!b.itemId) extras.push({ ...b, gid: g.id, by: g.name });
  return { items, extras };
}

// Kitchen view: totals per dish, broken down by how each one is wanted.
export function cookSheet(ev, guests) {
  const sections = (ev.menu?.sections || []).map((sec) => ({
    id: sec.id,
    name: sec.name,
    items: sec.items.map((item) => ({ id: item.id, name: item.name, count: 0, variants: new Map() })),
  }));
  for (const g of going(guests)) {
    for (const line of g.lines || []) {
      const sec = sections.find((s) => s.id === line.sec);
      const row = sec?.items.find((i) => i.id === line.item);
      if (!row) continue;
      row.count++;
      const spec = lineChoices(ev, line).map((c) => c.choice.name).join(' · ') || 'As it comes';
      const key = `${spec}|${line.note || ''}`;
      if (!row.variants.has(key)) row.variants.set(key, { spec, note: line.note || '', who: [] });
      row.variants.get(key).who.push(line.who || g.name);
    }
  }
  return sections
    .map((s) => ({ ...s, items: s.items.filter((i) => i.count).map((i) => ({ ...i, variants: [...i.variants.values()] })) }))
    .filter((s) => s.items.length);
}

// One ticket per person eating (a guest can order for their plus-ones).
export function personTickets(ev, guests) {
  const tickets = [];
  for (const g of going(guests)) {
    const byWho = new Map();
    for (const line of g.lines || []) {
      const { item } = findItem(ev, line);
      if (!item) continue;
      const who = line.who || g.name;
      if (!byWho.has(who)) byWho.set(who, []);
      byWho.get(who).push({ name: item.name, spec: lineChoices(ev, line).map((c) => c.choice.name).join(' · '), note: line.note || '' });
    }
    for (const [who, lines] of byWho) tickets.push({ who, via: who === g.name ? '' : g.name, diet: who === g.name ? g.diet || '' : '', lines });
  }
  return tickets;
}
