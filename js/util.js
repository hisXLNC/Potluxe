// Small helpers shared across the app.

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no look-alikes (0/O, 1/I/L)

export function rand(n, alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789') {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return s;
}
export const newCode = () => rand(8, CODE_ALPHABET);
export const prettyCode = (c) => (c || '').replace(/^(.{4})(.{4})$/, '$1-$2');
export const cleanCode = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const id = () => rand(7);

export async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'ZAR', 'AED', 'SAR', 'EGP', 'CAD', 'AUD', 'NZD', 'INR', 'PKR', 'NGN', 'KES', 'TRY', 'CHF', 'SEK', 'JPY', 'BRL', 'MXN'];

export function guessCurrency() {
  const region = (navigator.language || 'en-US').split('-')[1] || 'US';
  const map = { US: 'USD', GB: 'GBP', ZA: 'ZAR', AE: 'AED', SA: 'SAR', EG: 'EGP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', IN: 'INR', PK: 'PKR', NG: 'NGN', KE: 'KES', TR: 'TRY', CH: 'CHF', SE: 'SEK', JP: 'JPY', BR: 'BRL', MX: 'MXN' };
  const euro = ['DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'IE', 'PT', 'AT', 'FI', 'GR'];
  return map[region] || (euro.includes(region) ? 'EUR' : 'USD');
}

export function money(amount, currency = 'USD') {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function eventDate(ev) {
  if (!ev?.date) return null;
  const d = new Date(`${ev.date}T${ev.time || '18:00'}`);
  return isNaN(d) ? null : d;
}
export function fmtDay(ev) {
  const d = eventDate(ev);
  return d ? d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : 'Date to be confirmed';
}
export function fmtTime(t) {
  if (!t) return '';
  const d = new Date(`2000-01-01T${t}`);
  return isNaN(d) ? t : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
export function countdown(ev) {
  const d = eventDate(ev);
  if (!d) return '';
  const ms = d - Date.now();
  const days = Math.floor(ms / 864e5);
  if (ms < -6 * 36e5) return 'This dinner has happened';
  if (ms < 0) return 'Happening now';
  if (days === 0) {
    const h = Math.floor(ms / 36e5);
    return h < 1 ? 'Starting within the hour' : `In ${h} hour${h === 1 ? '' : 's'}`;
  }
  return days === 1 ? 'Tomorrow' : `In ${days} days`;
}

export const placeQuery = (p) => (p?.lat != null ? `${p.lat},${p.lon}` : [p?.name, p?.address].filter(Boolean).join(', '));
export const mapsLinks = (p) => {
  const q = encodeURIComponent(placeQuery(p));
  const label = encodeURIComponent([p?.name, p?.address].filter(Boolean).join(', '));
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    apple: `https://maps.apple.com/?q=${label}${p?.lat != null ? `&ll=${p.lat},${p.lon}` : ''}`,
    waze: p?.lat != null ? `https://waze.com/ul?ll=${p.lat},${p.lon}&navigate=yes` : `https://waze.com/ul?q=${label}`,
    embed: `https://maps.google.com/maps?q=${q}&z=15&output=embed`,
  };
};

function icsStamp(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
export function calendarLinks(ev, url) {
  const start = eventDate(ev);
  if (!start) return null;
  let end = ev.endTime ? new Date(`${ev.date}T${ev.endTime}`) : new Date(+start + 3 * 36e5);
  if (end <= start) end = new Date(+end + 864e5);
  const where = [ev.place?.name, ev.place?.address].filter(Boolean).join(', ');
  const details = `${ev.blurb || ''}\n\n${url}`.trim();
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&dates=${icsStamp(start)}/${icsStamp(end)}&location=${encodeURIComponent(where)}&details=${encodeURIComponent(details)}`;
  const escIcs = (s) => (s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tableside//EN', 'BEGIN:VEVENT', `UID:${ev.id}@tableside`, `DTSTAMP:${icsStamp(new Date())}`, `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`, `SUMMARY:${escIcs(ev.title)}`, `LOCATION:${escIcs(where)}`, `DESCRIPTION:${escIcs(details)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return { google, ics: `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}` };
}

export const eventUrl = (code) => `${location.origin}${location.pathname}#${code}`;

// Resize a picked photo so it fits comfortably inside one database document.
export function shrinkImage(file, maxSide = 1100, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      let q = quality;
      let out = c.toDataURL('image/jpeg', q);
      while (out.length > 320000 && q > 0.3) out = c.toDataURL('image/jpeg', (q -= 0.12));
      URL.revokeObjectURL(img.src);
      out.length > 500000 ? reject(new Error('That photo is too large. Try a smaller one.')) : resolve(out);
    };
    img.onerror = () => reject(new Error('That file could not be read as a photo.'));
    img.src = URL.createObjectURL(file);
  });
}

export const ls = {
  get(k, fallback) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

export function rememberEvent(ev, isHost) {
  const list = ls.get('ts:mine', []).filter((e) => e.id !== ev.id);
  list.unshift({ id: ev.id, title: ev.title, date: ev.date, time: ev.time, theme: ev.cover?.theme, emoji: ev.cover?.emoji, host: !!isHost });
  ls.set('ts:mine', list.slice(0, 20));
}
export function forgetEvent(code) {
  ls.set('ts:mine', ls.get('ts:mine', []).filter((e) => e.id !== code));
}
