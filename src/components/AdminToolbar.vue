<template>
  <!-- TODO: 上线时恢复鉴权，将 v-if="true" 改回 v-if="authStore.isAdmin" -->
  <!-- 管理员浮动工具栏（暂时跳过鉴权，便于导入数据） -->
  <view v-if="true" class="admin-toolbar">
    <view class="admin-toolbar-inner">
      <view class="admin-toolbar-btn" @tap="showImport = true">
        <text class="admin-toolbar-btn-text">导入 CSV</text>
      </view>
    </view>
  </view>

  <!-- CSV 导入弹窗 -->
  <ImportModal v-if="showImport" @close="showImport = false" @imported="handleImported" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useFamilyStore } from '@/stores/familyStore'
import ImportModal from '@/components/ImportModal.vue'

const familyStore = useFamilyStore()
const showImport = ref(false)

async function handleImported() {
  showImport.value = false
  await familyStore.loadFromDatabase()
}
</script>

<style lang="scss">
.admin-toolbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 900;
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(139, 26, 26, 0.92) 0%, rgba(100, 18, 18, 0.96) 100%);
  backdrop-filter: blur(8px);
  box-shadow: 0 -4px 20px rgba(43, 38, 34, 0.15);
}

.admin-toolbar-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
}

.admin-toolbar-btn {
  padding: 10px 24px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: background 0.15s;

  &:active {
    background: rgba(255, 255, 255, 0.2);
  }

  &--logout {
    background: transparent;
    border-color: rgba(255, 255, 255, 0.15);
  }
}

.admin-toolbar-btn-text {
  font-size: 14px;
  color: #fff;
  font-family: 'Noto Serif SC', serif;
  letter-spacing: 1px;
}

.admin-toolbar-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.2);
}

.admin-entry {
  position: fixed;
  bottom: 20px;
  right: 16px;
  z-index: 800;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(139, 26, 26, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(139, 26, 26, 0.3);
  backdrop-filter: blur(4px);

  &:active {
    transform: scale(0.95);
  }
}

.admin-entry-text {
  font-size: 12px;
  color: #fff;
  font-family: 'Noto Serif SC', serif;
}
</style>
