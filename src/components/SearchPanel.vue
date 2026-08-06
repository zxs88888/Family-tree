<template>
  <!-- 悬浮搜索按钮 -->
  <view class="search-fab" @click="togglePanel">
    <text class="search-fab-icon">🔍</text>
  </view>

  <!-- 搜索面板 -->
  <view v-if="open" class="search-panel">
    <view class="search-input-wrap">
      <input
        v-model="keyword"
        class="search-input"
        placeholder="输入姓名搜索家族成员"
        placeholder-class="search-input-placeholder"
        focus
        @input="onInput"
      />
      <view v-if="keyword" class="search-clear" @click="keyword = ''">
        <text class="search-clear-text">✕</text>
      </view>
    </view>

    <scroll-view scroll-y class="search-results">
      <view v-if="!results.length" class="search-empty">
        <text class="search-empty-text">{{ keyword ? '未找到匹配成员' : '输入姓名开始搜索' }}</text>
      </view>
      <view
        v-for="m in results"
        :key="m.id"
        class="search-result-item"
        @click="selectMember(m)"
      >
        <view class="result-avatar" :class="m.gender === 1 ? 'avatar-male' : 'avatar-female'">
          <text class="result-avatar-text">{{ m.name.slice(-1) }}</text>
        </view>
        <view class="result-info">
          <text class="result-name">{{ m.name }}</text>
          <text class="result-years">{{ yearsOf(m) }}</text>
        </view>
        <text class="result-arrow">›</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFamilyStore } from '@/stores/familyStore'
import { useUiStore } from '@/stores/uiStore'
import type { Member } from '@/utils/treeTypes'

const familyStore = useFamilyStore()
const uiStore = useUiStore()

const open = ref(false)
const keyword = ref('')

const results = computed(() => {
  const kw = keyword.value.trim()
  if (!kw) return []
  const matches = familyStore.members.filter(m => m.name.includes(kw))
  // 按名称长度排序（精确匹配优先），最多显示 30 个
  return matches
    .sort((a, b) => {
      const da = Math.abs(a.name.length - kw.length)
      const db = Math.abs(b.name.length - kw.length)
      if (da !== db) return da - db
      return a.name.localeCompare(b.name, 'zh')
    })
    .slice(0, 30)
})

function togglePanel() {
  open.value = !open.value
  if (!open.value) keyword.value = ''
}

function onInput() {
  // 输入变化时保持面板打开
}

function yearsOf(m: Member): string {
  const b = m.birthYear ? String(m.birthYear) : ''
  const d = m.deathYear ? String(m.deathYear) : ''
  if (b && d) return `${b} — ${d}`
  if (b) return `${b} —`
  if (d) return `? — ${d}`
  return m.isAlive === false ? '已故' : ''
}

function selectMember(m: Member) {
  open.value = false
  keyword.value = ''
  // 请求定位并高亮
  uiStore.requestFocus(m.id)
}
</script>

<style lang="scss">
.search-fab {
  position: fixed;
  right: 18px;
  bottom: 40px;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: linear-gradient(135deg, #8b1a1a, #a83232);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(139, 26, 26, 0.35);
  z-index: 90;
}

.search-fab-icon {
  font-size: 18px;
  color: #fff;
}

.search-panel {
  position: fixed;
  top: 12px;
  left: 12px;
  right: 12px;
  z-index: 95;
  background: #fdfbf7;
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(43, 38, 34, 0.18);
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-input-wrap {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(201, 187, 160, 0.3);
}

.search-input {
  flex: 1;
  height: 36px;
  font-size: 15px;
  color: #2b2622;
  font-family: 'Noto Serif SC', serif;
  background: rgba(232, 223, 204, 0.25);
  border-radius: 8px;
  padding: 0 12px;
}

.search-input-placeholder {
  color: #b8a88a;
}

.search-clear {
  margin-left: 8px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(201, 187, 160, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-clear-text {
  font-size: 12px;
  color: #9a8e7a;
}

.search-results {
  max-height: 45vh;
}

.search-empty {
  padding: 28px 0;
  text-align: center;
}

.search-empty-text {
  font-size: 13px;
  color: #b8a88a;
  font-family: 'Noto Serif SC', serif;
}

.search-result-item {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(201, 187, 160, 0.15);
}

.search-result-item:active {
  background: rgba(232, 223, 204, 0.3);
}

.result-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
}

.avatar-male {
  background: linear-gradient(135deg, #4a6fa5, #2c3e50);
}

.avatar-female {
  background: linear-gradient(135deg, #c0564f, #8b1a1a);
}

.result-avatar-text {
  font-size: 13px;
  color: #fff;
  font-weight: bold;
  font-family: 'Noto Serif SC', serif;
}

.result-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.result-name {
  font-size: 15px;
  color: #2b2622;
  font-family: 'Noto Serif SC', serif;
  font-weight: bold;
}

.result-years {
  font-size: 12px;
  color: #9a8e7a;
  font-family: 'Noto Serif SC', serif;
}

.result-arrow {
  font-size: 18px;
  color: #b8a88a;
}
</style>
