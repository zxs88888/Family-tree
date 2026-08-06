<template>
  <!-- 未登录：管理员入口（右下角小按钮） -->
  <view v-if="!authStore.isAdmin && !authStore.isInitializing" class="admin-entry" @tap="showLogin = true">
    <text class="admin-entry-text">管</text>
  </view>

  <!-- 已登录管理员：底部工具栏 -->
  <view v-else-if="authStore.isAdmin" class="admin-toolbar">
    <view class="admin-toolbar-inner">
      <view class="admin-toolbar-btn" @tap="showImport = true">
        <text class="admin-toolbar-btn-text">导入 CSV</text>
      </view>
      <view class="admin-toolbar-divider" />
      <view class="admin-toolbar-btn" @tap="addMember">
        <text class="admin-toolbar-btn-text">新增成员</text>
      </view>
      <view class="admin-toolbar-divider" />
      <view class="admin-toolbar-btn admin-toolbar-btn--logout" @tap="logout">
        <text class="admin-toolbar-btn-text">退出</text>
      </view>
    </view>
  </view>

  <!-- CSV 导入弹窗 -->
  <ImportModal v-if="showImport" @close="showImport = false" @imported="handleImported" />

  <!-- 登录弹窗 -->
  <LoginModal v-if="showLogin" @close="showLogin = false" />

  <!-- 新增/编辑成员弹窗 -->
  <MemberEditModal
    v-if="showEdit"
    :member-id="editMemberId"
    @close="showEdit = false"
    @saved="handleSaved"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useFamilyStore } from '@/stores/familyStore'
import { useAuthStore } from '@/stores/authStore'
import ImportModal from '@/components/ImportModal.vue'
import LoginModal from '@/components/LoginModal.vue'
import MemberEditModal from '@/components/MemberEditModal.vue'

const familyStore = useFamilyStore()
const authStore = useAuthStore()

const showImport = ref(false)
const showLogin = ref(false)
const showEdit = ref(false)
const editMemberId = ref<string | null>(null)

async function handleImported() {
  showImport.value = false
  await familyStore.loadFromDatabase()
}

function addMember() {
  editMemberId.value = null
  showEdit.value = true
}

async function handleSaved() {
  showEdit.value = false
  await familyStore.loadFromDatabase()
}

async function logout() {
  await authStore.logout()
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
  gap: 12px;
}

.admin-toolbar-btn {
  padding: 10px 18px;
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
  bottom: 24px;
  right: 18px;
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
  font-size: 14px;
  color: #fff;
  font-family: 'Noto Serif SC', serif;
}
</style>
