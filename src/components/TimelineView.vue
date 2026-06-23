<template>
  <view class="timeline-view">
    <text class="section-title">📜 生平时间线</text>

    <!-- 有时间线事件 -->
    <template v-if="events.length > 0">
      <view v-for="event in events" :key="event.id" class="event-card">
        <view class="event-header" @click="toggleExpand(event.id)">
          <text class="event-year">{{ event.year_display }}</text>
          <text class="event-icon">{{ getIcon(event.event_type_label) }}</text>
          <text class="event-title">{{ event.event_title }}</text>
          <text class="expand-btn">{{ expanded[event.id] ? '▴' : '▾' }}</text>
        </view>
        <view v-if="expanded[event.id]" class="event-body">
          <text v-if="event.description" class="event-desc">{{ event.description }}</text>
          <text v-if="event.location" class="event-location">📍 {{ event.location }}</text>
          <view v-if="event.images?.length > 0" class="event-images">
            <image
              v-for="img in event.images.slice(0, 3)"
              :key="img.id"
              :src="img.media_url + '?width=80&height=80'"
              mode="aspectFill"
              class="thumb"
              @click="previewImage(event.images, img)"
            />
            <text v-if="event.images.length > 3" class="more-thumb">+{{ event.images.length - 3 }}</text>
          </view>
        </view>
      </view>

      <!-- 查看全部照片 -->
      <view v-if="totalPhotos > 0" class="gallery-entry" @click="openGallery">
        <text>🖼️ 查看全部 {{ totalPhotos }} 张照片</text>
      </view>
    </template>

    <!-- 无事件 → 展示 biography -->
    <view v-else-if="biography" class="bio-text">
      <text>{{ biography }}</text>
    </view>
    <view v-else class="empty-timeline">
      <text>这位成员暂无生平事件</text>
    </view>

    <!-- GalleryView -->
    <GalleryView
      v-if="showGallery"
      :images="allImages"
      :memberName="memberName"
      @close="showGallery = false"
    />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useFamilyStore } from '@/stores/familyStore'
import { ICON_MAP, ICON_DEFAULT } from '@/utils/constants'
import GalleryView from '@/components/GalleryView.vue'

const props = defineProps({
  memberId: { type: String, required: true },
  biography: { type: String, default: '' },
  memberName: { type: String, default: '' },
})

const familyStore = useFamilyStore()
const events = ref([])
const expanded = ref({})
const showGallery = ref(false)

const allImages = computed(() => {
  return events.value.flatMap(e =>
    (e.images || []).map(img => ({ ...img, year: e.year_display, title: e.event_title }))
  ).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
})

const totalPhotos = computed(() => {
  return events.value.reduce((sum, e) => sum + (e.images?.length || 0), 0)
})

function getIcon(label) {
  if (!label) return ''
  let matched = '', matchedKey = ''
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    if (label.includes(key) && key.length > matchedKey.length) { matched = icon; matchedKey = key }
  }
  return matched || ICON_DEFAULT
}

function toggleExpand(eventId) {
  expanded.value[eventId] = !expanded.value[eventId]
}

function previewImage(images, current) {
  const urls = images.map(img => img.media_url)
  uni.previewImage({ urls, current: current.media_url, indicator: 'number' })
}

function openGallery() {
  showGallery.value = true
}

async function loadEvents() {
  try {
    const data = await familyStore.loadMemberTimeline(props.memberId)
    events.value = data || []
  } catch (e) {
    console.error('加载时间线失败:', e)
  }
}

onMounted(() => { if (props.memberId) loadEvents() })
watch(() => props.memberId, (id) => { if (id) { expanded.value = {}; loadEvents() } })
</script>

<style>
.timeline-view { padding: 0 var(--spacing-xs); }
.section-title { font-size: var(--font-size-md); font-weight: bold; margin-bottom: var(--spacing-sm); display: block; }
.event-card {
  background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md);
  margin-bottom: var(--spacing-sm); overflow: hidden;
}
.event-header {
  display: flex; align-items: center; gap: var(--spacing-sm);
  padding: var(--spacing-sm); min-height: 48px;
}
.event-year { color: var(--primary); font-weight: bold; font-size: var(--font-size-base); min-width: 48px; }
.event-icon { font-size: var(--font-size-md); }
.event-title { flex: 1; font-size: var(--font-size-base); }
.expand-btn { font-size: var(--font-size-sm); color: var(--text-hint); min-width: 24px; text-align: center; }
.event-body { padding: 0 var(--spacing-sm) var(--spacing-sm); border-top: 1px dashed var(--border-light); margin-top: 0; padding-top: var(--spacing-sm); }
.event-desc { font-size: var(--font-size-base); color: var(--text-primary); line-height: 1.6; display: block; margin-bottom: var(--spacing-xs); }
.event-location { font-size: var(--font-size-sm); color: var(--text-secondary); display: block; margin-bottom: var(--spacing-sm); }
.event-images { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.thumb { width: 80px; height: 80px; border-radius: var(--radius-sm); }
.more-thumb {
  width: 80px; height: 80px; border-radius: var(--radius-sm); background: var(--bg-hover);
  display: flex; align-items: center; justify-content: center;
  font-size: var(--font-size-base); color: var(--text-secondary);
}
.bio-text { font-size: var(--font-size-base); color: var(--text-primary); line-height: 1.6; padding: var(--spacing-sm) 0; }
.empty-timeline { font-size: var(--font-size-base); color: var(--text-hint); text-align: center; padding: var(--spacing-lg) 0; }
.gallery-entry {
  text-align: center; padding: var(--spacing-sm); color: var(--primary); font-size: var(--font-size-base);
  min-height: 48px; display: flex; align-items: center; justify-content: center;
}
</style>
