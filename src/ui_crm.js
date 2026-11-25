/* =====================================================================
   ui_crm.js : customer CRM — household with primary & family members,
               article-wise measurement sets per member, with versions
   ===================================================================== */
VIEWS.customers = {perm: 'customers', title: 'Customers', fn: () => {
  const q = (UI.cq || '').toLowerCase();
  const L = coll('customers').filter(c => !q || `${c.name} ${c.phone} ${c.phone2} ${c.email} ${members(c).map(m => m.name + ' ' + m.relation).join(' ')}`.toLowerCase().includes(q)).sort(by(c => c.name));
  return `<div class="row ac"><div><h1>Customers & family</h1><div class="sub">One account per customer, with family members (spouse, daughter, son…). Measurements are kept per member and per article.</div></div><span class="sp"></span><button class="pri" onclick="newCustomer()">+ New customer</button></div>
  <div class="card"><input placeholder="Search customer, family member or phone…" value="${v(UI.cq)}" oninput="UI.cq=this.value;clearTimeout(window._cqt);window._cqt=setTimeout(()=>{softRender();const i=document.querySelector('main input');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250)" style="max-width:340px;margin-bottom:10px">
  <table class="stack"><thead><tr><th>Customer</th><th>Phone</th><th>Family members</th><th class="n">Measurement sets</th><th class="n">Garments</th>${can('prices') ? '<th class="n">Balance due</th>' : ''}</tr></thead><tbody>
  ${L.map(c => { const ps = coll('profiles').filter(p => p.customerId === c.id), gs = coll('garments').filter(g => g.customerId === c.id), bal = can('prices') ? sum(coll('orders').filter(o => o.customerId === c.id && o.status !== 'cancelled'), o => Math.max(0, orderTotals(o).bal)) : 0;
    return `<tr class="click" onclick="go('customer-${c.id}')"><td><b>${h(c.name)}</b></td><td>${h(c.phone)}</td><td>${members(c).filter(m => !m.primary).map(m => `<span class="chip c-mut">${h(m.name)} · ${h(m.relation)}</span>`).join(' ') || '<span class="muted">—</span>'}</td><td class="n">${ps.length}</td><td class="n">${gs.length}</td>${can('prices') ? `<td class="n">${bal > 0.5 ? inr(bal) : '—'}</td>` : ''}</tr>`; }).join('') || '<tr><td colspan="6" class="empty">No customers</td></tr>'}</tbody></table></div>`;
}};
function newCustomer(){
  prompt2('New customer (primary member)', [{k: 'name', label: 'Name', required: true}, {k: 'phone', label: 'Mobile / WhatsApp', required: true}, {k: 'gender', label: 'Gender', type: 'select', options: [['', '—'], ...GENDERS]}, {k: 'dob', label: 'Date of birth', type: 'date'}, {k: 'phone2', label: 'Alternate phone'}, {k: 'email', label: 'Email'}, {k: 'address', label: 'Address', full: true}, {k: 'fitPrefs', label: 'Fitting preferences', type: 'textarea', full: true}], x => {
    const {gender, dob, ...rest} = x;
    const c = Object.assign({id: uid('c'), notes: '', created: nowISO(), history: [{at: nowISO(), by: meName(), action: 'Customer created', changes: []}]}, rest);
    c.members = [{id: uid('m'), name: c.name, relation: 'Self', gender, dob, phone: c.phone, notes: '', primary: true}];
    coll('customers').push(c); save(); go('customer-' + c.id);
  }, 'Create');
}
function editCustomer(cid){ const c = cust(cid); prompt2('Edit customer', [{k: 'name', label: 'Name', value: c.name, required: true}, {k: 'phone', label: 'Mobile', value: c.phone, required: true}, {k: 'phone2', label: 'Alternate phone', value: c.phone2}, {k: 'email', label: 'Email', value: c.email}, {k: 'address', label: 'Address', value: c.address, full: true}, {k: 'fitPrefs', label: 'Fitting preferences', type: 'textarea', value: c.fitPrefs, full: true}, {k: 'notes', label: 'Notes', type: 'textarea', value: c.notes, full: true}], x => { const before = clone(c); Object.assign(c, x); const pm = primaryMember(c); pm.name = c.name; pm.phone = c.phone; logChange(c, 'Customer details changed', before, clone(c)); save(); render(); }); }

/* ---------------- family members ---------------- */
function memberFields(m){ return [{k: 'name', label: 'Name', value: m?.name, required: true}, {k: 'relation', label: 'Relation to customer', type: 'select', options: m?.primary ? ['Self'] : RELATIONS.filter(r => r !== 'Self'), value: m?.relation}, {k: 'gender', label: 'Gender', type: 'select', options: [['', '—'], ...GENDERS], value: m?.gender}, {k: 'dob', label: 'Date of birth', type: 'date', value: m?.dob}, {k: 'phone', label: 'Phone (optional)', value: m?.phone}, {k: 'notes', label: 'Notes (fit, preferences)', value: m?.notes, full: true}]; }
// add a member to a saved customer, or to the new-customer draft (cid === '__new'); then(mid) gets the new id
function addMember(cid, then){
  prompt2('Add family member', memberFields(null), x => {
    if(!x.name.trim()) return toast('Enter a name', 'bad');
    const m = {id: uid('m'), name: x.name.trim(), relation: x.relation, gender: x.gender, dob: x.dob, phone: x.phone, notes: x.notes};
    if(cid === '__new'){ EDIT._nc.members.push(m); }
    else { const c = cust(cid), before = clone(c); members(c).push(m); logChange(c, `Family member added: ${m.name} (${m.relation})`, before, clone(c)); save(); }
    toast(`${m.name} added`, 'ok'); then ? then(m.id) : render();
  }, 'Add member');
}
function editMember(cid, mid){
  const c = cust(cid), m = member(cid, mid);
  prompt2('Edit family member', memberFields(Object.assign({}, m, {name: memName(m, c)})), x => {
    const before = clone(c); Object.assign(m, x); if(m.primary){ c.name = m.name; if(x.phone) c.phone = x.phone; }
    coll('profiles').filter(p => p.memberId === mid).forEach(p => p.person = m.relation);
    logChange(c, `Family member updated: ${m.name}`, before, clone(c)); save(); render();
  });
}
function removeMember(cid, mid){
  const c = cust(cid), m = member(cid, mid), used = coll('garments').some(g => g.memberId === mid) || coll('profiles').some(p => p.memberId === mid);
  if(used) return toast(`${m.name} has measurements or garments on file — edit instead of removing`, 'bad');
  ask(`Remove ${m.name} from ${c.name}'s family?`, () => { const before = clone(c); c.members = members(c).filter(x => x.id !== mid); logChange(c, `Family member removed: ${m.name}`, before, clone(c)); save(); render(); }, 'Remove');
}

VIEWS.customer = {perm: 'customers', title: 'Customer', parent: 'customers', fn: (id) => {
  const c = cust(id); if(!c) return '<div class="card">Customer not found.</div>';
  const M = members(c), ps = coll('profiles').filter(p => p.customerId === id), os = coll('orders').filter(o => o.customerId === id).sort(by(o => o.created, -1)), gs = coll('garments').filter(g => g.customerId === id);
  const alts = []; gs.forEach(g => (g.trials || []).forEach(t => (t.alterations || []).forEach(a => alts.push({g, t, a}))));
  const cms = coll('custMaterials').filter(m => m.customerId === id), pm = primaryMember(c);
  const orphan = ps.filter(p => !M.some(m => m.id === p.memberId));
  return `<div class="row ac"><div><div class="muted"><a href="#customers">← Customers</a></div><h1>${h(c.name)}</h1><div class="sub">${h(c.phone)}${c.phone2 ? ' / ' + h(c.phone2) : ''}${c.email ? ' · ' + h(c.email) : ''} · ${M.length} member${M.length > 1 ? 's' : ''} · customer since ${fmtD(c.created)}</div></div><span class="sp"></span>${can('comms') ? `<button onclick="openCompose(null,null,'${c.id}')">💬 Message</button>` : ''}<button onclick="editCustomer('${c.id}')">✎ Edit</button>${can('orders.edit') ? `<button class="pri" onclick="newOrder('${c.id}')">+ New order</button>` : ''}</div>
  <div class="grid2"><div class="card"><h3>Details & fitting preferences</h3><div>${h(c.address || '—')}</div><div class="flag gold" style="margin:10px 0 0"><b>Fitting preferences:</b> ${h(c.fitPrefs || '—')}</div>${c.notes ? `<div class="hint">${h(c.notes)}</div>` : ''}</div>
  <div class="card"><h3>Orders</h3><table class="stack"><tbody>${os.map(o => { const [sl, scl] = orderState(o); return `<tr class="click" onclick="go('order-${o.id}')"><td><b>${h(o.no)}</b></td><td>${fmtD(o.created)}</td><td>${activeG(o).map(g => h(g.title)).join(', ')}</td>${can('prices') ? `<td class="n">${inr(orderTotals(o).total)}</td>` : ''}<td><span class="chip ${scl}">${sl}</span></td></tr>`; }).join('') || '<tr><td class="muted">No orders yet</td></tr>'}</tbody></table></div></div>
  <div class="card"><div class="row ac"><h3 style="margin:0">Family members</h3><span class="sp"></span><button class="sm" onclick="addMember('${c.id}')">+ Add family member</button></div>
    <table class="stack members" style="margin-top:8px"><thead><tr><th>Member</th><th>Relation</th><th>Gender</th><th>Date of birth</th><th>Age</th><th>Measurement sets (article-wise)</th><th class="n">Garments</th><th></th></tr></thead><tbody>
    ${M.map(m => { const mp = ps.filter(p => p.memberId === m.id), mg = gs.filter(g => g.memberId === m.id), a = ageOf(m.dob);
      return `<tr><td><b>${h(memName(m, c))}</b>${m.primary ? ' <span class="chip c-acc">Primary</span>' : ''}${m.phone && !m.primary ? `<div class="muted" style="font-size:12px">${h(m.phone)}</div>` : ''}${m.notes ? `<div class="muted" style="font-size:12px">${h(m.notes)}</div>` : ''}</td><td>${h(m.relation)}</td><td>${h((GENDERS.find(x => x[0] === m.gender) || ['', '—'])[1])}</td><td>${m.dob ? fmtD(m.dob) : '—'}</td><td>${a !== '' ? a + ' yrs' : '—'}</td>
      <td>${mp.map(p => `<button class="sm" style="margin:2px" onclick="viewProfile('${p.id}')">${h(tpl(p.tplId)?.name?.split(' (')[0] || '')}${p.label && !(tpl(p.tplId)?.name || '').startsWith(p.label) ? ' · ' + h(p.label) : ''}</button>`).join('') || '<span class="muted">—</span>'}</td><td class="n">${mg.length}</td>
      <td style="white-space:nowrap"><button class="sm" onclick="newProfile('${c.id}','${m.id}')">+ Measurements</button><button class="sm ghost" onclick="editMember('${c.id}','${m.id}')">✎</button>${m.primary ? '' : `<button class="sm ghost danger" onclick="removeMember('${c.id}','${m.id}')">✕</button>`}</td></tr>`; }).join('')}</tbody></table></div>
  <div class="card"><div class="row ac"><h3 style="margin:0">Measurements — per member, per article, with version history</h3><span class="sp"></span><button class="sm" onclick="newProfile('${c.id}')">+ New measurement set</button></div>
    ${M.map(m => { const mp = ps.filter(p => p.memberId === m.id); return mp.length ? `<div class="msec-t" style="margin-top:12px">${h(memName(m, c))} <span class="muted" style="font-weight:normal">· ${h(m.relation)}</span></div><div class="gcards">${mp.map(profCard).join('')}</div>` : ''; }).join('')}
    ${orphan.length ? `<div class="msec-t" style="margin-top:12px">Not linked to a member</div><div class="gcards">${orphan.map(profCard).join('')}</div>` : ''}
    ${!ps.length ? '<div class="empty">No measurements yet — they are taken with the first order, or add a set here.</div>' : ''}</div>
  <div class="card"><h3>Alteration history — available for future orders</h3>${alts.length ? `<table class="stack"><thead><tr><th>Date</th><th>Garment</th><th>For</th><th>Area</th><th>Instruction</th><th>Master</th></tr></thead><tbody>${alts.sort(by(x => x.t.date, -1)).map(({g, t, a}) => `<tr class="click" onclick="go('garment-${g.id}')"><td>${fmtD(t.date)}</td><td>${h(g.no)} ${h(g.title)}</td><td>${h(memLabel(g.customerId, g.memberId, true) || '—')}</td><td>${h(a.area)}</td><td>${h(a.instruction)}</td><td>${h(worker(a.masterId)?.name || '—')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No alterations recorded.</div>'}</div>
  ${cms.length ? `<div class="card"><h3>Customer-supplied materials</h3>${cms.map(custMatRow).join('')}</div>` : ''}
  <div class="card"><h3>Change history</h3>${histHTML(c.history)}</div>`;
}};
function profCard(p){
  const t = tpl(p.tplId) || {fields: []}, filled = (t.fields || []).filter(f => String(p.values[f.k] ?? '').trim()).length;
  return `<div class="gcard" style="cursor:default"><div class="row ac"><span class="t">${h(t.name?.split(' (')[0] || '')}</span><span class="sp"></span><span class="chip c-mut">${UNITS[p.unit || 'in']}</span></div><div style="font-size:13px">${h(p.label || '')}</div><div class="muted" style="font-size:12.5px">${filled}/${(t.fields || []).length} measurements · ${p.versions.length} version${p.versions.length > 1 ? 's' : ''} · updated ${fmtD(p.updated)}</div>${p.fitNotes ? `<div style="font-size:12.5px;margin-top:4px;white-space:pre-wrap">${h(p.fitNotes)}</div>` : ''}<div class="row" style="margin-top:8px;gap:6px"><button class="sm" onclick="viewProfile('${p.id}')">View</button><button class="sm" onclick="editProfile('${p.id}')">✎ Update</button><button class="sm" onclick="profilePDF('${p.id}')">⬇ Sheet</button></div></div>`;
}

/* ---------------- measurement sets (profiles) ---------------- */
function profileForm(t, P){
  return `${measGrid(t, P.values, 'values', 'X', P.unit || 'in', 'setProfUnit')}
  ${(t.specs || []).length ? `<div class="msec-t">Specifications</div><div class="mgrid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">${t.specs.map(sp => `<div><label>${h(sp.label)}</label><input list="pdl_${sp.k}" data-root="X" data-p="specs.${sp.k}" value="${v(P.specs?.[sp.k])}"><datalist id="pdl_${sp.k}">${sp.options.map(o => `<option value="${h(o)}">`).join('')}</datalist></div>`).join('')}</div>` : ''}
  <label style="margin-top:10px">Fitting preferences & customer-specific changes</label><textarea rows="3" data-root="X" data-p="fitNotes">${h(P.fitNotes)}</textarea>`;
}
function setProfUnit(u){ const P = UI.x; if(!P || P.unit === u) return; P.values = convertVals(P.values, P.unit || 'in', u); P.unit = u; const sc = document.getElementById('mbox')?.scrollTop; openProfileEditor(); const mb = document.getElementById('mbox'); if(mb) mb.scrollTop = sc || 0; toast(`Converted to ${UNITS[u]}`, 'ok'); }
function newProfile(cid, mid){
  const c = cust(cid), M = members(c);
  prompt2('New measurement set', [{k: 'memberId', label: 'Family member', type: 'select', options: M.map(m => [m.id, memLabel(cid, m.id)]), value: mid || primaryMember(c).id}, {k: 'tplId', label: 'Article', type: 'select', options: coll('templates').map(t => [t.id, `${t.category ? t.category + ' → ' : ''}${t.name}`])}, {k: 'label', label: 'Name for this set (optional)', placeholder: 'e.g. Padded, deep back', full: true}, {k: 'unit', label: 'Unit', type: 'select', options: [['in', 'inches'], ['cm', 'cm']], value: defUnit()}], x => {
    const t = tpl(x.tplId), vals = {}; t.fields.forEach(f => vals[f.k] = ''); const m = member(cid, x.memberId);
    UI.x = {id: uid('p'), customerId: cid, memberId: x.memberId, person: m.relation, label: x.label || t.name.split(' (')[0], tplId: x.tplId, unit: x.unit, values: vals, specs: {}, fitNotes: '', versions: [], history: [], _new: true};
    openProfileEditor();
  }, 'Next');
}
function editProfile(pid){ UI.x = clone(prof(pid)); UI.x.unit = UI.x.unit || 'in'; openProfileEditor(); }
function openProfileEditor(){
  const P = UI.x, t = tpl(P.tplId);
  openModal(`<div class="mbar"><b>${P._new ? 'New measurements' : 'Update measurements'} · ${h(memLabel(P.customerId, P.memberId, true) || P.person || '')}</b><span class="muted">${h(t.name)} · ${h(P.label)}</span><span class="sp"></span><button onclick="closeModal()">Cancel</button><button class="pri" onclick="saveProfile()">Save${P._new ? '' : ' as new version'}</button></div>${profileForm(t, P)}${P._new ? '' : '<label style="margin-top:8px">Reason for change</label><input id="profWhy" placeholder="e.g. Re-measured before wedding season">'}`, true);
}
function saveProfile(){
  const P = UI.x, why = document.getElementById('profWhy')?.value || '';
  if(P._new){ delete P._new; P.updated = nowISO(); P.versions = [{at: nowISO(), by: meName(), unit: P.unit, values: clone(P.values), specs: clone(P.specs), fitNotes: P.fitNotes, note: 'First measurement'}]; P.history = [{at: nowISO(), by: meName(), action: 'Measurement set created', changes: []}]; coll('profiles').push(P); }
  else { const cur = prof(P.id), before = clone(cur); cur.values = P.values; cur.unit = P.unit; cur.specs = P.specs; cur.fitNotes = P.fitNotes; cur.updated = nowISO(); cur.versions.push({at: nowISO(), by: meName(), unit: P.unit, values: clone(P.values), specs: clone(P.specs), fitNotes: P.fitNotes, note: why || 'Updated'}); logChange(cur, 'Measurements updated' + (why ? ': ' + why : ''), before, clone(cur)); }
  UI.x = null; closeModal(); save(); render(); toast('Measurements saved — earlier versions kept', 'ok');
}
function viewProfile(pid){
  const P = prof(pid), t = tpl(P.tplId);
  openModal(`<div class="mbar"><b>${h(memLabel(P.customerId, P.memberId, true) || P.person || '')} · ${h(t.name)}</b><span class="muted">${h(P.label)} · ${UNITS[P.unit || 'in']}</span><span class="sp"></span><button onclick="closeModal();editProfile('${pid}')">✎ Update</button><button onclick="profilePDF('${pid}')">⬇ Sheet PDF</button><button onclick="closeModal()">Close</button></div>
  ${measView(t, P.values, P.unit)}
  ${(t.specs || []).length ? `<h3 style="margin-top:12px">Specifications</h3><div>${t.specs.map(sp => `<span class="chip c-mut">${h(sp.label)}: ${h(P.specs?.[sp.k] || '—')}</span>`).join(' ')}</div>` : ''}${P.fitNotes ? `<h3 style="margin-top:12px">Fit notes</h3><div style="white-space:pre-wrap">${h(P.fitNotes)}</div>` : ''}
  ${P.versions.length > 1 ? `<h3 style="margin-top:12px">Version history</h3>${measVersionsTable(P, t)}` : ''}<h3 style="margin-top:12px">Change log</h3>${histHTML(P.history)}`, true);
}
