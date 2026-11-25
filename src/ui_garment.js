/* =====================================================================
   ui_garment.js : the individual garment file and its workflows
   ===================================================================== */
const GTABS = [['overview', 'Overview'], ['meas', 'Measurements'], ['design', 'Design file'], ['plan', 'Production plan'], ['materials', 'Materials'], ['trials', 'Trials & alterations'], ['qc', 'QC & delivery'], ['bill', 'Billing'], ['history', 'History']];
function gLog(g, action, before){ if(before !== undefined) logChange(g, action, before, clone(g)); else (g.history = g.history || []).push({at: nowISO(), by: meName(), action, changes: []}); }
function gEditable(){ return can('production') || can('orders.edit'); }

VIEWS.garment = {perm: 'orders', title: 'Garment file', parent: 'orders', fn: (id) => {
  const g = gar(id); if(!g) return '<div class="card">Garment not found.</div>';
  const o = ord(g.orderId) || {}, c = cust(g.customerId) || {}, t = tpl(g.tplId) || {}, st = gStatus(g);
  if(UI.gid !== id){ UI.gid = id; UI.gtab = 'overview'; UI.gd = null; } if(UI.gtabNext){ UI.gtab = UI.gtabNext; UI.gd = null; UI.gtabNext = null; }
  const tabs = GTABS.filter(([k]) => k !== 'bill' || can('prices'));
  const av = (g.design?.versions || []).find(x => x.v === g.design.approvedV), modified = g.design?.approvedV && g.design.versions.length > g.design.approvedV;
  const x = sched().G[g.id];
  return `<div class="muted"><a href="#order-${o.id}">← ${h(o.no || 'Order')}</a> · <a href="#customer-${c.id}">${h(c.name || '')}</a></div>
  <div class="row ac"><div style="flex:1;min-width:240px"><h1>${h(g.no)} · ${h(g.title)} ${urgentChip(g)}</h1><div class="sub" style="margin-bottom:6px">${memChip(g.customerId, g.memberId)} ${h(t.name || '')} · qty ${g.qty} · ${g.fabricSource === 'customer' ? '<b>customer-supplied fabric</b>' : g.fabricSource === 'mixed' ? '<b>mixed fabric (part customer)</b>' : 'studio fabric'} · ${gChip(g)}</div></div>
    <div class="row" style="gap:6px">${pdfMenu(g)}${can('comms') ? `<button onclick="openCompose('${o.id}','update',null,null,'${g.id}')">💬</button>` : ''}</div></div>
  <div class="trail" style="margin-bottom:10px">${trail(g)}</div>
  ${(o.instructions || g.instructions) ? `<div class="flag"><b>Special instructions:</b> ${h([o.instructions, g.instructions].filter(Boolean).join(' · '))}</div>` : ''}
  ${modified ? `<div class="flag gold"><b>Design modified after approval</b> — version ${g.design.versions.length} is newer than approved version ${g.design.approvedV}. Get it approved before production continues.</div>` : ''}
  ${g.status === 'hold' ? '<div class="flag gold"><b>On hold</b> — not scheduled until resumed.</div>' : ''}
  <div class="tabs">${tabs.map(([k, l]) => `<button class="${UI.gtab === k ? 'on' : ''}" onclick="UI.gtab='${k}';UI.gd=null;render()">${l}${k === 'trials' && (g.trials || []).length ? ` (${g.trials.length})` : ''}</button>`).join('')}</div>
  ${({overview: gOverview, meas: gMeas, design: gDesign, plan: gPlan, materials: gMaterials, trials: gTrials, qc: gQC, bill: gBill, history: gHistory}[UI.gtab] || gOverview)(g, o, c, t, x, av)}`;
}};
function pdfMenu(g){ return `<select style="width:auto" onchange="const v=this.value;this.value='';if(v)window[v]('${g.id}')"><option value="">⬇ Print / PDF…</option><option value="measSheetPDF">Measurement sheet (cutting & stitching)</option><option value="jobCardPDF">Job card (all stages)</option><option value="artisanPDF">Artisan sheet (approved design)</option></select>`; }

/* ---------------- overview ---------------- */
function gOverview(g, o, c, t, x, av){
  const today = todayISO(), groups = GROUPS.filter(([k]) => k === 'delivery' || liveSteps(g).some(s => stg(s).group === k)), p = progress(g), ed = gEditable() && gLive(g);
  const next = currentSteps(g);
  return `<div class="grid2">
  <div class="card"><div class="row ac"><h3 style="margin:0">Key dates — target vs expected</h3><span class="sp"></span>${ed ? `<button class="sm" onclick="editTargets('${g.id}')">✎ Adjust targets</button>` : ''}</div>
    <table class="stack" style="margin-top:8px"><thead><tr><th>Milestone</th><th>Target</th><th>Expected</th><th>Status</th></tr></thead><tbody>
    ${groups.map(([k, l]) => { const tg = groupTarget(g, k), steps = liveSteps(g).filter(s => stg(s).group === k), done = k === 'delivery' ? !!g.delivery?.delivered : steps.length && steps.every(s => s.status === 'done'), exp = k === 'delivery' ? (g.delivery?.delivered ? iso(g.delivery.delivered.at) : x?.ready) : done ? iso(new Date(steps.map(s => s.doneAt).filter(Boolean).sort().pop() || nowISO())) : x?.exp?.[k];
      const late = !done && ((tg && tg < today) || (exp && tg && exp > tg));
      return `<tr><td><b>${l}</b>${g.targets?.[k] ? ' <span class="chip c-info">set by hand</span>' : ''}</td><td>${fmtD(tg)}</td><td>${exp ? fmtD(exp) : '—'}</td><td>${done ? '<span class="chip c-ok">Done</span>' : late ? '<span class="chip c-bad">Delayed</span>' : '<span class="chip c-mut">On track</span>'}</td></tr>`; }).join('')}
    </tbody></table>
    <div class="hint">Stitching is targeted ${num(ST().lead?.stitching)} days before delivery by default; other milestones use the lead days in Setup. Expected dates come from the worker schedule and update automatically.</div></div>
  <div class="card"><h3>Progress</h3><div class="row ac"><div class="bar" style="flex:1;height:12px"><i class="${p.pct === 100 ? 'ok' : ''}" style="width:${p.pct}%"></i></div><b style="font-size:20px">${p.pct}%</b></div>
    <details style="margin-top:8px"><summary>How this is calculated</summary><div class="hint">Progress = completed effort ÷ total planned effort. Effort per step: in-house work = estimated hours × qty; outside work = 4 h per turnaround day; trial = 1 h; QC = 0.5 h. Done counts 100%; in progress counts elapsed working hours ÷ estimate (max 90%); skipped steps are left out.</div>
      ${p.rows.length ? `<table style="margin-top:6px;font-size:12.5px"><thead><tr><th>Step</th><th class="n">Effort</th><th class="n">Done</th><th class="n">Counts</th></tr></thead><tbody>${p.rows.map(r => `<tr><td>${h(stg(r.s).name)} – ${h(r.s.label)}</td><td class="n">${r.w.toFixed(1)} h</td><td class="n">${Math.round(r.f * 100)}%</td><td class="n">${(r.w * r.f).toFixed(1)} h</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="n">${p.tot.toFixed(1)} h</td><td></td><td class="n"><b>${(p.got || 0).toFixed(1)} h → ${p.pct}%</b></td></tr></tbody></table>` : ''}</details>
    <div class="row" style="margin-top:12px">${gLive(g) && ed ? `${next.filter(s => s.status === 'pending' && ['work', 'external'].includes(kindOf(s))).slice(0, 2).map(s => `<button class="pri" onclick="startStep('${g.id}','${s.id}')">▶ ${isOut(s) ? 'Send out' : 'Start'}: ${h(stg(s).name)}</button>`).join('')}
      ${next.some(s => kindOf(s) === 'trial') && can('trials') ? `<button onclick="UI.gtab='trials';render()">📅 Trial</button>` : ''}${next.some(s => kindOf(s) === 'qc') && can('qc') ? `<button class="pri" onclick="doQC('${g.id}')">✔ Do QC</button>` : ''}
      <button onclick="sendBack('${g.id}')">↩ Send back for correction</button><button onclick="addHandwork('${g.id}')">+ Additional handwork</button>` : ''}
      ${gStatus(g) === 'ready' && can('qc') ? `<button class="pri" onclick="UI.gtab='qc';render()">📦 Delivery steps</button>` : ''}</div></div></div>
  <div class="card"><div class="row ac"><h3 style="margin:0">Production steps — each with its own worker, target date and status</h3><span class="sp"></span>${ed ? `<button class="sm" onclick="UI.gtab='plan';render()">✎ Edit plan</button>` : ''}</div>
    <table class="stack" style="margin-top:8px"><thead><tr><th>#</th><th>Stage</th><th>Piece / section</th><th>Worker / vendor</th><th>Target</th><th>Planned</th><th>Actual</th><th>Status</th><th></th></tr></thead><tbody>
    ${orderedSteps(g).map(s => stepRow(g, s, ed)).join('')}</tbody></table></div>
  <div class="grid2"><div class="card"><h3>Customer liking & fit</h3><div class="flag gold" style="margin:0 0 8px"><b>Style:</b> ${h(g.style || '—')}</div>${g.fit ? `<div><span class="muted">Fit:</span> ${h(g.fit)}</div>` : ''}${c.fitPrefs ? `<div class="hint">Customer-wide preference: ${h(c.fitPrefs)}</div>` : ''}</div>
  <div class="card"><div class="row ac"><h3 style="margin:0">Approved design</h3><span class="sp"></span><a href="#" onclick="UI.gtab='design';render();return false">Design file →</a></div>${av ? `<div class="thumbs" style="margin-top:8px">${av.files.slice(0, 4).map(f => `<div class="thumb" data-media="${h(f.id)}" onclick="lightboxIds(${h(JSON.stringify(av.files.map(z => z.id)))},${av.files.indexOf(f)})"><span class="cap">${h(f.kind)}</span></div>`).join('')}</div><div class="hint">Version ${av.v} approved ${fmtDT(av.approvedAt)} ${av.approvedBy ? 'by ' + h(av.approvedBy) : ''}</div>` : `<div class="flag gold" style="margin-top:8px">No design version is marked customer-approved yet.</div>`}</div></div>
  <div class="card"><h3>Timeline · planned vs actual</h3>${gantt(g)}</div>`;
}
function stepRow(g, s, ed){
  const k = kindOf(s), p = stepPlanned(s), tgt = stepTarget(s, g), today = todayISO(), x = p?.x || {};
  let planned = '—';
  if(s.status === 'skipped') planned = '';
  else if(s.status !== 'done'){
    if(x.none) planned = '<span class="chip c-bad">No skilled worker free</span>';
    else if(k === 'external' && s.status === 'in_progress') planned = `back by ${dateChip(x.due)}`;
    else if(k === 'trial') planned = x.trial ? `trial ${fmtDs(x.trial)}` : `book ~${fmtDs(p?.start)}`;
    else if(p) planned = `${fmtDs(p.start)} → ${fmtDs(p.end)}`;
  }
  const actual = s.startedAt ? `${fmtDT(s.startedAt)}${s.doneAt ? '<br>→ ' + fmtDT(s.doneAt) : ''}` : '—';
  let act = '';
  if(ed && gLive(g)){
    if(s.status === 'pending'){
      if(k === 'trial') act = `<button class="sm" onclick="bookTrial('${g.id}','${s.id}')">Book</button>`;
      else if(k === 'qc') act = `<button class="sm" onclick="doQC('${g.id}','${s.id}')">Do QC</button>`;
      else act = `<button class="sm" onclick="startStep('${g.id}','${s.id}')">${k === 'external' ? 'Send out' : '▶ Start'}</button>`;
      act += ` <button class="sm ghost" title="Mark done" onclick="doneStep('${g.id}','${s.id}')">✓</button>`;
    } else if(s.status === 'in_progress'){
      act = k === 'trial' ? `<button class="sm pri" onclick="recordTrialFor('${g.id}','${s.id}')">Record</button>` : `<button class="sm pri" onclick="doneStep('${g.id}','${s.id}')">${k === 'external' ? 'Received' : '✓ Done'}</button>`;
      act += ` <button class="sm ghost" title="Undo" onclick="undoStep('${g.id}','${s.id}')">↶</button>`;
    } else if(s.status === 'done') act = `<button class="sm ghost" title="Repeat this step" onclick="repeatStep('${g.id}','${s.id}')">↻</button> <button class="sm ghost" title="Undo" onclick="undoStep('${g.id}','${s.id}')">↶</button>`;
    else act = `<button class="sm ghost" onclick="skipStep('${g.id}','${s.id}',false)">Un-skip</button>`;
  }
  return `<tr class="${s.status !== 'done' && s.status !== 'skipped' && tgt < today ? 'late' : ''}" style="${s.status === 'skipped' ? 'opacity:.5' : ''}"><td class="muted">${h(s.seq)}</td><td>${h(stg(s).name)}${s.round > 1 ? ` <span class="chip c-warn">round ${s.round}</span>` : ''}</td><td>${h(s.label)}${s.rework ? `<div class="muted" style="font-size:12px">↩ ${h(s.rework)}</div>` : ''}</td><td>${stepWho(s)}</td><td>${s.status === 'done' || s.status === 'skipped' ? fmtDs(tgt) : dateChip(tgt)}</td><td style="font-size:12.5px">${planned}</td><td style="font-size:12px">${actual}</td><td>${stepStatusChip(s)}</td><td class="nowrap">${act}</td></tr>`;
}
function gantt(g){
  const sc = sched(), rows = []; let lo = 0, hi = 1;
  orderedSteps(g).forEach(s => {
    if(s.status === 'skipped') return; const x = sc.T[s.id] || {}; let a, b, cls;
    if(s.status === 'done'){ a = s.startedAt ? dayIdx(iso(new Date(s.startedAt))) : (x.e || 0) - 0.5; b = Math.max(a + 0.4, (s.doneAt ? dayIdx(iso(new Date(s.doneAt))) : a) + 1); cls = 'done'; }
    else if(!gLive(g) || x.none || x.s == null) return;
    else { a = x.segS ?? x.s; b = Math.max(x.e, a + 0.2); cls = kindOf(s) === 'trial' ? 'trial' : isOut(s) ? 'ext' : s.status === 'in_progress' ? 'prog' : ''; if(x.overdue) cls += ' late'; }
    rows.push({lab: `${stg(s).name} · ${s.label}`, sub: isOut(s) ? vendor(s.vendorId)?.name || '' : worker(s.workerId || x.wid)?.name || '', a, b, cls});
    lo = Math.min(lo, Math.floor(a)); hi = Math.max(hi, Math.ceil(b));
  });
  if(!rows.length) return '<div class="muted">Nothing to plot.</div>';
  const di = g.deliveryDate ? dayIdx(g.deliveryDate) + 1 : null; if(di != null) hi = Math.max(hi, di);
  lo = Math.max(lo, -45); hi = Math.min(hi, lo + 75);
  const span = hi - lo, pos = v2 => ((v2 - lo) / span * 100).toFixed(2) + '%', step = Math.max(1, Math.ceil(span / 14));
  let ticks = ''; for(let d = lo; d < hi; d += step) ticks += `<span class="g-tick" style="left:${pos(d + 0.5)}">${dayDate(d).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})}</span>`;
  const lines = `<div class="g-line" style="left:${pos(0)}" title="Today"></div>${di != null ? `<div class="g-line prom" style="left:${pos(di)}" title="Delivery"></div>` : ''}`;
  return `<div class="gantt"><div class="g-head"><div class="g-lab muted">Step</div><div class="g-track">${ticks}</div></div>${rows.map(r => `<div class="g-row"><div class="g-lab" title="${h(r.lab)}">${h(r.lab)}<div class="muted" style="font-size:10.5px">${h(r.sub)}</div></div><div class="g-track">${lines}<div class="g-bar ${r.cls}" style="left:${pos(Math.max(lo, r.a))};width:calc(${((Math.min(hi, r.b) - Math.max(lo, r.a)) / span * 100).toFixed(2)}% - 1px)"></div></div></div>`).join('')}</div>
  <div class="g-legend"><span><i style="background:#9ccfb0"></i>Done</span><span><i style="background:var(--accent)"></i>In progress</span><span><i style="background:#c9a3b4"></i>Planned</span><span><i style="background:#9fb6d1"></i>Outside vendor</span><span><i style="background:#7fb8ab"></i>Trial</span><span><i style="border-left:2px solid var(--info);width:2px"></i>Today</span><span><i style="border-left:2px dashed var(--bad);width:2px"></i>Delivery</span></div>`;
}
function editTargets(gid){
  const g = gar(gid), groups = GROUPS.filter(([k]) => k !== 'delivery' && liveSteps(g).some(s => stg(s).group === k));
  prompt2('Adjust target dates · ' + g.no, [{k: 'deliveryDate', label: 'Customer collection / delivery', type: 'date', value: g.deliveryDate}, ...groups.map(([k, l]) => ({k, label: `${l} (default ${fmtDs(groupTarget({...g, targets: {}}, k))})`, type: 'date', value: g.targets?.[k] || ''}))], x => {
    const before = clone(g); g.deliveryDate = x.deliveryDate || g.deliveryDate; g.targets = g.targets || {};
    groups.forEach(([k]) => { if(x[k]) g.targets[k] = x[k]; else delete g.targets[k]; });
    gLog(g, 'Target dates changed', before); save(); render(); toast('Targets updated — expected dates recalculated', 'ok');
  });
}

/* ---------------- step actions ---------------- */
function findStep(gid, sid){ const g = gar(gid); return {g, s: g && g.steps.find(x => x.id === sid)}; }
function startStep(gid, sid, force){
  const {g, s} = findStep(gid, sid); if(!s) return;
  const groups = stepGroups(g), gi = groups.findIndex(x => x.includes(s));
  if(!force && gi > 0 && !groups.slice(0, gi).every(x => x.every(y => y.status === 'done'))) return ask('Earlier steps for this garment are not finished. Start anyway?', () => startStep(gid, sid, true), 'Start anyway');
  if(!force && ['cut', 'emb'].includes(s.stageId) && !g.design?.approvedV && (g.design?.versions || []).length) return ask('No design version is customer-approved yet. Starting cutting or embroidery now risks a production mistake. Start anyway?', () => startStep(gid, sid, true), 'Start anyway');
  if(isOut(s)){
    const vs = coll('vendors').filter(x => x.active !== false);
    return prompt2(`Send to vendor · ${stg(s).name} – ${s.label}`, [{k: 'vendorId', label: 'Vendor', type: 'select', value: s.vendorId, options: [['', '— choose —'], ...vs.map(x => [x.id, x.name])], required: true}, {k: 'handover', label: 'Handover date', type: 'date', value: todayISO()}, {k: 'expectedReturn', label: 'Expected return', type: 'date', value: dayISO(addShopWorkdays(0, s.tat || 2))}, ...(can('prices') ? [{k: 'charge', label: 'Vendor charge ₹', type: 'number', value: s.charge}, {k: 'advance', label: 'Advance paid now ₹', type: 'number', value: ''}] : []), {k: 'note', label: 'Handover note', full: true}], x => {
      const before = clone(g); s.vendorId = x.vendorId; s.status = 'in_progress'; s.startedAt = new Date(x.handover + 'T' + new Date().toTimeString().slice(0, 8)).toISOString(); s.expectedReturn = x.expectedReturn; if(x.charge !== undefined && x.charge !== '') s.charge = num(x.charge); s.handoverNote = x.note;
      if(num(x.advance) > 0) coll('ledger').push({id: uid('lg'), party: 'vendor', partyId: s.vendorId, date: x.handover, type: 'advance', amount: num(x.advance), mode: 'Cash', note: `Advance for ${g.no} ${stg(s).name}`, by: meName(), garmentId: g.id});
      coll('custMaterials').filter(m => m.garmentId === g.id && m.status !== 'returned').forEach(m => { m.status = 'with_vendor'; m.log.push({at: nowISO(), status: 'with_vendor', note: 'With ' + vendor(s.vendorId)?.name, by: meName()}); });
      gLog(g, `${stg(s).name} – ${s.label} handed to ${vendor(s.vendorId)?.name}, due ${fmtD(s.expectedReturn)}`, before); save(); render(); toast('Handover recorded', 'ok');
    }, 'Record handover');
  }
  if(!s.workerId){ const sug = sched().T[s.id]?.wid; if(!sug) return toast('Assign a worker first (Production plan tab)', 'bad'); return ask(`Assign to ${worker(sug).name} and start?`, () => { s.workerId = sug; startStep(gid, sid, true); }); }
  const before = clone(g); s.status = 'in_progress'; s.startedAt = nowISO();
  coll('custMaterials').filter(m => m.garmentId === g.id && m.status === 'received').forEach(m => { m.status = 'in_production'; m.log.push({at: nowISO(), status: 'in_production', note: 'Issued for ' + stg(s).name, by: meName()}); });
  gLog(g, `${stg(s).name} – ${s.label} started by ${worker(s.workerId)?.name}`, before); save(); render(); checkNotify();
}
function doneStep(gid, sid){
  const {g, s} = findStep(gid, sid); if(!s) return; const k = kindOf(s);
  if(k === 'qc') return doQC(gid, sid);
  if(k === 'trial') return recordTrialFor(gid, sid);
  if(k === 'external'){
    return prompt2(`Received back · ${stg(s).name} – ${s.label}`, [{k: 'date', label: 'Actual return date', type: 'date', value: todayISO()}, ...(can('prices') ? [{k: 'charge', label: 'Final vendor charge ₹', type: 'number', value: s.charge}] : []), {k: 'note', label: 'Condition / note', full: true}], x => {
      const before = clone(g); s.status = 'done'; s.startedAt = s.startedAt || nowISO(); s.doneAt = new Date(x.date + 'T' + new Date().toTimeString().slice(0, 8)).toISOString(); if(x.charge !== undefined && x.charge !== '') s.charge = num(x.charge); s.returnNote = x.note;
      coll('custMaterials').filter(m => m.garmentId === g.id && m.status === 'with_vendor').forEach(m => { m.status = 'in_production'; m.log.push({at: nowISO(), status: 'in_production', note: 'Back from ' + (vendor(s.vendorId)?.name || 'vendor'), by: meName()}); });
      gLog(g, `${stg(s).name} – ${s.label} received from ${vendor(s.vendorId)?.name || 'vendor'}`, before); afterStepDone(g); save(); render();
    }, 'Mark received');
  }
  if(!s.workerId){ const sug = sched().T[s.id]?.wid; if(sug) s.workerId = sug; }
  const before = clone(g); s.startedAt = s.startedAt || nowISO(); s.status = 'done'; s.doneAt = nowISO();
  if(s.stageId === 'alter' && s.trialId){ const tr = g.trials.find(t => t.id === s.trialId); (tr?.alterations || []).forEach(a => { if(!a.stepId || a.stepId === s.id) a.status = 'done'; }); }
  gLog(g, `${stg(s).name} – ${s.label} completed by ${worker(s.workerId)?.name || '—'}`, before); afterStepDone(g); save(); render(); checkNotify();
}
function afterStepDone(g){ const st = gStatus(g); if(st === 'qc') toast('All steps done — QC is next', 'ok'); }
function undoStep(gid, sid){ const {g, s} = findStep(gid, sid); const before = clone(g); if(s.status === 'done'){ s.status = s.startedAt ? 'in_progress' : 'pending'; s.doneAt = null; } else { s.status = 'pending'; s.startedAt = null; } gLog(g, `${stg(s).name} – ${s.label} status reverted`, before); save(); render(); }
function skipStep(gid, sid, on){ const {g, s} = findStep(gid, sid); const before = clone(g); s.status = on ? 'skipped' : 'pending'; gLog(g, `${stg(s).name} – ${s.label} ${on ? 'skipped' : 'restored'}`, before); save(); render(); }
function repeatStep(gid, sid){
  const {g, s} = findStep(gid, sid);
  prompt2(`Repeat ${stg(s).name} – ${s.label}`, [{k: 'reason', label: 'Why is it repeated?', full: true, required: true}], x => {
    const before = clone(g), n = {...clone(s), id: uid('s'), status: 'pending', startedAt: null, doneAt: null, round: (s.round || 1) + 1, rework: x.reason, label: s.label, seq: r2(num(s.seq) + 0.1), target: ''};
    g.steps.push(n); ensureFinalQC(g); gLog(g, `${stg(s).name} – ${s.label} repeated (round ${n.round}): ${x.reason}`, before); save(); render();
  }, 'Add repeat');
}
function sendBack(gid){
  const g = gar(gid), cand = orderedSteps(g).filter(s => s.status === 'done' && ['work', 'external'].includes(kindOf(s)));
  if(!cand.length) return toast('No completed step to send back to yet', 'bad');
  prompt2('Send back for correction · ' + g.no, [{k: 'sid', label: 'Back to which stage?', type: 'select', options: cand.map(s => [s.id, `${stg(s).name} – ${s.label} (${isOut(s) ? vendor(s.vendorId)?.name || 'vendor' : worker(s.workerId)?.name || '—'})`]), full: true}, {k: 'reason', label: 'What needs correcting?', type: 'textarea', full: true, required: true}, {k: 'workerId', label: 'Assign to', type: 'select', options: [['', 'Same worker'], ...coll('workers').filter(w => w.active !== false).map(w => [w.id, w.name])]}, {k: 'hours', label: 'Estimated hours', type: 'number', value: 1}], x => {
    const s = g.steps.find(y => y.id === x.sid), cur = currentSteps(g), before = clone(g);
    const seq = cur.length ? r2(Math.min(...cur.map(c => num(c.seq))) - 0.05) : r2(Math.max(...g.steps.map(y => num(y.seq))) + 0.5);
    const n = {...clone(s), id: uid('s'), status: 'pending', startedAt: null, doneAt: null, round: (s.round || 1) + 1, rework: x.reason, label: 'Correction: ' + s.label, seq, hours: num(x.hours) || 1, pricing: 'unit', units: 1, rate: 0, charge: 0, target: '', workerId: x.workerId || s.workerId};
    g.steps.push(n); ensureFinalQC(g);
    gLog(g, `Sent back to ${stg(s).name} for correction: ${x.reason}`, before); save(); render(); toast('Correction step added — later steps wait for it', 'ok');
  }, 'Send back');
}
function ensureFinalQC(g){
  const maxSeq = Math.max(...liveSteps(g).filter(s => kindOf(s) !== 'qc').map(s => num(s.seq)));
  const pendingQC = liveSteps(g).find(s => kindOf(s) === 'qc' && s.status !== 'done' && num(s.seq) > maxSeq);
  if(pendingQC) return;
  const lastQ = liveSteps(g).filter(s => kindOf(s) === 'qc').pop();
  g.steps.push({id: uid('s'), stageId: 'qc', label: 'Final QC after corrections', seq: r2(maxSeq + 1), status: 'pending', workerId: lastQ?.workerId || '', vendorId: '', round: (lastQ?.round || 1) + 1, pricing: 'unit', units: 1, rate: 0, hours: 0.5, tat: 0, charge: 0, out: false, target: '', startedAt: null, doneAt: null});
}
function addHandwork(gid){
  const g = gar(gid), ws = coll('workers').filter(w => w.active !== false && (w.skills || []).some(k => ['emb', 'hand'].includes(k)));
  prompt2('Additional handwork · ' + g.no, [{k: 'stageId', label: 'Type', type: 'select', options: [['hand', 'Handwork (moti, tassels…)'], ['emb', 'Embroidery']]}, {k: 'label', label: 'What & where', required: true, full: true, placeholder: 'e.g. Extra cutdana on sleeves'}, {k: 'workerId', label: 'Artisan', type: 'select', options: [['', 'Auto (least loaded)'], ...ws.map(w => [w.id, w.name])]}, {k: 'hours', label: 'Estimated hours', type: 'number', value: 3, required: true}, ...(can('prices') ? [{k: 'rate', label: 'Artisan rate ₹/h', type: 'number', value: stage('emb').rate}, {k: 'charge', label: 'Charge to customer ₹', type: 'number', value: ''}] : []), {k: 'target', label: 'Revised completion date (optional)', type: 'date'}], x => {
    const before = clone(g), cur = currentSteps(g), embSeq = (g.steps.find(s => s.stageId === 'emb') || {}).seq;
    const seq = cur.length ? Math.max(num(embSeq || 0), Math.min(...cur.map(c => num(c.seq)))) : r2(Math.max(...g.steps.map(y => num(y.seq))) + 0.5);
    g.steps.push({id: uid('s'), stageId: x.stageId, label: 'Additional: ' + x.label, seq, status: 'pending', workerId: x.workerId, vendorId: '', round: 1, pricing: 'hour', units: 1, rate: num(x.rate) || stage(x.stageId).rate, cplx: 'Simple', hours: num(x.hours), tat: 0, charge: 0, out: false, target: x.target || '', startedAt: null, doneAt: null, head: 'embroidery'});
    if(num(x.charge) > 0) (g.extras = g.extras || []).push({id: uid('x'), head: 'work', desc: 'Additional handwork: ' + x.label, amount: num(x.charge), at: nowISO(), by: meName()});
    if(gStatus(g) === 'ready' || liveSteps(g).filter(s => kindOf(s) === 'qc').every(s => s.status === 'done')) ensureFinalQC(g);
    gLog(g, `Additional handwork added: ${x.label}${num(x.charge) ? ' (+' + inr(x.charge) + ')' : ''}`, before); save(); render();
    const sx = sched().G[g.id]; toast(`Handwork added — expected ready ${fmtD(sx?.ready)}`, 'ok');
  }, 'Add handwork');
}

/* ---------------- measurements ---------------- */
function gMeas(g, o, c, t){
  const P = prof(g.profileId), ed = gEditable() && gLive(g), D = UI.gd || g, editing = !!UI.gd;
  return `<div class="card"><div class="row ac"><div><h3 style="margin:0">Measurements for this garment · ${UNITS[(editing ? D.unit : g.unit) || 'in']}</h3><div class="hint">For ${memChip(g.customerId, g.memberId) || '—'} · set: ${P ? `<a href="#customer-${c.id}">${h(P.label)}</a> (${P.versions.length} version${P.versions.length > 1 ? 's' : ''})` : '—'}</div></div><span class="sp"></span>
    ${editing ? `<label class="inline"><input type="checkbox" id="updProf" checked> Also update the member's saved measurements</label><button onclick="UI.gd=null;render()">Cancel</button><button class="pri" onclick="saveMeas('${g.id}')">Save measurements</button>` : `<button onclick="measSheetPDF('${g.id}')">⬇ Measurement sheet PDF</button>${ed ? `<button onclick="UI.gd=clone(gar('${g.id}'));UI.gd.unit=UI.gd.unit||'in';render()">✎ Edit</button>` : ''}`}</div>
    ${editing ? measGrid(t, D.meas, 'meas', 'GD', D.unit || 'in', 'setGdUnit') : measView(t, g.meas, g.unit)}
    ${(t.specs || []).length ? `<div class="msec-t" style="margin-top:12px">Garment specifications</div><div class="mgrid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">${t.specs.map(sp => editing ? `<div><label>${h(sp.label)}</label><input list="gdl_${sp.k}" data-root="GD" data-p="specs.${sp.k}" value="${v(D.specs?.[sp.k])}"><datalist id="gdl_${sp.k}">${sp.options.map(x => `<option value="${h(x)}">`).join('')}</datalist></div>` : `<div><span class="muted" style="font-size:12px">${h(sp.label)}</span><div><b>${h(g.specs?.[sp.k] || '—')}</b></div></div>`).join('')}</div>` : ''}
    <div class="grid2" style="margin-top:12px"><div><label>Customer liking / style</label>${editing ? `<textarea rows="3" data-root="GD" data-p="style">${h(D.style)}</textarea>` : `<div>${h(g.style || '—')}</div>`}</div><div><label>Fitting preferences & customer-specific changes</label>${editing ? `<textarea rows="3" data-root="GD" data-p="fit">${h(D.fit)}</textarea>` : `<div>${h(g.fit || '—')}</div>`}</div></div>
    ${editing ? `<label style="margin-top:8px">Reason for change</label><input id="measWhy" placeholder="e.g. Customer lost weight; corrected after trial">` : ''}</div>
  ${P && P.versions.length > 1 ? `<div class="card"><h3>Earlier versions of this member's measurements</h3>${measVersionsTable(P, t)}</div>` : ''}`;
}
function setGdUnit(u){ const D = UI.gd; if(!D || D.unit === u) return; D.meas = convertVals(D.meas, D.unit || 'in', u); D.unit = u; render(); toast(`Converted to ${UNITS[u]}`, 'ok'); }
function measVersionsTable(P, t){
  const V = P.versions.slice(-5);
  return `<div class="scroll"><table style="font-size:12.5px"><thead><tr><th>Measurement</th>${V.map(x => `<th>${fmtDs(x.at)} · ${unitLabel(x.unit || P.unit || 'in')}<div style="font-weight:normal">${h(x.note || '')}</div></th>`).join('')}</tr></thead><tbody>${t.fields.filter(f => V.some(x => String(x.values[f.k] ?? '').trim())).map(f => `<tr><td>${h(f.sec)}${f.no ? ' ' + f.no : ''} · ${h(f.label)}</td>${V.map((x, i) => { const val = x.values[f.k] ?? '', prev = i ? V[i - 1].values[f.k] ?? '' : val; return `<td ${String(val) !== String(prev) ? 'style="background:var(--gold-soft);font-weight:600"' : ''}>${h(val || '—')}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function saveMeas(gid){
  const g = gar(gid), D = UI.gd, before = clone(g), why = document.getElementById('measWhy')?.value || '', upd = document.getElementById('updProf')?.checked;
  g.meas = clone(D.meas); g.unit = D.unit || 'in'; g.specs = clone(D.specs); g.style = D.style; g.fit = D.fit;
  gLog(g, 'Measurements / specs changed' + (why ? ': ' + why : ''), before);
  const P = prof(g.profileId); if(upd && P){ const pb = clone(P); P.values = clone(g.meas); P.unit = g.unit; P.specs = clone(g.specs); P.fitNotes = g.fit; P.updated = nowISO(); P.versions.push({at: nowISO(), by: meName(), unit: g.unit, values: clone(g.meas), specs: clone(g.specs), fitNotes: g.fit, note: (why || 'Edited') + ' · ' + g.no}); logChange(P, 'Updated from ' + g.no, pb, clone(P)); }
  UI.gd = null; save(); render(); toast('Measurements saved — previous values kept in history', 'ok');
}

/* ---------------- design file ---------------- */
const FILE_KINDS = [['fabric', 'Fabric photo'], ['sketch', 'Sketch'], ['embroidery', 'Embroidery reference'], ['khaka', 'Khaka / tracing'], ['placement', 'Placement reference'], ['reference', 'Other reference'], ['photo', 'Actual garment photo']];
const kindName = k => (FILE_KINDS.find(x => x[0] === k) || [k, k])[1];
function gDesign(g, o, c, t){
  const D = g.design || (g.design = {versions: [], approvedV: 0}), dz = design(D.catalogId), ed = gEditable(), L = D.versions.slice().reverse(), latest = D.versions[D.versions.length - 1];
  return `<div class="card"><div class="row ac"><div><h3 style="margin:0">Catalogue design</h3>${dz ? `<div class="row ac" style="margin-top:6px"><div class="dimg" style="width:80px;height:60px;aspect-ratio:auto;border-radius:8px" data-media="${h(dzCover(dz))}">✦</div><div><b>${h(dz.name)}</b> <span class="muted">${h(dz.code)} · ${h(dz.style || '')}</span><div><a href="#design-${dz.id}">Open in catalogue</a></div></div></div>` : '<div class="muted">Not linked to a catalogue design.</div>'}</div><span class="sp"></span>
    ${ed ? `<button onclick="linkDesign('${g.id}')">${dz ? 'Change' : 'Link'} catalogue design</button><button class="pri" onclick="newDesignVersion('${g.id}')">+ New design version</button>` : ''}<button onclick="artisanPDF('${g.id}')">⬇ Artisan sheet PDF</button></div></div>
  ${!L.length ? '<div class="card empty">No design file yet. Add a version with fabric photos, sketches and embroidery references.</div>' : ''}
  ${L.map(x => { const appr = x.v === D.approvedV, isLatest = x === latest, editing = UI.gd && UI.gd._ver === x.v;
    const F = editing ? UI.gd.fields : x.fields;
    return `<div class="ver ${appr ? 'appr' : isLatest ? '' : 'old'}"><div class="row ac"><b style="font-size:15px">Version ${x.v}</b>${appr ? '<span class="chip c-ok">✔ CUSTOMER-APPROVED — use this for production</span>' : isLatest && D.approvedV ? '<span class="chip c-warn">Newer than approved</span>' : !isLatest ? '<span class="chip c-mut">Superseded</span>' : '<span class="chip c-warn">Awaiting approval</span>'}<span class="muted" style="font-size:12px">${fmtDT(x.at)} · ${h(x.by)}${x.note ? ' · ' + h(x.note) : ''}</span><span class="sp"></span>
      ${ed && !appr ? `<button class="sm okb" onclick="approveVersion('${g.id}',${x.v})">Mark customer-approved</button>` : ''}${ed && isLatest && !appr ? (editing ? `<button class="sm" onclick="UI.gd=null;render()">Cancel</button><button class="sm pri" onclick="saveVersionFields('${g.id}',${x.v})">Save</button>` : `<button class="sm" onclick="UI.gd={_ver:${x.v},fields:clone(gar('${g.id}').design.versions.find(z=>z.v===${x.v}).fields)};render()">✎ Edit details</button>`) : ''}</div>
      ${appr && x.approvedAt ? `<div class="hint">Approved ${fmtDT(x.approvedAt)}${x.approvedBy ? ' by ' + h(x.approvedBy) : ''}${x.approvalNote ? ' — ' + h(x.approvalNote) : ''}</div>` : ''}
      <div class="fgrid" style="margin-top:10px">${[['pattern', 'Design / pattern'], ['placement', 'Embroidery placement'], ['lining', 'Lining colour'], ['trims', 'Trims & accessories'], ['colours', 'Colours / shade'], ['notes', 'Notes']].map(([k, l]) => editing ? `<div ${k === 'notes' ? 'class="full"' : ''}><label>${l}</label><input data-root="GD" data-p="fields.${k}" value="${v(F[k])}"></div>` : `<div ${k === 'notes' ? 'class="full"' : ''}><span class="muted" style="font-size:12px">${l}</span><div>${h(F[k] || '—')}</div></div>`).join('')}</div>
      <div class="row ac" style="margin-top:10px"><h3 style="margin:0">Files</h3><span class="sp"></span>${ed && isLatest && !appr ? `<select id="fk_${x.v}" style="width:auto">${FILE_KINDS.map(([k, l]) => opt(k, l)).join('')}</select><label class="btn sm" style="margin:0;color:var(--ink)">⬆ Upload<input type="file" accept="image/*" multiple style="display:none" onchange="uploadVersionFiles('${g.id}',${x.v},this)"></label>` : ''}</div>
      ${x.files.length ? `<div class="thumbs" style="margin-top:6px">${x.files.map((f, k) => `<div class="thumb" data-media="${h(f.id)}" onclick="lightboxIds(${h(JSON.stringify(x.files.map(z => z.id)))},${k},${h(JSON.stringify(x.files.map(z => kindName(z.kind) + (z.caption ? ': ' + z.caption : ''))))})"><span class="cap">${h(kindName(f.kind))}</span>${ed && isLatest && !appr ? `<button class="tbtn" onclick="event.stopPropagation();rmVersionFile('${g.id}',${x.v},${k})">✕</button>` : ''}</div>`).join('')}</div>` : '<div class="muted" style="margin-top:4px">No files in this version.</div>'}
    </div>`; }).join('')}
  <div class="hint">Approved versions are locked. Any change — even a small one — creates a new version, so earlier designs always stay available. Production warns if cutting or embroidery starts without an approved version.</div>`;
}
function newDesignVersion(gid){
  const g = gar(gid), D = g.design, last = D.versions[D.versions.length - 1];
  prompt2('New design version', [{k: 'note', label: 'What changed?', full: true, required: !!last, placeholder: last ? 'e.g. Customer wants lighter embroidery near the waist' : 'First design'}, {k: 'copy', label: 'Start from', type: 'check', value: !!last, hint: 'Copy files and details from the latest version'}], x => {
    const before = clone(g);
    D.versions.push({v: D.versions.length + 1, at: nowISO(), by: meName(), note: x.note || 'First design', files: x.copy && last ? clone(last.files) : [], fields: x.copy && last ? clone(last.fields) : {pattern: '', placement: '', lining: '', trims: '', colours: '', notes: ''}, approved: false, approvedAt: '', approvedBy: ''});
    gLog(g, `Design version ${D.versions.length} created${x.note ? ': ' + x.note : ''}` + (D.approvedV ? ' (design modification after approval)' : ''), before); save(); render();
  }, 'Create version');
}
function approveVersion(gid, vno){
  const g = gar(gid);
  prompt2(`Mark version ${vno} as customer-approved`, [{k: 'by', label: 'Approved by', value: (cust(g.customerId)?.name || '') + ' (customer)', full: true}, {k: 'note', label: 'How was it approved?', placeholder: 'In person / WhatsApp photo / signed sketch', full: true}], x => {
    const before = clone(g); g.design.versions.forEach(z => z.approved = z.v === vno); const z = g.design.versions.find(y => y.v === vno); z.approvedAt = nowISO(); z.approvedBy = x.by; z.approvalNote = x.note; g.design.approvedV = vno;
    gLog(g, `Design version ${vno} approved by ${x.by}`, before); save(); render(); toast('Approved design marked', 'ok');
  }, 'Mark approved');
}
function saveVersionFields(gid, vno){ const g = gar(gid), before = clone(g), z = g.design.versions.find(y => y.v === vno); z.fields = clone(UI.gd.fields); UI.gd = null; gLog(g, `Design version ${vno} details edited`, before); save(); render(); }
async function uploadVersionFiles(gid, vno, inp){
  const kind = document.getElementById('fk_' + vno)?.value || 'reference', ids = await uploadImages(inp.files, 1600); inp.value = ''; if(!ids.length) return;
  const g = gar(gid), before = clone(g), z = g.design.versions.find(y => y.v === vno); ids.forEach(id => z.files.push({id, kind, caption: ''}));
  gLog(g, `${ids.length} ${kindName(kind).toLowerCase()} file(s) added to design version ${vno}`, before); save(); render();
}
function rmVersionFile(gid, vno, k){ ask('Remove this file from the version?', () => { const g = gar(gid), before = clone(g), z = g.design.versions.find(y => y.v === vno); z.files.splice(k, 1); gLog(g, `File removed from design version ${vno}`, before); save(); render(); }); }
function linkDesign(gid){ const g = gar(gid), list = coll('designs').filter(x => x.active !== false); openModal(`<div class="mbar"><b>Link a catalogue design</b><span class="sp"></span><button onclick="closeModal()">Close</button></div>${designGrid(list.filter(x => x.tplId === g.tplId), `doLinkDesign('${gid}','ID')`)}<details style="margin-top:10px"><summary>Other garment types</summary>${designGrid(list.filter(x => x.tplId !== g.tplId), `doLinkDesign('${gid}','ID')`)}</details>`, true); }
function doLinkDesign(gid, did){
  closeModal(); const g = gar(gid), dz = design(did), before = clone(g); g.design.catalogId = did;
  const latest = g.design.versions[g.design.versions.length - 1];
  if(!latest || latest.v === g.design.approvedV) g.design.versions.push({v: g.design.versions.length + 1, at: nowISO(), by: meName(), note: 'Linked catalogue design ' + dz.name, files: dzFiles(dz), fields: {pattern: dz.name, placement: '', lining: '', trims: '', colours: '', notes: dz.description || ''}, approved: false, approvedAt: '', approvedBy: ''});
  else dzFiles(dz).forEach(f => latest.files.push(f));
  gLog(g, 'Catalogue design linked: ' + dz.name, before); save(); render();
}
function lightboxIds(ids, j, caps){
  j = ((j % ids.length) + ids.length) % ids.length;
  openModal(`<div class="mbar"><b>${caps ? h(caps[j]) : 'Image'}</b><span class="muted">${j + 1} of ${ids.length}</span><span class="sp"></span>${ids.length > 1 ? `<button onclick='lightboxIds(${h(JSON.stringify(ids))},${j - 1},${caps ? h(JSON.stringify(caps)) : 'null'})'>‹ Prev</button><button onclick='lightboxIds(${h(JSON.stringify(ids))},${j + 1},${caps ? h(JSON.stringify(caps)) : 'null'})'>Next ›</button>` : ''}<button onclick="closeModal()">Close</button></div><div style="text-align:center;background:#f4eef0;border-radius:10px;padding:10px"><img data-media="${h(ids[j])}" alt="" style="max-width:100%;max-height:72vh;border-radius:6px"></div>`, true);
}

/* ---------------- production plan editor ---------------- */
function gPlan(g){
  const ed = gEditable() && gLive(g), D = UI.gd && UI.gd._plan ? UI.gd : null;
  if(!ed) return `<div class="card"><table class="stack"><thead><tr><th>#</th><th>Stage</th><th>Piece</th><th>Who</th><th>Target</th><th>Planned</th><th>Actual</th><th>Status</th><th></th></tr></thead><tbody>${orderedSteps(g).map(s => stepRow(g, s, false)).join('')}</tbody></table></div>`;
  if(!D) return `<div class="card"><div class="row ac"><div><h3 style="margin:0">Production plan — ${h(tpl(g.tplId)?.name || '')} workflow</h3><div class="hint">Stages are optional, repeatable and adjustable for this garment. Different workers can take each stage; embroidery can be split into sections for several artisans.</div></div><span class="sp"></span><button class="pri" onclick="UI.gd=Object.assign(clone(gar('${g.id}')),{_plan:1});render()">✎ Edit plan</button><button onclick="reassignDialog('${g.id}')">⇄ Reassign</button></div>
    <table class="stack" style="margin-top:10px"><thead><tr><th>#</th><th>Stage</th><th>Piece / section</th><th>Worker / vendor</th><th>Target</th><th>Planned</th><th>Actual</th><th>Status</th><th></th></tr></thead><tbody>${orderedSteps(g).map(s => stepRow(g, s, true)).join('')}</tbody></table></div>`;
  return `<div class="card"><div class="row ac"><h3 style="margin:0">Editing production plan</h3><span class="sp"></span><button onclick="UI.gd=null;render()">Cancel</button><button class="pri" onclick="savePlan('${g.id}')">Save plan</button></div>
    <div class="hint" style="margin-bottom:10px">Started and finished steps can't change stage. Set a target date on a step to override the milestone target.</div>
    ${stepsTable(D.steps, 'steps', 'GD', {target: true, status: true, lock: true, g: D, auto: `autoAssignGD()`})}</div>`;
}
function autoAssignGD(){ const D = UI.gd; let n = 0; const sc = sched(); D.steps.forEach(s => { if(isOut(s) || s.workerId || s.status !== 'pending' || stage(s.stageId).kind === 'trial') return; const w = sc.T[s.id]?.wid || coll('workers').filter(z => z.active !== false && (z.skills || []).includes(s.stageId)).sort(by(z => sc.end[z.id] || 0))[0]?.id; if(w){ s.workerId = w; n++; } }); softRender(); toast(n ? `Assigned ${n} step(s)` : 'Nothing to assign', 'ok'); }
function savePlan(gid){ const g = gar(gid), before = clone(g); g.steps = clone(UI.gd.steps); UI.gd = null; gLog(g, 'Production plan changed', before); save(); render(); toast('Plan saved — dates recalculated', 'ok'); }
function reassignDialog(gid){
  const g = gar(gid), L = g.steps.filter(s => s.status === 'pending' && kindOf(s) === 'work');
  if(!L.length) return toast('No pending in-house steps to reassign', 'ok');
  openModal(`<div class="mbar"><b>Reassign pending steps · ${h(g.no)}</b><span class="sp"></span><button onclick="closeModal()">Close</button></div><table><tbody>${L.map(s => `<tr><td>${h(stg(s).name)} – ${h(s.label)}<div class="muted" style="font-size:12px">now: ${stepWho(s)}</div></td><td style="width:220px"><select class="ra" data-s="${s.id}">${opt('', '— auto —', s.workerId)}${coll('workers').filter(w => w.active !== false).map(w => opt(w.id, w.name + ((w.skills || []).includes(s.stageId) ? '' : ' (other skill)') + (workerOffReason(w, 0) ? ' — ' + workerOffReason(w, 0) : ''), s.workerId)).join('')}</select></td></tr>`).join('')}</tbody></table><div class="row" style="margin-top:12px"><span class="sp"></span><button class="pri" onclick="doReassign('${gid}')">Save</button></div>`);
}
function doReassign(gid){ const g = gar(gid), before = clone(g); document.querySelectorAll('.ra').forEach(sel => { const s = g.steps.find(x => x.id === sel.dataset.s); s.workerId = sel.value; }); gLog(g, 'Steps reassigned', before); closeModal(); save(); render(); toast('Reassigned', 'ok'); }

/* ---------------- materials ---------------- */
function gMaterials(g){
  const ed = gEditable() && gLive(g), D = UI.gd && UI.gd._mat ? UI.gd : null, cms = coll('custMaterials').filter(m => m.garmentId === g.id || (m.orderId === g.orderId && !m.garmentId)), prices = can('prices');
  return `<div class="card"><div class="row ac"><div><h3 style="margin:0">Pieces & materials</h3><div class="hint">Customer-supplied materials cost nothing to the studio. Issued quantities come out of stock and are charged to this garment's actual cost.</div></div><span class="sp"></span>${ed && !D ? `<button onclick="UI.gd=Object.assign(clone(gar('${g.id}')),{_mat:1});render()">✎ Edit list</button>` : D ? `<button onclick="UI.gd=null;render()">Cancel</button><button class="pri" onclick="saveMaterials('${g.id}')">Save</button>` : ''}</div>
  ${D ? compTable(D.components, 'components', 'GD', D) : `<table class="stack" style="margin-top:10px"><thead><tr><th>Material</th><th>Supplied by</th><th class="n">Planned</th><th class="n">Issued</th><th class="n">Extra needed</th><th class="n">In stock</th>${prices ? '<th class="n">Cost</th>' : ''}<th></th></tr></thead><tbody>
  ${g.components.map((c, j) => { const st = c.itemId ? stockOf(c.itemId) : null, plan = r2(num(c.qty) * gq(g)), short = c.itemId && c.source !== 'customer' && st < Math.max(0, plan + num(c.extra) - num(c.issued));
    return `<tr class="${short ? 'late' : ''}"><td><b>${h(c.name)}</b><div class="muted" style="font-size:12px">${h((ST().categories.find(x => x.id === c.category) || {}).name || c.category)}${c.itemId ? ' · stock: ' + h(item(c.itemId)?.name || '') : ''}</div></td><td>${c.source === 'customer' ? '<span class="chip c-info">Customer</span>' : 'Studio'}</td><td class="n">${plan} ${h(c.unit)}</td><td class="n">${num(c.issued)} ${h(c.unit)}</td><td class="n">${num(c.extra) || '—'}</td><td class="n">${st === null ? '—' : `${st}${short ? ' <span class="chip c-bad">short</span>' : ''}`}</td>${prices ? `<td class="n">${inr(compAmount(c, g))}</td>` : ''}
    <td class="nowrap">${ed && c.source !== 'customer' ? `<button class="sm" onclick="issueDialog('${g.id}',${j})">Issue</button> <button class="sm ghost" onclick="extraDialog('${g.id}',${j})">+ Extra</button>` : ''}</td></tr>`; }).join('')}</tbody></table>`}</div>
  <div class="card"><div class="row ac"><h3 style="margin:0">Customer-supplied materials — tracked from receipt to delivery</h3><span class="sp"></span>${ed ? `<button class="sm" onclick="receiveCustMaterial('${g.id}')">+ Record receipt</button>` : ''}</div>
    ${cms.length ? cms.map(m => custMatRow(m)).join('') : '<div class="empty">None recorded for this garment.</div>'}</div>`;
}
const CM_STATUS = {received: ['Received', 'c-info'], in_production: ['In production', 'c-acc'], with_vendor: ['With vendor', 'c-warn'], used: ['Used', 'c-mut'], returned: ['Returned to customer', 'c-ok']};
function custMatRow(m){
  const [l, c] = CM_STATUS[m.status] || [m.status, 'c-mut'], g = gar(m.garmentId);
  return `<div style="border-bottom:1px solid var(--line);padding:8px 0"><div class="row ac"><b>${h(m.desc)}</b><span class="muted">${h(m.qty)} ${h(m.unit)}${g ? ' · ' + h(g.no) : ''}</span><span class="chip ${c}">${l}</span><span class="sp"></span>${can('production') || can('orders.edit') ? `<select style="width:auto" onchange="if(this.value)cmStatus('${m.id}',this.value)"><option value="">Update status…</option>${Object.entries(CM_STATUS).filter(([k]) => k !== m.status).map(([k, [lab]]) => `<option value="${k}">${lab}</option>`).join('')}</select>` : ''}</div>
  <div class="muted" style="font-size:12px">${(m.log || []).map(x => `${fmtDs(x.at)} ${CM_STATUS[x.status]?.[0] || x.status}${x.note ? ' (' + h(x.note) + ')' : ''} – ${h(x.by)}`).join(' → ')}</div></div>`;
}
function cmStatus(id, st){ prompt2('Update customer material', [{k: 'note', label: 'Note', full: true}], x => { const m = coll('custMaterials').find(y => y.id === id); m.status = st; m.log.push({at: nowISO(), status: st, note: x.note, by: meName()}); save(); render(); }); }
function receiveCustMaterial(gid){ const g = gar(gid); prompt2('Customer material received · ' + g.no, [{k: 'desc', label: 'Description', required: true, full: true, placeholder: 'e.g. Banarasi silk 1.2 m, rani pink'}, {k: 'qty', label: 'Quantity', type: 'number', value: 1}, {k: 'unit', label: 'Unit', value: 'm'}], x => { coll('custMaterials').push({id: uid('cm'), customerId: g.customerId, orderId: g.orderId, garmentId: g.id, desc: x.desc, qty: num(x.qty), unit: x.unit, status: 'received', receivedAt: nowISO(), receivedBy: meName(), log: [{at: nowISO(), status: 'received', note: '', by: meName()}]}); gLog(g, 'Customer material received: ' + x.desc); save(); render(); }); }
function issueDialog(gid, j){ const g = gar(gid), c = g.components[j], need = Math.max(0, r2(num(c.qty) * gq(g) + num(c.extra) - num(c.issued))); prompt2(`Issue ${c.name}`, [{k: 'qty', label: `Quantity (${c.unit})`, type: 'number', value: need, required: true}, {k: 'note', label: 'Note', full: true}], x => { const before = clone(g); issueMaterial(g, c, x.qty, x.note); gLog(g, `Issued ${x.qty} ${c.unit} ${c.name}`, before); save(); render(); toast(c.itemId && stockOf(c.itemId) < 0 ? 'Issued — stock is now negative, record the purchase' : 'Issued', c.itemId && stockOf(c.itemId) < 0 ? 'bad' : 'ok'); }, 'Issue'); }
function extraDialog(gid, j){ const g = gar(gid), c = g.components[j]; prompt2(`Additional requirement · ${c.name}`, [{k: 'qty', label: `Extra quantity (${c.unit})`, type: 'number', required: true}, {k: 'why', label: 'Reason', full: true, required: true}], x => { const before = clone(g); c.extra = r2(num(c.extra) + num(x.qty)); gLog(g, `Extra ${x.qty} ${c.unit} ${c.name} needed: ${x.why}`, before); save(); render(); }, 'Add'); }
function saveMaterials(gid){ const g = gar(gid), before = clone(g); g.components = clone(UI.gd.components); UI.gd = null; gLog(g, 'Materials list changed', before); save(); render(); }

/* ---------------- trials & alterations ---------------- */
function gTrials(g){
  const ed = can('trials') && gLive(g), T = (g.trials || []).slice().sort(by(t => t.date, -1)), pendingTrial = liveSteps(g).find(s => kindOf(s) === 'trial' && s.status !== 'done');
  return `<div class="card"><div class="row ac"><div><h3 style="margin:0">Trials & fittings</h3><div class="hint">Each trial records fit notes, correction photos and alterations with the assigned master. Every round is kept for future orders.</div></div><span class="sp"></span>${ed ? `<button class="pri" onclick="bookTrial('${g.id}')">📅 Book trial</button>` : ''}</div></div>
  ${T.length ? T.map(t => trialCard(g, t, ed)).join('') : `<div class="card empty">No trials yet.${pendingTrial ? ' This garment has a trial step in its workflow.' : ''}</div>`}`;
}
function trialCard(g, t, ed){
  const stc = {scheduled: ['Scheduled', 'c-info'], done: ['Done', 'c-ok'], missed: ['Missed', 'c-bad'], cancelled: ['Cancelled', 'c-mut']}[t.status] || [t.status, 'c-mut'];
  return `<div class="card"><div class="row ac"><b>Trial round ${t.round}</b><span class="chip ${stc[1]}">${stc[0]}</span><span>${fmtD(t.date)} ${h(t.time || '')}</span><span class="sp"></span>
    ${ed && t.status === 'scheduled' ? `<button class="sm pri" onclick="recordTrial('${g.id}','${t.id}')">Record outcome</button><button class="sm" onclick="rescheduleTrial('${g.id}','${t.id}')">Reschedule</button>${can('comms') ? `<button class="sm" onclick="openCompose('${g.orderId}','trial',null,null,'${g.id}',{trial_date:'${fmtD(t.date)} ${h(t.time || '')}'})">💬 Reminder</button>` : ''}` : ''}</div>
    ${t.notes ? `<div style="margin-top:6px"><span class="muted">Fit notes:</span> ${h(t.notes)}</div>` : ''}
    ${(t.photos || []).length ? `<div class="thumbs" style="margin-top:8px;max-width:520px">${t.photos.map((p, k) => `<div class="thumb" data-media="${h(p)}" onclick='lightboxIds(${h(JSON.stringify(t.photos))},${k})'><span class="cap">fitting photo</span></div>`).join('')}</div>` : ''}
    ${(t.alterations || []).length ? `<table class="stack" style="margin-top:8px"><thead><tr><th>Area</th><th>Instruction</th><th>Master</th>${can('prices') ? '<th class="n">Charge</th>' : ''}<th>Status</th></tr></thead><tbody>${t.alterations.map(a => `<tr><td>${h(a.area)}</td><td>${h(a.instruction)}</td><td>${h(worker(a.masterId)?.name || '—')}</td>${can('prices') ? `<td class="n">${a.charge ? inr(a.charge) : 'free'}</td>` : ''}<td>${a.status === 'done' ? '<span class="chip c-ok">Done</span>' : '<span class="chip c-acc">Pending</span>'}</td></tr>`).join('')}</tbody></table>` : ''}
    ${t.by ? `<div class="hint">Recorded by ${h(t.by)}</div>` : ''}</div>`;
}
function bookTrial(gid, sid){
  const g = gar(gid), x = sid ? sched().T[sid] : null, sug = x ? dayISO(Math.max(0, x.s)) : groupTarget(g, 'trial') || todayISO();
  prompt2('Book trial · ' + g.no + ' ' + g.title, [{k: 'date', label: 'Date', type: 'date', value: sug < todayISO() ? todayISO() : sug, required: true}, {k: 'time', label: 'Time', type: 'time', value: '17:00'}, {k: 'notes', label: 'Notes for the master', full: true}], x2 => {
    const before = clone(g); let step = sid ? g.steps.find(s => s.id === sid) : liveSteps(g).find(s => kindOf(s) === 'trial' && s.status !== 'done');
    if(!step){ const maxSeq = Math.max(...liveSteps(g).filter(s => kindOf(s) !== 'qc').map(s => num(s.seq))); step = {id: uid('s'), stageId: 'trial', label: (g.trials || []).length ? 'Re-trial' : 'Fitting trial', seq: r2(maxSeq + 0.5), status: 'pending', workerId: '', vendorId: '', round: (g.trials || []).length + 1, pricing: 'unit', units: 1, rate: 0, hours: 0.5, tat: 0, charge: 0, out: false, target: '', startedAt: null, doneAt: null}; g.steps.push(step); }
    (g.trials = g.trials || []).push({id: uid('tr'), round: (g.trials || []).length + 1, date: x2.date, time: x2.time, status: 'scheduled', stepId: step.id, notes: x2.notes, photos: [], alterations: [], by: ''});
    gLog(g, `Trial booked for ${fmtD(x2.date)} ${x2.time || ''}`, before); save(); render();
    if(can('comms')) ask('Trial booked. Send the customer a reminder now?', () => openCompose(g.orderId, 'trial', null, null, g.id, {trial_date: fmtD(x2.date) + ' ' + (x2.time || '')}), 'Send reminder');
  }, 'Book trial');
}
function rescheduleTrial(gid, tid){ const g = gar(gid), t = g.trials.find(x => x.id === tid); prompt2('Reschedule trial', [{k: 'date', label: 'New date', type: 'date', value: t.date, required: true}, {k: 'time', label: 'Time', type: 'time', value: t.time}], x => { const before = clone(g); t.date = x.date; t.time = x.time; gLog(g, `Trial rescheduled to ${fmtD(x.date)} ${x.time}`, before); save(); render(); }); }
function recordTrialFor(gid, sid){ const g = gar(gid), t = (g.trials || []).find(x => x.stepId === sid && x.status === 'scheduled'); if(t) return recordTrial(gid, t.id); bookTrial(gid, sid); }
function recordTrial(gid, tid){
  const g = gar(gid), t = g.trials.find(x => x.id === tid), masters = coll('workers').filter(w => w.active !== false && (w.skills || []).some(k => ['alter', 'stitch'].includes(k)));
  UI.x = {outcome: 'alter', notes: '', alts: [{area: '', instruction: '', masterId: masters[0]?.id || '', charge: ''}], retrial: false, profNote: true, photos: []};
  const draw = () => { const X = UI.x; return `<div class="mbar"><b>Trial outcome · ${h(g.no)} ${h(g.title)} · round ${t.round}</b><span class="sp"></span><button onclick="closeModal()">Close</button></div>
    <div class="row">${[['ok', 'Fits well — no changes'], ['alter', 'Alterations needed'], ['missed', 'Customer did not come']].map(([k, l]) => `<label class="inline"><input type="radio" name="tout" ${X.outcome === k ? 'checked' : ''} onchange="UI.x.outcome='${k}';document.getElementById('mbox').innerHTML=window._trialDraw();hydrate(document.getElementById('mbox'))"> ${l}</label>`).join('')}</div>
    ${X.outcome !== 'missed' ? `<label style="margin-top:10px">Fit notes</label><textarea rows="2" data-root="X" data-p="notes">${h(X.notes)}</textarea>
    <div class="row ac" style="margin-top:8px"><label class="btn sm" style="margin:0;color:var(--ink)">⬆ Fitting / correction photos<input type="file" accept="image/*" multiple style="display:none" onchange="trialPhotos(this)"></label><span class="muted" id="tphotos">${X.photos.length} photo(s)</span></div>` : ''}
    ${X.outcome === 'alter' ? `<h3 style="margin-top:14px">Alterations</h3><table class="ed"><thead><tr><th>Area</th><th>Instruction</th><th style="width:170px">Master</th>${can('prices') ? '<th style="width:110px">Charge ₹</th>' : ''}<th></th></tr></thead><tbody>${X.alts.map((a, i) => `<tr><td><input data-root="X" data-p="alts.${i}.area" value="${v(a.area)}" placeholder="e.g. Waist"></td><td><input data-root="X" data-p="alts.${i}.instruction" value="${v(a.instruction)}" placeholder="Take in 0.5&quot; each side"></td><td><select data-root="X" data-p="alts.${i}.masterId">${masters.map(w => opt(w.id, w.name, a.masterId)).join('')}</select></td>${can('prices') ? `<td><input type="number" step="any" data-root="X" data-p="alts.${i}.charge" value="${v(a.charge)}" placeholder="0 = free"></td>` : ''}<td><button class="sm ghost danger" onclick="UI.x.alts.splice(${i},1);document.getElementById('mbox').innerHTML=window._trialDraw()">✕</button></td></tr>`).join('')}</tbody></table>
      <button class="sm" style="margin-top:6px" onclick="UI.x.alts.push({area:'',instruction:'',masterId:'${masters[0]?.id || ''}',charge:''});document.getElementById('mbox').innerHTML=window._trialDraw()">+ Add alteration</button>
      <div style="margin-top:10px"><label class="inline"><input type="checkbox" data-root="X" data-p="retrial" ${X.retrial ? 'checked' : ''}> Re-trial needed after alterations</label><label class="inline"><input type="checkbox" data-root="X" data-p="profNote" ${X.profNote ? 'checked' : ''}> Save these corrections to the customer's measurement profile notes</label></div>
      <div class="hint">Each alteration becomes a step for the chosen master. A final QC is added after alterations before the garment can be marked ready.</div>` : ''}
    <div class="row" style="margin-top:14px"><span class="sp"></span><button class="pri" onclick="saveTrial('${gid}','${tid}')">Save outcome</button></div>`; };
  window._trialDraw = draw; openModal(draw());
}
async function trialPhotos(inp){ const ids = await uploadImages(inp.files, 1400); inp.value = ''; UI.x.photos.push(...ids); const el = document.getElementById('tphotos'); if(el) el.textContent = UI.x.photos.length + ' photo(s)'; }
function saveTrial(gid, tid){
  const g = gar(gid), t = g.trials.find(x => x.id === tid), X = UI.x, before = clone(g), step = g.steps.find(s => s.id === t.stepId);
  if(X.outcome === 'missed'){ t.status = 'missed'; gLog(g, `Trial round ${t.round} missed`, before); closeModal(); save(); render(); return ask('Marked as missed. Book a new trial date?', () => bookTrial(gid, step?.id)); }
  const alts = X.outcome === 'alter' ? X.alts.filter(a => a.instruction.trim() || a.area.trim()) : [];
  if(X.outcome === 'alter' && !alts.length) return toast('Add at least one alteration, or choose "Fits well"', 'bad');
  t.status = 'done'; t.notes = X.notes; t.photos = (t.photos || []).concat(X.photos); t.by = meName(); t.recordedAt = nowISO();
  if(step){ step.status = 'done'; step.startedAt = step.startedAt || nowISO(); step.doneAt = nowISO(); }
  const baseSeq = num(step?.seq || Math.max(...g.steps.map(s => num(s.seq))));
  const byMaster = {};
  alts.forEach(a => { const al = {id: uid('al'), area: a.area, instruction: a.instruction, masterId: a.masterId, charge: num(a.charge), status: 'pending'}; (t.alterations = t.alterations || []).push(al); (byMaster[a.masterId] = byMaster[a.masterId] || []).push(al);
    if(num(a.charge) > 0) (g.extras = g.extras || []).push({id: uid('x'), head: 'alterations', desc: `Alteration (trial ${t.round}): ${a.area || a.instruction}`, amount: num(a.charge), at: nowISO(), by: meName()}); });
  Object.entries(byMaster).forEach(([mid, list]) => { const sid = uid('s'); list.forEach(a => a.stepId = sid); g.steps.push({id: sid, stageId: 'alter', label: `Round ${t.round}: ${list.map(a => a.area || a.instruction).join(', ')}`, seq: r2(baseSeq + 0.3), status: 'pending', workerId: mid, vendorId: '', round: t.round, pricing: 'unit', units: 1, rate: stage('alter').rate, cplx: 'Simple', hours: Math.max(1, list.length * 1.5), tat: 0, charge: 0, out: false, target: '', startedAt: null, doneAt: null, trialId: t.id}); });
  if(alts.length && X.retrial) g.steps.push({id: uid('s'), stageId: 'trial', label: 'Re-trial', seq: r2(baseSeq + 0.6), status: 'pending', workerId: step?.workerId || '', vendorId: '', round: t.round + 1, pricing: 'unit', units: 1, rate: 0, hours: 0.5, tat: 0, charge: 0, out: false, target: '', startedAt: null, doneAt: null});
  if(alts.length) ensureFinalQC(g);
  if(alts.length && X.profNote){ const P = prof(g.profileId); if(P){ const pb = clone(P); P.fitNotes = [P.fitNotes, `${fmtD(todayISO())} (${g.no}): ` + alts.map(a => `${a.area} – ${a.instruction}`).join('; ')].filter(Boolean).join('\n'); P.updated = nowISO(); logChange(P, 'Alteration notes from ' + g.no, pb, clone(P)); } }
  gLog(g, `Trial round ${t.round} recorded: ${alts.length ? alts.length + ' alteration(s)' : 'fits well'}`, before); closeModal(); UI.x = null; save(); render(); toast(alts.length ? 'Alteration steps created for the masters' : 'Trial recorded', 'ok');
}

/* ---------------- QC & delivery ---------------- */
function gQC(g){
  const ed = can('qc'), st = gStatus(g), Q = (g.qc || []).slice().reverse(), D = g.delivery || {}, ready = st === 'ready' || st === 'delivered';
  const steps = [['pressed', 'Steam pressed'], ['packed', 'Packed'], ['notified', 'Customer notified'], ['delivered', 'Delivered / handed over']];
  return `<div class="card"><div class="row ac"><div><h3 style="margin:0">Quality check</h3><div class="hint">Stitching, embroidery, measurements, finishing and overall condition — every item pass / fail.</div></div><span class="sp"></span>${ed && gLive(g) && liveSteps(g).some(s => kindOf(s) === 'qc' && s.status !== 'done') ? `<button class="pri" onclick="doQC('${g.id}')">✔ Do QC now</button>` : ''}</div>
    ${Q.length ? Q.map(q => `<div style="border-top:1px solid var(--line);padding:10px 0"><div class="row ac"><span class="chip ${q.result === 'pass' ? 'c-ok' : 'c-bad'}">${q.result === 'pass' ? 'PASSED' : 'FAILED'}</span><span>${fmtDT(q.at)} · ${h(q.by)}</span></div>${q.notes ? `<div class="muted">${h(q.notes)}</div>` : ''}${Object.keys(q.checks || {}).length ? `<details><summary>Checklist</summary><div style="font-size:12.5px">${Object.entries(q.checks).map(([k, val]) => `<div>${val === 'pass' ? '✅' : val === 'fail' ? '❌' : '➖'} ${h(k)}</div>`).join('')}</div></details>` : ''}</div>`).join('') : '<div class="empty">No QC yet.</div>'}</div>
  <div class="card"><h3>Delivery — separate status for each stage</h3>${!ready ? '<div class="flag info">Delivery opens once the garment has passed final QC.</div>' : ''}
    <div class="dsteps">${steps.map(([k, l], i) => { const d = D[k], prevOk = i === 0 ? ready : !!D[steps[i - 1][0]] || (k === 'delivered' && D.packed);
      return `<div class="dstep ${d ? 'done' : ''}"><b>${d ? '✓ ' : ''}${l}</b><div class="muted" style="font-size:12px">${d ? `${fmtDT(d.at)}${d.by ? ' · ' + h(d.by) : ''}` : 'Not yet'}</div>${d && k === 'delivered' ? `<div style="font-size:12px;margin-top:4px">Received by <b>${h(d.receivedBy)}</b>${d.relation ? ' (' + h(d.relation) + ')' : ''}${d.notes ? '<br>' + h(d.notes) : ''}</div>` : ''}
        ${ed && !d && ready && st !== 'delivered' ? `<button class="sm ${prevOk ? 'pri' : ''}" style="margin-top:6px" onclick="deliveryStep('${g.id}','${k}')">${k === 'notified' ? '💬 Notify' : k === 'delivered' ? 'Hand over' : 'Mark done'}</button>` : ''}${ed && d && st !== 'delivered' ? `<button class="sm ghost" onclick="undoDelivery('${g.id}','${k}')">↶</button>` : ''}</div>`; }).join('')}</div>
    ${garmentsOf(g.orderId).length > 1 ? `<div class="hint">This order has ${garmentsOf(g.orderId).length} garments — each is delivered on its own (partial delivery).</div>` : ''}</div>`;
}
function doQC(gid, sid){
  const g = gar(gid), step = sid ? g.steps.find(s => s.id === sid) : liveSteps(g).find(s => kindOf(s) === 'qc' && s.status !== 'done');
  if(!step) return toast('No pending QC step', 'bad');
  const before = liveSteps(g).filter(s => num(s.seq) < num(step.seq) && s.status !== 'done');
  const go2 = () => {
    const CL = ST().qcChecklist || [];
    openModal(`<div class="mbar"><b>Quality check · ${h(g.no)} ${h(g.title)}</b><span class="sp"></span><button onclick="closeModal()">Close</button></div>
    <div class="row" style="margin-bottom:10px"><button class="sm" onclick="document.querySelectorAll('.qcp').forEach(x=>x.checked=true)">Mark all pass</button></div>
    ${CL.map((sec, si) => `<div class="qc-sec"><b>${h(sec.sec)}</b>${sec.items.map((it, ii) => `<div class="qc-item"><span>${h(it)}</span><div class="seg"><label class="p"><input type="radio" class="qcp" name="q${si}_${ii}" value="pass" data-k="${h(sec.sec + ': ' + it)}">Pass</label><label class="x"><input type="radio" name="q${si}_${ii}" value="fail" data-k="${h(sec.sec + ': ' + it)}">Fail</label><label><input type="radio" name="q${si}_${ii}" value="na" data-k="${h(sec.sec + ': ' + it)}">N/A</label></div></div>`).join('')}</div>`).join('')}
    <label>Notes / defects found</label><textarea id="qcNotes" rows="2"></textarea>
    <div class="row" style="margin-top:12px"><span class="sp"></span><button class="pri" onclick="saveQC('${gid}','${step.id}')">Save QC result</button></div>`);
  };
  if(before.length) return ask(`${before.length} earlier step(s) are not finished (${before.map(s => stg(s).name).join(', ')}). Do QC anyway?`, go2, 'Continue');
  go2();
}
function saveQC(gid, sid){
  const g = gar(gid), step = g.steps.find(s => s.id === sid), checks = {}; let missing = 0;
  document.querySelectorAll('.qc-item').forEach(row => { const sel = row.querySelector('input:checked'); if(!sel){ missing++; return; } checks[sel.dataset.k] = sel.value; });
  if(missing) return toast(`${missing} checklist item(s) not marked`, 'bad');
  const fails = Object.entries(checks).filter(([, x]) => x === 'fail').map(([k]) => k), notes = document.getElementById('qcNotes').value, before = clone(g);
  const rec = {id: uid('q'), at: nowISO(), by: meName(), result: fails.length ? 'fail' : 'pass', checks, notes: notes || (fails.length ? 'Failed: ' + fails.join('; ') : ''), stepId: sid};
  (g.qc = g.qc || []).push(rec); closeModal();
  if(!fails.length){ step.status = 'done'; step.startedAt = step.startedAt || nowISO(); step.doneAt = nowISO(); step.workerId = step.workerId || (ME.workerId || ''); gLog(g, 'QC passed — ready for delivery', before); save(); render(); toast('QC passed — garment is ready', 'ok'); return; }
  gLog(g, 'QC failed: ' + fails.join('; '), before); save(); render();
  ask(`QC failed on ${fails.length} item(s). Send the garment back to a stage for correction now?`, () => sendBack(gid), 'Send back');
}
function deliveryStep(gid, k){
  const g = gar(gid), o = ord(g.orderId), before = clone(g); g.delivery = g.delivery || {};
  if(k === 'notified'){ g.delivery.notified = {at: nowISO(), by: meName()}; gLog(g, 'Customer notified that garment is ready', before); save(); render(); if(can('comms')) openCompose(g.orderId, 'ready', null, null, g.id); return; }
  if(k !== 'delivered'){ g.delivery[k] = {at: nowISO(), by: meName()}; gLog(g, k === 'pressed' ? 'Steam pressed' : 'Packed', before); save(); render(); return; }
  const T = orderTotals(o), c = cust(g.customerId);
  prompt2('Hand over · ' + g.no + ' ' + g.title, [{k: 'receivedBy', label: 'Received by', value: c?.name || '', required: true}, {k: 'relation', label: 'Relation', value: 'Self'}, {k: 'when', label: 'Date & time', type: 'datetime-local', value: new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16)}, ...(can('billing') ? [{k: 'collected', label: `Payment collected now ₹ (balance ${inr(T.bal)})`, type: 'number', value: ''}, {k: 'mode', label: 'Mode', type: 'select', options: ['UPI', 'Cash', 'Card', 'Bank transfer']}] : []), {k: 'notes', label: 'Handover notes', type: 'textarea', full: true}], async x => {
    g.delivery.delivered = {at: new Date(x.when).toISOString(), by: meName(), receivedBy: x.receivedBy, relation: x.relation, notes: x.notes, collected: num(x.collected)};
    if(!g.delivery.packed) g.delivery.packed = {at: nowISO(), by: meName()};
    coll('custMaterials').filter(m => m.garmentId === g.id && m.status !== 'returned').forEach(m => { m.status = 'returned'; m.log.push({at: nowISO(), status: 'returned', note: 'Returned with garment / leftovers', by: meName()}); });
    if(num(x.collected) > 0){ const n = await nextNo('rcpt'); o.payments.push({id: uid('p'), date: todayISO(), amount: num(x.collected), mode: x.mode, type: 'final', note: 'Collected at delivery of ' + g.no, receiptNo: ST().rcptPrefix + String(n).padStart(4, '0'), by: meName()}); }
    gLog(g, `Delivered to ${x.receivedBy}${x.relation ? ' (' + x.relation + ')' : ''}`, before);
    const rest = activeG(o).filter(z => z.id !== g.id && gStatus(z) !== 'delivered');
    o.history.push({at: nowISO(), by: meName(), action: `${g.no} delivered${rest.length ? ` — partial delivery, ${rest.length} garment(s) pending` : ' — order fully delivered'}`, changes: []});
    save(); render();
    if(can('billing') && !g.invoiceId) ask(`Garment delivered. Generate the invoice for ${g.no} now?`, () => { invoiceDialog(o.id); }, 'Invoice');
    else autoMsg(o.id, 'delivered', null, g.id);
  }, 'Confirm handover');
}
function undoDelivery(gid, k){ const g = gar(gid), before = clone(g); delete g.delivery[k]; gLog(g, 'Delivery status reverted: ' + k, before); save(); render(); }

/* ---------------- billing ---------------- */
function gBill(g, o){
  const b = garmentBill(g, o), ed = can('billing'), cp = b.costParts;
  return `<div class="card"><div class="row ac"><div><h3 style="margin:0">Garment-wise billing</h3><div class="hint">Each head is priced at cost × (1 + ${num(o.markup)}% markup) unless you set a price. Customer-supplied fabric is not charged.</div></div><span class="sp"></span>${ed ? `<button onclick="addExtra('${g.id}')">+ Additional charge</button>` : ''}</div>
    <table class="stack" style="margin-top:10px"><thead><tr><th>Charge head</th><th class="n">Cost</th><th class="n">Price</th>${ed ? '<th style="width:150px">Set price ₹</th>' : ''}</tr></thead><tbody>
    ${b.lines.filter(l => !l.extra).map(l => `<tr><td>${h(l.name)}${l.override ? ' <span class="chip c-info">set</span>' : ''}</td><td class="n">${inr(l.cost)}</td><td class="n"><b>${inr(l.price)}</b></td>${ed ? `<td><input type="number" step="any" placeholder="auto" value="${l.override ? v(l.price) : ''}" onchange="setHeadPrice('${g.id}','${l.head}',this.value)"></td>` : ''}</tr>`).join('')}
    ${b.lines.filter(l => l.extra).map(l => `<tr style="background:var(--gold-soft)"><td>${h(l.name)}</td><td class="n">—</td><td class="n"><b>${inr(l.price)}</b></td>${ed ? `<td><button class="sm ghost danger" onclick="rmExtra('${g.id}','${l.extra}')">Remove</button></td>` : ''}</tr>`).join('')}
    <tr><td><b>Garment total</b></td><td class="n">${inr(b.cost)}</td><td class="n"><b class="acc" style="font-size:16px">${inr(b.total)}</b></td>${ed ? '<td></td>' : ''}</tr></tbody></table>
    <div class="hint">Cost breakdown: materials ${inr(cp.mat)} · worker labour ${inr(cp.lab)} · outside vendors ${inr(cp.ext)}. Profit on this garment ${inr(b.total - b.cost)}.</div>
    ${g.invoiceId ? `<div class="flag ok" style="margin-top:10px">Invoiced on <a href="#" onclick="viewInvoice('${g.invoiceId}');return false">${h(inv(g.invoiceId)?.no || '')}</a>. Changes here need the invoice to be regenerated.</div>` : ''}</div>`;
}
function setHeadPrice(gid, head, val){ const g = gar(gid), before = clone(g); g.headPrice = g.headPrice || {}; if(val === '') delete g.headPrice[head]; else g.headPrice[head] = num(val); gLog(g, `Price for ${headName(head)} ${val === '' ? 'reset to auto' : 'set to ' + inr(val)}`, before); save(); render(); }
function addExtra(gid){ const g = gar(gid); prompt2('Additional charge · ' + g.no, [{k: 'head', label: 'Charge head', type: 'select', value: 'other', options: ST().heads.map(x => [x.id, x.name])}, {k: 'desc', label: 'Description', required: true, full: true, placeholder: 'e.g. Customer changed neckline after approval'}, {k: 'amount', label: 'Amount ₹', type: 'number', required: true}], x => { const before = clone(g); (g.extras = g.extras || []).push({id: uid('x'), head: x.head, desc: x.desc, amount: num(x.amount), at: nowISO(), by: meName()}); gLog(g, `Additional charge ${inr(x.amount)}: ${x.desc}`, before); save(); render(); }, 'Add charge'); }
function rmExtra(gid, xid){ ask('Remove this charge? It stays in the history.', () => { const g = gar(gid), before = clone(g); g.extras = g.extras.filter(x => x.id !== xid); gLog(g, 'Additional charge removed', before); save(); render(); }); }

/* ---------------- history ---------------- */
function gHistory(g){
  const msgs = coll('msgLog').filter(m => m.garmentId === g.id || (m.orderId === g.orderId && !m.garmentId));
  return `<div class="grid2"><div class="card"><h3>Change history — nothing is overwritten without a record</h3>${histHTML(g.history)}</div><div class="card"><h3>Messages for this order</h3>${msgs.length ? msgs.slice().reverse().map(m => `<div style="border-bottom:1px solid var(--line);padding:6px 0"><b>${h(m.tplName)}</b> <span class="muted" style="font-size:12px">${fmtDT(m.at)} · ${h(m.channel)}</span><div class="muted" style="font-size:12.5px;white-space:pre-wrap">${h(m.text.slice(0, 220))}</div></div>`).join('') : '<div class="empty">No messages yet.</div>'}
    ${can('orders.edit') && gLive(g) ? `<div class="row" style="margin-top:12px"><span class="sp"></span>${g.status === 'hold' ? `<button class="sm" onclick="setGStatus('${g.id}','active')">Resume</button>` : `<button class="sm" onclick="setGStatus('${g.id}','hold')">Put on hold</button>`}<button class="sm ghost danger" onclick="setGStatus('${g.id}','cancelled')">Cancel garment</button></div>` : g.status === 'cancelled' && can('orders.edit') ? `<button class="sm" onclick="setGStatus('${g.id}','active')">Restore garment</button>` : ''}</div></div>`;
}
function setGStatus(gid, st){ const g = gar(gid); const doit = () => { const before = clone(g); g.status = st; gLog(g, st === 'hold' ? 'Put on hold' : st === 'cancelled' ? 'Garment cancelled' : 'Garment resumed', before); save(); render(); }; if(st === 'cancelled') ask('Cancel this garment? Its record is kept and can be restored.', doit); else doit(); }
