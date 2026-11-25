/* =====================================================================
   ui_orders.js : binding, plan editors, orders list, new order, order page,
                  payments, invoices
   ===================================================================== */
/* ---------------- input binding ----------------
   data-p = path, data-root = EDIT (new-order draft) | GD (garment edit
   draft) | DB (masters & settings, saved instantly). data-r re-renders.  */
document.addEventListener('input', e => bind(e, false));
document.addEventListener('change', e => bind(e, true));
function rootOf(name){ return name === 'DB' ? DB : name === 'GD' ? UI.gd : name === 'X' ? UI.x : EDIT; }
function bind(e, isChange){
  const el = e.target, p = el.dataset && el.dataset.p; if(!p) return;
  const rn = el.dataset.root || 'EDIT', root = rootOf(rn); if(!root) return;
  if(!isChange && (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio')) return;
  let val = el.type === 'checkbox' ? el.checked : el.value;
  if(el.type === 'number') val = el.value === '' ? '' : num(el.value);
  setPath(root, p, val); stepHooks(root, p, val);
  if(rn === 'EDIT' && /^garments\.\d+\.tplId$/.test(p)) draftTplChanged(+p.split('.')[1], val);
  if(rn === 'EDIT' && /^garments\.\d+\.profileId$/.test(p)) draftProfileChanged(+p.split('.')[1], val);
  if(rn === 'EDIT' && /^garments\.\d+\.memberId$/.test(p)) draftMemberChanged(+p.split('.')[1], val);
  if(rn === 'EDIT' && p === 'customerId') draftCustomerChanged();
  if(rn === 'EDIT' && p === 'deliveryDate') EDIT.garments.forEach(g => { if(!g._ownDate) g.deliveryDate = val; });
  if(rn === 'EDIT' && /^garments\.\d+\.deliveryDate$/.test(p)) EDIT.garments[+p.split('.')[1]]._ownDate = true;
  if(rn === 'EDIT' && /^garments\.\d+\.fabricSource$/.test(p)){ const d = EDIT.garments[+p.split('.')[1]]; d.components.forEach(c => { if(c.category === 'fabric'){ if(val === 'customer'){ if(c.source !== 'customer'){ c._rate = c.rate; c.rate = 0; c.source = 'customer'; } } else if(val === 'studio' && c.source === 'customer'){ c.source = 'studio'; c.rate = c._rate || c.rate; } } }); }
  if(rn === 'DB') save();
  if(isChange && el.dataset.r !== undefined) softRender(); else if(rn === 'EDIT') refreshDraft();
}
function stepHooks(root, p, val){
  let m;
  if((m = p.match(/^(.*steps\.\d+)\.stageId$/)) || (m = p.match(/^(.*workflow\.\d+)\.stageId$/)) || (m = p.match(/^(.*addTasks\.\d+)\.stageId$/))){
    const s = getPath(root, m[1]), st = stage(val);
    s.out = st.kind === 'external'; if(s.out){ s.tat = s.tat || 2; s.charge = s.charge || 0; }
    else { s.pricing = s.pricing || 'unit'; if(!num(s.rate) && num(st.rate)) s.rate = st.rate; if(!num(s.hours)) s.hours = 1; if(s.workerId && !(worker(s.workerId)?.skills || []).includes(val)) s.workerId = ''; }
  }
  if((m = p.match(/^(.*(?:steps|workflow|addTasks)\.\d+)\.workerId$/))){ const s = getPath(root, m[1]), w = worker(val); if(w){ if(s.pricing === 'hour' && w.payType === 'hourly') s.rate = w.hourlyRate; if(w.pieceRates && num(w.pieceRates[s.stageId]) && s.pricing === 'unit') s.rate = w.pieceRates[s.stageId]; } }
  if((m = p.match(/^(.*(?:steps|workflow|addTasks)\.\d+)\.out$/))){ const s = getPath(root, m[1]); if(val){ s.tat = s.tat || 2; s.workerId = ''; } else s.vendorId = ''; }
  if((m = p.match(/^(.*components\.\d+)\.itemId$/))){ const c = getPath(root, m[1]), it = item(val); if(it){ c.rate = it.rate; c.unit = it.unit; c.category = it.category; if(!c.name) c.name = it.name; } }
  if((m = p.match(/^(.*components\.\d+)\.source$/))){ const c = getPath(root, m[1]); if(val === 'customer'){ c._rate = c.rate; c.rate = 0; } else if(c._rate) c.rate = c._rate; }
}

/* ---------------- plan editors (shared by new order, garment file, configurator) ---------------- */
function workerSelect(path, root, s, extraAttr){
  const ws = coll('workers').filter(w => w.active !== false), sk = ws.filter(w => (w.skills || []).includes(s.stageId)), ot = ws.filter(w => !(w.skills || []).includes(s.stageId));
  return `<select data-root="${root}" data-p="${path}.workerId" data-r ${extraAttr || ''}>${opt('', '— auto (least loaded) —', s.workerId)}${sk.map(w => opt(w.id, w.name, s.workerId)).join('')}${ot.length ? `<optgroup label="Other skills">${ot.map(w => opt(w.id, w.name, s.workerId)).join('')}</optgroup>` : ''}</select>`;
}
function vendorSelect(path, root, s){
  const vs = coll('vendors').filter(x => x.active !== false), sk = vs.filter(x => (x.services || []).includes(s.stageId));
  return `<select data-root="${root}" data-p="${path}.vendorId" data-r>${opt('', '— choose vendor —', s.vendorId)}${sk.map(x => opt(x.id, x.name, s.vendorId)).join('')}${vs.filter(x => !sk.includes(x)).length ? `<optgroup label="Other vendors">${vs.filter(x => !sk.includes(x)).map(x => opt(x.id, x.name, s.vendorId)).join('')}</optgroup>` : ''}</select>`;
}
function stepsTable(list, path, root, opts){
  opts = opts || {}; const stages = coll('stages'), prices = can('prices');
  const idx = list.map((s, j) => ({s, j})).sort((a, b) => num(a.s.seq) - num(b.s.seq) || a.j - b.j);
  return `<div class="scroll"><table class="ed" style="min-width:${prices ? 1060 : 820}px"><thead><tr><th style="width:56px">Seq</th><th style="width:150px">Stage</th><th>Piece / section</th><th style="width:180px">Worker / vendor</th>${prices ? '<th style="width:120px">Pay basis</th><th style="width:66px">Units</th><th style="width:84px">Rate ₹</th><th style="width:100px">Complexity</th>' : ''}<th style="width:80px">Hrs / TAT d</th>${opts.target ? '<th style="width:140px">Target date</th>' : ''}<th style="width:66px">Skip</th>${prices ? '<th class="n" style="width:84px">Cost</th>' : ''}<th style="width:36px"></th></tr></thead><tbody>
  ${idx.map(({s, j}) => { const P = `${path}.${j}`, out = isOut(s), k = stage(s.stageId).kind, locked = opts.lock && s.status !== 'pending';
    return `<tr class="${out ? 'ext' : ''}" style="${s.status === 'skipped' ? 'opacity:.5' : ''}"><td><input type="number" step="0.5" data-root="${root}" data-p="${P}.seq" value="${v(s.seq)}" data-r title="Same number = runs in parallel"></td>
    <td><select data-root="${root}" data-p="${P}.stageId" data-r ${locked ? 'disabled' : ''}>${stages.map(st => opt(st.id, st.name, s.stageId)).join('')}</select></td>
    <td><input data-root="${root}" data-p="${P}.label" value="${v(s.label)}" placeholder="e.g. Section: neckline">${opts.status && s.status !== 'pending' ? `<div style="margin-top:3px">${stepStatusChip(s)}</div>` : ''}</td>
    <td>${out ? vendorSelect(P, root, s) : k === 'trial' || k === 'qc' ? workerSelect(P, root, s) : workerSelect(P, root, s)}${k === 'work' ? `<label class="inline" style="font-size:11.5px;margin-top:3px"><input type="checkbox" data-root="${root}" data-p="${P}.out" ${s.out ? 'checked' : ''} data-r> outsource</label>` : ''}</td>
    ${prices ? (out ? `<td class="muted">Vendor charge</td><td></td><td><input type="number" step="any" data-root="${root}" data-p="${P}.charge" value="${v(s.charge)}"></td><td></td>` : `<td><select data-root="${root}" data-p="${P}.pricing" data-r>${opt('unit', 'Piece rate', s.pricing)}${opt('hour', 'Per hour', s.pricing)}${opt('fixed', 'Fixed', s.pricing)}</select></td><td>${s.pricing === 'unit' ? `<input type="number" step="any" data-root="${root}" data-p="${P}.units" value="${v(s.units)}">` : '—'}</td><td><input type="number" step="any" data-root="${root}" data-p="${P}.rate" value="${v(s.rate)}"></td><td>${s.pricing === 'hour' ? `<select data-root="${root}" data-p="${P}.cplx">${Object.keys(CPLX).map(c => opt(c, `${c} ×${CPLX[c]}`, s.cplx)).join('')}</select>` : '—'}</td>`) : ''}
    <td>${out ? `<input type="number" step="any" data-root="${root}" data-p="${P}.tat" value="${v(s.tat)}" title="Turnaround in shop working days">` : `<input type="number" step="any" data-root="${root}" data-p="${P}.hours" value="${v(s.hours)}">`}</td>
    ${opts.target ? `<td><input type="date" data-root="${root}" data-p="${P}.target" value="${v(s.target)}" title="Leave blank to use the stage target"></td>` : ''}
    <td style="text-align:center">${s.status === 'pending' || s.status === 'skipped' ? `<input type="checkbox" title="Skip this optional step" ${s.status === 'skipped' ? 'checked' : ''} onchange="toggleSkip('${root}','${P}',this.checked)">` : ''}</td>
    ${prices ? `<td class="n" data-amt="${P}">${opts.g ? inr(stepAmount(s, opts.g)) : ''}</td>` : ''}
    <td>${!locked ? `<button class="sm ghost danger" title="Remove" onclick="rmAt('${root}','${path}',${j})">✕</button>` : ''}</td></tr>`; }).join('')}
  </tbody></table></div>
  <div class="row" style="margin-top:6px"><button class="sm" onclick="addStepAt('${root}','${path}')">+ Add step</button><button class="sm" onclick="addStepAt('${root}','${path}','emb')">+ Embroidery section</button><button class="sm" onclick="addStepAt('${root}','${path}','dye')">+ Dyeing (outside)</button><button class="sm" onclick="addStepAt('${root}','${path}','hem')">+ Outside hemming</button>${opts.auto ? `<button class="sm" onclick="${opts.auto}">⚙ Auto-assign by bandwidth</button>` : ''}</div>
  <div class="hint">Steps with the same <b>Seq</b> number run in parallel (e.g. embroidery sections by different artisans). Tick <b>Skip</b> for optional steps this garment doesn't need.</div>`;
}
function compTable(list, path, root, g){
  const prices = can('prices'), cats = ST().categories || [];
  return `<div class="scroll"><table class="ed" style="min-width:${prices ? 900 : 700}px"><thead><tr><th>Piece / material</th><th style="width:150px">Category</th><th style="width:170px">Stock item</th><th style="width:110px">Supplied by</th><th style="width:70px">Unit</th><th style="width:70px">Qty</th>${prices ? '<th style="width:90px">Rate ₹</th><th class="n" style="width:84px">Amount</th>' : ''}<th style="width:36px"></th></tr></thead><tbody>
  ${list.map((c, j) => { const P = `${path}.${j}`; return `<tr><td><input data-root="${root}" data-p="${P}.name" value="${v(c.name)}"></td><td><select data-root="${root}" data-p="${P}.category">${cats.map(x => opt(x.id, x.name, c.category)).join('')}</select></td>
    <td><select data-root="${root}" data-p="${P}.itemId" data-r>${opt('', '— not from stock —', c.itemId)}${coll('inventory').filter(i => i.active !== false).map(i => opt(i.id, `${i.name} (${stockOf(i.id)} ${i.unit})`, c.itemId)).join('')}</select></td>
    <td><select data-root="${root}" data-p="${P}.source" data-r>${opt('studio', 'Studio', c.source)}${opt('customer', 'Customer', c.source)}</select></td>
    <td><input data-root="${root}" data-p="${P}.unit" value="${v(c.unit)}"></td><td><input type="number" step="any" data-root="${root}" data-p="${P}.qty" value="${v(c.qty)}"></td>
    ${prices ? `<td><input type="number" step="any" data-root="${root}" data-p="${P}.rate" value="${v(c.rate)}" ${c.source === 'customer' ? 'disabled' : ''}></td><td class="n" data-amt="${P}">${g ? inr(compAmount(c, g)) : ''}</td>` : ''}
    <td><button class="sm ghost danger" onclick="rmAt('${root}','${path}',${j})">✕</button></td></tr>`; }).join('') || `<tr><td colspan="9" class="muted">No materials listed</td></tr>`}
  </tbody></table></div><button class="sm" style="margin-top:6px" onclick="addCompAt('${root}','${path}')">+ Add material</button>`;
}
function rmAt(root, path, j){ getPath(rootOf(root), path).splice(j, 1); if(root === 'DB') save(); softRender(); }
function addCompAt(root, path){ getPath(rootOf(root), path).push({id: uid('c'), name: '', category: 'fabric', unit: 'm', qty: 1, rate: 0, source: 'studio', itemId: '', issued: 0}); if(root === 'DB') save(); softRender(); }
function addStepAt(root, path, sid){
  const L = getPath(rootOf(root), path), st = sid ? stage(sid) : coll('stages').find(x => x.kind === 'work') || coll('stages')[0];
  const maxSeq = Math.max(0, ...L.map(s => num(s.seq)));
  const seqOf = {dye: 1, emb: (L.find(s => s.stageId === 'emb') || {}).seq || 3};
  L.push({id: uid('s'), stageId: st.id, label: sid === 'emb' ? 'Section: ' : '', seq: seqOf[sid] || maxSeq + 1, optional: false, out: st.kind === 'external', pricing: sid === 'emb' ? 'hour' : 'unit', units: 1, rate: st.rate || 0, cplx: 'Simple', hours: st.kind === 'external' ? 0 : 1, tat: st.kind === 'external' ? 2 : 0, charge: 0, workerId: '', vendorId: '', status: 'pending', round: 1, target: '', startedAt: null, doneAt: null});
  if(root === 'DB') save(); softRender();
}
function toggleSkip(root, P, on){ const s = getPath(rootOf(root), P); s.status = on ? 'skipped' : 'pending'; if(root === 'DB') save(); softRender(); }
/* ---------------- orders list ---------------- */
function orderState(o){
  if(o.status === 'cancelled') return ['Cancelled', 'c-bad'];
  const gs = activeG(o), st = gs.map(gStatus);
  if(gs.length && st.every(x => x === 'delivered')) return ['Delivered', 'c-mut'];
  if(st.some(x => x === 'delivered')) return ['Partially delivered', 'c-info'];
  if(gs.length && st.every(x => x === 'ready' || x === 'delivered')) return ['Ready', 'c-ok'];
  if(st.some(x => x === 'ready')) return ['Partly ready', 'c-ok'];
  return ['In production', 'c-acc'];
}
VIEWS.orders = {perm: 'orders', title: 'Orders', fn: () => {
  const tab = UI.otab || 'garments', f = UI.ofilter || 'open', q = (UI.oq || '').toLowerCase(), today = todayISO(), sc = sched();
  const head = `<div class="row ac"><div><h1>Orders & garments</h1><div class="sub">Each garment has its own file, schedule and delivery date. Orders group them for billing.</div></div><span class="sp"></span>${can('orders.edit') ? '<button class="pri" onclick="newOrder()">+ New order</button>' : ''}</div>
  <div class="row ac" style="margin-bottom:12px"><div class="tabs" style="margin:0">${[['garments', 'Garments'], ['orders', 'Orders']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" onclick="UI.otab='${k}';render()">${l}</button>`).join('')}</div><span class="sp"></span>
  <select style="width:auto" onchange="UI.ofilter=this.value;render()">${[['open', 'In progress'], ['urgent', 'Urgent only'], ['late', 'Delayed / at risk'], ['ready', 'Ready'], ['delivered', 'Delivered'], ['all', 'All']].map(([k, l]) => opt(k, l, f)).join('')}</select>
  <input style="max-width:240px" placeholder="Filter by no., name, garment…" value="${v(UI.oq)}" onchange="UI.oq=this.value;render()"></div>`;
  if(tab === 'garments'){
    const L = coll('garments').filter(g => { const o = ord(g.orderId), c = cust(g.customerId), st = gStatus(g); if(!o) return false;
      if(q && !`${g.no} ${g.title} ${c?.name} ${c?.phone} ${tpl(g.tplId)?.name}`.toLowerCase().includes(q)) return false;
      if(f === 'open') return gLive(g); if(f === 'urgent') return gLive(g) && (g.urgent || o.urgent); if(f === 'late') return gLive(g) && ((g.deliveryDate && g.deliveryDate < today) || sc.G[g.id]?.late); if(f === 'ready') return st === 'ready'; if(f === 'delivered') return st === 'delivered'; return true; })
      .sort(by(g => (gLive(g) ? '0' : '1') + (g.deliveryDate || '9')));
    return head + `<div class="card">${L.length ? `<table class="stack"><thead><tr><th>Garment</th><th>Customer</th><th>Now at</th><th>Delivery</th><th>Expected</th><th>Progress</th><th>Status</th></tr></thead><tbody>${L.map(g => { const x = sc.G[g.id], p = progress(g), late = gLive(g) && ((g.deliveryDate && g.deliveryDate < today) || x?.late);
      return `<tr class="click ${late ? 'late' : ''}" onclick="go('garment-${g.id}')"><td><b>${h(g.no)}</b> ${urgentChip(g)}<div>${h(g.title)}</div><div class="muted" style="font-size:12px">${h(tpl(g.tplId)?.name || '')}${g.fabricSource !== 'studio' ? ' · customer fabric' : ''}</div></td><td>${h(cust(g.customerId)?.name)}</td><td>${h(gStageLabel(g))}</td><td>${dateChip(g.deliveryDate, !gLive(g))}</td><td>${gLive(g) && x ? `<span class="chip ${x.late ? 'c-bad' : 'c-ok'}">${fmtDs(x.ready)}</span>` : '—'}</td><td><div class="bar" style="width:90px"><i class="${p.pct === 100 ? 'ok' : ''}" style="width:${p.pct}%"></i></div><span class="muted" style="font-size:11px">${p.pct}%</span></td><td>${gChip(g)}</td></tr>`; }).join('')}</tbody></table>` : '<div class="empty">No garments match.</div>'}</div>`;
  }
  const L = coll('orders').filter(o => { const c = cust(o.customerId), [st] = orderState(o); if(q && !`${o.no} ${c?.name} ${c?.phone}`.toLowerCase().includes(q)) return false;
    if(f === 'open') return o.status !== 'cancelled' && st !== 'Delivered'; if(f === 'urgent') return o.urgent || activeG(o).some(g => g.urgent); if(f === 'late') return activeG(o).some(g => gLive(g) && ((g.deliveryDate && g.deliveryDate < today) || sc.G[g.id]?.late)); if(f === 'ready') return st.includes('eady'); if(f === 'delivered') return st === 'Delivered'; return true; })
    .sort(by(o => o.created, -1));
  return head + `<div class="card">${L.length ? `<table class="stack"><thead><tr><th>Order</th><th>Customer</th><th>Garments</th><th>Booked</th><th>Next delivery</th>${can('prices') ? '<th class="n">Total</th><th class="n">Balance</th>' : ''}<th>Status</th></tr></thead><tbody>${L.map(o => { const gs = activeG(o), T = orderTotals(o), [sl, sc2] = orderState(o), nx = gs.filter(gLive).map(g => g.deliveryDate).sort()[0];
    return `<tr class="click" onclick="go('order-${o.id}')"><td><b>${h(o.no)}</b> ${o.urgent ? '<span class="chip urgent">URGENT</span>' : ''}</td><td>${h(cust(o.customerId)?.name)}</td><td>${gs.map(g => `${h(g.title)} ${gChip(g)}`).join('<br>')}</td><td>${fmtD(o.created)}</td><td>${nx ? dateChip(nx) : '—'}</td>${can('prices') ? `<td class="n">${inr(T.total)}</td><td class="n">${T.bal > 0.5 ? inr(T.bal) : '<span class="chip c-ok">Paid</span>'}</td>` : ''}<td><span class="chip ${sc2}">${sl}</span></td></tr>`; }).join('')}</tbody></table>` : '<div class="empty">No orders match.</div>'}</div>`;
}};

/* ---------------- new order (and add garments to an order) ---------------- */
function newOrder(cid, oid){ EDIT = draftOrder(cid || '', oid || ''); go('neworder' + (oid ? '-' + oid : '')); }
function draftOrder(cid, oid){
  const o = oid ? ord(oid) : null;
  const E = {_oid: oid || '', customerId: o ? o.customerId : cid, _nc: {name: '', phone: '', email: '', address: '', fitPrefs: '', gender: '', dob: '', members: [{id: uid('m'), name: '', relation: 'Self', gender: '', dob: '', phone: '', notes: '', primary: true}]}, created: todayISO(), deliveryDate: o ? o.deliveryDate : iso(addDays(new Date(), 15)), urgent: o ? o.urgent : false, notes: '', instructions: '', discount: 0, referral: '', referredBy: '', markup: ST().markupPct, gstPct: ST().gstPct, advance: '', advanceMode: 'UPI', garments: []};
  E.garments.push(draftGarment(coll('templates')[0]?.id, E));
  return E;
}
function draftGarment(tplId, E){
  const t = tpl(tplId); const d = {_k: uid('k'), tplId, title: t ? t.name : '', qty: 1, memberId: draftMembers(E)[0]?.id || '', unit: defUnit(), profileId: '', profileLabel: '', person: 'Self', meas: {}, specs: {}, style: '', fit: '', urgent: false, instructions: '', fabricSource: 'studio', deliveryDate: E ? E.deliveryDate : '', designId: '', designApproved: false, files: [], components: [], steps: [], _open: false};
  applyTplToDraft(d, E); return d;
}
function applyTplToDraft(d, E){
  const t = tpl(d.tplId); if(!t) return;
  d.title = d._auto = draftTitle(d, E); d.components = t.components.map(c => ({...clone(c), id: uid('c'), issued: 0}));
  d.steps = t.workflow.map(x => ({...clone(x), id: uid('s'), status: 'pending', workerId: '', vendorId: '', round: 1, target: '', startedAt: null, doneAt: null}));
  d.specs = {}; (t.specs || []).forEach(s => d.specs[s.k] = '');
  d.designId = ''; pickProfileForDraft(d, E);
}
function pickProfileForDraft(d, E){
  const t = tpl(d.tplId), cid = E && E.customerId && E.customerId !== '__new' ? E.customerId : '';
  if(!draftMembers(E).some(m => m.id === d.memberId)) d.memberId = draftMembers(E)[0]?.id || '';
  const ps = cid ? draftProfiles(cid, d) : [];
  if(ps.length){ loadProfileIntoDraft(d, ps[0]); }
  else { d.profileId = ''; d.meas = {}; t.fields.forEach(f => d.meas[f.k] = ''); d.unit = defUnit(); d.profileLabel = t.name.split(' (')[0]; }
}
function draftTplChanged(i, val){ const d = EDIT.garments[i]; applyTplToDraft(d, EDIT); softRender(); }
function draftProfileChanged(i, val){ const d = EDIT.garments[i], p = prof(val); if(p) loadProfileIntoDraft(d, p); else { d.meas = {}; tpl(d.tplId).fields.forEach(f => d.meas[f.k] = ''); d.unit = defUnit(); d.profileLabel = tpl(d.tplId).name.split(' (')[0]; } softRender(); }
function loadProfileIntoDraft(d, p){ d.profileId = p.id; d.meas = clone(p.values); d.unit = p.unit || 'in'; d.specs = Object.assign({}, d.specs, clone(p.specs || {})); d.fit = p.fitNotes || ''; }
const draftProfiles = (cid, d) => coll('profiles').filter(p => p.customerId === cid && p.tplId === d.tplId && p.memberId === d.memberId).sort(by(p => p.updated, -1));
function draftMembers(E){ if(!E) return []; if(E.customerId === '__new') return E._nc.members; const c = cust(E.customerId); return c ? members(c) : []; }
function draftMemName(E, mid){ const m = draftMembers(E).find(x => x.id === mid); if(!m) return ''; return m.primary ? (E.customerId === '__new' ? (E._nc.name || 'Customer') : cust(E.customerId).name) : m.name; }
function draftTitle(d, E){ const t = tpl(d.tplId), m = draftMembers(E).find(x => x.id === d.memberId); const base = t ? t.name.split(' (')[0] : ''; return m && !m.primary ? `${m.name.split(' ')[0]} – ${base}` : base; }
function draftMemberChanged(i, val){
  const d = EDIT.garments[i];
  if(val === '__add'){ d.memberId = draftMembers(EDIT)[0]?.id || ''; softRender(); if(!EDIT.customerId) return toast('Select the customer first', 'bad'); addMember(EDIT.customerId, mid => { d.memberId = mid; if(d.title === d._auto) d.title = d._auto = draftTitle(d, EDIT); pickProfileForDraft(d, EDIT); softRender(); }); return; }
  if(d.title === d._auto) d.title = d._auto = draftTitle(d, EDIT);
  pickProfileForDraft(d, EDIT); softRender();
}
function setDraftUnit(i, u){ const d = EDIT.garments[i]; if(d.unit === u) return; d.meas = convertVals(d.meas, d.unit || 'in', u); d.unit = u; softRender(); toast(`Article ${i + 1}: converted to ${UNITS[u]}`, 'ok'); }
function addArticle(){ const t = document.getElementById('addTpl').value, m = document.getElementById('addMem')?.value; const d = draftGarment(t, EDIT); if(m && m !== '__add'){ d.memberId = m; d.title = d._auto = draftTitle(d, EDIT); pickProfileForDraft(d, EDIT); } EDIT.garments.forEach(x => x._open = false); EDIT.garments.push(d); softRender(); setTimeout(() => document.querySelectorAll('.gblock')[EDIT.garments.length - 1]?.scrollIntoView({behavior: 'smooth', block: 'start'}), 60); }
function draftCustomerChanged(){ EDIT.garments.forEach(d => { d.memberId = draftMembers(EDIT)[0]?.id || ''; if(d.title === d._auto) d.title = d._auto = draftTitle(d, EDIT); pickProfileForDraft(d, EDIT); }); softRender(); }
function draftAsGarment(d, i){ return {id: 'draft' + i, orderId: '__draft', customerId: EDIT.customerId, qty: d.qty, steps: d.steps, components: d.components, extras: [], headPrice: {}, trials: [], qc: [], delivery: {}, deliveryDate: d.deliveryDate, urgent: d.urgent || EDIT.urgent, created: nowISO(), status: 'active', tplId: d.tplId, design: {versions: []}}; }

VIEWS.neworder = {perm: 'orders.edit', title: 'New order', parent: 'orders', fn: (oid) => {
  if(!EDIT || (EDIT._oid || '') !== (oid || '')) EDIT = draftOrder('', oid || '');
  const E = EDIT, o = E._oid ? ord(E._oid) : null, c = cust(E.customerId);
  return `<div class="row ac"><div><div class="muted"><a href="#${o ? 'order-' + o.id : 'orders'}">← ${o ? h(o.no) : 'Orders'}</a></div><h1>${o ? 'Add garments to ' + h(o.no) : 'New order'}</h1><div class="sub">Customer → add article → who it is for → quantity → measurements on the diagrams → next article. Delivery dates and cost update as you type.</div></div><span class="sp"></span><button onclick="EDIT=null;go('${o ? 'order-' + o.id : 'orders'}')">Cancel</button></div>
  ${o ? `<div class="note" style="margin-bottom:16px"><b>${h(c?.name)}</b> · ${h(c?.phone)} · order booked ${fmtD(o.created)}</div>` : `<div class="grid2">
    <div class="card"><h3>Customer</h3>
      <div class="row"><div class="f" style="flex:3"><label>Customer *</label><select data-p="customerId" data-r>${opt('', '— select customer —', E.customerId)}${coll('customers').slice().sort(by(x => x.name)).map(x => opt(x.id, `${x.name} · ${x.phone || ''}`, E.customerId)).join('')}${opt('__new', '+ New customer…', E.customerId)}</select></div></div>
      ${E.customerId === '__new' ? `<div class="fgrid" style="margin-top:8px"><div><label>Name *</label><input data-p="_nc.name" value="${v(E._nc.name)}"></div><div><label>Mobile / WhatsApp *</label><input data-p="_nc.phone" value="${v(E._nc.phone)}" inputmode="tel"></div><div><label>Email</label><input data-p="_nc.email" value="${v(E._nc.email)}"></div><div><label>Address</label><input data-p="_nc.address" value="${v(E._nc.address)}"></div><div><label>Gender</label><select data-p="_nc.gender">${opt('', '—', E._nc.gender)}${GENDERS.map(([k, l]) => opt(k, l, E._nc.gender)).join('')}</select></div><div><label>Date of birth</label><input type="date" data-p="_nc.dob" value="${v(E._nc.dob)}"></div><div class="full"><label>Fitting preferences (kept for every future order)</label><textarea rows="2" data-p="_nc.fitPrefs">${h(E._nc.fitPrefs)}</textarea></div></div>
      <div class="msec-t">Family members</div><div>${E._nc.members.filter(m => !m.primary).map(m => `<span class="chip c-mut">${h(m.name)} · ${h(m.relation)}${ageOf(m.dob) !== '' ? ' · ' + ageOf(m.dob) + ' y' : ''}</span>`).join(' ') || '<span class="muted" style="font-size:12.5px">Only the customer so far.</span>'} <button class="sm" onclick="addMember('__new',()=>softRender())">+ Add family member</button></div>`
      : c ? `<div class="note" style="margin-top:8px"><b>${h(c.name)}</b> · ${h(c.phone)}<br><span class="muted">Fitting preferences:</span> ${h(c.fitPrefs || '—')}<br><span class="muted">Family:</span> ${members(c).map(m => `${h(memName(m, c))} (${h(m.relation)}${ageOf(m.dob) !== '' ? ', ' + ageOf(m.dob) : ''})`).join(' · ')} <button class="sm" onclick="addMember('${c.id}',()=>softRender())">+ Add member</button></div>` : ''}
    </div>
    <div class="card"><h3>Order</h3>
      <div class="fgrid"><div><label>Order date</label><input type="date" data-p="created" value="${v(E.created)}"></div><div><label>Delivery date *</label><input type="date" data-p="deliveryDate" value="${v(E.deliveryDate)}"></div>
      <div><label>&nbsp;</label><label class="inline"><input type="checkbox" data-p="urgent" ${E.urgent ? 'checked' : ''} data-r> <b class="danger">Urgent order</b></label></div>
      ${can('prices') ? `<div><label>Markup %</label><input type="number" step="any" data-p="markup" value="${v(E.markup)}"></div><div><label>GST %</label><input type="number" step="any" data-p="gstPct" value="${v(E.gstPct)}"></div><div><label>Discount ₹</label><input type="number" step="any" data-p="discount" value="${v(E.discount)}"></div><div><label>Referral discount ₹</label><input type="number" step="any" data-p="referral" value="${v(E.referral)}"></div><div><label>Referred by</label><input data-p="referredBy" value="${v(E.referredBy)}" placeholder="Name of referring client"></div><div><label>Advance received ₹</label><input type="number" step="any" data-p="advance" value="${v(E.advance)}"></div><div><label>Advance mode</label><select data-p="advanceMode">${['UPI', 'Cash', 'Card', 'Bank transfer'].map(m => opt(m, m, E.advanceMode)).join('')}</select></div>` : ''}
      <div class="full"><label>Special instructions (highlighted on every garment & job card)</label><textarea rows="2" data-p="instructions">${h(E.instructions)}</textarea></div><div class="full"><label>Order notes</label><input data-p="notes" value="${v(E.notes)}"></div></div>
    </div></div>`}
  ${E.garments.map((d, i) => draftBlock(d, i, c)).join('')}
  <div class="card addart"><h3>Add next article</h3><div class="row ac"><div class="f" style="flex:2"><label>Article</label><select id="addTpl">${articleOptions(EDIT.garments[EDIT.garments.length - 1]?.tplId)}</select></div><div class="f"><label>For</label><select id="addMem">${draftMembers(E).map(m => opt(m.id, `${draftMemName(E, m.id)} (${m.relation})`)).join('')}</select></div><button class="pri" style="align-self:flex-end" onclick="addArticle()">+ Add article</button></div><div class="hint">Add the same article again for a second type (e.g. two blouse designs), or articles for other family members — each keeps its own quantity and measurements.</div></div>
  <div class="card osum"><div class="row" style="align-items:flex-start;flex-wrap:nowrap"><div id="osum" style="flex:1"></div><button class="pri" id="saveOrderBtn" onclick="saveOrder()">Save order</button></div></div>`;
}};
function draftBlock(d, i, c){
  const t = tpl(d.tplId) || {fields: [], specs: []}, P = `garments.${i}`;
  const profs = c ? draftProfiles(c.id, d) : [], M = draftMembers(EDIT), mem = M.find(m => m.id === d.memberId);
  const dz = design(d.designId), filled = t.fields.filter(f => String(d.meas[f.k] ?? '').trim()).length;
  return `<div class="gblock"><div class="row ac"><span class="gnum">${i + 1}</span>
    <div class="f" style="flex:2"><label>Article</label><select data-p="${P}.tplId">${articleOptions(d.tplId)}</select></div>
    <div class="f"><label>For (family member)</label><select data-p="${P}.memberId">${M.map(m => opt(m.id, `${draftMemName(EDIT, m.id)} (${m.relation}${ageOf(m.dob) !== '' ? ', ' + ageOf(m.dob) : ''})`, d.memberId)).join('')}${opt('__add', '+ Add family member…', '')}</select></div>
    <div class="f s" style="flex-basis:70px;min-width:60px"><label>Qty</label><input type="number" min="1" data-p="${P}.qty" value="${v(d.qty)}"></div>
    <div class="f s"><label>Delivery date</label><input type="date" data-p="${P}.deliveryDate" value="${v(d.deliveryDate)}"></div>
    ${EDIT.garments.length > 1 ? `<button class="ghost danger" onclick="ask('Remove this article from the order?',()=>{EDIT.garments.splice(${i},1);softRender()})">Remove</button>` : ''}</div>
    <div class="row ac" style="margin-top:8px"><div class="f" style="flex:2"><label>Description (on invoice & job card)</label><input data-p="${P}.title" value="${v(d.title)}"></div>
      <label class="inline"><input type="checkbox" data-p="${P}.urgent" ${d.urgent ? 'checked' : ''}> <b class="danger">Urgent</b></label>
      <label class="inline">Fabric: <select data-p="${P}.fabricSource" data-r style="width:auto;margin-left:6px">${opt('studio', 'Studio provides', d.fabricSource)}${opt('customer', 'Customer supplied', d.fabricSource)}${opt('mixed', 'Mixed', d.fabricSource)}</select></label></div>
    <div class="mblock"><div class="row ac" style="margin-bottom:4px"><h3 style="margin:0">Measurements · ${h(mem ? draftMemName(EDIT, mem.id) : '')} · ${h(t.name.split(' (')[0])}</h3><span class="sp"></span>
      <div class="f" style="max-width:320px"><select data-p="${P}.profileId" aria-label="Saved measurement set">${profs.map(p => opt(p.id, `Saved: ${p.label} (${fmtDs(p.updated)}, ${unitLabel(p.unit || 'in')})`, d.profileId)).join('')}${opt('', '+ New measurement set', d.profileId)}</select></div>
      ${!d.profileId ? `<div class="f" style="max-width:220px"><input data-p="${P}.profileLabel" value="${v(d.profileLabel)}" placeholder="Name this set, e.g. Padded, deep back" aria-label="Name of new set"></div>` : ''}</div>
      <div class="hint">${d.profileId ? 'Loaded from this member\'s saved measurements — any change is saved as a new version; earlier versions stay in history.' : profs.length ? 'A new set will be saved for this member (the saved sets stay as they are).' : `First ${h(t.name.split(' (')[0])} measurements for this member — they will be saved for future orders.`} Press <b>Enter</b> to jump to the next measurement.</div>
      ${measGrid(t, d.meas, P + '.meas', 'EDIT', d.unit || 'in', `setDraftUnit.bind(null,${i})`)}
    </div>
    <div class="grid2" style="margin-top:12px">
      <div><h3>Customer liking / style <span class="danger" style="font-weight:normal">* required</span></h3>
        <textarea rows="4" data-p="${P}.style" placeholder="Silhouette, neck, sleeves, colours, embroidery density, what to avoid…">${h(d.style)}</textarea>
        ${(t.specs || []).length ? `<div class="msec-t">Article specifications</div><div class="mgrid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${t.specs.map(sp => `<div><label>${h(sp.label)}</label><input list="dl_${t.id}_${sp.k}" data-p="${P}.specs.${sp.k}" value="${v(d.specs[sp.k])}"><datalist id="dl_${t.id}_${sp.k}">${sp.options.map(o => `<option value="${h(o)}">`).join('')}</datalist></div>`).join('')}</div>` : ''}
        <label style="margin-top:8px">Fitting preferences for this article</label><textarea rows="2" data-p="${P}.fit">${h(d.fit)}</textarea>
        <label style="margin-top:8px">Special instructions</label><input data-p="${P}.instructions" value="${v(d.instructions)}" placeholder="Shown highlighted on job card">
      </div>
      <div><h3>Design file</h3>
        <div class="row ac">${dz ? `<div class="dimg" style="width:70px;height:54px;aspect-ratio:auto;border-radius:8px;flex-shrink:0" data-media="${h(dzCover(dz))}">✦</div><div><b>${h(dz.name)}</b> <span class="muted">${h(dz.code)} · ${h(dz.style || '')}</span></div>` : '<span class="muted">No catalogue design</span>'}<span class="sp"></span><button class="sm" onclick="pickDesignDraft(${i})">${dz ? 'Change' : 'Choose from catalogue'}</button>${dz ? `<button class="sm ghost danger" onclick="EDIT.garments[${i}].designId='';softRender()">✕</button>` : ''}</div>
        <div class="row ac" style="margin-top:8px"><label class="btn sm" style="margin:0;color:var(--ink)">⬆ Add fabric photo / sketch / reference<input type="file" accept="image/*" multiple style="display:none" onchange="draftFiles(${i},this)"></label><span class="muted" style="font-size:12px">${d.files.length} file${d.files.length === 1 ? '' : 's'}</span></div>
        ${d.files.length ? `<div class="thumbs" style="margin-top:6px">${d.files.map((f, k) => `<div class="thumb" data-media="${h(f.id)}"><span class="cap">${h(f.kind)}</span><button class="tbtn" onclick="EDIT.garments[${i}].files.splice(${k},1);softRender()">✕</button></div>`).join('')}</div>` : ''}
        <label class="inline" style="margin-top:8px"><input type="checkbox" data-p="${P}.designApproved" ${d.designApproved ? 'checked' : ''}> Customer has approved this design</label>
      </div>
    </div>
    <details style="margin-top:12px" ${d._open ? 'open' : ''} ontoggle="EDIT.garments[${i}]._open=this.open"><summary><b>Workflow & materials</b> <span class="muted" id="plansum-${i}"></span></summary>
      <h3 style="margin-top:10px">Production workflow — ${h(t.name)}</h3>${stepsTable(d.steps, P + '.steps', 'EDIT', {auto: `autoAssignDraft(${i})`})}
      <h3 style="margin-top:14px">Pieces & materials</h3>${compTable(d.components, P + '.components', 'EDIT')}
    </details>
    <div class="row ac" style="margin-top:10px;font-size:13px" id="gsum-${i}"></div>
  </div>`;
}
const dzCover = d => d.cover || d.samples[0] || d.sketches?.[0] || d.renders[0] || d.stencils[0] || '';
async function draftFiles(i, inp){
  const kinds = ['fabric', 'sketch', 'embroidery', 'reference'];
  const ids = await uploadImages(inp.files, 1400); inp.value = '';
  const d = EDIT.garments[i]; ids.forEach((id, k) => d.files.push({id, kind: d.files.length === 0 && k === 0 ? 'fabric' : 'reference', caption: ''}));
  softRender(); if(ids.length) toast(`${ids.length} image${ids.length > 1 ? 's' : ''} added — set the type on the garment's Design tab after saving`, 'ok');
}
function autoAssignDraft(i){ const d = EDIT.garments[i]; let n = 0; d.steps.forEach(s => { if(isOut(s) || s.workerId || s.status !== 'pending' || stage(s.stageId).kind === 'trial') return; const c = coll('workers').filter(z => z.active !== false && (z.skills || []).includes(s.stageId)).sort(by(z => sched().end[z.id] || 0)); if(c[0]){ s.workerId = c[0].id; n++; } }); softRender(); toast(n ? `Assigned ${n} step(s) to the least-loaded skilled workers` : 'Nothing to assign', 'ok'); }
function pickDesignDraft(i){
  const d = EDIT.garments[i], list = coll('designs').filter(x => x.active !== false), mine = list.filter(x => x.tplId === d.tplId);
  openModal(`<div class="mbar"><b>Choose a design</b><span class="sp"></span><button onclick="closeModal()">Close</button></div>${designGrid(mine, `chooseDesignDraft(${i},'ID')`)}${list.length > mine.length ? `<details style="margin-top:12px"><summary>Other garment types (${list.length - mine.length})</summary>${designGrid(list.filter(x => !mine.includes(x)), `chooseDesignDraft(${i},'ID')`)}</details>` : ''}`, true);
}
function chooseDesignDraft(i, did){
  closeModal(); const d = EDIT.garments[i], dz = design(did); d.designId = did;
  d.components = d.components.filter(c => !c.fromDesign); d.steps = d.steps.filter(s => !s.fromDesign);
  if(dz.addComps.length || dz.addTasks.length) ask(`Add “${dz.name}” extras to this garment's plan? (${dz.addComps.length} material(s), ${dz.addTasks.length} work step(s))`, () => { dz.addComps.forEach(c => d.components.push({...clone(c), id: uid('c'), fromDesign: did, issued: 0})); dz.addTasks.forEach(x => d.steps.push({...clone(x), id: uid('s'), status: 'pending', workerId: '', vendorId: '', round: 1, target: '', fromDesign: did})); softRender(); }, 'Add extras');
  softRender();
}
function refreshDraft(){
  if(route().v !== 'neworder' || !EDIT) return;
  const prices = can('prices'); let sub = 0, cost = 0;
  const fake = {markup: EDIT.markup};
  const prevGarments = DB.garments, prevOrders = DB.orders;
  const gs = EDIT.garments.map((d, i) => draftAsGarment(d, i));
  // temporarily add drafts so the scheduler accounts for current bandwidth
  DB.garments = prevGarments.concat(gs.map(g => Object.assign({}, g, {orderId: '__draft'}))); DB.orders = prevOrders.concat([{id: '__draft', status: 'open', urgent: EDIT.urgent, markup: EDIT.markup}]);
  SC = null; let sc;
  try{ sc = schedule(); } finally { DB.garments = prevGarments; DB.orders = prevOrders; SC = null; }
  EDIT.garments.forEach((d, i) => {
    const g = gs[i], b = garmentBill(g, fake); sub += b.total; cost += b.cost;
    const x = sc.G[g.id] || {}, el = document.getElementById('gsum-' + i);
    document.querySelectorAll(`[data-amt^="garments.${i}."]`).forEach(td => { const pth = td.dataset.amt; const obj = getPath(EDIT, pth); td.textContent = inr(pth.includes('.steps.') ? stepAmount(obj, g) : compAmount(obj, g)); });
    const ps = document.getElementById('plansum-' + i); if(ps) ps.textContent = `· ${liveSteps(g).length} steps · ${d.components.length} materials`;
    if(el) el.innerHTML = `<span class="chip ${x.late ? 'c-bad' : 'c-ok'}">Expected ready ${fmtD(x.ready)}</span> <span class="muted">delivery ${fmtD(d.deliveryDate)} · stitching target ${fmtD(groupTarget({deliveryDate: d.deliveryDate, created: EDIT.created, targets: {}}, 'stitching'))}</span>${prices ? `<span class="sp"></span><span class="muted">Cost ${inr(b.cost)} →</span> <b class="acc">${inr(b.total)}</b>` : ''}`;
  });
  const os = document.getElementById('osum'); if(!os) return;
  const disc = num(EDIT.discount) + num(EDIT.referral), taxable = Math.max(0, sub - disc), gst = taxable * num(EDIT.gstPct) / 100;
  os.innerHTML = prices ? `<div class="sumgrid"><div><span>Articles</span><b>${EDIT.garments.length} · ${sum(EDIT.garments, d => num(d.qty) || 1)} pcs</b></div><div><span>Input cost</span><b>${inr(cost)}</b></div><div><span>Subtotal</span><b>${inr(sub)}</b></div><div><span>Discounts</span><b>${inr(disc)}</b></div>${num(EDIT.gstPct) ? `<div><span>GST ${num(EDIT.gstPct)}%</span><b>${inr(gst)}</b></div>` : ''}<div><span>Payable</span><b class="acc">${inr(taxable + gst)}</b></div><div><span>Margin</span><b>${taxable ? Math.round((taxable - cost) / taxable * 100) : 0}%</b></div></div>` : `<div class="sumgrid"><div><span>Articles</span><b>${EDIT.garments.length} · ${sum(EDIT.garments, d => num(d.qty) || 1)} pcs</b></div></div>`;
}
VIEWS.neworder.after = () => refreshDraft();
async function saveOrder(){
  const E = EDIT; if(!E) return;
  const existing = E._oid ? ord(E._oid) : null;
  if(!existing){
    if(E.customerId === '__new'){ if(!E._nc.name.trim()) return toast("Enter the new customer's name", 'bad'); if(!E._nc.phone.trim()) return toast('Enter the customer\'s mobile number', 'bad'); }
    else if(!E.customerId) return toast('Select a customer', 'bad');
    if(!E.deliveryDate) return toast('Enter the delivery date', 'bad');
  }
  if(!E.garments.length) return toast('Add at least one article', 'bad');
  const miss = E.garments.findIndex(d => !String(d.style || '').trim());
  if(miss >= 0){ toast(`Article ${miss + 1}: customer liking / style is required`, 'bad'); document.querySelector(`[data-p="garments.${miss}.style"]`)?.focus(); return; }
  const btn = document.getElementById('saveOrderBtn'); if(btn){ btn.disabled = true; btn.textContent = 'Saving…'; }
  try{
    let o = existing;
    if(!o){
      let cid = E.customerId;
      if(cid === '__new'){ const c = {id: uid('c'), name: E._nc.name.trim(), phone: E._nc.phone.trim(), phone2: '', email: E._nc.email, address: E._nc.address, notes: '', fitPrefs: E._nc.fitPrefs, created: nowISO(), history: [{at: nowISO(), by: meName(), action: 'Customer created', changes: []}]};
        c.members = clone(E._nc.members); const pm = c.members.find(m => m.primary); Object.assign(pm, {name: c.name, phone: c.phone, gender: E._nc.gender, dob: E._nc.dob}); coll('customers').push(c); cid = c.id; }
      const n = await nextNo('order');
      o = {id: uid('o'), no: ST().orderPrefix + n, customerId: cid, created: E.created, deliveryDate: E.deliveryDate, urgent: !!E.urgent, notes: E.notes, instructions: E.instructions, discount: num(E.discount), referral: num(E.referral), referredBy: E.referredBy || '', gstPct: num(E.gstPct), markup: num(E.markup), payments: [], status: 'open', history: [{at: nowISO(), by: meName(), action: 'Order booked', changes: []}], createdBy: meName()};
      coll('orders').push(o);
      if(num(E.advance) > 0){ const rn = await nextNo('rcpt'); o.payments.push({id: uid('p'), date: E.created, amount: num(E.advance), mode: E.advanceMode, type: 'advance', note: 'Advance at booking', receiptNo: ST().rcptPrefix + String(rn).padStart(4, '0'), by: meName()}); }
    }
    const base = garmentsOf(o.id).length;
    E.garments.forEach((d, i) => {
      const idx = base + i + 1, t = tpl(d.tplId);
      // measurement profile: create or version
      let p = prof(d.profileId);
      const mem = member(o.customerId, d.memberId);
      if(!p){ p = {id: uid('p'), customerId: o.customerId, memberId: d.memberId, label: d.profileLabel || t.name.split(' (')[0], person: mem?.relation || 'Self', tplId: d.tplId, unit: d.unit || 'in', values: clone(d.meas), specs: clone(d.specs), fitNotes: d.fit, updated: nowISO(), versions: [{at: nowISO(), by: meName(), unit: d.unit || 'in', values: clone(d.meas), specs: clone(d.specs), fitNotes: d.fit, note: 'Taken for ' + o.no + '/' + idx}], history: []}; coll('profiles').push(p); }
      else if(JSON.stringify(p.values) !== JSON.stringify(d.meas) || (p.unit || 'in') !== (d.unit || 'in') || JSON.stringify(p.specs || {}) !== JSON.stringify(d.specs) || (p.fitNotes || '') !== (d.fit || '')){
        const before = clone(p); p.values = clone(d.meas); p.unit = d.unit || 'in'; p.specs = clone(d.specs); p.fitNotes = d.fit; p.updated = nowISO();
        p.versions.push({at: nowISO(), by: meName(), unit: d.unit || 'in', values: clone(d.meas), specs: clone(d.specs), fitNotes: d.fit, note: 'Updated for ' + o.no + '/' + idx}); logChange(p, 'Measurements updated for ' + o.no + '/' + idx, before, clone(p));
      }
      const files = d.files.map(f => ({id: f.id, kind: f.kind, caption: ''})), dz = design(d.designId);
      if(dz && !files.length) dzFiles(dz).forEach(f => files.push(f));
      const g = {id: uid('g'), orderId: o.id, customerId: o.customerId, idx, no: o.no + '/' + idx, tplId: d.tplId, title: d.title || t.name, qty: num(d.qty) || 1, profileId: p.id, memberId: d.memberId, unit: d.unit || 'in', meas: clone(d.meas), specs: clone(d.specs), style: d.style, fit: d.fit, urgent: !!d.urgent, instructions: d.instructions, fabricSource: d.fabricSource, deliveryDate: d.deliveryDate || o.deliveryDate, targets: {},
        components: d.components.map(c => ({...c, issued: 0})), steps: d.steps.map(s => ({...s})), design: {catalogId: d.designId, versions: (files.length || dz) ? [{v: 1, at: nowISO(), by: meName(), note: 'At booking', files, fields: {pattern: dz ? dz.name : '', placement: '', lining: '', trims: '', colours: '', notes: ''}, approved: !!d.designApproved, approvedAt: d.designApproved ? nowISO() : '', approvedBy: d.designApproved ? meName() : ''}] : [], approvedV: d.designApproved ? 1 : 0},
        trials: [], qc: [], delivery: {}, extras: [], headPrice: {}, status: 'active', history: [{at: nowISO(), by: meName(), action: 'Garment file created', changes: []}], created: nowISO()};
      coll('garments').push(g);
      if(d.fabricSource !== 'studio') coll('custMaterials').push({id: uid('cm'), customerId: o.customerId, orderId: o.id, garmentId: g.id, desc: d.components.filter(c => c.source === 'customer').map(c => c.name).join(', ') || 'Customer fabric for ' + g.title, qty: 1, unit: 'set', status: 'received', receivedAt: nowISO(), receivedBy: meName(), log: [{at: nowISO(), status: 'received', note: 'Received at booking', by: meName()}]});
      if(existing) o.history.push({at: nowISO(), by: meName(), action: `Garment ${g.no} added`, changes: []});
    });
    EDIT = null; save(); toast(`Order ${o.no} saved`, 'ok'); go('order-' + o.id); checkNotify();
    if(!existing) setTimeout(() => autoMsg(o.id, 'order_created'), 120);
  } catch(e){ console.error(e); toast('Could not save: ' + e.message, 'bad'); if(btn){ btn.disabled = false; btn.textContent = 'Save order'; } }
}
function dzFiles(dz){ return [...(dz.samples || []).slice(0, 2).map(id => ({id, kind: 'reference', caption: 'Catalogue: ' + dz.name})), ...(dz.sketches || []).slice(0, 1).map(id => ({id, kind: 'sketch', caption: 'Catalogue sketch'})), ...(dz.stencils || []).slice(0, 1).map(id => ({id, kind: 'khaka', caption: 'Catalogue khaka'}))]; }

/* ---------------- order page ---------------- */
VIEWS.order = {perm: 'orders', title: 'Order', parent: 'orders', fn: (id) => {
  const o = ord(id); if(!o) return '<div class="card">Order not found.</div>';
  const c = cust(o.customerId) || {}, gs = garmentsOf(o.id), T = orderTotals(o), [sl, scl] = orderState(o), prices = can('prices');
  const invs = coll('invoices').filter(i => i.orderId === o.id), msgs = coll('msgLog').filter(m => m.orderId === o.id).sort(by(m => m.at, -1));
  return `<div class="row ac"><div><div class="muted"><a href="#orders">← Orders</a></div><h1>${h(o.no)} <span class="chip ${scl}">${sl}</span> ${o.urgent ? '<span class="chip urgent">URGENT</span>' : ''}</h1><div class="sub"><a href="#customer-${c.id}">${h(c.name)}</a> · ${h(c.phone)} · booked ${fmtD(o.created)} by ${h(o.createdBy || '—')}</div></div><span class="sp"></span>
    ${can('comms') ? `<button onclick="openCompose('${o.id}')">💬 Message</button>` : ''}${can('orders.edit') && o.status !== 'cancelled' ? `<button onclick="editOrderHeader('${o.id}')">✎ Edit order</button><button onclick="newOrder('','${o.id}')">+ Add garment</button>` : ''}</div>
  ${o.instructions ? `<div class="flag"><b>Special instructions:</b> ${h(o.instructions)}</div>` : ''}${o.notes ? `<div class="note" style="margin-bottom:14px">📝 ${h(o.notes)}</div>` : ''}
  ${prices ? `<div class="kpis">${kpi('Garments', gs.filter(g => g.status !== 'cancelled').length)}${kpi('Order total', inr(T.total))}${kpi('Paid', inr(T.paid), 'ok')}${kpi('Balance', inr(T.bal), T.bal > 0.5 ? 'warn' : 'ok')}${kpi('Input cost', inr(T.cost))}${kpi('Margin', inr(T.margin), T.margin >= 0 ? 'ok' : 'bad', null, T.taxable ? Math.round(T.margin / T.taxable * 100) + '% of taxable' : '')}</div>` : ''}
  <h3>Garments — each has its own file, schedule and delivery date</h3>
  <div class="gcards" style="margin-bottom:16px">${gs.map(g => gCard(g, `<div class="trail">${trail(g, true)}</div>`)).join('')}</div>
  ${prices ? `<div class="grid2">
    <div class="card"><div class="row ac"><h3 style="margin:0">Payments</h3><span class="sp"></span>${can('billing') ? `<button class="sm pri" onclick="recordPayment('${o.id}')">+ Record payment</button>` : ''}</div>
      <table class="stack" style="margin-top:8px"><thead><tr><th>Date</th><th>Type</th><th>Mode</th><th>Receipt</th><th class="n">Amount</th><th></th></tr></thead><tbody>${(o.payments || []).map(p => `<tr><td>${fmtD(p.date)}</td><td>${h(p.type || '')}</td><td>${h(p.mode)}</td><td>${h(p.receiptNo || '')}</td><td class="n">${inr2(p.amount)}</td><td class="nowrap">${can('billing') ? `<button class="sm" onclick="receiptPDF('${o.id}','${p.id}')">PDF</button> <button class="sm ghost danger" onclick="rmPayment('${o.id}','${p.id}')">✕</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No payments yet</td></tr>'}</tbody></table>
      <div class="row" style="margin-top:8px;font-size:13px"><span>Subtotal ${inr(T.sub)} − discount ${inr(T.disc)} + GST ${inr(T.gst)} = <b>${inr(T.total)}</b></span><span class="sp"></span><span>Balance <b class="${T.bal > 0.5 ? 'danger' : ''}">${inr(T.bal)}</b></span></div>
      ${T.bal > 0.5 && can('comms') ? `<button class="sm" style="margin-top:8px" onclick="openCompose('${o.id}','payment_reminder')">💬 Payment reminder</button>` : ''}</div>
    <div class="card"><div class="row ac"><h3 style="margin:0">Invoices</h3><span class="sp"></span>${can('billing') ? `<button class="sm pri" onclick="invoiceDialog('${o.id}')">🧾 Generate invoice</button>` : ''}</div>
      <table class="stack" style="margin-top:8px"><thead><tr><th>Invoice</th><th>Date</th><th>Garments</th><th class="n">Total</th><th></th></tr></thead><tbody>${invs.map(i => `<tr><td><b>${h(i.no)}</b></td><td>${fmtD(i.date)}</td><td>${i.blocks.map(b => h(b.no)).join(', ')}</td><td class="n">${inr2(i.total)}</td><td class="nowrap"><button class="sm" onclick="viewInvoice('${i.id}')">View</button> <button class="sm" onclick="invoicePDF('${i.id}')">PDF</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">No invoice yet — invoice all garments together, or each as it is delivered.</td></tr>'}</tbody></table></div>
  </div>
  <div class="card"><h3>Costs linked to this order — materials, worker payments, vendor charges</h3><table class="stack"><thead><tr><th>Garment</th><th class="n">Materials</th><th class="n">Worker labour</th><th class="n">Vendors</th><th class="n">Total cost</th><th class="n">Price</th><th class="n">Profit</th></tr></thead><tbody>${gs.filter(g => g.status !== 'cancelled').map(g => { const b = garmentBill(g, o), cp = b.costParts; return `<tr><td>${h(g.no)} ${h(g.title)}</td><td class="n">${inr(cp.mat)}</td><td class="n">${inr(cp.lab)}</td><td class="n">${inr(cp.ext)}</td><td class="n">${inr(cp.total)}</td><td class="n">${inr(b.total)}</td><td class="n"><b>${inr(b.total - cp.total)}</b></td></tr>`; }).join('')}</tbody></table></div>` : ''}
  <div class="grid2"><div class="card"><div class="row ac"><h3 style="margin:0">Communication history</h3><span class="sp"></span>${can('comms') ? `<button class="sm" onclick="openCompose('${o.id}')">💬 New message</button>` : ''}</div>${msgs.length ? msgs.map(m => `<div style="border-bottom:1px solid var(--line);padding:8px 0"><div class="row ac" style="gap:6px"><span class="chip ${m.channel === 'WhatsApp' ? 'c-ok' : m.channel === 'SMS' ? 'c-info' : 'c-mut'}">${h(m.channel)}</span><b>${h(m.tplName)}</b><span class="sp"></span><span class="muted" style="font-size:12px">${fmtDT(m.at)} · ${h(m.by || '')}</span></div><div class="muted" style="font-size:12.5px;white-space:pre-wrap;margin-top:3px">${h(m.text.slice(0, 260))}</div></div>`).join('') : '<div class="empty">No messages yet.</div>'}</div>
    <div class="card"><h3>Order change history</h3>${histHTML(o.history)}${can('orders.edit') && o.status !== 'cancelled' ? `<div class="row" style="margin-top:10px"><span class="sp"></span><button class="sm ghost danger" onclick="cancelOrder('${o.id}')">Cancel order</button></div>` : o.status === 'cancelled' && can('orders.edit') ? `<button class="sm" onclick="reopenOrder('${o.id}')">Reopen order</button>` : ''}</div></div>`;
}};
function trail(g, compact){
  const out = [], seen = new Set(), today = todayISO();
  orderedSteps(g).forEach(s => {
    const key = compact ? s.stageId + (s.round > 1 ? 'r' : '') : s.id; if(seen.has(key)) return; seen.add(key);
    const grp = compact ? g.steps.filter(x => x.stageId === s.stageId && (x.round > 1) === (s.round > 1)) : [s];
    const live = grp.filter(x => x.status !== 'skipped'), done = live.length && live.every(x => x.status === 'done'), skip = !live.length, prog = live.some(x => x.status === 'in_progress'), late = !done && live.some(x => stepTarget(x, g) < today);
    out.push(`<span class="st ${done ? 'done' : skip ? 'skip' : prog ? 'prog' : ''} ${late && !prog ? 'late' : ''} ${isOut(s) ? 'ext' : ''}" title="${h(grp.map(x => x.label).join(', '))}">${done ? '✓ ' : ''}${h(stg(s).name.split(' (')[0])}${s.round > 1 ? ' ↺' : ''}${compact && live.length > 1 ? ` ×${live.length}` : ''}</span>`);
  });
  const st = gStatus(g); out.push(`<span class="st ${st === 'delivered' ? 'done' : st === 'ready' ? 'prog' : ''}">${st === 'delivered' ? '✓ Delivered' : 'Delivery'}</span>`);
  return out.join('<span class="arrow">›</span>');
}
function editOrderHeader(oid){
  const o = ord(oid);
  prompt2('Edit order ' + o.no, [{k: 'deliveryDate', label: 'Default delivery date', type: 'date', value: o.deliveryDate}, {k: 'urgent', label: 'Urgent', type: 'check', value: o.urgent, hint: 'Urgent order'}, ...(can('prices') ? [{k: 'discount', label: 'Discount ₹', type: 'number', value: o.discount}, {k: 'referral', label: 'Referral discount ₹', type: 'number', value: o.referral || ''}, {k: 'referredBy', label: 'Referred by', value: o.referredBy || ''}, {k: 'markup', label: 'Markup %', type: 'number', value: o.markup}, {k: 'gstPct', label: 'GST %', type: 'number', value: o.gstPct}] : []), {k: 'instructions', label: 'Special instructions', type: 'textarea', value: o.instructions, full: true}, {k: 'notes', label: 'Notes', type: 'textarea', value: o.notes, full: true}], x => {
    const before = clone(o); Object.assign(o, x); logChange(o, 'Order details changed', before, clone(o)); save(); render(); toast('Order updated', 'ok');
  });
}
function cancelOrder(oid){ ask('Cancel this order? Garments leave the production queue. Nothing is deleted — you can reopen it.', () => { const o = ord(oid); o.status = 'cancelled'; o.history.push({at: nowISO(), by: meName(), action: 'Order cancelled', changes: []}); save(); render(); }); }
function reopenOrder(oid){ const o = ord(oid); o.status = 'open'; o.history.push({at: nowISO(), by: meName(), action: 'Order reopened', changes: []}); save(); render(); }

/* ---------------- payments & receipts ---------------- */
function recordPayment(oid){
  const o = ord(oid), T = orderTotals(o);
  prompt2(`Record payment · ${o.no}`, [{k: 'amount', label: 'Amount ₹', type: 'number', value: r2(Math.max(0, T.bal)), required: true}, {k: 'date', label: 'Date', type: 'date', value: todayISO()}, {k: 'type', label: 'Type', type: 'select', value: o.payments.length ? 'instalment' : 'advance', options: [['advance', 'Advance'], ['instalment', 'Instalment'], ['final', 'Final / balance']]}, {k: 'mode', label: 'Mode', type: 'select', value: 'UPI', options: ['UPI', 'Cash', 'Card', 'Bank transfer', 'Cheque']}, {k: 'note', label: 'Note', full: true}], async x => {
    if(num(x.amount) <= 0) return toast('Enter an amount', 'bad');
    const n = await nextNo('rcpt'), p = {id: uid('p'), date: x.date || todayISO(), amount: num(x.amount), mode: x.mode, type: x.type, note: x.note, receiptNo: ST().rcptPrefix + String(n).padStart(4, '0'), by: meName()};
    o.payments.push(p); o.history.push({at: nowISO(), by: meName(), action: `Payment ${inr2(p.amount)} received (${p.receiptNo})`, changes: []}); save(); render();
    ask(`Payment recorded with receipt ${p.receiptNo}. Download the receipt now?`, () => receiptPDF(o.id, p.id), 'Download receipt');
    setTimeout(() => { if(!document.getElementById('ask').classList.contains('on')) autoMsg(o.id, 'payment', {amount: num(p.amount).toLocaleString('en-IN'), receipt_no: p.receiptNo}); }, 200);
  }, 'Save payment');
}
function quickPayment(){
  const L = coll('orders').filter(o => o.status !== 'cancelled' && orderTotals(o).bal > 0.5);
  if(!L.length) return toast('No orders with a balance', 'ok');
  prompt2('Record payment', [{k: 'oid', label: 'Order', type: 'select', options: L.map(o => [o.id, `${o.no} · ${cust(o.customerId)?.name} · balance ${inr(orderTotals(o).bal)}`]), full: true}], x => recordPayment(x.oid), 'Continue');
}
function rmPayment(oid, pid){ ask('Remove this payment? It stays in the order history.', () => { const o = ord(oid), p = o.payments.find(x => x.id === pid); o.payments = o.payments.filter(x => x.id !== pid); o.history.push({at: nowISO(), by: meName(), action: `Payment ${inr2(p.amount)} (${p.receiptNo}) removed`, changes: []}); save(); render(); }); }

/* ---------------- invoices ---------------- */
function invoiceDialog(oid){
  const o = ord(oid), gs = activeG(o), inv0 = new Set(coll('invoices').filter(i => i.orderId === oid).flatMap(i => i.garmentIds));
  openModal(`<div class="mbar"><b>Generate invoice · ${h(o.no)}</b><span class="sp"></span><button onclick="closeModal()">Close</button><button class="pri" onclick="doInvoice('${oid}')">Generate invoice</button></div>
  <p class="muted" style="margin-top:0">Tick the articles to bill — a partly delivered order can be invoiced article by article. The work detail prints under each article on the invoice.</p>
  ${gs.map(g => `<div class="invart"><label class="inline" style="display:flex;margin:0"><input type="checkbox" class="invg" value="${g.id}" ${inv0.has(g.id) ? '' : 'checked'}> <b>${h(g.no)}</b>&nbsp;${h(g.title)}${gq(g) > 1 ? ` × ${gq(g)}` : ''}&nbsp;${memChip(g.customerId, g.memberId)} ${gChip(g)}<span class="sp"></span><span class="muted">${inr(garmentBill(g, o).total)}${inv0.has(g.id) ? ' · already invoiced' : ''}</span></label>
    <textarea rows="2" class="invd" data-g="${g.id}" placeholder="Detailing of work for this article">${h(workDetail(g))}</textarea></div>`).join('')}
  <div class="fgrid" style="margin-top:12px"><div><label>Invoice date</label><input type="date" id="invDate" value="${todayISO()}"></div>
    <div><label>Discount ₹ (order)</label><input type="number" step="any" id="invDisc" value="${v(o.discount || '')}"></div>
    <div><label>Referral discount ₹</label><input type="number" step="any" id="invRef" value="${v(o.referral || '')}"></div>
    <div><label>Referred by</label><input id="invRefBy" value="${v(o.referredBy || '')}" placeholder="Name of referring client"></div>
    <div class="full"><label>Special instructions (printed in the notes)</label><input id="invInstr" value="${v(o.instructions || '')}"></div></div>
  <div class="hint">Discounts apply to the whole order and are deducted from the bill total; the amount payable is shown after them.</div>`, true);
}
async function doInvoice(oid){
  const ids = [...document.querySelectorAll('.invg:checked')].map(x => x.value); if(!ids.length) return toast('Pick at least one article', 'bad');
  const o = ord(oid), before = clone(o);
  document.querySelectorAll('.invd').forEach(t => { const g = gar(t.dataset.g), auto = autoWorkDetail(g), val = t.value.trim(); const nv = val === auto ? '' : val; if((g.invDetail || '') !== nv){ g.invDetail = nv; } });
  const nd = num(document.getElementById('invDisc').value), nr = num(document.getElementById('invRef').value), rb = document.getElementById('invRefBy').value.trim(), ins = document.getElementById('invInstr').value.trim();
  if(nd !== num(o.discount) || nr !== num(o.referral) || rb !== (o.referredBy || '') || ins !== (o.instructions || '')){ Object.assign(o, {discount: nd, referral: nr, referredBy: rb, instructions: ins}); logChange(o, 'Billing details changed at invoicing', before, clone(o)); }
  const n = await nextNo('inv'), i = makeInvoice(o, ids, document.getElementById('invDate').value, ST().invPrefix + String(n).padStart(4, '0'));
  closeModal(); save(); render(); viewInvoice(i.id); toast(`Invoice ${i.no} generated`, 'ok');
}
const nf = x => num(x).toLocaleString('en-IN', {maximumFractionDigits: 2});
function viewInvoice(iid){
  const i = inv(iid), o = ord(i.orderId), c = cust(o.customerId) || {}, s = ST(), T = orderTotals(o), H = invHeads(i), legacy = i.disc1 === undefined;
  const pays = (o.payments || []).slice().sort(by(p => p.date));
  openModal(`<div class="mbar"><b>Invoice ${h(i.no)}</b><span class="sp"></span>${can('comms') ? `<button onclick="closeModal();openCompose('${o.id}','payment_reminder')">💬 Send</button>` : ''}<button onclick="regenInvoice('${i.id}')">↻ Regenerate</button><button class="pri" onclick="invoicePDF('${i.id}')">⬇ PDF</button><button onclick="closeModal()">Close</button></div>
  <div class="invdoc">
  <div class="row" style="justify-content:space-between;align-items:flex-start"><div class="row ac" style="flex-wrap:nowrap">${s.logo ? `<img data-media="${h(s.logo.startsWith('data:') ? '' : s.logo)}" src="${s.logo.startsWith('data:') ? s.logo : ''}" style="max-height:56px">` : ''}<div><div class="ishop">${h(s.shop)}</div><div class="itag">${h(s.tagline || '')}</div></div></div>
    <div class="right" style="font-size:12.5px">${s.address ? `<div>📍 ${h(s.address)}</div>` : ''}${s.phone ? `<div>📞 ${h(s.phone)}${s.landline ? ' / ' + h(s.landline) : ''}</div>` : ''}${s.email ? `<div>✉ ${h(s.email)}</div>` : ''}${s.website ? `<div>${h(s.website)}</div>` : ''}${s.gstin ? `<div>GSTIN ${h(s.gstin)}</div>` : ''}</div></div>
  <div class="ititle">${s.gstin && i.gstPct ? 'TAX INVOICE' : 'INVOICE'}</div>
  <div class="row" style="justify-content:space-between;align-items:flex-start;gap:20px"><div><span class="muted">Bill to</span><div style="font-size:15px"><b>${h(c.name)}</b></div><div>📞 ${h(c.phone || '')}${c.phone2 ? ' / ' + h(c.phone2) : ''}</div>${c.email ? `<div>✉ ${h(c.email)}</div>` : ''}${c.address ? `<div>${h(c.address)}</div>` : ''}</div>
    <table class="ikv"><tr><td>Invoice no</td><td><b>${h(i.no)}</b></td></tr><tr><td>Date</td><td>${fmtD(i.date)}</td></tr><tr><td>Order</td><td>${h(o.no)} · booked ${fmtD(o.created)}</td></tr></table></div>
  <h3 style="margin-top:14px">Order details <span style="font-weight:normal">· per-unit charges by category</span></h3>
  <div class="scroll"><table class="imatrix"><thead><tr><th>Sr</th><th style="min-width:200px">Item description</th><th class="n">Qty</th>${H.map(hd => `<th class="n">${h(hd.name)}</th>`).join('')}<th class="n">Unit price</th><th class="n">Total</th></tr></thead><tbody>
  ${i.blocks.map((b, k) => `<tr><td>${k + 1}.</td><td><b>${h(b.title)}</b>${b.member ? `<div class="muted" style="font-size:12px">For ${h(b.member)}</div>` : ''}${b.detail ? `<div style="font-size:12px;margin-top:2px">${h(b.detail)}</div>` : ''}</td><td class="n">${b.qty || 1}</td>${H.map(hd => { const x = invCell(b, hd); return `<td class="n">${x ? nf(x) : '–'}</td>`; }).join('')}<td class="n">${nf(b.unit ?? b.total / (b.qty || 1))}</td><td class="n"><b>${nf(b.total)}</b></td></tr>`).join('')}
  <tr class="isub"><td></td><td><b>Subtotal</b></td><td class="n">${sum(i.blocks, b => b.qty || 1)}</td>${H.map(() => '<td></td>').join('')}<td></td><td class="n"><b>${nf(i.sub)}</b></td></tr></tbody></table></div>
  <div class="row" style="align-items:flex-start;gap:24px;margin-top:14px">
    <div style="flex:1;min-width:260px"><h3>Summary</h3><table class="ikv2"><tr><td>Subtotal</td><td class="n">${inr2(i.sub)}</td></tr>${legacy ? (i.discount ? `<tr><td>Discount</td><td class="n">− ${inr2(i.discount)}</td></tr>` : '') : `${i.disc1 ? `<tr><td>Discount</td><td class="n">− ${inr2(i.disc1)}</td></tr>` : ''}${i.referral ? `<tr><td>Referral discount${i.referredBy ? ' (ref. ' + h(i.referredBy) + ')' : ''}</td><td class="n">− ${inr2(i.referral)}</td></tr>` : ''}`}
      ${i.tax ? `${i.discount ? `<tr><td>Taxable value</td><td class="n">${inr2(i.taxable)}</td></tr>` : ''}${i.taxMode === 'inter' ? `<tr><td>IGST ${i.gstPct}%</td><td class="n">${inr2(i.tax)}</td></tr>` : `<tr><td>CGST ${i.gstPct / 2}%</td><td class="n">${inr2(i.cgst)}</td></tr><tr><td>SGST ${i.gstPct / 2}%</td><td class="n">${inr2(i.sgst)}</td></tr>`}` : ''}
      <tr class="itot"><td>Total amount payable</td><td class="n">${inr2(i.total)}</td></tr></table><div class="hint">${h(amountWords(i.total))}</div></div>
    <div style="flex:1;min-width:300px"><h3>Payment details${T.total - i.total > 1 ? ` <span style="font-weight:normal">(whole order ${h(o.no)} · ${inr(T.total)})</span>` : ''}</h3><table class="ikv2"><tr class="ih"><td>Particulars</td><td class="n">Amount</td><td>Mode</td><td>Date</td></tr>${pays.map(p => `<tr><td>${payLabel(p)}</td><td class="n">${inr2(p.amount)}</td><td>${h(p.mode)}</td><td>${fmtD(p.date)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No payment received yet</td></tr>'}
      <tr class="itot"><td>Total paid</td><td class="n">${inr2(T.paid)}</td><td></td><td></td></tr><tr class="${T.bal > 0.5 ? 'idue' : ''}"><td><b>Balance due</b></td><td class="n"><b>${inr2(Math.max(0, T.bal))}</b></td><td></td><td></td></tr></table></div></div>
  <h3 style="margin-top:14px">Notes</h3><ul class="inotes">${invNotes(i).map(([k, x]) => `<li><b>${h(k)}:</b> ${h(x)}</li>`).join('')}</ul>
  ${s.upiId || s.bank ? `<div class="hint">Pay by ${s.upiId ? 'UPI ' + h(s.upiId) : ''} ${h(s.bank || '')}</div>` : ''}
  <div class="ifoot"><div class="ithanks">${h(s.invoiceFooter || 'Thank you for choosing ' + s.shop + '!')} ♥</div><div class="muted" style="font-size:11.5px">${h(s.terms || '')}</div></div></div>`, true);
}
function regenInvoice(iid){ const i = inv(iid), o = ord(i.orderId); ask('Rebuild this invoice from the garments\' current charges? The number stays the same and the change is logged.', () => { makeInvoice(o, i.garmentIds, todayISO(), i.no, i); save(); viewInvoice(iid); toast('Invoice regenerated', 'ok'); }); }
