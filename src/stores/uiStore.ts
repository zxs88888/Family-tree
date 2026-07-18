import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const selectedMemberId = ref<string | null>(null)
  const lineagePath = ref<Set<string>>(new Set())
  const showAccessModal = ref(true)
  const isAuthenticated = ref(false)

  function selectMember(id: string | null) {
    selectedMemberId.value = id
  }

  function setLineagePath(ids: Set<string>) {
    lineagePath.value = ids
  }

  function clearLineage() {
    lineagePath.value = new Set()
  }

  function authenticate() {
    isAuthenticated.value = true
    showAccessModal.value = false
  }

  return { selectedMemberId, lineagePath, showAccessModal, isAuthenticated, selectMember, setLineagePath, clearLineage, authenticate }
})
