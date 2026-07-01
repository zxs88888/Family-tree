<template>
  <view class="access-code-modal">
    <view class="modal-overlay">
      <view class="modal-content">
        <text class="modal-title">{{ isAdminMode ? '管理员登录' : '请输入家族访问码' }}</text>

        <view v-if="isAdminMode">
          <view class="form-group">
            <text class="form-label">邮箱</text>
            <input v-model="email" placeholder="输入管理员邮箱" type="email" class="form-input" />
          </view>
          <button class="btn-verify" :disabled="!email || sending" @click="sendMagicLink">
            {{ sending ? '发送中...' : '发送登录链接' }}
          </button>
          <text v-if="linkSent" class="success-text">✅ 登录链接已发送，请查收邮件</text>
          <text v-if="errorMsg" class="error-text">{{ errorMsg }}</text>
        </view>

        <template v-else>
          <view class="access-code-input-wrapper">
            <input
              v-model="accessCode"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入家族访问码"
              class="access-input"
              focus
            />
            <view class="toggle-eye-wrapper" @click="showPassword = !showPassword">
              <text class="toggle-eye">{{ showPassword ? '🙈' : '👁️' }}</text>
            </view>
          </view>
          <text class="hint-text">提示：访问码为 {{ hint }}（联系管理员获取完整码）</text>
          <text v-if="errorMsg" class="error-text">{{ errorMsg }}</text>
          <button class="btn-verify" :disabled="verifying || locked" @click="verifyCode">
            {{ verifying ? '验证中...' : '确认' }}
          </button>
        </template>

        <text class="toggle-mode" @click="isAdminMode = !isAdminMode">
          {{ isAdminMode ? '← 使用访问码进入' : '管理员？点此邮箱登录 →' }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/utils/supabase'
import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()
const accessCode = ref('')
const showPassword = ref(false)
const hint = ref('****')
const verifying = ref(false)
const errorMsg = ref('')
const errorCount = ref(0)
const locked = ref(false)
const isAdminMode = ref(false)
const email = ref('')
const sending = ref(false)
const linkSent = ref(false)
const VITE_FAMILY_ID = import.meta.env.VITE_FAMILY_ID

onMounted(async () => {
  const { data } = await supabase.rpc('get_access_code_hint', { family_id: VITE_FAMILY_ID })
  hint.value = data || '****'

  uni.onKeyboardHeightChange((res) => {
    if (res.height > 0) {
      uni.pageScrollTo({ selector: '.access-code-modal', offsetTop: -res.height + 60, duration: 200 })
    }
  })
})

onUnmounted(() => {
  uni.offKeyboardHeightChange()
})

async function sendMagicLink() {
  if (!email.value) return
  sending.value = true
  errorMsg.value = ''
  linkSent.value = false
  try {
    const { error } = await supabase.auth.signInWithOtp({ email: email.value })
    if (error) throw error
    linkSent.value = true
  } catch (e) {
    errorMsg.value = e.message
  } finally {
    sending.value = false
  }
}

async function verifyCode() {
  if (locked.value || verifying.value) return
  verifying.value = true
  errorMsg.value = ''

  try {
    const { data: isValid } = await supabase.rpc('validate_access_code', {
      input_code: accessCode.value,
      family_id: VITE_FAMILY_ID,
    })

    if (isValid) {
      await supabase.auth.signInAnonymously()
      userStore.accessCodeVerified = true
      localStorage.setItem('access_code_verified', 'true')
      uni.showToast({ title: '验证成功，正在加载家族数据...', icon: 'success', duration: 1500 })
      setTimeout(() => { window.location.reload() }, 1500)
    } else {
      errorCount.value++
      if (errorCount.value >= 5) {
        locked.value = true
        errorMsg.value = '输入错误次数过多，请 30 秒后重试'
        setTimeout(() => { locked.value = false; errorCount.value = 0; errorMsg.value = '' }, 30000)
      } else if (errorCount.value >= 3) {
        errorMsg.value = '访问码错误，请确认后重试。如有疑问请联系管理员。'
      } else {
        errorMsg.value = '访问码错误，请重新输入'
      }
    }
  } catch (e) {
    errorMsg.value = '验证失败，请检查网络后重试'
  } finally {
    verifying.value = false
  }
}
</script>

<style>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 200;
}
.modal-content {
  background: #fff; border-radius: 24px; padding: 32px 24px;
  width: 85%; max-width: 360px;
}
.modal-title { font-size: 20px; font-weight: bold; text-align: center; margin-bottom: 16px; }
.access-code-input-wrapper {
  display: flex; align-items: center;
  border: 2px solid #ddd; border-radius: 12px; padding: 0 4px; margin: 16px 0;
}
.access-input { flex: 1; height: 48px; padding: 0 12px; font-size: 16px; }
.toggle-eye-wrapper { min-width: 48px; min-height: 48px; display: flex; align-items: center; justify-content: center; }
.btn-verify {
  width: 100%; height: 48px; background: #8B1A1A; color: #fff;
  border-radius: 12px; font-size: 16px; margin-top: 16px;
}
.btn-verify[disabled] { opacity: 0.5; }
.error-text { color: #E74C3C; font-size: 14px; text-align: center; margin-top: 8px; }
.success-text { color: #27AE60; font-size: 14px; text-align: center; margin-top: 8px; }
.hint-text { font-size: 13px; color: #6B6B6B; text-align: center; }
.toggle-mode {
  display: block; text-align: center; margin-top: 20px;
  font-size: 14px; color: #8B1A1A; min-height: 48px; line-height: 48px;
}
.form-group { margin-bottom: 12px; }
.form-label { font-size: 14px; color: #6B6B6B; margin-bottom: 4px; display: block; }
.form-input { width: 100%; height: 48px; border: 2px solid #ddd; border-radius: 12px; padding: 0 12px; font-size: 16px; }
</style>
