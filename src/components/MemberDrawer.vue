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

      <view v-if="mediaList.length" class="drawer-section">
        <text class="drawer-label">照片</text>
        <scroll-view scroll-x class="photo-scroll">
          <view class="photo-row">
            <view v-for="ph in mediaList" :key="ph.id" class="photo-item" @tap="viewPhoto(ph)">
              <image class="photo-img" :src="ph.mediaUrl" mode="aspectFill" />
              <view v-if="authStore.isAdmin" class="photo-del" @tap.stop="deletePhoto(ph)">
                <text class="photo-del-text">✕</text>
              </view>
            </view>
            <view v-if="authStore.isAdmin" class="photo-add" @tap="pickPhoto">
              <text class="photo-add-text">+</text>
            </view>
          </view>
        </scroll-view>
      </view>

      <view v-else-if="authStore.isAdmin" class="drawer-section">
        <text class="drawer-label">照片</text>
        <view class="photo-add photo-add--empty" @tap="pickPhoto">
          <text class="photo-add-text">+ 上传照片</text>
        </view>
      </view>

      <input ref="fileInput" class="photo-file-input" type="file" accept="image/*" @change="onFilePicked" />

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

      <view class="drawer-actions">
        <view v-if="authStore.isAdmin" class="drawer-edit-btn" @tap="openEdit">
          <text class="drawer-edit-text">编辑</text>
        </view>
        <view class="drawer-close" @tap="close">
          <text class="drawer-close-text">关闭</text>
        </view>
      </view>
    </view>
  </view>

  <!-- 照片放大预览 -->
  <view v-if="previewPhoto" class="photo-preview-mask" @tap="previewPhoto = null">
    <image class="photo-preview-img" :src="previewPhoto.mediaUrl" mode="widthFix" />
  </view>

  <!-- 编辑成员弹窗 -->
  <MemberEditModal
    v-if="showEdit"
    :member-id="member?.id ?? null"
    @close="showEdit = false"
    @saved="handleSaved"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFamilyStore } from '@/stores/familyStore'
import { useUiStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/utils/supabase'
import MemberEditModal from '@/components/MemberEditModal.vue'
import type { MemberMedia } from '@/stores/familyStore'

const familyStore = useFamilyStore()
const uiStore = useUiStore()
const authStore = useAuthStore()

const showEdit = ref(false)
const fileInput = ref<any>(null)
const uploading = ref(false)
const previewPhoto = ref<MemberMedia | null>(null)

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

const mediaList = computed(() => {
  if (!member.value) return []
  return familyStore.getMediaOf(member.value.id)
})

function viewPhoto(ph: MemberMedia) {
  previewPhoto.value = ph
}

function pickPhoto() {
  fileInput.value?.click()
}

async function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !member.value) return
  if (file.size > 10 * 1024 * 1024) {
    console.error('[MemberDrawer] 图片超过 10MB 限制')
    return
  }
  uploading.value = true
  try {
    const path = `${member.value.id}/${Date.now()}_${file.name.replace(/[^\w.-]/g, '_')}`
    const { error: upErr } = await supabase.storage.from('family_photos').upload(path, file)
    if (upErr) throw new Error(upErr.message)
    const { data: pub } = supabase.storage.from('family_photos').getPublicUrl(path)
    const { error: insErr } = await supabase.from('member_media').insert({
      member_id: member.value.id,
      media_url: pub.publicUrl,
      media_type: 'image',
      sort_order: mediaList.value.length + 1,
    })
    if (insErr) throw new Error(insErr.message)
    await familyStore.loadFromDatabase()
  } catch (err: any) {
    console.error('[MemberDrawer] 上传失败:', err)
  } finally {
    uploading.value = false
  }
}

async function deletePhoto(ph: MemberMedia) {
  try {
    // 从 Storage 删除文件
    const path = ph.mediaUrl.split('/family_photos/')[1]
    if (path) {
      await supabase.storage.from('family_photos').remove([path])
    }
    const { error } = await supabase.from('member_media').delete().eq('id', ph.id)
    if (error) throw new Error(error.message)
    await familyStore.loadFromDatabase()
  } catch (err: any) {
    console.error('[MemberDrawer] 删除照片失败:', err)
  }
}

function close() {
  uiStore.selectMember(null)
  uiStore.setLineagePath(new Set())
}

function openEdit() {
  showEdit.value = true
}

async function handleSaved() {
  showEdit.value = false
  await familyStore.loadFromDatabase()
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

.drawer-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.drawer-actions .drawer-close {
  flex: 1;
  margin-top: 0;
}

.drawer-edit-btn {
  flex: 1;
  text-align: center;
  padding: 10px;
  border-radius: 8px;
  background: linear-gradient(135deg, #8b1a1a, #a83232);
}

.drawer-edit-text {
  font-size: 14px;
  color: #fff;
  font-family: 'Noto Serif SC', serif;
  letter-spacing: 1px;
}

.drawer-close-text {
  font-size: 14px;
  color: #9a8e7a;
  font-family: 'Noto Serif SC', serif;
}

.photo-scroll {
  width: 100%;
}

.photo-row {
  display: flex;
  gap: 10px;
  padding-bottom: 4px;
}

.photo-item {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(232, 223, 204, 0.3);
}

.photo-img {
  width: 100%;
  height: 100%;
}

.photo-del {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(43, 38, 34, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.photo-del-text {
  font-size: 10px;
  color: #fff;
}

.photo-add {
  width: 88px;
  height: 88px;
  border-radius: 10px;
  border: 1px dashed rgba(139, 26, 26, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(139, 26, 26, 0.04);

  &--empty {
    width: 100%;
    height: 56px;
  }
}

.photo-add-text {
  font-size: 22px;
  color: #8b1a1a;
  font-family: 'Noto Serif SC', serif;
}

.photo-add--empty .photo-add-text {
  font-size: 14px;
}

.photo-file-input {
  display: none;
}

.photo-preview-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(43, 38, 34, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 980;
  padding: 24px;
}

.photo-preview-img {
  max-width: 100%;
  max-height: 80vh;
  border-radius: 8px;
}
</style>
