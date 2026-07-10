<template>
  <view class="page-admin">
    <view class="admin-nav">
      <text class="back-btn" @click="goBack">← 返回图谱</text>
      <text class="admin-title">族谱管理</text>
      <text class="import-btn" @click="showImportPanel = true">批量导入</text>
    </view>

    <view class="search-bar">
      <input
        v-model="searchInput"
        placeholder="搜索成员..."
        @input="onSearchDebounced"
      />
    </view>

    <scroll-view class="member-list">
      <view
        v-for="member in filteredMembers"
        :key="member.id"
        class="member-item"
      >
        <view class="member-info">
          <text class="member-name">{{ member.name }}</text>
          <text class="member-gender">{{
            member.gender === 1 ? "👨" : member.gender === 2 ? "👩" : ""
          }}</text>
          <text class="member-status" :class="{ alive: member.is_alive }">
            {{
              member.is_alive
                ? "🟢在世"
                : (member.birth_year || "?") + "-" + (member.death_year || "?")
            }}
          </text>
        </view>
        <view class="member-actions">
          <text class="btn-action" @click="editMember(member)">✏️</text>
          <text class="btn-action" @click="confirmDelete(member)">🗑️</text>
        </view>
      </view>
      <view
        v-if="!keyword && filteredMembers.length === 0 && familyStore.loaded"
        class="empty-list"
      >
        <text>暂无成员，点击下方按钮添加</text>
      </view>
    </scroll-view>

    <view class="filter-bar">
      <text
        class="filter-option"
        :class="{ active: filter === 'all' }"
        @click="filter = 'all'"
        >全部 ({{ familyStore.allMembers.length }})</text
      >
      <text
        class="filter-option"
        :class="{ active: filter === 'orphan' }"
        @click="filter = 'orphan'"
        >关系待完善 ({{ orphanCount }})</text
      >
    </view>

    <button class="btn-add" @click="openAddForm">+ 添加成员</button>

    <!-- 成员表单弹窗 -->
    <view v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <view class="modal-content">
        <text class="modal-title">{{
          editingMember ? "编辑成员" : "添加成员"
        }}</text>
        <view class="form-group">
          <text class="form-label">姓名 *</text>
          <input
            v-model="form.name"
            placeholder="请输入姓名"
            class="form-input"
          />
        </view>
        <view class="form-group">
          <text class="form-label">性别</text>
          <view class="radio-group">
            <text
              class="radio"
              :class="{ active: form.gender === 1 }"
              @click="form.gender = 1"
              >👨 男</text
            >
            <text
              class="radio"
              :class="{ active: form.gender === 2 }"
              @click="form.gender = 2"
              >👩 女</text
            >
          </view>
        </view>
        <view class="form-group">
          <text class="form-label">是否在世</text>
          <text
            class="toggle-switch"
            :class="{ on: form.is_alive }"
            @click="form.is_alive = !form.is_alive"
          >
            {{ form.is_alive ? "🟢 在世" : "⚫ 已故" }}
          </text>
        </view>
        <view class="form-row">
          <view class="form-group half">
            <text class="form-label">生年</text>
            <input
              v-model="form.birth_year"
              placeholder="如 1965"
              type="number"
              class="form-input"
            />
          </view>
          <view class="form-group half">
            <text class="form-label">卒年</text>
            <input
              v-model="form.death_year"
              placeholder="在世留空"
              type="number"
              class="form-input"
              :disabled="form.is_alive"
              :class="{ disabled: form.is_alive }"
            />
          </view>
        </view>
        <view class="form-group">
          <text class="form-label">父亲</text>
          <picker
            :range="memberOptions"
            range-key="name"
            @change="
              (e) =>
                (form.father_id = memberOptions[e.detail.value]?.id || null)
            "
          >
            <view class="picker-value">{{
              getMemberName(form.father_id) || "请选择"
            }}</view>
          </picker>
        </view>
        <view class="form-group">
          <text class="form-label">母亲</text>
          <picker
            :range="memberOptions"
            range-key="name"
            @change="
              (e) =>
                (form.mother_id = memberOptions[e.detail.value]?.id || null)
            "
          >
            <view class="picker-value">{{
              getMemberName(form.mother_id) || "请选择"
            }}</view>
          </picker>
        </view>
        <view class="form-group">
          <text class="form-label">配偶</text>
          <picker
            :range="memberOptions"
            range-key="name"
            @change="
              (e) =>
                (form.spouse_id = memberOptions[e.detail.value]?.id || null)
            "
          >
            <view class="picker-value">{{
              getMemberName(form.spouse_id) || "请选择"
            }}</view>
          </picker>
        </view>
        <!-- 生平时间线编辑（仅在编辑模式可见） -->
        <TimelineEditor
          v-if="editingMember"
          :member-id="editingMember.id"
          @changed="onTimelineChanged"
        />
        <view class="form-actions">
          <button class="btn-cancel" @click="closeForm">取消</button>
          <button
            class="btn-save"
            :disabled="!form.name || saving"
            @click="saveMember"
          >
            {{ saving ? "保存中..." : "保存" }}
          </button>
        </view>
      </view>
    </view>

    <!-- 删除确认弹窗 -->
    <view
      v-if="showDeleteConfirm"
      class="modal-overlay"
      @click.self="showDeleteConfirm = false"
    >
      <view class="modal-content confirm-box">
        <text class="confirm-title">确认删除</text>
        <text class="confirm-text"
          >确定要删除"{{ deletingMember?.name }}"吗？此操作不可撤销。</text
        >
        <view class="form-actions">
          <button class="btn-cancel" @click="showDeleteConfirm = false">
            取消
          </button>
          <button class="btn-danger" @click="doDelete">确认删除</button>
        </view>
      </view>
    </view>

    <!-- 批量导入弹窗 -->
    <view
      v-if="showImportPanel"
      class="modal-overlay"
      @click.self="showImportPanel = false"
    >
      <view class="modal-content import-panel">
        <text class="modal-title">批量导入</text>
        <button class="btn-download" @click="downloadTemplate">
          📥 下载导入模板
        </button>
        <view class="upload-area" @click="chooseFile">
          <text v-if="!selectedFile">点击选择 CSV 文件</text>
          <text v-else>已选择: {{ selectedFile.name }}</text>
        </view>
        <view v-if="previewRows.length > 0" class="preview-area">
          <text class="preview-title"
            >预览（前 {{ previewRows.length }} 行）</text
          >
          <view v-for="(row, i) in previewRows" :key="i" class="preview-row">
            <text>{{ row.姓名 }}</text>
            <text v-if="row.时间线" class="preview-events">
              ({{ row.时间线.split("|||").length }} 事件)</text
            >
          </view>
        </view>
        <view
          v-if="importResult"
          class="import-result"
          :class="{ success: importResult.success }"
        >
          <text>{{
            importResult.success ? "✅ 导入成功" : "❌ 导入失败"
          }}</text>
          <text v-if="importResult.success"
            >共导入 {{ importResult.memberCount }} 人，{{
              importResult.eventCount
            }}
            个事件</text
          >
          <text v-else>{{ importResult.errors?.join(", ") }}</text>
        </view>
        <view class="form-actions">
          <button class="btn-cancel" @click="showImportPanel = false">
            关闭
          </button>
          <button
            class="btn-save"
            :disabled="!selectedFile || importing"
            @click="startImport"
          >
            {{ importing ? "导入中..." : "确认导入" }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useFamilyStore } from "@/stores/familyStore";
import { supabase } from "@/utils/supabase";
import * as XLSX from "xlsx";
import {
  parseTimeline,
  detectDuplicateNames,
  detectCircularDependency,
  resolveReferences,
} from "@/utils/timelineParser";
import TimelineEditor from "@/components/TimelineEditor.vue";

const familyStore = useFamilyStore();
const keyword = ref("");
const filter = ref("all");
const VITE_FAMILY_ID = import.meta.env.VITE_FAMILY_ID;

const filteredMembers = computed(() => {
  let list = familyStore.allMembers;
  if (keyword.value) {
    const kw = keyword.value.toLowerCase();
    list = list.filter((m) => m.name.toLowerCase().includes(kw));
  }
  if (filter.value === "orphan") {
    list = list.filter((m) => !m.father_id && !m.mother_id && !m.spouse_id);
  }
  return list;
});

const orphanCount = computed(() => {
  return familyStore.allMembers.filter(
    (m) => !m.father_id && !m.mother_id && !m.spouse_id,
  ).length;
});

const memberOptions = computed(() => familyStore.allMembers);

function getMemberName(id) {
  if (!id) return "";
  const m = familyStore.allMembers.find((x) => x.id === id);
  return m ? m.name : "";
}

// 搜索防抖
const searchInput = ref("");
const debouncedKeyword = ref("");
let searchTimer = null;
function onSearchDebounced() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    keyword.value = searchInput.value;
  }, 300);
}

function goBack() {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
  } else {
    uni.reLaunch({ url: "/pages/index/index" });
  }
}

// ---- CRUD 表单 ----
const showForm = ref(false);
const editingMember = ref(null);
const saving = ref(false);
const form = ref(emptyForm());

function emptyForm() {
  return {
    name: "",
    gender: null,
    is_alive: true,
    birth_year: "",
    death_year: "",
    father_id: null,
    mother_id: null,
    spouse_id: null,
  };
}

function openAddForm() {
  editingMember.value = null;
  form.value = emptyForm();
  showForm.value = true;
}

function editMember(m) {
  editingMember.value = m;
  form.value = {
    name: m.name,
    gender: m.gender,
    is_alive: m.is_alive !== false,
    birth_year: m.birth_year || "",
    death_year: m.death_year || "",
    father_id: m.father_id,
    mother_id: m.mother_id,
    spouse_id: m.spouse_id,
  };
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingMember.value = null;
}

async function saveMember() {
  if (!form.value.name) return;
  saving.value = true;
  try {
    const payload = {
      name: form.value.name,
      gender: form.value.gender,
      is_alive: form.value.is_alive,
      birth_year: form.value.birth_year
        ? parseInt(form.value.birth_year)
        : null,
      death_year: form.value.death_year
        ? parseInt(form.value.death_year)
        : null,
      father_id: form.value.father_id,
      mother_id: form.value.mother_id,
      spouse_id: form.value.spouse_id,
    };
    if (editingMember.value) {
      await familyStore.updateMember(editingMember.value.id, {
        ...payload,
        family_id: VITE_FAMILY_ID,
      });
      uni.showToast({ title: "更新成功", icon: "success" });
    } else {
      await familyStore.addMember({ ...payload, family_id: VITE_FAMILY_ID });
      uni.showToast({ title: "添加成功", icon: "success" });
    }
    closeForm();
  } catch (e) {
    uni.showToast({
      title: "保存失败: " + e.message,
      icon: "error",
      duration: 3000,
    });
  } finally {
    saving.value = false;
  }
}

// ---- 删除 ----
const showDeleteConfirm = ref(false);
const deletingMember = ref(null);

function confirmDelete(m) {
  deletingMember.value = m;
  showDeleteConfirm.value = true;
}

async function doDelete() {
  if (!deletingMember.value) return;
  try {
    await familyStore.deleteMember(deletingMember.value.id);
    uni.showToast({ title: "已删除", icon: "success" });
  } catch (e) {
    uni.showToast({ title: "删除失败", icon: "error", duration: 3000 });
  } finally {
    showDeleteConfirm.value = false;
    deletingMember.value = null;
  }
}

function onTimelineChanged() {
  // 时间线变动后不清空表单，仅保持状态一致
}

// ---- 批量导入 ----
const showImportPanel = ref(false);
const selectedFile = ref(null);
const previewRows = ref([]);
const importing = ref(false);
const importResult = ref(null);

function downloadTemplate() {
  const header = "姓名,性别,父亲,母亲,配偶,生年,卒年,生平简介,时间线";
  const sample =
    "张三,1,张父,李母,王妻,1980,,示例人物,[1980] 出生：示例事件 || 示例描述 || 示例地点";
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + header + "\n" + sample + "\n"], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "族谱导入模板.csv";
  a.click();
  URL.revokeObjectURL(url);
}

async function chooseFile() {
  const res = await uni.chooseFile({
    count: 1,
    type: "file",
    extension: [".csv", ".xlsx"],
  });
  selectedFile.value = res.tempFiles?.[0];
  if (!selectedFile.value) return;
  previewRows.value = [];
  importResult.value = null;
  try {
    const data = await readFileAsArrayBuffer(
      selectedFile.value,
    );
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    previewRows.value = json.slice(0, 10);
  } catch (e) {
    uni.showToast({
      title: "文件解析失败: " + e.message,
      icon: "error",
      duration: 3000,
    });
  }
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    // H5 浏览器环境：优先用原生 File / Blob 读取
    if (typeof window !== "undefined") {
      // 1) 原生 File 对象（uni-app H5 的 tempFile 通常附带）
      if (file && file.file && typeof file.file.arrayBuffer === "function") {
        file.file
          .arrayBuffer()
          .then((ab) => resolve(new Uint8Array(ab)))
          .catch(reject);
        return;
      }
      // 2) blob: 临时 URL
      const url = file?.path || file?.url;
      if (url && url.startsWith("blob:")) {
        fetch(url)
          .then((r) => r.arrayBuffer())
          .then((ab) => resolve(new Uint8Array(ab)))
          .catch(reject);
        return;
      }
    }
    // 小程序及其他平台
    uni.getFileSystemManager().readFile({
      filePath: file?.path || file?.url,
      success: (res) => resolve(res.data),
      fail: reject,
    });
  });
}

async function startImport() {
  if (!selectedFile.value) return;
  importing.value = true;
  importResult.value = null;
  try {
    const data = await readFileAsArrayBuffer(
      selectedFile.value,
    );
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    // 校验
    const nameErrors = detectDuplicateNames(rows);
    if (nameErrors.length > 0) {
      importResult.value = { success: false, errors: nameErrors };
      return;
    }

    // 校验各字段合法性
    const fieldErrors = [];
    rows.forEach((row, i) => {
      const line = i + 2;
      if (!row.姓名 || !row.姓名.trim()) {
        fieldErrors.push(`第 ${line} 行：姓名为空`);
      }
      const gender = row.性别 !== '' ? parseInt(row.性别) : null;
      if (gender !== null && ![1, 2].includes(gender)) {
        fieldErrors.push(`第 ${line} 行：性别值无效（应为 1、2 或空）`);
      }
      const birth = row.生年 ? parseInt(row.生年) : null;
      const death = row.卒年 ? parseInt(row.卒年) : null;
      if (birth && (birth < 1800 || birth > 2026)) {
        fieldErrors.push(`第 ${line} 行：生年格式错误（范围 1800-2026）`);
      }
      if (death && (death < 1800 || death > 2026)) {
        fieldErrors.push(`第 ${line} 行：卒年格式错误（范围 1800-2026）`);
      }
      if (birth && death && death < birth) {
        fieldErrors.push(`第 ${line} 行：卒年不得早于生年`);
      }
    });
    if (fieldErrors.length > 0) {
      importResult.value = { success: false, errors: fieldErrors };
      return;
    }

    const nameToRow = new Map();
    rows.forEach((row, i) => {
      if (row.姓名) nameToRow.set(row.姓名, { ...row, _index: i });
    });

    const circularErrors = detectCircularDependency(rows, nameToRow);
    if (circularErrors.length > 0) {
      importResult.value = { success: false, errors: circularErrors };
      return;
    }

    // 解析引用
    const resolved = resolveReferences(
      rows,
      nameToRow,
      VITE_FAMILY_ID,
      familyStore.allMembers,
    );

    // 分批插入 + 回滚
    const allInsertedIds = [];
    const chunkSize = 500;

    for (let i = 0; i < resolved.members.length; i += chunkSize) {
      const chunk = resolved.members.slice(i, i + chunkSize);
      const { data: inserted, error } = await supabase
        .from("members")
        .insert(chunk)
        .select("id");
      if (error) {
        if (allInsertedIds.length > 0) {
          await supabase
            .from("members")
            .update({ is_deleted: true })
            .in("id", allInsertedIds);
        }
        importResult.value = {
          success: false,
          errors: ["插入成员失败: " + error.message],
        };
        return;
      }
      allInsertedIds.push(...inserted.map((d) => d.id));
    }

    // 插入事件
    for (let i = 0; i < resolved.events.length; i += chunkSize) {
      const chunk = resolved.events.slice(i, i + chunkSize);
      const { error } = await supabase.from("life_events").insert(chunk);
      if (error) {
        await supabase
          .from("members")
          .update({ is_deleted: true })
          .in("id", allInsertedIds);
        importResult.value = {
          success: false,
          errors: ["插入事件失败: " + error.message],
        };
        return;
      }
    }

    // 导入后清空 biography
    if (allInsertedIds.length > 0) {
      const { data: eventCounts } = await supabase
        .from("life_events")
        .select("member_id")
        .in("member_id", allInsertedIds);
      const hasEventsIds = [
        ...new Set(eventCounts?.map((e) => e.member_id) || []),
      ];
      for (let i = 0; i < hasEventsIds.length; i += 500) {
        await supabase
          .from("members")
          .update({ biography: null })
          .in("id", hasEventsIds.slice(i, i + 500));
      }
    }

    importResult.value = {
      success: true,
      memberCount: resolved.members.length,
      eventCount: resolved.events.length,
    };
    await familyStore.refresh(VITE_FAMILY_ID);
  } catch (e) {
    importResult.value = { success: false, errors: [e.message] };
  } finally {
    importing.value = false;
  }
}

onMounted(() => {
  // 从 URL 参数中读取要编辑的成员 ID
  const params = new URLSearchParams(window.location.search);
  const memberId = params.get("memberId");
  if (memberId) {
    const member = familyStore.allMembers.find((m) => m.id === memberId);
    if (member) editMember(member);
  }
});
</script>

<style>
.page-admin {
  min-height: 100vh;
  background: var(--bg-page);
  padding-bottom: 80px;
  animation: fadeIn 0.3s ease;
}
.admin-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 56px;
  padding: 0 var(--spacing-lg);
  background: var(--primary);
  color: #fff;
  box-shadow: 0 2px 8px rgba(139, 26, 26, 0.3);
}
.admin-title {
  font-size: var(--font-size-lg);
  font-weight: bold;
  font-family: var(--font-family-title);
}
.import-btn {
  font-size: var(--font-size-base);
  min-width: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
}
.search-bar {
  padding: var(--spacing-sm) var(--spacing-lg);
}
.search-bar input {
  width: 100%;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--bg-card);
  padding: 0 var(--spacing-md);
  border: 1px solid var(--border-light);
}
.member-list {
  padding: 0 var(--spacing-sm);
}
.member-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-card);
  margin: 4px 0;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-fast);
}
.member-item:active {
  box-shadow: var(--shadow-md);
}
.member-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.member-name {
  font-size: var(--font-size-md);
  font-weight: 500;
}
.member-gender {
  font-size: var(--font-size-md);
}
.member-status {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
}
.member-status.alive {
  color: var(--success);
}
.member-actions {
  display: flex;
  gap: var(--spacing-xs);
}
.btn-action {
  min-width: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}
.btn-action:active {
  background: var(--bg-hover);
}
.empty-list {
  text-align: center;
  padding: 40px 0;
  color: var(--text-hint);
}
.btn-add {
  position: fixed;
  bottom: var(--spacing-lg);
  left: var(--spacing-lg);
  right: var(--spacing-lg);
  height: 48px;
  background: var(--primary);
  color: #fff;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-md);
  box-shadow: 0 4px 12px rgba(139, 26, 26, 0.3);
}
.filter-bar {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
}
.filter-option {
  padding: 4px var(--spacing-md);
  border-radius: var(--radius-full);
  background: var(--bg-card);
  font-size: var(--font-size-base);
  border: 1px solid var(--border-light);
}
.filter-option.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  overflow-y: auto;
  padding: var(--spacing-lg);
  animation: fadeIn 0.2s ease;
}
.modal-content {
  background: var(--bg-card);
  border-radius: var(--radius-xl);
  padding: var(--spacing-lg);
  width: 100%;
  max-width: 400px;
  max-height: 85vh;
  overflow-y: auto;
  animation: fadeInUp 0.3s ease;
}
.modal-title {
  font-size: var(--font-size-lg);
  font-weight: bold;
  text-align: center;
  font-family: var(--font-family-title);
  margin-bottom: var(--spacing-lg);
}
.form-group {
  margin-bottom: var(--spacing-sm);
}
.form-label {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-xs);
  display: block;
}
.form-input {
  width: 100%;
  height: 44px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 0 var(--spacing-sm);
  font-size: var(--font-size-base);
  background: var(--bg-card);
}
.form-input:focus {
  border-color: var(--primary);
  outline: none;
}
.form-input.disabled {
  background: var(--bg-hover);
  color: var(--text-hint);
}
.form-row {
  display: flex;
  gap: var(--spacing-sm);
}
.form-group.half {
  flex: 1;
}
.radio-group {
  display: flex;
  gap: var(--spacing-sm);
}
.radio {
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  min-width: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}
.radio.active {
  border-color: var(--primary);
  background: var(--accent-gold-light);
  color: var(--primary);
}
.toggle-switch {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  border: 1px solid var(--border-light);
  min-width: 48px;
  min-height: 48px;
  transition: all var(--transition-fast);
}
.toggle-switch.on {
  border-color: var(--success);
  background: #f0fff4;
}
.picker-value {
  height: 44px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  padding: 0 var(--spacing-sm);
  display: flex;
  align-items: center;
  background: var(--bg-card);
}
.form-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
}
.btn-cancel {
  flex: 1;
  height: 48px;
  background: var(--bg-card);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
}
.btn-save {
  flex: 1;
  height: 48px;
  background: var(--primary);
  color: #fff;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
}
.btn-save[disabled] {
  opacity: 0.5;
}
.btn-danger {
  flex: 1;
  height: 48px;
  background: var(--error);
  color: #fff;
  border-radius: var(--radius-md);
}
.confirm-box {
  max-width: 320px;
}
.confirm-title {
  font-size: var(--font-size-md);
  font-weight: bold;
  text-align: center;
  font-family: var(--font-family-title);
}
.confirm-text {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  text-align: center;
  margin: var(--spacing-md) 0;
}

/* 导入 */
.btn-download {
  width: 100%;
  height: 44px;
  background: var(--bg-page);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-sm);
  font-size: var(--font-size-base);
}
.upload-area {
  height: 80px;
  border: 2px dashed var(--border-light);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-hint);
  font-size: var(--font-size-base);
  margin-bottom: var(--spacing-sm);
  background: var(--bg-card);
}
.preview-area {
  margin-bottom: var(--spacing-sm);
}
.preview-title {
  font-size: var(--font-size-base);
  font-weight: bold;
  color: var(--text-secondary);
  margin-bottom: var(--spacing-sm);
  display: block;
}
.preview-row {
  font-size: var(--font-size-sm);
  padding: var(--spacing-xs) 0;
  border-bottom: 1px solid #f0f0f0;
}
.preview-events {
  color: var(--primary);
}
.import-result {
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-sm);
  text-align: center;
}
.import-result.success {
  background: #f0fff4;
  color: var(--success);
}
.import-result:not(.success) {
  background: #fff5f5;
  color: var(--error);
}
</style>
