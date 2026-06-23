import { defineStore } from 'pinia'
import { supabase } from '@/utils/supabase'

export const useUserStore = defineStore('user', {
  state: () => ({
    myMemberId: localStorage.getItem('my_member_id') || null,
    isAdmin: false,
    fontSizePreference: parseInt(localStorage.getItem('font_size') || '16'),
    accessCodeVerified: localStorage.getItem('access_code_verified') === 'true',
  }),
  actions: {
    setMyMemberId(id) {
      this.myMemberId = id
      localStorage.setItem('my_member_id', id)
    },
    clearMyMemberId() {
      this.myMemberId = null
      localStorage.removeItem('my_member_id')
    },
    toggleFontSize() {
      this.fontSizePreference = this.fontSizePreference === 16 ? 20 : 16
      localStorage.setItem('font_size', String(this.fontSizePreference))
    },
    setAdmin(bool) {
      this.isAdmin = bool
    },
    async logout() {
      localStorage.removeItem('my_member_id')
      localStorage.removeItem('access_code_verified')
      this.clearMyMemberId()
      this.isAdmin = false
      this.accessCodeVerified = false
      await supabase.auth.signOut()
    },
  },
})
