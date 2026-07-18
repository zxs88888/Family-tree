<template>
  <view class="modal-backdrop">
    <view class="modal-card">
      <text class="modal-title">家族族谱</text>
      <text class="modal-subtitle">请输入访问码</text>
      <input
        class="modal-input"
        v-model="code"
        placeholder="请输入访问码"
        type="text"
      />
      <text v-if="error" class="modal-error">访问码错误，请重试</text>
      <view class="modal-btn" @tap="handleVerify">
        <text class="modal-btn-text">进入家族</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUiStore } from '@/stores/uiStore'

const ACCESS_CODE = 'Wang2026'

const uiStore = useUiStore()
const code = ref('')
const error = ref(false)

function handleVerify() {
  if (code.value === ACCESS_CODE) {
    error.value = false
    uiStore.authenticate()
  } else {
    error.value = true
  }
}
</script>

<style lang="scss">
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-card {
  width: 320px;
  background: #ffffff;
  border-radius: 12px;
  padding: 40px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
}

.modal-title {
  display: block;
  font-size: 28px;
  font-weight: bold;
  color: #2b2622;
  font-family: serif;
  margin-bottom: 8px;
}

.modal-subtitle {
  display: block;
  font-size: 14px;
  color: #a89c87;
  font-family: serif;
  margin-bottom: 28px;
}

.modal-input {
  width: 100%;
  height: 44px;
  border: 1px solid #d4c5a9;
  border-radius: 8px;
  padding: 0 14px;
  font-size: 16px;
  color: #2b2622;
  background: #faf6ef;
  font-family: serif;
  margin-bottom: 16px;
}

.modal-error {
  display: block;
  font-size: 13px;
  color: #cc3333;
  font-family: serif;
  margin-bottom: 12px;
}

.modal-btn {
  width: 100%;
  height: 46px;
  background: #8b1a1a;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
}

.modal-btn-text {
  color: #ffffff;
  font-size: 17px;
  font-weight: bold;
  font-family: serif;
}
</style>
