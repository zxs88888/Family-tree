import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// 从项目根目录 .env 读取 Supabase 凭据（避免硬编码入库）
const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const envPath = resolve(rootDir, '.env')
if (!existsSync(envPath)) {
  console.error('未找到 .env 文件，请在项目根目录创建并配置 TARO_APP_SUPABASE_URL 与 TARO_APP_SUPABASE_ANON_KEY')
  process.exit(1)
}
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const SUPABASE_URL = env.TARO_APP_SUPABASE_URL
const KEY = env.TARO_APP_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !KEY) {
  console.error('.env 缺少 TARO_APP_SUPABASE_URL 或 TARO_APP_SUPABASE_ANON_KEY')
  process.exit(1)
}

// CSV 文件路径：优先用命令行参数，默认项目根目录的 族谱_永康支.csv
const csvArg = process.argv[2]
const csvPath = csvArg ? resolve(process.cwd(), csvArg) : resolve(rootDir, '族谱_永康支.csv')
if (!existsSync(csvPath)) {
  console.error('未找到 CSV 文件:', csvPath)
  process.exit(1)
}
console.log('导入 CSV:', csvPath)

function parseCsvRows(text) {
  const rows = []; let row = []; let f = ''; let q = false; let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (i + 1 < text.length && text[i + 1] === '"') { f += '"'; i += 2; } else { q = false; i++; } }
      else { f += c; i++; }
    } else {
      if (c === '"') { q = true; i++; }
      else if (c === ',') { row.push(f.trim()); f = ''; i++; }
      else if (c === '\r') { row.push(f.trim()); f = ''; if (row.some(x => x !== '')) rows.push(row); row = []; i++; if (i < text.length && text[i] === '\n') i++; }
      else if (c === '\n') { row.push(f.trim()); f = ''; if (row.some(x => x !== '')) rows.push(row); row = []; i++; }
      else { f += c; i++; }
    }
  }
  if (f || row.length > 0) { row.push(f.trim()); if (row.some(x => x !== '')) rows.push(row); }
  return rows;
}

function parseTimeline(tl) {
  if (!tl || !tl.trim()) return [];
  const evs = [];
  for (const seg of tl.split('|||')) {
    const t = seg.trim(); if (!t) continue;
    const m = t.match(/^\[(\d{4})\]\s*([^：:]+)[：:]\s*(.*)$/); if (!m) continue;
    const parts = m[3].trim().split('||').map(p => p.trim());
    evs.push({ year: parseInt(m[1], 10), label: m[2].trim(), title: parts[0] || m[2].trim(), description: parts[1] || '', location: parts[2] || '' });
  }
  return evs;
}

const MARRIAGE = ['元配', '次配', '三配', '四配', '末配'];
const mt = o => o <= 0 ? '元配' : (o >= MARRIAGE.length ? '末配' : MARRIAGE[o - 1]);

const content = readFileSync(csvPath, 'utf-8').replace(/^\uFEFF/, '');
const rows = parseCsvRows(content);
const header = rows[0]; const hm = new Map(); header.forEach((h, i) => hm.set(h, i));
const g = n => { const i = hm.get(n); return i !== undefined ? i : -1; };

const members = []; const spouses = []; const events = [];
const spouseCount = new Map();
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const name = row[g('姓名')] || ''; if (!name) continue;
  const gender = row[g('性别')] === '2' ? 2 : 1;
  const birth = row[g('生年')] || ''; const death = row[g('卒年')] || '';
  const bio = row[g('生平简介')] || '';
  members.push({ name, gender, birth_year: birth, death_year: death, is_alive: !death, biography: bio, father_name: row[g('父亲')] || '', mother_name: row[g('母亲')] || '' });
  const spouseName = row[g('配偶')] || '';
  if (spouseName) {
    const mc = (spouseCount.get(name) || 0) + 1; spouseCount.set(name, mc);
    const sc = (spouseCount.get(spouseName) || 0) + 1; spouseCount.set(spouseName, sc);
    spouses.push({ member_name: name, spouse_name: spouseName, marriage_order: mc, marriage_type: mt(mc), reverse_order: sc, reverse_type: mt(sc) });
  }
  const evs = parseTimeline(row[g('时间线')] || '');
  evs.forEach((e, i) => events.push({ member_name: name, label: e.label, title: e.title, year_display: String(e.year), year_sort: String(e.year), location: e.location, description: e.description, sort_order: i }));
}
console.log('成员:', members.length, '配偶关系:', spouses.length, '事件:', events.length);

const resp = await fetch(SUPABASE_URL + "/rest/v1/rpc/import_family_data", {
  method: "POST",
  headers: { "apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ json_data: { members, spouses, events } })
});
const result = await resp.json();
console.log('导入结果:', JSON.stringify(result));
