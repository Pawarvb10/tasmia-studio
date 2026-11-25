(() => {
  const ROLE = window.__MOCKUSER || {id: 'owner1', owner: true, admin: true, name: 'Studio Owner'};
  const K = 'mockdb';
  const load = () => JSON.parse(localStorage.getItem(K) || '{}');
  const store = obj => localStorage.setItem(K, JSON.stringify(obj));
  const L = [];
  const segs = p => p.split('/');
  function notify(){ const S = load(); L.forEach(l => l.fire(S)); }
  window.addEventListener('storage', e => { if(e.key === K) setTimeout(notify, 10); });
  const meta = {fromCache: false, hasPendingWrites: false};
  function docSnap(path, S){ const j = S[path]; return {id: segs(path).pop(), exists: j != null, data: () => j ? JSON.parse(j) : undefined, metadata: meta}; }
  function docRef(path){ return {id: segs(path).pop(), path,
    get: async () => docSnap(path, load()),
    set: async d => { const S = load(); S[path] = JSON.stringify(d); store(S); setTimeout(notify, 5); },
    update: async d => { const S = load(); S[path] = JSON.stringify(Object.assign(JSON.parse(S[path] || '{}'), d)); store(S); setTimeout(notify, 5); },
    delete: async () => { const S = load(); delete S[path]; store(S); setTimeout(notify, 5); },
    acquire: async () => ({acquired: true}),
    onSnapshot(next){ let last; const l = {fire(S){ const j = S[path] ?? null; if(j === last) return; last = j; next(docSnap(path, S)); }}; L.push(l); setTimeout(() => l.fire(load()), 20); return () => L.splice(L.indexOf(l), 1); },
    collection: c => collRef(path + '/' + c)}; }
  function collRef(cp){ const n = segs(cp).length + 1; const inC = S => Object.keys(S).filter(p => p.startsWith(cp + '/') && segs(p).length === n);
    return {path: cp, doc: id => docRef(cp + '/' + (id || Math.random().toString(36).slice(2))),
      get: async () => { const S = load(); const docs = inC(S).map(p => docSnap(p, S)); return {docs, size: docs.length, empty: !docs.length, docChanges: () => docs.map(d => ({type: 'added', doc: d})), metadata: meta}; },
      onSnapshot(next){ let prev = {}; const l = {fire(S){ const cur = {}; inC(S).forEach(p => cur[p] = S[p]); const ch = []; Object.keys(cur).forEach(p => { if(prev[p] !== cur[p]) ch.push({type: prev[p] ? 'modified' : 'added', doc: docSnap(p, S)}); }); Object.keys(prev).forEach(p => { if(!(p in cur)) ch.push({type: 'removed', doc: {id: segs(p).pop(), exists: true, data: () => JSON.parse(prev[p]), metadata: meta}}); }); const first = !l.started; l.started = true; prev = cur; if(!ch.length && !first) return; const docs = Object.keys(cur).map(p => docSnap(p, S)); next({docs, size: docs.length, empty: !docs.length, docChanges: () => ch, metadata: meta}); }}; L.push(l); setTimeout(() => l.fire(load()), 20); return () => L.splice(L.indexOf(l), 1); }}; }
  const db = {doc: docRef, collection: collRef};
  const user = {id: async () => ROLE.id, isOwner: async () => ROLE.owner, canEdit: async () => ROLE.admin, can: async () => true, me: async () => ({id: ROLE.id, name: ROLE.name}), profiles: async ids => Object.fromEntries(ids.map(i => [i, {name: i === 'owner1' ? 'Studio Owner' : i === 'staff2' ? 'Ramesh Patil' : ''}]))};
  window.__assets = []; window.__saves = [];
  const assets = ROLE.admin ? {upload: async b => { const id = 'a' + Math.random().toString(36).slice(2, 8); window.__assets.push(id); return {id, url: '/_blob/' + id, sizeBytes: b.size, contentType: b.type}; }, delete: async () => {}, list: async () => ({assets: []})} : null;
  const downloads = {save: async ({filename, data}) => { window.__saves.push(filename); return {status: 'saved'}; }};
  window.claude = {use: async n => { await new Promise(r => setTimeout(r, 30)); return {db, user, assets, downloads}[n] || null; }};
})();
