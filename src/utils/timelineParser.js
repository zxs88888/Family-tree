export function parseTimeline(timelineStr) {
  if (!timelineStr || timelineStr.trim() === '') return []

  const eventStrings = timelineStr.split('|||').map(s => s.trim()).filter(Boolean)
  const events = []

  for (const eventStr of eventStrings) {
    const parts = eventStr.split('||').map(s => s.trim())
    if (parts.length < 1) continue

    const firstPart = parts[0] || ''
    const yearMatch = firstPart.match(/\[([^\]]+)\]\s*(.*)/)
    if (!yearMatch) continue

    const yearDisplay = yearMatch[1].trim()
    const rest = yearMatch[2].trim()
    const labelTitleMatch = rest.match(/^([^：:]*)[：:]\s*(.*)/)
    const label = labelTitleMatch ? labelTitleMatch[1].trim() : ''
    const title = labelTitleMatch ? labelTitleMatch[2].trim() : rest
    const desc = (parts[1] || '').replace(/\\\|/g, '|')
    const location = (parts[2] || '').replace(/\\\|/g, '|')

    let yearSort = null
    const eraMatch = yearDisplay.match(/(\d{4})\s*年代/)
    if (eraMatch) {
      yearSort = parseInt(eraMatch[1]) + 5
    } else {
      const shortEraMatch = yearDisplay.match(/(\d{2})\s*年代/)
      if (shortEraMatch) {
        yearSort = 1900 + parseInt(shortEraMatch[1]) + 5
      } else {
        const numMatch = yearDisplay.match(/(\d{4})/)
        if (numMatch) yearSort = parseInt(numMatch[1])
      }
    }

    events.push({ year_display: yearDisplay, year_sort: yearSort, event_type_label: label, event_title: title, description: desc, location })
  }

  return events
}

export function detectDuplicateNames(rows) {
  const nameCount = new Map()
  const errors = []
  rows.forEach((row, index) => {
    const name = row.姓名
    if (!name) return
    if (nameCount.has(name)) {
      errors.push(`第 ${index + 2} 行：姓名"${name}"与第 ${nameCount.get(name)} 行重复，请添加后缀区分`)
    } else {
      nameCount.set(name, index + 2)
    }
  })
  return errors
}

export function detectCircularDependency(rows, nameToRow) {
  const errors = []
  const visited = new Set()
  const recursionStack = new Set()

  function dfs(name, path) {
    if (recursionStack.has(name)) {
      errors.push(`检测到循环依赖：${path.join(' → ')} → ${name}`)
      return
    }
    if (visited.has(name)) return
    visited.add(name)
    recursionStack.add(name)
    const row = nameToRow.get(name)
    if (row) {
      if (row.父亲 && nameToRow.has(row.父亲)) dfs(row.父亲, [...path, name])
      if (row.母亲 && nameToRow.has(row.母亲)) dfs(row.母亲, [...path, name])
    }
    recursionStack.delete(name)
  }

  for (const [name] of nameToRow) {
    if (!visited.has(name)) dfs(name, [])
  }
  return errors
}

export function resolveReferences(rows, nameToRow, familyId, existingMembers) {
  const existingMap = new Map()
  existingMembers?.forEach(m => {
    existingMap.set(m.name, m.id)
  })

  const members = []
  const events = []

  for (const row of rows) {
    const memberId = crypto.randomUUID()

    const resolveName = (name) => {
      if (!name) return null
      // 文件内优先
      for (const [n, r] of nameToRow) {
        if (n === name && r.姓名 === name) {
          return members.find(m => m.name === name)?.id || existingMap.get(name)
        }
      }
      // 数据库回退
      return existingMap.get(name) || null
    }

    members.push({
      id: memberId,
      family_id: familyId,
      name: row.姓名,
      gender: row.性别 ? parseInt(row.性别) : null,
      birth_year: row.生年 ? parseInt(row.生年) : null,
      death_year: row.卒年 ? parseInt(row.卒年) : null,
      is_alive: !row.卒年,
      biography: row.生平简介 || null,
      father_id: resolveName(row.父亲),
      mother_id: resolveName(row.母亲),
      spouse_id: resolveName(row.配偶),
      is_deleted: false,
    })

    // 解析时间线
    if (row.时间线) {
      const parsed = parseTimeline(row.时间线)
      parsed.forEach(e => {
        events.push({ ...e, member_id: memberId })
      })
    }
  }

  return { members, events }
}
