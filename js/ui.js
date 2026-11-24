// Shared building blocks.
import { html, useState, useEffect } from '../vendor/htm-preact.js';
import { THEMES } from './templates.js';

export const themeStyle = (key) => {
  const t = THEMES[key] || THEMES.ember;
  return `--c1:${t.c1};--c2:${t.c2};--c3:${t.c3};--cover-ink:${t.ink}`;
};

export function Cover({ ev, small, children }) {
  const img = ev.cover?.img;
  return html`
    <div class=${`cover ${small ? 'cover-sm' : ''} ${img ? 'has-img' : ''}`} style=${themeStyle(ev.cover?.theme)}>
      ${img ? html`<img class="cover-img" src=${img} alt="" />` : html`<div class="cover-art" aria-hidden="true"><span class="cover-emoji">${ev.cover?.emoji || '🍽️'}</span></div>`}
      <div class="cover-shade"></div>
      <div class="cover-body">${children}</div>
    </div>
  `;
}

export function Field({ label, hint, children, id }) {
  return html`
    <label class="field" for=${id}>
      <span class="field-label">${label}</span>
      ${children}
      ${hint && html`<span class="field-hint">${hint}</span>`}
    </label>
  `;
}

export function Stepper({ value, min = 1, max = 20, onChange, label }) {
  return html`
    <div class="stepper" role="group" aria-label=${label}>
      <button type="button" class="step-btn" disabled=${value <= min} onClick=${() => onChange(value - 1)} aria-label="Fewer">−</button>
      <span class="step-val">${value}</span>
      <button type="button" class="step-btn" disabled=${value >= max} onClick=${() => onChange(value + 1)} aria-label="More">+</button>
    </div>
  `;
}

export function Toggle({ on, onChange, label }) {
  return html`
    <button type="button" class=${`toggle ${on ? 'on' : ''}`} role="switch" aria-checked=${on} aria-label=${label} onClick=${() => onChange(!on)}>
      <span class="toggle-knob"></span>
    </button>
  `;
}

// Bottom sheet on phones, centred dialog on wide screens.
export function Sheet({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, []);
  return html`
    <div class="sheet-wrap" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class=${`sheet ${wide ? 'sheet-wide' : ''}`} role="dialog" aria-modal="true" aria-label=${title}>
        <div class="sheet-head">
          <h2>${title}</h2>
          <button type="button" class="icon-btn" onClick=${onClose} aria-label="Close">✕</button>
        </div>
        <div class="sheet-body">${children}</div>
      </div>
    </div>
  `;
}

export function Confirm({ title, body, action, danger, onYes, onClose }) {
  return html`
    <${Sheet} title=${title} onClose=${onClose}>
      <p class="muted">${body}</p>
      <div class="row gap end">
        <button type="button" class="btn ghost" onClick=${onClose}>Cancel</button>
        <button type="button" class=${`btn ${danger ? 'danger' : 'primary'}`} onClick=${() => { onYes(); onClose(); }}>${action}</button>
      </div>
    <//>
  `;
}

let pushToast = () => {};
export const toast = (msg) => pushToast(msg);
export function Toasts() {
  const [list, setList] = useState([]);
  useEffect(() => {
    pushToast = (msg) => {
      const t = { id: Math.random(), msg };
      setList((l) => [...l.slice(-1), t]);
      setTimeout(() => setList((l) => l.filter((x) => x !== t)), 2600);
    };
  }, []);
  return html`<div class="toasts" aria-live="polite">${list.map((t) => html`<div class="toast" key=${t.id}>${t.msg}</div>`)}</div>`;
}

export async function copyText(text, done = 'Copied') {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toast('Could not copy. Select and copy it by hand.');
  }
}

export function QR({ text, size = 168 }) {
  const qr = window.qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return html`<svg class="qr" width=${size} height=${size} viewBox=${`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label="QR code for the invite link"><rect x="-2" y="-2" width=${n + 4} height=${n + 4} fill="#fff" /><path d=${d} fill="#111" /></svg>`;
}

export const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
export function Avatar({ name, i = 0 }) {
  const hue = [...(name || '?')].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  return html`<span class="avatar" style=${`--h:${hue}`}>${initials(name)}</span>`;
}
