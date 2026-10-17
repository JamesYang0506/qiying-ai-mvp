import {mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync, statSync, mkdtempSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {zipSync, strToU8} from 'fflate';
import {readXlsx} from '../server/import/xlsx.mjs';
import {normalizePair} from '../server/import/normalize.mjs';
import {evaluate} from '../server/profit/evaluate.mjs';
import {createApp} from '../runtime/server.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outBase = process.argv[2] ?? 'C:/Users/lenovo/Desktop/挑战杯/模拟数据';
const packageName = '企盈智擎-模拟订单数据-多订单重合-2026-10-17';
const outDir = path.join(outBase, packageName);
const zipPath = outDir + '.zip';

const money2 = n => Number(n).toFixed(2);
const compactDate = d => d.replaceAll('-', '');
const xmlEsc = v => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const colLetter = n => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
const addDays = (date, n) => { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mulberry32 = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const seedOf = s => [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

// ---------------------------------------------------------------------------
// Scenarios: three margin bands, four orders each, all within a five-day start
// window so every common asOf date exercises a dozen overlapping orders.
// ---------------------------------------------------------------------------
const baseParams = {production_mgmt: .04, energy_pct: .02, company_mgmt: .015, admin_pct: .01, logistics_piece: .35, production_loss_budget: .006, defect_loss_budget: .018, finance_piece: .05};
const sizeSets = {
  3: [['38#', .40, '38# 中底'], ['40#', .35, '40# 中底'], ['42#', .25, '42# 中底']],
  4: [['38#', .30, '38# 中底'], ['40#', .28, '40# 中底'], ['42#', .24, '42# 中底'], ['44#', .18, '44# 中底']]
};
const scenarios = [
  {id: 'SIM-M01', band: '高毛利', title: '稳定量产，高毛利', folder: '01_高毛利_稳定量产', product: 'EVA发泡中底 · 经典款', customer: 'CUST-H1', start: '2026-09-28', days: 30, quantity: 96000, price: 18, weight: .55, materialPct: .50, prep: .8, press: 2.1, otherPiece: .20, defects: .020, usage: 1.008, priceBias: .012, laborBias: 1.005, sizeCount: 3, materials: [['EVA-01', 'EVA改性发泡料', 15.13, 1]], note: '成熟产品稳定生产，材料价格与人工仅有小幅正常波动，毛利率处于高位。'},
  {id: 'SIM-M02', band: '高毛利', title: '原料价格偏低，高毛利', folder: '02_高毛利_原料低价', product: 'EVA发泡中底 · 轻量款', customer: 'CUST-H2', start: '2026-09-30', days: 30, quantity: 108000, price: 18.5, weight: .55, materialPct: .49, prep: .8, press: 2.1, otherPiece: .20, defects: .018, usage: 1.005, priceBias: -.015, laborBias: 1.005, sizeCount: 3, materials: [['EVA-01', 'EVA改性发泡料', 14.8, 1]], note: '原料采购价低于报价基准约1.5%，其余成本正常，形成高毛利。'},
  {id: 'SIM-M03', band: '高毛利', title: '规模摊薄，高毛利', folder: '03_高毛利_规模摊薄', product: 'EVA发泡中底 · 大货款', customer: 'CUST-H3', start: '2026-10-02', days: 31, quantity: 150000, price: 18, weight: .55, materialPct: .50, prep: .78, press: 2.05, otherPiece: .19, defects: .024, usage: 1.015, priceBias: .005, laborBias: .985, sizeCount: 3, materials: [['EVA-01', 'EVA改性发泡料', 15.13, 1]], note: '大批量摊薄准备与压制工价，材料略有超耗，整体仍保持高毛利。'},
  {id: 'SIM-M04', band: '高毛利', title: '多码多料，高毛利', folder: '04_高毛利_多码多料', product: 'EVA发泡中底 · 多码组合', customer: 'CUST-H4', start: '2026-10-03', days: 30, quantity: 84000, price: 19, weight: .55, materialPct: .51, prep: .8, press: 2.1, otherPiece: .20, defects: .022, usage: 1.005, priceBias: .008, laborBias: 1.0, sizeCount: 4, materials: [['EVA-01', 'EVA改性发泡料', 15.4, .65], ['EVA-02', 'EVA高弹发泡料', 16.2, .35]], note: '四个码号、两种材料并行，换码损耗受控，毛利率仍处于高位。'},

  {id: 'SIM-M05', band: '中毛利', title: '经典款，适中毛利', folder: '05_中毛利_经典款', product: 'EVA发泡中底 · 标准款', customer: 'CUST-M1', start: '2026-09-28', days: 30, quantity: 90000, price: 16, weight: .55, materialPct: .52, prep: .9, press: 2.3, otherPiece: .25, defects: .026, usage: .99, priceBias: 0, laborBias: 1.0, sizeCount: 3, materials: [['EVA-01', 'EVA改性发泡料', 15.13, 1]], note: '材料、人工和不良率均在常规区间，毛利率处于中间水平。'},
  {id: 'SIM-M06', band: '中毛利', title: '走量款，适中毛利', folder: '06_中毛利_走量', product: 'EVA发泡中底 · 走量款', customer: 'CUST-M2', start: '2026-09-30', days: 30, quantity: 126000, price: 15.8, weight: .55, materialPct: .52, prep: .85, press: 2.2, otherPiece: .24, defects: .028, usage: .99, priceBias: 0, laborBias: .995, sizeCount: 3, materials: [['EVA-01', 'EVA改性发泡料', 15.4, 1]], note: '大批量、较低报价，依靠工价和规模维持适中毛利。'},
  {id: 'SIM-M07', band: '中毛利', title: '材料小幅上涨，适中毛利', folder: '07_中毛利_材料波动', product: 'EVA发泡中底 · 标准款', customer: 'CUST-M3', start: '2026-10-02', days: 31, quantity: 78000, price: 16.2, weight: .55, materialPct: .53, prep: .9, press: 2.3, otherPiece: .25, defects: .030, usage: .98, priceBias: .01, laborBias: 1.0, sizeCount: 3, materials: [['EVA-01', 'EVA改性发泡料', 15.6, 1]], note: '材料单价较基准高约1%，通过控制净耗把毛利率维持在中间区间。'},
  {id: 'SIM-M08', band: '中毛利', title: '小批多色，适中毛利', folder: '08_中毛利_小批多色', product: 'EVA发泡中底 · 多色小批', customer: 'CUST-M4', start: '2026-10-03', days: 30, quantity: 54000, price: 16.5, weight: .55, materialPct: .52, prep: .9, press: 2.3, otherPiece: .25, defects: .032, usage: .985, priceBias: 0, laborBias: 1.0, sizeCount: 4, materials: [['EVA-01', 'EVA改性发泡料', 15.2, .6], ['EVA-02', 'EVA高弹发泡料', 16.0, .4]], note: '小批量、多码多色，换模成本存在，但报价覆盖后仍有适中毛利。'},

  {id: 'SIM-M09', band: '低毛利', title: '薄利大单，低毛利', folder: '09_低毛利_薄利大单', product: 'EVA发泡中底 · 薄利款', customer: 'CUST-L1', start: '2026-09-28', days: 30, quantity: 144000, price: 14, weight: .55, materialPct: .62, prep: .8, press: 2.1, otherPiece: .20, defects: .008, usage: 1.0, priceBias: 0, laborBias: 1.0, sizeCount: 3, materials: [['EVA-01', 'EVA改性发泡料', 15.0, 1]], note: '低报价、材料占比高，质量稳定，仍有接近一成的正毛利。'},
  {id: 'SIM-M10', band: '低毛利', title: '成本承压，低毛利', folder: '10_低毛利_成本承压', product: 'EVA发泡中底 · 薄利款', customer: 'CUST-L2', start: '2026-09-30', days: 30, quantity: 96000, price: 14.2, weight: .55, materialPct: .63, prep: .82, press: 2.15, otherPiece: .21, defects: .008, usage: 1.005, priceBias: .005, laborBias: 1.005, sizeCount: 3, materials: [['EVA-01', 'EVA改性发泡料', 15.2, 1]], note: '材料、人工和制造费用同时偏高，毛利率被压到较低水平，但仍为正。'},
  {id: 'SIM-M11', band: '低毛利', title: '原料上涨，低毛利', folder: '11_低毛利_原料上涨', product: 'EVA发泡中底 · 薄利款', customer: 'CUST-L3', start: '2026-10-02', days: 31, quantity: 72000, price: 13.8, weight: .55, materialPct: .63, prep: .8, press: 2.1, otherPiece: .20, defects: .006, usage: 1.005, priceBias: .012, laborBias: 1.0, sizeCount: 3, materials: [['EVA-01', 'EVA改性发泡料', 15.6, 1]], note: '原料单价上涨约1.2%，报价偏低，毛利率接近盈亏平衡但未亏损。'},
  {id: 'SIM-M12', band: '低毛利', title: '多码薄利小单', folder: '12_低毛利_多码小单', product: 'EVA发泡中底 · 多码薄利', customer: 'CUST-L4', start: '2026-10-03', days: 30, quantity: 42000, price: 14.5, weight: .55, materialPct: .62, prep: .8, press: 2.1, otherPiece: .20, defects: .010, usage: 1.0, priceBias: 0, laborBias: 1.0, sizeCount: 4, materials: [['EVA-01', 'EVA改性发泡料', 15.1, .55], ['EVA-02', 'EVA高弹发泡料', 15.9, .45]], note: '小批量多码号，报价偏低但材料与工价可控，保持薄利正毛利。'}
];

function splitQuantity(total, shares) {
  const raw = shares.map(s => s * total);
  const vals = raw.map(Math.floor);
  let rem = total - vals.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - vals[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < rem; k++) vals[order[k % order.length][1]]++;
  return vals;
}
function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map(w => w / sum * total);
  const vals = raw.map(Math.floor);
  let rem = total - vals.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - vals[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < rem; k++) vals[order[k % order.length][1]]++;
  return vals;
}

function buildScenario(s) {
  const sizes = sizeSets[s.sizeCount].map(([id, share, spec]) => ({id, share, spec}));
  const sizeQty = splitQuantity(s.quantity, sizes.map(x => x.share));
  const dates = Array.from({length: s.days}, (_, i) => addDays(s.start, i));
  const end = dates.at(-1);
  const seed = seedOf(s.id);
  const production = [];
  for (let si = 0; si < sizes.length; si++) {
    const rng = mulberry32(seed + si * 97);
    const phase = rng() * Math.PI * 2;
    const weights = dates.map((date, di) => {
      const dow = new Date(date + 'T00:00:00Z').getUTCDay();
      const weekend = dow === 0 || dow === 6 ? .92 : 1;
      const ramp = di === 0 ? .78 : di === 1 ? .9 : 1;
      const wave = 1 + .06 * Math.sin((di + phase) / 2.7);
      const noise = 1 + (rng() - .5) * .05;
      return weekend * ramp * wave * noise;
    });
    const good = allocate(sizeQty[si], weights);
    for (let di = 0; di < dates.length; di++) {
      const g = good[di];
      const defects = g > 0 ? Math.max(0, Math.round(g * s.defects / (1 - s.defects))) : 0;
      production.push({date: dates[di], size: sizes[si].id, good: g, defects, processed: g + defects});
    }
  }
  production.sort((a, b) => a.date.localeCompare(b.date) || sizes.findIndex(x => x.id === a.size) - sizes.findIndex(x => x.id === b.size));

  const refAvg = s.materials.reduce((sum, [, , ref, share]) => sum + ref * share, 0);
  const derivedAvg = s.price * s.materialPct / s.weight;
  const materials = s.materials.map(([id, name, ref, share]) => ({id, name, ref, share, derived: derivedAvg * ref / refAvg, actualPrice: derivedAvg * ref / refAvg * (1 + s.priceBias)}));

  const byDay = new Map(dates.map(d => [d, []]));
  for (const p of production) byDay.get(p.date).push(p);

  const daily = [];
  for (const date of dates) {
    const rows = byDay.get(date);
    const good = rows.reduce((sum, r) => sum + r.good, 0);
    const processed = rows.reduce((sum, r) => sum + r.processed, 0);
    const revenue = good * s.price;
    const netTotal = processed * s.weight * s.usage;
    const materialRows = materials.map(m => ({...m, net: netTotal * m.share, amount: netTotal * m.share * m.actualPrice}));
    const labor = processed * (s.prep + s.press) * s.laborBias;
    const energy = revenue * baseParams.energy_pct;
    const productionMgmt = revenue * baseParams.production_mgmt;
    const otherProduction = processed * s.otherPiece;
    const management = revenue * baseParams.company_mgmt;
    const selling = revenue * baseParams.admin_pct + good * baseParams.logistics_piece;
    const finance = good * baseParams.finance_piece;
    daily.push({date, rows, good, processed, revenue, materialRows, expenses: [
      ['人工', '成型/裁断计件工资', labor],
      ['制造', '能源（电/蒸汽）', energy],
      ['制造', '生产管理', productionMgmt],
      ['其他生产', '模具摊销', otherProduction],
      ['管理', '管理人员工资', management],
      ['销售', '销售费用及物流', selling],
      ['财务', '财务费用', finance]
    ]});
  }
  return {...s, end, sizes, sizeQty, production, materials, daily, baselineId: 'BASE-' + s.id, revisionId: 'REV-' + s.id};
}

// ---------------------------------------------------------------------------
// Minimal but valid OOXML writer: inline strings, grouped rows, named tables.
// ---------------------------------------------------------------------------
function sheetXml(rows, tableCount = 0) {
  const maxRow = Math.max(0, ...rows.map(r => r.row));
  const maxCol = Math.max(1, ...rows.flatMap(r => Object.keys(r.cells).map(Number)));
  const body = rows.filter(r => Object.keys(r.cells).length).sort((a, b) => a.row - b.row).map(r => {
    const cells = Object.entries(r.cells).sort((a, b) => a[0] - b[0]).map(([col, v]) => {
      const ref = colLetter(col) + r.row;
      if (v == null || v === '') return `<c r="${ref}"/>`;
      if (typeof v === 'number') return `<c r="${ref}" t="n"><v>${Number.isFinite(v) ? v : 0}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
    }).join('');
    return `<row r="${r.row}">${cells}</row>`;
  }).join('');
  const tableParts = tableCount ? `<tableParts count="${tableCount}">${Array.from({length: tableCount}, (_, i) => `<tablePart r:id="rId${i + 1}"/>`).join('')}</tableParts>` : '';
  return `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${colLetter(maxCol)}${maxRow}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetData>${body}</sheetData>${tableParts}</worksheet>`;
}
function workbookBytes(sheets) {
  const files = {};
  const content = ['<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'];
  const rels = [];
  const bookSheets = [];
  sheets.forEach((s, i) => {
    const n = i + 1;
    content.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    rels.push(`<Relationship Id="rId${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/>`);
    bookSheets.push(`<sheet name="${xmlEsc(s.name)}" sheetId="${n}" r:id="rId${n}"/>`);
    files[`xl/worksheets/sheet${n}.xml`] = strToU8(sheetXml(s.rows, s.tables?.length ?? 0));
    const tableRels = [];
    (s.tables ?? []).forEach((t, j) => {
      const tn = `${n}_${j}`;
      content.push(`<Override PartName="/xl/tables/table${tn}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`);
      tableRels.push(`<Relationship Id="rId${j + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="/xl/tables/table${tn}.xml"/>`);
      const cols = t.columns.map((c, k) => `<tableColumn id="${k + 1}" name="${xmlEsc(c)}"/>`).join('');
      files[`xl/tables/table${tn}.xml`] = strToU8(`<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${n * 10 + j + 1}" name="${xmlEsc(t.name)}" displayName="${xmlEsc(t.name)}" ref="${t.ref}" headerRowCount="1"><autoFilter ref="${t.ref}"/><tableColumns count="${t.columns.length}">${cols}</tableColumns><tableStyleInfo name="TableStyleMedium9" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`);
    });
    if (tableRels.length) files[`xl/worksheets/_rels/sheet${n}.xml.rels`] = strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tableRels.join('')}</Relationships>`);
  });
  content.push('</Types>');
  files['[Content_Types].xml'] = strToU8(content.join(''));
  files['_rels/.rels'] = strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  files['xl/workbook.xml'] = strToU8(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><sheets>${bookSheets.join('')}</sheets></workbook>`);
  files['xl/_rels/workbook.xml.rels'] = strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  files['xl/styles.xml'] = strToU8('<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><tableStyles count="0" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleLight16"/></styleSheet>');
  return Buffer.from(zipSync(files));
}

function rowsFrom(map) {
  return [...map.entries()].map(([row, cells]) => ({row, cells: Object.fromEntries([...cells].map(([col, v]) => [Number(col), v]))}));
}
function put(map, row, col, value) { if (!map.has(row)) map.set(row, new Map()); map.get(row).set(col, value); }

function costWorkbook(s) {
  const cost = new Map();
  ['参数ID', '费用或参数', '输入值'].forEach((h, i) => put(cost, 34, i + 1, h));
  const labels = {
    material_pct: '报价中材料占比', prep_piece: '准备计件单价（元/双）', press_piece: '压制计件单价（元/双）',
    production_mgmt: '生产管理费占收入比例', energy_pct: '能源费占收入比例', company_mgmt: '公司管理费占收入比例',
    admin_pct: '行政/销售费占收入比例', logistics_piece: '物流费（元/双）', production_loss_budget: '生产损耗预算占收入比例',
    defect_loss_budget: '不良损耗预算占收入比例', other_production_piece: '其他生产费用（元/双）', finance_piece: '财务费用（元/双）'
  };
  const params = {material_pct: s.materialPct, prep_piece: s.prep, press_piece: s.press, ...baseParams, other_production_piece: s.otherPiece};
  Object.entries(params).forEach(([k, v], i) => { put(cost, 35 + i, 1, k); put(cost, 35 + i, 2, labels[k]); put(cost, 35 + i, 3, v); });

  const info = new Map();
  put(info, 5, 1, '字段'); put(info, 5, 2, '填写值');
  const fields = [
    ['模板版本', 'A-ORDER-0.2'], ['订单ID', s.id], ['核算子项ID', 'LINE-1'], ['合同数量', s.quantity], ['核算报价', s.price],
    ['模拟标准重量', s.weight], ['生产覆盖开始', s.start], ['生产覆盖结束', s.end], ['预期基线版本', s.baselineId],
    ['数据修订版本', s.revisionId], ['时区', 'Asia/Shanghai'], ['是否模拟', '是'], ['产品', s.product], ['客户代号', s.customer],
    ['税口径', '模拟报价不拆税'], ['收入口径', '生产等价'], ['期初加工/不良', 0]
  ];
  fields.forEach(([k, v], i) => { put(info, 6 + i, 1, k); put(info, 6 + i, 2, v); });

  const recipe = new Map();
  ['材料编号', '材料名称', '原表配方量kg', '原表参考单价元/kg'].forEach((h, i) => put(recipe, 5, i + 1, h));
  s.materials.forEach((m, i) => { put(recipe, 6 + i, 1, m.id); put(recipe, 6 + i, 2, m.name); put(recipe, 6 + i, 3, m.share); put(recipe, 6 + i, 4, m.ref); });
  put(recipe, 5, 11, '码号'); put(recipe, 5, 12, '规格说明'); put(recipe, 5, 13, '分码合同量 双');
  s.sizes.forEach((z, i) => { put(recipe, 6 + i, 11, z.id); put(recipe, 6 + i, 12, z.spec); put(recipe, 6 + i, 13, s.sizeQty[i]); });

  const supp = new Map();
  ['补单记录ID', '订单ID', '核算子项ID', '发生日期', '码号', '补产数量双', '生产关联ID', '计入规则', '原因', '资料状态'].forEach((h, i) => put(supp, 5, i + 1, h));
  const suppRows = s.production.filter(p => p.defects > 0);
  suppRows.forEach((p, i) => {
    const sizeKey = p.size.replace('#', '');
    [ `${s.id}-SUP-${compactDate(p.date)}-${sizeKey}`, s.id, 'LINE-1', p.date, p.size, p.defects, `${s.id}-PROD-${compactDate(p.date)}-${sizeKey}`, '已含当日加工量与净耗，不重复计入', '不良返工/补产', '模拟确认'].forEach((v, j) => put(supp, 6 + i, j + 1, v));
  });

  const note = new Map();
  [['企盈智擎 · 模拟订单数据'], ['场景：' + s.title], [s.note], ['本工作簿为模拟数据，不含任何真实企业资料。'], ['导入时请同时选择本文件夹内的“每日”工作簿。']].forEach(([v], i) => put(note, i + 1, 1, v));

  return workbookBytes([
    {name: '成本计算', rows: rowsFrom(cost), tables: [{name: 'CostParameters', ref: 'A34:C46', columns: ['参数ID', '费用或参数', '输入值']}]},
    {name: '订单信息', rows: rowsFrom(info)},
    {name: '原订单用量', rows: rowsFrom(recipe), tables: [
      {name: 'OriginalRecipe', ref: `A5:D${5 + s.materials.length}`, columns: ['材料编号', '材料名称', '原表配方量kg', '原表参考单价元/kg']},
      {name: 'OriginalSizePlan', ref: `K5:M${5 + s.sizes.length}`, columns: ['码号', '规格说明', '分码合同量 双']}
    ]},
    {name: '补单用量', rows: rowsFrom(supp), tables: [{name: 'SupplementEvents', ref: `A5:J${5 + suppRows.length}`, columns: ['补单记录ID', '订单ID', '核算子项ID', '发生日期', '码号', '补产数量双', '生产关联ID', '计入规则', '原因', '资料状态']}]},
    {name: '说明', rows: rowsFrom(note)}
  ]);
}

function dailyWorkbook(s) {
  const prod = new Map();
  put(prod, 4, 1, 'AB-TIME-0.2 | 模拟订单数据');
  ['记录ID', '订单ID', '核算子项ID', '生产日期', '码号', '当日加工量', '当日不良量', '当日状态', '资料状态', '数据可见时间', '来源', '是否模拟', '预期基线版本', '数据修订版本'].forEach((h, i) => put(prod, 5, i + 1, h));
  const pRows = [...s.production].sort((a, b) => a.date.localeCompare(b.date) || a.size.localeCompare(b.size));
  pRows.forEach((p, i) => {
    const sizeKey = p.size.replace('#', '');
    [`${s.id}-PROD-${compactDate(p.date)}-${sizeKey}`, s.id, 'LINE-1', p.date, p.size, p.processed, p.defects, '已报工', '模拟确认', `${p.date}T23:59:59+08:00`, '模拟数据生成器', '是', s.baselineId, s.revisionId].forEach((v, j) => put(prod, 6 + i, j + 1, v));
  });

  const mat = new Map();
  ['记录ID', '订单ID', '核算子项ID', '发生日期', '材料编号', '实际净耗kg', '实际单价元/kg', '材料口径', '资料状态', '数据可见时间', '来源', '是否模拟', '预期基线版本', '数据修订版本'].forEach((h, i) => put(mat, 5, i + 1, h));
  let mr = 6;
  for (const d of s.daily) for (const m of d.materialRows) {
    [`${s.id}-MAT-${compactDate(d.date)}-${m.id.replaceAll('-', '')}`, s.id, 'LINE-1', d.date, m.id, Number(m.net.toFixed(3)), Number(m.actualPrice.toFixed(3)), 'actual_net', '模拟确认', `${d.date}T23:59:59+08:00`, '模拟数据生成器', '是', s.baselineId, s.revisionId].forEach((v, j) => put(mat, mr, j + 1, v));
    mr++;
  }

  const fee = new Map();
  ['记录ID', '订单ID', '核算子项ID', '发生日期', '成本类别', '费用项目', '计价方式', '实际金额元', '资料状态', '数据可见时间', '来源', '是否模拟', '预期基线版本', '数据修订版本'].forEach((h, i) => put(fee, 5, i + 1, h));
  let fr = 6;
  for (const d of s.daily) d.expenses.forEach(([cat, item, amount], k) => {
    [`${s.id}-FEE-${compactDate(d.date)}-${k}`, s.id, 'LINE-1', d.date, cat, item, '直接金额', Number(money2(amount)), '模拟确认', `${d.date}T23:59:59+08:00`, '模拟数据生成器', '是', s.baselineId, s.revisionId].forEach((v, j) => put(fee, fr, j + 1, v));
    fr++;
  });

  return workbookBytes([
    {name: '每日生产', rows: rowsFrom(prod), tables: [{name: 'DailyProductionCase', ref: `A5:N${5 + pRows.length}`, columns: ['记录ID', '订单ID', '核算子项ID', '生产日期', '码号', '当日加工量', '当日不良量', '当日状态', '资料状态', '数据可见时间', '来源', '是否模拟', '预期基线版本', '数据修订版本']}]},
    {name: '每日材料', rows: rowsFrom(mat), tables: [{name: 'DailyMaterialCase', ref: `A5:N${mr - 1}`, columns: ['记录ID', '订单ID', '核算子项ID', '发生日期', '材料编号', '实际净耗kg', '实际单价元/kg', '材料口径', '资料状态', '数据可见时间', '来源', '是否模拟', '预期基线版本', '数据修订版本']}]},
    {name: '每日费用', rows: rowsFrom(fee), tables: [{name: 'DailyExpenseCase', ref: `A5:N${fr - 1}`, columns: ['记录ID', '订单ID', '核算子项ID', '发生日期', '成本类别', '费用项目', '计价方式', '实际金额元', '资料状态', '数据可见时间', '来源', '是否模拟', '预期基线版本', '数据修订版本']}]}
  ]);
}

// ---------------------------------------------------------------------------
// Generate, normalize, evaluate and verify.
// ---------------------------------------------------------------------------
rmSync(outDir, {recursive: true, force: true});
rmSync(zipPath, {force: true});
mkdirSync(outDir, {recursive: true});

const metrics = [];
const failures = [];
for (const scenario of scenarios) {
  const s = buildScenario(scenario);
  const dir = path.join(outDir, s.folder);
  mkdirSync(dir, {recursive: true});
  const costPath = path.join(dir, `成本_${s.id}.xlsx`);
  const dailyPath = path.join(dir, `每日_${s.id}.xlsx`);
  const costBuf = costWorkbook(s), dailyBuf = dailyWorkbook(s);
  writeFileSync(costPath, costBuf); writeFileSync(dailyPath, dailyBuf);
  const normalized = normalizePair(readXlsx(costBuf), readXlsx(dailyBuf));
  const errors = normalized.issues.filter(x => x.severity === 'error');
  if (errors.length) { failures.push({id: s.id, errors}); continue; }
  const final = evaluate(normalized.dataset, {asOf: s.end});
  const finalMargin = Number(final.cumulative.actual.margin);
  const expectedMargin = Number(final.cumulative.expected.margin);
  const band = s.band === '高毛利' ? [0.22, 0.29] : s.band === '中毛利' ? [0.16, 0.21] : [0.065, 0.11];
  if (!(finalMargin >= band[0] && finalMargin <= band[1])) failures.push({id: s.id, reason: `margin ${finalMargin} outside ${band}`});
  if (final.quality.missing.length) failures.push({id: s.id, reason: `missing ${final.quality.missing.length}`});
  if (final.cumulative.quantity !== s.quantity) failures.push({id: s.id, reason: `quantity ${final.cumulative.quantity} != ${s.quantity}`});
  const defects = normalized.dataset.production.reduce((sum, p) => sum + Number(p.defects), 0);
  const supplements = normalized.dataset.supplements.reduce((sum, p) => sum + Number(p.quantity), 0);
  if (defects !== supplements) failures.push({id: s.id, reason: `defects ${defects} != supplements ${supplements}`});
  metrics.push({
    sid: s.id, band: s.band, title: s.title, folder: s.folder,
    start: s.start, end: s.end, days: s.days,
    contract: s.quantity, revenue: Number(final.cumulative.revenue),
    good: final.cumulative.quantity, processed: final.cumulative.processed, defects: final.cumulative.defects,
    defect_rate: Number((final.cumulative.defects / final.cumulative.processed).toFixed(6)),
    material: Number(final.cumulative.actual.material), labor: Number(final.cumulative.actual.costs['人工']),
    mfg: Number(final.cumulative.actual.costs['制造']), other: Number(final.cumulative.actual.costs['其他生产']),
    gross: Number(final.cumulative.actual.gross), margin: finalMargin,
    operating: Number(final.cumulative.actual.operating), operating_margin: Number((final.cumulative.actual.operating / final.cumulative.revenue).toFixed(6)),
    expected_ideal_gross: Number(final.cumulative.expected.gross), expected_ideal_margin: expectedMargin,
    gap_ideal: Number(final.cumulative.gap),
    severity: final.diagnosis.severity.level, severity_label: final.diagnosis.severity.label,
    quality: final.quality.state, missing: final.quality.missing.length,
    sizes: s.sizes.map(z => z.id), size_qty: s.sizeQty,
    materials: s.materials.map(m => m.id),
    cost_path: `${s.folder}/成本_${s.id}.xlsx`, daily_path: `${s.folder}/每日_${s.id}.xlsx`
  });
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
}
writeFileSync(path.join(outDir, 'scenario-metrics.json'), JSON.stringify(metrics, null, 2) + '\n');

// Common as-of snapshots: the direct module result, mirroring portfolio rows.
const commonDates = ['2026-10-10', '2026-10-17', '2026-10-24', '2026-10-27', '2026-11-01'];
const snapshots = commonDates.map(asOf => {
  const rows = metrics.map(m => {
    const ds = evaluate(normalizePair(readXlsx(readFileSync(path.join(outDir, m.cost_path))), readXlsx(readFileSync(path.join(outDir, m.daily_path)))).dataset, {asOf});
    return {id: m.sid, margin: Number(ds.cumulative.actual.margin), gross: Number(ds.cumulative.actual.gross), expected: Number(ds.cumulative.expected.gross), gap: Number(ds.cumulative.gap), progress: Number(ds.cumulative.progress), state: ds.quality.state};
  });
  return {
    asOf,
    count: rows.length,
    actualGross: rows.reduce((s, r) => s + r.gross, 0),
    expectedGross: rows.reduce((s, r) => s + r.expected, 0),
    gap: rows.reduce((s, r) => s + r.gap, 0),
    minMargin: Math.min(...rows.map(r => r.margin)),
    maxMargin: Math.max(...rows.map(r => r.margin)),
    allComplete: rows.every(r => r.state === 'complete'),
    rows
  };
});
writeFileSync(path.join(outDir, 'portfolio-snapshots.json'), JSON.stringify(snapshots, null, 2) + '\n');

// Import all 12 through the real local API and query the multi-order portfolio.
async function verifyApi(rows) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'qiying-sim-'));
  const app = createApp({root, dataDir: tmp});
  await new Promise((resolve, reject) => { app.once('error', reject); app.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${app.address().port}`;
  try {
    const token = (await (await fetch(base + '/api/import-v1/session')).json()).token;
    const headers = {Origin: base, 'X-Qiying-Token': token};
    const imports = [];
    for (const m of rows) {
      const fd = new FormData();
      fd.append('costFile', new Blob([readFileSync(path.join(outDir, m.cost_path))]), `成本_${m.sid}.xlsx`);
      fd.append('dailyFile', new Blob([readFileSync(path.join(outDir, m.daily_path))]), `每日_${m.sid}.xlsx`);
      const pr = await fetch(base + '/api/import-v1/previews', {method: 'POST', headers, body: fd});
      const preview = await pr.json();
      if (!pr.ok) throw new Error(`${m.sid} preview ${pr.status}: ${JSON.stringify(preview)}`);
      if (preview.issues.some(x => x.severity === 'error')) throw new Error(`${m.sid} preview errors`);
      const cr = await fetch(base + `/api/import-v1/previews/${preview.previewId}/commit`, {
        method: 'POST', headers: {...headers, 'Content-Type': 'application/json'},
        body: JSON.stringify({digest: preview.digest, allowIncomplete: preview.requiresIncomplete === true})
      });
      const committed = await cr.json();
      if (!cr.ok) throw new Error(`${m.sid} commit ${cr.status}: ${JSON.stringify(committed)}`);
      imports.push({id: m.sid, previewIssues: preview.issues.length, requiresIncomplete: preview.requiresIncomplete, commit: committed});
    }
    const orders = await (await fetch(base + '/api/import-v1/orders')).json();
    const portfolio = [];
    for (const asOf of commonDates) {
      const r = await fetch(base + `/api/import-v1/portfolio?asOf=${asOf}`);
      const p = await r.json();
      if (!r.ok) throw new Error(`portfolio ${asOf}: ${JSON.stringify(p)}`);
      portfolio.push({
        asOf, totals: p.totals, missing: p.orders.reduce((s, o) => s + o.quality.missing.length, 0),
        margins: p.orders.map(o => [o.order.id, Number(o.cumulative.actual.margin), o.quality.state])
      });
    }
    return {orders: orders.orders.length, imports, portfolio};
  } finally {
    await new Promise(resolve => app.close(resolve));
    rmSync(tmp, {recursive: true, force: true});
  }
}
const apiVerification = await verifyApi(metrics);
writeFileSync(path.join(outDir, 'api-verification.json'), JSON.stringify(apiVerification, null, 2) + '\n');

// README
const fmtPct = x => (x * 100).toFixed(2) + '%';
const fmtMoney = x => Number(x).toLocaleString('zh-CN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const byBand = band => metrics.filter(m => m.band === band);
const table = band => byBand(band).map(m => `| ${m.sid} | ${m.title} | ${fmtMoney(m.revenue)} | ${fmtMoney(m.gross)} | ${fmtPct(m.margin)} | ${fmtPct(m.operating_margin)} | ${fmtPct(m.expected_ideal_margin)} | ${fmtPct(m.defect_rate)} | ${m.severity_label} |`).join('\n');
const readme = `# 企盈智擎 · 多订单重合期模拟数据（2026-10）

共 12 个新增模拟订单（SIM-M01 至 SIM-M12），全部为合成数据，不含任何真实企业工作簿、客户、报价或个人信息。每单 30～31 天，开工日期集中在 **2026-09-28 至 2026-10-03**，结束日期为 **2026-10-27 至 2026-11-01**，因此大量订单在 10 月中下旬几乎同时在生产。

这一批用于验证“多订单、近乎重合时间、不同毛利水平”的利润分析：高毛利 4 单、适中毛利 4 单、低毛利 4 单。全部订单资料完整、全部为正毛利；生产、材料、七类每日费用和不良补单记录逐日齐备。

## 一、结果总览（截至各单结束日）

金额单位：元；毛利率 = 生产毛利 ÷ 收入；经营利润为再扣管理、销售、财务后的管理口径，不是审计净利润。判断列为页面“实际毛利率较同进度理论毛利率”的分级结果，不是预算参考阈值。

### 高毛利

| 订单ID | 场景 | 收入 | 生产毛利 | 毛利率 | 经营利润率 | 同进度理论毛利率 | 不良率 | 判断 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${table('高毛利')}

### 适中毛利

| 订单ID | 场景 | 收入 | 生产毛利 | 毛利率 | 经营利润率 | 同进度理论毛利率 | 不良率 | 判断 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${table('中毛利')}

### 低毛利

| 订单ID | 场景 | 收入 | 生产毛利 | 毛利率 | 经营利润率 | 同进度理论毛利率 | 不良率 | 判断 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${table('低毛利')}

低毛利订单的毛利率基数较小，即使绝对差距只有几分钱，折算成“相对下降”也会被放大；因此个别低毛利订单会显示黄色“需要关注”，这是分级规则的敏感度，不代表资料缺失或已经亏损。所有订单在结束日均为完整状态、正毛利。

## 二、推荐的多订单对照日期

这些日期对 12 单都有效，适合直接在同一天比较进度、累计毛利和少赚差距：

| 对照日期 | 订单状态 | 累计实际毛利合计 | 同进度理论毛利合计 | 少赚差距合计 | 毛利率区间 |
| --- | --- | ---: | ---: | ---: | --- |
${snapshots.map(s => `| ${s.asOf} | ${s.allComplete ? '全部完整' : '存在待补齐'} | ${fmtMoney(s.actualGross)} | ${fmtMoney(s.expectedGross)} | ${fmtMoney(s.gap)} | ${fmtPct(s.minMargin)}～${fmtPct(s.maxMargin)} |`).join('\n')}

- **2026-10-10**：三批订单都已开工 7～12 天，适合比较“同一天、不同开工进度”的累计结果。
- **2026-10-17**：12 单全部在产，进度约 47%～67%，最适合演示多订单监测。
- **2026-10-24**：早批接近尾声，中晚批仍在生产，适合看进度差异。
- **2026-10-27**：最早一批（09-28 开工）结束，其余仍在生产。
- **2026-11-01**：全部订单结束，适合做整单对照。

本次生成后已用真实本地接口逐单预览并确认 ${apiVerification.orders} 单，预览报错 0；多订单接口在上述 5 个日期均返回 ${apiVerification.orders} 单，缺失记录 0。核验明细见 \`api-verification.json\`。

## 三、覆盖的毛利水平

| 区间 | 订单 | 实际毛利率范围 | 主要特征 |
| --- | --- | ---: | --- |
| 高毛利 | SIM-M01～M04 | ${fmtPct(Math.min(...byBand('高毛利').map(m => m.margin)))}～${fmtPct(Math.max(...byBand('高毛利').map(m => m.margin)))} | 报价较高或原料价格偏低，规模摊薄，材料/人工波动小 |
| 适中毛利 | SIM-M05～M08 | ${fmtPct(Math.min(...byBand('中毛利').map(m => m.margin)))}～${fmtPct(Math.max(...byBand('中毛利').map(m => m.margin)))} | 常规报价与成本结构，含走量、小批多码、材料小幅上涨 |
| 低毛利 | SIM-M09～M12 | ${fmtPct(Math.min(...byBand('低毛利').map(m => m.margin)))}～${fmtPct(Math.max(...byBand('低毛利').map(m => m.margin)))} | 低报价、高材料占比，仍保持正毛利，适合测试薄利订单 |

## 四、导入方法

1. 启动网站，进入“数据导入”。
2. 打开任意场景文件夹，选择同文件夹内的 \`成本_*.xlsx\` 和 \`每日_*.xlsx\`。
3. 点击“解析并预览”，确认无报错后点击“确认导入”。
4. 进入“订单分析”，选择对应订单；把日期拉到该单结束日可看整单累计。
5. 12 单可以依次导入同一个网站，订单 ID 不同，互不覆盖。多订单监测页选择一个共同日期（推荐 2026-10-17）即可同时比较。

## 五、口径与注意事项

- 收入口径：生产等价；税口径：模拟报价不拆税；时区：Asia/Shanghai。
- 生产毛利 = 收入 − 材料 − 人工 − 制造 − 其他生产；经营利润再扣管理、销售、财务。
- 不良补产记录已包含在当日加工量和净耗中，计入规则为“已含”，不会重复追加产量或成本。
- 每日金额按分舍入后汇总，页面合计与手工复算可能相差几分钱，以页面为准。
- 本目录只含模拟数据；\`data/\` 是网站运行后保存导入结果的位置，不要用本目录覆盖它。
- 本批不是行业平均水平，也不是企业实际经营数据；毛利率高低由报价、材料占比、不良率和工价等模拟参数共同决定。

## 六、文件说明

- 每个场景一个文件夹，内含成本工作簿和每日工作簿各一份。
- \`scenario-metrics.json\`：12 单在结束日的核算结果，含收入、成本、毛利率、理论毛利率、判断等级和文件相对路径。
- \`portfolio-snapshots.json\`：5 个共同对照日期的逐单结果与合计，可用于核对多订单监测页面。
- \`api-verification.json\`：真实本地 API 的逐单预览、确认保存和多订单接口返回结果，用于核对导入链路。
`;
writeFileSync(path.join(outDir, 'README.md'), readme);

// Zip the folder, preserving the top-level folder name.
const zipEntries = {};
const walk = (dir, rel = '') => {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name), key = rel ? rel + '/' + name : name;
    if (statSync(full).isDirectory()) walk(full, key); else zipEntries[key] = new Uint8Array(readFileSync(full));
  }
};
walk(outDir, packageName);
writeFileSync(zipPath, Buffer.from(zipSync(zipEntries, {level: 6})));

console.log(JSON.stringify({outDir, zipPath, count: metrics.length, failures: failures.length, bands: Object.fromEntries(['高毛利', '中毛利', '低毛利'].map(b => [b, byBand(b).map(m => [m.sid, m.margin, m.severity])]))}, null, 2));
