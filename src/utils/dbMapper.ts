import type { Member, SpouseRelation } from '@/utils/treeTypes'

/** DB members 表行类型 */
export interface DbMemberRow {
  id: string
  family_id: string
  name: string
  gender: 1 | 2
  birth_year: number | null
  death_year: number | null
  is_alive: boolean
  biography: string | null
  avatar_url: string | null
  father_id: string | null
  mother_id: string | null
  generation: number | null
  is_deleted: boolean
}

/** DB spouses 表行类型 */
export interface DbSpouseRow {
  id: string
  member_id: string
  spouse_id: string
  marriage_order: number
  marriage_type: string | null
}

/**
 * 将 DB members 行转换为前端 Member 对象
 */
export function mapDbMember(row: DbMemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    gender: row.gender,
    birthYear: row.birth_year ?? undefined,
    deathYear: row.death_year ?? undefined,
    isAlive: row.is_alive,
    biography: row.biography ?? undefined,
    fatherId: row.father_id ?? undefined,
    motherId: row.mother_id ?? undefined,
    spouses: [], // 后续由 mapDbSpouses 填充
  }
}

/**
 * 将 DB spouses 行映射到对应 Member 的 spouses 数组
 */
export function mapDbSpouses(spouseRows: DbSpouseRow[], members: Member[]): void {
  const memberMap = new Map<string, Member>()
  for (const m of members) {
    memberMap.set(m.id, m)
  }

  for (const row of spouseRows) {
    const member = memberMap.get(row.member_id)
    if (!member) continue

    const relation: SpouseRelation = {
      spouseId: row.spouse_id,
      marriageOrder: row.marriage_order,
      marriageType: row.marriage_type || '元配',
    }
    member.spouses.push(relation)
  }

  // 按 marriageOrder 排序
  for (const m of members) {
    m.spouses.sort((a, b) => a.marriageOrder - b.marriageOrder)
  }
}
