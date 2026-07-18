<template>
  <view class="page">
    <AccessCodeModal v-if="uiStore.showAccessModal" />
    <view v-else class="tree-container">
      <text class="placeholder">家族树将在这里显示</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useFamilyStore } from '@/stores/familyStore'
import { useUiStore } from '@/stores/uiStore'
import AccessCodeModal from '@/components/AccessCodeModal.vue'

const familyStore = useFamilyStore()
const uiStore = useUiStore()

onMounted(() => {
  familyStore.loadSeedData()
})
</script>

<style lang="scss">
.page {
  min-height: 100vh;
  background: #faf6ef;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tree-container {
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder {
  font-size: 16px;
  color: #a89c87;
  font-family: serif;
}
</style>
