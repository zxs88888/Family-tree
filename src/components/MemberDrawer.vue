<template>
  <view v-if="member" class="drawer-backdrop" @tap="close">
    <view class="drawer-card" @tap.stop>
      <view class="drawer-header">
        <text class="drawer-name">{{ member.name }}</text>
        <text class="drawer-years">{{ years }}</text>
      </view>

      <view class="drawer-info">
        <text class="drawer-gender">{{ member.gender === 1 ? '男' : '女' }}</text>
        <text v-if="member.isAlive === false" class="drawer-deceased">已故</text>
      </view>

      <view v-if="spouses.length" class="drawer-section">
        <text class="drawer-label">配偶</text>
        <text v-for="sp in spouses" :key="sp.id" class="drawer-spouse">
          {{ sp.name }}（{{ getSpouseType(sp.id) }}）
        </text>
      </view>

      <view v-if="children.length" class="drawer-section">
        <text class="drawer-label">子女</text>
        <text v-for="ch in children" :key="ch.id" class="drawer-child">{{ ch.name }}</text>
      </view>

      <view v-if="member.biography" class="drawer-section">
        <text class="drawer-label">生平</text>
        <text class="drawer-bio">{{ member.biography }}</text>
      </view>

      <view class="drawer-close" @tap="close">
        <text class="drawer-close-text">关闭</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFamilyStore } from '@/stores/familyStore'
import { useUiStore } from '@/stores/uiStore'

const familyStore = useFamilyStore()
const uiStore = useUiStore()

const member = computed(() => {
  if (!uiStore.selectedMemberId) return null
  return familyStore.getMemberById(uiStore.selectedMemberId)
})

const years = computed(() => {
  if (!member.value) return ''
  const { birthYear, deathYear } = member.value
  if (birthYear && deathYear) return `${birthYear} — ${deathYear}`
  if (birthYear) return `${birthYear} —`
  if (deathYear) return `? — ${deathYear}`
  return ''
})

const spouses = computed(() => {
  if (!member.value) return []
  return familyStore.getSpousesOf(member.value.id)
})

const children = computed(() => {
  if (!member.value) return []
  return familyStore.getChildrenOf(member.value.id)
})

function getSpouseType(spouseId: string): string {
  if (!member.value) return ''
  const rel = member.value.spouses.find(s => s.spouseId === spouseId)
  return rel ? rel.marriageType : ''
}

function close() {
  uiStore.selectMember(null)
  uiStore.setLineagePath(new Set())
}
</script>

<style lang="scss">
.drawer-backdrop {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  top: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: flex-end;
  z-index: 100;
}

.drawer-card {
  width: 100%;
  background: #faf6ef;
  border-radius: 16px 16px 0 0;
  padding: 20px 24px 32px;
  max-height: 60vh;
  overflow-y: auto;
}

.drawer-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 4px;
}

.drawer-name {
  font-size: 22px;
  font-weight: bold;
  color: #2b2622;
  font-family: serif;
}

.drawer-years {
  font-size: 14px;
  color: #6f6657;
  font-family: serif;
}

.drawer-info {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.drawer-gender, .drawer-deceased {
  font-size: 12px;
  color: #a89c87;
  font-family: serif;
}

.drawer-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e8dfcc;
}

.drawer-label {
  display: block;
  font-size: 13px;
  font-weight: bold;
  color: #8b1a1a;
  font-family: serif;
  margin-bottom: 4px;
}

.drawer-spouse, .drawer-child {
  display: block;
  font-size: 14px;
  color: #2b2622;
  font-family: serif;
  line-height: 1.6;
}

.drawer-bio {
  display: block;
  font-size: 13px;
  color: #6f6657;
  font-family: serif;
  line-height: 1.5;
}

.drawer-close {
  margin-top: 16px;
  text-align: center;
  padding: 8px;
}

.drawer-close-text {
  font-size: 14px;
  color: #a89c87;
  font-family: serif;
}
</style>
