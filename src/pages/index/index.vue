<template>
  <view class="page">
    <AccessCodeModal v-if="uiStore.showAccessModal" />
    <view v-else class="main">
      <!-- 加载状态 -->
      <view v-if="familyStore.isLoading" class="loading-container">
        <view class="loading-spinner" />
        <text class="loading-text">正在加载家族数据...</text>
      </view>

      <!-- 主内容 -->
      <template v-else>
        <FamilyTree />
        <MemberDrawer />
        <SearchPanel />
        <AdminToolbar />
      </template>

      <!-- 降级提示 -->
      <view v-if="showFallbackNotice" class="fallback-notice">
        <text class="fallback-text">数据加载失败，当前显示本地缓存数据</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useFamilyStore } from '@/stores/familyStore'
import { useUiStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import AccessCodeModal from '@/components/AccessCodeModal.vue'
import FamilyTree from '@/components/FamilyTree.vue'
import MemberDrawer from '@/components/MemberDrawer.vue'
import SearchPanel from '@/components/SearchPanel.vue'
import AdminToolbar from '@/components/AdminToolbar.vue'

const familyStore = useFamilyStore()
const uiStore = useUiStore()
const authStore = useAuthStore()
const showFallbackNotice = ref(false)

onMounted(async () => {
  // 初始化 Auth（检测 PKCE 回调 + 恢复会话）
  await authStore.initAuth()

  // 检查访问码持久化状态
  const hasAccess = localStorage.getItem('family_access') === 'true'
  if (hasAccess) {
    uiStore.authenticate()
  }

  // 加载家族数据
  await loadFamilyData()
})

async function loadFamilyData() {
  const success = await familyStore.loadFromDatabase()
  if (!success) {
    // 降级到 seed 数据
    familyStore.loadSeedData()
    showFallbackNotice.value = true
  }
}
</script>

<style lang="scss">
.page {
  min-height: 100vh;
  background: #faf6ef;
}

.main {
  position: relative;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 16px;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(201, 169, 110, 0.3);
  border-top-color: #8b1a1a;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 14px;
  color: #6f6657;
  font-family: 'Noto Serif SC', serif;
  letter-spacing: 1px;
}

.fallback-notice {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(139, 26, 26, 0.9);
  padding: 8px 16px;
  border-radius: 8px;
  z-index: 100;
}

.fallback-text {
  font-size: 12px;
  color: #fff;
  font-family: 'Noto Serif SC', serif;
}
</style>
