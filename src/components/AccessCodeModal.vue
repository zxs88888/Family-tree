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
  background: linear-gradient(180deg, rgba(43,38,34,0.45) 0%, rgba(43,38,34,0.55) 100%);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-card {
  width: 320px;
  background: linear-gradient(180deg, #fdfbf7 0%, #faf6ef 100%);
  border-radius: 16px;
  padding: 44px 32px 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 12px 48px rgba(43, 38, 34, 0.2);
  border: 1px solid rgba(201, 169, 110, 0.2);
}

.modal-title {
  display: block;
  font-size: 30px;
  font-weight: bold;
  color: #2b2622;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 6px;
  letter-spacing: 3px;
}

.modal-subtitle {
  display: block;
  font-size: 13px;
  color: #b8a88a;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 32px;
  letter-spacing: 1px;
}

.modal-input {
  width: 100%;
  height: 48px;
  border: 1.5px solid rgba(201, 169, 110, 0.4);
  border-radius: 10px;
  padding: 0 16px;
  font-size: 16px;
  color: #2b2622;
  background: rgba(255, 255, 255, 0.6);
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 12px;
  transition: border-color 0.2s;

  &:focus {
    border-color: #c9a96e;
    outline: none;
  }
}

.modal-error {
  display: block;
  font-size: 13px;
  color: #c0564f;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 10px;
}

.modal-btn {
  width: 100%;
  height: 48px;
  background: linear-gradient(135deg, #a83232 0%, #8b1a1a 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
  box-shadow: 0 4px 16px rgba(139, 26, 26, 0.25);
  transition: transform 0.15s, box-shadow 0.15s;

  &:active {
    transform: scale(0.98);
    box-shadow: 0 2px 8px rgba(139, 26, 26, 0.2);
  }
}

.modal-btn-text {
  color: #ffffff;
  font-size: 17px;
  font-weight: bold;
  font-family: 'Noto Serif SC', serif;
  letter-spacing: 2px;
}
</style>
