import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Member, LifeEvent } from '@/utils/treeTypes'
import { seedMembers } from '@/data/seed'
import { supabase } from '@/utils/supabase'
import { mapDbMember, mapDbSpouses } from '@/utils/dbMapper'
import type { DbMemberRow, DbSpouseRow } from '@/utils/dbMapper'

export const useFamilyStore = defineStore('family', () => {
  const members = ref<Member[]>([])
  const lifeEvents = ref<LifeEvent[]>([])
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)
  const rootMemberId = ref<string | null>(null)

  const rootMember = computed(() => {
    if (rootMemberId.value) {
      return members.value.find(m => m.id === rootMemberId.value)
    }
    // fallback: 查找没有父亲的最早男性成员
    return members.value.find(m => m.name === '永康')
  })

  /**
   * 从 Supabase 数据库加载家族数据
   */
  async function loadFromDatabase(): Promise<boolean> {
    isLoading.value = true
    loadError.value = null

    try {
      // 1. 获取家族信息（含 root_member_id）
      const { data: familyData, error: familyError } = await supabase.rpc('get_family_info')
      if (familyError) throw new Error(familyError.message)

      if (familyData && familyData.length > 0) {
        rootMemberId.value = familyData[0].root_member_id
      }

      // 2. 查询所有成员
      const { data: memberRows, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('is_deleted', false)

      if (memberError) throw new Error(memberError.message)

      // 3. 查询所有配偶关系
      const { data: spouseRows, error: spouseError } = await supabase
        .from('spouses')
        .select('*')

      if (spouseError) throw new Error(spouseError.message)

      // 4. 查询所有生活事件（时间线）
      const { data: eventRows, error: eventError } = await supabase
        .from('life_events')
        .select('*')
        .order('year_sort', { ascending: true, nullsFirst: false })
        .order('sort_order', { ascending: true })

      if (eventError) throw new Error(eventError.message)

      lifeEvents.value = ((eventRows as any[]) || []).map(row => ({
        id: row.id,
        memberId: row.member_id,
        label: row.event_type_label || '',
        title: row.event_title || '',
        yearDisplay: row.year_display || '',
        yearSort: row.year_sort ?? undefined,
        location: row.location ?? undefined,
        description: row.description ?? undefined,
        sortOrder: row.sort_order ?? 0,
      }))

      // 5. 映射为前端数据结构
      const mappedMembers = (memberRows as DbMemberRow[]).map(mapDbMember)
      mapDbSpouses(spouseRows as DbSpouseRow[], mappedMembers)

      members.value = mappedMembers
      isLoaded.value = true
      return true
    } catch (err: any) {
      loadError.value = err.message || '数据加载失败'
      console.error('[familyStore] loadFromDatabase error:', err)
      return false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 加载硬编码 seed 数据（fallback / 开发模式）
   */
  function loadSeedData() {
    members.value = seedMembers()
    isLoaded.value = true
    rootMemberId.value = null
  }

  function getMemberById(id: string): Member | undefined {
    return members.value.find(m => m.id === id)
  }

  function getChildrenOf(memberId: string): Member[] {
    return members.value.filter(m => m.fatherId === memberId || m.motherId === memberId)
  }

  function getSpousesOf(memberId: string): Member[] {
    const member = getMemberById(memberId)
    if (!member) return []
    return member.spouses
      .map(s => getMemberById(s.spouseId))
      .filter((m): m is Member => m !== undefined)
  }

  function getEventsOf(memberId: string): LifeEvent[] {
    return lifeEvents.value.filter(e => e.memberId === memberId)
  }

  return {
    members,
    lifeEvents,
    isLoaded,
    isLoading,
    loadError,
    rootMemberId,
    rootMember,
    loadFromDatabase,
    loadSeedData,
    getMemberById,
    getChildrenOf,
    getSpousesOf,
    getEventsOf,
  }
})
