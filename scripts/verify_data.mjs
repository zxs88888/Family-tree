// 数据完整性核对：CSV vs Supabase 数据库全量对比
// 用法: node scripts/verify_data.mjs [csv路径]
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const envPath = resolve(rootDir, '.env')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const SUPABASE_URL = env.TARO_APP_SUPABASE_URL
const KEY = env.TARO_APP_SUPABASE_ANON_KEY

const csvArg = process.argv[2]
const csvPath = csvArg ? resolve(process.cwd(), csvArg) : resolve(rootDir, '族谱_永康支.csv')

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

const content = readFileSync(csvPath, 'utf-8').replace(/^\uFEFF/, '')
const rows = parseCsvRows(content)
const header = rows[0]; const hm = new Map(); header.forEach((h, i) => hm.set(h, i))
const g = n => { const i = hm.get(n); return i !== undefined ? i : -1; }

// ========== 解析 CSV ==========
const csvMembers = [] // {name, gender, birth, death, father, mother, spouse, timelineCount}
const csvEvents = [] // {member, year, label, title}
const csvPairs = new Set() // 配偶对
for (let r = 1; r < rows.length; r++) {
  const row = rows[r]
  const name = row[g('姓名')] || ''; if (!name) continue
  const spouse = row[g('配偶')] || ''
  const evs = parseTimeline(row[g('时间线')] || '')
  csvMembers.push({
    name,
    gender: row[g('性别')] === '2' ? 2 : 1,
    birth: row[g('生年')] || '',
    death: row[g('卒年')] || '',
    father: row[g('父亲')] || '',
    mother: row[g('母亲')] || '',
    spouse,
    timelineCount: evs.length,
  })
  for (const e of evs) csvEvents.push({ member: name, year: e.year, label: e.label, title: e.title })
  if (spouse) {
    csvPairs.add(name < spouse ? `${name}|${spouse}` : `${spouse}|${name}`)
  }
}

// ========== 拉取数据库 ==========
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY }
const dbMembers = await (await fetch(SUPABASE_URL + '/rest/v1/members?select=id,name,gender,birth_year,death_year,father_id,mother_id,is_deleted&order=name', { headers: H })).json()
const dbSpouses = await (await fetch(SUPABASE_URL + '/rest/v1/spouses?select=member_id,spouse_id&order=member_id', { headers: H })).json()
const dbEvents = await (await fetch(SUPABASE_URL + '/rest/v1/life_events?select=member_id,event_type_label,event_title,year_display&order=member_id', { headers: H })).json()

const activeDb = dbMembers.filter(m => !m.is_deleted)
const dbNameMap = new Map(activeDb.map(m => [m.name, m]))
const dbIdName = new Map(activeDb.map(m => [m.id, m.name]))
const dbPairs = new Set(dbSpouses.map(s => {
  const a = dbIdName.get(s.member_id) || s.member_id
  const b = dbIdName.get(s.spouse_id) || s.spouse_id
  return a < b ? `${a}|${b}` : `${b}|${a}`
}))

const issues = []
const report = (cat, msg) => { issues.push(`[${cat}] ${msg}`) }

// ========== 1. 成员对比 ==========
const csvNames = new Set(csvMembers.map(m => m.name))
const dbNames = new Set(activeDb.map(m => m.name))
for (const n of csvNames) if (!dbNames.has(n)) report('成员缺失', `CSV 有但数据库无: ${n}`)
for (const n of dbNames) if (!csvNames.has(n)) report('成员多余', `数据库有但 CSV 无: ${n}`)
console.log('成员数: CSV', csvMembers.length, '| DB(未删除)', activeDb.length, '| 差异项:', issues.filter(i => i.startsWith('[成员')).length)

// 字段对比
let fieldDiff = 0
for (const c of csvMembers) {
  const d = dbNameMap.get(c.name)
  if (!d) continue
  if (c.gender !== d.gender) { fieldDiff++; report('性别不符', `${c.name}: CSV=${c.gender} DB=${d.gender}`) }
  const cb = c.birth || null, db = d.birth_year == null ? null : String(d.birth_year)
  if (cb !== db) { fieldDiff++; report('生年不符', `${c.name}: CSV=${cb || '空'} DB=${db || '空'}`) }
  const cd = c.death || null, dd = d.death_year == null ? null : String(d.death_year)
  if (cd !== dd) { fieldDiff++; report('卒年不符', `${c.name}: CSV=${cd || '空'} DB=${dd || '空'}`) }
}
console.log('字段差异:', fieldDiff)

// 父子关系对比
let parentDiff = 0
for (const c of csvMembers) {
  const d = dbNameMap.get(c.name)
  if (!d) continue
  const df = d.father_id ? (dbIdName.get(d.father_id) || '?') : ''
  const dm = d.mother_id ? (dbIdName.get(d.mother_id) || '?') : ''
  if ((c.father || '') !== df) { parentDiff++; report('父亲不符', `${c.name}: CSV=${c.father || '空'} DB=${df || '空'}`) }
  if ((c.mother || '') !== dm) { parentDiff++; report('母亲不符', `${c.name}: CSV=${c.mother || '空'} DB=${dm || '空'}`) }
}
console.log('父子关系差异:', parentDiff)

// ========== 2. 配偶对比 ==========
let pairMiss = 0
for (const p of csvPairs) if (!dbPairs.has(p)) { pairMiss++; report('配偶缺失', `CSV 有但 DB 无: ${p.replace('|', ' + ')}`) }
for (const p of dbPairs) if (!csvPairs.has(p)) { pairMiss++; report('配偶多余', `DB 有但 CSV 无: ${p.replace('|', ' + ')}`) }
console.log('配偶对: CSV', csvPairs.size, '| DB', dbPairs.size, '| 差异:', pairMiss)

// ========== 3. 事件对比 ==========
const csvEventKey = new Set(csvEvents.map(e => `${e.member}|${e.year}|${e.label}|${e.title}`))
const dbEventKey = new Set(dbEvents.map(e => `${dbIdName.get(e.member_id) || '?'}|${e.year_display}|${e.event_type_label}|${e.event_title}`))
let evMiss = 0, evExtra = 0
for (const k of csvEventKey) if (!dbEventKey.has(k)) { evMiss++; report('事件缺失', k.split('|').slice(0, 2).join(' ')) }
for (const k of dbEventKey) if (!csvEventKey.has(k)) { evExtra++; report('事件多余', k.split('|').slice(0, 2).join(' ')) }
console.log('事件: CSV', csvEvents.length, '| DB', dbEvents.length, '| 缺失:', evMiss, '| 多余:', evExtra)

// ========== 输出 ==========
console.log('\n===== 完整差异报告 =====')
if (issues.length === 0) console.log('✅ 全部一致，无任何差异')
else issues.forEach(i => console.log(i))
