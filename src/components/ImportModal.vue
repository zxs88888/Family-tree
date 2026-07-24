<template>
  <view class="import-backdrop" @tap.self="closeModal">
    <view class="import-card">
      <text class="import-title">导入 CSV 数据</text>

      <!-- 步骤 1：选择文件 -->
      <view v-if="step === 'select'" class="import-step">
        <view class="import-dropzone" @tap="triggerFileInput">
          <text class="import-dropzone-icon">📄</text>
          <text class="import-dropzone-text">点击选择 CSV 文件</text>
          <text class="import-dropzone-hint">支持 UTF-8 / GBK 编码</text>
        </view>
        <input
          ref="fileInputRef"
          type="file"
          accept=".csv"
          class="import-file-input"
          @change="handleFileSelect"
        />
      </view>

      <!-- 步骤 2：预览 -->
      <view v-else-if="step === 'preview'" class="import-step">
        <view class="import-file-info">
          <text class="import-file-name">{{ fileName }}</text>
          <text class="import-file-count">共 {{ parsedMembers.length }} 条记录</text>
        </view>

        <!-- 预览表格 -->
        <scroll-view class="import-preview" scroll-y>
          <view class="import-preview-header">
            <text class="import-preview-cell import-preview-cell--name">姓名</text>
            <text class="import-preview-cell">性别</text>
            <text class="import-preview-cell">父亲</text>
            <text class="import-preview-cell">配偶</text>
          </view>
          <view v-for="(member, idx) in previewMembers" :key="idx" class="import-preview-row">
            <text class="import-preview-cell import-preview-cell--name">{{ member.name }}</text>
            <text class="import-preview-cell">{{ member.gender === 1 ? '男' : '女' }}</text>
            <text class="import-preview-cell">{{ member.fatherName || '-' }}</text>
            <text class="import-preview-cell">{{ member.spouseName || '-' }}</text>
          </view>
        </scroll-view>

        <!-- 解析错误 -->
        <view v-if="parseErrors.length > 0" class="import-errors">
          <text class="import-errors-title">解析警告：</text>
          <text v-for="(err, idx) in parseErrors" :key="idx" class="import-errors-item">{{ err }}</text>
        </view>

        <!-- 清空重导开关 -->
        <view class="import-clear-toggle" @tap="clearFirst = !clearFirst">
          <view class="import-checkbox" :class="{ 'import-checkbox--on': clearFirst }">
            <text v-if="clearFirst" class="import-checkbox-icon">✓</text>
          </view>
          <text class="import-clear-label">导入前清空现有数据（仅首次全量导入或重置时勾选）</text>
        </view>

        <view class="import-actions">
          <view class="import-btn import-btn--secondary" @tap="resetToSelect">
            <text class="import-btn-text import-btn-text--secondary">重新选择</text>
          </view>
          <view class="import-btn import-btn--primary" @tap="handleImport">
            <text class="import-btn-text">确认导入</text>
          </view>
        </view>
      </view>

      <!-- 步骤 3：导入中 -->
      <view v-else-if="step === 'importing'" class="import-step import-step--center">
        <view class="import-spinner" />
        <text class="import-status-text">正在导入数据...</text>
      </view>

      <!-- 步骤 4：结果 -->
      <view v-else-if="step === 'result'" class="import-step import-step--center">
        <text class="import-result-icon">{{ importReport && importReport.errors === 0 ? '✓' : '⚠' }}</text>
        <text class="import-result-title">导入完成</text>
        <view v-if="importReport" class="import-result-stats">
          <text class="import-result-stat">新增：{{ importReport.inserted }} 人</text>
          <text v-if="importReport.updated" class="import-result-stat">更新：{{ importReport.updated }} 人</text>
          <text v-if="importReport.skipped" class="import-result-stat">跳过：{{ importReport.skipped }} 人</text>
          <text v-if="importReport.errors > 0" class="import-result-stat import-result-stat--error">
            错误：{{ importReport.errors }} 条
          </text>
        </view>
        <text v-if="importReport?.error_message" class="import-result-error">{{ importReport.error_message }}</text>
        <view class="import-btn import-btn--primary" @tap="handleDone">
          <text class="import-btn-text">完成</text>
        </view>
      </view>

      <!-- 关闭按钮 -->
      <view v-if="step !== 'importing'" class="import-close" @tap="closeModal">
        <text class="import-close-text">✕</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { decodeFileContent, parseCsv } from '@/utils/csvParser'
import type { ParsedMember } from '@/utils/csvParser'
import { executeImport, clearExistingData } from '@/utils/dataImporter'
import type { ImportReport } from '@/utils/dataImporter'

const emit = defineEmits<{
  close: []
  imported: []
}>()

type Step = 'select' | 'preview' | 'importing' | 'result'

const step = ref<Step>('select')
const fileName = ref('')
const parsedMembers = ref<ParsedMember[]>([])
const parseErrors = ref<string[]>([])
const importReport = ref<ImportReport | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const importDone = ref(false) // 标记是否执行过导入（无论新增还是跳过）
const clearFirst = ref(false) // 默认智能合并（不清空），支持多支脉系增量导入

const previewMembers = computed(() => parsedMembers.value.slice(0, 8))

function triggerFileInput() {
  // H5 原生文件选择
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.csv'
  input.onchange = (e: Event) => {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (file) {
      processFile(file)
    }
  }
  input.click()
}

async function processFile(file: File) {
  fileName.value = file.name

  try {
    const buffer = await file.arrayBuffer()
    const content = decodeFileContent(buffer)
    const result = parseCsv(content)

    parsedMembers.value = result.members
    parseErrors.value = result.errors

    if (result.members.length === 0) {
      parseErrors.value.push('未能解析到有效数据，请检查文件格式')
      return
    }

    step.value = 'preview'
  } catch (err: any) {
    parseErrors.value = [`文件读取失败：${err.message}`]
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    processFile(file)
  }
}

function resetToSelect() {
  step.value = 'select'
  fileName.value = ''
  parsedMembers.value = []
  parseErrors.value = []
}

async function handleImport() {
  step.value = 'importing'

  try {
    // 如果勾选了清空，先清空现有数据
    if (clearFirst.value) {
      const clearResult = await clearExistingData()
      if (clearResult.error) {
        importReport.value = {
          inserted: 0,
          skipped: 0,
          errors: 1,
          error_message: `清空失败：${clearResult.error}`,
        }
        step.value = 'result'
        return
      }
    }
    importReport.value = await executeImport(parsedMembers.value)
    importDone.value = true // 导入已执行（可能新增或更新了关系）
    step.value = 'result'
  } catch (err: any) {
    importReport.value = {
      inserted: 0,
      skipped: 0,
      errors: 1,
      error_message: err.message || '导入失败',
    }
    step.value = 'result'
  }
}

// 统一关闭逻辑：只要执行过导入就刷新族谱（即使新增为0，也可能更新了关系/配偶）
function closeModal() {
  if (importDone.value) {
    emit('imported')
  } else {
    emit('close')
  }
}

function handleDone() {
  closeModal()
}
</script>

<style lang="scss">
.import-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(43, 38, 34, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.import-card {
  width: 340px;
  max-height: 80vh;
  background: linear-gradient(180deg, #fdfbf7 0%, #faf6ef 100%);
  border-radius: 16px;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 48px rgba(43, 38, 34, 0.2);
  border: 1px solid rgba(201, 169, 110, 0.2);
  position: relative;
}

.import-title {
  display: block;
  font-size: 20px;
  font-weight: bold;
  color: #2b2622;
  font-family: 'Noto Serif SC', serif;
  text-align: center;
  margin-bottom: 20px;
  letter-spacing: 2px;
}

.import-step {
  display: flex;
  flex-direction: column;

  &--center {
    align-items: center;
    padding: 20px 0;
  }
}

.import-dropzone {
  border: 2px dashed rgba(201, 169, 110, 0.5);
  border-radius: 12px;
  padding: 32px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.4);
  transition: border-color 0.2s;

  &:active {
    border-color: #c9a96e;
  }
}

.import-dropzone-icon {
  font-size: 32px;
}

.import-dropzone-text {
  font-size: 15px;
  color: #2b2622;
  font-family: 'Noto Serif SC', serif;
}

.import-dropzone-hint {
  font-size: 12px;
  color: #b8a88a;
  font-family: 'Noto Serif SC', serif;
}

.import-file-input {
  display: none;
}

.import-file-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.import-file-name {
  font-size: 14px;
  color: #2b2622;
  font-family: 'Noto Serif SC', serif;
  font-weight: bold;
}

.import-file-count {
  font-size: 12px;
  color: #6f6657;
  font-family: 'Noto Serif SC', serif;
}

.import-preview {
  max-height: 200px;
  border: 1px solid rgba(201, 169, 110, 0.3);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 12px;
}

.import-preview-header {
  display: flex;
  background: rgba(232, 223, 204, 0.3);
  padding: 8px;
  border-bottom: 1px solid rgba(201, 169, 110, 0.2);
}

.import-preview-row {
  display: flex;
  padding: 8px;
  border-bottom: 1px solid rgba(201, 169, 110, 0.1);

  &:last-child {
    border-bottom: none;
  }
}

.import-preview-cell {
  flex: 1;
  font-size: 12px;
  color: #6f6657;
  font-family: 'Noto Serif SC', serif;
  text-align: center;

  &--name {
    color: #2b2622;
    font-weight: bold;
  }
}

.import-errors {
  background: rgba(192, 86, 79, 0.08);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
}

.import-errors-title {
  display: block;
  font-size: 12px;
  color: #c0564f;
  font-family: 'Noto Serif SC', serif;
  font-weight: bold;
  margin-bottom: 4px;
}

.import-errors-item {
  display: block;
  font-size: 11px;
  color: #c0564f;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 2px;
}

.import-actions {
  display: flex;
  gap: 12px;
}

.import-clear-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 4px;
  margin-bottom: 12px;
}

.import-checkbox {
  width: 18px;
  height: 18px;
  border: 1.5px solid rgba(201, 169, 110, 0.6);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;

  &--on {
    background: #8b1a1a;
    border-color: #8b1a1a;
  }
}

.import-checkbox-icon {
  font-size: 12px;
  color: #fff;
  line-height: 1;
}

.import-clear-label {
  font-size: 12px;
  color: #6f6657;
  font-family: 'Noto Serif SC', serif;
}

.import-btn {
  flex: 1;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s, opacity 0.2s;

  &:active {
    transform: scale(0.98);
  }

  &--primary {
    background: linear-gradient(135deg, #a83232 0%, #8b1a1a 100%);
    box-shadow: 0 4px 16px rgba(139, 26, 26, 0.25);
  }

  &--secondary {
    background: rgba(201, 169, 110, 0.15);
    border: 1px solid rgba(201, 169, 110, 0.4);
  }
}

.import-btn-text {
  font-size: 14px;
  font-weight: bold;
  font-family: 'Noto Serif SC', serif;
  color: #fff;
  letter-spacing: 1px;

  &--secondary {
    color: #6f6657;
  }
}

.import-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(201, 169, 110, 0.3);
  border-top-color: #8b1a1a;
  border-radius: 50%;
  animation: import-spin 0.8s linear infinite;
  margin-bottom: 12px;
}

@keyframes import-spin {
  to { transform: rotate(360deg); }
}

.import-status-text {
  font-size: 14px;
  color: #6f6657;
  font-family: 'Noto Serif SC', serif;
}

.import-result-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

.import-result-title {
  font-size: 18px;
  font-weight: bold;
  color: #2b2622;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 16px;
}

.import-result-stats {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 20px;
}

.import-result-stat {
  font-size: 14px;
  color: #6f6657;
  font-family: 'Noto Serif SC', serif;

  &--error {
    color: #c0564f;
  }
}

.import-result-error {
  font-size: 12px;
  color: #c0564f;
  font-family: 'Noto Serif SC', serif;
  margin-bottom: 16px;
  text-align: center;
}

.import-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.import-close-text {
  font-size: 16px;
  color: #b8a88a;
}
</style>
