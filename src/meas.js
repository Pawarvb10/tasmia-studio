/* =====================================================================
   meas.js : measurement charts (from the studio's PDF sheets) and the
             2D diagram for every measurement, drawn as SVG
   ===================================================================== */
/* Mannequin geometry — right-hand half, x offset from centre (100), y down.
   The left half is mirrored. Units are diagram units, not inches.        */
const FIG = {
  w: {torso: [[8, 48], [16, 53], [34, 60], [31, 72], [29, 84], [31, 96], [28, 108], [22, 124], [21, 134], [24, 148], [30, 164], [32, 178], [31, 192]],
      leg: [[29, 215], [25, 245], [24, 265], [24, 285], [21, 320], [17, 352], [16, 366], [19, 376], [7, 378], [6, 366], [6, 330], [5, 290], [4, 265], [3, 230], [2, 200], [0, 194]],
      arm: [[34, 60], [40, 68], [43, 90], [45, 120], [47, 150], [48, 180], [49, 200], [47, 212], [43, 212], [42, 200], [40, 180], [38, 150], [36, 120], [34, 95], [30, 80]],
      sh: [17, 55], bust: true},
  m: {torso: [[9, 48], [18, 52], [40, 60], [37, 74], [35, 90], [34, 104], [31, 122], [29, 134], [30, 148], [31, 164], [32, 178], [31, 192]],
      leg: [[30, 215], [27, 245], [26, 265], [25, 290], [23, 320], [20, 352], [19, 366], [22, 376], [8, 378], [7, 366], [7, 330], [6, 290], [5, 265], [4, 230], [3, 205], [0, 196]],
      arm: [[40, 60], [46, 70], [49, 95], [51, 125], [53, 155], [54, 182], [55, 200], [53, 214], [48, 214], [47, 200], [45, 182], [43, 155], [41, 125], [38, 100], [35, 82]],
      sh: [19, 54], bust: false}};
function lerpY(pts, y){ // x on a polyline at height y (points must be monotonic in y over the used range)
  for(let i = 0; i < pts.length - 1; i++){ const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]; if((y >= y1 && y <= y2) || (y <= y1 && y >= y2)){ return y2 === y1 ? x1 : x1 + (x2 - x1) * (y - y1) / (y2 - y1); } }
  return pts[pts.length - 1][0];
}
const bodyHW = (f, y) => lerpY(FIG[f].torso.concat(FIG[f].leg.slice(0, 7)), y);
function legCX(f, y){ const L = FIG[f].leg, out = lerpY(L.slice(0, 7), y), inn = lerpY(L.slice(8).reverse(), y); return {c: (out + inn) / 2, hw: (out - inn) / 2}; }
function armAt(f, y){ const A = FIG[f].arm, out = lerpY(A.slice(0, 7), y), inn = lerpY(A.slice(8).concat([A[0]]).reverse().slice(0, 7).reverse(), y); const c = (out + inn) / 2 + 0.5; return {c, hw: Math.max(3, (out - inn) / 2)}; }
const MP = (x, y) => `${(100 + x).toFixed(1)},${y.toFixed(1)}`;
function bodyPath(f){ const R = FIG[f].torso.concat(FIG[f].leg), L = R.map(([x, y]) => [-x, y]).reverse(); return 'M' + R.map(([x, y]) => MP(x, y)).join(' L') + ' L' + L.map(([x, y]) => MP(x, y)).join(' L') + ' Z'; }
function armPath(f, side){ const A = FIG[f].arm.map(([x, y]) => [x * side, y]); return 'M' + A.map(([x, y]) => MP(x, y)).join(' L') + ' Z'; }

/* charts in the exact order of the PDF sheets.
   g = garment drawn on the figure: [type, hem, sleeveEnd]; v = view (f front / b back);
   c = crop (u upper body / f full / l lower body); m = marks                       */
const CHARTS = {
  blouse: {name: 'Blouse', fig: 'w', g: ['blouse', 124, 92], c: 'u', items: [
    [1, 'Upper Chest Round', {m: [['r', 84]]}],
    [2, 'Lower Chest Round', {m: [['r', 97]]}],
    [3, 'Waist Round', {m: [['r', 122]]}],
    [4, 'Stomach Round [Koti]', {g: ['blouse', 150, 92], m: [['r', 146]]}],
    [5, 'Bust Length', {m: [['L', 17, 55, 97], ['dot', 15, 97]]}],
    [6, 'Under Bust Length', {m: [['L', 17, 55, 110]]}],
    [7, 'Front Blouse Length', {m: [['L', 17, 55, 124]]}],
    [8, 'Back Blouse Length', {v: 'b', m: [['L', 0, 50, 124]]}],
    [9, 'Koti Blouse Front Length', {g: ['blouse', 150, 92], m: [['L', 17, 55, 150]]}],
    [10, 'Koti Blouse Back Length', {v: 'b', g: ['blouse', 150, 92], m: [['L', 0, 50, 150]]}],
    [11, 'Front Neckline', {m: [['nk', 'u', 20]]}],
    [12, 'Front-V- Neckline', {m: [['nk', 'v', 26]]}],
    [13, 'Back Neckline', {v: 'b', m: [['nk', 'u', 32]]}],
    [14, 'Front Shoulder', {m: [['S', 10, 52, 34, 60]]}],
    [15, 'Front Width', {m: [['S', -28, 78, 28, 78]]}],
    [16, 'Back Width', {v: 'b', m: [['S', -28, 78, 28, 78]]}],
    [17, 'Back Shoulder', {v: 'b', m: [['S', 10, 52, 34, 60]]}],
    [18, 'Cap Sleeves Length / Round', {dual: 1, g: ['blouse', 124, 72], m: [['aL', 72], ['ar', 72]]}],
    [19, 'Short Sleeves Length / Round', {dual: 1, g: ['blouse', 124, 92], m: [['aL', 92], ['ar', 92]]}],
    [20, 'Elbow Sleeves Length / Round', {dual: 1, g: ['blouse', 124, 135], m: [['aL', 135], ['ar', 135]], c: 'a'}],
    [21, '3/4th Sleeves Length / Round', {dual: 1, g: ['blouse', 124, 165], m: [['aL', 165], ['ar', 165]], c: 'a'}],
    [22, 'Full Sleeves Length / Round', {dual: 1, g: ['blouse', 124, 205], m: [['aL', 205], ['ar', 205]], c: 'a'}],
    [23, 'Dand Round', {m: [['ar', 100]]}],
    [24, 'Armhole Round', {m: [['ah']]}]]},
  top: {name: 'Top', fig: 'w', g: ['top', 262, 92], c: 'f', items: [
    [1, 'Upper Chest Round', {c: 'u', m: [['r', 84]]}],
    [2, 'Lower Chest Round', {c: 'u', m: [['r', 97]]}],
    [3, 'Waist Round', {c: 'u', m: [['r', 132]]}],
    [4, 'Stomach Round', {c: 'u', m: [['r', 148]]}],
    [5, 'Hip Round', {c: 'm', m: [['r', 172]]}],
    [6, 'Bust Length', {c: 'u', m: [['L', 17, 55, 97], ['dot', 15, 97]]}],
    [7, 'Waist Length', {c: 'u', m: [['L', 17, 55, 132]]}],
    [8, 'Jean’s Top Length', {g: ['top', 186, 92], m: [['L', 17, 55, 186]]}],
    [9, 'Short Top Length', {g: ['top', 205, 92], m: [['L', 17, 55, 205]]}],
    [10, 'Knee Top Length', {g: ['top', 262, 92], m: [['L', 17, 55, 262]]}],
    [11, 'Salwar’s Top Length', {g: ['top', 284, 92], m: [['L', 17, 55, 284]]}],
    [12, 'Pant’s Top Length', {g: ['top', 300, 92], m: [['L', 17, 55, 300]]}],
    [13, 'Calf Length', {g: ['top', 318, 92], m: [['L', 17, 55, 318]]}],
    [14, 'Long Top Length', {g: ['top', 345, 92], m: [['L', 17, 55, 345]]}],
    [15, 'One Piece Length', {g: ['top', 372, 92], m: [['L', 17, 55, 372]]}],
    [16, 'Front Shoulder', {c: 'u', m: [['S', 10, 52, 34, 60]]}],
    [17, 'Front Width', {c: 'u', m: [['S', -28, 78, 28, 78]]}],
    [18, 'Back Width', {c: 'u', v: 'b', m: [['S', -28, 78, 28, 78]]}],
    [19, 'Back Shoulder', {c: 'u', v: 'b', m: [['S', 10, 52, 34, 60]]}],
    [20, 'Short Sleeves Length / Round', {dual: 1, c: 'u', g: ['top', 262, 92], m: [['aL', 92], ['ar', 92]]}],
    [21, 'Elbow Sleeves Length / Round', {dual: 1, c: 'a', g: ['top', 262, 135], m: [['aL', 135], ['ar', 135]]}],
    [22, '3/4 Sleeves Length / Round', {dual: 1, c: 'a', g: ['top', 262, 165], m: [['aL', 165], ['ar', 165]]}],
    [23, 'Full Sleeves Length', {c: 'a', g: ['top', 262, 205], m: [['aL', 205]]}],
    [24, 'Dand Round', {c: 'u', m: [['ar', 100]]}],
    [25, 'Armhole Round', {c: 'u', m: [['ah']]}]]},
  bottom: {name: 'Bottom', fig: 'w', g: ['pants', 132, 362], c: 'l', items: [
    [1, 'Ready Waist', {m: [['r', 132]]}],
    [2, 'Ready Hips', {m: [['r', 172]]}],
    [3, 'Pant Length', {m: [['Ls', 132, 365]]}],
    [4, 'Knee Length/Round', {dual: 1, m: [['Ls', 132, 265], ['lr', 265]]}],
    [5, 'Calf Round', {m: [['lr', 305]]}],
    [6, 'Bottom Round', {m: [['lr', 360]]}],
    [7, 'Thighs', {m: [['lr', 208]]}],
    [8, 'Salwar Length / Bottom Round', {dual: 1, g: ['salwar', 132, 352], m: [['Ls', 132, 352], ['lr', 350]]}],
    [9, 'Plazzo Length', {g: ['palazzo', 132, 374], m: [['Ls', 132, 374]]}],
    [10, 'Capri Length', {g: ['pants', 132, 302], m: [['Ls', 132, 302]]}],
    [11, 'Payjama Length', {g: ['pants', 132, 364], m: [['Ls', 132, 364]]}],
    [12, 'Long Skirt Length', {g: ['skirt', 132, 360, 0.18], m: [['Ls', 132, 360]]}],
    [13, 'Short Skirt Length', {g: ['skirt', 132, 228, 0.25], m: [['Ls', 132, 228]]}],
    [14, 'Garara Length', {g: ['garara', 132, 372], m: [['Ls', 132, 372]]}],
    [15, 'Lehenga Length', {g: ['skirt', 132, 378, 0.3], m: [['Ls', 132, 378]]}],
    [16, 'Petticoat Length', {g: ['skirt', 132, 372, 0.14], m: [['Ls', 132, 372]]}],
    [17, 'Knee Length', {g: null, m: [['Ls', 132, 265]]}],
    [18, 'Calf Length', {g: null, m: [['Ls', 132, 310]]}],
    [19, 'Ankle Length', {g: null, m: [['Ls', 132, 362]]}],
    [20, 'Floor Length', {g: null, m: [['Ls', 132, 380]]}]]},
  mens: {name: 'Mens', fig: 'm', g: ['kurta', 215, 205], c: 'u', items: [
    [1, 'Chest Round', {m: [['r', 95]]}],
    [2, 'Waist Round', {m: [['r', 134]]}],
    [3, 'Stomach Round', {m: [['r', 148]]}],
    [4, 'Hip Round', {c: 'm', m: [['r', 170]]}],
    [5, 'Shirt Length', {c: 'f', g: ['kurta', 195, 205], m: [['L', 19, 54, 195]]}],
    [6, 'Sherwani Length', {c: 'f', g: ['kurta', 285, 205], m: [['L', 19, 54, 285]]}],
    [7, 'Jacket Length', {c: 'f', g: ['jacket', 182, 205], m: [['L', 19, 54, 182]]}],
    [8, 'Long Jacket Length', {c: 'f', g: ['jacket', 232, 205], m: [['L', 19, 54, 232]]}],
    [9, 'Jodhpuri Length', {c: 'f', g: ['jacket', 192, 205], m: [['L', 19, 54, 192]]}],
    [10, 'Short Kurta Length', {c: 'f', g: ['kurta', 215, 205], m: [['L', 19, 54, 215]]}],
    [11, 'Long Kurta Length', {c: 'f', g: ['kurta', 270, 205], m: [['L', 19, 54, 270]]}],
    [12, 'Shoulder', {v: 'b', m: [['S', -40, 60, 40, 60]]}],
    [13, 'Sleeves Length', {c: 'a', m: [['aL', 205]]}],
    [14, 'Sleeves Round', {c: 'a', m: [['ar', 203]]}],
    [15, 'Dand Round', {m: [['ar', 100]]}],
    [16, 'Collar', {m: [['col']]}],
    [17, 'Armhole', {m: [['ah']]}],
    [18, 'Ready Waist', {c: 'l', g: ['pants', 134, 364], m: [['r', 134]]}],
    [19, 'Ready Hips', {c: 'l', g: ['pants', 134, 364], m: [['r', 170]]}],
    [20, 'Pant Length', {c: 'l', g: ['pants', 134, 366], m: [['Ls', 134, 366]]}],
    [21, 'Knee Length', {c: 'l', g: ['pants', 134, 364], m: [['Ls', 134, 265]]}],
    [22, 'Knee Round', {c: 'l', g: ['pants', 134, 364], m: [['lr', 265]]}],
    [23, 'Calf Round', {c: 'l', g: ['pants', 134, 364], m: [['lr', 305]]}],
    [24, 'Bottom Round', {c: 'l', g: ['pants', 134, 364], m: [['lr', 360]]}],
    [25, 'Thigs', {c: 'l', g: ['pants', 134, 364], m: [['lr', 208]]}]]}
};
const CROP = {u: '28 6 144 192', a: '22 6 156 222', m: '26 30 148 220', f: '20 4 160 384', l: '30 116 140 272'};
const mKey = (chart, no, part) => `${chart}_${String(no).padStart(2, '0')}${part || ''}`;
function chartFields(charts){
  const out = [];
  (charts || []).forEach(ch => { const C2 = CHARTS[ch]; if(!C2) return; C2.items.forEach(([no, label, o]) => { if(o.dual){ const [a, b] = dualNames(label); out.push({k: mKey(ch, no, 'L'), label: `${label} – ${a}`, sec: C2.name, chart: ch, no}); out.push({k: mKey(ch, no, 'R'), label: `${label} – ${b}`, sec: C2.name, chart: ch, no}); } else out.push({k: mKey(ch, no), label, sec: C2.name, chart: ch, no}); }); });
  return out;
}
function dualNames(label){ return /Bottom Round/.test(label) ? ['Length', 'Bottom round'] : ['Length', 'Round']; }

/* ---------------- SVG drawing ---------------- */
let SVGN = 0;
const HL = '#d9480f';
function measSVG(chart, item){
  const C2 = CHARTS[chart], [no, label, o0] = item, o = Object.assign({}, o0), f = C2.fig, view = o.v || 'f';
  const g = o.g === undefined ? C2.g : o.g, crop = CROP[o.c || C2.c], id = 'm' + (++SVGN);
  const body = bodyPath(f), arms = armPath(f, 1) + ' ' + armPath(f, -1);
  let s = `<svg viewBox="${crop}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${h(label)}"><defs><clipPath id="${id}b"><path d="${body}"/></clipPath><clipPath id="${id}a"><path d="${arms}"/></clipPath><marker id="${id}h" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${HL}"/></marker></defs>`;
  // figure
  s += `<g fill="#efe6df" stroke="#a8978d" stroke-width="0.8"><path d="${arms}"/><path d="${body}"/><rect x="${100 - (f === 'm' ? 8 : 7)}" y="31" width="${f === 'm' ? 16 : 14}" height="20" rx="3"/><circle cx="100" cy="20" r="${f === 'm' ? 13 : 12}"/></g>`;
  if(f === 'w' && view === 'f') s += `<path d="M${MP(-24, 92)} Q${MP(-14, 104)} ${MP(-3, 95)} M${MP(3, 95)} Q${MP(14, 104)} ${MP(24, 92)}" fill="none" stroke="#c4b4aa" stroke-width="0.8"/>`;
  if(view === 'b') s += `<path d="M100,52 L100,180" stroke="#c4b4aa" stroke-width="0.7" stroke-dasharray="3 3"/>`;
  if(view === 'b' && f === 'w') s += `<path d="M${MP(-6, 6)} Q100,-2 ${MP(6, 6)}" fill="none" stroke="#a8978d" stroke-width="2"/>`;
  // garment
  if(g) s += garmentSVG(f, g, id, view, o);
  // marks
  (o.m || []).forEach(mk => s += markSVG(f, mk, id));
  s += `<text x="${crop.split(' ')[0] * 1 + 4}" y="${crop.split(' ')[1] * 1 + 12}" font-family="system-ui,sans-serif" font-size="9" fill="#8a7a72">${view === 'b' ? 'BACK' : 'FRONT'}</text></svg>`;
  return s;
}
function garmentSVG(f, g, id, view, o){
  const [type, a, b, flare] = g, GF = '#ecc9d6', GS = '#9b4f6c'; let s = '';
  const nk = view === 'f' ? `<path d="M${MP(-9, 47)} Q100,${o.m && o.m[0] && o.m[0][0] === 'nk' ? 47 + o.m[0][2] : 64} ${MP(9, 47)} Z" fill="#efe6df" stroke="${GS}" stroke-width="0.6"/>` : `<path d="M${MP(-9, 47)} Q100,${o.m && o.m[0] && o.m[0][0] === 'nk' ? 47 + o.m[0][2] : 58} ${MP(9, 47)} Z" fill="#efe6df" stroke="${GS}" stroke-width="0.6"/>`;
  if(type === 'blouse' || type === 'top' || type === 'kurta' || type === 'jacket'){
    const hem = a, sl = b, tHem = Math.min(hem, 190);
    s += `<g clip-path="url(#${id}a)"><rect x="0" y="50" width="200" height="${sl - 50}" fill="${GF}" stroke="none"/></g>`;
    s += `<g clip-path="url(#${id}b)"><rect x="0" y="47" width="200" height="${tHem - 47}" fill="${GF}"/></g>`;
    if(hem > 190){ const hw0 = bodyHW(f, 186) + 1, fl = type === 'kurta' ? 0.06 : 0.12, hw1 = hw0 + (hem - 186) * fl; s += `<path d="M${MP(-hw0, 186)} L${MP(hw0, 186)} L${MP(hw1, hem)} L${MP(-hw1, hem)} Z" fill="${GF}" stroke="${GS}" stroke-width="0.6"/>`; }
    else s += `<path d="M${MP(-bodyHW(f, hem) - 1, hem)} L${MP(bodyHW(f, hem) + 1, hem)}" stroke="${GS}" stroke-width="0.8"/>`;
    if(type === 'jacket'){ s += `<path d="M100,60 L100,${hem}" stroke="${GS}" stroke-width="0.8"/>`; [80, 100, 120, 140].filter(y => y < hem - 4).forEach(y => s += `<circle cx="100" cy="${y}" r="1.4" fill="${GS}"/>`); }
    if(type === 'kurta') s += `<path d="M100,52 L100,96" stroke="${GS}" stroke-width="0.7"/>`;
    s += nk;
  } else if(type === 'pants' || type === 'salwar' || type === 'palazzo'){
    if(type === 'palazzo'){ const lc = legCX(f, 200); s += `<g clip-path="url(#${id}b)"><rect x="0" y="${a}" width="200" height="${200 - a}" fill="${GF}"/></g>`; [-1, 1].forEach(sd => s += `<path d="M${MP(sd * 2, 200)} L${MP(sd * 32, 200)} L${MP(sd * 40, b)} L${MP(sd * 1, b)} Z" fill="${GF}" stroke="${GS}" stroke-width="0.6"/>`); }
    else { s += `<g clip-path="url(#${id}b)"><rect x="0" y="${a}" width="200" height="${b - a}" fill="${GF}"/></g>`; if(type === 'salwar') [-1, 1].forEach(sd => s += `<path d="M${MP(sd * 1, 200)} L${MP(sd * 36, 196)} Q${MP(sd * 40, 270)} ${MP(sd * 24, 338)} L${MP(sd * 21, b)} L${MP(sd * 7, b)} L${MP(sd * 6, 338)} Q${MP(sd * 2, 270)} ${MP(sd * 1, 200)} Z" fill="${GF}" stroke="${GS}" stroke-width="0.6"/>`); }
    s += `<path d="M${MP(-bodyHW(f, a) - 1, a)} L${MP(bodyHW(f, a) + 1, a)}" stroke="${GS}" stroke-width="1.2"/>`;
  } else if(type === 'skirt' || type === 'garara'){
    const fl = flare || 0.3, hip = 31;
    if(type === 'garara'){ s += `<g clip-path="url(#${id}b)"><rect x="0" y="${a}" width="200" height="${265 - a}" fill="${GF}"/></g>`; [-1, 1].forEach(sd => s += `<path d="M${MP(sd * 2, 258)} L${MP(sd * 26, 258)} L${MP(sd * 44, b)} L${MP(sd * 1, b)} Z" fill="${GF}" stroke="${GS}" stroke-width="0.6"/>`); }
    else s += `<path d="M${MP(-21, a)} L${MP(21, a)} L${MP(hip, 172)} L${MP(hip + (b - 172) * fl, b)} Q100,${b + 6} ${MP(-(hip + (b - 172) * fl), b)} L${MP(-hip, 172)} Z" fill="${GF}" stroke="${GS}" stroke-width="0.6"/>`;
    s += `<path d="M${MP(-22, a)} L${MP(22, a)}" stroke="${GS}" stroke-width="1.2"/>`;
  }
  return s;
}
function markSVG(f, mk, id){
  const t = mk[0], st = `stroke="${HL}" stroke-width="2" fill="none"`, arr = `marker-start="url(#${id}h)" marker-end="url(#${id}h)"`;
  if(t === 'r'){ const y = mk[1], hw = bodyHW(f, y) + 2.5; return `<path d="M${MP(-hw, y)} A${hw},5 0 0 1 ${MP(hw, y)}" ${st} stroke-dasharray="3 2.5" opacity=".7"/><path d="M${MP(-hw, y)} A${hw},5 0 0 0 ${MP(hw, y)}" ${st}/>`; }
  if(t === 'lr'){ const y = mk[1], L = legCX(f, y), cx = 100 + L.c, rx = L.hw + 2.5; return `<path d="M${cx - rx},${y} A${rx},3.5 0 0 1 ${cx + rx},${y}" ${st} stroke-dasharray="3 2.5" opacity=".7"/><path d="M${cx - rx},${y} A${rx},3.5 0 0 0 ${cx + rx},${y}" ${st}/>`; }
  if(t === 'ar'){ const y = mk[1], A = armAt(f, y), cx = 100 + A.c, rx = A.hw + 2; return `<path d="M${cx - rx},${y} A${rx},3 0 0 1 ${cx + rx},${y}" ${st} stroke-dasharray="3 2.5" opacity=".7"/><path d="M${cx - rx},${y} A${rx},3 0 0 0 ${cx + rx},${y}" ${st}/>`; }
  if(t === 'L'){ const [, x, y1, y2] = mk; return `<line x1="${100 + x}" y1="${y1}" x2="${100 + x}" y2="${y2}" ${st} ${arr}/><line x1="${100 + x - 5}" y1="${y2}" x2="${100 + x + 5}" y2="${y2}" stroke="${HL}" stroke-width="1"/>`; }
  if(t === 'Ls'){ const [, y1, y2] = mk, x = 100 + Math.max(bodyHW(f, y1), 31) + 9; return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" ${st} ${arr}/><line x1="${100 + bodyHW(f, y1)}" y1="${y1}" x2="${x + 4}" y2="${y1}" stroke="${HL}" stroke-width="0.8" stroke-dasharray="2 2"/><line x1="${x - 14}" y1="${y2}" x2="${x + 4}" y2="${y2}" stroke="${HL}" stroke-width="0.8" stroke-dasharray="2 2"/>`; }
  if(t === 'S'){ const [, x1, y1, x2, y2] = mk; return `<line x1="${100 + x1}" y1="${y1}" x2="${100 + x2}" y2="${y2}" ${st} ${arr}/>`; }
  if(t === 'dot') return `<circle cx="${100 + mk[1]}" cy="${mk[2]}" r="2.2" fill="${HL}"/>`;
  if(t === 'nk'){ const [, shape, d] = mk; const curve = shape === 'v' ? `M${MP(-9, 47)} L100,${47 + d} L${MP(9, 47)}` : `M${MP(-9, 47)} Q100,${47 + d * 2 - 2} ${MP(9, 47)}`; return `<path d="${curve}" ${st} stroke-width="1.6"/><line x1="100" y1="46" x2="100" y2="${47 + d - 1}" ${st} stroke-width="1.6" ${arr}/>`; }
  if(t === 'aL'){ const yEnd = mk[1], pts = []; for(let y = 62; y <= yEnd; y += 6) pts.push([100 + armAt(f, y).c + armAt(f, y).hw + 3, y]); pts.push([100 + armAt(f, yEnd).c + armAt(f, yEnd).hw + 3, yEnd]); return `<polyline points="${pts.map(p => p.join(',')).join(' ')}" ${st} ${arr}/>`; }
  if(t === 'ah'){ const sh = FIG[f].torso[2][0]; return `<ellipse cx="${100 + sh - 3}" cy="72" rx="7" ry="14" transform="rotate(-12 ${100 + sh - 3} 72)" ${st}/>`; }
  if(t === 'col') return `<path d="M91,40 A9,4 0 0 1 109,40" ${st} stroke-dasharray="3 2.5" opacity=".7"/><path d="M91,40 A9,4 0 0 0 109,40" ${st}/>`;
  return '';
}

/* ---------------- units ---------------- */
const UNITS = {in: 'inches', cm: 'cm'};
function convVal(x, from, to){
  if(x === '' || x == null || from === to) return x;
  const n = parseFloat(String(x).replace(',', '.')); if(isNaN(n)) return x;
  if(to === 'cm') return String(Math.round(n * 2.54 * 2) / 2);
  return String(Math.round(n / 2.54 * 4) / 4);
}
function convertVals(vals, from, to){ const o = {}; Object.entries(vals || {}).forEach(([k, x]) => o[k] = convVal(x, from, to)); return o; }
const unitLabel = u => u === 'cm' ? 'cm' : 'in';

/* ---------------- measurement entry grid (diagram cards in PDF order) ---------------- */
function measGrid(t, vals, path, root, unit, onUnit){
  vals = vals || {};
  if(!(t.charts || []).length) return plainMeasGrid(t, vals, path, root);
  const filled = chartFields(t.charts).filter(f => String(vals[f.k] ?? '').trim()).length, tot = chartFields(t.charts).length;
  return `<div class="row ac" style="margin:4px 0 8px"><span class="muted mcount" style="font-size:12.5px"><b>${filled}</b> of ${tot} entered · in the same order as the ${t.charts.map(c => CHARTS[c].name).join(' + ')} sheet</span><span class="sp"></span>
    <span class="muted" style="font-size:12.5px">Unit</span><div class="useg" role="group" aria-label="Measurement unit">${['in', 'cm'].map(u => `<button type="button" class="${unit === u ? 'on' : ''}" onclick="${onUnit}('${u}')">${UNITS[u]}</button>`).join('')}</div></div>
  ${t.charts.map(ch => { const C2 = CHARTS[ch]; return `<div class="msec-t">${h(C2.name)} measurements</div><div class="mcards">${C2.items.map(it => { const [no, label, o] = it, dn = o.dual ? dualNames(label) : null;
    const ins = o.dual ? [[mKey(ch, no, 'L'), dn[0]], [mKey(ch, no, 'R'), dn[1]]] : [[mKey(ch, no), '']];
    const done = ins.every(([k]) => String(vals[k] ?? '').trim());
    return `<div class="mcard ${done ? 'done' : ''}"><div class="mhead"><span class="mno">${no}</span><span class="mlab">${h(label)}</span></div><div class="msvg">${measSVG(ch, it)}</div><div class="mins">${ins.map(([k, sub]) => `<label class="min">${sub ? `<span class="msub">${h(sub)}</span>` : ''}<span class="mi"><input data-root="${root}" data-p="${path}.${k}" value="${v(vals[k])}" inputmode="decimal" autocomplete="off" aria-label="${h(label)} ${h(sub)}"><span class="mu">${unitLabel(unit)}</span></span></label>`).join('')}</div></div>`; }).join('')}</div>`; }).join('')}`;
}
function plainMeasGrid(t, vals, path, root){
  const secs = [...new Set(t.fields.map(f => f.sec))];
  return secs.map(s => `<div class="msec-t">${h(s)}</div><div class="mgrid">${t.fields.filter(f => f.sec === s).map(f => `<div><label>${h(f.label)}</label><input data-root="${root}" data-p="${path}.${f.k}" value="${v(vals[f.k])}" inputmode="decimal"></div>`).join('')}</div>`).join('');
}
function measView(t, vals, unit){
  vals = vals || {};
  if(!(t.charts || []).length){ const secs = [...new Set(t.fields.map(f => f.sec))]; return secs.map(s => `<div class="msec-t">${h(s)}</div><div class="mgrid">${t.fields.filter(f => f.sec === s).map(f => `<div><span class="muted" style="font-size:12px">${h(f.label)}</span><div><b>${h(vals[f.k] || '—')}</b></div></div>`).join('')}</div>`).join('') + legacyVals(t, vals); }
  return legacyVals(t, vals) + t.charts.map(ch => { const C2 = CHARTS[ch]; return `<div class="msec-t">${h(C2.name)} · ${UNITS[unit || 'in']}</div><div class="mcards">${C2.items.map(it => { const [no, label, o] = it, val = o.dual ? [vals[mKey(ch, no, 'L')], vals[mKey(ch, no, 'R')]] : [vals[mKey(ch, no)]], any = val.some(x => String(x ?? '').trim());
    return `<div class="mcard view ${any ? 'done' : 'empty'}" title="${h(label)}"><div class="mhead"><span class="mno">${no}</span><span class="mlab">${h(label)}</span></div><div class="msvg">${measSVG(ch, it)}</div><div class="mval">${o.dual ? `L <b>${h(val[0] || '—')}</b> · ${dualNames(label)[1] === 'Round' ? 'R' : 'BR'} <b>${h(val[1] || '—')}</b>` : `<b>${h(val[0] || '—')}</b>`} ${any ? unitLabel(unit) : ''}</div></div>`; }).join('')}</div>`; }).join('');
}
function measRows(t, vals){ // [no, name, value] for PDFs, in sheet order
  const out = [];
  (t.charts || []).forEach(ch => { const C2 = CHARTS[ch]; out.push({sec: C2.name}); C2.items.forEach(([no, label, o]) => { const val = o.dual ? `L ${vals[mKey(ch, no, 'L')] || '____'}  /  ${dualNames(label)[1] === 'Round' ? 'R' : 'BR'} ${vals[mKey(ch, no, 'R')] || '____'}` : (vals[mKey(ch, no)] || ''); out.push([String(no), label, val]); }); });
  return out;
}
/* sample measurements for demo data (inches, a medium size; d shifts the size) */
const SAMPLE = {
  blouse: [34, 33, 29, 31, 10, 13, 15, 14, 19, 18, 7, 8.5, 9, 4.5, 13, 14, 4.75, [3, 12], [6, 11.5], [11, 10.5], [15, 10], [22, 9], 11.5, 16],
  top: [34, 33, 30, 32, 38, 10, 15, 24, 28, 38, 42, 44, 46, 50, 56, 4.5, 13, 14, 4.75, [6, 11.5], [11, 10.5], [15, 10], 22, 11.5, 16],
  bottom: [30, 38, 39, [22, 15], 13, 12, 22, [38, 14], 40, 30, 39, 38, 18, 40, 41, 40, 22, 30, 38, 41],
  mens: [40, 34, 36, 40, 30, 42, 28, 34, 29, 32, 42, 18, 25, 9, 13, 15.5, 18, 34, 40, 41, 24, 16, 15, 15, 24]};
function sampleVals(charts, d){
  const o = {}; d = d || 0; const q = x => String(Math.round(x * 4) / 4);
  (charts || []).forEach(ch => CHARTS[ch].items.forEach(([no, label, it], i) => { const s = SAMPLE[ch][i], rnd = /Round|Waist|Hips|Thigh|Thigs|Collar|Armhole/i.test(label);
    if(Array.isArray(s)){ o[mKey(ch, no, 'L')] = q(s[0] + d * 0.5); o[mKey(ch, no, 'R')] = q(s[1] + d * 0.75); } else o[mKey(ch, no)] = q(s + d * (rnd ? 2 : 0.5)); }));
  return o;
}

/* ---------------- family members (CRM) ---------------- */
const RELATIONS = ['Self', 'Wife', 'Husband', 'Daughter', 'Son', 'Mother', 'Father', 'Sister', 'Brother', 'Daughter-in-law', 'Son-in-law', 'Mother-in-law', 'Father-in-law', 'Granddaughter', 'Grandson', 'Niece', 'Nephew', 'Friend', 'Other'];
const GENDERS = [['F', 'Female'], ['M', 'Male'], ['O', 'Other']];
const defUnit = () => /cm/i.test(ST().unit || '') ? 'cm' : 'in';
function members(c){
  if(!c) return [];
  if(!Array.isArray(c.members) || !c.members.length) c.members = [{id: uid('m'), name: c.name || '', relation: 'Self', gender: '', dob: '', phone: c.phone || '', notes: '', primary: true}];
  return c.members;
}
const primaryMember = c => members(c).find(m => m.primary) || members(c)[0];
function member(cid, mid){ return members(cust(cid)).find(m => m.id === mid); }
function ageOf(dob){ if(!dob) return ''; const d = new Date(dob), n = new Date(); if(isNaN(d)) return ''; let a = n.getFullYear() - d.getFullYear(); if(n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) a--; return a >= 0 ? a : ''; }
const memName = (m, c) => m ? (m.primary && c ? c.name : m.name) : '';
function memLabel(cid, mid, short){ const c = cust(cid), m = member(cid, mid); if(!m) return ''; const a = ageOf(m.dob); return short ? `${memName(m, c)} (${m.relation})` : `${memName(m, c)} · ${m.relation}${a !== '' ? ' · ' + a + ' yrs' : ''}`; }
const memChip = (cid, mid) => mid && member(cid, mid) ? `<span class="mem-chip" title="Family member">👤 ${h(memLabel(cid, mid, true))}</span>` : '';
function articleOptions(sel){
  const T = coll('templates'), cats = [...new Set(T.map(t => t.category || 'Other'))].sort((a, b) => (a === 'Women' ? 0 : a === 'Men' ? 1 : 2) - (b === 'Women' ? 0 : b === 'Men' ? 1 : 2));
  return cats.map(c => `<optgroup label="${h(c)}">${T.filter(t => (t.category || 'Other') === c).map(t => opt(t.id, t.name + ((t.charts || []).length ? ` · ${t.charts.map(x => CHARTS[x].name).join(' + ')} sheet` : ''), sel)).join('')}</optgroup>`).join('');
}
function legacyVals(t, vals){ const keys = new Set((t.fields || []).map(f => f.k)), L = Object.entries(vals || {}).filter(([k, x]) => !keys.has(k) && String(x ?? '').trim()); return L.length ? `<details style="margin-top:8px"><summary class="muted">Earlier measurements in the old format (${L.length})</summary><div>${L.map(([k, x]) => `<span class="chip c-mut">${h(k.replace(/_/g, ' '))}: ${h(x)}</span>`).join(' ')}</div></details>` : ''; }
/* fast entry: Enter jumps to the next measurement; card turns green when filled */
document.addEventListener('keydown', e => { if(e.key !== 'Enter' || !e.target.closest || !e.target.closest('.min')) return; e.preventDefault(); const all = [...document.querySelectorAll('.min input')], i = all.indexOf(e.target); if(all[i + 1]){ all[i + 1].focus(); all[i + 1].select(); all[i + 1].closest('.mcard')?.scrollIntoView({block: 'nearest', behavior: 'smooth'}); } });
document.addEventListener('input', e => { const card = e.target.closest && e.target.closest('.mcard'); if(!card) return; card.classList.toggle('done', [...card.querySelectorAll('input')].every(x => x.value.trim()));
  const box = card.parentElement.closest('.mblock, .mbox, .card'), cnt = box && box.querySelector('.mcount b'); if(cnt) cnt.textContent = [...box.querySelectorAll('.min input')].filter(x => x.value.trim()).length; });
