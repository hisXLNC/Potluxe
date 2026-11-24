// Data layer. Two interchangeable backends with the same interface:
//   live  - Firebase (Firestore + anonymous sign-in): real-time, shared between everyone with the code
//   demo  - this browser only (localStorage), used until firebase-config.js is filled in
import { firebaseConfig } from './firebase-config.js';
import { rand, sha256hex, newCode, ls } from './util.js';

const FB = 'https://www.gstatic.com/firebasejs/11.0.2';
const plain = (o) => JSON.parse(JSON.stringify(o)); // strips undefined, which Firestore rejects

export async function initStore() {
  if (firebaseConfig?.projectId) return liveStore();
  return demoStore();
}

/* ---------------- live: Firebase ---------------- */
async function liveStore() {
  const [{ initializeApp }, auth, fs] = await Promise.all([import(`${FB}/firebase-app.js`), import(`${FB}/firebase-auth.js`), import(`${FB}/firebase-firestore.js`)]);
  const app = initializeApp(firebaseConfig);
  const a = auth.getAuth(app);
  const cred = await auth.signInAnonymously(a);
  const uid = cred.user.uid;
  const db = fs.getFirestore(app);
  const evRef = (code) => fs.doc(db, 'events', code);
  const guestRef = (code, gid) => fs.doc(db, 'events', code, 'guests', gid);
  const hostRef = (code) => fs.doc(db, 'events', code, 'hosts', uid);

  return {
    mode: 'live',
    uid,
    async createEvent(data) {
      const code = newCode();
      const hostKey = rand(24);
      await fs.setDoc(evRef(code), plain({ ...data, hostKeyHash: await sha256hex(hostKey), createdAt: Date.now() }));
      await fs.setDoc(hostRef(code), { key: hostKey });
      return { code, hostKey };
    },
    watchEvent(code, cb, onError) {
      return fs.onSnapshot(evRef(code), (snap) => cb(snap.exists() ? { id: code, ...snap.data() } : null), onError);
    },
    watchGuests(code, cb, onError) {
      return fs.onSnapshot(fs.collection(db, 'events', code, 'guests'), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
    },
    updateEvent: (code, patch) => fs.updateDoc(evRef(code), plain(patch)),
    setGuest: (code, gid, data) => fs.setDoc(guestRef(code, gid), plain({ ...data, updatedAt: data.updatedAt || Date.now() })),
    deleteGuest: (code, gid) => fs.deleteDoc(guestRef(code, gid)),
    async deleteEvent(code) {
      const guests = await fs.getDocs(fs.collection(db, 'events', code, 'guests'));
      await Promise.all(guests.docs.map((d) => fs.deleteDoc(d.ref)));
      await fs.deleteDoc(evRef(code));
    },
    async isHost(code) {
      try {
        return (await fs.getDoc(hostRef(code))).exists();
      } catch {
        return false;
      }
    },
    async hostKey(code) {
      const snap = await fs.getDoc(hostRef(code));
      return snap.exists() ? snap.data().key : null;
    },
    async claimHost(code, key) {
      try {
        await fs.setDoc(hostRef(code), { key });
        return true;
      } catch {
        return false;
      }
    },
  };
}

/* ---------------- demo: this browser only ---------------- */
function demoStore() {
  const KEY = 'ts:demo-db';
  let uid = ls.get('ts:uid', null);
  if (!uid) ls.set('ts:uid', (uid = rand(20)));
  const read = () => ls.get(KEY, { events: {}, guests: {}, hosts: {} });
  const listeners = new Set();
  const chan = 'BroadcastChannel' in window ? new BroadcastChannel('potluxe') : null;
  const fire = () => listeners.forEach((fn) => fn());
  const write = (db) => {
    ls.set(KEY, db);
    fire();
    chan?.postMessage('changed');
  };
  if (chan) chan.onmessage = fire;
  const watch = (pick, cb) => {
    const fn = () => cb(pick(read()));
    listeners.add(fn);
    queueMicrotask(fn);
    return () => listeners.delete(fn);
  };

  return {
    mode: 'demo',
    uid,
    async createEvent(data) {
      const code = newCode();
      const hostKey = rand(24);
      const db = read();
      db.events[code] = plain({ ...data, hostKeyHash: await sha256hex(hostKey), createdAt: Date.now() });
      db.guests[code] = {};
      db.hosts[code] = { [uid]: hostKey };
      write(db);
      return { code, hostKey };
    },
    watchEvent: (code, cb) => watch((db) => (db.events[code] ? { id: code, ...db.events[code] } : null), cb),
    watchGuests: (code, cb) => watch((db) => Object.entries(db.guests[code] || {}).map(([id, g]) => ({ id, ...g })), cb),
    async updateEvent(code, patch) {
      const db = read();
      if (!db.events[code]) throw new Error('Event not found');
      Object.assign(db.events[code], plain(patch));
      write(db);
    },
    async setGuest(code, gid, data) {
      const db = read();
      (db.guests[code] ||= {})[gid] = plain({ ...data, updatedAt: data.updatedAt || Date.now() });
      write(db);
    },
    async deleteGuest(code, gid) {
      const db = read();
      delete db.guests[code]?.[gid];
      write(db);
    },
    async deleteEvent(code) {
      const db = read();
      delete db.events[code];
      delete db.guests[code];
      delete db.hosts[code];
      write(db);
    },
    isHost: async (code) => !!read().hosts[code]?.[uid],
    hostKey: async (code) => read().hosts[code]?.[uid] || null,
    async claimHost(code, key) {
      const db = read();
      if (!db.events[code] || (await sha256hex(key)) !== db.events[code].hostKeyHash) return false;
      (db.hosts[code] ||= {})[uid] = key;
      write(db);
      return true;
    },
  };
}
