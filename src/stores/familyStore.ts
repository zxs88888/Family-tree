import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Member } from '@/utils/treeTypes'
import { seedMembers } from '@/data/seed'

export const useFamilyStore = defineStore('family', () => {
  const members = ref<Member[]>([])
  const isLoaded = ref(false)

  const rootMember = computed(() =>
    members.value.find(m => m.name === '永康')
  )

  function loadSeedData() {
    members.value = seedMembers()
    isLoaded.value = true
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

  return { members, isLoaded, rootMember, loadSeedData, getMemberById, getChildrenOf, getSpousesOf }
})
