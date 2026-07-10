import { parseYearSort } from "./constants";

function generateId() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function parseTimeline(timelineStr) {
  if (!timelineStr || timelineStr.trim() === "") return [];

  const eventStrings = timelineStr
    .split("|||")
    .map((s) => s.trim())
    .filter(Boolean);
  const events = [];

  for (const eventStr of eventStrings) {
    const parts = eventStr.split("||").map((s) => s.trim());
    if (parts.length < 1) continue;

    const firstPart = parts[0] || "";
    const yearMatch = firstPart.match(/\[([^\]]+)\]\s*(.*)/);
    if (!yearMatch) continue;

    const yearDisplay = yearMatch[1].trim();
    const rest = yearMatch[2].trim();
    const labelTitleMatch = rest.match(/^([^：:]*)[：:]\s*(.*)/);
    const label = labelTitleMatch ? labelTitleMatch[1].trim() : "";
    const title = labelTitleMatch ? labelTitleMatch[2].trim() : rest;
    const desc = (parts[1] || "").replace(/\\\|/g, "|");
    const location = (parts[2] || "").replace(/\\\|/g, "|");

    events.push({
      year_display: yearDisplay,
      year_sort: parseYearSort(yearDisplay),
      event_type_label: label,
      event_title: title,
      description: desc,
      location,
    });
  }

  return events;
}

export function detectDuplicateNames(rows) {
  const nameCount = new Map();
  const errors = [];
  rows.forEach((row, index) => {
    const name = row.姓名;
    if (!name) return;
    if (nameCount.has(name)) {
      errors.push(
        `第 ${index + 2} 行：姓名"${name}"与第 ${nameCount.get(name)} 行重复，请添加后缀区分`,
      );
    } else {
      nameCount.set(name, index + 2);
    }
  });
  return errors;
}

export function detectCircularDependency(rows, nameToRow) {
  const errors = [];
  const visited = new Set();
  const recursionStack = new Set();

  function dfs(name, path) {
    if (recursionStack.has(name)) {
      errors.push(`检测到循环依赖：${path.join(" → ")} → ${name}`);
      return;
    }
    if (visited.has(name)) return;
    visited.add(name);
    recursionStack.add(name);
    const row = nameToRow.get(name);
    if (row) {
      if (row.父亲 && nameToRow.has(row.父亲)) dfs(row.父亲, [...path, name]);
      if (row.母亲 && nameToRow.has(row.母亲)) dfs(row.母亲, [...path, name]);
    }
    recursionStack.delete(name);
  }

  for (const [name] of nameToRow) {
    if (!visited.has(name)) dfs(name, []);
  }
  return errors;
}

export function resolveReferences(rows, nameToRow, familyId, existingMembers) {
  const existingMap = new Map();
  existingMembers?.forEach((m) => {
    existingMap.set(m.name, m.id);
  });

  // 预先为每个姓名分配 id：保证文件内互相引用（如配偶）不依赖行顺序即可解析
  const idMap = new Map();
  rows.forEach((row) => {
    if (row.姓名) {
      idMap.set(row.姓名, existingMap.get(row.姓名) || generateId());
    }
  });

  const members = [];
  const events = [];

  for (const row of rows) {
    const memberId = idMap.get(row.姓名);
    const isExisting = existingMap.has(row.姓名);

    const resolveName = (name) => {
      if (!name) return null;
      // 文件内姓名优先（不依赖行顺序）
      if (idMap.has(name)) return idMap.get(name);
      // 数据库回退
      return existingMap.get(name) || null;
    };

    // 已存在的成员：CSV 中留空的字段用 undefined（Supabase 不会发送该字段），
    // 避免 upsert 时把库里已有数据清空；仅更新 CSV 实际填写的字段。
    const opt = (csvVal, parsed) => (csvVal ? parsed : isExisting ? undefined : null);
    const relField = (csvName) => {
      if (!csvName) return isExisting ? undefined : null;
      const rid = resolveName(csvName);
      return rid || (isExisting ? undefined : null);
    };

    members.push({
      id: memberId,
      family_id: familyId,
      name: row.姓名,
      gender: opt(row.性别, parseInt(row.性别)),
      birth_year: opt(row.生年, parseInt(row.生年)),
      death_year: opt(row.卒年, parseInt(row.卒年)),
      is_alive: row.卒年 ? false : isExisting ? undefined : true,
      biography: row.生平简介 || (isExisting ? undefined : null),
      father_id: relField(row.父亲),
      mother_id: relField(row.母亲),
      spouse_id: relField(row.配偶),
      is_deleted: false,
    });

    // 解析时间线
    if (row.时间线) {
      const parsed = parseTimeline(row.时间线);
      parsed.forEach((e) => {
        events.push({ ...e, member_id: memberId });
      });
    }
  }

  return { members, events };
}
