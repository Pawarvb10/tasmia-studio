/* =====================================================================
   ui_shell.js : boot, login, roles, navigation, search, dashboard, alerts
   ===================================================================== */
const NAV = [
  ['Workspace', [['dashboard', 'Dashboard', 'dash'], ['mytasks', 'My tasks', 'mytasks'], ['alerts', 'Alerts', 'alerts']]],
  ['Orders', [['orders', 'Orders & garments', 'orders'], ['customers', 'Customers & measurements', 'customers']]],
  ['Production', [['board', 'Production board', 'orders'], ['planner', 'Stitching & delivery planner', 'planner'], ['embroidery', 'Embroidery & handwork', 'embroidery'], ['trials', 'Trials & alterations', 'trials'], ['qc', 'QC & delivery', 'qc']]],
  ['Resources', [['workers', 'Workers & workload', 'workers'], ['vendors', 'Outside vendors', 'vendors'], ['inventory', 'Materials & stock', 'inventory']]],
  ['Money', [['billing', 'Billing & payments', 'billing'], ['reports', 'Owner reports', 'reports']]],
  ['Studio', [['config', 'Configurator', 'config'], ['comms', 'Communication', 'comms'], ['setup', 'Setup & users', 'setup']]]];
const VIEWS = {};      // filled by each ui file: VIEWS.name = {perm, fn, parent}
function route(){ const x = (location.hash || '').slice(1), i = x.indexOf('-'); return {v: (i < 0 ? x : x.slice(0, i)) || homeView(), id: i < 0 ? null : x.slice(i + 1)}; }
function homeView(){ return can('dash') ? 'dashboard' : can('mytasks') ? 'mytasks' : can('orders') ? 'orders' : 'billing'; }
function go(hh){ document.body.classList.remove('navon'); if(location.hash === '#' + hh) render(); else location.hash = hh; }
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

function render(){
  if(!DB || !DB.settings || !ME) return;
  SC = null; HOL = null;
  const r = route(), V = VIEWS[r.v];
  renderNav(r);
  const main = document.getElementById('main');
  if(!V){ main.innerHTML = '<div class="card">Page not found. <a href="#">Go home</a></div>'; return; }
  if(V.perm && !can(V.perm)){ main.innerHTML = `<div class="card"><h2>No access</h2><p class="muted">Your role (${h(ROLES[ME.role] || ME.role)}) cannot open this page. Ask the owner to change your permissions in Setup → Users & roles.</p><a class="btn" href="#${homeView()}">Go to my home page</a></div>`; return; }
  try{ main.innerHTML = V.fn(r.id); }
  catch(err){ console.error(err); main.innerHTML = `<div class="card"><b>Something went wrong showing this page.</b><pre style="white-space:pre-wrap;font-size:12px">${h(err.stack)}</pre></div>`; }
  if(V.after) try{ V.after(r.id); }catch(e){ console.error(e); }
  hydrate(main); if(typeof initSpins === 'function') initSpins(main);
  document.getElementById('topTitle').textContent = V.title || 'Studio';
}
function renderNav(r){
  const nA = can('alerts') ? activeAlerts().filter(a => a.sev !== 'low').length : 0;
  const cur = (VIEWS[r.v] && VIEWS[r.v].parent) || r.v, s = ST();
  document.getElementById('nav').innerHTML = `<div class="brand">${s.logo ? `<img src="${h(logoSrc())}" alt="">` : ''}${h(s.shop)}<small>Order → Billing · v${APP_VERSION}</small></div>
    <div class="who"><b>${h(ME.name)}</b>${h(ROLES[ME.role] || ME.role)}<div style="margin-top:6px"><span id="syncBadge" class="sync" style="margin:0"></span></div>${MODE === 'local' ? `<div style="margin-top:6px"><a href="#" onclick="logout();return false" style="color:#f3dca2;display:inline;padding:0">Switch user</a></div>` : ''}</div>
    <div class="search" style="margin:0 2px 6px"><input id="gsearch" placeholder="Search order, garment, customer, phone…" oninput="gSearch(this)" onkeydown="if(event.key==='Escape'){this.value='';gSearch(this)}" style="background:#3d2631;border-color:#4d3440;color:#fff"><div class="res" id="gres" hidden></div></div>
    ${NAV.map(([grp, items]) => { const its = items.filter(([, , p]) => can(p)); return its.length ? `<div class="grp">${grp}</div>` + its.map(([k, l]) => `<a href="#${k}" class="${cur === k ? 'on' : ''}"><span>${l}</span>${k === 'alerts' && nA ? `<span class="badge">${nA}</span>` : ''}</a>`).join('') : ''; }).join('')}
    <div class="foot">${MODE === 'central' ? 'Central database — every device sees the same data.' : 'Data saved on this device only. Use the shared link for a central database.'}</div>`;
  setSyncBadge('ok'); hydrate(document.getElementById('nav'));
}
function gSearch(inp){
  const q = inp.value.trim().toLowerCase(), box = document.getElementById('gres');
  if(q.length < 2){ box.hidden = true; return; }
  const R = [];
  coll('orders').forEach(o => { const c = cust(o.customerId); if(`${o.no} ${c?.name} ${c?.phone}`.toLowerCase().includes(q)) R.push([`#order-${o.id}`, `${o.no} · ${c?.name || ''}`, 'Order']); });
  coll('garments').forEach(g => { const c = cust(g.customerId); if(`${g.no} ${g.title} ${c?.name}`.toLowerCase().includes(q)) R.push([`#garment-${g.id}`, `${g.no} · ${g.title}`, 'Garment']); });
  coll('customers').forEach(c => { if(`${c.name} ${c.phone} ${c.phone2}`.toLowerCase().includes(q)) R.push([`#customer-${c.id}`, `${c.name} · ${c.phone}`, 'Customer']); });
  coll('invoices').forEach(i => { if(i.no.toLowerCase().includes(q)) R.push([`#billing`, `${i.no} · ${cust(i.customerId)?.name || ''}`, 'Invoice']); });
  box.innerHTML = R.slice(0, 14).map(([u, t, k]) => `<a href="${u}" onclick="document.getElementById('gres').hidden=true;document.getElementById('gsearch').value=''"><span class="chip c-mut">${k}</span> ${h(t)}</a>`).join('') || '<div class="muted" style="padding:10px">No matches</div>';
  box.hidden = false;
}

/* ---------------- boot ---------------- */
async function boot(){
  await idbOpen();
  let central = false;
  if(window.claude && typeof window.claude.use === 'function'){
    const shell = document.getElementById('boot'); if(shell) shell.textContent = 'Connecting to the central database…';
    central = await Promise.race([connectCentral(), new Promise(r => setTimeout(() => r(false), 12000))]).catch(() => false);
  }
  if(central){ await centralLogin(); return; }
  MODE = 'local';
  DB = loadLocal();
  if(!DB){ showWelcome(); return; }
  migrate(); localLogin();
}
function migrate(){
  const d = defaultSettings(), s = DB.settings;
  Object.keys(d).forEach(k => { if(s[k] === undefined) s[k] = clone(d[k]); });
  ['lead'].forEach(k => Object.keys(d[k]).forEach(j => { if(s[k][j] === undefined) s[k][j] = d[k][j]; }));
  COLLS.forEach(c => { if(!DB[c]) DB[c] = []; });
  DB.state = DB.state || {ack: {}, notified: {}, backups: []}; DB.counters = DB.counters || {order: 1001, inv: 1, rcpt: 1}; DB.access = DB.access || {roles: {}};
  if(!coll('stages').length) DB.stages = defaultStages();
  if(!coll('templates').length) DB.templates = defaultTemplates();
  if(!coll('msgTemplates').length) DB.msgTemplates = defaultMsgTemplates();
  migrateMeasure(); migrateHeads();
}
/* invoice charge heads aligned to the studio's own invoice columns */
function migrateHeads(){
  const s = DB.settings; if(s._invV) return;
  const mp = id => OLD_HEAD[id] || id, known = new Set(INVOICE_HEADS.map(x => x.id));
  const extra = (s.heads || []).filter(x => !known.has(mp(x.id)));
  s.heads = INVOICE_HEADS.map(x => ({...x})).concat(extra);
  const dc = defaultSettings().categories; (s.categories || []).forEach(c => { const d = dc.find(x => x.id === c.id); c.head = d ? d.head : mp(c.head); }); dc.forEach(d => { if(!s.categories.some(c => c.id === d.id)) s.categories.push({...d}); });
  const ds = defaultStages(); coll('stages').forEach(st => { const d = ds.find(x => x.id === st.id); st.head = d ? d.head : mp(st.head); }); ds.forEach(d => { if(!coll('stages').some(x => x.id === d.id)) DB.stages.push({...d}); });
  const fixSteps = L => (L || []).forEach(x => { if(x.head) x.head = mp(x.head); });
  coll('templates').forEach(t => fixSteps(t.workflow));
  coll('garments').forEach(g => { fixSteps(g.steps); (g.extras || []).forEach(x => x.head = mp(x.head)); if(g.headPrice){ const hp = {}; Object.entries(g.headPrice).forEach(([k, val]) => { const nk = mp(k); hp[nk] = hp[nk] !== undefined ? num(hp[nk]) + num(val) : val; }); g.headPrice = hp; } });
  if(/Couture · Bridal/.test(s.tagline || '')) s.tagline = 'Crafted with care, worn with love';
  if(!s.invoiceFooter) s.invoiceFooter = 'Thank you for choosing ' + (s.shop || 'us') + '!';
  if(s.invoiceNote === undefined) s.invoiceNote = 'Please check your garments at the time of collection.';
  s._invV = 1;
}
/* article measurement sheets + family members (added later; safe to run every start) */
function migrateMeasure(){
  const defs = defaultTemplates();
  defs.filter(t => t.charts).forEach(dt => { const t = tpl(dt.id); if(!t){ if(!DB.settings._artV) DB.templates.push(dt); } else if(!t.charts){ t.charts = dt.charts.slice(); t.category = dt.category; } });
  coll('templates').forEach(t => { if((t.charts || []).length) t.fields = chartFields(t.charts); });
  DB.settings._artV = 1;
  coll('customers').forEach(c => members(c));
  coll('profiles').forEach(p => { if(!p.unit) p.unit = 'in'; if(p.memberId) return; const c = cust(p.customerId); if(!c) return; const M = members(c), rel = p.person || 'Self';
    let m = rel === 'Self' ? primaryMember(c) : M.find(x => x.relation.toLowerCase() === rel.toLowerCase());
    if(!m){ const nm = (p.label || '').split(/\s+[–-]\s+/)[0].replace(/\(.*\)/, '').trim() || rel; m = {id: uid('m'), name: nm, relation: RELATIONS.find(r => r.toLowerCase() === rel.toLowerCase()) || 'Other', gender: '', dob: '', phone: '', notes: ''}; M.push(m); }
    p.memberId = m.id; });
  coll('garments').forEach(g => { if(!g.unit) g.unit = prof(g.profileId)?.unit || 'in'; if(!g.memberId){ const p = prof(g.profileId); g.memberId = p?.memberId || primaryMember(cust(g.customerId))?.id || ''; } });
}
function shell(inner){ document.body.innerHTML = inner; }
function appShell(){
  if(document.getElementById('nav')) return;
  document.body.innerHTML = `<div class="topbar"><button onclick="document.body.classList.toggle('navon')" aria-label="Menu">☰</button><span class="t" id="topTitle">Studio</span>${can('orders.edit') ? '<button onclick="newOrder()">+ Order</button>' : ''}</div>
  <div class="app"><nav class="side" id="nav"></nav><main id="main"></main></div>
  <div id="modal" onclick="if(event.target===this)closeModal()"><div class="mbox" id="mbox"></div></div><div id="ask"></div><div id="toasts"></div>`;
  document.addEventListener('click', e => { if(document.body.classList.contains('navon') && !e.target.closest('nav.side') && !e.target.closest('.topbar')) document.body.classList.remove('navon'); const r = document.getElementById('gres'); if(r && !e.target.closest('.search')) r.hidden = true; });
}
function showWelcome(){
  shell(`<div class="login"><div class="box"><h1>${h(defaultSettings().shop)}</h1><p class="muted">Boutique order-to-billing system. Nothing is saved on this device yet.</p>
  <div class="row"><button class="pri" onclick="startLocal(true)">Load demo studio</button><button onclick="startLocal(false)">Start with an empty studio</button></div>
  <p class="hint">Demo data shows sample orders at every stage — bridal embroidery, trials and alterations, vendor work, partial delivery and invoices. You can clear it later in Setup → Data.</p></div></div><div id="ask"></div><div id="toasts"></div>`);
}
function startLocal(demo){ DB = demo ? seedDemo() : seedMasters(); migrate(); saveLocal(); localLogin(); }
function localLogin(){
  const sid = sessionStorage.getItem('td_user'), u = (ST().users || []).find(x => x.id === sid && x.active !== false);
  if(u){ ME = {id: u.id, name: u.name, role: u.role, workerId: u.workerId}; startApp(); return; }
  const users = (ST().users || []).filter(x => x.active !== false);
  shell(`<div class="login"><div class="box"><div class="row ac">${ST().logo ? `<img src="${h(logoSrc())}" style="height:44px;border-radius:6px">` : ''}<div><h1 style="margin:0">${h(ST().shop)}</h1><div class="muted">Who is using the system?</div></div></div>
    <div class="utiles">${users.map(u => `<button class="utile" data-u="${u.id}" onclick="document.querySelectorAll('.utile').forEach(x=>x.classList.remove('on'));this.classList.add('on');document.getElementById('pin').focus()"><b>${h(u.name)}</b><div class="muted" style="font-size:12px">${h(ROLES[u.role] || u.role)}${ST().demoPins ? ' · PIN ' + h(u.pin) : ''}</div></button>`).join('')}</div>
    <form onsubmit="event.preventDefault();doLogin()"><label>PIN</label><div class="row"><input id="pin" type="password" inputmode="numeric" autocomplete="off" style="max-width:160px"><button class="pri">Sign in</button></div></form>
    <p class="hint">On this device the PIN is a convenience lock, not real security. On the shared link, staff sign in with their own Claude account and the owner assigns their role.</p></div></div><div id="ask"></div><div id="toasts"></div>`);
}
function doLogin(){
  const sel = document.querySelector('.utile.on'); if(!sel) return toast('Pick your name first', 'bad');
  const u = ST().users.find(x => x.id === sel.dataset.u);
  if(String(u.pin || '') !== document.getElementById('pin').value.trim()) return toast('Wrong PIN', 'bad');
  sessionStorage.setItem('td_user', u.id); ME = {id: u.id, name: u.name, role: u.role, workerId: u.workerId}; startApp();
}
function logout(){ sessionStorage.removeItem('td_user'); ME = null; location.hash = ''; localLogin(); }
async function centralLogin(){
  let name = 'You';
  try{ if(SYNC.user && SYNC.uid){ const ps = await SYNC.user.profiles([SYNC.uid]); name = (ps && ps[SYNC.uid] && ps[SYNC.uid].name) || 'You'; } }catch(e){}
  if(!DB.settings){
    if(SYNC.isAdmin){
      shell(`<div class="login"><div class="box"><h1>Set up the central database</h1><p class="muted">This shared page has a central database that every device and staff member will use. It is empty right now.</p>
      <div class="row"><button class="pri" onclick="centralInit(true)">Load demo studio</button><button onclick="centralInit(false)">Start empty (masters only)</button></div>
      <p class="hint">Masters = garment types, workflows, stages, QC checklist, billing heads and message presets. You can change all of them later.</p></div></div><div id="ask"></div><div id="toasts"></div>`);
    } else shell(`<div class="login"><div class="box"><h1>Not set up yet</h1><p class="muted">The owner has not set up this studio's database yet. Please check back later.</p></div></div>`);
    return;
  }
  migrate();
  const map = (DB.access.roles || {})[SYNC.uid];
  let role = SYNC.isOwner ? 'owner' : map ? map.role : SYNC.isAdmin ? 'manager' : null;
  if(!role){
    shell(`<div class="login"><div class="box"><h1>${h(DB.settings.shop)}</h1><p>Hello ${h(name)}. You can open this page, but the owner has not given you a role yet.</p>
    <button class="pri" id="reqb" onclick="requestAccess()">Request access</button><p class="hint">The owner sees your request in Setup → Users & roles and assigns you a role (manager, master, artisan or accounts).</p></div></div><div id="toasts"></div>`);
    return;
  }
  ME = {id: SYNC.uid, name: map?.label || name, role, workerId: map?.workerId || ''};
  startApp(); autoBackup();
}
async function centralInit(demo){
  const d = demo ? seedDemo() : seedMasters(); DB = d; migrate();
  ME = {id: SYNC.uid, name: 'Owner', role: 'owner', workerId: ''};
  document.body.innerHTML = '<div class="login"><div class="box"><h1>Writing to the central database…</h1><p class="muted">This takes a few seconds.</p></div></div><div id="toasts"></div>';
  await flushSync(); centralLogin();
}
async function requestAccess(){
  try{ await SYNC.db.doc('joinreq/' + SYNC.uid).set({at: nowISO()}); document.getElementById('reqb').textContent = 'Request sent ✓'; document.getElementById('reqb').disabled = true; }
  catch(e){ toast('Could not send the request (' + (e.code || e.message) + ')', 'bad'); }
}
function startApp(){ appShell(); render(); setTimeout(checkNotify, 800); }
function checkNotify(){
  if(!can('alerts')) return;
  const fresh = activeAlerts().filter(a => (a.sev === 'critical' || a.sev === 'high') && !(DB.state.notified || {})[a.key]);
  if(!fresh.length) return;
  DB.state.notified = DB.state.notified || {}; fresh.forEach(a => DB.state.notified[a.key] = Date.now()); save();
  toast(`⚠ ${fresh.length} new urgent alert${fresh.length > 1 ? 's' : ''} — see Alerts`, 'bad');
}
setInterval(() => { if(ME && route().v !== 'neworder' && !document.getElementById('modal')?.classList.contains('on') && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) softRender(); }, 5 * 60 * 1000);

/* ---------------- shared widgets ---------------- */
const kpi = (label, val, cls, href, small) => `<div class="kpi ${cls || ''} ${href ? 'click' : ''}" ${href ? `onclick="go('${href}')"` : ''}><span>${label}</span><b>${val}</b>${small ? `<small>${small}</small>` : ''}</div>`;
function loadBar(val, max, warnAt){ const p = Math.min(100, val / Math.max(max, 0.01) * 100); const cls = val > warnAt ? 'bad' : val > warnAt * 0.75 ? 'warn' : ''; return `<div class="bar"><i class="${cls}" style="width:${p}%"></i></div>`; }
const urgentChip = g => (g.urgent || ord(g.orderId)?.urgent) ? '<span class="chip urgent">URGENT</span>' : '';
const sevChip = s => `<span class="chip ${s === 'critical' || s === 'high' ? 'c-bad' : s === 'medium' ? 'c-warn' : 'c-mut'}">${s}</span>`;
function dateChip(d, done){ if(!d) return '—'; const t = todayISO(); return `<span class="chip ${done ? 'c-ok' : d < t ? 'c-bad' : d <= iso(addDays(new Date(), num(ST().warnDays) || 2)) ? 'c-warn' : 'c-mut'}">${fmtDs(d)}</span>`; }
function gCard(g, extra){
  const o = ord(g.orderId), c = cust(g.customerId), x = sched().G[g.id], st = gStatus(g), late = (g.deliveryDate && g.deliveryDate < todayISO() && gLive(g)) || x?.late;
  return `<div class="gcard ${late ? 'late' : (g.urgent || o?.urgent) ? 'urg' : st === 'ready' ? 'ok' : st === 'production' ? 'prog' : ''}" onclick="go('garment-${g.id}')">
    <div class="row ac" style="gap:6px"><span class="t">${h(g.no)}</span>${urgentChip(g)}<span class="sp"></span>${gChip(g)}</div>
    <div>${h(g.title)}${(g.qty || 1) > 1 ? ` <b>× ${g.qty}</b>` : ''}</div><div class="muted" style="font-size:12.5px">${h(c?.name || '')} · ${h(tpl(g.tplId)?.name?.split(' (')[0] || '')}</div>${g.memberId ? `<div style="margin-top:3px">${memChip(g.customerId, g.memberId)}</div>` : ''}
    ${extra || ''}
    <div class="row ac" style="gap:6px;margin-top:6px;font-size:12px"><span class="muted">Delivery</span>${dateChip(g.deliveryDate, !gLive(g))}${x && gLive(g) ? `<span class="muted">· expected</span><span class="chip ${x.late ? 'c-bad' : 'c-ok'}">${fmtDs(x.ready)}</span>` : ''}</div></div>`;
}
function stepWho(s){ if(isOut(s)) return '🚚 ' + h(vendor(s.vendorId)?.name || 'vendor not set'); const x = sched().T[s.id]; const w = worker(s.workerId || x?.wid); return w ? h(w.name) + (s.workerId ? '' : ' <span class="chip c-warn">auto</span>') : '<span class="muted">unassigned</span>'; }
function stepStatusChip(s){ return s.status === 'done' ? '<span class="chip c-ok">Done</span>' : s.status === 'skipped' ? '<span class="chip c-mut">Skipped</span>' : s.status === 'in_progress' ? `<span class="chip c-acc">${isOut(s) ? 'At vendor' : 'In progress'}</span>` : '<span class="chip c-mut">Pending</span>'; }

/* ---------------- dashboard ---------------- */
VIEWS.dashboard = {perm: 'dash', title: 'Dashboard', fn: () => {
  const sc = sched(), today = todayISO(), wk = iso(addDays(new Date(), 7)), live = liveGarments();
  const bl = groupBacklog(), A = activeAlerts();
  const late = live.filter(g => (g.deliveryDate && g.deliveryDate < today) || sc.G[g.id]?.late);
  const ready = coll('garments').filter(g => gStatus(g) === 'ready');
  const trialsToday = []; coll('garments').forEach(g => (g.trials || []).forEach(t => { if(t.status === 'scheduled' && t.date === today) trialsToday.push({g, t}); }));
  const dueWeek = live.filter(g => g.deliveryDate && g.deliveryDate <= wk).sort(by(g => g.deliveryDate));
  // today's production targets: steps planned for today or due today
  const todays = [];
  live.forEach(g => liveSteps(g).forEach(s => { if(s.status === 'done') return; const p = stepPlanned(s), tgt = stepTarget(s, g); const onToday = p && p.start <= today && today <= p.end; if(onToday || tgt === today || (tgt < today)) todays.push({g, s, p, tgt, onToday}); }));
  todays.sort(by(x => (x.tgt < today ? 0 : 1) + (x.tgt || '9')));
  const box = (k, label, hrefTab) => { const b = bl[k] || {n: 0, garments: new Set(), overdue: 0, hrs: 0}; return `<div class="kpi click" onclick="UI.board='${k}';go('board')"><span>${label}</span><b>${b.garments.size}</b><small>${b.n} step${b.n === 1 ? '' : 's'} · ${b.hrs.toFixed(0)} h${b.overdue ? ` · <span class="danger">${b.overdue} overdue</span>` : ''}</small></div>`; };
  const fin = can('reports') ? (() => { const f = finance(today.slice(0, 8) + '01', today); return `<div class="card"><div class="row ac"><h3 style="margin:0">Owner snapshot · this month</h3><span class="sp"></span><a href="#reports">Full reports →</a></div><div class="kpis" style="margin:10px 0 0">${kpi('Customisation revenue', inr(f.revenue), '', 'reports', 'invoiced, before GST')}${kpi('Collections', inr(f.collected), 'ok', 'billing')}${kpi('Cost of invoiced work', inr(f.cogs), '', 'reports', 'materials + labour + vendors')}${kpi('Gross profit', inr(f.profit), f.profit >= 0 ? 'ok' : 'bad', 'reports', f.revenue ? Math.round(f.profit / f.revenue * 100) + '% margin' : '')}${kpi('Customers owe', inr(f.receivable), f.receivable ? 'warn' : '', 'billing')}${kpi('We owe workers/vendors', inr(f.payW + f.payV), '', 'workers')}</div></div>`; })() : '';
  return `<div class="row ac"><div><h1>Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${h(ME.name.split(' ')[0])}</h1><div class="sub">${new Date().toLocaleDateString('en-IN', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'})}</div></div></div>
  <div class="qa">${can('orders.edit') ? '<button class="pri" onclick="newOrder()">+ New order</button>' : ''}${can('customers') ? '<button onclick="newCustomer()">+ Customer</button>' : ''}${can('billing') ? '<button onclick="quickPayment()">₹ Record payment</button>' : ''}${can('trials') ? '<button onclick="go(\'trials\')">📅 Book / record trial</button>' : ''}${can('qc') ? '<button onclick="go(\'qc\')">✔ QC & delivery</button>' : ''}</div>
  <h3>Pending work by stage — garments currently at each stage</h3>
  <div class="kpis">${box('embroidery', 'Embroidery & handwork')}${box('stitching', 'Stitching')}${box('finishing', 'Finishing / hemming')}${box('trial', 'Trials')}${box('alteration', 'Alterations')}${kpi('Ready for delivery', ready.length, ready.length ? 'ok' : '', 'qc', 'QC passed')}</div>
  <div class="kpis">${kpi('Garments in production', live.length, '', 'orders')}${kpi('Due in 7 days', dueWeek.length, dueWeek.length ? 'warn' : '', 'planner')}${kpi('Delayed / at risk', late.length, late.length ? 'bad' : 'ok', 'planner')}${kpi('Trials today', trialsToday.length, '', 'trials')}${kpi('Open alerts', A.filter(a => a.sev !== 'low').length, A.length ? 'bad' : 'ok', 'alerts')}</div>
  ${fin}
  <div class="grid2">
    <div class="card"><div class="row ac"><h3 style="margin:0">Today's production targets</h3><span class="sp"></span><a href="#planner">Daily schedule →</a></div>
      <div class="hint" style="margin:2px 0 8px">Steps planned for today by the scheduler, due today, or already past their target.</div>
      ${todays.length ? `<table class="stack"><thead><tr><th>Garment</th><th>Step</th><th>Who</th><th>Target</th><th>Status</th></tr></thead><tbody>${todays.slice(0, 14).map(({g, s, tgt}) => `<tr class="click ${tgt < today ? 'late' : ''}" onclick="go('garment-${g.id}')"><td><b>${h(g.no)}</b> ${urgentChip(g)}<div class="muted" style="font-size:12px">${h(g.title)}</div></td><td>${h(stg(s).name)}<div class="muted" style="font-size:12px">${h(s.label)}</div></td><td>${stepWho(s)}</td><td>${dateChip(tgt)}</td><td>${stepStatusChip(s)}</td></tr>`).join('')}</tbody></table>${todays.length > 14 ? `<div class="hint">+${todays.length - 14} more in the planner.</div>` : ''}` : '<div class="empty">Nothing scheduled for today.</div>'}
    </div>
    <div class="card"><div class="row ac"><h3 style="margin:0">Delayed & upcoming deliveries</h3><span class="sp"></span><a href="#planner">Delivery planner →</a></div>
      ${[...late, ...dueWeek.filter(g => !late.includes(g))].slice(0, 12).map(g => { const x = sc.G[g.id]; return `<div class="row ac click" style="padding:7px 0;border-bottom:1px solid var(--line);cursor:pointer" onclick="go('garment-${g.id}')"><div style="flex:1"><b>${h(g.no)}</b> ${urgentChip(g)} ${h(g.title)}<div class="muted" style="font-size:12px">${h(cust(g.customerId)?.name)} · now: ${h(gStageLabel(g))}</div></div><div class="right" style="font-size:12px">${dateChip(g.deliveryDate)}<div class="muted">exp. ${fmtDs(x?.ready)}</div></div></div>`; }).join('') || '<div class="empty">No deliveries due this week.</div>'}
    </div>
  </div>
  <div class="card"><div class="row ac"><h3 style="margin:0">Top alerts</h3><span class="sp"></span><a href="#alerts">All alerts →</a></div><div style="margin-top:10px">${A.filter(a => a.sev !== 'low').slice(0, 6).map(alertRow).join('') || '<div class="empty">No bottlenecks detected.</div>'}</div></div>`;
}};

/* ---------------- alerts ---------------- */
const ALERT_CATS = {delivery: 'Deliveries', step: 'Production steps', trial: 'Trials', vendor: 'Vendors', worker: 'Workers', material: 'Materials', design: 'Design approval', qc: 'QC', payment: 'Payments'};
function alertRow(a, acked){
  const g = a.gid && gar(a.gid), s = g && a.stepId ? g.steps.find(x => x.id === a.stepId) : null, w = worker(a.wid), vd = vendor(a.vid);
  return `<div class="alert ${a.sev}"><div class="b"><div class="t">${h(a.title)} ${sevChip(a.sev)}</div><div class="muted">${h(a.detail)}</div>
    ${g ? `<div style="font-size:12px;margin-top:4px">Garment <b>${h(g.no)}</b>${s ? ` · Task <b>${h(stg(s).name)} – ${h(s.label)}</b>` : ''}${w ? ` · Responsible <b>${h(w.name)}</b>` : vd ? ` · Vendor <b>${h(vd.name)}</b>` : ''}</div>` : ''}</div>
    <div class="row" style="gap:6px">${g ? `<button class="sm" onclick="go('garment-${g.id}')">Open garment</button>` : a.oid ? `<button class="sm" onclick="go('order-${a.oid}')">Open order</button>` : a.wid ? `<button class="sm" onclick="go('worker-${a.wid}')">Open worker</button>` : ''}
    ${ST().adminPhone ? `<a class="btn sm" target="_blank" rel="noopener" href="${h(waLink(ST().adminPhone, adminMsg(a)))}" title="Send to owner on WhatsApp">💬</a>` : ''}
    ${acked ? `<button class="sm ghost" onclick="unackAlert('${h(a.key)}')">Reopen</button>` : `<button class="sm ghost" onclick="ackAlert('${h(a.key)}')">Acknowledge</button>`}</div></div>`;
}
VIEWS.alerts = {perm: 'alerts', title: 'Alerts', fn: () => {
  const all = allAlerts(), ack = DB.state.ack || {}, f = UI.alertCat || '', A = all.filter(a => !ack[a.key] && (!f || a.cat === f)), done = all.filter(a => ack[a.key]);
  const counts = {}; all.filter(a => !ack[a.key]).forEach(a => counts[a.cat] = (counts[a.cat] || 0) + 1);
  return `<div class="row ac"><div><h1>Alerts</h1><div class="sub">Checked every time anything changes. Each alert names the garment, the pending task and who is responsible.</div></div><span class="sp"></span>
    <button onclick="showDigest()">📋 Digest</button>${ST().adminPhone ? `<a class="btn" target="_blank" rel="noopener" href="${h(waLink(ST().adminPhone, digest()))}">💬 Send digest to owner</a>` : ''}</div>
  ${!ST().adminPhone ? '<div class="flag info">Add the owner\'s WhatsApp number in Setup → Shop profile to send alerts straight to them.</div>' : ''}
  <div class="tabs"><button class="${!f ? 'on' : ''}" onclick="UI.alertCat='';render()">All (${all.filter(a => !ack[a.key]).length})</button>${Object.entries(ALERT_CATS).filter(([k]) => counts[k]).map(([k, l]) => `<button class="${f === k ? 'on' : ''}" onclick="UI.alertCat='${k}';render()">${l} (${counts[k]})</button>`).join('')}</div>
  <div class="card">${A.map(a => alertRow(a)).join('') || '<div class="empty">No open alerts here.</div>'}</div>
  ${done.length ? `<div class="card"><details><summary>Acknowledged (${done.length})</summary><div style="margin-top:8px">${done.map(a => alertRow(a, true)).join('')}</div></details></div>` : ''}
  <div class="card"><h3>How delays are calculated</h3><div class="muted" style="font-size:13px">Each garment's steps are scheduled forward from today on the assigned worker's real calendar — their hours per day × efficiency, minus weekly offs, shop holidays and leave. Steps with the same sequence number run in parallel; the next group starts when the slowest step finishes. Outside work takes the vendor's turnaround in shop working days. Expected ready date = when the last step finishes. A garment is <b>at risk</b> when that date is after its delivery date; a step is <b>overdue</b> when its target date (from the delivery date minus the lead days in Setup, or set by hand) has passed.</div></div>`;
}};
function ackAlert(k){ DB.state.ack = DB.state.ack || {}; DB.state.ack[k] = nowISO(); save(); render(); }
function unackAlert(k){ delete DB.state.ack[k]; save(); render(); }
function digest(){ const A = activeAlerts().filter(a => a.sev !== 'low'); return `${ST().shop} — alert digest ${fmtD(todayISO())}\n\n` + (A.map((a, i) => `${i + 1}. [${a.sev.toUpperCase()}] ${a.title}: ${a.detail}`).join('\n') || 'No open alerts.'); }
function showDigest(){ openModal(`<div class="mbar"><b>Alert digest</b><span class="sp"></span><button onclick="copyText('dg')">📋 Copy</button><button onclick="closeModal()">Close</button></div><pre id="dg" style="white-space:pre-wrap;font:13px/1.5 system-ui">${h(digest())}</pre>`); }
