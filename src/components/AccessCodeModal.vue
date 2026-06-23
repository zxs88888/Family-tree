<template>
  <view class="access-code-modal">
    <view class="modal-overlay">
      <view class="modal-content">
        <text class="modal-title">请输入家族访问码</text>
        <view class="access-code-input-wrapper">
          <input
            :type="showPassword ? 'text' : 'password'"
            v-model="accessCode"
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
        <button
          class="btn-verify"
          :disabled="verifying || locked"
          @click="verifyCode"
        >{{ verifying ? '验证中...' : '确认' }}</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
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
const VITE_FAMILY_ID = import.meta.env.VITE_FAMILY_ID

onMounted(async () => {
  const { data } = await supabase.rpc('get_access_code_hint', { family_id: VITE_FAMILY_ID })
  hint.value = data || '****'
})

async function verifyCode() {
  if (locked.value || verifying.value) return
  verifying.value = true
  errorMsg.value = ''

  try {
    const { data: isValid } = await supabase.rpc('validate_access_code', {
      input_code: accessCode.value,
      family_id: VITE_FAMILY_ID
    })

    if (isValid) {
      await supabase.auth.signInAnonymously()
      userStore.accessCodeVerified = true
      localStorage.setItem('access_code_verified', 'true')
      uni.showToast({ title: '验证成功，正在加载家族数据...', icon: 'success', duration: 1500 })
      setTimeout(() => {
        window.location.reload()
      }, 1500)
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
.error-text { color: #E74C3C; font-size: 14px; }
</style>
