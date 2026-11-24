// The invite itself: RSVP, ordering, the bring board, the guest list and host tools.
import { html, useState, useEffect, useRef } from '../vendor/htm-preact.js';
import { Cover, Field, Stepper, Sheet, Confirm, QR, Avatar, toast, copyText, themeStyle } from './ui.js';
import { Wizard, tidy } from './wizard.js';
import { Kitchen } from './kitchen.js';
import { bill, bringBoard, findItem, going, grandTotal, headcount, lineChoices, linePrice, sharedTotal } from './calc.js';
import { id, money, fmtDay, fmtTime, countdown, mapsLinks, placeQuery, calendarLinks, eventUrl, prettyCode, rememberEvent, forgetEvent } from './util.js';

const STATUS = { yes: 'Going', maybe: 'Maybe', no: 'Can’t go' };

export function EventPage({ store, code, hostKey, go, openShare }) {
  const [ev, setEv] = useState(undefined); // undefined = loading, null = not found
  const [guests, setGuests] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [tab, setTab] = useState('invite');
  const [actAs, setActAs] = useState(null);
  const [sheet, setSheet] = useState(openShare ? 'share' : null);
  const [local, setLocal] = useState(null);
  const [problem, setProblem] = useState('');
  const lazy = useRef();

  useEffect(() => {
    let alive = true;
    const fail = () => alive && setProblem('Could not load this invite. Check your connection and try again.');
    const stop1 = store.watchEvent(code, (e) => alive && setEv(e), fail);
    const stop2 = store.watchGuests(code, (g) => alive && setGuests(g), fail);
    (async () => {
      if (hostKey) {
        const ok = await store.claimHost(code, hostKey);
        toast(ok ? 'You can now manage this dinner' : 'That host link is not valid');
        history.replaceState(null, '', `#${code}`);
      }
      const h = await store.isHost(code);
      if (alive) setIsHost(h);
    })();
    return () => { alive = false; stop1(); stop2(); };
  }, [code]);

  useEffect(() => { if (ev) { rememberEvent(ev, isHost); document.title = `${ev.title} · Potluxe`; } }, [ev?.title, ev?.date, isHost]);
  useEffect(() => { setLocal(null); }, [actAs]);

  if (problem) return html`<${Blank} title="Something went wrong" body=${problem} go=${go} />`;
  if (ev === undefined) return html`<div class="page center-page"><div class="spinner" aria-label="Loading"></div></div>`;
  if (ev === null) {
    return html`<${Blank} title="No dinner found for that code" body="Check the code with your host. Codes are 8 characters, like ABCD-EFGH." go=${go} onForget=${() => forgetEvent(code)} />`;
  }

  const gid = actAs || store.uid;
  const remote = guests.find((g) => g.id === gid) || null;
  const me = local && local.id === gid && (!remote || (remote.updatedAt || 0) <= local.updatedAt) ? local : remote;
  const everyone = guests.map((g) => (me && g.id === gid ? me : g));
  if (me && !everyone.some((g) => g.id === gid)) everyone.push(me);
  const cur = ev.costs?.currency || 'USD';
  const readOnly = ev.locked && !isHost;

  const saveMe = (patch, opts = {}) => {
    const base = me || { id: gid, name: '', status: 'yes', party: 1, diet: '', lines: [], brings: [] };
    const next = { ...base, ...patch, id: gid, updatedAt: Date.now() };
    setLocal(next);
    const write = () => {
      const { id: _drop, ...data } = next;
      store.setGuest(code, gid, data).catch(() => toast('Could not save. Check your connection.'));
    };
    clearTimeout(lazy.current);
    if (opts.lazy) lazy.current = setTimeout(write, 600);
    else write();
  };
  const patchEvent = (patch) => store.updateEvent(code, patch).catch(() => toast('Could not save. Check your connection.'));

  const tabs = [
    ['invite', 'Invite', '✉️'],
    ev.menu?.enabled && ['order', 'Order', '🍽️'],
    ev.bring?.enabled && ['bring', 'Bring', '🧺'],
    ['guests', 'Guests', '👥'],
    isHost && ['kitchen', 'Kitchen', '🧾'],
  ].filter(Boolean);
  const ctx = { store, code, ev, guests: everyone, me, gid, isHost, cur, readOnly, saveMe, patchEvent, setTab, setSheet, setActAs, actAs, go };

  if (sheet === 'edit') {
    return html`<${Wizard} editing initial=${ev} onCancel=${() => setSheet(null)} onDone=${async (d) => {
      const t = tidy(d);
      await store.updateEvent(code, { title: t.title, hostName: t.hostName, blurb: t.blurb, cover: t.cover, date: t.date, time: t.time, endTime: t.endTime, rsvpBy: t.rsvpBy, place: t.place, menu: t.menu, bring: t.bring, costs: t.costs });
      setSheet(null);
      toast('Changes saved');
    }} />`;
  }

  return html`
    <div class="event" style=${themeStyle(ev.cover?.theme)}>
      ${actAs && html`
        <div class="act-as">
          <span>Editing for <strong>${remote?.name || 'guest'}</strong></span>
          <button type="button" class="btn sm" onClick=${() => { setActAs(null); setTab('guests'); }}>Done</button>
        </div>
      `}
      <main class="page">
        ${tab === 'invite' && html`<${InviteTab} ...${ctx} />`}
        ${tab === 'order' && html`<${OrderTab} ...${ctx} />`}
        ${tab === 'bring' && html`<${BringTab} ...${ctx} />`}
        ${tab === 'guests' && html`<${GuestsTab} ...${ctx} />`}
        ${tab === 'kitchen' && isHost && html`<${Kitchen} ev=${ev} guests=${everyone} cur=${cur} />`}
      </main>
      <nav class="tabbar" aria-label="Sections">
        ${tabs.map(([k, label, icon]) => html`
          <button type="button" class=${`tab ${tab === k ? 'on' : ''}`} aria-current=${tab === k ? 'page' : undefined} onClick=${() => { setTab(k); window.scrollTo(0, 0); }}>
            <span class="tab-icon" aria-hidden="true">${icon}</span><span>${label}</span>
          </button>
        `)}
      </nav>
      ${sheet === 'share' && html`<${ShareSheet} ...${ctx} onClose=${() => setSheet(null)} />`}
      ${sheet === 'manage' && html`<${ManageSheet} ...${ctx} onClose=${() => setSheet(null)} />`}
    </div>
  `;
}

function Blank({ title, body, go, onForget }) {
  return html`
    <div class="page center-page">
      <div class="card pad center">
        <h1 class="h2">${title}</h1>
        <p class="muted">${body}</p>
        <button type="button" class="btn primary" onClick=${() => { onForget?.(); go(''); }}>Back to home</button>
      </div>
    </div>
  `;
}

/* ---------------- Invite ---------------- */
function InviteTab(p) {
  const { ev, guests, me, isHost, cur, saveMe, setSheet, setTab, code, go } = p;
  const links = mapsLinks(ev.place);
  const cal = calendarLinks(ev, eventUrl(code));
  const yes = going(guests);
  const hasPlace = !!placeQuery(ev.place);
  const my = me ? bill(ev, me, guests) : null;
  return html`
    <${Cover} ev=${ev}>
      <div class="cover-top">
        <button type="button" class="pill" onClick=${() => go('')}>← Home</button>
        <button type="button" class="pill" onClick=${() => setSheet('share')}>Share</button>
      </div>
      <p class="eyebrow">${countdown(ev)}</p>
      <h1 class="cover-title">${ev.title}</h1>
      <p class="cover-meta">${fmtDay(ev)} · ${fmtTime(ev.time)}${ev.endTime ? ` – ${fmtTime(ev.endTime)}` : ''}</p>
      <p class="cover-meta">Hosted by ${ev.hostName}</p>
    <//>

    ${ev.announce && html`<div class="card pad announce"><p class="mini-label">From ${ev.hostName}</p><p>${ev.announce}</p></div>`}
    ${isHost && html`
      <div class="card pad host-bar">
        <div><p class="mini-label">You’re hosting</p><p class="muted">${headcount(guests)} coming · ${guests.filter((g) => g.status === 'maybe').length} maybe${ev.locked ? ' · orders locked' : ''}</p></div>
        <div class="row gap wrap">
          <button type="button" class="btn sm" onClick=${() => setSheet('edit')}>Edit</button>
          <button type="button" class="btn sm" onClick=${() => setSheet('manage')}>Manage</button>
          <button type="button" class="btn primary sm" onClick=${() => setSheet('share')}>Invite</button>
        </div>
      </div>
    `}

    <${Rsvp} ...${p} />

    ${me?.status === 'yes' && (ev.menu?.enabled || ev.bring?.enabled) && html`
      <div class="next-grid">
        ${ev.menu?.enabled && html`
          <button type="button" class="card pad next" onClick=${() => setTab('order')}>
            <span class="next-icon" aria-hidden="true">🍽️</span>
            <strong>${me.lines?.length ? `${me.lines.length} item${me.lines.length === 1 ? '' : 's'} ordered` : 'Choose your food'}</strong>
            <span class="muted">${my?.total ? `Your share ${money(my.total, cur)}` : 'Pick dishes and how you like them'}</span>
          </button>
        `}
        ${ev.bring?.enabled && html`
          <button type="button" class="card pad next" onClick=${() => setTab('bring')}>
            <span class="next-icon" aria-hidden="true">🧺</span>
            <strong>${me.brings?.length ? `Bringing ${me.brings.length} thing${me.brings.length === 1 ? '' : 's'}` : 'Claim a dish to bring'}</strong>
            <span class="muted">See what’s still needed</span>
          </button>
        `}
      </div>
    `}

    <section class="card pad">
      <p class="mini-label">When</p>
      <p class="lead">${fmtDay(ev)}</p>
      <p class="muted">${fmtTime(ev.time)}${ev.endTime ? ` until ${fmtTime(ev.endTime)}` : ''}${ev.rsvpBy ? ` · reply by ${new Date(`${ev.rsvpBy}T12:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}` : ''}</p>
      ${cal && html`
        <div class="row gap wrap">
          <a class="btn sm" href=${cal.google} target="_blank" rel="noopener">Google Calendar</a>
          <a class="btn sm" href=${cal.ics} download="dinner.ics">Apple / Outlook</a>
        </div>
      `}
    </section>

    ${hasPlace && html`
      <section class="card">
        <div class="map"><iframe title="Map" src=${links.embed} loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
        <div class="pad">
          <p class="mini-label">Where</p>
          ${ev.place.name && html`<p class="lead">${ev.place.name}</p>`}
          <p class=${ev.place.name ? 'muted' : 'lead'}>${ev.place.address}</p>
          ${ev.place.notes && html`<p class="note">${ev.place.notes}</p>`}
          <div class="row gap wrap">
            <a class="btn primary sm" href=${links.google} target="_blank" rel="noopener">Google Maps</a>
            <a class="btn sm" href=${links.apple} target="_blank" rel="noopener">Apple Maps</a>
            <a class="btn sm" href=${links.waze} target="_blank" rel="noopener">Waze</a>
            <button type="button" class="btn sm" onClick=${() => copyText([ev.place.name, ev.place.address].filter(Boolean).join(', '), 'Address copied')}>Copy</button>
          </div>
        </div>
      </section>
    `}

    ${ev.blurb && html`<section class="card pad"><p class="mini-label">From your host</p><p class="prose">${ev.blurb}</p></section>`}

    <button type="button" class="card pad who" onClick=${() => setTab('guests')}>
      <div class="avatars">${yes.slice(0, 7).map((g) => html`<${Avatar} name=${g.name} />`)}</div>
      <span>${yes.length ? `${headcount(guests)} going` : 'Be the first to reply'}</span>
      <span class="chev" aria-hidden="true">›</span>
    </button>
  `;
}

function Rsvp({ ev, me, saveMe, readOnly, actAs }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  if (!me) {
    const reply = (status) => {
      if (!name.trim()) return setErr('Add your name first so the host knows who you are.');
      saveMe({ name: name.trim(), status });
      toast(status === 'yes' ? 'You’re in!' : 'Reply sent');
    };
    return html`
      <section class="card pad rsvp">
        <h2 class="h2">Can you make it?</h2>
        <${Field} label="Your name" id="r-name">
          <input id="r-name" class="input" value=${name} maxlength="40" autocomplete="given-name" placeholder="First name" onInput=${(e) => { setName(e.target.value); setErr(''); }} />
        <//>
        ${err && html`<p class="error" role="alert">${err}</p>`}
        <div class="rsvp-btns">
          <button type="button" class="btn primary" onClick=${() => reply('yes')}>Going</button>
          <button type="button" class="btn" onClick=${() => reply('maybe')}>Maybe</button>
          <button type="button" class="btn" onClick=${() => reply('no')}>Can’t go</button>
        </div>
      </section>
    `;
  }
  return html`
    <section class="card pad rsvp">
      <div class="row between">
        <h2 class="h2">${actAs ? `${me.name}’s reply` : me.status === 'yes' ? 'You’re going' : me.status === 'maybe' ? 'You might come' : 'You can’t make it'}</h2>
        <${Avatar} name=${me.name} />
      </div>
      <div class="seg" role="group" aria-label="Your reply">
        ${Object.entries(STATUS).map(([k, label]) => html`<button type="button" class=${me.status === k ? 'on' : ''} aria-pressed=${me.status === k} onClick=${() => saveMe({ status: k })}>${label}</button>`)}
      </div>
      <${Field} label="Name" id="r-name2">
        <input id="r-name2" class="input" value=${me.name} maxlength="40" onInput=${(e) => saveMe({ name: e.target.value }, { lazy: true })} />
      <//>
      ${me.status !== 'no' && html`
        <div class="switch-row">
          <div><strong>How many of you?</strong><span class="muted">Including yourself</span></div>
          <${Stepper} value=${Number(me.party) || 1} max=${12} label="Party size" onChange=${(v) => saveMe({ party: v })} />
        </div>
        <${Field} label="Allergies or dietary needs" id="r-diet">
          <input id="r-diet" class="input" value=${me.diet || ''} maxlength="120" placeholder="None, halal, vegetarian, nut allergy…" onInput=${(e) => saveMe({ diet: e.target.value }, { lazy: true })} />
        <//>
      `}
      ${readOnly && html`<p class="note">The host has locked orders. You can still change your reply.</p>`}
    </section>
  `;
}

/* ---------------- Order ---------------- */
function needRsvp(p, what) {
  const { me, setTab } = p;
  if (me?.status === 'yes') return null;
  return html`
    <div class="card pad center">
      <h2 class="h2">${me ? 'Change your reply to Going first' : 'Reply first'}</h2>
      <p class="muted">${what}</p>
      <button type="button" class="btn primary" onClick=${() => setTab('invite')}>Go to reply</button>
    </div>
  `;
}

function OrderTab(p) {
  const { ev, guests, me, cur, saveMe, readOnly } = p;
  const [pick, setPick] = useState(null); // {sec, item, line?}
  const gate = needRsvp(p, 'Once you’re going you can choose your food here.');
  const lines = me?.lines || [];
  const my = me ? bill(ev, me, guests) : { food: 0, shared: 0, total: 0 };
  const saveLine = (line) => {
    const exists = lines.some((l) => l.id === line.id);
    saveMe({ lines: exists ? lines.map((l) => (l.id === line.id ? line : l)) : [...lines, line] });
    toast(exists ? 'Order updated' : 'Added to your order');
    setPick(null);
  };
  return html`
    <header class="tab-head"><h1>Order</h1><p class="muted">Pick for yourself and anyone you’re bringing.</p></header>
    ${ev.locked && html`<p class="note">Orders are locked${p.isHost ? ' for guests' : ''}. ${p.isHost ? 'You can still make changes.' : 'Ask the host if you need a change.'}</p>`}
    ${gate || html`
      ${lines.length > 0 && html`
        <section class="card pad">
          <p class="mini-label">Your order</p>
          <ul class="lines">
            ${lines.map((l) => {
              const { sec, item } = findItem(ev, l);
              if (!item) return html`<li class="line"><div><strong class="gone">No longer on the menu</strong></div><button type="button" class="icon-btn" aria-label="Remove" onClick=${() => saveMe({ lines: lines.filter((x) => x.id !== l.id) })}>✕</button></li>`;
              const spec = lineChoices(ev, l).map((c) => c.choice.name).join(' · ');
              return html`
                <li class="line">
                  <button type="button" class="line-main" disabled=${readOnly} onClick=${() => setPick({ sec, item, line: l })}>
                    <strong>${item.name}</strong>
                    ${spec && html`<span class="muted">${spec}</span>`}
                    ${l.note && html`<span class="muted">“${l.note}”</span>`}
                    ${l.who && l.who !== me.name && html`<span class="tag">For ${l.who}</span>`}
                  </button>
                  <span class="num">${linePrice(ev, l) ? money(linePrice(ev, l), cur) : ''}</span>
                  ${!readOnly && html`<button type="button" class="icon-btn" aria-label=${`Remove ${item.name}`} onClick=${() => saveMe({ lines: lines.filter((x) => x.id !== l.id) })}>✕</button>`}
                </li>
              `;
            })}
          </ul>
        </section>
      `}
      ${(my.total > 0 || sharedTotal(ev) > 0) && html`
        <section class="card pad bill">
          <p class="mini-label">Your share</p>
          <div class="bill-row"><span>Food</span><span class="num">${money(my.food, cur)}</span></div>
          ${sharedTotal(ev) > 0 && html`<div class="bill-row"><span>Shared costs <span class="muted">(${(ev.costs.shared || []).map((c) => c.name).join(', ')}, split ${headcount(guests)} ways)</span></span><span class="num">${money(my.shared, cur)}</span></div>`}
          <div class="bill-row total"><span>Total</span><span class="num">${money(my.total, cur)}</span></div>
          ${ev.paid?.[me.id] ? html`<p class="tag ok">Marked as paid</p>` : ev.costs?.payNote && html`<p class="note">${ev.costs.payNote}</p>`}
        </section>
      `}
      ${(ev.menu.sections || []).map((sec) => html`
        <section class="menu-sec" key=${sec.id}>
          <h2 class="h3">${sec.name}</h2>
          <div class="card list">
            ${sec.items.map((item) => html`
              <button type="button" class="menu-item" disabled=${readOnly} onClick=${() => setPick({ sec, item })}>
                <span class="menu-text"><strong>${item.name}</strong>${item.desc && html`<span class="muted">${item.desc}</span>`}</span>
                <span class="num">${item.price ? money(item.price, cur) : ''}</span>
                <span class="add" aria-hidden="true">+</span>
              </button>
            `)}
          </div>
        </section>
      `)}
      ${!ev.menu.sections?.length && html`<p class="muted center">The host hasn’t added a menu yet.</p>`}
    `}
    ${pick && html`<${ItemSheet} ...${pick} cur=${cur} me=${me} onSave=${saveLine} onClose=${() => setPick(null)} />`}
  `;
}

function ItemSheet({ sec, item, line, cur, me, onSave, onClose }) {
  const [mods, setMods] = useState(line?.mods || {});
  const [who, setWho] = useState(line?.who || me.name);
  const [note, setNote] = useState(line?.note || '');
  const [err, setErr] = useState('');
  const toggle = (mod, cid) => {
    setErr('');
    setMods((m) => {
      const curSel = m[mod.id] || [];
      if (!mod.multi) return { ...m, [mod.id]: [cid] };
      return { ...m, [mod.id]: curSel.includes(cid) ? curSel.filter((x) => x !== cid) : [...curSel, cid] };
    });
  };
  const draft = { id: line?.id || id(), sec: sec.id, item: item.id, mods, who: who.trim() || me.name, note: note.trim() };
  const price = (Number(item.price) || 0) + sec.mods.reduce((s, m) => s + m.choices.filter((c) => (mods[m.id] || []).includes(c.id)).reduce((a, c) => a + (Number(c.price) || 0), 0), 0);
  const save = () => {
    const missing = sec.mods.find((m) => !m.multi && !(mods[m.id] || []).length);
    if (missing) return setErr(`Choose ${missing.name.toLowerCase()} first.`);
    onSave(draft);
  };
  return html`
    <${Sheet} title=${item.name} onClose=${onClose}>
      ${item.desc && html`<p class="muted">${item.desc}</p>`}
      ${sec.mods.map((mod) => html`
        <div class="field" key=${mod.id}>
          <span class="field-label">${mod.name} <span class="muted">${mod.multi ? 'pick any' : 'pick one'}</span></span>
          <div class="chips">
            ${mod.choices.map((c) => {
              const on = (mods[mod.id] || []).includes(c.id);
              return html`<button type="button" class=${`chip ${on ? 'on' : ''}`} aria-pressed=${on} onClick=${() => toggle(mod, c.id)}>${c.name}${c.price ? html` <span class="chip-price">+${money(c.price, cur)}</span>` : ''}</button>`;
            })}
          </div>
        </div>
      `)}
      <${Field} label="Who is it for?" id="i-who" hint=${(Number(me.party) || 1) > 1 ? 'Change the name to order for someone in your party.' : ''}>
        <input id="i-who" class="input" value=${who} maxlength="40" onInput=${(e) => setWho(e.target.value)} />
      <//>
      <${Field} label="Note for the cook (optional)" id="i-note">
        <input id="i-note" class="input" value=${note} maxlength="100" placeholder="No pickles, sauce on the side…" onInput=${(e) => setNote(e.target.value)} />
      <//>
      ${err && html`<p class="error" role="alert">${err}</p>`}
      <button type="button" class="btn primary block" onClick=${save}>${line ? 'Update' : 'Add to order'}${price ? ` · ${money(price, cur)}` : ''}</button>
    <//>
  `;
}

/* ---------------- Bring ---------------- */
function BringTab(p) {
  const { ev, guests, me, saveMe, readOnly, gid } = p;
  const [custom, setCustom] = useState('');
  const board = bringBoard(ev, guests);
  const canAct = me && me.status !== 'no' && !readOnly;
  const brings = me?.brings || [];
  const claim = (it) => { saveMe({ brings: [...brings, { id: id(), itemId: it.id, name: it.name }] }); toast(`You’re bringing ${it.name}`); };
  const drop = (bid) => saveMe({ brings: brings.filter((b) => b.id !== bid) });
  const addOwn = (e) => {
    e.preventDefault();
    if (!custom.trim()) return;
    saveMe({ brings: [...brings, { id: id(), itemId: null, name: custom.trim() }] });
    setCustom('');
  };
  const needed = board.items.reduce((n, i) => n + i.left, 0);
  return html`
    <header class="tab-head"><h1>Bring</h1><p class="muted">${board.items.length ? (needed ? `${needed} still needed. This board updates live for everyone.` : 'Everything is covered. Thank you!') : 'Add what you’re bringing so nobody doubles up.'}</p></header>
    ${!me && html`<p class="note">Reply on the Invite tab to claim something.</p>`}
    ${readOnly && html`<p class="note">The host has locked the list.</p>`}
    ${board.items.length > 0 && html`
      <div class="card list">
        ${board.items.map((it) => {
          const mine = it.claims.filter((c) => c.gid === gid);
          const full = it.left === 0;
          return html`
            <div class=${`bring-item ${full ? 'full' : ''}`} key=${it.id}>
              <div class="bring-text">
                <strong>${it.name}</strong>
                <span class="muted">${it.claims.length ? it.claims.map((c) => (c.gid === gid && !p.actAs ? 'You' : c.name)).join(', ') : 'Nobody yet'}</span>
              </div>
              <span class=${`count ${full ? 'ok' : ''}`}>${it.claims.length}/${it.qty}</span>
              ${canAct && (mine.length
                ? html`<button type="button" class="btn sm" onClick=${() => drop(mine[0].bid)}>Unclaim</button>`
                : html`<button type="button" class="btn primary sm" disabled=${full} onClick=${() => claim(it)}>${full ? 'Covered' : 'I’ll bring it'}</button>`)}
            </div>
          `;
        })}
      </div>
    `}
    <h2 class="h3">Also coming</h2>
    <div class="card list">
      ${board.extras.map((b) => html`
        <div class="bring-item" key=${b.id}>
          <div class="bring-text"><strong>${b.name}</strong><span class="muted">${b.gid === gid && !p.actAs ? 'You' : b.by}</span></div>
          ${canAct && b.gid === gid && html`<button type="button" class="btn sm" onClick=${() => drop(b.id)}>Remove</button>`}
        </div>
      `)}
      ${!board.extras.length && html`<p class="muted pad">Nothing extra yet.</p>`}
    </div>
    ${canAct && html`
      <form class="row gap" onSubmit=${addOwn}>
        <input class="input grow" value=${custom} maxlength="60" aria-label="Something else you will bring" placeholder="Something else, e.g. baklava" onInput=${(e) => setCustom(e.target.value)} />
        <button type="submit" class="btn primary">Add</button>
      </form>
    `}
  `;
}

/* ---------------- Guests ---------------- */
function GuestsTab(p) {
  const { ev, guests, isHost, cur, gid, store, code, patchEvent, setActAs, setTab, setSheet } = p;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [remove, setRemove] = useState(null);
  const groups = [['yes', 'Going'], ['maybe', 'Maybe'], ['no', 'Can’t go']];
  const total = grandTotal(ev, guests);
  const paidSum = guests.filter((g) => ev.paid?.[g.id]).reduce((s, g) => s + bill(ev, g, guests).total, 0);
  const addGuest = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const newId = `h_${id()}`;
    await store.setGuest(code, newId, { name: name.trim(), status: 'yes', party: 1, diet: '', lines: [], brings: [], addedByHost: true });
    setName('');
    setAdding(false);
    toast('Guest added');
  };
  const summary = (g) => {
    const food = (g.lines || []).map((l) => findItem(ev, l).item?.name).filter(Boolean);
    const brings = (g.brings || []).map((b) => b.name);
    return [food.length && food.join(', '), brings.length && `Bringing ${brings.join(', ')}`].filter(Boolean).join(' · ');
  };
  return html`
    <header class="tab-head"><h1>Guests</h1><p class="muted">${headcount(guests)} going${guests.length ? ` · ${guests.length} repl${guests.length === 1 ? 'y' : 'ies'}` : ''}</p></header>
    ${isHost && total > 0 && html`
      <section class="card pad bill">
        <p class="mini-label">Bill</p>
        <div class="bill-row"><span>Collected</span><span class="num">${money(paidSum, cur)}</span></div>
        <div class="bill-row total"><span>Total</span><span class="num">${money(total, cur)}</span></div>
      </section>
    `}
    ${groups.map(([k, label]) => {
      const list = guests.filter((g) => g.status === k);
      if (!list.length) return null;
      return html`
        <h2 class="h3">${label} <span class="muted">${k === 'yes' ? headcount(guests) : list.length}</span></h2>
        <div class="card list">
          ${list.map((g) => {
            const b = bill(ev, g, guests);
            return html`
              <div class="guest" key=${g.id}>
                <${Avatar} name=${g.name} />
                <div class="guest-text">
                  <strong>${g.name}${g.id === store.uid ? ' (you)' : ''}${(Number(g.party) || 1) > 1 && k !== 'no' ? html` <span class="tag">+${g.party - 1}</span>` : ''}</strong>
                  ${k === 'yes' && summary(g) && html`<span class="muted">${summary(g)}</span>`}
                  ${g.diet && k !== 'no' && html`<span class="muted">Dietary: ${g.diet}</span>`}
                  ${isHost && html`
                    <div class="row gap wrap guest-tools">
                      ${b.total > 0 && html`<button type="button" class=${`btn xs ${ev.paid?.[g.id] ? 'ok' : ''}`} aria-pressed=${!!ev.paid?.[g.id]} onClick=${() => patchEvent({ paid: { ...(ev.paid || {}), [g.id]: !ev.paid?.[g.id] } })}>${ev.paid?.[g.id] ? '✓ Paid' : 'Mark paid'}</button>`}
                      ${g.id !== store.uid && html`<button type="button" class="btn xs" onClick=${() => { setActAs(g.id); setTab('invite'); }}>Edit for them</button>`}
                      ${g.id !== store.uid && html`<button type="button" class="btn xs" onClick=${() => setRemove(g)}>Remove</button>`}
                    </div>
                  `}
                </div>
                ${isHost && b.total > 0 && html`<span class="num">${money(b.total, cur)}</span>`}
              </div>
            `;
          })}
        </div>
      `;
    })}
    ${!guests.length && html`<div class="card pad center"><p class="muted">No replies yet. Share the invite to get things going.</p><button type="button" class="btn primary" onClick=${() => setSheet('share')}>Share invite</button></div>`}
    ${isHost && (adding
      ? html`<form class="row gap" onSubmit=${addGuest}><input class="input grow" value=${name} maxlength="40" aria-label="Guest name" placeholder="Guest name" onInput=${(e) => setName(e.target.value)} /><button type="submit" class="btn primary">Add</button></form>`
      : html`<button type="button" class="btn ghost block" onClick=${() => setAdding(true)}>+ Add a guest yourself (for people without the link)</button>`)}
    ${remove && html`<${Confirm} title=${`Remove ${remove.name}?`} body="Their reply, order and claimed dishes will be deleted." action="Remove" danger onYes=${() => store.deleteGuest(code, remove.id)} onClose=${() => setRemove(null)} />`}
  `;
}

/* ---------------- Sheets ---------------- */
function ShareSheet({ ev, code, isHost, store, onClose }) {
  const url = eventUrl(code);
  const [hostUrl, setHostUrl] = useState('');
  const text = `You’re invited to ${ev.title} on ${fmtDay(ev)} at ${fmtTime(ev.time)}. Reply and choose your food here:`;
  useEffect(() => { if (isHost) store.hostKey(code).then((k) => k && setHostUrl(`${url}/host/${k}`)); }, []);
  const share = async () => {
    try { await navigator.share({ title: ev.title, text, url }); } catch {}
  };
  return html`
    <${Sheet} title="Share the invite" onClose=${onClose}>
      <div class="share-qr"><${QR} text=${url} /></div>
      <p class="code" aria-label="Invite code">${prettyCode(code)}</p>
      <p class="muted center">Only people with this link or code can open the invite.</p>
      <div class="share-btns">
        ${navigator.share && html`<button type="button" class="btn primary" onClick=${share}>Share…</button>`}
        <a class="btn" href=${`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener">WhatsApp</a>
        <button type="button" class="btn" onClick=${() => copyText(url, 'Link copied')}>Copy link</button>
        <button type="button" class="btn" onClick=${() => copyText(`${text} ${url}`, 'Message copied')}>Copy message</button>
      </div>
      ${hostUrl && html`
        <div class="card pad host-link">
          <p class="mini-label">Your private host link</p>
          <p class="muted">Open this on another phone to manage the dinner there, or give it to a co-host. Anyone who has it can edit everything, so don’t post it in the group.</p>
          <button type="button" class="btn sm" onClick=${() => copyText(hostUrl, 'Host link copied. Keep it private.')}>Copy host link</button>
        </div>
      `}
    <//>
  `;
}

function ManageSheet({ ev, code, store, patchEvent, onClose, go }) {
  const [announce, setAnnounce] = useState(ev.announce || '');
  const [confirm, setConfirm] = useState(false);
  return html`
    <${Sheet} title="Manage dinner" onClose=${onClose}>
      <${Field} label="Announcement" hint="Pinned at the top of the invite for everyone." id="m-ann">
        <textarea id="m-ann" class="input" rows="2" maxlength="240" placeholder="Running 30 minutes late, bring a jacket…" value=${announce} onInput=${(e) => setAnnounce(e.target.value)}></textarea>
      <//>
      <button type="button" class="btn primary block" onClick=${() => { patchEvent({ announce: announce.trim() }); toast('Announcement updated'); }}>${announce.trim() ? 'Post announcement' : 'Clear announcement'}</button>
      <div class="switch-row">
        <div><strong>Lock orders</strong><span class="muted">Stop guests changing food and dishes once you’ve shopped.</span></div>
        <button type="button" class=${`toggle ${ev.locked ? 'on' : ''}`} role="switch" aria-checked=${!!ev.locked} aria-label="Lock orders" onClick=${() => patchEvent({ locked: !ev.locked })}><span class="toggle-knob"></span></button>
      </div>
      <button type="button" class="btn danger block" onClick=${() => setConfirm(true)}>Delete this dinner</button>
      ${confirm && html`<${Confirm} title="Delete this dinner?" body="The invite, every reply and every order will be gone for everyone. This cannot be undone." action="Delete" danger onYes=${async () => { await store.deleteEvent(code); forgetEvent(code); go(''); }} onClose=${() => setConfirm(false)} />`}
    <//>
  `;
}
