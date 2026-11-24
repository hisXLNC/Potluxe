// Guided setup, also used by the host to edit an existing event.
import { html, useState, useEffect, useRef } from '../vendor/htm-preact.js';
import { THEMES, EMOJI, MENU_TEMPLATES, blankEvent } from './templates.js';
import { Cover, Field, Toggle, toast, themeStyle } from './ui.js';
import { id, CURRENCIES, guessCurrency, money, fmtDay, fmtTime, mapsLinks, placeQuery, shrinkImage, ls } from './util.js';

const STEPS = [
  { key: 'kind', title: 'What’s cooking?', sub: 'Pick a starting point. You can change every detail afterwards.' },
  { key: 'basics', title: 'Name your dinner', sub: 'This is what guests see when they open the invite.' },
  { key: 'when', title: 'When is it?', sub: 'Guests can add it to their calendar in one tap.' },
  { key: 'where', title: 'Where is it?', sub: 'Search for the address so guests get directions.' },
  { key: 'menu', title: 'The menu', sub: 'Guests pick what they want and how they want it. Prices are optional.' },
  { key: 'bring', title: 'What should people bring?', sub: 'Guests claim dishes from this list, or add their own.' },
  { key: 'costs', title: 'Splitting the bill', sub: 'Everyone sees their own share as they order.' },
  { key: 'review', title: 'Ready to invite', sub: 'Check it over. You can edit anything later.' },
];

export function Wizard({ initial, onDone, onCancel, editing }) {
  const [d, setD] = useState(() => initial || ls.get('ts:draft', null) || blankEvent(guessCurrency()));
  const [step, setStep] = useState(editing ? 1 : 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const top = useRef();
  const up = (fn) => setD((old) => { const n = structuredClone(old); fn(n); return n; });

  useEffect(() => { if (!editing) ls.set('ts:draft', { ...d, cover: { ...d.cover, img: null } }); }, [d]);
  useEffect(() => { top.current?.scrollIntoView({ block: 'start' }); setErr(''); }, [step]);

  const s = STEPS[step];
  const validate = () => {
    if (s.key === 'basics' && !d.title.trim()) return 'Give your dinner a name.';
    if (s.key === 'basics' && !d.hostName.trim()) return 'Add your name so guests know who is hosting.';
    if (s.key === 'when' && !d.date) return 'Pick a date.';
    return '';
  };
  const next = () => {
    const e = validate();
    if (e) return setErr(e);
    setStep(step + 1);
  };
  const finish = async () => {
    for (const st of ['basics', 'when']) {
      const bad = (st === 'basics' && (!d.title.trim() || !d.hostName.trim())) || (st === 'when' && !d.date);
      if (bad) { setStep(STEPS.findIndex((x) => x.key === st)); return setErr('Fill in the missing details first.'); }
    }
    setBusy(true);
    try {
      await onDone(d);
      if (!editing) ls.set('ts:draft', null);
    } catch (e) {
      setErr(e.message || 'Could not save. Check your connection and try again.');
      setBusy(false);
    }
  };

  const steps = editing ? STEPS.slice(1, 7) : STEPS;
  return html`
    <div class="wizard" style=${themeStyle(d.cover.theme)} ref=${top}>
      <header class="wiz-top">
        <button type="button" class="btn ghost sm" onClick=${onCancel}>${editing ? 'Cancel' : '← Home'}</button>
        ${editing
          ? html`<button type="button" class="btn primary sm" disabled=${busy} onClick=${finish}>${busy ? 'Saving…' : 'Save changes'}</button>`
          : html`<span class="wiz-count">Step ${step + 1} of ${STEPS.length}</span>`}
      </header>
      ${editing
        ? html`<nav class="chips wiz-nav" aria-label="Sections">${steps.map((st) => html`<button type="button" class=${`chip ${st.key === s.key ? 'on' : ''}`} onClick=${() => setStep(STEPS.indexOf(st))}>${st.key === 'basics' ? 'Details' : st.key[0].toUpperCase() + st.key.slice(1)}</button>`)}</nav>`
        : html`<div class="progress" aria-hidden="true"><div class="progress-bar" style=${`width:${((step + 1) / STEPS.length) * 100}%`}></div></div>`}

      <div class="wiz-head">
        <h1>${s.title}</h1>
        <p class="muted">${s.sub}</p>
      </div>

      <div class="wiz-body">
        ${s.key === 'kind' && html`<${KindStep} d=${d} up=${up} next=${() => setStep(1)} />`}
        ${s.key === 'basics' && html`<${BasicsStep} d=${d} up=${up} />`}
        ${s.key === 'when' && html`<${WhenStep} d=${d} up=${up} />`}
        ${s.key === 'where' && html`<${WhereStep} d=${d} up=${up} />`}
        ${s.key === 'menu' && html`<${MenuStep} d=${d} up=${up} />`}
        ${s.key === 'bring' && html`<${BringStep} d=${d} up=${up} />`}
        ${s.key === 'costs' && html`<${CostsStep} d=${d} up=${up} />`}
        ${s.key === 'review' && html`<${ReviewStep} d=${d} goto=${(k) => setStep(STEPS.findIndex((x) => x.key === k))} />`}
      </div>

      ${err && html`<p class="error" role="alert">${err}</p>`}

      ${!editing && s.key !== 'kind' && html`
        <footer class="wiz-foot">
          <button type="button" class="btn ghost" onClick=${() => setStep(step - 1)}>Back</button>
          ${s.key === 'review'
            ? html`<button type="button" class="btn primary grow" disabled=${busy} onClick=${finish}>${busy ? 'Creating…' : 'Create invite'}</button>`
            : html`<button type="button" class="btn primary grow" onClick=${next}>Continue</button>`}
        </footer>
      `}
    </div>
  `;
}

function KindStep({ d, up, next }) {
  const pick = (t) => {
    const built = t.build();
    up((n) => {
      n.menu = { enabled: true, template: t.key, sections: built.sections };
      n.bring = { enabled: true, items: built.bring };
      n.cover.emoji = t.emoji;
      n.cover.theme = t.theme;
      if (!n.title.trim() && t.key !== 'blank') n.title = t.name;
    });
    next();
  };
  return html`
    <div class="kind-grid">
      ${MENU_TEMPLATES.map((t) => html`
        <button type="button" class=${`kind ${d.menu.template === t.key ? 'on' : ''}`} style=${themeStyle(t.theme)} onClick=${() => pick(t)}>
          <span class="kind-emoji" aria-hidden="true">${t.emoji}</span>
          <span class="kind-name">${t.name}</span>
          <span class="kind-hint">${t.hint}</span>
        </button>
      `)}
    </div>
    ${d.menu.template && html`<button type="button" class="btn ghost block" onClick=${next}>Keep my current menu and continue</button>`}
  `;
}

function BasicsStep({ d, up }) {
  const file = useRef();
  const onPhoto = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const img = await shrinkImage(f);
      up((n) => { n.cover.img = img; });
    } catch (er) {
      toast(er.message);
    }
    e.target.value = '';
  };
  return html`
    <${Cover} ev=${d} small>
      <p class="eyebrow">Preview</p>
      <h2 class="cover-title">${d.title || 'Your dinner'}</h2>
      <p class="cover-meta">Hosted by ${d.hostName || 'you'}</p>
    <//>
    <${Field} label="Dinner name" id="w-title">
      <input id="w-title" class="input" value=${d.title} maxlength="60" placeholder="Saturday burger night" onInput=${(e) => up((n) => { n.title = e.target.value; })} />
    <//>
    <${Field} label="Your name" id="w-host">
      <input id="w-host" class="input" value=${d.hostName} maxlength="40" placeholder="Name guests know you by" autocomplete="given-name" onInput=${(e) => up((n) => { n.hostName = e.target.value; })} />
    <//>
    <${Field} label="A note for guests" hint="Optional. Dress code, parking, what to expect." id="w-blurb">
      <textarea id="w-blurb" class="input" rows="3" maxlength="400" placeholder="Come hungry. Kids welcome." value=${d.blurb} onInput=${(e) => up((n) => { n.blurb = e.target.value; })}></textarea>
    <//>
    <div class="field">
      <span class="field-label">Colour</span>
      <div class="swatches">
        ${Object.entries(THEMES).map(([k, t]) => html`
          <button type="button" class=${`swatch ${d.cover.theme === k ? 'on' : ''}`} style=${themeStyle(k)} aria-label=${t.name} aria-pressed=${d.cover.theme === k} onClick=${() => up((n) => { n.cover.theme = k; })}></button>
        `)}
      </div>
    </div>
    <div class="field">
      <span class="field-label">Cover</span>
      <div class="emoji-row">
        ${EMOJI.map((e) => html`<button type="button" class=${`emoji-btn ${!d.cover.img && d.cover.emoji === e ? 'on' : ''}`} onClick=${() => up((n) => { n.cover.emoji = e; n.cover.img = null; })}>${e}</button>`)}
      </div>
      <div class="row gap">
        <button type="button" class="btn ghost sm" onClick=${() => file.current.click()}>${d.cover.img ? 'Change photo' : 'Use a photo instead'}</button>
        ${d.cover.img && html`<button type="button" class="btn ghost sm" onClick=${() => up((n) => { n.cover.img = null; })}>Remove photo</button>`}
      </div>
      <input ref=${file} type="file" accept="image/*" hidden onChange=${onPhoto} />
    </div>
  `;
}

function WhenStep({ d, up }) {
  const today = new Date().toISOString().slice(0, 10);
  return html`
    <${Field} label="Date" id="w-date">
      <input id="w-date" class="input big" type="date" min=${today} value=${d.date} onInput=${(e) => up((n) => { n.date = e.target.value; })} />
    <//>
    <div class="two">
      <${Field} label="Starts" id="w-time">
        <input id="w-time" class="input big" type="time" value=${d.time} onInput=${(e) => up((n) => { n.time = e.target.value; })} />
      <//>
      <${Field} label="Ends (optional)" id="w-end">
        <input id="w-end" class="input big" type="time" value=${d.endTime} onInput=${(e) => up((n) => { n.endTime = e.target.value; })} />
      <//>
    </div>
    <${Field} label="Reply and order by (optional)" hint="Shown to guests so you have time to shop." id="w-rsvp">
      <input id="w-rsvp" class="input" type="date" min=${today} max=${d.date || undefined} value=${d.rsvpBy} onInput=${(e) => up((n) => { n.rsvpBy = e.target.value; })} />
    <//>
    ${d.date && html`<p class="callout">${fmtDay(d)} at ${fmtTime(d.time)}${d.endTime ? ` until ${fmtTime(d.endTime)}` : ''}</p>`}
  `;
}

function describe(f) {
  const p = f.properties;
  const line1 = [p.housenumber, p.street].filter(Boolean).join(' ');
  const parts = [p.name !== line1 ? p.name : '', line1, p.district || p.locality, p.city, p.state, p.country].filter(Boolean);
  return [...new Set(parts)];
}

function WhereStep({ d, up }) {
  const [q, setQ] = useState(d.place.address);
  const [hits, setHits] = useState([]);
  const [state, setState] = useState('');
  const timer = useRef();
  const search = (text) => {
    setQ(text);
    up((n) => { n.place.address = text; n.place.lat = null; n.place.lon = null; });
    clearTimeout(timer.current);
    if (text.trim().length < 3) return setHits([]);
    timer.current = setTimeout(async () => {
      setState('Searching…');
      try {
        const res = await fetch(`https://photon.komoot.io/api/?limit=6&q=${encodeURIComponent(text)}`);
        const json = await res.json();
        setHits(json.features || []);
        setState(json.features?.length ? '' : 'No matches. You can still type the full address by hand.');
      } catch {
        setHits([]);
        setState('Address search is unavailable. Type the full address by hand.');
      }
    }, 350);
  };
  const choose = (f) => {
    const parts = describe(f);
    const address = parts.join(', ');
    up((n) => {
      n.place.address = address;
      n.place.lon = f.geometry.coordinates[0];
      n.place.lat = f.geometry.coordinates[1];
    });
    setQ(address);
    setHits([]);
  };
  const links = mapsLinks(d.place);
  return html`
    <${Field} label="Place name (optional)" id="w-pname">
      <input id="w-pname" class="input" value=${d.place.name} maxlength="60" placeholder="Our place, the clubhouse, Sam’s garden" onInput=${(e) => up((n) => { n.place.name = e.target.value; })} />
    <//>
    <${Field} label="Address" id="w-addr" hint=${state || 'Start typing, then pick a match to pin it on the map.'}>
      <input id="w-addr" class="input" value=${q} autocomplete="off" placeholder="12 Oak Avenue, Springfield" onInput=${(e) => search(e.target.value)} />
    <//>
    ${hits.length > 0 && html`
      <ul class="hits">
        ${hits.map((f) => { const parts = describe(f); return html`<li><button type="button" onClick=${() => choose(f)}><strong>${parts[0]}</strong><span>${parts.slice(1).join(', ')}</span></button></li>`; })}
      </ul>
    `}
    ${placeQuery(d.place) && !hits.length && html`
      <div class="map"><iframe title="Map preview" src=${links.embed} loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
      <p class="field-hint">${d.place.lat != null ? 'Pinned. ' : ''}Guests get buttons for Google Maps, Apple Maps and Waze. <a href=${links.google} target="_blank" rel="noopener">Check it in Google Maps</a></p>
    `}
    <${Field} label="Arrival notes (optional)" id="w-pnotes">
      <input id="w-pnotes" class="input" value=${d.place.notes} maxlength="160" placeholder="Gate code 4321, park on the street" onInput=${(e) => up((n) => { n.place.notes = e.target.value; })} />
    <//>
  `;
}

const priceInput = (value, onChange, label = 'Price') => html`
  <input class="input price" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0" aria-label=${label} value=${value || ''} onInput=${(e) => onChange(parseFloat(e.target.value) || 0)} />
`;

function MenuStep({ d, up }) {
  const cur = d.costs.currency;
  return html`
    <div class="switch-row">
      <div><strong>Guests choose from a menu</strong><span class="muted">Turn off for a simple get-together.</span></div>
      <${Toggle} on=${d.menu.enabled} label="Menu ordering" onChange=${(v) => up((n) => { n.menu.enabled = v; })} />
    </div>
    ${d.menu.enabled && html`
      ${d.menu.sections.map((sec, si) => html`
        <section class="card editor" key=${sec.id}>
          <div class="row gap">
            <input class="input title-input" value=${sec.name} placeholder="Section name" aria-label="Section name" onInput=${(e) => up((n) => { n.menu.sections[si].name = e.target.value; })} />
            <button type="button" class="icon-btn" aria-label="Remove section" onClick=${() => up((n) => { n.menu.sections.splice(si, 1); })}>✕</button>
          </div>
          <p class="mini-label">Dishes <span>Price (${cur})</span></p>
          ${sec.items.map((it, ii) => html`
            <div class="edit-row" key=${it.id}>
              <input class="input" value=${it.name} placeholder="Dish name" aria-label="Dish name" onInput=${(e) => up((n) => { n.menu.sections[si].items[ii].name = e.target.value; })} />
              ${priceInput(it.price, (v) => up((n) => { n.menu.sections[si].items[ii].price = v; }))}
              <button type="button" class="icon-btn" aria-label="Remove dish" onClick=${() => up((n) => { n.menu.sections[si].items.splice(ii, 1); })}>✕</button>
            </div>
          `)}
          <button type="button" class="btn ghost sm" onClick=${() => up((n) => { n.menu.sections[si].items.push({ id: id(), name: '', price: 0, desc: '' }); })}>+ Add dish</button>

          ${sec.mods.map((mod, mi) => html`
            <div class="mod-edit" key=${mod.id}>
              <div class="row gap">
                <input class="input" value=${mod.name} placeholder="Choice, e.g. Doneness" aria-label="Choice name" onInput=${(e) => up((n) => { n.menu.sections[si].mods[mi].name = e.target.value; })} />
                <button type="button" class="icon-btn" aria-label="Remove choice" onClick=${() => up((n) => { n.menu.sections[si].mods.splice(mi, 1); })}>✕</button>
              </div>
              <div class="seg" role="group" aria-label="How many can guests pick">
                <button type="button" class=${!mod.multi ? 'on' : ''} onClick=${() => up((n) => { n.menu.sections[si].mods[mi].multi = false; })}>Pick one</button>
                <button type="button" class=${mod.multi ? 'on' : ''} onClick=${() => up((n) => { n.menu.sections[si].mods[mi].multi = true; })}>Pick any</button>
              </div>
              ${mod.choices.map((c, ci) => html`
                <div class="edit-row" key=${c.id}>
                  <input class="input" value=${c.name} placeholder="Option" aria-label="Option" onInput=${(e) => up((n) => { n.menu.sections[si].mods[mi].choices[ci].name = e.target.value; })} />
                  ${priceInput(c.price, (v) => up((n) => { n.menu.sections[si].mods[mi].choices[ci].price = v; }), 'Extra cost')}
                  <button type="button" class="icon-btn" aria-label="Remove option" onClick=${() => up((n) => { n.menu.sections[si].mods[mi].choices.splice(ci, 1); })}>✕</button>
                </div>
              `)}
              <button type="button" class="btn ghost sm" onClick=${() => up((n) => { n.menu.sections[si].mods[mi].choices.push({ id: id(), name: '', price: 0 }); })}>+ Add option</button>
            </div>
          `)}
          <button type="button" class="btn ghost sm" onClick=${() => up((n) => { n.menu.sections[si].mods.push({ id: id(), name: '', multi: false, choices: [{ id: id(), name: '', price: 0 }] }); })}>+ Add a choice for these dishes (doneness, sauce, extras)</button>
        </section>
      `)}
      <button type="button" class="btn ghost block" onClick=${() => up((n) => { n.menu.sections.push({ id: id(), name: '', items: [{ id: id(), name: '', price: 0, desc: '' }], mods: [] }); })}>+ Add a menu section</button>
    `}
  `;
}

function BringStep({ d, up }) {
  return html`
    <div class="switch-row">
      <div><strong>Guests bring something</strong><span class="muted">Everyone sees who has claimed what.</span></div>
      <${Toggle} on=${d.bring.enabled} label="Bring list" onChange=${(v) => up((n) => { n.bring.enabled = v; })} />
    </div>
    ${d.bring.enabled && html`
      <section class="card editor">
        <p class="mini-label">Suggested dish <span>How many needed</span></p>
        ${d.bring.items.map((it, i) => html`
          <div class="edit-row" key=${it.id}>
            <input class="input" value=${it.name} placeholder="Salad, dessert, ice…" aria-label="Dish to bring" onInput=${(e) => up((n) => { n.bring.items[i].name = e.target.value; })} />
            <input class="input price" type="number" inputmode="numeric" min="1" max="20" aria-label="How many needed" value=${it.qty} onInput=${(e) => up((n) => { n.bring.items[i].qty = Math.max(1, parseInt(e.target.value) || 1); })} />
            <button type="button" class="icon-btn" aria-label="Remove" onClick=${() => up((n) => { n.bring.items.splice(i, 1); })}>✕</button>
          </div>
        `)}
        <button type="button" class="btn ghost sm" onClick=${() => up((n) => { n.bring.items.push({ id: id(), name: '', qty: 1 }); })}>+ Add a suggestion</button>
      </section>
    `}
  `;
}

function CostsStep({ d, up }) {
  const cur = d.costs.currency;
  return html`
    <${Field} label="Currency" id="w-cur">
      <select id="w-cur" class="input" value=${cur} onChange=${(e) => up((n) => { n.costs.currency = e.target.value; })}>
        ${CURRENCIES.map((c) => html`<option value=${c}>${c}</option>`)}
      </select>
    <//>
    <section class="card editor">
      <p class="mini-label">Shared costs, split evenly per head <span>Amount (${cur})</span></p>
      ${d.costs.shared.map((c, i) => html`
        <div class="edit-row" key=${c.id}>
          <input class="input" value=${c.name} placeholder="Charcoal, drinks, venue…" aria-label="Shared cost" onInput=${(e) => up((n) => { n.costs.shared[i].name = e.target.value; })} />
          ${priceInput(c.amount, (v) => up((n) => { n.costs.shared[i].amount = v; }), 'Amount')}
          <button type="button" class="icon-btn" aria-label="Remove" onClick=${() => up((n) => { n.costs.shared.splice(i, 1); })}>✕</button>
        </div>
      `)}
      <button type="button" class="btn ghost sm" onClick=${() => up((n) => { n.costs.shared.push({ id: id(), name: '', amount: 0 }); })}>+ Add a shared cost</button>
    </section>
    <${Field} label="How to pay you (optional)" hint="Shown next to each guest’s share. Leave blank if dinner is on you." id="w-pay">
      <textarea id="w-pay" class="input" rows="2" maxlength="200" placeholder="Cash on the night, or bank transfer to …" value=${d.costs.payNote} onInput=${(e) => up((n) => { n.costs.payNote = e.target.value; })}></textarea>
    <//>
  `;
}

function ReviewStep({ d, goto }) {
  const dishes = d.menu.sections.reduce((n, s) => n + s.items.filter((i) => i.name.trim()).length, 0);
  const shared = d.costs.shared.reduce((s, c) => s + (c.amount || 0), 0);
  const Row = ({ k, label, value }) => html`<button type="button" class="review-row" onClick=${() => goto(k)}><span class="muted">${label}</span><span>${value}</span><span class="chev" aria-hidden="true">›</span></button>`;
  return html`
    <${Cover} ev=${d} small>
      <p class="eyebrow">${fmtDay(d)}</p>
      <h2 class="cover-title">${d.title || 'Your dinner'}</h2>
      <p class="cover-meta">Hosted by ${d.hostName || 'you'}</p>
    <//>
    <div class="card list">
      <${Row} k="when" label="When" value=${d.date ? `${fmtDay(d)}, ${fmtTime(d.time)}` : 'Not set'} />
      <${Row} k="where" label="Where" value=${[d.place.name, d.place.address].filter(Boolean).join(', ') || 'Not set'} />
      <${Row} k="menu" label="Menu" value=${d.menu.enabled ? `${dishes} dish${dishes === 1 ? '' : 'es'}` : 'Off'} />
      <${Row} k="bring" label="Bring list" value=${d.bring.enabled ? `${d.bring.items.filter((i) => i.name.trim()).length} suggestions` : 'Off'} />
      <${Row} k="costs" label="Shared costs" value=${shared ? money(shared, d.costs.currency) : 'None'} />
    </div>
    <p class="muted center">Next you’ll get a private link and code to share. Only people who have it can open the invite.</p>
  `;
}

// Drop rows the host left empty so guests never see blank options.
export function tidy(d) {
  const n = structuredClone(d);
  n.title = n.title.trim();
  n.hostName = n.hostName.trim();
  n.menu.sections = n.menu.sections
    .map((s) => ({
      ...s,
      name: s.name.trim() || 'Menu',
      items: s.items.filter((i) => i.name.trim()),
      mods: s.mods.map((m) => ({ ...m, name: m.name.trim() || 'Options', choices: m.choices.filter((c) => c.name.trim()) })).filter((m) => m.choices.length),
    }))
    .filter((s) => s.items.length);
  n.bring.items = n.bring.items.filter((i) => i.name.trim());
  n.costs.shared = n.costs.shared.filter((c) => c.name.trim() && c.amount > 0);
  return n;
}
