/* =====================================================================
   seed.js : default masters (garment types, workflows, stages, QC,
             billing heads, messages) and demo data
   ===================================================================== */
function F(sec, list){ return list.split(',').map(l => ({k: slug(sec + '_' + l), label: l.trim(), sec})); }
function SP(list){ return list.map(([label, options]) => ({k: slug(label), label, options: options ? options.split('|') : []})); }
function C(rows){ return rows.map(([name, category, unit, qty, rate, source]) => ({id: uid('c'), name, category, unit, qty, rate, source: source || 'studio', itemId: ''})); }
function W(stageId, label, seq, o){ return Object.assign({stageId, label, seq, optional: false, pricing: 'unit', units: 1, rate: 0, cplx: 'Simple', hours: 1, tat: 0, charge: 0, out: false}, o || {}); }

const INVOICE_HEADS = [{id: 'basic_stitching', name: 'Basic Stitching'}, {id: 'patterning', name: 'Patterning Charge'}, {id: 'work', name: 'Work Charges'}, {id: 'hangings', name: 'Hangings'}, {id: 'fabric', name: 'Fabric Cost'}, {id: 'dyeing', name: 'Dyeing Charges'}, {id: 'alterations', name: 'Alterations'}, {id: 'saree_fall', name: 'Saree Fall & Picco'}, {id: 'tassels', name: "Tassel's"}, {id: 'steam_press', name: 'Steam Press'}, {id: 'drywash', name: 'Drywash'}, {id: 'other', name: 'Others'}];
const OLD_HEAD = {stitching: 'basic_stitching', embroidery: 'work', lining: 'fabric', padding: 'basic_stitching', saree_finishing: 'saree_fall', accessories: 'basic_stitching', design_change: 'work'};
function defaultSettings(){
  return {
    shop: 'Tasmia Designers', tagline: 'Crafted with care, worn with love', address: 'Pune, Maharashtra', phone: '9156011330', landline: '', email: 'tasmiadesigners07@gmail.com', website: '', gstin: '', pan: '', upiId: '', bank: '', logo: '', sac: '998821',
    gstPct: 0, taxMode: 'intra', markupPct: 40, terms: 'Alterations within 7 days of delivery are free. Advance is non-refundable once cutting has started. Garments not collected within 30 days of the ready date are not the studio\'s responsibility.',
    orderPrefix: 'TD-', invPrefix: 'INV-', rcptPrefix: 'RCPT-', unit: 'inches',
    weeklyOff: [0], holidays: '',
    lead: {prep: 14, embroidery: 10, stitching: 6, finishing: 5, trial: 4, alteration: 2, qc: 1},
    warnDays: 2, overloadDays: 6, overrunPct: 25,
    adminName: 'Owner', adminPhone: '', adminEmail: '',
    heads: INVOICE_HEADS.map(x => ({...x})),
    categories: [{id: 'fabric', name: 'Fabric', head: 'fabric'}, {id: 'lining', name: 'Lining', head: 'fabric'}, {id: 'padding', name: 'Padding & cups', head: 'basic_stitching'}, {id: 'accessories', name: 'Hooks, buttons, zips & trims', head: 'basic_stitching'}, {id: 'hangings', name: 'Latkans & hangings', head: 'hangings'}, {id: 'tassels', name: 'Tassels', head: 'tassels'}, {id: 'emb_material', name: 'Embroidery material', head: 'work'}, {id: 'thread', name: 'Thread', head: 'basic_stitching'}, {id: 'other', name: 'Other', head: 'other'}],
    invoiceFooter: 'Thank you for choosing Tasmia Designers!', invoiceNote: 'Please check your garments at the time of collection.',
    embStyles: ['Zardosi', 'Aari', 'Resham', 'Mirror work', 'Cutdana', 'Sequins', 'Gota patti', 'Thread work', 'Machine embroidery', 'Tailoring detail'],
    qcChecklist: [
      {sec: 'Stitching', items: ['Seams straight, even and pressed open', 'No loose threads or skipped stitches', 'Thread colour and tension match', 'Lining attached neatly, no pulling']},
      {sec: 'Embroidery', items: ['Matches the approved design version', 'Placement as per khaka / reference', 'No missing or loose zari, beads or sequins', 'Backing finished and soft against skin']},
      {sec: 'Measurements', items: ['Bust / chest verified against sheet', 'Waist and hip verified', 'Length and sleeve verified', 'Fit corrections from trial applied']},
      {sec: 'Finishing', items: ['Hooks, buttons and zips secure and working', 'Hems and edges finished', 'Latkans, tassels and trims attached', 'Steam pressed, no shine marks']},
      {sec: 'Overall condition', items: ['No stains, marks or damage', 'Colour matches approved shade', 'All pieces present (dupatta, belt, extras)']}],
    perms: defaultPerms(),
    users: [
      {id: 'u_owner', name: 'Owner', role: 'owner', pin: '1111', workerId: '', active: true},
      {id: 'u_seema', name: 'Seema (front desk)', role: 'manager', pin: '2222', workerId: '', active: true},
      {id: 'u_ramesh', name: 'Ramesh (master)', role: 'master', pin: '3333', workerId: 'w_ramesh', active: true},
      {id: 'u_farid', name: 'Farid (artisan)', role: 'artisan', pin: '4444', workerId: 'w_farid', active: true},
      {id: 'u_kavita', name: 'Kavita (accounts)', role: 'accounts', pin: '5555', workerId: '', active: true}],
    demoPins: true, lastBackup: ''
  };
}
function defaultStages(){
  return [
    {id: 'dye', name: 'Dyeing', kind: 'external', group: 'prep', head: 'dyeing', rate: 0, color: '#6d8fb3'},
    {id: 'cut', name: 'Cutting', kind: 'work', group: 'prep', head: 'patterning', rate: 150, color: '#b07d3a'},
    {id: 'emb', name: 'Embroidery', kind: 'work', group: 'embroidery', head: 'work', rate: 180, color: '#8e3b6c'},
    {id: 'hand', name: 'Handwork (moti, tassels, latkans)', kind: 'work', group: 'embroidery', head: 'hangings', rate: 150, color: '#a5527f'},
    {id: 'stitch', name: 'Stitching', kind: 'work', group: 'stitching', head: 'basic_stitching', rate: 120, color: '#7a2948'},
    {id: 'hem', name: 'Outside hemming / fall & pico', kind: 'external', group: 'finishing', head: 'saree_fall', rate: 0, color: '#5a86a8'},
    {id: 'finish', name: 'Finishing (hooks, kaaj, buttons)', kind: 'work', group: 'finishing', head: 'basic_stitching', rate: 100, color: '#9a6a52'},
    {id: 'trial', name: 'Trial / fitting', kind: 'trial', group: 'trial', head: 'basic_stitching', rate: 0, color: '#2f7d6d'},
    {id: 'alter', name: 'Alteration', kind: 'work', group: 'alteration', head: 'alterations', rate: 120, color: '#c2671a'},
    {id: 'press', name: 'Steam press', kind: 'work', group: 'finishing', head: 'steam_press', rate: 80, color: '#8d7b6a'},
    {id: 'drywash', name: 'Dry wash', kind: 'external', group: 'finishing', head: 'drywash', rate: 0, color: '#6a8d8a'},
    {id: 'qc', name: 'Quality check', kind: 'qc', group: 'qc', head: 'basic_stitching', rate: 0, color: '#2e7d4f'}];
}
function defaultTemplates(){
  return [
    {id: 't_blouse', name: 'Blouse', category: 'Women', charts: ['blouse'], fields: chartFields(['blouse']),
      specs: SP([['Front neck', 'Round|U|V|Sweetheart|Square|Boat|High neck|Collar'], ['Back neck', 'Deep U|Deep V|Round|Square|Keyhole|Dori back|Boat'], ['Sleeve style', 'Sleeveless|Cap|Short|Elbow|3/4|Full|Puff|Bell'], ['Opening', 'Front hooks|Back hooks|Side zip|Back zip'], ['Padding', 'Padded|Non-padded|Cups only'], ['Lining', 'Full|Half|None'], ['Dori / latkan', 'Yes|No']]),
      components: C([['Blouse fabric', 'fabric', 'm', 1, 650], ['Cotton lining', 'lining', 'm', 1, 120], ['Blouse cups', 'padding', 'pair', 1, 90], ['Hooks', 'accessories', 'set', 1, 30], ['Latkans', 'hangings', 'pair', 1, 120], ['Thread', 'thread', 'spool', 1, 40]]),
      workflow: [W('cut', 'Whole blouse', 1, {units: 1, rate: 200, hours: 1}), W('emb', 'Neck & sleeve embroidery', 2, {pricing: 'hour', rate: 180, cplx: 'Medium', hours: 6}), W('stitch', 'Blouse assembly', 3, {rate: 650, hours: 4}), W('finish', 'Hooks, dori & latkans', 4, {rate: 150, hours: 1}), W('trial', 'Fitting trial', 5, {hours: 0.5, optional: true}), W('qc', 'Final QC', 6, {hours: 0.5})]},
    {id: 't_top', name: 'Top / Kurti', category: 'Women', charts: ['top'], fields: chartFields(['top']),
      specs: SP([['Style', 'Straight|A-line|Anarkali|Peplum|Crop|Tunic|Kaftan|One piece'], ['Length', "Jean's top|Short top|Knee|Salwar's top|Pant's top|Calf|Long top|One piece"], ['Neck', 'Round|U|V|Boat|Collar|Mandarin|Sweetheart|Square'], ['Sleeve style', 'Sleeveless|Short|Elbow|3/4|Full|Bell|Puff'], ['Slit', 'Side|Front|None'], ['Lining', 'Full|Half|None']]),
      components: C([['Top fabric', 'fabric', 'm', 2.5, 450], ['Lining', 'lining', 'm', 1.5, 120], ['Buttons / hooks', 'accessories', 'set', 1, 40], ['Thread', 'thread', 'spool', 1, 40]]),
      workflow: [W('cut', 'Top', 1, {rate: 200, hours: 1}), W('emb', 'Neckline / yoke embroidery', 2, {pricing: 'hour', rate: 180, cplx: 'Simple', hours: 3, optional: true}), W('stitch', 'Top', 3, {rate: 500, hours: 3}), W('finish', 'Finishing', 4, {rate: 80, hours: 0.75}), W('trial', 'Fitting trial', 5, {hours: 0.5, optional: true}), W('qc', 'Final QC', 6, {hours: 0.5})]},
    {id: 't_bottom', name: 'Bottom wear (salwar, palazzo, pant, skirt…)', category: 'Women', charts: ['bottom'], fields: chartFields(['bottom']),
      specs: SP([['Style', 'Salwar|Churidar|Palazzo|Straight pant|Capri|Pyjama|Long skirt|Short skirt|Garara|Lehenga skirt|Petticoat|Dhoti'], ['Waist', 'Elastic|Drawstring|Zip & hook|Elastic + drawstring'], ['Pockets', 'Yes|No'], ['Bottom finish', 'Plain|Lace|Piping|Embroidered border']]),
      components: C([['Bottom fabric', 'fabric', 'm', 2.5, 300], ['Elastic / drawstring', 'accessories', 'set', 1, 30], ['Thread', 'thread', 'spool', 1, 40]]),
      workflow: [W('cut', 'Bottom', 1, {rate: 120, hours: 0.75}), W('stitch', 'Bottom', 2, {rate: 300, hours: 2}), W('finish', 'Waist & hem finishing', 3, {rate: 60, hours: 0.5}), W('qc', 'Final QC', 4, {hours: 0.25})]},
    {id: 't_suit_w', name: 'Salwar Suit / Kurta Set (top + bottom)', category: 'Women', charts: ['top', 'bottom'], fields: chartFields(['top', 'bottom']),
      specs: SP([['Kurta style', 'Straight|A-line|Anarkali|Kaftan|Angrakha'], ['Neck', 'Round|V|Boat|Collar|Mandarin|Sweetheart'], ['Sleeve style', 'Sleeveless|Short|Elbow|3/4|Full|Bell'], ['Bottom style', 'Salwar|Churidar|Palazzo|Straight pants|Dhoti'], ['Slit', 'Side|Front|None'], ['Dupatta finishing', 'Lace|Tassels|Fall & pico|None']]),
      components: C([['Kurta fabric', 'fabric', 'm', 2.75, 450], ['Bottom fabric', 'fabric', 'm', 2.5, 250], ['Lining', 'lining', 'm', 2, 120], ['Gota lace', 'accessories', 'm', 4, 45], ['Buttons / hooks', 'accessories', 'set', 1, 40], ['Thread', 'thread', 'spool', 2, 40]]),
      workflow: [W('dye', 'Dupatta dyeing', 1, {optional: true, out: true, tat: 3, charge: 350}), W('cut', 'Kurta & bottom', 2, {rate: 250, hours: 1.5}), W('emb', 'Neckline embroidery', 3, {pricing: 'hour', rate: 180, cplx: 'Simple', hours: 4}), W('stitch', 'Kurta', 4, {rate: 550, hours: 3.5}), W('stitch', 'Bottom', 4, {rate: 250, hours: 1.5}), W('hem', 'Dupatta pico & finishing', 5, {optional: true, out: true, tat: 2, charge: 120}), W('finish', 'Finishing', 6, {rate: 100, hours: 1}), W('trial', 'Fitting trial', 7, {hours: 0.5, optional: true}), W('qc', 'Final QC', 8, {hours: 0.5})]},
    {id: 't_lehenga', name: 'Bridal Lehenga Choli (blouse + lehenga)', category: 'Women', charts: ['blouse', 'bottom'], fields: chartFields(['blouse', 'bottom']),
      specs: SP([['Kalis / panels', '8|12|16|24|Circular'], ['Can-can layers', 'None|1|2|3'], ['Waist closure', 'Side zip|Drawstring + hooks|Back zip'], ['Choli back', 'Deep U|Dori back|Keyhole|Closed'], ['Dupatta border', 'Scalloped|Gota|Zari lace|Tassels'], ['Lining colour', '']]),
      components: C([['Lehenga fabric (raw silk)', 'fabric', 'm', 6, 900], ['Choli fabric', 'fabric', 'm', 1, 700], ['Dupatta net', 'fabric', 'm', 2.5, 400], ['Lining', 'lining', 'm', 4, 140], ['Can-can', 'padding', 'm', 3, 150], ['Blouse cups', 'padding', 'pair', 1, 90], ['Zari thread', 'emb_material', 'spool', 6, 180], ['Dabka & nakshi', 'emb_material', 'pack', 2, 260], ['Latkans', 'hangings', 'pair', 2, 120], ['Invisible zip', 'accessories', 'pc', 1, 40], ['Hooks', 'accessories', 'set', 1, 30]]),
      workflow: [W('dye', 'Fabric dyeing (shade match)', 1, {out: true, tat: 3, charge: 900}), W('cut', 'Lehenga, choli & dupatta', 2, {rate: 600, hours: 3}), W('emb', 'Section: lehenga ghera', 3, {pricing: 'hour', rate: 200, cplx: 'Heavy', hours: 24}), W('emb', 'Section: choli front & sleeves', 3, {pricing: 'hour', rate: 180, cplx: 'Medium', hours: 8}), W('emb', 'Section: dupatta border', 3, {pricing: 'hour', rate: 180, cplx: 'Medium', hours: 6}), W('hand', 'Latkans & tassels', 4, {rate: 400, hours: 3, optional: true}), W('stitch', 'Lehenga panels & can-can', 5, {rate: 1500, hours: 8}), W('stitch', 'Choli', 5, {rate: 700, hours: 4}), W('hem', 'Dupatta edge finishing', 6, {out: true, tat: 2, charge: 250, optional: true}), W('finish', 'Finishing', 7, {rate: 300, hours: 2}), W('trial', 'Bridal trial', 8, {hours: 1}), W('qc', 'Final QC', 9, {hours: 1})]},
    {id: 't_kurta_m', name: 'Kurta (Men)', category: 'Men', charts: ['mens'], fields: chartFields(['mens']),
      specs: SP([['Collar', 'Mandarin|Band|Classic|Round'], ['Placket', 'Hidden|Button|Contrast'], ['Fit', 'Slim|Regular|Relaxed'], ['Side pockets', 'Yes|No']]),
      components: C([['Kurta fabric', 'fabric', 'm', 2.75, 450], ['Buttons', 'accessories', 'pc', 6, 12], ['Thread', 'thread', 'spool', 1, 40]]),
      workflow: [W('cut', 'Kurta', 1, {rate: 200, hours: 1}), W('emb', 'Neckline thread work', 2, {pricing: 'hour', rate: 180, hours: 3, optional: true}), W('stitch', 'Kurta', 3, {rate: 550, hours: 3.5}), W('finish', 'Buttons & kaaj', 4, {rate: 80, hours: 0.75}), W('qc', 'Final QC', 5, {hours: 0.5})]},
    {id: 't_trouser', name: 'Trouser (Men)', category: 'Men', charts: ['mens'], fields: chartFields(['mens']),
      specs: SP([['Fit', 'Slim|Regular|Relaxed'], ['Pleats', 'Flat front|Single|Double'], ['Pockets', 'Side + back|Side only|Cargo'], ['Belt loops', 'Yes|No|Side adjusters'], ['Bottom finish', 'Plain|Turn-up|Chinese']]),
      components: C([['Trouser fabric', 'fabric', 'm', 1.3, 600], ['Pocketing', 'lining', 'm', 0.3, 80], ['Zip', 'accessories', 'pc', 1, 35], ['Waistband curtain', 'accessories', 'pc', 1, 60], ['Thread', 'thread', 'spool', 1, 40]]),
      workflow: [W('cut', 'Trouser', 1, {rate: 150, hours: 1}), W('stitch', 'Trouser', 2, {rate: 450, hours: 3}), W('finish', 'Hem & buttons', 3, {rate: 60, hours: 0.5}), W('qc', 'Final QC', 4, {hours: 0.25})]},
    {id: 't_suit_m', name: "Men's Suit / Sherwani", category: 'Men', charts: ['mens'], fields: chartFields(['mens']),
      specs: SP([['Lapel', 'Notch|Peak|Shawl'], ['Buttons', '1|2|3|Double-breasted'], ['Vents', 'None|Single|Double'], ['Shoulder', 'Natural|Structured|Roped'], ['Lining colour', ''], ['Trouser front', 'Flat|Single pleat|Double pleat']]),
      components: C([['Suiting fabric', 'fabric', 'm', 3.5, 1200], ['Lining', 'lining', 'm', 2, 220], ['Canvas & fusing', 'padding', 'm', 0.8, 300], ['Shoulder pads', 'padding', 'pair', 1, 150], ['Buttons (horn)', 'accessories', 'pc', 8, 25], ['Trouser zip', 'accessories', 'pc', 1, 35], ['Thread', 'thread', 'spool', 3, 40]]),
      workflow: [W('cut', 'Jacket & trouser', 1, {rate: 450, hours: 2.5}), W('stitch', 'Jacket construction', 2, {rate: 1800, hours: 12}), W('stitch', 'Trouser', 2, {rate: 650, hours: 4}), W('trial', 'Basted trial', 3, {hours: 0.5}), W('finish', 'Buttons, kaaj & hand finishing', 4, {rate: 300, hours: 2}), W('qc', 'Final QC', 5, {hours: 0.5})]},
    {id: 't_saree', name: 'Saree finishing', category: 'Women',
      fields: F('Saree', 'Length,Fall length'),
      specs: SP([['Finishing', 'Fall & pico|Pico only|Tassels on pallu|Pre-pleating'], ['Pallu tassels', 'Yes|No']]),
      components: C([['Saree fall', 'accessories', 'pc', 1, 60], ['Tassels', 'tassels', 'set', 1, 150, 'studio']]),
      workflow: [W('hem', 'Fall & pico', 1, {out: true, tat: 2, charge: 120}), W('hand', 'Pallu tassels', 2, {optional: true, rate: 200, hours: 1.5, head: 'tassels'}), W('qc', 'Final QC', 3, {hours: 0.25})]}
  ];
}
function defaultMsgTemplates(){
  const M = (id, name, event, channel, auto, body) => ({id, name, event, channel, auto, active: true, body});
  return [
    M('m_conf', 'Order confirmation', 'order_created', 'whatsapp', true, 'Namaste {customer_first}! 🙏\nThank you for choosing {shop_name}. Your order {order_no} is confirmed:\n{garment_list}\nOrder value: ₹{total} · Paid: ₹{paid} · Balance: ₹{balance}\nFor any change, call us on {shop_mobile}.'),
    M('m_conf_sms', 'Order confirmation (SMS)', 'order_created', 'sms', false, '{shop_name}: Order {order_no} confirmed. First delivery {delivery_date}. Balance Rs {balance}. Call {shop_mobile}'),
    M('m_trial', 'Trial reminder', 'trial', 'whatsapp', true, 'Hi {customer_first}, your trial for {garment} (order {order_no}) is on {trial_date}. Please visit {shop_name}, {shop_address}. Call {shop_mobile} to reschedule.'),
    M('m_delay', 'Delay notice', 'delay', 'whatsapp', false, 'Dear {customer_first}, we are giving your {garment} (order {order_no}) a little extra care. The revised date is {expected_date}. We regret the inconvenience. – {shop_name}'),
    M('m_status', 'Delivery update', 'update', 'whatsapp', false, 'Hi {customer_first}, update on order {order_no}:\n{garment_status}\n– {shop_name}'),
    M('m_ready', 'Ready for pickup', 'ready', 'whatsapp', true, 'Good news, {customer_first}! ✨ Your {garment} (order {order_no}) is ready for pickup at {shop_name}.\nBalance due: ₹{balance} (UPI: {upi_id}).'),
    M('m_deliv', 'Thank you after delivery', 'delivered', 'whatsapp', true, 'Thank you {customer_first} for collecting {garment} (order {order_no}). We hope you love it! Free alterations within 7 days. 💐\n{shop_name} {shop_website}'),
    M('m_pay', 'Payment received', 'payment', 'whatsapp', true, 'Dear {customer_first}, we have received ₹{amount} for order {order_no} (receipt {receipt_no}). Balance: ₹{balance}. Thank you! – {shop_name}'),
    M('m_payrem', 'Payment reminder', 'payment_reminder', 'whatsapp', false, 'Dear {customer_first}, a gentle reminder that ₹{balance} is pending for order {order_no}. UPI: {upi_id}. Thank you! – {shop_name}'),
    M('m_payrem_sms', 'Payment reminder (SMS)', 'payment_reminder', 'sms', false, '{shop_name}: Rs {balance} pending for order {order_no}. UPI {upi_id}. Call {shop_mobile}'),
    M('m_fest', 'Festive greeting', 'general', 'whatsapp', false, 'Warm festive wishes from {shop_name}, {customer_first}! 🪔 Our new collection is in — call {shop_mobile} to book a fitting.'),
    M('m_admin', 'Alert to owner', 'admin_alert', 'whatsapp', false, '⚠ {shop_name} production alert\n{alert_title}\n{alert_detail}')];
}

/* ---------------- demo artwork (generated SVG) ---------------- */
const DEMO_CACHE = {};
const svgURL = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
const PAISLEY = 'M0,-38 C26,-38 38,-6 24,22 C12,44 -20,46 -26,20 C-31,0 -14,-12 -2,-10 C8,-8 10,6 2,10';
function motif(kind, st, fill, sw){
  if(kind === 'paisley') return `<path d="${PAISLEY}" fill="${fill}" stroke="${st}" stroke-width="${sw}"/><circle cx="-6" cy="16" r="5" fill="none" stroke="${st}" stroke-width="${sw}"/>`;
  if(kind === 'floral') return Array.from({length: 8}, (_, i) => `<ellipse cx="0" cy="-18" rx="7" ry="16" transform="rotate(${i * 45})" fill="${fill}" stroke="${st}" stroke-width="${sw}"/>`).join('') + `<circle r="7" fill="${st}"/>`;
  return `<path d="M0,-42 L30,0 L0,42 L-30,0 Z" fill="none" stroke="${st}" stroke-width="${sw}"/>` + Array.from({length: 6}, (_, i) => `<ellipse cx="0" cy="-11" rx="4.5" ry="11" transform="rotate(${i * 60})" fill="${fill}" stroke="${st}" stroke-width="${sw}"/>`).join('') + `<circle r="3.5" fill="${st}"/>`;
}
function tile(kind, st, fill, sw, cols, rows, Wd, Hd, off){
  let s = ''; const dx = Wd / cols, dy = Hd / rows, sc = (Math.min(dx, dy) / 100).toFixed(3), o = (off || 0) % dx;
  for(let r = 0; r < rows; r++) for(let c = -2; c <= cols + 1; c++){ const x = (c + 0.5 + (r % 2 ? 0.5 : 0)) * dx + o, y = (r + 0.5) * dy; s += `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${sc})">${motif(kind, st, fill, sw)}</g>`; }
  return s;
}
const DEMO_COL = {jaal: ['#bfe3d0', '#b8892e', '#e9d9a6'], paisley: ['#7a2333', '#d4af37', '#a8424f'], floral: ['#f2c9cf', '#b8892e', '#fff4e8'], lapel: ['#1f2a44', '#c9ced8', '#6e1f33']};
function blouseSketch(){ return `<path d="M190,90 Q300,150 410,90 L470,140 L440,210 L410,190 L405,380 Q300,400 195,380 L190,190 L160,210 L130,140 Z" fill="none" stroke="#2b2226" stroke-width="3"/><path d="M240,92 Q300,200 360,92" fill="none" stroke="#2b2226" stroke-width="2.4"/><path d="M200,330 Q300,350 400,330" fill="none" stroke="#2b2226" stroke-width="1.6" stroke-dasharray="6 4"/><text x="420" y="120" font-family="sans-serif" font-size="14" fill="#7a2948">elbow sleeve</text><text x="320" y="170" font-family="sans-serif" font-size="14" fill="#7a2948">U neck 6.5"</text>`; }
function lapelSvg(stencil){
  const st = stencil ? 'stroke="#2b2226" stroke-width="2.4" stroke-dasharray="6 4" fill="none"' : '';
  const body = 'M200,70 L262,48 L300,130 L338,48 L400,70 L452,130 L440,420 L160,420 L148,130 Z';
  if(stencil) return `<path d="${body}" ${st}/><path d="M262,48 L246,150 L214,138 L300,300 Z" ${st}/><path d="M338,48 L354,150 L386,138 L300,300 Z" ${st}/><circle cx="300" cy="335" r="7" ${st}/><circle cx="300" cy="375" r="7" ${st}/>`;
  return `<path d="${body}" fill="#1f2a44"/><path d="M262,48 L300,130 L338,48 L300,300 Z" fill="#6e1f33"/><path d="M262,48 L246,150 L214,138 L300,300 Z" fill="#2c3a5c"/><path d="M338,48 L354,150 L386,138 L300,300 Z" fill="#2c3a5c"/><circle cx="300" cy="335" r="8" fill="#5b4632"/><circle cx="300" cy="375" r="8" fill="#5b4632"/>`;
}
function demoSvg(id){
  if(DEMO_CACHE[id]) return DEMO_CACHE[id];
  const p = id.split(':'), what = p[1], kind = p[2], [bg, gold, soft] = DEMO_COL[kind] || DEMO_COL.jaal;
  let svg;
  if(what === 'stencil' || what === 'khaka') svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450"><rect width="600" height="450" fill="#fdfcf8"/>${kind === 'lapel' ? lapelSvg(true) : `<g stroke-dasharray="4 3">${tile(kind, '#2b2226', 'none', 2.4, 4, 3, 600, 450)}</g>`}<text x="16" y="436" font-family="monospace" font-size="13" fill="#7d7074">KHAKA / TRACING · ${kind.toUpperCase()} · demo artwork</text></svg>`;
  else if(what === 'sketch') svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450"><rect width="600" height="450" fill="#fffdf8"/>${kind === 'lapel' ? lapelSvg(true) : blouseSketch()}<text x="16" y="436" font-family="sans-serif" font-size="13" fill="#7d7074">Design sketch · demo artwork</text></svg>`;
  else if(what === 'fabric') svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450"><defs><pattern id="w" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0,5 L5,0" stroke="#000" stroke-opacity=".07"/></pattern><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient></defs><rect width="600" height="450" fill="${bg}"/><rect width="600" height="450" fill="url(#w)"/><path d="M0,300 Q150,250 300,320 T600,300 L600,450 L0,450Z" fill="#000" opacity=".06"/><rect width="600" height="450" fill="url(#g)"/><text x="16" y="436" font-family="sans-serif" font-size="13" fill="#2b2226" fill-opacity=".7">Fabric swatch · demo artwork</text></svg>`;
  else if(what === 'sample') svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450"><defs><radialGradient id="l" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></radialGradient></defs><rect width="600" height="450" fill="${kind === 'lapel' ? '#e9e4da' : bg}"/>${kind === 'lapel' ? lapelSvg(false) : tile(kind, gold, soft, 2.2, 4, 3, 600, 450)}<rect width="600" height="450" fill="url(#l)"/><text x="16" y="436" font-family="sans-serif" font-size="13" fill="#fff" fill-opacity=".85">Garment photo · demo artwork</text></svg>`;
  else { const i = +p[3], n = +p[4] || 24, a = i / n * Math.PI * 2, off = i / n * 150, fx = 300 + Math.sin(a) * 70, fo = Math.max(0, Math.cos(a));
    const sil = 'M250,70 Q300,56 350,70 L360,170 Q300,184 240,170 Z M245,186 Q300,176 355,186 L470,430 Q300,460 130,430 Z';
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 480"><defs><clipPath id="c"><path d="${sil}"/></clipPath><linearGradient id="s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient></defs><rect width="600" height="480" fill="#f4eef0"/><ellipse cx="300" cy="455" rx="120" ry="14" fill="#2b1a22" opacity=".15"/><g clip-path="url(#c)"><rect width="600" height="480" fill="${bg}"/>${tile(kind, gold, soft, 2.2, 4, 4, 600, 480, off)}<rect x="120" width="360" height="480" fill="url(#s)"/><circle cx="${fx.toFixed(1)}" cy="110" r="9" fill="${gold}" opacity="${fo.toFixed(2)}"/></g><text x="16" y="470" font-family="sans-serif" font-size="12" fill="#7d7074">360° demo frame ${i + 1}/${n}</text></svg>`; }
  return DEMO_CACHE[id] = svgURL(svg);
}
function demoLogo(){ return svgURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><rect width="200" height="120" rx="14" fill="#7a2948"/><text x="100" y="72" text-anchor="middle" font-family="Georgia,serif" font-size="46" fill="#f3dca2" letter-spacing="4">TD</text><text x="100" y="98" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#fff" letter-spacing="3">PLACEHOLDER LOGO</text></svg>`); }
function demoDesigns(){
  const D = (id, name, code, tplId, style, tags, description, kind, spinN, addComps, addTasks) => ({id, name, code, tplId, style, tags, description, samples: [`demo:sample:${kind}`], sketches: [`demo:sketch:${kind}`], stencils: [`demo:khaka:${kind}`], renders: [], spin: spinN ? Array.from({length: spinN}, (_, i) => `demo:spin:${kind}:${i}:${spinN}`) : [], model: '', cover: '', addComps: C(addComps), addTasks, active: true, created: nowISO(), history: []});
  return [
    D('d_jaal', 'Mughal Jaal Zardosi', 'DSN-101', 't_lehenga', 'Zardosi', 'bridal, all-over, heavy', 'All-over diamond jaal with six-petal florets in antique gold zardosi. Heavier on the ghera, tapering towards the waist.', 'jaal', 24, [['Extra zari (antique gold)', 'emb_material', 'spool', 4, 180]], [W('emb', 'Jaal tracing & framing', 3, {pricing: 'fixed', rate: 600, hours: 2})]),
    D('d_paisley', 'Paisley Butta Neckline', 'DSN-102', 't_suit_w', 'Resham', 'festive, neckline', 'Classic paisley buttis in gold resham around the neckline and placket, scattered buttis on the body.', 'paisley', 24, [['Resham thread (gold)', 'emb_material', 'spool', 2, 90]], [W('emb', 'Scattered butti work', 3, {pricing: 'hour', rate: 180, cplx: 'Medium', hours: 3})]),
    D('d_floral', 'Floral Aari Back', 'DSN-103', 't_blouse', 'Aari', 'back design, floral', 'Eight-petal florals in aari for a deep-back blouse, with a finished gold centre.', 'floral', 0, [['Aari beads & thread', 'emb_material', 'set', 1, 220]], [W('emb', 'Back panel aari motif', 2, {pricing: 'hour', rate: 180, cplx: 'Medium', hours: 4})]),
    D('d_lapel', 'Classic Peak Lapel', 'DSN-104', 't_suit_m', 'Tailoring detail', 'formal, wedding', 'Single-breasted two-button jacket with sharp peak lapels and a contrast maroon lining.', 'lapel', 0, [['Contrast lining upgrade', 'lining', 'm', 2, 150]], [W('finish', 'Hand pick-stitch on lapel', 4, {pricing: 'fixed', rate: 450, hours: 1.5})])];
}

/* ---------------- masters bundle ---------------- */
function seedMasters(){
  const d = emptyDB();
  d.settings = defaultSettings(); d.stages = defaultStages(); d.templates = defaultTemplates(); d.msgTemplates = defaultMsgTemplates();
  d.counters = {order: 1001, inv: 1, rcpt: 1}; d.access = {roles: {}};
  return d;
}

/* ---------------- demo data ---------------- */
function seedDemo(){
  const d = seedMasters(); const prev = DB; DB = d;
  const T = n => iso(addDays(new Date(), n)), at = (dd, hh) => { const x = addDays(sod(new Date()), dd); x.setHours(hh ?? 11); return x.toISOString(); };
  d.settings.logo = demoLogo();
  d.designs = demoDesigns();
  d.workers = [
    {id: 'w_ramesh', name: 'Ramesh Patil', phone: '+91 98200 11001', skills: ['cut', 'stitch', 'trial', 'alter', 'qc'], payType: 'hourly', hourlyRate: 160, pieceRates: {}, hoursPerDay: 8, efficiency: 90, weeklyOff: null, leaves: [], active: true, upi: 'ramesh@upi', notes: 'Cutting master', joined: '2019-04-01', history: []},
    {id: 'w_suresh', name: 'Suresh Yadav', phone: '+91 98200 11002', skills: ['stitch', 'finish'], payType: 'piece', hourlyRate: 120, pieceRates: {}, hoursPerDay: 8, efficiency: 85, weeklyOff: null, leaves: [], active: true, upi: '', notes: 'Stitching master', history: []},
    {id: 'w_anita', name: 'Anita Kamble', phone: '+91 98200 11003', skills: ['stitch', 'finish', 'alter'], payType: 'piece', hourlyRate: 110, pieceRates: {}, hoursPerDay: 8, efficiency: 85, weeklyOff: null, leaves: [], active: true, upi: '', notes: '', history: []},
    {id: 'w_farid', name: 'Farid Ansari', phone: '+91 98200 11004', skills: ['emb', 'hand'], payType: 'hourly', hourlyRate: 180, pieceRates: {}, hoursPerDay: 9, efficiency: 90, weeklyOff: [5], leaves: [], active: true, upi: '', notes: 'Zardosi karigar', history: []},
    {id: 'w_salma', name: 'Salma Shaikh', phone: '+91 98200 11005', skills: ['emb', 'hand'], payType: 'hourly', hourlyRate: 170, pieceRates: {}, hoursPerDay: 8, efficiency: 85, weeklyOff: null, leaves: [], active: true, upi: '', notes: 'Aari specialist', history: []},
    {id: 'w_meena', name: 'Meena Jadhav', phone: '+91 98200 11006', skills: ['finish', 'hand', 'emb'], payType: 'piece', hourlyRate: 100, pieceRates: {}, hoursPerDay: 6, efficiency: 80, weeklyOff: null, leaves: [{id: uid('l'), from: T(1), to: T(4), reason: 'Family function'}], active: true, upi: '', notes: 'Part-time', history: []}];
  d.vendors = [
    {id: 'v_shree', name: 'Shree Dyers', phone: '+91 98670 22001', services: ['dye'], address: 'Bhiwandi', notes: 'Shade matching, 3 day TAT', active: true, history: []},
    {id: 'v_galaxy', name: 'Galaxy Fall & Pico', phone: '+91 98670 22002', services: ['hem'], address: 'Vashi', notes: '', active: true, history: []},
    {id: 'v_rehman', name: 'Rehman Zardosi Karkhana', phone: '+91 98670 22003', services: ['emb', 'hand'], address: 'Madanpura', notes: 'Overflow embroidery', active: true, history: []}];
  const items = [['Raw silk (assorted)', 'fabric', 'm', 900, 40, 10], ['Net (dupatta)', 'fabric', 'm', 400, 25, 8], ['Cotton lining', 'lining', 'm', 120, 60, 20], ['Satin lining', 'lining', 'm', 220, 18, 15], ['Can-can net', 'padding', 'm', 150, 6, 10], ['Blouse cups', 'padding', 'pair', 90, 14, 10], ['Shoulder pads', 'padding', 'pair', 150, 6, 4], ['Hooks', 'accessories', 'set', 30, 40, 15], ['Horn buttons', 'accessories', 'pc', 25, 60, 24], ['Invisible zip', 'accessories', 'pc', 40, 3, 10], ['Latkans', 'hangings', 'pair', 120, 12, 6], ['Gota lace', 'accessories', 'm', 45, 30, 20], ['Zari thread (antique gold)', 'emb_material', 'spool', 180, 9, 10], ['Dabka & nakshi', 'emb_material', 'pack', 260, 5, 4], ['Thread (assorted)', 'thread', 'spool', 40, 80, 30]];
  d.inventory = items.map(([name, category, unit, rate, stock, reorder]) => ({id: 'i_' + slug(name).slice(0, 14), name, category, unit, rate, reorder, location: 'Main rack', active: true}));
  d.movements = d.inventory.map((it, k) => ({id: uid('mv'), itemId: it.id, date: T(-30), type: 'in', qty: items[k][4], rate: it.rate, note: 'Opening stock', by: 'Owner'}));
  const M = (id, name, relation, gender, dob, x) => Object.assign({id, name, relation, gender, dob, phone: '', notes: ''}, x || {});
  d.customers = [
    {id: 'c_ayesha', name: 'Ayesha Khan', phone: '+91 98765 10001', phone2: '', email: 'ayesha.k@example.com', address: 'Palm Beach Road, Nerul, Navi Mumbai', notes: 'Bride — wedding on the 20th. Mother of the bride also ordering.', fitPrefs: 'Likes a snug bodice, comfortable waist. Prefers soft lining, no scratchy backing.', created: at(-20), history: [],
      members: [M('m_ayesha', 'Ayesha Khan', 'Self', 'F', '1999-02-14', {primary: true}), M('m_zoya', 'Zoya Khan', 'Sister', 'F', '2002-08-03', {notes: 'Prefers slightly loose sleeves'}), M('m_shabana', 'Shabana Khan', 'Mother', 'F', '1972-11-21', {phone: '+91 98765 10002'})]},
    {id: 'c_priya', name: 'Priya Nair', phone: '+91 99200 11223', phone2: '', email: 'priya.nair@example.com', address: 'Kharghar Sector 20', notes: '', fitPrefs: 'Deep back necks, elbow-length sleeves. Pastels with gold zari; no heavy sequins.', created: at(-90), history: [],
      members: [M('m_priya', 'Priya Nair', 'Self', 'F', '1988-06-30', {primary: true}), M('m_vikram', 'Vikram Nair', 'Husband', 'M', '1985-01-12', {phone: '+91 99200 11224'}), M('m_anika', 'Anika Nair', 'Daughter', 'F', '2014-09-05', {notes: 'Growing — re-measure every order'})]},
    {id: 'c_rohan', name: 'Rohan Mehta', phone: '+91 98765 43210', phone2: '', email: 'rohan.m@example.com', address: 'Nerul, Navi Mumbai', notes: '', fitPrefs: 'Slim fit, natural shoulder, minimal padding.', created: at(-40), history: [],
      members: [M('m_rohan', 'Rohan Mehta', 'Self', 'M', '1992-03-18', {primary: true}), M('m_isha', 'Isha Mehta', 'Wife', 'F', '1994-12-02')]},
    {id: 'c_aarav', name: 'Aarav Shah', phone: '+91 90040 55667', phone2: '', email: '', address: 'Vashi Sector 9', notes: '', fitPrefs: 'Comfort fit, mandarin collar.', created: at(-60), history: [],
      members: [M('m_aarav', 'Aarav Shah', 'Self', 'M', '1980-07-25', {primary: true}), M('m_vihaan', 'Vihaan Shah', 'Son', 'M', '2016-04-10')]},
    {id: 'c_neha', name: 'Neha Joshi', phone: '+91 90220 33445', phone2: '', email: 'neha.j@example.com', address: 'Belapur', notes: '', fitPrefs: 'A-line kurtas, 3/4 sleeves.', created: at(-15), history: [],
      members: [M('m_neha', 'Neha Joshi', 'Self', 'F', '1996-10-08', {primary: true})]}];
  const P = (id, customerId, memberId, label, tplId, size, specs, fitNotes) => { const t = tpl(tplId), vals = sampleVals(t.charts, size), mem = d.customers.find(c => c.id === customerId).members.find(m => m.id === memberId);
    return {id, customerId, memberId, person: mem.relation, label, tplId, unit: 'in', values: vals, specs: specs || {}, fitNotes: fitNotes || '', updated: at(-10), versions: [{at: at(-60), by: 'Owner', unit: 'in', values: clone(vals), specs: specs || {}, fitNotes: fitNotes || '', note: 'First measurement'}], history: []}; };
  d.profiles = [
    P('p_ayesha_l', 'c_ayesha', 'm_ayesha', 'Bridal lehenga choli', 't_lehenga', 0, {kalis_panels: '16', can_can_layers: '2', waist_closure: 'Side zip', choli_back: 'Dori back', dupatta_border: 'Scalloped'}, 'Bodice snug; 1" ease at waist for comfort.'),
    P('p_ayesha_b', 'c_ayesha', 'm_ayesha', 'Blouse – padded, sweetheart', 't_blouse', 0, {front_neck: 'Sweetheart', back_neck: 'Dori back', sleeve_style: 'Elbow', opening: 'Back hooks', padding: 'Padded', lining: 'Full', dori_latkan: 'Yes'}),
    P('p_zoya_b', 'c_ayesha', 'm_zoya', 'Blouse', 't_blouse', -1, {front_neck: 'U', back_neck: 'Deep U', sleeve_style: 'Short', opening: 'Back hooks', padding: 'Padded', lining: 'Full', dori_latkan: 'Yes'}, 'Prefers slightly loose sleeves.'),
    P('p_shabana_b', 'c_ayesha', 'm_shabana', 'Blouse – comfort fit', 't_blouse', 2, {front_neck: 'Round', back_neck: 'Round', sleeve_style: 'Elbow', opening: 'Front hooks', padding: 'Non-padded', lining: 'Full', dori_latkan: 'No'}, 'Front opening; 1.5" ease at bust.'),
    P('p_priya_b', 'c_priya', 'm_priya', 'Blouse – deep back', 't_blouse', 0, {front_neck: 'U', back_neck: 'Deep U', sleeve_style: 'Elbow', opening: 'Front hooks', padding: 'Padded', lining: 'Full', dori_latkan: 'Yes'}),
    P('p_priya_b2', 'c_priya', 'm_priya', 'Blouse – boat neck, cap sleeve', 't_blouse', 0, {front_neck: 'Boat', back_neck: 'Boat', sleeve_style: 'Cap', opening: 'Back hooks', padding: 'Cups only', lining: 'Full', dori_latkan: 'No'}, 'Boat neck sits 0.5" wider for this style.'),
    P('p_anika_t', 'c_priya', 'm_anika', 'Top', 't_top', -4, {style: 'A-line', length: 'Knee', neck: 'Round', sleeve_style: 'Short', slit: 'None', lining: 'Full'}),
    P('p_anika_bt', 'c_priya', 'm_anika', 'Bottom', 't_bottom', -4, {style: 'Churidar', waist: 'Elastic + drawstring', pockets: 'No', bottom_finish: 'Plain'}),
    P('p_vikram_k', 'c_priya', 'm_vikram', 'Kurta', 't_kurta_m', 1, {collar: 'Mandarin', placket: 'Hidden', fit: 'Regular', side_pockets: 'Yes'}),
    P('p_rohan_s', 'c_rohan', 'm_rohan', 'Suit', 't_suit_m', 0, {lapel: 'Peak', buttons: '2', vents: 'Double', shoulder: 'Natural', lining_colour: 'Maroon paisley', trouser_front: 'Flat'}),
    P('p_aarav_k', 'c_aarav', 'm_aarav', 'Kurta', 't_kurta_m', 0, {collar: 'Mandarin', placket: 'Hidden', fit: 'Regular', side_pockets: 'Yes'}),
    P('p_aarav_t', 'c_aarav', 'm_aarav', 'Trouser', 't_trouser', 0, {fit: 'Regular', pleats: 'Flat front', pockets: 'Side + back', belt_loops: 'Yes', bottom_finish: 'Plain'}),
    P('p_neha_s', 'c_neha', 'm_neha', 'Kurta set', 't_suit_w', 0, {kurta_style: 'A-line', neck: 'Round', sleeve_style: '3/4', bottom_style: 'Palazzo', slit: 'Side', dupatta_finishing: 'Fall & pico'})];

  const wf = (tplId) => tpl(tplId).workflow.map(x => ({...clone(x), id: uid('s'), status: 'pending', workerId: '', vendorId: '', round: 1, target: '', startedAt: null, doneAt: null}));
  const G = (o, idx, tplId, title, profileId, extra) => {
    const t = tpl(tplId), p = prof(profileId);
    const g = Object.assign({id: uid('g'), orderId: o.id, customerId: o.customerId, idx, no: o.no + '/' + idx, tplId, title, qty: 1, profileId, memberId: p.memberId, unit: p.unit || 'in', meas: clone(p.values), specs: clone(p.specs), style: '', fit: p.fitNotes || '', urgent: false, instructions: '', fabricSource: 'studio', deliveryDate: o.deliveryDate, targets: {}, components: t.components.map(c => ({...clone(c), id: uid('c'), itemId: matchItem(c.name), issued: 0})), steps: wf(tplId), design: {catalogId: '', versions: [], approvedV: 0}, trials: [], qc: [], delivery: {}, extras: [], headPrice: {}, status: 'active', history: [{at: o.created, by: 'Owner', action: 'Garment file created', changes: []}], created: o.created}, extra || {});
    d.garments.push(g); return g;
  };
  function matchItem(name){ const n = name.toLowerCase(); const hit = d.inventory.find(i => n.includes(i.name.toLowerCase().split(' ')[0]) && i.name.toLowerCase().split(' ')[0].length > 3); return hit ? hit.id : ''; }
  const O = (no, cid, c, dlv, x) => { const o = Object.assign({id: 'o_' + no, no: d.settings.orderPrefix + no, customerId: cid, created: T(c), deliveryDate: T(dlv), urgent: false, notes: '', instructions: '', discount: 0, gstPct: d.settings.gstPct, markup: d.settings.markupPct, payments: [], status: 'open', history: [{at: at(c), by: 'Owner', action: 'Order booked', changes: []}], createdBy: 'Owner'}, x || {}); d.orders.push(o); return o; };
  const assign = (g, map) => g.steps.forEach((s, i) => { const k = map[i]; if(k === undefined) return; if(k.startsWith('v_')) { s.vendorId = k; s.out = true; } else s.workerId = k; });
  const done = (s, dd, hh) => { s.status = 'done'; s.startedAt = s.startedAt || at(dd, (hh || 11) - 2); s.doneAt = at(dd, hh || 16); };
  const prog = (s, dd, hh) => { s.status = 'in_progress'; s.startedAt = at(dd, hh || 10); };
  const ver = (g, kind, fields, approved, files) => { const v0 = {v: g.design.versions.length + 1, at: at(-15), by: 'Owner', note: g.design.versions.length ? 'Customer asked for changes' : 'First design', files: files || [{id: `demo:fabric:${kind}`, kind: 'fabric', caption: 'Fabric swatch'}, {id: `demo:sketch:${kind}`, kind: 'sketch', caption: 'Front sketch'}, {id: `demo:khaka:${kind}`, kind: 'khaka', caption: 'Khaka / tracing'}, {id: `demo:sample:${kind}`, kind: 'embroidery', caption: 'Embroidery reference'}], fields: Object.assign({pattern: '', placement: '', lining: '', trims: '', colours: '', notes: ''}, fields), approved: !!approved, approvedAt: approved ? at(-12) : '', approvedBy: approved ? 'Ayesha (customer) via Owner' : ''}; g.design.versions.push(v0); if(approved){ g.design.versions.forEach(x => { if(x !== v0) x.approved = false; }); g.design.approvedV = v0.v; } };
  const pay = (o, dd, amount, mode, type) => o.payments.push({id: uid('p'), date: T(dd), amount, mode, type, note: type === 'advance' ? 'Advance at booking' : type === 'final' ? 'Balance on delivery' : 'Instalment', receiptNo: d.settings.rcptPrefix + String(d.counters.rcpt++).padStart(4, '0'), by: 'Owner'});

  // 1. Ayesha — bridal order, two garments, customer fabric for sister's blouse
  const o1 = O(1001, 'c_ayesha', -12, 16, {notes: 'Wedding on ' + fmtD(T(18)) + '. Bridal trial to be booked 4 days before.', instructions: 'Keep all leftover zari for touch-ups at the venue.'});
  const g1 = G(o1, 1, 't_lehenga', 'Bridal lehenga – pastel mint & gold', 'p_ayesha_l', {style: 'Pastel mint dyed to swatch. Heavy zardosi on ghera, lighter on choli. Can-can for volume. No sequins.', urgent: false});
  g1.design.catalogId = 'd_jaal';
  ver(g1, 'jaal', {pattern: 'Mughal jaal, 6-petal florets', placement: 'Ghera full; choli front & sleeves; dupatta 6" border', lining: 'Mint cotton-satin', trims: 'Gold scalloped lace, 2 pairs latkans', colours: 'Mint #BFE3D0, antique gold'}, false);
  ver(g1, 'jaal', {pattern: 'Mughal jaal, 6-petal florets — lighter density near waist', placement: 'Ghera full; choli front & sleeves; dupatta 6" border', lining: 'Mint cotton-satin', trims: 'Gold scalloped lace, 2 pairs latkans', colours: 'Mint #BFE3D0, antique gold'}, true);
  assign(g1, {0: 'v_shree', 1: 'w_ramesh', 2: 'w_farid', 3: 'w_salma', 4: 'w_meena', 5: 'w_meena', 6: 'w_suresh', 7: 'w_anita', 8: 'v_galaxy', 9: 'w_anita', 10: 'w_ramesh', 11: 'w_ramesh'});
  done(g1.steps[0], -8); g1.steps[0].charge = 900; done(g1.steps[1], -7); prog(g1.steps[2], -2, 10); prog(g1.steps[3], -1, 10);
  g1.components.forEach(c => { if(c.itemId) c.issued = c.qty; });
  const g2 = G(o1, 2, 't_blouse', 'Sister\'s blouse – customer fabric', 'p_zoya_b', {style: 'Customer brought her own Banarasi silk. Deep U back with dori. Short sleeves.', fabricSource: 'customer', deliveryDate: T(14)});
  g2.components[0].source = 'customer'; g2.components[0].rate = 0; g2.components[0].name = 'Banarasi silk (customer)';
  g2.design.catalogId = 'd_floral'; ver(g2, 'floral', {pattern: 'Floral aari on back', placement: 'Back panel centre', lining: 'Cream cotton', trims: 'Dori with gold latkans', colours: 'Gold on rani pink'}, true);
  assign(g2, {0: 'w_ramesh', 1: 'w_salma', 2: 'w_anita', 3: 'w_meena', 4: 'w_ramesh', 5: 'w_ramesh'});
  pay(o1, -12, 40000, 'UPI', 'advance');
  d.custMaterials.push({id: uid('cm'), customerId: 'c_ayesha', orderId: o1.id, garmentId: g2.id, desc: 'Banarasi silk, rani pink', qty: 1.2, unit: 'm', status: 'in_production', receivedAt: at(-12), receivedBy: 'Seema', log: [{at: at(-12), status: 'received', note: 'Received at booking', by: 'Seema'}, {at: at(-6), status: 'in_production', note: 'Issued for cutting', by: 'Ramesh'}]});

  // 2. Priya — urgent blouse, stitching overdue against target
  const o2 = O(1002, 'c_priya', -6, 4, {urgent: true, notes: 'Needed for sangeet.'});
  const g3 = G(o2, 1, 't_blouse', 'Sangeet blouse – blush pink', 'p_priya_b', {style: 'Deep U back with dori & latkans, elbow sleeves, light aari work on sleeves and neckline. Padded.', urgent: true, instructions: 'Customer will bring matching saree on trial day.'});
  ver(g3, 'floral', {pattern: 'Light aari florals', placement: 'Neckline & sleeve hem', lining: 'Blush cotton', trims: 'Dori + 2 gold latkans', colours: 'Blush & gold'}, true);
  assign(g3, {0: 'w_ramesh', 1: 'w_salma', 2: 'w_suresh', 3: 'w_meena', 4: 'w_ramesh', 5: 'w_ramesh'});
  done(g3.steps[0], -5); done(g3.steps[1], -2); prog(g3.steps[2], 0, 9);
  const g3b = G(o2, 2, 't_blouse', 'Blouse – boat neck, cap sleeves (2 pcs)', 'p_priya_b2', {qty: 2, style: 'Two plain-coloured blouses (mustard, bottle green) for daily sarees. Boat neck, cap sleeves, no work.'});
  assign(g3b, {0: 'w_ramesh', 2: 'w_anita', 3: 'w_meena'});
  const g3c = G(o2, 3, 't_top', 'Anika – A-line kurti, peach', 'p_anika_t', {style: 'Knee-length A-line, short puff sleeves, small mirror work on yoke. Comfortable for a 12-year-old.', deliveryDate: T(6)});
  assign(g3c, {0: 'w_ramesh', 2: 'w_anita', 3: 'w_meena'});
  const g3d = G(o2, 4, 't_bottom', 'Anika – churidar, cream', 'p_anika_bt', {style: 'Churidar with elastic + drawstring; extra 1" hem allowance to let out later.', deliveryDate: T(6)});
  assign(g3d, {0: 'w_ramesh', 1: 'w_anita', 2: 'w_meena'});
  const g3e = G(o2, 5, 't_kurta_m', 'Vikram – kurta, ivory', 'p_vikram_k', {style: 'Mandarin collar, hidden placket, plain. To match Anika\'s set.', deliveryDate: T(6)});
  assign(g3e, {0: 'w_ramesh', 2: 'w_suresh', 3: 'w_meena'});
  [g3b, g3c, g3e].forEach(g => g.steps.forEach(s => { if(s.stageId === 'emb') s.status = 'skipped'; }));
  pay(o2, -6, 3000, 'UPI', 'advance');

  // 3. Rohan — suit at alteration after trial
  const o3 = O(1003, 'c_rohan', -14, 2, {notes: 'Reception suit.'});
  const g4 = G(o3, 1, 't_suit_m', 'Reception suit – navy', 'p_rohan_s', {style: 'Slim fit, peak lapel, double vent, working cuff buttons. Maroon paisley lining.'});
  g4.design.catalogId = 'd_lapel'; ver(g4, 'lapel', {pattern: 'Peak lapel, 2 button', placement: '', lining: 'Maroon paisley', trims: 'Horn buttons', colours: 'Navy'}, true, [{id: 'demo:sample:lapel', kind: 'reference', caption: 'Reference'}, {id: 'demo:sketch:lapel', kind: 'sketch', caption: 'Sketch'}]);
  assign(g4, {0: 'w_ramesh', 1: 'w_suresh', 2: 'w_anita', 3: 'w_ramesh', 4: 'w_anita', 5: 'w_ramesh'});
  done(g4.steps[0], -12); done(g4.steps[1], -6); done(g4.steps[2], -8); done(g4.steps[3], -2, 17);
  const trialId = uid('tr'), altId = uid('al');
  g4.trials.push({id: trialId, round: 1, date: T(-2), time: '17:00', status: 'done', stepId: g4.steps[3].id, notes: 'Jacket slightly loose at waist; sleeves 0.5" long.', photos: ['demo:sample:lapel'], alterations: [{id: altId, area: 'Jacket waist', instruction: 'Take in 0.75" at side seams', masterId: 'w_anita', charge: 0, status: 'in_progress'}, {id: uid('al'), area: 'Sleeves', instruction: 'Shorten 0.5", keep 4 working buttons', masterId: 'w_anita', charge: 0, status: 'in_progress'}], by: 'Ramesh'});
  const alt = {id: uid('s'), stageId: 'alter', label: 'Round 1: waist & sleeves', seq: 3.5, status: 'in_progress', workerId: 'w_anita', vendorId: '', round: 1, pricing: 'unit', units: 1, rate: 300, cplx: 'Simple', hours: 3, tat: 0, charge: 0, out: false, optional: false, target: '', startedAt: at(0, 9), doneAt: null, trialId};
  g4.steps.splice(4, 0, alt);
  pay(o3, -14, 10000, 'Card', 'advance'); pay(o3, -2, 5000, 'UPI', 'instalment');

  // 4. Aarav — two garments: one delivered, one ready (partial delivery)
  const o4 = O(1004, 'c_aarav', -16, -2, {});
  const g5 = G(o4, 1, 't_kurta_m', 'Festive kurta – ivory', 'p_aarav_k', {style: 'Mandarin collar, hidden placket, tone-on-tone neckline thread work.'});
  const g6 = G(o4, 2, 't_trouser', 'Trouser – beige', 'p_aarav_t', {style: 'Regular fit, flat front.'});
  assign(g5, {0: 'w_ramesh', 1: 'w_meena', 2: 'w_suresh', 3: 'w_anita', 4: 'w_ramesh'}); assign(g6, {0: 'w_ramesh', 1: 'w_suresh', 2: 'w_anita', 3: 'w_ramesh'});
  g5.steps.forEach((s, i) => done(s, -14 + i * 2)); g6.steps.forEach((s, i) => done(s, -12 + i * 2));
  [g5, g6].forEach(g => g.qc.push({id: uid('q'), at: at(-5), by: 'Ramesh', result: 'pass', checks: {}, notes: 'All good', stepId: g.steps[g.steps.length - 1].id}));
  g6.delivery = {pressed: {at: at(-4), by: 'Meena'}, packed: {at: at(-4), by: 'Meena'}, notified: {at: at(-4), by: 'Seema'}, delivered: {at: at(-3, 18), by: 'Seema', receivedBy: 'Aarav Shah', relation: 'Self', notes: 'Trouser collected; kurta needs festive pressing', collected: 0}};
  g5.delivery = {pressed: {at: at(-1), by: 'Meena'}, packed: {at: at(-1), by: 'Meena'}};
  pay(o4, -16, 1500, 'UPI', 'advance');

  // 5. Neha — kurta set with outside hemming overdue at vendor
  const o5 = O(1005, 'c_neha', -9, 3, {});
  const g7 = G(o5, 1, 't_suit_w', 'A-line kurta set – teal', 'p_neha_s', {style: 'A-line kurta, 3/4 sleeves, palazzo. Paisley butti neckline.'});
  g7.design.catalogId = 'd_paisley'; ver(g7, 'paisley', {pattern: 'Paisley buttis', placement: 'Neckline & placket', lining: 'Teal cotton', trims: 'Gota on dupatta', colours: 'Teal & gold'}, true);
  g7.steps[0].status = 'skipped';
  assign(g7, {1: 'w_ramesh', 2: 'w_farid', 3: 'w_suresh', 4: 'w_anita', 5: 'v_galaxy', 6: 'w_anita', 7: 'w_ramesh', 8: 'w_ramesh'});
  done(g7.steps[1], -8); done(g7.steps[2], -6); done(g7.steps[3], -4); done(g7.steps[4], -4);
  g7.steps[5].status = 'in_progress'; g7.steps[5].startedAt = at(-5, 12); g7.steps[5].vendorAdvance = 0;
  pay(o5, -9, 2500, 'Cash', 'advance');

  // 6. Priya — last month, delivered & paid (for reports)
  const o6 = O(1006, 'c_priya', -40, -30, {status: 'closed'});
  const g8 = G(o6, 1, 't_blouse', 'Diwali blouse – emerald', 'p_priya_b', {style: 'Boat neck, cap sleeves.'});
  assign(g8, {0: 'w_ramesh', 1: 'w_farid', 2: 'w_suresh', 3: 'w_meena', 4: 'w_ramesh', 5: 'w_ramesh'});
  g8.steps.forEach((s, i) => done(s, -39 + i * 2));
  g8.qc.push({id: uid('q'), at: at(-31), by: 'Ramesh', result: 'pass', checks: {}, notes: '', stepId: g8.steps[5].id});
  g8.delivery = {pressed: {at: at(-31)}, packed: {at: at(-31)}, notified: {at: at(-31)}, delivered: {at: at(-30, 17), by: 'Seema', receivedBy: 'Priya Nair', relation: 'Self', notes: ''}};
  g8.components.forEach(c => c.issued = c.qty);
  pay(o6, -40, 2000, 'UPI', 'advance');

  // invoices for delivered order + payments
  DB = d;
  makeInvoice(o6, [g8.id], T(-30), 'INV-0001'); d.counters.inv = 2;
  pay(o6, -30, r2(orderTotals(o6).total - 2000), 'UPI', 'final');
  makeInvoice(o4, [g5.id, g6.id], T(-3), 'INV-0002'); d.counters.inv = 3;
  pay(o4, -3, 3000, 'Card', 'instalment');
  d.counters.order = 1007;

  // ledger: worker advances/payments, vendor payments
  d.ledger = [
    {id: uid('lg'), party: 'worker', partyId: 'w_farid', date: T(-10), type: 'advance', amount: 3000, mode: 'Cash', note: 'Advance for bridal job', by: 'Owner'},
    {id: uid('lg'), party: 'worker', partyId: 'w_suresh', date: T(-7), type: 'payment', amount: 2000, mode: 'UPI', note: 'Weekly settlement', by: 'Owner'},
    {id: uid('lg'), party: 'worker', partyId: 'w_ramesh', date: T(-7), type: 'payment', amount: 4000, mode: 'UPI', note: 'Weekly settlement', by: 'Owner'},
    {id: uid('lg'), party: 'vendor', partyId: 'v_shree', date: T(-8), type: 'advance', amount: 500, mode: 'Cash', note: 'Dyeing advance', by: 'Owner'}];
  // stock issues for issued components
  d.garments.forEach(g => g.components.forEach(c => { if(c.itemId && c.issued) d.movements.push({id: uid('mv'), itemId: c.itemId, date: iso(parseD(g.created)), type: 'out', qty: c.issued, rate: c.rate, garmentId: g.id, orderId: g.orderId, note: 'Issued to ' + g.no, by: 'Ramesh'}); }));
  // message log
  d.msgLog.push({id: uid('ml'), at: at(-12), orderId: o1.id, customerId: 'c_ayesha', to: '+91 98765 10001', channel: 'WhatsApp', tplName: 'Order confirmation', text: 'Namaste Ayesha! Your order TD-1001 is confirmed…', by: 'Seema'});
  DB = prev;
  return d;
}
