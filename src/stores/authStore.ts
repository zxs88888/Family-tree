import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/utils/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAdmin = ref(false)
  const isInitializing = ref(false)

  /**
   * 初始化 Auth：检测 PKCE 回调 + 恢复会话 + 监听状态变化
   */
  async function initAuth() {
    isInitializing.value = true

    try {
      // 1. 检测 PKCE 回调（URL 中的 ?code=xxx）
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          console.error('[authStore] PKCE exchange error:', error.message)
        }
        // 清除 URL 中的 code 参数
        window.history.replaceState({}, '', window.location.pathname + window.location.hash)
      }

      // 2. 恢复已有会话
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        user.value = session.user
        await checkAdmin()
      }

      // 3. 监听 Auth 状态变化
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          user.value = session.user
          await checkAdmin()
        } else {
          user.value = null
          isAdmin.value = false
        }
      })
    } catch (err) {
      console.error('[authStore] initAuth error:', err)
    } finally {
      isInitializing.value = false
    }
  }

  /**
   * 发送 Magic Link 登录邮件
   */
  async function login(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      })

      if (error) {
        return { success: false, error: error.message }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || '发送失败' }
    }
  }

  /**
   * 检查当前用户是否为管理员
   */
  async function checkAdmin() {
    if (!user.value) {
      isAdmin.value = false
      return
    }

    try {
      const { data, error } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', user.value.id)
        .limit(1)

      if (error) {
        console.error('[authStore] checkAdmin error:', error.message)
        isAdmin.value = false
        return
      }

      isAdmin.value = (data?.length ?? 0) > 0
    } catch {
      isAdmin.value = false
    }
  }

  /**
   * 退出登录
   */
  async function logout() {
    await supabase.auth.signOut()
    user.value = null
    isAdmin.value = false
  }

  return {
    user,
    isAdmin,
    isInitializing,
    initAuth,
    login,
    checkAdmin,
    logout,
  }
})
