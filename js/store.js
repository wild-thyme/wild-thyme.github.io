/* Storage. One small interface, two backends:

     local — IndexedDB in this browser only (used until Firebase is configured)
     cloud — Firestore under users/{uid}/…, with its offline cache switched on,
             so the phone and the laptop see the same library and it still
             works on a train with no signal.

   Collections: books, notes (one per book, keyed by book id), pins, shelves, meta.
   Every doc carries its own `id`. Writes return immediately; the sync badge
   watches the pending count. */

import { firebaseConfig } from './firebase-config.js';

const FB = '12.19.0';
const COLS = ['books', 'notes', 'pins', 'shelves', 'meta'];

let impl = null;
const statusSubs = new Set();

export const Store = {
  mode: firebaseConfig && firebaseConfig.apiKey ? 'cloud' : 'local',
  user: null,
  pending: 0,

  async init() {
    impl = this.mode === 'cloud' ? await makeCloud(firebaseConfig) : await makeLocal();
    addEventListener('online', emitStatus);
    addEventListener('offline', emitStatus);
  },

  /* auth (cloud only; local mode has a single implicit reader) */
  onAuth(cb) { return impl.onAuth ? impl.onAuth(cb) : (cb({ uid: 'local' }), () => {}); },
  signIn: (e, p) => impl.signIn(e, p),
  signUp: (e, p) => impl.signUp(e, p),
  resetPassword: e => impl.resetPassword(e),
  signOut: () => impl.signOut?.(),

  /* reads */
  list: (col, where) => impl.list(col, where),
  get: (col, id) => impl.get(col, id),
  /** cb(docs, info) now and on every change. where = [field, value]. Returns unsubscribe. */
  watch: (col, cb, where) => impl.watch(col, cb, where),
  /** cb(doc|null, info) now and on every change. */
  watchDoc: (col, id, cb) => impl.watchDoc(col, id, cb),

  /* writes */
  put(col, doc) {
    doc.updatedAt = Date.now();
    track(impl.putMany(col, [doc]));
    return doc;
  },
  putMany(col, docs) {
    const t = Date.now();
    docs.forEach(d => { d.updatedAt = t; });
    return track(impl.putMany(col, docs));
  },
  patch(col, id, fields) {
    return track(impl.patch(col, id, { ...fields, updatedAt: Date.now() }));
  },
  remove: (col, id) => track(impl.removeMany(col, [id])),
  removeMany: (col, ids) => track(impl.removeMany(col, ids)),

  async exportAll() {
    const out = { app: 'wild-thyme', version: 1, exported: new Date().toISOString() };
    for (const c of COLS) out[c] = await impl.list(c);
    return out;
  },

  /** The key that opens the letters: in Firestore (sealed/key) for a signed-in
      member; in local preview it can be set by hand as localStorage 'wt.sealkey'. */
  getSealKey: () => (impl.getSealKey ? impl.getSealKey() : Promise.resolve(localStorage.getItem('wt.sealkey'))),

  status() {
    return { mode: this.mode, online: navigator.onLine, pending: this.pending };
  },
  onStatus(cb) { statusSubs.add(cb); cb(this.status()); return () => statusSubs.delete(cb); },
};

function emitStatus() { const s = Store.status(); statusSubs.forEach(cb => cb(s)); }

function track(p) {
  Store.pending++;
  emitStatus();
  return Promise.resolve(p)
    .catch(err => { console.error('write failed', err); throw err; })
    .finally(() => { Store.pending--; emitStatus(); });
}

/* Firestore refuses undefined and class instances; IndexedDB refuses functions.
   Round-tripping through JSON gives both of them plain data. */
const plain = d => JSON.parse(JSON.stringify(d));

/* ------------------------------------------------------------------ local */

function makeLocal() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('wild-thyme', 1);
    r.onupgradeneeded = () => { for (const c of COLS) r.result.createObjectStore(c, { keyPath: 'id' }); };
    r.onerror = () => reject(r.error);
    r.onsuccess = () => resolve(localImpl(r.result));
  });
}

function localImpl(db) {
  const subs = new Set();
  const bc = 'BroadcastChannel' in self ? new BroadcastChannel('wild-thyme') : null;
  const notify = (col, fromOtherTab) => {
    for (const s of subs) if (s.col === col) s.fire();
    if (!fromOtherTab) bc?.postMessage(col);
  };
  if (bc) bc.onmessage = e => notify(e.data, true);

  const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const done = t => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = t.onabort = () => rej(t.error); });
  const matches = (d, where) => !where || d[where[0]] === where[1];

  const list = async (col, where) =>
    (await req(db.transaction(col).objectStore(col).getAll())).filter(d => matches(d, where));
  const get = async (col, id) => (await req(db.transaction(col).objectStore(col).get(id))) || null;

  return {
    list, get,
    async putMany(col, docs) {
      const t = db.transaction(col, 'readwrite');
      const s = t.objectStore(col);
      for (const d of docs) s.put(plain(d));
      await done(t);
      notify(col);
    },
    async patch(col, id, fields) {
      const t = db.transaction(col, 'readwrite');
      const s = t.objectStore(col);
      const g = s.get(id);
      g.onsuccess = () => s.put(plain({ ...(g.result || { id }), ...fields }));
      await done(t);
      notify(col);
    },
    async removeMany(col, ids) {
      const t = db.transaction(col, 'readwrite');
      const s = t.objectStore(col);
      for (const id of ids) s.delete(id);
      await done(t);
      notify(col);
    },
    watch(col, cb, where) {
      let alive = true, seq = 0;
      const fire = async () => {
        const n = ++seq;
        const docs = await list(col, where);
        if (alive && n === seq) cb(docs, { fromCache: false });
      };
      const s = { col, fire };
      subs.add(s);
      fire();
      return () => { alive = false; subs.delete(s); };
    },
    watchDoc(col, id, cb) {
      let alive = true, seq = 0;
      const fire = async () => {
        const n = ++seq;
        const d = await get(col, id);
        if (alive && n === seq) cb(d, { fromCache: false });
      };
      const s = { col, fire };
      subs.add(s);
      fire();
      return () => { alive = false; subs.delete(s); };
    },
  };
}

/* ------------------------------------------------------------------ cloud */

async function makeCloud(cfg) {
  const base = `https://www.gstatic.com/firebasejs/${FB}/`;
  const [appM, A, F] = await Promise.all([
    import(base + 'firebase-app.js'),
    import(base + 'firebase-auth.js'),
    import(base + 'firebase-firestore.js'),
  ]);
  const app = appM.initializeApp(cfg);
  // initializeAuth without a popup resolver: email + passphrase only, so no
  // cross-site iframe gets loaded (which Safari would block anyway).
  const auth = A.initializeAuth(app, {
    persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence],
  });
  let db;
  try {
    db = F.initializeFirestore(app, {
      localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  } catch (e) {
    console.warn('offline cache unavailable, continuing online-only', e);
    db = F.getFirestore(app);
  }

  let uid = null;
  const colRef = col => F.collection(db, 'users', uid, col);
  const docRef = (col, id) => F.doc(db, 'users', uid, col, id);
  const q = (col, where) => (where ? F.query(colRef(col), F.where(where[0], '==', where[1])) : colRef(col));

  return {
    onAuth(cb) {
      return A.onAuthStateChanged(auth, u => {
        uid = u ? u.uid : null;
        Store.user = u ? { uid: u.uid, email: u.email } : null;
        cb(Store.user);
      });
    },
    signIn: (e, p) => A.signInWithEmailAndPassword(auth, e, p),
    signUp: (e, p) => A.createUserWithEmailAndPassword(auth, e, p),
    resetPassword: e => A.sendPasswordResetEmail(auth, e),
    signOut: () => A.signOut(auth),

    async getSealKey() {
      const s = await F.getDoc(F.doc(db, 'sealed', 'key'));
      return s.exists() ? s.data().k : null;
    },
    async list(col, where) {
      const snap = await F.getDocs(q(col, where));
      return snap.docs.map(d => d.data());
    },
    async get(col, id) {
      const s = await F.getDoc(docRef(col, id));
      return s.exists() ? s.data() : null;
    },
    async putMany(col, docs) {
      // Firestore batches cap at 500 writes.
      for (let i = 0; i < docs.length; i += 450) {
        const b = F.writeBatch(db);
        for (const d of docs.slice(i, i + 450)) b.set(docRef(col, d.id), plain(d));
        await b.commit();
      }
    },
    patch: (col, id, fields) => F.setDoc(docRef(col, id), plain({ id, ...fields }), { merge: true }),
    async removeMany(col, ids) {
      for (let i = 0; i < ids.length; i += 450) {
        const b = F.writeBatch(db);
        for (const id of ids.slice(i, i + 450)) b.delete(docRef(col, id));
        await b.commit();
      }
    },
    watch(col, cb, where) {
      return F.onSnapshot(q(col, where), { includeMetadataChanges: false }, snap =>
        cb(snap.docs.map(d => d.data()), { fromCache: snap.metadata.fromCache }),
        err => console.error('watch', col, err));
    },
    watchDoc(col, id, cb) {
      return F.onSnapshot(docRef(col, id), { includeMetadataChanges: true }, s =>
        cb(s.exists() ? s.data() : null, { fromCache: s.metadata.fromCache, pending: s.metadata.hasPendingWrites }),
        err => console.error('watchDoc', col, id, err));
    },
  };
}

/** Whatever was kept in this browser before syncing was switched on, if anything.
    Used once, after she first signs in, to carry it over into her account. */
export async function readLocalArchive() {
  if (indexedDB.databases) {
    const dbs = await indexedDB.databases().catch(() => []);
    if (!dbs.some(d => d.name === 'wild-thyme')) return null;
  }
  const db = await makeLocal().catch(() => null);
  if (!db) return null;
  const out = {};
  for (const c of ['books', 'notes', 'pins', 'shelves']) out[c] = await db.list(c).catch(() => []);
  return out.books.length ? out : null;
}

/** Friendly words for Firebase auth errors. */
export function authMessage(err) {
  const code = String(err?.code || '');
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
    return 'That email and passphrase don’t match our register.';
  if (code.includes('email-already-in-use')) return 'That email has already taken the oath — try entering instead.';
  if (code.includes('weak-password')) return 'The passphrase must be at least six characters.';
  if (code.includes('invalid-email')) return 'That doesn’t look like an email address.';
  if (code.includes('too-many-requests')) return 'Too many attempts. Rest a moment, then try again.';
  if (code.includes('network')) return 'No connection to the archive. Check the internet and try again.';
  if (code.includes('operation-not-allowed') || code.includes('admin-restricted')) return 'The door is closed to new members.';
  return err?.message || 'Something went wrong.';
}
