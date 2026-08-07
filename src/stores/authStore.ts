import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/utils/supabase'

// 是否强制要求管理员登录才能编辑
// 本地 .env 设 TARO_APP_REQUIRE_ADMIN=false 放开；线上未配置该变量 → 严格
// 注意：Taro 仅内联构建时已定义的 TARO_APP_* 变量；线上未定义时构建产物保留
// process.env.XXX 字面量，运行时 process 不存在会报错，用 try/catch 兑底为严格
let requireAdminAuth = true
try {
  requireAdminAuth = process.env.TARO_APP_REQUIRE_ADMIN !== 'false'
} catch {
  requireAdminAuth = true
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const isAdmin = ref(false)
  const isInitializing = ref(false)

  // 是否可编辑：开发模式恒 true；生产模式需 isAdmin
  const canEdit = computed(() => !requireAdminAuth || isAdmin.value)

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
   * 邮箱 + 密码登录（管理员）
   */
  async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data?.user) {
        user.value = data.user
        await checkAdmin()
        if (!isAdmin.value) {
          // 登录成功但不是管理员，退出并提示
          await supabase.auth.signOut()
          user.value = null
          return { success: false, error: '该账号不是管理员' }
        }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || '登录失败' }
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
    canEdit,
    initAuth,
    login,
    checkAdmin,
    logout,
  }
})
