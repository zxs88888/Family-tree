/**
 * 数据导入器
 * 将解析后的 CSV 数据组装为 RPC 所需的 JSONB 结构，并调用 Supabase RPC 执行导入
 */

import { supabase } from '@/utils/supabase'
import type { ParsedMember, ParsedEvent } from '@/utils/csvParser'

export interface ImportReport {
  inserted: number
  updated?: number
  skipped?: number
  errors: number
  error_message?: string
}

/** RPC 所需的成员数据结构 */
interface RpcMember {
  name: string
  gender: number
  birth_year: string
  death_year: string
  is_alive: boolean
  biography: string
  father_name: string
  mother_name: string
}

/** RPC 所需的配偶关系数据结构 */
interface RpcSpouse {
  member_name: string
  spouse_name: string
  marriage_order: number
  marriage_type: string
  reverse_order: number
  reverse_type: string
}

/** RPC 所需的事件数据结构 */
interface RpcEvent {
  member_name: string
  label: string
  title: string
  year_display: string
  year_sort: string
  location: string
  description: string
  sort_order: number
}

/** RPC 所需的完整 JSON 结构 */
interface ImportPayload {
  members: RpcMember[]
  spouses: RpcSpouse[]
  events: RpcEvent[]
}

// 婚配类型映射
const MARRIAGE_TYPES = ['元配', '次配', '三配', '四配', '末配']

function getMarriageType(order: number): string {
  if (order <= 0) return '元配'
  if (order >= MARRIAGE_TYPES.length) return '末配'
  return MARRIAGE_TYPES[order - 1]
}

/**
 * 将解析后的成员数据组装为 RPC 导入结构
 */
export function prepareImportData(members: ParsedMember[]): ImportPayload {
  const rpcMembers: RpcMember[] = []
  const rpcSpouses: RpcSpouse[] = []
  const rpcEvents: RpcEvent[] = []

  // 跟踪每个成员的配偶计数（用于推断 marriage_order）
  const spouseCountMap = new Map<string, number>()

  for (const member of members) {
    // 组装成员数据
    const isAlive = !member.deathYear
    rpcMembers.push({
      name: member.name,
      gender: member.gender,
      birth_year: member.birthYear?.toString() || '',
      death_year: member.deathYear?.toString() || '',
      is_alive: isAlive,
      biography: member.biography || '',
      father_name: member.fatherName || '',
      mother_name: member.motherName || '',
    })

    // 处理配偶关系
    if (member.spouseName) {
      // 获取当前成员对此配偶的婚配顺序
      const currentCount = spouseCountMap.get(member.name) || 0
      const memberOrder = currentCount + 1
      spouseCountMap.set(member.name, memberOrder)

      // 获取配偶对当前成员的婚配顺序
      const spouseCount = spouseCountMap.get(member.spouseName) || 0
      const spouseOrder = spouseCount + 1
      spouseCountMap.set(member.spouseName, spouseOrder)

      rpcSpouses.push({
        member_name: member.name,
        spouse_name: member.spouseName,
        marriage_order: memberOrder,
        marriage_type: getMarriageType(memberOrder),
        reverse_order: spouseOrder,
        reverse_type: getMarriageType(spouseOrder),
      })
    }

    // 处理生活事件
    for (let i = 0; i < member.events.length; i++) {
      const event = member.events[i]
      rpcEvents.push({
        member_name: member.name,
        label: event.label,
        title: event.title,
        year_display: event.year.toString(),
        year_sort: event.year.toString(),
        location: event.location || '',
        description: event.description || '',
        sort_order: i,
      })
    }
  }

  return {
    members: rpcMembers,
    spouses: rpcSpouses,
    events: rpcEvents,
  }
}

/**
 * 执行数据导入
 * 调用 Supabase RPC 在数据库端事务性执行
 */
export async function executeImport(members: ParsedMember[]): Promise<ImportReport> {
  const payload = prepareImportData(members)

  const { data, error } = await supabase.rpc('import_family_data', {
    json_data: payload,
  })

  if (error) {
    return {
      inserted: 0,
      skipped: 0,
      errors: 1,
      error_message: error.message,
    }
  }

  return data as ImportReport
}

/**
 * 清空现有家族数据（重新导入前调用，避免数据累积污染）
 */
export async function clearExistingData(): Promise<{ deleted: number; error?: string }> {
  const { data, error } = await supabase.rpc('clear_family_data')
  if (error) {
    return { deleted: 0, error: error.message }
  }
  return { deleted: (data as any)?.deleted ?? 0 }
}

/**
 * 查询数据库中已有的成员名称列表
 * 用于跨文件引用检测
 */
export async function getExistingMemberNames(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('members')
    .select('name')
    .eq('is_deleted', false)

  if (error) {
    console.error('[dataImporter] getExistingMemberNames error:', error.message)
    return new Set()
  }

  return new Set(data.map(row => row.name))
}
