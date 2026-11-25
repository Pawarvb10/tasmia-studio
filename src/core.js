'use strict';
/* =====================================================================
   Tasmia Designers — Boutique Order-to-Billing v3
   core.js : utilities, permissions, storage (local + central), change
             history, media files, downloads, PDF engine
   ===================================================================== */
const APP_VERSION = '3.0';
const STORE = 'boutique_o2b_v3';
const CPLX = {Simple: 1, Medium: 1.5, Heavy: 2, Couture: 3};
let DB = null;            // in-memory data
let ME = null;            // {id, name, role, workerId}
let MODE = 'local';       // 'local' | 'central'
let SC = null;            // schedule cache
let HOL = null;           // holiday cache
let EDIT = null;          // order draft
const UI = {};            // per-view UI state

/* ---------------- utilities ---------------- */
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const v = x => h(x ?? '');
const num = x => { const n = parseFloat(x); return isNaN(n) ? 0 : n; };
const r2 = x => Math.round(num(x) * 100) / 100;
const inr = x => '₹' + Math.round(num(x)).toLocaleString('en-IN');
const inr2 = x => '₹' + num(x).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const rs = x => 'Rs. ' + num(x).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const uid = p => (p || 'x') + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);
const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const nowISO = () => new Date().toISOString();
function iso(d){ const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
const todayISO = () => iso(new Date());
function parseD(s){ return new Date(String(s).length === 10 ? s + 'T00:00:00' : s); }
function fmtD(s){ if(!s) return '—'; const d = parseD(s); return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'}); }
function fmtDs(s){ if(!s) return '—'; const d = parseD(s); return isNaN(d) ? '—' : d.toLocaleDateString('en-IN', {day: '2-digit', month: 'short'}); }
function fmtDT(s){ if(!s) return '—'; const d = parseD(s); return isNaN(d) ? '—' : d.toLocaleString('en-IN', {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'}); }
function sod(d){ const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n){ const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addDaysISO(s, n){ return iso(addDays(parseD(s), n)); }
function daysBetween(a, b){ return Math.round((sod(parseD(b)) - sod(parseD(a))) / 864e5); }
const opt = (val, label, cur) => `<option value="${h(val)}" ${String(val) === String(cur ?? '') ? 'selected' : ''}>${h(label)}</option>`;
function getPath(o, p){ return p.split('.').reduce((a, k) => a == null ? a : a[k], o); }
function setPath(o, p, val){ const ks = p.split('.'); let x = o; for(let i = 0; i < ks.length - 1; i++){ if(x[ks[i]] == null) x[ks[i]] = {}; x = x[ks[i]]; } x[ks[ks.length - 1]] = val; }
function toast(msg, type){ const t = document.createElement('div'); t.className = 'toast ' + (type || ''); t.textContent = msg; document.getElementById('toasts').appendChild(t); setTimeout(() => t.remove(), 4200); }
function words(n){
  n = Math.floor(num(n)); if(n === 0) return 'Zero';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '');
  const three = x => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
  let s = ''; const cr = Math.floor(n / 1e7); n %= 1e7; const l = Math.floor(n / 1e5); n %= 1e5; const th = Math.floor(n / 1000); n %= 1000;
  if(cr) s += (cr >= 100 ? words(cr) : two(cr)) + ' Crore ';
  if(l) s += two(l) + ' Lakh '; if(th) s += two(th) + ' Thousand '; if(n) s += three(n);
  return s.trim();
}
function amountWords(x){ const p = Math.round((num(x) % 1) * 100); return 'Rupees ' + words(x) + (p ? ' and ' + words(p) + ' Paise' : '') + ' Only'; }
function waLink(phone, text){ let d = String(phone || '').replace(/\D/g, ''); if(d.length === 10) d = '91' + d; return `https://wa.me/${d}?text=${encodeURIComponent(text)}`; }
function smsLink(phone, text){ let d = String(phone || '').replace(/\D/g, ''); if(d.length === 10) d = '91' + d; return `sms:${d ? '+' + d : ''}?body=${encodeURIComponent(text)}`; }
const IN_FRAME = (() => { try{ return window.self !== window.top; }catch(e){ return true; } })();
const by = (f, dir) => (a, b) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * (dir || 1); };
const sum = (arr, f) => arr.reduce((a, x) => a + num(f ? f(x) : x), 0);
const isNarrow = () => window.matchMedia('(max-width: 900px)').matches;

/* ---------------- lookups ---------------- */
const ST = () => DB.settings;
const coll = n => DB[n] || (DB[n] = []);
const find = (n, id) => id ? coll(n).find(x => x.id === id) : undefined;
const cust = id => find('customers', id);
const ord = id => find('orders', id);
const gar = id => find('garments', id);
const worker = id => find('workers', id);
const vendor = id => find('vendors', id);
const tpl = id => find('templates', id);
const design = id => find('designs', id);
const item = id => find('inventory', id);
const prof = id => find('profiles', id);
const inv = id => find('invoices', id);
const stage = id => find('stages', id) || {id, name: id || '?', kind: 'work', group: 'other', head: 'other', rate: 0};
const garmentsOf = oid => coll('garments').filter(g => g.orderId === oid).sort(by(g => g.idx));
const headName = id => (ST().heads.find(x => x.id === id) || {name: id || 'Other'}).name;

/* ---------------- roles & permissions ---------------- */
const PERMS = [
  ['dash', 'Dashboard (production)'], ['mytasks', 'My tasks'], ['orders', 'View orders & garments'], ['orders.edit', 'Create & edit orders'],
  ['customers', 'Customers & measurements'], ['production', 'Update production steps'], ['planner', 'Stitching & delivery planner'],
  ['embroidery', 'Embroidery & handwork'], ['trials', 'Trials & alterations'], ['qc', 'QC & delivery'], ['workers', 'Workers & workload'],
  ['payroll', 'Worker payments'], ['vendors', 'Outside vendors'], ['vendors.pay', 'Vendor payments'], ['inventory', 'Materials & inventory'],
  ['billing', 'Billing, invoices & receipts'], ['prices', 'See prices & costs'], ['reports', 'Owner reports & profitability'],
  ['comms', 'Customer communication'], ['config', 'Configurator (garment types, designs)'], ['setup', 'Setup, users & backups'], ['alerts', 'Alerts']];
const ROLES = {owner: 'Owner', manager: 'Manager / front desk', master: 'Cutting & stitching master', artisan: 'Artisan / worker', accounts: 'Accounts'};
function defaultPerms(){
  const all = PERMS.map(p => p[0]);
  return {
    owner: all,
    manager: all.filter(p => !['setup', 'reports'].includes(p)),
    master: ['dash', 'mytasks', 'orders', 'customers', 'production', 'planner', 'embroidery', 'trials', 'qc', 'workers', 'inventory', 'alerts', 'comms'],
    artisan: ['mytasks'],
    accounts: ['dash', 'orders', 'customers', 'billing', 'prices', 'payroll', 'vendors', 'vendors.pay', 'reports', 'inventory', 'alerts', 'comms']
  };
}
function can(p){ if(!ME) return false; if(ME.role === 'owner') return true; return ((ST().perms || defaultPerms())[ME.role] || []).includes(p); }
const meName = () => ME ? ME.name : 'System';

/* ---------------- change history ---------------- */
function diffObj(a, b, path, out){
  out = out || []; path = path || '';
  if(out.length > 40) return out;
  const ign = /^(history|_|updated)/;
  if(a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)){
    new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => { if(!ign.test(k)) diffObj(a[k], b[k], path ? path + '.' + k : k, out); });
    return out;
  }
  if(Array.isArray(a) && Array.isArray(b) && a.every(x => x && x.id) && b.every(x => x && x.id)){
    const ma = new Map(a.map(x => [x.id, x])), mb = new Map(b.map(x => [x.id, x]));
    b.forEach(x => { if(!ma.has(x.id)) out.push({f: path, from: '', to: 'added ' + (x.name || x.label || x.desc || x.instruction || stageNameSafe(x.stageId) || 'entry')}); else diffObj(ma.get(x.id), x, path + '[' + (x.name || x.label || stageNameSafe(x.stageId) || x.id) + ']', out); });
    a.forEach(x => { if(!mb.has(x.id)) out.push({f: path, from: (x.name || x.label || x.desc || stageNameSafe(x.stageId) || 'entry'), to: 'removed'}); });
    return out;
  }
  const sa = a == null ? '' : typeof a === 'object' ? JSON.stringify(a) : String(a), sb = b == null ? '' : typeof b === 'object' ? JSON.stringify(b) : String(b);
  if(sa !== sb) out.push({f: path, from: sa.length > 120 ? sa.slice(0, 117) + '…' : sa, to: sb.length > 120 ? sb.slice(0, 117) + '…' : sb});
  return out;
}
function stageNameSafe(id){ try{ return id ? stage(id).name : ''; }catch(e){ return ''; } }
function logChange(ent, action, before, after){
  ent.history = ent.history || [];
  const changes = before !== undefined && after !== undefined ? diffObj(before, after) : [];
  if(before !== undefined && after !== undefined && !changes.length) return;
  ent.history.push({at: nowISO(), by: meName(), action, changes: changes.slice(0, 40)});
  if(ent.history.length > 200) ent.history.splice(0, ent.history.length - 200);
}
function histHTML(list){
  const L = (list || []).slice().reverse();
  if(!L.length) return '<div class="muted">No changes recorded yet.</div>';
  return `<div class="hist">${L.map(x => `<div class="hrow"><div class="muted hwhen">${fmtDT(x.at)}<br>${h(x.by)}</div><div><b>${h(x.action)}</b>${x.changes && x.changes.length ? `<ul>${x.changes.map(c => `<li><span class="muted">${h(c.f)}:</span> ${c.from !== '' ? `<s>${h(c.from)}</s> → ` : ''}${h(c.to)}</li>`).join('')}</ul>` : ''}</div></div>`).join('')}</div>`;
}

/* ---------------- storage: local + central ---------------- */
const COLLS = ['customers', 'profiles', 'orders', 'garments', 'workers', 'vendors', 'stages', 'templates', 'designs', 'inventory', 'movements', 'custMaterials', 'ledger', 'msgTemplates', 'msgLog', 'invoices'];
const CFG = {settings: 'config/settings', counters: 'counters/main', access: 'config/access', state: 'state/main'};
const SYNC = {db: null, user: null, assets: null, downloads: null, synced: new Map(), queue: new Map(), timer: null, flushing: false, subs: [], ready: false, pendingRender: false, firstLoad: {}, readOnly: false};

function emptyDB(){ const d = {settings: null, counters: {order: 1001, inv: 1, rcpt: 1}, access: {roles: {}}, state: {ack: {}, notified: {}, backups: []}}; COLLS.forEach(c => d[c] = []); return d; }
function save(){ SC = null; HOL = null; if(MODE === 'central') queueSync(); else saveLocal(); }
function saveLocal(){ try{ localStorage.setItem(STORE, JSON.stringify(DB)); }catch(e){ toast('Could not save on this device: ' + e.message, 'bad'); } }
function loadLocal(){ try{ const x = JSON.parse(localStorage.getItem(STORE)); return x && x.settings ? x : null; }catch(e){ return null; } }

/* central (claude artifact db) */
function docPaths(){
  const m = new Map();
  if(DB.settings) m.set(CFG.settings, DB.settings);
  m.set(CFG.counters, DB.counters); m.set(CFG.access, DB.access); m.set(CFG.state, DB.state);
  COLLS.forEach(c => coll(c).forEach(r => m.set(c + '/' + r.id, r)));
  return m;
}
function queueSync(){ clearTimeout(SYNC.timer); SYNC.timer = setTimeout(flushSync, 350); setSyncBadge('saving'); }
async function flushSync(){
  if(SYNC.flushing){ queueSync(); return; }
  SYNC.flushing = true;
  try{
    const cur = docPaths(), ops = [];
    cur.forEach((obj, path) => { const j = JSON.stringify(obj); if(SYNC.synced.get(path) !== j) ops.push({path, j}); });
    SYNC.synced.forEach((j, path) => { if(!cur.has(path)) ops.push({path, del: true}); });
    for(const op of ops){
      if(path0(op.path) === 'config' && !SYNC.isAdmin){ SYNC.synced.set(op.path, op.j); continue; }
      try{
        if(op.del){ await SYNC.db.doc(op.path).delete(); SYNC.synced.delete(op.path); }
        else { await SYNC.db.doc(op.path).set(JSON.parse(op.j)); SYNC.synced.set(op.path, op.j); }
      }catch(e){
        if(e && e.code === 'quota_exceeded') toast('Central database is full: ' + e.message, 'bad');
        else if(e && e.code === 'invalid_argument'){ SYNC.synced.set(op.path, op.j); if(!SYNC.warned){ SYNC.warned = 1; toast('You do not have permission to change some records — ask the owner for Contributor access.', 'bad'); } }
        else if(e && e.code === 'unavailable'){ await new Promise(r => setTimeout(r, 800 + Math.random() * 800)); try{ await SYNC.db.doc(op.path).set(JSON.parse(op.j)); SYNC.synced.set(op.path, op.j); }catch(_){} }
        else console.warn('sync', op.path, e);
      }
    }
    setSyncBadge('ok');
  } finally { SYNC.flushing = false; }
}
const path0 = p => p.split('/')[0];
function applyRemote(path, data){
  const j = data === null ? null : JSON.stringify(data);
  if(j !== null && SYNC.synced.get(path) === j) return false;
  const cur = docPaths(), local = cur.has(path) ? JSON.stringify(cur.get(path)) : null;
  const pendingLocal = SYNC.synced.has(path) ? local !== SYNC.synced.get(path) : local !== null && SYNC.firstLoad.done;
  if(pendingLocal) return false;
  const [c, id] = path.split('/');
  if(path === CFG.settings) DB.settings = j ? JSON.parse(j) : DB.settings;
  else if(path === CFG.counters){ if(j) DB.counters = JSON.parse(j); }
  else if(path === CFG.access){ if(j) DB.access = JSON.parse(j); }
  else if(path === CFG.state){ if(j) DB.state = JSON.parse(j); }
  else if(COLLS.includes(c)){
    const arr = coll(c), k = arr.findIndex(x => x.id === id);
    if(j === null){ if(k >= 0) arr.splice(k, 1); }
    else { const o = JSON.parse(j); if(k >= 0) arr[k] = o; else arr.push(o); }
  }
  if(j === null) SYNC.synced.delete(path); else SYNC.synced.set(path, j);
  return true;
}
function remoteChanged(){
  SC = null; HOL = null;
  if(!SYNC.ready) return;
  const a = document.activeElement;
  if(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && document.getElementById('main').contains(a) || route().v === 'neworder'){ SYNC.pendingRender = true; setSyncBadge('remote'); return; }
  softRender();
}
document.addEventListener('focusout', () => setTimeout(() => { if(SYNC.pendingRender && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))){ SYNC.pendingRender = false; if(route().v !== 'neworder') softRender(); } }, 50));
function softRender(){ const y = window.scrollY; render(); window.scrollTo(0, y); }
function setSyncBadge(s){ const el = document.getElementById('syncBadge'); if(!el) return; el.className = 'sync ' + s; el.textContent = MODE === 'local' ? 'Saved on this device' : s === 'saving' ? 'Saving…' : s === 'remote' ? 'Updated by others — click away to refresh' : s === 'off' ? 'Offline — changes queued' : 'Central database · synced'; }

async function connectCentral(){
  let cl;
  try{ cl = window.claude && window.claude.use; }catch(e){ cl = null; }
  if(!cl) return false;
  const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]).catch(() => [null, null]);
  if(!db) return false;
  SYNC.db = db; SYNC.user = user;
  window.claude.use('assets').then(a => SYNC.assets = a).catch(() => {});
  window.claude.use('downloads').then(d => SYNC.downloads = d).catch(() => {});
  try{ SYNC.isOwner = user ? !!(await user.isOwner()) : false; SYNC.isAdmin = user ? !!(await user.canEdit()) || SYNC.isOwner : false; SYNC.uid = user ? await user.id() : null; }catch(e){}
  MODE = 'central'; DB = emptyDB();
  const loads = [];
  const sub = (q, isColl, name) => new Promise(res => {
    let first = true; const t = setTimeout(() => { if(first){ first = false; res(); } }, 10000);
    const un = isColl
      ? q.onSnapshot(snap => {
          let ch = false;
          snap.docChanges().forEach(c => { ch = applyRemote(name + '/' + c.doc.id, c.type === 'removed' ? null : c.doc.data()) || ch; });
          if(first && !snap.metadata.fromCache){ first = false; clearTimeout(t); res(); }
          else if(first){ /* wait for confirmed */ }
          if(!first && ch) remoteChanged();
        }, e => { if(first){ first = false; clearTimeout(t); res(); } if(e.code === 'revoked') SYNC.readOnly = true; })
      : q.onSnapshot(snap => {
          const ch = applyRemote(name, snap.exists ? snap.data() : null);
          if(first && !snap.metadata.fromCache){ first = false; clearTimeout(t); res(); }
          if(!first && ch) remoteChanged();
        }, () => { if(first){ first = false; clearTimeout(t); res(); } });
    SYNC.subs.push(un);
  });
  Object.values(CFG).forEach(p => loads.push(sub(db.doc(p), false, p)));
  COLLS.forEach(c => loads.push(sub(db.collection(c), true, c)));
  await Promise.all(loads);
  SYNC.firstLoad.done = true;
  return true;
}
async function nextNo(key){
  // sequential numbers (order / invoice / receipt) — leased in central mode so two devices never get the same number
  if(MODE === 'central'){
    const ref = SYNC.db.doc(CFG.counters);
    for(let i = 0; i < 14; i++){
      const l = await ref.acquire({holder: (SYNC.uid || 'x') + Math.random().toString(36).slice(2, 6), ttlMs: 1500}).catch(() => ({acquired: false}));
      if(l.acquired){
        const s = await ref.get(); const c = s.exists ? Object.assign({order: 1001, inv: 1, rcpt: 1}, clone(s.data())) : clone(DB.counters);
        const n = num(c[key]) || 1; c[key] = n + 1; await ref.set(c); DB.counters = c; SYNC.synced.set(CFG.counters, JSON.stringify(c)); return n;
      }
      await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
    }
  }
  const n = num(DB.counters[key]) || 1; DB.counters[key] = n + 1; return n;
}
async function wipeCentral(){
  for(const p of [...SYNC.synced.keys()]){ try{ await SYNC.db.doc(p).delete(); }catch(e){} SYNC.synced.delete(p); }
}

/* ---------------- media (photos, sketches, 3D) ---------------- */
const MEDIA = {idb: null, urls: new Map(), mem: new Map()};
function idbOpen(){
  return new Promise(res => {
    const done = () => res(); setTimeout(done, 2500);
    try{ const r = indexedDB.open('boutique_media_v1', 2); r.onupgradeneeded = () => { const d = r.result; if(!d.objectStoreNames.contains('files')) d.createObjectStore('files'); if(!d.objectStoreNames.contains('backups')) d.createObjectStore('backups'); }; r.onsuccess = () => { MEDIA.idb = r.result; done(); }; r.onerror = done; r.onblocked = done; }catch(e){ done(); }
  });
}
function idbPut(store, key, val){ if(!MEDIA.idb) return Promise.resolve(false); return new Promise(res => { try{ const tx = MEDIA.idb.transaction(store, 'readwrite'); tx.objectStore(store).put(val, key); tx.oncomplete = () => res(true); tx.onerror = () => res(false); }catch(e){ res(false); } }); }
function idbGet(store, key){ if(!MEDIA.idb) return Promise.resolve(null); return new Promise(res => { try{ const rq = MEDIA.idb.transaction(store).objectStore(store).get(key); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); }catch(e){ res(null); } }); }
function idbDel(store, key){ if(!MEDIA.idb) return; try{ MEDIA.idb.transaction(store, 'readwrite').objectStore(store).delete(key); }catch(e){} }
function idbKeys(store){ if(!MEDIA.idb) return Promise.resolve([]); return new Promise(res => { try{ const rq = MEDIA.idb.transaction(store).objectStore(store).getAllKeys(); rq.onsuccess = () => res(rq.result || []); rq.onerror = () => res([]); }catch(e){ res([]); } }); }
async function mediaPut(blob){
  if(MODE === 'central' && SYNC.assets){
    try{ const a = await SYNC.assets.upload(blob); return 'asset:' + a.id; }
    catch(e){ toast('Upload to central storage failed (' + (e.code || e.message) + ') — kept on this device only', 'bad'); }
  }
  const id = 'idb:' + uid('m'); MEDIA.mem.set(id, blob); await idbPut('files', id, blob); return id;
}
async function mediaBlob(id){
  if(!id) return null;
  if(MEDIA.mem.has(id)) return MEDIA.mem.get(id);
  if(id.startsWith('asset:')){ try{ const r = await fetch('/_blob/' + id.slice(6)); return r.ok ? await r.blob() : null; }catch(e){ return null; } }
  if(id.startsWith('demo:')){ const u = demoSvg(id); return new Blob([decodeURIComponent(u.split(',')[1])], {type: 'image/svg+xml'}); }
  const b = await idbGet('files', id) || (id.startsWith('idb:') ? null : await idbGet('files', id));
  if(b) MEDIA.mem.set(id, b); return b;
}
async function mediaUrl(id){
  if(!id) return '';
  if(id.startsWith('demo:')) return demoSvg(id);
  if(id.startsWith('asset:')) return '/_blob/' + id.slice(6);
  if(id.startsWith('data:')) return id;
  if(MEDIA.urls.has(id)) return MEDIA.urls.get(id);
  const b = await mediaBlob(id); if(!b) return '';
  const u = URL.createObjectURL(b); MEDIA.urls.set(id, u); return u;
}
function mediaDel(id){ if(id && (id.startsWith('idb:') || /^m/.test(id))){ MEDIA.mem.delete(id); idbDel('files', id); } }
function hydrate(root){
  (root || document).querySelectorAll('[data-media]:not([data-h])').forEach(async el => {
    el.dataset.h = '1'; const u = await mediaUrl(el.dataset.media);
    if(!u){ el.classList.add('missing'); return; }
    if(el.tagName === 'IMG' || el.tagName === 'MODEL-VIEWER') el.setAttribute('src', u);
    else { el.style.backgroundImage = `url("${u}")`; el.textContent = ''; }
  });
}
function readImage(file, max, type){
  return new Promise((res, rej) => {
    if(!/^image\//.test(file.type)) return rej(new Error('not an image'));
    if(file.type === 'image/svg+xml' || file.type === 'image/gif') return res(file);
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const sc = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.width * sc)); c.height = Math.max(1, Math.round(im.height * sc));
      const g = c.getContext('2d'); if(type !== 'image/png'){ g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
      g.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
      c.toBlob(b => res(b || file), type || 'image/jpeg', 0.85);
    };
    im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('could not read image')); };
    im.src = u;
  });
}
function blobToDataURL(b){ return new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }); }
function dataURLToBlob(u){ const [m, d] = u.split(','); const mime = (m.match(/:(.*?);/) || [])[1] || 'application/octet-stream'; const bin = atob(d); const a = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], {type: mime}); }
async function uploadImages(files, max){
  const out = [];
  for(const f of [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}))){
    try{ const b = await readImage(f, max || 1400, 'image/jpeg'); out.push(await mediaPut(b)); }
    catch(e){ toast(`${f.name}: ${e.message}`, 'bad'); }
  }
  return out;
}

/* ---------------- downloads & printing ---------------- */
async function saveFile(filename, data, mime){
  if(SYNC.downloads){
    try{ await SYNC.downloads.save({filename, data}); toast('Saved ' + filename, 'ok'); return true; }
    catch(e){ if(e && e.code === 'declined') return false; if(e && e.code === 'rate_limited'){ toast('A save is already waiting for confirmation', 'bad'); return false; } }
  }
  if(IN_FRAME && MODE === 'central' && !SYNC.downloads){ toast('Downloads are not available in this view', 'bad'); return false; }
  const blob = data instanceof Blob ? data : new Blob([data], {type: mime || 'application/octet-stream'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return true;
}
function csvOf(rows){ return rows.map(r => r.map(c => { const s = String(c ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n'); }
function saveCSV(name, rows){ return saveFile(name, '﻿' + csvOf(rows), 'text/csv'); }

/* ---------------- PDF engine (offline, no libraries) ----------------
   Builds A4 PDFs with Helvetica text, lines, filled boxes, tables with
   wrapping & page breaks, and JPEG images. Used for invoices, receipts,
   measurement sheets, job cards / artisan sheets and reports.          */
const HW = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
function pdfSafe(s){ return String(s ?? '').replace(/₹/g, 'Rs.').replace(/[→›]/g, '->').replace(/[←‹]/g, '<-').replace(/✓|✔/g, 'OK').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[×]/g, 'x').replace(/[·•]/g, '-').replace(/[^\x20-\x7e\n]/g, ''); }
function tw(s, size, bold){ let w = 0; for(const ch of pdfSafe(s)){ const c = ch.charCodeAt(0); w += (c >= 32 && c <= 126 ? HW[c - 32] : 556); } return w * size / 1000 * (bold ? 1.06 : 1); }
function wrapText(s, size, width, bold){
  const out = []; pdfSafe(s).split('\n').forEach(par => {
    let line = ''; par.split(/\s+/).forEach(wd => { const t = line ? line + ' ' + wd : wd; if(tw(t, size, bold) <= width || !line) line = t; else { out.push(line); line = wd; } while(tw(line, size, bold) > width && line.length > 1){ let k = line.length; while(k > 1 && tw(line.slice(0, k), size, bold) > width) k--; out.push(line.slice(0, k)); line = line.slice(k); } });
    out.push(line);
  });
  return out;
}
class PDFDoc {
  constructor(o){ this.W = 595.28; this.H = 841.89; if(o && o.landscape){ this.W = 841.89; this.H = 595.28; } this.M = 36; this.pages = []; this.imgs = []; this.addPage(); }
  addPage(){ this.cur = []; this.pages.push(this.cur); this.y = this.M; }
  esc(s){ return pdfSafe(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
  col(c){ const x = (c || '#222222').replace('#', ''); return [0, 2, 4].map(i => (parseInt(x.substr(i, 2), 16) / 255).toFixed(3)).join(' '); }
  text(x, y, s, size, bold, color, align){
    size = size || 10; let xx = x; if(align === 'right') xx = x - tw(s, size, bold); else if(align === 'center') xx = x - tw(s, size, bold) / 2;
    this.cur.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${this.col(color)} rg ${xx.toFixed(2)} ${(this.H - y).toFixed(2)} Td (${this.esc(s)}) Tj ET`);
  }
  line(x1, y1, x2, y2, color, w){ this.cur.push(`${this.col(color || '#999999')} RG ${w || 0.6} w ${x1.toFixed(2)} ${(this.H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(this.H - y2).toFixed(2)} l S`); }
  rect(x, y, w, hh, fill, stroke){ this.cur.push(`${fill ? this.col(fill) + ' rg ' : ''}${stroke ? this.col(stroke) + ' RG 0.6 w ' : ''}${x.toFixed(2)} ${(this.H - y - hh).toFixed(2)} ${w.toFixed(2)} ${hh.toFixed(2)} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`); }
  image(img, x, y, w, hh){ let k = this.imgs.indexOf(img); if(k < 0){ this.imgs.push(img); k = this.imgs.length - 1; } this.cur.push(`q ${w.toFixed(2)} 0 0 ${hh.toFixed(2)} ${x.toFixed(2)} ${(this.H - y - hh).toFixed(2)} cm /Im${k} Do Q`); }
  need(hh){ if(this.y + hh > this.H - this.M - 14){ this.addPage(); if(this.onPage) this.onPage(this); } }
  /* flowing helpers */
  h1(s, color){ this.need(26); this.text(this.M, this.y + 16, s, 16, true, color || '#7a2948'); this.y += 24; }
  h2(s){ this.need(22); this.y += 4; this.text(this.M, this.y + 11, s, 11, true, '#7a2948'); this.y += 15; this.line(this.M, this.y, this.W - this.M, this.y, '#d9c6cf'); this.y += 6; }
  para(s, size, color, bold){ size = size || 9.5; const lines = wrapText(s, size, this.W - 2 * this.M, bold); lines.forEach(l => { this.need(size + 4); this.text(this.M, this.y + size, l, size, bold, color); this.y += size + 3.5; }); this.y += 2; }
  kv(pairs, cols){
    cols = cols || 3; const cw = (this.W - 2 * this.M) / cols; let i = 0;
    while(i < pairs.length){
      const row = pairs.slice(i, i + cols); let rh = 0;
      const cells = row.map(([k, val]) => { const L = wrapText(val || '—', 9.5, cw - 8, true); rh = Math.max(rh, 12 + L.length * 12); return {k, L}; });
      this.need(rh + 2);
      cells.forEach((c, j) => { const x = this.M + j * cw; this.text(x, this.y + 8, c.k, 7.5, false, '#7d7074'); c.L.forEach((l, n) => this.text(x, this.y + 19 + n * 12, l, 9.5, true)); });
      this.y += rh + 2; i += cols;
    }
    this.y += 2;
  }
  table(cols, rows, opts){
    opts = opts || {}; const size = opts.size || 8.8, W = this.W - 2 * this.M, tot = sum(cols, c => c.w);
    const ws = cols.map(c => c.w / tot * W), pad = 4;
    const HL = cols.map((c, i) => wrapText(c.t || '', 7.8, ws[i] - 2 * pad, true)), hh = Math.max(1, ...HL.map(L => L.length)) * 9.5 + 6.5;
    const header = () => { this.need(hh + 2); this.rect(this.M, this.y, W, hh, '#f4e6ec'); let x = this.M; cols.forEach((c, i) => { const L = HL[i], y0 = this.y + hh - (L.length - 1) * 9.5 - 5; L.forEach((l, n) => this.text(c.align === 'right' ? x + ws[i] - pad : x + pad, y0 + n * 9.5, l, 7.8, true, '#5b1d36', c.align)); x += ws[i]; }); this.y += hh; };
    header();
    rows.forEach(r => {
      if(r._section){ this.need(16); this.rect(this.M, this.y, W, 14, '#faf6f1'); this.text(this.M + pad, this.y + 10, r._section, 8.5, true, '#2b2226'); this.y += 14; return; }
      const cells = r.map((c, i) => wrapText(c ?? '', r._bold ? size + 0.4 : size, ws[i] - 2 * pad, r._bold));
      const rh = Math.max(...cells.map(L => L.length)) * (size + 3) + 6;
      if(this.y + rh > this.H - this.M - 14){ this.addPage(); if(this.onPage) this.onPage(this); header(); }
      let x = this.M; cells.forEach((L, i) => { L.forEach((l, n) => this.text(cols[i].align === 'right' ? x + ws[i] - pad : x + pad, this.y + size + 3 + n * (size + 3), l, size, r._bold, r._color, cols[i].align)); x += ws[i]; });
      this.y += rh; this.line(this.M, this.y, this.M + W, this.y, '#e7ded6', 0.5);
    });
    this.y += 6;
  }
  async images(ids, hgt, captions){
    hgt = hgt || 150; let x = this.M; const W = this.W - 2 * this.M;
    for(let i = 0; i < ids.length; i++){
      const img = await pdfImage(ids[i], 900); if(!img) continue;
      const w = Math.min(W, hgt * img.w / img.h);
      if(x + w > this.M + W + 0.5){ x = this.M; this.y += hgt + (captions ? 16 : 8); }
      this.need(hgt + 16);
      this.image(img, x, this.y, w, hgt); this.rect(x, this.y, w, hgt, null, '#cccccc');
      if(captions && captions[i]) this.text(x, this.y + hgt + 10, captions[i].slice(0, 60), 7.5, false, '#555555');
      x += w + 8;
    }
    this.y += hgt + (captions ? 18 : 10);
  }
  footer(text){ const n = this.pages.length; this.pages.forEach((p, i) => { this.cur = p; this.text(this.M, this.H - 18, pdfSafe(text || ''), 7.5, false, '#888888'); this.text(this.W - this.M, this.H - 18, `Page ${i + 1} of ${n}`, 7.5, false, '#888888', 'right'); }); }
  build(){
    const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
    const put = x => { const b = typeof x === 'string' ? latin1(x) : x; parts.push(b); len += b.length; };
    const latin1 = s => { const a = new Uint8Array(s.length); for(let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; };
    let n = 0; const obj = body => { n++; offs[n] = len; put(`${n} 0 obj\n`); (Array.isArray(body) ? body : [body]).forEach(put); put('\nendobj\n'); return n; };
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const f1 = obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const imIds = this.imgs.map(im => obj([`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`, im.bytes, '\nendstream']));
    const xo = imIds.map((id, i) => `/Im${i} ${id} 0 R`).join(' ');
    const pagesId = n + this.pages.length * 2 + 1;
    const kids = [];
    this.pages.forEach(p => { const s = p.join('\n'); const cId = obj([`<< /Length ${latin1(s).length} >>\nstream\n`, s, '\nendstream']); kids.push(obj(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> /XObject << ${xo} >> >> /Contents ${cId} 0 R >>`)); });
    obj(`<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`);
    const cat = obj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    const xref = len; put(`xref\n0 ${n + 1}\n0000000000 65535 f \n`);
    for(let i = 1; i <= n; i++) put(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
    put(`trailer\n<< /Size ${n + 1} /Root ${cat} 0 R >>\nstartxref\n${xref}\n%%EOF`);
    const out = new Uint8Array(len); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; });
    return new Blob([out], {type: 'application/pdf'});
  }
}
async function pdfImage(id, max){
  try{
    const u = id.startsWith('data:') ? id : await mediaUrl(id); if(!u) return null;
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const sc = Math.min(1, (max || 900) / Math.max(im.naturalWidth || im.width || 600, im.naturalHeight || im.height || 400));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round((im.naturalWidth || 600) * sc)); c.height = Math.max(1, Math.round((im.naturalHeight || 400) * sc));
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
    const d = c.toDataURL('image/jpeg', 0.85), bin = atob(d.split(',')[1]), bytes = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return {w: c.width, h: c.height, bytes};
  }catch(e){ return null; }
}
async function pdfHeader(doc, title, right){
  const s = ST();
  if(s.logo){ const im = await pdfImage(s.logo, 300); if(im){ const hh = 40, w = Math.min(120, hh * im.w / im.h); doc.image(im, doc.M, doc.y, w, hh); doc.text(doc.M + w + 10, doc.y + 16, s.shop, 15, true, '#7a2948'); doc.text(doc.M + w + 10, doc.y + 30, s.tagline || '', 8.5, false, '#7d7074'); doc.y += 46; } else headerText(); }
  else headerText();
  function headerText(){ doc.text(doc.M, doc.y + 16, s.shop, 16, true, '#7a2948'); doc.text(doc.M, doc.y + 30, s.tagline || '', 8.5, false, '#7d7074'); doc.y += 38; }
  const L = [s.address, [s.phone, s.landline, s.email].filter(Boolean).join('  |  '), [s.website, s.gstin ? 'GSTIN: ' + s.gstin : '', s.pan ? 'PAN: ' + s.pan : ''].filter(Boolean).join('  |  ')].filter(Boolean);
  L.forEach(l => { doc.text(doc.M, doc.y + 8, l, 8.3, false, '#444444'); doc.y += 11; });
  const ty = doc.M + 14; doc.text(doc.W - doc.M, ty, title, 15, true, '#7a2948', 'right');
  (right || []).forEach((r, i) => doc.text(doc.W - doc.M, ty + 15 + i * 12, r, 9, i === 0, '#222222', 'right'));
  doc.y = Math.max(doc.y, ty + 15 + (right || []).length * 12) + 6;
  doc.line(doc.M, doc.y, doc.W - doc.M, doc.y, '#7a2948', 1.2); doc.y += 10;
}
async function openPDF(doc, filename){
  doc.footer(`${ST().shop} - generated ${new Date().toLocaleString('en-IN')} by ${meName()}`);
  const blob = doc.build();
  if(!IN_FRAME && MODE === 'local'){
    // local file: open in a new tab where it can be printed, and also offer save
    const u = URL.createObjectURL(blob); const w = window.open(u, '_blank');
    if(!w) await saveFile(filename, blob); else toast('PDF opened in a new tab — print or save from there', 'ok');
    return;
  }
  await saveFile(filename, blob);
}

/* ---------------- dialogs ---------------- */
function ask(msg, yes, okLabel){
  const a = document.getElementById('ask');
  a.innerHTML = `<div class="mbox" style="max-width:480px"><p style="margin:0 0 18px;font-size:15px">${h(msg)}</p><div class="row" style="justify-content:flex-end"><button id="askNo">Cancel</button><button class="pri" id="askYes">${h(okLabel || 'Confirm')}</button></div></div>`;
  a.classList.add('on');
  document.getElementById('askNo').onclick = () => a.classList.remove('on');
  document.getElementById('askYes').onclick = () => { a.classList.remove('on'); yes(); };
  setTimeout(() => document.getElementById('askYes')?.focus(), 30);
}
function prompt2(title, fields, onOk, okLabel){
  // fields: [{k,label,type,value,options,required,full}]
  const a = document.getElementById('ask');
  a.innerHTML = `<div class="mbox" style="max-width:560px"><h2 style="margin-top:0">${h(title)}</h2><form id="p2f"><div class="fgrid">${fields.map(f => `<div class="${f.full ? 'full' : ''}"><label>${h(f.label)}${f.required ? ' *' : ''}</label>${
    f.type === 'select' ? `<select name="${f.k}">${f.options.map(o => Array.isArray(o) ? opt(o[0], o[1], f.value) : opt(o, o, f.value)).join('')}</select>`
    : f.type === 'textarea' ? `<textarea name="${f.k}" rows="3">${h(f.value ?? '')}</textarea>`
    : f.type === 'check' ? `<label class="inline"><input type="checkbox" name="${f.k}" ${f.value ? 'checked' : ''}> ${h(f.hint || '')}</label>`
    : f.type === 'file' ? `<input type="file" name="${f.k}" accept="image/*" multiple>`
    : `<input name="${f.k}" type="${f.type || 'text'}" ${f.type === 'number' ? 'step="any"' : ''} value="${v(f.value)}" ${f.placeholder ? `placeholder="${h(f.placeholder)}"` : ''}>`}</div>`).join('')}</div>
    <div class="row" style="justify-content:flex-end;margin-top:16px"><button type="button" id="p2c">Cancel</button><button class="pri" type="submit">${h(okLabel || 'Save')}</button></div></form></div>`;
  a.classList.add('on');
  document.getElementById('p2c').onclick = () => a.classList.remove('on');
  document.getElementById('p2f').onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target), out = {};
    for(const f of fields){
      if(f.type === 'check') out[f.k] = !!e.target.elements[f.k].checked;
      else if(f.type === 'file') out[f.k] = e.target.elements[f.k].files;
      else out[f.k] = f.type === 'number' ? (fd.get(f.k) === '' ? '' : num(fd.get(f.k))) : String(fd.get(f.k) ?? '').trim();
      if(f.required && (out[f.k] === '' || out[f.k] == null)) return toast(f.label + ' is required', 'bad');
    }
    a.classList.remove('on'); await onOk(out);
  };
  setTimeout(() => a.querySelector('input,select,textarea')?.focus(), 30);
}
function openModal(html, wide){ const m = document.getElementById('mbox'); m.style.maxWidth = wide ? '1100px' : ''; m.innerHTML = html; document.getElementById('modal').classList.add('on'); hydrate(m); if(typeof initSpins === 'function') initSpins(m); }
function closeModal(){ document.getElementById('modal').classList.remove('on'); }
function copyText(id){ const el = document.getElementById(id); const txt = el ? (el.tagName === 'TEXTAREA' ? el.value : el.innerText) : ''; const fail = () => { if(el && el.tagName === 'TEXTAREA') el.select(); toast('Copy was blocked — select the text and copy it manually', 'bad'); }; try{ navigator.clipboard.writeText(txt).then(() => toast('Copied to clipboard', 'ok'), fail); }catch(e){ fail(); } }
