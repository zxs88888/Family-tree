<template>
  <view class="edit-backdrop" @tap="close">
    <view class="edit-card" @tap.stop>
      <view class="edit-header">
        <text class="edit-title">{{ isNew ? '新增成员' : '编辑成员' }}</text>
        <view class="edit-close" @tap="close">
          <text class="edit-close-text">✕</text>
        </view>
      </view>

      <scroll-view scroll-y class="edit-body">
        <!-- ===== 基本信息 ===== -->
        <text class="edit-section-title">基本信息</text>

        <view class="form-row">
          <text class="form-label">姓名 *</text>
          <input v-model="form.name" class="form-input" :maxlength="-1" placeholder="成员姓名" placeholder-class="form-placeholder" />
        </view>

        <view class="form-row">
          <text class="form-label">性别</text>
          <view class="gender-group">
            <view class="gender-option" :class="{ active: form.gender === 1 }" @tap="form.gender = 1">
              <text class="gender-text">男</text>
            </view>
            <view class="gender-option" :class="{ active: form.gender === 2 }" @tap="form.gender = 2">
              <text class="gender-text">女</text>
            </view>
          </view>
        </view>

        <view class="form-row form-row--half">
          <view class="half-item">
            <text class="form-label">生年</text>
            <input v-model="form.birthYear" class="form-input" :maxlength="-1" type="number" placeholder="如 1944" placeholder-class="form-placeholder" />
          </view>
          <view class="half-item">
            <text class="form-label">卒年</text>
            <input v-model="form.deathYear" class="form-input" :maxlength="-1" type="number" placeholder="在世留空" placeholder-class="form-placeholder" />
          </view>
        </view>

        <view class="form-row">
          <text class="form-label">生平</text>
          <textarea v-model="form.biography" class="form-textarea" :maxlength="-1" placeholder="成员生平介绍" placeholder-class="form-placeholder" />
        </view>

        <!-- ===== 亲属关系 ===== -->
        <text class="edit-section-title">亲属关系</text>

        <view class="form-row">
          <text class="form-label">父亲</text>
          <picker :range="fatherOptions" range-key="name" @change="e => form.fatherId = fatherOptions[Number(e.detail.value)]?.id || ''">
            <view class="form-picker">{{ fatherName || '（选择父亲）' }}</view>
          </picker>
          <view v-if="form.fatherId" class="form-clear" @tap="form.fatherId = ''">
            <text class="form-clear-text">清除</text>
          </view>
        </view>

        <view class="form-row">
          <text class="form-label">母亲</text>
          <picker :range="motherOptions" range-key="name" @change="e => form.motherId = motherOptions[Number(e.detail.value)]?.id || ''">
            <view class="form-picker">{{ motherName || '（选择母亲）' }}</view>
          </picker>
          <view v-if="form.motherId" class="form-clear" @tap="form.motherId = ''">
            <text class="form-clear-text">清除</text>
          </view>
        </view>

        <!-- 配偶列表 -->
        <view v-if="spouseList.length" class="form-row form-row--column">
          <text class="form-label">配偶</text>
          <view v-for="sp in spouseList" :key="sp.spouseId" class="spouse-item">
            <text class="spouse-name">{{ sp.name }}（{{ sp.marriageType }}）</text>
            <view class="spouse-remove" @tap="removeSpouse(sp.spouseId)">
              <text class="spouse-remove-text">移除</text>
            </view>
          </view>
        </view>

        <!-- 添加配偶 -->
        <view v-if="!addingSpouse" class="add-spouse-btn" @tap="addingSpouse = true">
          <text class="add-spouse-text">+ 添加配偶</text>
        </view>
        <view v-else class="add-spouse-panel">
          <view class="form-row">
            <text class="form-label">配偶</text>
            <picker :range="spouseOptions" range-key="name" @change="e => { newSpouse.memberId = spouseOptions[Number(e.detail.value)]?.id || ''; newSpouse.name = spouseOptions[Number(e.detail.value)]?.name || '' }">
              <view class="form-picker">{{ newSpouse.name || '（从现有成员选择）' }}</view>
            </picker>
          </view>
          <view class="add-spouse-actions">
            <view class="add-spouse-cancel" @tap="cancelAddSpouse">
              <text class="add-spouse-cancel-text">取消</text>
            </view>
            <view class="add-spouse-ok" @tap="confirmAddSpouse">
              <text class="add-spouse-ok-text">确定</text>
            </view>
          </view>
        </view>

        <!-- ===== 时间线 ===== -->
        <text class="edit-section-title">时间线</text>

        <view v-if="events.length" class="event-list">
          <view v-for="ev in events" :key="ev.id" class="event-item">
            <view class="event-info" @tap="startEditEvent(ev)">
              <text class="event-year">{{ ev.yearDisplay }}</text>
              <text class="event-label">{{ ev.label }}</text>
              <text class="event-title">{{ ev.title }}</text>
            </view>
            <view class="event-actions">
              <view class="event-del" @tap="removeEvent(ev.id)">
                <text class="event-del-text">删</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 事件编辑表单 -->
        <view v-if="eventEditorOpen" class="event-editor">
          <view class="form-row form-row--half">
            <view class="half-item">
              <text class="form-label">年份 *</text>
              <input v-model="eventForm.year" class="form-input" :maxlength="-1" type="number" placeholder="如 1975" placeholder-class="form-placeholder" />
            </view>
            <view class="half-item">
              <text class="form-label">类型</text>
              <picker :range="LABEL_OPTIONS" @change="e => eventForm.label = LABEL_OPTIONS[Number(e.detail.value)]">
                <view class="form-picker">{{ eventForm.label || '选择类型' }}</view>
              </picker>
            </view>
          </view>
          <view class="form-row">
            <text class="form-label">标题 *</text>
            <input v-model="eventForm.title" class="form-input" :maxlength="-1" placeholder="事件标题" placeholder-class="form-placeholder" />
          </view>
          <view class="form-row">
            <text class="form-label">描述</text>
            <input v-model="eventForm.description" class="form-input" :maxlength="-1" placeholder="事件描述（可选）" placeholder-class="form-placeholder" />
          </view>
          <view class="form-row">
            <text class="form-label">地点</text>
            <input v-model="eventForm.location" class="form-input" :maxlength="-1" placeholder="地点（可选）" placeholder-class="form-placeholder" />
          </view>
          <view class="add-spouse-actions">
            <view class="add-spouse-cancel" @tap="eventEditorOpen = false">
              <text class="add-spouse-cancel-text">取消</text>
            </view>
            <view class="add-spouse-ok" @tap="saveEvent">
              <text class="add-spouse-ok-text">保存事件</text>
            </view>
          </view>
        </view>

        <view v-else class="add-spouse-btn" @tap="startAddEvent">
          <text class="add-spouse-text">+ 添加时间线事件</text>
        </view>

        <!-- 危险操作 -->
        <view v-if="!isNew" class="danger-zone">
          <view class="delete-member-btn" @tap="confirmDelete">
            <text class="delete-member-text">删除该成员</text>
          </view>
        </view>

        <!-- 保存 -->
        <view class="save-btn" @tap="save">
          <text class="save-btn-text">{{ saving ? '保存中...' : '保存' }}</text>
        </view>
      </scroll-view>

      <!-- 错误提示 -->
      <view v-if="errorMsg" class="edit-error">
        <text class="edit-error-text">{{ errorMsg }}</text>
      </view>

      <!-- 删除确认 -->
      <view v-if="showDeleteConfirm" class="confirm-mask" @tap="showDeleteConfirm = false">
        <view class="confirm-box" @tap.stop>
          <text class="confirm-title">确认删除 {{ form.name }}？</text>
          <text class="confirm-hint">删除后该成员将不再显示（其配偶关系同步解除）</text>
          <view class="confirm-actions">
            <view class="confirm-cancel" @tap="showDeleteConfirm = false">
              <text class="confirm-cancel-text">取消</text>
            </view>
            <view class="confirm-ok" @tap="doDelete">
              <text class="confirm-ok-text">删除</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { supabase } from '@/utils/supabase'
import { useFamilyStore } from '@/stores/familyStore'
import type { Member, LifeEvent } from '@/utils/treeTypes'

const props = defineProps<{ memberId: string | null }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'saved'): void }>()

const familyStore = useFamilyStore()
const LABEL_OPTIONS = ['出生', '结婚', '逝世', '入学', '毕业', '参军', '工作', '迁居', '其他']

const isNew = computed(() => !props.memberId)
const member = computed(() => (props.memberId ? familyStore.getMemberById(props.memberId) : undefined))

const form = ref({
  name: '',
  gender: 1 as 1 | 2,
  birthYear: '',
  deathYear: '',
  biography: '',
  fatherId: '',
  motherId: '',
})

const spouseList = ref<{ spouseId: string; name: string; marriageType: string }[]>([])
const removedSpouses = ref<string[]>([])
const addingSpouse = ref(false)
const newSpouse = ref({ memberId: '', name: '' })

const events = ref<LifeEvent[]>([])
const removedEvents = ref<string[]>([])
const eventEditorOpen = ref(false)
const eventForm = ref({ id: '', year: '', label: '', title: '', description: '', location: '' })

const saving = ref(false)
const errorMsg = ref('')
const showDeleteConfirm = ref(false)

// ===== 初始化 =====
const m = member.value
if (m) {
  form.value = {
    name: m.name,
    gender: m.gender,
    birthYear: m.birthYear ? String(m.birthYear) : '',
    deathYear: m.deathYear ? String(m.deathYear) : '',
    biography: m.biography || '',
    fatherId: m.fatherId || '',
    motherId: m.motherId || '',
  }
  spouseList.value = m.spouses.map(s => {
    const sp = familyStore.getMemberById(s.spouseId)
    return { spouseId: s.spouseId, name: sp?.name || '未知', marriageType: s.marriageType }
  })
  events.value = [...familyStore.getEventsOf(m.id)]
}

// ===== 选项 =====
const fatherOptions = computed(() =>
  familyStore.members.filter(x => x.gender === 1 && x.id !== props.memberId).map(x => ({ id: x.id, name: x.name })),
)
const motherOptions = computed(() =>
  familyStore.members.filter(x => x.gender === 2 && x.id !== props.memberId).map(x => ({ id: x.id, name: x.name })),
)
const spouseOptions = computed(() => {
  const existing = new Set(spouseList.value.map(s => s.spouseId))
  return familyStore.members
    .filter(x => x.id !== props.memberId && !existing.has(x.id))
    .map(x => ({ id: x.id, name: x.name }))
})

const fatherName = computed(() => fatherOptions.value.find(x => x.id === form.value.fatherId)?.name || '')
const motherName = computed(() => motherOptions.value.find(x => x.id === form.value.motherId)?.name || '')

// ===== 配偶操作 =====
function removeSpouse(spouseId: string) {
  spouseList.value = spouseList.value.filter(s => s.spouseId !== spouseId)
  removedSpouses.value.push(spouseId)
}

function cancelAddSpouse() {
  addingSpouse.value = false
  newSpouse.value = { memberId: '', name: '' }
}

function confirmAddSpouse() {
  if (!newSpouse.value.memberId) {
    errorMsg.value = '请选择配偶成员'
    return
  }
  const sp = familyStore.getMemberById(newSpouse.value.memberId)
  if (!sp) return
  const order = spouseList.value.length + 1
  spouseList.value.push({ spouseId: sp.id, name: sp.name, marriageType: marriageTypeOf(order) })
  addingSpouse.value = false
  newSpouse.value = { memberId: '', name: '' }
}

function marriageTypeOf(order: number): string {
  const names = ['元配', '次配', '三配', '四配', '五配', '六配']
  return names[order - 1] || `第${order}配`
}

// ===== 事件操作 =====
function startAddEvent() {
  eventForm.value = { id: '', year: '', label: '', title: '', description: '', location: '' }
  eventEditorOpen.value = true
}

function startEditEvent(ev: LifeEvent) {
  eventForm.value = {
    id: ev.id,
    year: ev.yearSort ? String(ev.yearSort) : '',
    label: ev.label,
    title: ev.title,
    description: ev.description || '',
    location: ev.location || '',
  }
  eventEditorOpen.value = true
}

function removeEvent(eventId: string) {
  events.value = events.value.filter(e => e.id !== eventId)
  removedEvents.value.push(eventId)
}

function saveEvent() {
  const year = eventForm.value.year.trim()
  const title = eventForm.value.title.trim()
  if (!year) {
    errorMsg.value = '事件年份必填'
    return
  }
  if (!title) {
    errorMsg.value = '事件标题必填'
    return
  }
  const label = eventForm.value.label || '其他'
  if (eventForm.value.id) {
    const ev = events.value.find(e => e.id === eventForm.value.id)
    if (ev) {
      ev.yearDisplay = year
      ev.yearSort = Number(year)
      ev.label = label
      ev.title = title
      ev.description = eventForm.value.description
      ev.location = eventForm.value.location
    }
  } else {
    events.value.push({
      id: `new-${Date.now()}`,
      memberId: props.memberId || '',
      label,
      title,
      yearDisplay: year,
      yearSort: Number(year),
      description: eventForm.value.description,
      location: eventForm.value.location,
      sortOrder: events.value.length + 1,
    })
  }
  eventEditorOpen.value = false
}

// ===== 保存 =====
async function save() {
  const name = form.value.name.trim()
  if (!name) {
    errorMsg.value = '姓名必填'
    return
  }
  saving.value = true
  errorMsg.value = ''
  try {
    const payload = {
      name,
      gender: form.value.gender,
      birth_year: form.value.birthYear ? Number(form.value.birthYear) : null,
      death_year: form.value.deathYear ? Number(form.value.deathYear) : null,
      is_alive: !form.value.deathYear,
      biography: form.value.biography || null,
      father_id: form.value.fatherId || null,
      mother_id: form.value.motherId || null,
    }

    let targetId = props.memberId

    if (isNew.value) {
      // 新增成员：获取 family_id
      const { data: fam } = await supabase.from('families').select('id').limit(1)
      const familyId = (fam as any)?.[0]?.id
      const { data, error } = await supabase
        .from('members')
        .insert({ ...payload, family_id: familyId || undefined })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      targetId = data.id
    } else {
      // 更新成员
      const { error } = await supabase.from('members').update(payload).eq('id', props.memberId!)
      if (error) throw new Error(error.message)
    }

    if (!targetId) throw new Error('未获取到成员 ID')

    // 移除的配偶（双向删除）
    for (const sid of removedSpouses.value) {
      await supabase.from('spouses').delete().eq('member_id', targetId).eq('spouse_id', sid)
      await supabase.from('spouses').delete().eq('member_id', sid).eq('spouse_id', targetId)
    }

    // 当前配偶列表：补齐新增的
    const existingIds = new Set((member.value?.spouses || []).map(s => s.spouseId))
    for (let i = 0; i < spouseList.value.length; i++) {
      const sp = spouseList.value[i]
      if (existingIds.has(sp.spouseId)) continue
      const order = i + 1
      const type = marriageTypeOf(order)
      const { error } = await supabase.from('spouses').insert([
        { member_id: targetId, spouse_id: sp.spouseId, marriage_order: order, marriage_type: type },
        { member_id: sp.spouseId, spouse_id: targetId, marriage_order: order, marriage_type: type },
      ])
      if (error) throw new Error(error.message)
    }

    // 时间线事件
    for (const ev of events.value) {
      const evPayload = {
        member_id: targetId,
        event_type_label: ev.label,
        event_title: ev.title,
        year_display: ev.yearDisplay,
        year_sort: ev.yearSort ?? Number(ev.yearDisplay),
        location: ev.location || null,
        description: ev.description || null,
        sort_order: ev.sortOrder || 0,
      }
      if (ev.id.startsWith('new-')) {
        const { error } = await supabase.from('life_events').insert(evPayload)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('life_events').update(evPayload).eq('id', ev.id)
        if (error) throw new Error(error.message)
      }
    }
    for (const evId of removedEvents.value) {
      const { error } = await supabase.from('life_events').delete().eq('id', evId)
      if (error) throw new Error(error.message)
    }

    emit('saved')
  } catch (err: any) {
    errorMsg.value = err.message || '保存失败'
  } finally {
    saving.value = false
  }
}

// ===== 删除成员（软删除）=====
function confirmDelete() {
  showDeleteConfirm.value = true
}

async function doDelete() {
  if (!props.memberId) return
  saving.value = true
  try {
    // 软删除成员
    const { error } = await supabase.from('members').update({ is_deleted: true }).eq('id', props.memberId)
    if (error) throw new Error(error.message)
    // 清除配偶关系（双向）
    const { data: rels } = await supabase.from('spouses').select('spouse_id').eq('member_id', props.memberId)
    for (const r of rels || []) {
      await supabase.from('spouses').delete().eq('member_id', r.spouse_id).eq('spouse_id', props.memberId)
    }
    await supabase.from('spouses').delete().eq('member_id', props.memberId)
    showDeleteConfirm.value = false
    emit('saved')
  } catch (err: any) {
    errorMsg.value = err.message || '删除失败'
  } finally {
    saving.value = false
  }
}

function close() {
  emit('close')
}
</script>

<style lang="scss">
.edit-backdrop {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(43, 38, 34, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  z-index: 920;
}

.edit-card {
  width: 100%;
  background: linear-gradient(180deg, #fdfbf7 0%, #faf6ef 100%);
  border-radius: 20px 20px 0 0;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -8px 32px rgba(43, 38, 34, 0.2);
}

.edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 12px;
}

.edit-title {
  font-size: 18px;
  font-weight: bold;
  color: #2b2622;
  font-family: 'Noto Serif SC', serif;
}

.edit-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(201, 187, 160, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-close-text {
  font-size: 12px;
  color: #9a8e7a;
}

.edit-body {
  max-height: 68vh;
  padding: 0 24px 24px;
}

.edit-section-title {
  display: block;
  font-size: 13px;
  font-weight: bold;
  color: #8b1a1a;
  font-family: 'Noto Serif SC', serif;
  letter-spacing: 1px;
  margin: 18px 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(201, 187, 160, 0.4);
}

.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;

  &--half {
    gap: 12px;
  }

  &--column {
    flex-direction: column;
    align-items: flex-start;
  }
}

.half-item {
  flex: 1;
  min-width: 0;
}

.form-label {
  display: block;
  font-size: 13px;
  color: #6f6657;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 4px;
  flex-shrink: 0;
}

.form-row > .form-label {
  width: 64px;
  margin-bottom: 0;
}

.form-input {
  flex: 1;
  height: 38px;
  background: rgba(232, 223, 204, 0.25);
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  color: #2b2622;
  font-family: 'Noto Serif SC', serif;
}

.form-textarea {
  flex: 1;
  min-height: 72px;
  background: rgba(232, 223, 204, 0.25);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: #2b2622;
  font-family: 'Noto Serif SC', serif;
}

.form-placeholder {
  color: #b8a88a;
}

.form-picker {
  flex: 1;
  height: 38px;
  line-height: 38px;
  background: rgba(232, 223, 204, 0.25);
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  color: #3d3529;
  font-family: 'Noto Serif SC', serif;
}

.form-clear {
  margin-left: 8px;
  padding: 4px 8px;
}

.form-clear-text {
  font-size: 12px;
  color: #8b1a1a;
  font-family: 'Noto Serif SC', serif;
}

.gender-group {
  display: flex;
  gap: 10px;
}

.gender-option {
  padding: 6px 18px;
  border-radius: 8px;
  background: rgba(232, 223, 204, 0.25);
  border: 1px solid transparent;

  &.active {
    background: rgba(139, 26, 26, 0.1);
    border-color: #8b1a1a;
  }
}

.gender-text {
  font-size: 14px;
  color: #3d3529;
  font-family: 'Noto Serif SC', serif;
}

.spouse-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}

.spouse-name {
  font-size: 14px;
  color: #3d3529;
  font-family: 'Noto Serif SC', serif;
}

.spouse-remove {
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(139, 26, 26, 0.08);
}

.spouse-remove-text {
  font-size: 12px;
  color: #8b1a1a;
  font-family: 'Noto Serif SC', serif;
}

.add-spouse-btn {
  margin-top: 8px;
  padding: 10px;
  border-radius: 8px;
  border: 1px dashed rgba(139, 26, 26, 0.4);
  text-align: center;
}

.add-spouse-text {
  font-size: 13px;
  color: #8b1a1a;
  font-family: 'Noto Serif SC', serif;
}

.add-spouse-panel {
  margin-top: 8px;
  padding: 12px;
  background: rgba(232, 223, 204, 0.15);
  border-radius: 10px;
}

.add-spouse-actions {
  display: flex;
  gap: 12px;
  margin-top: 10px;
}

.add-spouse-cancel, .add-spouse-ok {
  flex: 1;
  padding: 9px 0;
  border-radius: 8px;
  text-align: center;
}

.add-spouse-cancel {
  background: rgba(201, 187, 160, 0.2);
}

.add-spouse-ok {
  background: linear-gradient(135deg, #8b1a1a, #a83232);
}

.add-spouse-cancel-text {
  font-size: 13px;
  color: #9a8e7a;
  font-family: 'Noto Serif SC', serif;
}

.add-spouse-ok-text {
  font-size: 13px;
  color: #fff;
  font-family: 'Noto Serif SC', serif;
}

.event-list {
  margin-bottom: 6px;
}

.event-item {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(201, 187, 160, 0.2);
}

.event-info {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.event-year {
  font-size: 13px;
  font-weight: bold;
  color: #8b1a1a;
  font-family: 'Noto Serif SC', serif;
}

.event-label {
  font-size: 11px;
  color: #b8a88a;
  font-family: 'Noto Serif SC', serif;
  padding: 1px 6px;
  background: rgba(232, 223, 204, 0.35);
  border-radius: 4px;
  flex-shrink: 0;
}

.event-title {
  font-size: 13px;
  color: #3d3529;
  font-family: 'Noto Serif SC', serif;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-actions {
  margin-left: 8px;
}

.event-del {
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(139, 26, 26, 0.08);
}

.event-del-text {
  font-size: 12px;
  color: #8b1a1a;
  font-family: 'Noto Serif SC', serif;
}

.event-editor {
  margin-top: 10px;
  padding: 12px;
  background: rgba(232, 223, 204, 0.15);
  border-radius: 10px;
}

.danger-zone {
  margin-top: 24px;
}

.delete-member-btn {
  padding: 10px;
  border-radius: 8px;
  border: 1px solid rgba(139, 26, 26, 0.35);
  text-align: center;
  background: rgba(139, 26, 26, 0.05);
}

.delete-member-text {
  font-size: 13px;
  color: #8b1a1a;
  font-family: 'Noto Serif SC', serif;
}

.save-btn {
  margin-top: 16px;
  padding: 13px 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #8b1a1a, #a83232);
  text-align: center;
  box-shadow: 0 4px 14px rgba(139, 26, 26, 0.3);
}

.save-btn-text {
  font-size: 15px;
  color: #fff;
  font-family: 'Noto Serif SC', serif;
  letter-spacing: 2px;
}

.edit-error {
  padding: 8px 24px;
}

.edit-error-text {
  font-size: 12px;
  color: #8b1a1a;
  font-family: 'Noto Serif SC', serif;
}

.confirm-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(43, 38, 34, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 960;
}

.confirm-box {
  width: 300px;
  background: #fdfbf7;
  border-radius: 14px;
  padding: 22px;
}

.confirm-title {
  display: block;
  font-size: 16px;
  font-weight: bold;
  color: #2b2622;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 8px;
}

.confirm-hint {
  display: block;
  font-size: 12px;
  color: #9a8e7a;
  font-family: 'Noto Serif SC', serif;
  line-height: 1.6;
  margin-bottom: 18px;
}

.confirm-actions {
  display: flex;
  gap: 12px;
}

.confirm-cancel, .confirm-ok {
  flex: 1;
  padding: 10px 0;
  border-radius: 8px;
  text-align: center;
}

.confirm-cancel {
  background: rgba(201, 187, 160, 0.2);
}

.confirm-ok {
  background: #8b1a1a;
}

.confirm-cancel-text {
  font-size: 14px;
  color: #9a8e7a;
  font-family: 'Noto Serif SC', serif;
}

.confirm-ok-text {
  font-size: 14px;
  color: #fff;
  font-family: 'Noto Serif SC', serif;
}
</style>
