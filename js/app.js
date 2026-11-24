// Entry point: tiny hash router, home screen, and wiring between screens.
import { html, render, useState, useEffect } from '../vendor/htm-preact.js';
import { initStore } from './store.js';
import { Wizard, tidy } from './wizard.js';
import { EventPage } from './event.js';
import { Toasts, toast, themeStyle } from './ui.js';
import { cleanCode, prettyCode, ls, fmtDay } from './util.js';

function parseHash() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  if (!h) return { view: 'home' };
  if (h === 'new') return { view: 'new' };
  const [code, kind, key] = h.split('/');
  const clean = cleanCode(code);
  if (clean.length !== 8) return { view: 'home' };
  return { view: 'event', code: clean, hostKey: kind === 'host' ? key : null };
}

function App({ store }) {
  const [route, setRoute] = useState(parseHash);
  const [fresh, setFresh] = useState(null);
  useEffect(() => {
    const on = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (hash) => { location.hash = hash; };

  const create = async (draft) => {
    const data = tidy(draft);
    const { code } = await store.createEvent(data);
    await store.setGuest(code, store.uid, { name: data.hostName, status: 'yes', party: 1, diet: '', lines: [], brings: [] });
    setFresh(code);
    go(code);
    toast('Your invite is live');
  };

  return html`
    ${route.view === 'home' && html`<${Home} store=${store} go=${go} />`}
    ${route.view === 'new' && html`<${Wizard} onDone=${create} onCancel=${() => go('')} />`}
    ${route.view === 'event' && html`<${EventPage} key=${route.code} store=${store} code=${route.code} hostKey=${route.hostKey} openShare=${fresh === route.code} go=${go} />`}
    <${Toasts} />
  `;
}

function Home({ store, go }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const mine = ls.get('ts:mine', []);
  useEffect(() => { document.title = 'Tableside'; }, []);
  const join = (e) => {
    e.preventDefault();
    const c = cleanCode(code);
    if (c.length !== 8) return setErr('Codes are 8 letters and numbers, like ABCD-EFGH.');
    go(c);
  };
  return html`
    <main class="page home">
      <section class="hero">
        <div class="hero-plates" aria-hidden="true"><span>🍔</span><span>🥩</span><span>🌮</span><span>🥗</span><span>🍰</span></div>
        <p class="brand">Tableside</p>
        <h1>Dinner at yours, sorted.</h1>
        <p class="hero-sub">Send one private link. Guests reply, choose their food, claim a dish to bring and see their share of the bill.</p>
        <button type="button" class="btn primary big" onClick=${() => go('new')}>Host a dinner</button>
      </section>

      <form class="card pad join" onSubmit=${join}>
        <label class="field-label" for="join-code">Got an invite code?</label>
        <div class="row gap">
          <input id="join-code" class="input code-input grow" value=${code} maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH" onInput=${(e) => { setCode(e.target.value.toUpperCase()); setErr(''); }} />
          <button type="submit" class="btn">Open</button>
        </div>
        ${err && html`<p class="error" role="alert">${err}</p>`}
      </form>

      ${mine.length > 0 && html`
        <section>
          <h2 class="h3">Your dinners</h2>
          <div class="mine">
            ${mine.map((e) => html`
              <button type="button" class="mine-card" style=${themeStyle(e.theme)} onClick=${() => go(e.id)}>
                <span class="mine-emoji" aria-hidden="true">${e.emoji || '🍽️'}</span>
                <span class="mine-text"><strong>${e.title}</strong><span>${fmtDay(e)}</span></span>
                <span class="tag">${e.host ? 'Hosting' : prettyCode(e.id)}</span>
              </button>
            `)}
          </div>
        </section>
      `}

      <section class="features">
        ${[
          ['🔒', 'Private by default', 'Only people with your link or code can open the invite.'],
          ['🥩', 'Orders with detail', 'Burger extras, steak doneness, sauces. Each with a price if you like.'],
          ['🧺', 'A live bring board', 'Everyone sees who has claimed which dish, as it happens.'],
          ['🧾', 'A ticket for the cook', 'Totals per dish and per person, on screen or printed.'],
        ].map(([icon, title, body]) => html`<div class="feature"><span aria-hidden="true">${icon}</span><div><strong>${title}</strong><p class="muted">${body}</p></div></div>`)}
      </section>

      ${store.mode === 'demo' && html`<p class="note">Preview mode: dinners are saved on this device only, so links won’t work for other people yet. Connect the free database (see README) to go live.</p>`}
    </main>
  `;
}

const root = document.getElementById('app');
initStore()
  .then((store) => render(html`<${App} store=${store} />`, root))
  .catch((e) => {
    console.error(e);
    root.innerHTML = '<main class="page center-page"><div class="card pad center"><h1 class="h2">Could not connect</h1><p class="muted">Check your internet connection and reload the page.</p></div></main>';
  });
