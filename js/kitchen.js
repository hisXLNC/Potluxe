// Kitchen ticket: what to cook, for whom, big enough to read at the grill and printable.
import { html, useState } from '../vendor/htm-preact.js';
import { bringBoard, cookSheet, going, headcount, personTickets } from './calc.js';
import { fmtDay, fmtTime } from './util.js';

export function Kitchen({ ev, guests }) {
  const [view, setView] = useState('cook');
  const [big, setBig] = useState(false);
  const sheet = cookSheet(ev, guests);
  const tickets = personTickets(ev, guests);
  const diets = going(guests).filter((g) => (g.diet || '').trim());
  const board = bringBoard(ev, guests);
  const waiting = going(guests).filter((g) => !(g.lines || []).length);
  const totalPlates = sheet.reduce((n, s) => n + s.items.reduce((a, i) => a + i.count, 0), 0);

  return html`
    <header class="tab-head no-print">
      <h1>Kitchen</h1>
      <p class="muted">Live totals for whoever is cooking. Only hosts see this tab.</p>
    </header>
    <div class="kitchen-tools no-print">
      <div class="seg" role="group" aria-label="Ticket layout">
        <button type="button" class=${view === 'cook' ? 'on' : ''} onClick=${() => setView('cook')}>Cook sheet</button>
        <button type="button" class=${view === 'people' ? 'on' : ''} onClick=${() => setView('people')}>Per person</button>
      </div>
      <button type="button" class=${`btn ${big ? 'on' : ''}`} aria-pressed=${big} onClick=${() => setBig(!big)}>Aa Large</button>
      <button type="button" class="btn primary" onClick=${() => window.print()}>Print</button>
    </div>

    <div class=${`ticket ${big ? 'ticket-big' : ''}`} id="ticket">
      <div class="ticket-head">
        <p class="ticket-title">${ev.title}</p>
        <p>${fmtDay(ev)} · ${fmtTime(ev.time)}</p>
        <p>${headcount(guests)} people · ${totalPlates} plate${totalPlates === 1 ? '' : 's'} ordered</p>
      </div>

      ${view === 'cook' && html`
        ${sheet.map((sec) => html`
          <div class="ticket-sec" key=${sec.id}>
            <p class="ticket-label">${sec.name}</p>
            ${sec.items.map((item) => html`
              <div class="ticket-item" key=${item.id}>
                <p class="ticket-dish"><span class="qty">${item.count}×</span> ${item.name}</p>
                ${item.variants.map((v) => html`
                  <div class="ticket-variant">
                    <span class="qty">${v.who.length}</span>
                    <span><strong>${v.spec}</strong>${v.note && html` <em>“${v.note}”</em>`}<br /><span class="ticket-who">${v.who.join(', ')}</span></span>
                  </div>
                `)}
              </div>
            `)}
          </div>
        `)}
        ${!sheet.length && html`<p class="ticket-empty">No orders yet.</p>`}
      `}

      ${view === 'people' && html`
        <div class="ticket-people">
          ${tickets.map((t) => html`
            <div class="ticket-person">
              <p class="ticket-dish">${t.who}${t.via && html` <span class="ticket-who">(with ${t.via})</span>`}</p>
              ${t.lines.map((l) => html`<p class="ticket-line"><span class="box" aria-hidden="true"></span><span><strong>${l.name}</strong>${l.spec && html`<br />${l.spec}`}${l.note && html`<br /><em>“${l.note}”</em>`}</span></p>`)}
              ${t.diet && html`<p class="ticket-alert">⚠ ${t.diet}</p>`}
            </div>
          `)}
        </div>
        ${!tickets.length && html`<p class="ticket-empty">No orders yet.</p>`}
      `}

      ${diets.length > 0 && html`
        <div class="ticket-sec">
          <p class="ticket-label">Allergies and dietary</p>
          ${diets.map((g) => html`<p class="ticket-alert">⚠ ${g.name}: ${g.diet}</p>`)}
        </div>
      `}
      ${waiting.length > 0 && ev.menu?.enabled && html`
        <div class="ticket-sec">
          <p class="ticket-label">Going, not ordered yet</p>
          <p>${waiting.map((g) => g.name).join(', ')}</p>
        </div>
      `}
      ${view === 'cook' && ev.bring?.enabled && (board.items.length > 0 || board.extras.length > 0) && html`
        <div class="ticket-sec">
          <p class="ticket-label">Guests are bringing</p>
          ${board.items.map((it) => html`<p class="ticket-bring"><span>${it.name} ${it.claims.length}/${it.qty}</span><span class="ticket-who">${it.claims.map((c) => c.name).join(', ') || 'unclaimed'}</span></p>`)}
          ${board.extras.map((b) => html`<p class="ticket-bring"><span>${b.name}</span><span class="ticket-who">${b.by}</span></p>`)}
        </div>
      `}
      <p class="ticket-foot">Printed ${new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
    </div>
  `;
}
