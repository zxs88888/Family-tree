<template>
  <view class="login-backdrop" @tap="close">
    <view class="login-card" @tap.stop>
      <view class="login-title-row">
        <text class="login-title">管理员登录</text>
        <view class="login-close" @tap="close">
          <text class="login-close-text">✕</text>
        </view>
      </view>

      <text class="login-subtitle">使用管理员邮箱和密码登录（仅管理员可进入编辑）</text>

      <input
        v-model="email"
        class="login-input"
        type="text"
        placeholder="管理员邮箱"
        placeholder-class="login-placeholder"
      />
      <input
        v-model="password"
        class="login-input login-input--mt"
        type="password"
        password
        placeholder="密码"
        placeholder-class="login-placeholder"
      />
      <view class="login-error" v-if="errorMsg">
        <text class="login-error-text">{{ errorMsg }}</text>
      </view>
      <view class="login-send-btn" @tap="doLogin">
        <text class="login-send-text">{{ loading ? '登录中...' : '登 录' }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'

const emit = defineEmits<{ (e: 'close'): void; (e: 'loggedIn'): void }>()

const authStore = useAuthStore()
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function doLogin() {
  const addr = email.value.trim()
  if (!addr) {
    errorMsg.value = '请输入邮箱地址'
    return
  }
  if (!password.value) {
    errorMsg.value = '请输入密码'
    return
  }
  loading.value = true
  errorMsg.value = ''
  const res = await authStore.login(addr, password.value)
  loading.value = false
  if (res.success) {
    emit('loggedIn')
    emit('close')
  } else {
    errorMsg.value = res.error || '登录失败，请重试'
  }
}

function close() {
  emit('close')
}
</script>

<style lang="scss">
.login-backdrop {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(43, 38, 34, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 950;
}

.login-card {
  width: 320px;
  background: linear-gradient(180deg, #fdfbf7 0%, #faf6ef 100%);
  border-radius: 16px;
  padding: 24px 24px 28px;
  box-shadow: 0 12px 40px rgba(43, 38, 34, 0.25);
}

.login-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.login-title {
  font-size: 18px;
  font-weight: bold;
  color: #2b2622;
  font-family: 'Noto Serif SC', serif;
}

.login-close {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(201, 187, 160, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-close-text {
  font-size: 12px;
  color: #9a8e7a;
}

.login-subtitle {
  display: block;
  font-size: 12px;
  color: #9a8e7a;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 16px;
  line-height: 1.5;
}

.login-input {
  height: 40px;
  background: rgba(232, 223, 204, 0.25);
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  color: #2b2622;
  font-family: 'Noto Serif SC', serif;

  &--mt {
    margin-top: 10px;
  }
}

.login-placeholder {
  color: #b8a88a;
}

.login-error {
  margin-top: 8px;
}

.login-error-text {
  font-size: 12px;
  color: #8b1a1a;
  font-family: 'Noto Serif SC', serif;
}

.login-send-btn {
  margin-top: 16px;
  padding: 12px 0;
  border-radius: 8px;
  background: linear-gradient(135deg, #8b1a1a, #a83232);
  text-align: center;
}

.login-send-text {
  font-size: 14px;
  color: #fff;
  font-family: 'Noto Serif SC', serif;
  letter-spacing: 1px;
}

.login-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px 0 10px;
}

.login-success-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.login-success-text {
  font-size: 14px;
  color: #3d3529;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 6px;
}

.login-success-hint {
  font-size: 12px;
  color: #9a8e7a;
  font-family: 'Noto Serif SC', serif;
  text-align: center;
  line-height: 1.6;
}

.login-resend {
  margin-top: 14px;
  text-align: center;
  padding: 8px;
}

.login-resend-text {
  font-size: 13px;
  color: #8b1a1a;
  font-family: 'Noto Serif SC', serif;
}
</style>
