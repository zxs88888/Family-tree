/**
 * CSV 解析器
 * 支持 UTF-8 BOM / GBK 编码检测，带引号字段，时间线解析
 */

export interface ParsedEvent {
  year: number
  label: string
  title: string
  description?: string
  location?: string
}

export interface ParsedMember {
  name: string
  gender: 1 | 2
  fatherName: string
  motherName: string
  spouseName: string
  birthYear?: number
  deathYear?: number
  biography?: string
  events: ParsedEvent[]
}

export interface ParseResult {
  members: ParsedMember[]
  errors: string[]
}

/**
 * 检测并解码文件内容
 * 优先尝试 UTF-8，若出现替换字符则 fallback 到 GBK
 */
export function decodeFileContent(buffer: ArrayBuffer): string {
  // 尝试 UTF-8
  const utf8Decoder = new TextDecoder('utf-8', { fatal: false })
  const utf8Text = utf8Decoder.decode(buffer)

  // 检测是否有替换字符（表示解码失败）
  if (!utf8Text.includes('\uFFFD')) {
    // 移除 BOM
    return utf8Text.replace(/^\uFEFF/, '')
  }

  // Fallback 到 GBK
  try {
    const gbkDecoder = new TextDecoder('gbk', { fatal: false })
    return gbkDecoder.decode(buffer)
  } catch {
    // 如果 GBK 也不支持，返回 UTF-8 结果
    return utf8Text.replace(/^\uFEFF/, '')
  }
}

/**
 * 解析 CSV 文本为行数组
 * 正确处理带引号字段和字段内换行
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        // 检查是否是转义引号 ""
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"'
          i += 2
        } else {
          // 引号结束
          inQuotes = false
          i++
        }
      } else {
        currentField += char
        i++
      }
    } else {
      if (char === '"') {
        inQuotes = true
        i++
      } else if (char === ',') {
        currentRow.push(currentField.trim())
        currentField = ''
        i++
      } else if (char === '\r') {
        // 处理 \r\n 或单独的 \r
        currentRow.push(currentField.trim())
        currentField = ''
        if (currentRow.some(f => f !== '')) {
          rows.push(currentRow)
        }
        currentRow = []
        i++
        if (i < text.length && text[i] === '\n') {
          i++
        }
      } else if (char === '\n') {
        currentRow.push(currentField.trim())
        currentField = ''
        if (currentRow.some(f => f !== '')) {
          rows.push(currentRow)
        }
        currentRow = []
        i++
      } else {
        currentField += char
        i++
      }
    }
  }

  // 处理最后一个字段/行
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some(f => f !== '')) {
      rows.push(currentRow)
    }
  }

  return rows
}

/**
 * 解析时间线字符串
 * 格式：[年份] 标签：标题 || 描述 || 地点 ||| [年份] ...
 */
export function parseTimeline(timeline: string): ParsedEvent[] {
  if (!timeline || !timeline.trim()) return []

  const events: ParsedEvent[] = []
  // 按 ||| 分割多个事件
  const segments = timeline.split('|||')

  for (const segment of segments) {
    const trimmed = segment.trim()
    if (!trimmed) continue

    // 匹配 [年份] 标签：标题
    const match = trimmed.match(/^\[(\d{4})\]\s*([^：:]+)[：:]\s*(.*)$/)
    if (!match) continue

    const year = parseInt(match[1], 10)
    const label = match[2].trim()
    const rest = match[3].trim()

    // 按 || 分割：标题 || 描述 || 地点
    const parts = rest.split('||').map(p => p.trim())
    const title = parts[0] || label
    const description = parts[1] || undefined
    const location = parts[2] || undefined

    events.push({
      year,
      label,
      title,
      description: description || undefined,
      location: location || undefined,
    })
  }

  return events
}

/**
 * 解析 CSV 文件内容为成员数组
 */
export function parseCsv(content: string): ParseResult {
  const errors: string[] = []
  const members: ParsedMember[] = []

  const rows = parseCsvRows(content)

  if (rows.length < 2) {
    errors.push('CSV 文件至少需要包含表头和一行数据')
    return { members, errors }
  }

  // 验证表头
  const header = rows[0]
  const expectedHeaders = ['姓名', '性别', '父亲', '母亲', '配偶', '生年', '卒年', '生平简介', '时间线']
  const headerMap = new Map<string, number>()

  for (let i = 0; i < header.length; i++) {
    headerMap.set(header[i], i)
  }

  // 检查必要列
  if (!headerMap.has('姓名')) {
    errors.push('CSV 缺少必要列：姓名')
    return { members, errors }
  }

  // 解析数据行
  for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx]
    const lineNum = rowIdx + 1

    try {
      const name = getField(row, headerMap, '姓名')
      if (!name) {
        errors.push(`第 ${lineNum} 行：缺少姓名`)
        continue
      }

      const genderStr = getField(row, headerMap, '性别')
      const gender = genderStr === '2' ? 2 : 1

      const birthYearStr = getField(row, headerMap, '生年')
      const deathYearStr = getField(row, headerMap, '卒年')
      const timelineStr = getField(row, headerMap, '时间线')

      const member: ParsedMember = {
        name,
        gender: gender as 1 | 2,
        fatherName: getField(row, headerMap, '父亲'),
        motherName: getField(row, headerMap, '母亲'),
        spouseName: getField(row, headerMap, '配偶'),
        birthYear: birthYearStr ? parseInt(birthYearStr, 10) || undefined : undefined,
        deathYear: deathYearStr ? parseInt(deathYearStr, 10) || undefined : undefined,
        biography: getField(row, headerMap, '生平简介') || undefined,
        events: parseTimeline(timelineStr),
      }

      // 推断 is_alive：有卒年则已故
      members.push(member)
    } catch (err: any) {
      errors.push(`第 ${lineNum} 行解析失败：${err.message}`)
    }
  }

  return { members, errors }
}

/**
 * 安全获取字段值
 */
function getField(row: string[], headerMap: Map<string, number>, fieldName: string): string {
  const idx = headerMap.get(fieldName)
  if (idx === undefined || idx >= row.length) return ''
  return row[idx] || ''
}
