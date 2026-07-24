<template>
  <view class="admin-login-backdrop" @tap.self="emit('close')">
    <view class="admin-login-card">
      <text class="admin-login-title">管理员登录</text>
      <text class="admin-login-subtitle">输入邮箱，接收登录链接</text>

      <!-- 邮箱输入 -->
      <view v-if="!sent" class="admin-login-form">
        <input
          class="admin-login-input"
          v-model="email"
          placeholder="请输入管理员邮箱"
          type="text"
        />
        <text v-if="error" class="admin-login-error">{{ error }}</text>
        <view class="admin-login-btn" :class="{ 'admin-login-btn--loading': loading }" @tap="handleLogin">
          <text class="admin-login-btn-text">{{ loading ? '发送中...' : '发送登录链接' }}</text>
        </view>
      </view>

      <!-- 发送成功提示 -->
      <view v-else class="admin-login-sent">
        <text class="admin-login-sent-icon">✉</text>
        <text class="admin-login-sent-text">登录链接已发送至</text>
        <text class="admin-login-sent-email">{{ email }}</text>
        <text class="admin-login-sent-hint">请查收邮箱，点击链接完成登录</text>
      </view>

      <!-- 关闭按钮 -->
      <view class="admin-login-close" @tap="emit('close')">
        <text class="admin-login-close-text">关闭</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/authStore'

const emit = defineEmits<{
  close: []
}>()

const authStore = useAuthStore()
const email = ref('')
const error = ref('')
const loading = ref(false)
const sent = ref(false)

async function handleLogin() {
  if (!email.value.trim() || loading.value) return

  // 简单邮箱格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.value.trim())) {
    error.value = '请输入有效的邮箱地址'
    return
  }

  loading.value = true
  error.value = ''

  const result = await authStore.login(email.value.trim())

  if (result.success) {
    sent.value = true
  } else {
    error.value = result.error || '发送失败，请重试'
  }

  loading.value = false
}
</script>

<style lang="scss">
.admin-login-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(43, 38, 34, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.admin-login-card {
  width: 320px;
  background: linear-gradient(180deg, #fdfbf7 0%, #faf6ef 100%);
  border-radius: 16px;
  padding: 36px 28px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 12px 48px rgba(43, 38, 34, 0.2);
  border: 1px solid rgba(201, 169, 110, 0.2);
}

.admin-login-title {
  display: block;
  font-size: 22px;
  font-weight: bold;
  color: #2b2622;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 6px;
  letter-spacing: 2px;
}

.admin-login-subtitle {
  display: block;
  font-size: 13px;
  color: #b8a88a;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 28px;
}

.admin-login-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.admin-login-input {
  width: 100%;
  height: 44px;
  border: 1.5px solid rgba(201, 169, 110, 0.4);
  border-radius: 10px;
  padding: 0 14px;
  font-size: 15px;
  color: #2b2622;
  background: rgba(255, 255, 255, 0.6);
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 12px;

  &:focus {
    border-color: #c9a96e;
    outline: none;
  }
}

.admin-login-error {
  display: block;
  font-size: 12px;
  color: #c0564f;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 8px;
}

.admin-login-btn {
  width: 100%;
  height: 44px;
  background: linear-gradient(135deg, #a83232 0%, #8b1a1a 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(139, 26, 26, 0.25);
  transition: transform 0.15s, opacity 0.2s;

  &:active {
    transform: scale(0.98);
  }

  &--loading {
    opacity: 0.7;
    pointer-events: none;
  }
}

.admin-login-btn-text {
  color: #fff;
  font-size: 15px;
  font-weight: bold;
  font-family: 'Noto Serif SC', serif;
  letter-spacing: 1px;
}

.admin-login-sent {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
}

.admin-login-sent-icon {
  font-size: 36px;
  margin-bottom: 12px;
}

.admin-login-sent-text {
  font-size: 14px;
  color: #6f6657;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 4px;
}

.admin-login-sent-email {
  font-size: 15px;
  color: #2b2622;
  font-weight: bold;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 12px;
}

.admin-login-sent-hint {
  font-size: 12px;
  color: #b8a88a;
  font-family: 'Noto Serif SC', serif;
}

.admin-login-close {
  margin-top: 20px;
  padding: 8px 24px;
}

.admin-login-close-text {
  font-size: 13px;
  color: #b8a88a;
  font-family: 'Noto Serif SC', serif;
}
</style>
