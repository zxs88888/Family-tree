<template>
  <view class="page">
    <AccessCodeModal v-if="uiStore.showAccessModal" />
    <view v-else class="main">
      <FamilyTree />
      <MemberDrawer />
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useFamilyStore } from '@/stores/familyStore'
import { useUiStore } from '@/stores/uiStore'
import AccessCodeModal from '@/components/AccessCodeModal.vue'
import FamilyTree from '@/components/FamilyTree.vue'
import MemberDrawer from '@/components/MemberDrawer.vue'

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
}

.main {
  position: relative;
}
</style>
