<template>
  <view class="timeline-editor">
    <text class="section-title">📜 生平时间线</text>

    <view v-if="loading" class="loading-text">加载中...</view>
    <view v-for="event in events" :key="event.id" class="event-list-item">
      <view class="event-summary" @click="toggleEdit(event.id)">
        <text class="event-year">{{ event.year_display }}</text>
        <text class="event-icon">{{ getIcon(event.event_type_label) }}</text>
        <text class="event-title">{{ event.event_title }}</text>
        <text v-if="event.images?.length" class="image-badge">📷 {{ event.images.length }}</text>
      </view>
      <view class="event-actions">
        <text class="btn-sm" @click.stop="startEdit(event)">✏️</text>
        <text class="btn-sm btn-del" @click.stop="confirmDel(event)">🗑️</text>
      </view>
    </view>

    <button class="btn-add-event" @click="startAdd">+ 添加事件</button>

    <!-- 事件编辑弹窗 -->
    <view v-if="showEditor" class="event-editor-overlay" @click.self="closeEditor">
      <view class="event-editor">
        <text class="editor-title">{{ editingEvent ? '编辑事件' : '添加事件' }}</text>

        <view class="form-group">
          <text class="form-label">年份 *</text>
          <input v-model="editForm.year_display" placeholder="如 1965、约1940年、1930年代" class="form-input" />
        </view>
        <view class="form-group">
          <text class="form-label">年份排序值</text>
          <input v-model="editForm.year_sort" placeholder="自动计算，可手动修正" type="number" class="form-input" />
          <text class="form-hint">若希望按特定年份排序，请手动填写；留空则自动识别。</text>
        </view>
        <view class="form-group">
          <text class="form-label">事件标签</text>
          <view class="tag-select">
            <text
              v-for="tag in quickTags" :key="tag"
              class="tag-option"
              :class="{ active: editForm.event_type_label === tag }"
              @click="editForm.event_type_label = editForm.event_type_label === tag ? '' : tag"
            >{{ tag }}</text>
          </view>
          <input v-model="editForm.event_type_label" placeholder="自由输入标签" class="form-input" />
        </view>
        <view class="form-group">
          <text class="form-label">事件标题 *</text>
          <input v-model="editForm.event_title" placeholder="≤ 50 字" maxlength="50" class="form-input" />
        </view>
        <view class="form-group">
          <text class="form-label">地点（选填）</text>
          <input v-model="editForm.location" placeholder="如 北京" class="form-input" />
        </view>
        <view class="form-group">
          <text class="form-label">详细描述（选填）</text>
          <textarea v-model="editForm.description" placeholder="≤ 2000 字" maxlength="2000" class="form-textarea"></textarea>
        </view>

        <!-- 图片管理（仅编辑已有事件时显示） -->
        <view v-if="editingEvent" class="form-group">
          <text class="form-label">图片（选填）</text>
          <view class="image-list">
            <view v-for="(img, i) in editImages" :key="img.id || i" class="image-item">
              <image :src="img.media_url + '?width=80&height=80'" mode="aspectFill" class="image-thumb" />
              <input v-model="img.caption" placeholder="图片说明" maxlength="50" class="image-caption" @blur="saveCaption(img)" />
              <text class="image-delete" @click="deleteImage(img)">✕</text>
            </view>
          </view>
          <view class="image-uploading" v-if="uploading">
            <text>上传中...</text>
          </view>
          <text v-if="editImages.length < 9" class="btn-add-image" @click="addImages">+ 添加图片</text>
          <text v-else class="btn-add-image disabled">已达上限（9张）</text>
          <text class="form-hint">支持 JPG/PNG/WEBP，单张 ≤ 10MB，不压缩保留原图</text>
        </view>

        <view class="editor-actions">
          <button class="btn-cancel" @click="closeEditor">取消</button>
          <button class="btn-save" :disabled="!editForm.year_display || !editForm.event_title || saving" @click="saveEvent">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </view>
      </view>
    </view>

    <!-- 删除确认 -->
    <view v-if="showDelConfirm" class="event-editor-overlay" @click.self="showDelConfirm = false; deletingEvent = null">
      <view class="event-editor confirm-box">
        <text class="confirm-title">确认删除事件</text>
        <text class="confirm-text">确定要删除这个事件吗？关联的图片也会被移除。</text>
        <view class="editor-actions">
          <button class="btn-cancel" @click="showDelConfirm = false">取消</button>
          <button class="btn-danger" @click="doDelete">确认删除</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useFamilyStore } from '@/stores/familyStore'
import { supabase } from '@/utils/supabase'
import { ICON_MAP, ICON_DEFAULT, TAG_QUICK_SELECT } from '@/utils/constants'

const props = defineProps({ memberId: { type: String, required: true } })
const emit = defineEmits(['changed'])

const familyStore = useFamilyStore()
const events = ref([])
const showEditor = ref(false)
const showDelConfirm = ref(false)
const editingEvent = ref(null)
const deletingEvent = ref(null)
const saving = ref(false)
const loading = ref(false)
const quickTags = TAG_QUICK_SELECT
const editImages = ref([])
const uploading = ref(false)

const editForm = ref(emptyForm())

function emptyForm() {
  return { year_display: '', year_sort: '', event_type_label: '', event_title: '', location: '', description: '' }
}

function getIcon(label) {
  if (!label) return ''
  let matched = '', matchedKey = ''
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    if (label.includes(key) && key.length > matchedKey.length) { matched = icon; matchedKey = key }
  }
  return matched || ICON_DEFAULT
}

async function loadEvents() {
  loading.value = true
  try {
    const data = await familyStore.loadMemberTimeline(props.memberId)
    events.value = data || []
  } finally {
    loading.value = false
  }
}

function startAdd() {
  editingEvent.value = null
  editForm.value = emptyForm()
  showEditor.value = true
}

function startEdit(event) {
  editingEvent.value = event
  editForm.value = {
    year_display: event.year_display,
    year_sort: event.year_sort ?? '',
    event_type_label: event.event_type_label || '',
    event_title: event.event_title,
    location: event.location || '',
    description: event.description || '',
  }
  showEditor.value = true
  // 加载已有图片
  editImages.value = (event.images || []).map(img => ({ ...img }))
}

function closeEditor() {
  clearTimeout(captionTimer)
  showEditor.value = false
  editingEvent.value = null
  editImages.value = []
}

async function addImages() {
  const { chooseImages, validateImage } = await import('@/utils/imageUtils')
  try {
    const res = await chooseImages(9 - editImages.value.length)
    uploading.value = true
    for (let i = 0; i < res.tempFiles.length; i++) {
      const file = res.tempFiles[i]
      try {
        validateImage(file)
        const img = await familyStore.uploadEventImage(
          props.memberId,
          editingEvent.value.id,
          file.path || file.url,
          file.name || `image_${Date.now()}.jpg`
        )
        editImages.value.push(img)
      } catch (e) {
        uni.showToast({ title: `图片 ${i+1} 上传失败: ${e.message}`, icon: 'none', duration: 2000 })
      }
    }
  } catch (e) {
    if (e.errMsg !== 'chooseImage:fail cancel') {
      uni.showToast({ title: '选择图片失败', icon: 'none' })
    }
  } finally {
    uploading.value = false
  }
}

async function deleteImage(img) {
  try {
    await familyStore.deleteEventImage(img.id, img.media_url, props.memberId)
    editImages.value = editImages.value.filter(x => x.id !== img.id)
    uni.showToast({ title: '已删除图片', icon: 'success' })
  } catch (e) {
    uni.showToast({ title: '删除失败', icon: 'error', duration: 2000 })
  }
}

let captionTimer = null
async function saveCaption(img) {
  if (!img.id) return
  clearTimeout(captionTimer)
  captionTimer = setTimeout(async () => {
    try {
      await familyStore.updateImageCaption(img.id, img.caption || '', props.memberId)
    } catch (e) {
      uni.showToast({ title: '保存说明失败', icon: 'none' })
    }
  }, 500)
}

async function saveEvent() {
  if (!editForm.value.year_display || !editForm.value.event_title) return
  saving.value = true
  try {
    const payload = {
      year_display: editForm.value.year_display,
      year_sort: editForm.value.year_sort !== '' ? parseInt(editForm.value.year_sort) : null,
      event_type_label: editForm.value.event_type_label || null,
      event_title: editForm.value.event_title,
      location: editForm.value.location || null,
      description: editForm.value.description || null,
    }
    if (editingEvent.value) {
      await familyStore.updateEvent(editingEvent.value.id, props.memberId, payload)
    } else {
      await familyStore.addEvent(props.memberId, payload)
    }
    closeEditor()
    await loadEvents()
    emit('changed')
  } catch (e) {
    uni.showToast({ title: '保存失败: ' + e.message, icon: 'error', duration: 3000 })
  } finally {
    saving.value = false
  }
}

function confirmDel(event) {
  deletingEvent.value = event
  showDelConfirm.value = true
}

async function doDelete() {
  if (!deletingEvent.value) return
  try {
    await familyStore.deleteEvent(deletingEvent.value.id, props.memberId)
    showDelConfirm.value = false
    deletingEvent.value = null
    await loadEvents()
    emit('changed')
  } catch (e) {
    uni.showToast({ title: '删除失败', icon: 'error', duration: 3000 })
  }
}

onMounted(() => { if (props.memberId) loadEvents() })
watch(() => props.memberId, (id) => { if (id) loadEvents() })
onUnmounted(() => clearTimeout(captionTimer))

defineExpose({ loadEvents })
</script>

<style>
.timeline-editor { margin-top: var(--spacing-md); padding: 0 var(--spacing-xs); }
.section-title { font-size: var(--font-size-md); font-weight: bold; margin-bottom: var(--spacing-sm); display: block; }
.event-list-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px var(--spacing-sm); background: var(--bg-hover); border-radius: var(--radius-sm); margin-bottom: 6px;
}
.event-summary { flex: 1; display: flex; align-items: center; gap: var(--spacing-sm); min-height: 44px; }
.event-year { color: var(--primary); font-weight: bold; font-size: var(--font-size-base); min-width: 48px; }
.event-icon { font-size: var(--font-size-md); }
.event-title { font-size: var(--font-size-base); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.image-badge { font-size: var(--font-size-sm); color: var(--text-secondary); }
.event-actions { display: flex; gap: var(--spacing-xs); }
.btn-sm { min-width: 40px; min-height: 40px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); }
.btn-sm:active { background: var(--bg-page); }
.btn-del { color: var(--error); }
.btn-add-event {
  width: 100%; height: 44px; background: var(--bg-card); border: 1px dashed var(--border-light);
  border-radius: var(--radius-md); color: var(--primary); margin-top: var(--spacing-sm);
}

/* 编辑器弹窗 */
.event-editor-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 250;
  padding: var(--spacing-lg); animation: fadeIn 0.2s ease;
}
.event-editor {
  background: var(--bg-card); border-radius: var(--radius-xl); padding: var(--spacing-lg);
  width: 100%; max-width: 420px; max-height: 85vh; overflow-y: auto;
  animation: fadeInUp 0.3s ease;
}
.editor-title { font-size: var(--font-size-md); font-weight: bold; text-align: center; font-family: var(--font-family-title); margin-bottom: var(--spacing-md); }
.form-group { margin-bottom: var(--spacing-sm); }
.form-label { font-size: var(--font-size-sm); color: var(--text-secondary); margin-bottom: var(--spacing-xs); display: block; }
.form-input { width: 100%; height: 44px; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 0 var(--spacing-sm); font-size: var(--font-size-base); background: var(--bg-card); }
.form-input:focus { border-color: var(--primary); outline: none; }
.form-textarea { width: 100%; height: 80px; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 10px var(--spacing-sm); font-size: var(--font-size-base); background: var(--bg-card); }
.form-hint { font-size: var(--font-size-sm); color: var(--text-hint); margin-top: var(--spacing-xs); }
.tag-select { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.tag-option {
  padding: var(--spacing-xs) var(--spacing-sm); border-radius: var(--radius-full); border: 1px solid var(--border-light);
  font-size: var(--font-size-sm); min-width: 44px; min-height: 36px;
  display: flex; align-items: center; justify-content: center; transition: all var(--transition-fast);
}
.tag-option.active { border-color: var(--primary); background: var(--accent-gold-light); color: var(--primary); }
.editor-actions { display: flex; gap: var(--spacing-sm); margin-top: var(--spacing-lg); }
.btn-cancel { flex: 1; height: 44px; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-size: var(--font-size-base); }
.btn-save { flex: 1; height: 44px; background: var(--primary); color: #fff; border-radius: var(--radius-sm); font-size: var(--font-size-base); }
.btn-save[disabled] { opacity: 0.5; }
.btn-danger { flex: 1; height: 44px; background: var(--error); color: #fff; border-radius: var(--radius-sm); }
.confirm-box { max-width: 320px; }
.confirm-title { font-size: var(--font-size-md); font-weight: bold; text-align: center; margin-bottom: var(--spacing-sm); }
.confirm-text { font-size: var(--font-size-base); color: var(--text-secondary); text-align: center; margin: var(--spacing-md) 0; }
.loading-text { text-align: center; color: var(--text-hint); padding: var(--spacing-lg); }

/* 图片管理 */
.image-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px; }
.image-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px; background: var(--bg-hover); border-radius: var(--radius-sm);
}
.image-thumb { width: 60px; height: 60px; border-radius: var(--radius-sm); flex-shrink: 0; }
.image-caption {
  flex: 1; height: 36px; border: none; background: transparent;
  font-size: var(--font-size-sm); color: var(--text-primary);
  border-bottom: 1px solid var(--border-light);
}
.image-delete {
  min-width: 40px; min-height: 40px; display: flex; align-items: center; justify-content: center;
  color: var(--error); font-size: var(--font-size-md);
}
.image-uploading { text-align: center; color: var(--text-hint); padding: 8px; }
.btn-add-image {
  display: block; text-align: center; padding: 10px; color: var(--primary);
  border: 1px dashed var(--primary); border-radius: var(--radius-sm);
  font-size: var(--font-size-base); min-height: 44px; line-height: 24px;
}
</style>
