import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const selectedMemberId = ref<string | null>(null)
  const lineagePath = ref<Set<string>>(new Set())
  const showAccessModal = ref(true)
  const isAuthenticated = ref(false)
  // 搜索定位请求：{ memberId, nonce }，nonce 递增以支持重复定位同一成员
  const focusRequest = ref<{ memberId: string; nonce: number } | null>(null)

  function selectMember(id: string | null) {
    selectedMemberId.value = id
  }

  function setLineagePath(ids: Set<string>) {
    lineagePath.value = ids
  }

  function clearLineage() {
    lineagePath.value = new Set()
  }

  function requestFocus(memberId: string) {
    focusRequest.value = { memberId, nonce: (focusRequest.value?.nonce ?? 0) + 1 }
  }

  function authenticate() {
    isAuthenticated.value = true
    showAccessModal.value = false
  }

  return { selectedMemberId, lineagePath, showAccessModal, isAuthenticated, focusRequest, selectMember, setLineagePath, clearLineage, requestFocus, authenticate }
})
