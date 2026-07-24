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

      <view v-if="events.length" class="drawer-section">
        <text class="drawer-label">时间线</text>
        <view class="timeline">
          <view v-for="(ev, idx) in events" :key="ev.id" class="timeline-item">
            <view class="timeline-marker">
              <view class="timeline-dot" />
              <view v-if="idx < events.length - 1" class="timeline-line" />
            </view>
            <view class="timeline-content">
              <view class="timeline-head">
                <text class="timeline-year">{{ ev.yearDisplay }}</text>
                <text class="timeline-label">{{ ev.label }}</text>
              </view>
              <text v-if="ev.title && ev.title !== ev.label" class="timeline-title">{{ ev.title }}</text>
              <text v-if="ev.description" class="timeline-desc">{{ ev.description }}</text>
              <text v-if="ev.location" class="timeline-loc">📍 {{ ev.location }}</text>
            </view>
          </view>
        </view>
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

const events = computed(() => {
  if (!member.value) return []
  return familyStore.getEventsOf?.(member.value.id) ?? []
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
  background: rgba(43, 38, 34, 0.35);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  z-index: 100;
}

.drawer-card {
  width: 100%;
  background: linear-gradient(180deg, #fdfbf7 0%, #faf6ef 100%);
  border-radius: 20px 20px 0 0;
  padding: 24px 28px 36px;
  max-height: 65vh;
  overflow-y: auto;
  box-shadow: 0 -8px 32px rgba(43, 38, 34, 0.12);
}

.drawer-header {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 6px;
}

.drawer-name {
  font-size: 24px;
  font-weight: bold;
  color: #2b2622;
  font-family: 'Noto Serif SC', serif;
  letter-spacing: 1px;
}

.drawer-years {
  font-size: 14px;
  color: #9a8e7a;
  font-family: 'Noto Serif SC', serif;
}

.drawer-info {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.drawer-gender, .drawer-deceased {
  font-size: 12px;
  color: #b8a88a;
  font-family: 'Noto Serif SC', serif;
  padding: 2px 8px;
  background: rgba(232, 223, 204, 0.3);
  border-radius: 4px;
}

.drawer-section {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(201, 187, 160, 0.4);
}

.drawer-label {
  display: block;
  font-size: 13px;
  font-weight: bold;
  color: #8b1a1a;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 6px;
  letter-spacing: 1px;
}

.drawer-spouse, .drawer-child {
  display: block;
  font-size: 15px;
  color: #3d3529;
  font-family: 'Noto Serif SC', serif;
  line-height: 1.8;
}

.drawer-bio {
  display: block;
  font-size: 13px;
  color: #6f6657;
  font-family: 'Noto Serif SC', serif;
  line-height: 1.7;
}

.timeline {
  display: flex;
  flex-direction: column;
}

.timeline-item {
  display: flex;
  gap: 12px;
}

.timeline-marker {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 12px;
}

.timeline-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #8b1a1a;
  box-shadow: 0 0 0 3px rgba(139, 26, 26, 0.12);
  margin-top: 4px;
  flex-shrink: 0;
}

.timeline-line {
  width: 1.5px;
  flex: 1;
  background: linear-gradient(180deg, rgba(201, 169, 110, 0.5) 0%, rgba(201, 169, 110, 0.2) 100%);
  margin: 3px 0;
  min-height: 12px;
}

.timeline-content {
  flex: 1;
  padding-bottom: 16px;
}

.timeline-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 3px;
}

.timeline-year {
  font-size: 14px;
  font-weight: bold;
  color: #8b1a1a;
  font-family: 'Noto Serif SC', serif;
}

.timeline-label {
  font-size: 12px;
  color: #b8a88a;
  font-family: 'Noto Serif SC', serif;
  padding: 1px 6px;
  background: rgba(232, 223, 204, 0.35);
  border-radius: 4px;
}

.timeline-title {
  display: block;
  font-size: 13px;
  color: #3d3529;
  font-family: 'Noto Serif SC', serif;
  line-height: 1.6;
  margin-bottom: 2px;
}

.timeline-desc {
  display: block;
  font-size: 12px;
  color: #6f6657;
  font-family: 'Noto Serif SC', serif;
  line-height: 1.6;
}

.timeline-loc {
  display: block;
  font-size: 11px;
  color: #a89c87;
  font-family: 'Noto Serif SC', serif;
  margin-top: 2px;
}

.drawer-close {
  margin-top: 20px;
  text-align: center;
  padding: 10px;
  border-radius: 8px;
  background: rgba(232, 223, 204, 0.2);
}

.drawer-close-text {
  font-size: 14px;
  color: #9a8e7a;
  font-family: 'Noto Serif SC', serif;
}
</style>
