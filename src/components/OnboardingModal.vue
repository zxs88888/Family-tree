<template>
  <view class="onboarding-modal">
    <view class="modal-overlay">
      <view class="modal-content">
        <!-- 模式：三步建谱向导 -->
        <template v-if="mode === 'wizard'">
          <view class="modal-header">
            <text class="modal-title">🏛️ 开启家族历史</text>
            <text class="modal-close" @click="skipWizard">✕</text>
          </view>
          <text class="modal-subtitle">录入前三代祖先，建立家族骨架</text>

          <view class="step-indicator">
            <text
              class="step-dot"
              :class="{ active: wizardStep >= 1, done: wizardStep > 1 }"
              >1</text
            >
            <view class="step-line" :class="{ done: wizardStep > 1 }"></view>
            <text
              class="step-dot"
              :class="{ active: wizardStep >= 2, done: wizardStep > 2 }"
              >2</text
            >
            <view class="step-line" :class="{ done: wizardStep > 2 }"></view>
            <text class="step-dot" :class="{ active: wizardStep >= 3 }">3</text>
          </view>

          <!-- Step 1: 自己 -->
          <view v-if="wizardStep === 1" class="wizard-step">
            <text class="step-title">第一步：录入自己</text>
            <view class="form-group">
              <text class="form-label">姓名 *</text>
              <input
                v-model="wizard.self.name"
                placeholder="请输入您的姓名"
                class="form-input"
              />
            </view>
            <view class="form-group">
              <text class="form-label">性别</text>
              <view class="radio-group">
                <text
                  class="radio"
                  :class="{ active: wizard.self.gender === 1 }"
                  @click="wizard.self.gender = 1"
                  >👨 男</text
                >
                <text
                  class="radio"
                  :class="{ active: wizard.self.gender === 2 }"
                  @click="wizard.self.gender = 2"
                  >👩 女</text
                >
              </view>
            </view>
            <view class="form-group">
              <text class="form-label">是否在世</text>
              <text
                class="toggle-switch"
                :class="{ on: wizard.self.is_alive }"
                @click="wizard.self.is_alive = !wizard.self.is_alive"
              >
                {{ wizard.self.is_alive ? "🟢 在世" : "⚫ 已故" }}
              </text>
            </view>
          </view>

          <!-- Step 2: 父亲 -->
          <view v-if="wizardStep === 2" class="wizard-step">
            <text class="step-title">第二步：录入父亲</text>
            <view class="form-group">
              <text class="form-label">父亲姓名 *</text>
              <input
                v-model="wizard.father.name"
                placeholder="请输入您父亲的姓名"
                class="form-input"
              />
            </view>
            <view class="form-group">
              <text class="form-label">是否在世</text>
              <text
                class="toggle-switch"
                :class="{ on: wizard.father.is_alive }"
                @click="wizard.father.is_alive = !wizard.father.is_alive"
              >
                {{ wizard.father.is_alive ? "🟢 在世" : "⚫ 已故" }}
              </text>
            </view>
            <view class="form-group">
              <text class="form-label">母亲姓名（选填）</text>
              <input
                v-model="wizard.mother.name"
                placeholder="可选录入母亲"
                class="form-input"
              />
            </view>
          </view>

          <!-- Step 3: 祖父 -->
          <view v-if="wizardStep === 3" class="wizard-step">
            <text class="step-title">第三步：录入祖父</text>
            <view class="form-group">
              <text class="form-label">祖父姓名 *</text>
              <input
                v-model="wizard.grandpa.name"
                placeholder="请输入您祖父的姓名"
                class="form-input"
              />
            </view>
            <view class="form-group">
              <text class="form-label">祖母姓名（选填）</text>
              <input
                v-model="wizard.grandma.name"
                placeholder="可选录入祖母"
                class="form-input"
              />
            </view>
            <view class="form-group">
              <text class="form-label">管理员联系方式（选填）</text>
              <input
                v-model="wizard.adminContact"
                placeholder="如：张明，微信：zhangming123"
                class="form-input"
              />
            </view>
          </view>

          <view class="wizard-actions">
            <button
              v-if="wizardStep > 1"
              class="btn-cancel"
              @click="wizardStep--"
            >
              上一步
            </button>
            <button class="btn-next" @click="nextWizardStep">
              {{ wizardStep < 3 ? "下一步" : "✅ 完成建谱" }}
            </button>
          </view>
        </template>

        <!-- 模式：选我搜索 -->
        <template v-if="mode === 'findme'">
          <text class="modal-title">在家族中找到自己</text>
          <text class="modal-subtitle">输入您的姓名，在家族中找到自己</text>
          <view class="search-box">
            <text class="search-icon">🔍</text>
            <input
              v-model="searchQuery"
              placeholder="输入您的姓名..."
              class="search-input"
              @input="onSearchDebounced"
            />
          </view>
          <view v-if="searchResults.length > 0" class="search-results">
            <view
              v-for="member in searchResults"
              :key="member.id"
              class="search-item"
              :class="{ selected: selectedMemberId === member.id }"
              @click="selectedMemberId = member.id"
            >
              <view class="avatar-placeholder-sm">{{
                member.name.charAt(0)
              }}</view>
              <view class="search-item-info">
                <text class="search-item-name">{{ member.name }}</text>
                <text class="search-item-parent">{{
                  getParentHint(member)
                }}</text>
              </view>
              <text v-if="selectedMemberId === member.id" class="check-mark"
                >✅</text
              >
            </view>
          </view>
          <view v-else-if="searchQuery && !searching" class="search-empty">
            <text>未找到该成员，请检查姓名或联系管理员添加</text>
          </view>
          <view class="modal-footer">
            <button class="btn-skip" @click="skipOnboarding">稍后设置</button>
            <button
              class="btn-confirm"
              :disabled="!selectedMemberId"
              @click="confirmIdentity"
            >
              ✅ 确认这是我
            </button>
          </view>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useFamilyStore } from "@/stores/familyStore";
import { useUserStore } from "@/stores/userStore";
import { supabase } from "@/utils/supabase";

const familyStore = useFamilyStore();
const userStore = useUserStore();
const VITE_FAMILY_ID = import.meta.env.VITE_FAMILY_ID;

const emit = defineEmits(["complete", "skip"]);

// 模式判别
const mode = ref(familyStore.isEmpty ? "wizard" : "findme");

// ---- 三步建谱 ----
const wizardStep = ref(1);
const wizard = ref({
  self: { name: "", gender: null, is_alive: true },
  father: { name: "", is_alive: true },
  mother: { name: "" },
  grandpa: { name: "" },
  grandma: { name: "" },
  adminContact: "",
});

function skipWizard() {
  uni.showToast({ title: "您可以稍后在管理页录入成员", icon: "none", duration: 2000 });
  emit("skip");
}

async function nextWizardStep() {
  if (wizardStep.value < 3) {
    if (wizardStep.value === 1 && !wizard.value.self.name) {
      uni.showToast({ title: "请填写姓名", icon: "none" });
      return;
    }
    if (wizardStep.value === 2 && !wizard.value.father.name) {
      uni.showToast({ title: "请填写父亲姓名", icon: "none" });
      return;
    }
    wizardStep.value++;
    return;
  }

  // Step 3 → 完成
  if (!wizard.value.grandpa.name) {
    uni.showToast({ title: "请填写祖父姓名", icon: "none" });
    return;
  }

  try {
    // 1. 更新管理员联系方式
    if (wizard.value.adminContact) {
      await supabase
        .from("families")
        .update({ admin_contact: wizard.value.adminContact })
        .eq("id", VITE_FAMILY_ID);
    }

    // 2. 创建祖父
    const grandpa = await familyStore.addMember({
      family_id: VITE_FAMILY_ID,
      name: wizard.value.grandpa.name,
      gender: 1,
      is_alive: false,
    });

    // 3. 创建祖母（选填）
    let grandmaId = null;
    if (wizard.value.grandma.name) {
      const grandma = await familyStore.addMember({
        family_id: VITE_FAMILY_ID,
        name: wizard.value.grandma.name,
        gender: 2,
        is_alive: false,
        spouse_id: grandpa.id,
      });
      grandmaId = grandma.id;
      // 同步祖父配偶
      await supabase
        .from("members")
        .update({ spouse_id: grandma.id })
        .eq("id", grandpa.id);
      familyStore.allMembers = familyStore.allMembers.map((m) =>
        m.id === grandpa.id ? { ...m, spouse_id: grandma.id } : m,
      );
    }

    // 4. 创建父亲
    const father = await familyStore.addMember({
      family_id: VITE_FAMILY_ID,
      name: wizard.value.father.name,
      gender: 1,
      is_alive: wizard.value.father.is_alive,
      father_id: grandpa.id,
      mother_id: grandmaId,
    });

    // 5. 创建母亲（选填）
    if (wizard.value.mother.name) {
      const mother = await familyStore.addMember({
        family_id: VITE_FAMILY_ID,
        name: wizard.value.mother.name,
        gender: 2,
        is_alive: false,
        spouse_id: father.id,
      });
      await supabase
        .from("members")
        .update({ spouse_id: mother.id })
        .eq("id", father.id);
      familyStore.allMembers = familyStore.allMembers.map((m) =>
        m.id === father.id ? { ...m, spouse_id: mother.id } : m,
      );
    }

    // 6. 创建自己
    const self = await familyStore.addMember({
      family_id: VITE_FAMILY_ID,
      name: wizard.value.self.name,
      gender: wizard.value.self.gender,
      is_alive: wizard.value.self.is_alive,
      father_id: father.id,
    });

    // 7. 设置为我的身份
    userStore.setMyMemberId(self.id);
    familyStore.buildGraph(self.id, 3);

    uni.showToast({ title: "建谱完成！", icon: "success" });
    emit("complete");
  } catch (e) {
    uni.showToast({
      title: "建谱失败: " + e.message,
      icon: "error",
      duration: 3000,
    });
  }
}

// ---- 选我搜索 ----
const searchQuery = ref("");
const searchResults = ref([]);
const searching = ref(false);
const selectedMemberId = ref(null);

let searchTimer = null;
function onSearchDebounced() {
  clearTimeout(searchTimer);
  if (!searchQuery.value) {
    searchResults.value = [];
    return;
  }
  searchTimer = setTimeout(async () => {
    searching.value = true;
    try {
      const { data } = await supabase
        .from("members")
        .select("id, name, father_id, mother_id")
        .ilike("name", `%${searchQuery.value}%`)
        .eq("is_deleted", false)
        .limit(5);
      searchResults.value = data || [];
    } finally {
      searching.value = false;
    }
  }, 300);
}

function getParentHint(member) {
  if (!member.father_id) return "";
  const father = familyStore.allMembers.find((m) => m.id === member.father_id);
  return father ? `（父亲：${father.name}）` : "";
}

function confirmIdentity() {
  if (!selectedMemberId.value) return;
  const member = familyStore.allMembers.find(
    (m) => m.id === selectedMemberId.value,
  );
  if (member) {
    userStore.setMyMemberId(member.id);
    familyStore.buildGraph(member.id, 3);
    uni.showToast({ title: `已设为"${member.name}"的身份`, icon: "success" });
  }
  emit("complete");
}

function skipOnboarding() {
  uni.showToast({
    title: "您可以在右上角「👤」随时设置身份",
    icon: "none",
    duration: 2000,
  });
  emit("skip");
}
</script>

<style>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(43, 38, 34, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
  padding: 20px;
}
.modal-content {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 32px 24px;
  width: 100%;
  max-width: 400px;
  max-height: 85vh;
  overflow-y: auto;
  border: 1px solid var(--gold-line);
  box-shadow: var(--shadow-lg);
}
.modal-title {
  font-size: 23px;
  font-weight: bold;
  text-align: center;
  font-family: var(--font-family-title);
  letter-spacing: 2px;
  color: var(--ink);
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.modal-close {
  font-size: 22px;
  color: var(--ink-faint);
  min-width: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-subtitle {
  font-size: 14px;
  color: var(--ink-soft);
  text-align: center;
  margin: 8px 0 20px;
  font-family: var(--font-family-title);
  letter-spacing: 0.5px;
}

/* 向导 */
.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  margin-bottom: 24px;
}
.step-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--bg-sunken);
  color: var(--ink-faint);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  border: 1px solid var(--gold-line);
}
.step-dot.active {
  background: var(--primary);
  color: #f6ecd6;
  border-color: var(--primary);
}
.step-dot.done {
  background: var(--gold);
  color: #fff;
  border-color: var(--gold);
}
.step-line {
  width: 40px;
  height: 2px;
  background: var(--gold-line);
}
.step-line.done {
  background: var(--gold);
}
.step-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 16px;
  font-family: var(--font-family-title);
  letter-spacing: 1px;
  color: var(--ink);
}
.wizard-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}
.btn-next {
  flex: 1;
  height: 48px;
  background: var(--primary);
  color: #f6ecd6;
  border-radius: var(--radius-lg);
  letter-spacing: 1px;
  box-shadow: 0 2px 10px rgba(139, 26, 26, 0.2);
}

/* 搜索 */
.search-box {
  display: flex;
  align-items: center;
  border: 1px solid var(--gold-line);
  border-radius: var(--radius-md);
  padding: 0 12px;
  margin-bottom: 16px;
  background: var(--bg-sunken);
}
.search-icon {
  font-size: 18px;
  margin-right: 8px;
}
.search-input {
  flex: 1;
  height: 44px;
}
.search-results {
  margin-bottom: 16px;
}
.search-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-md);
  margin-bottom: 4px;
  background: var(--bg-card);
  border: 1px solid var(--gold-line);
}
.search-item.selected {
  background: var(--gold-wash);
  border: 1px solid var(--gold);
}
.search-item-name {
  font-size: 16px;
  font-weight: 500;
  font-family: var(--font-family-title);
  color: var(--ink);
}
.search-item-parent {
  font-size: 13px;
  color: var(--ink-soft);
}
.search-empty {
  text-align: center;
  color: var(--ink-faint);
  padding: 20px 0;
}
.avatar-placeholder-sm {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(145deg, var(--primary) 0%, var(--primary-deep) 100%);
  color: #f6ecd6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  font-family: var(--font-family-title);
}
.modal-footer {
  display: flex;
  gap: 12px;
}
.btn-skip {
  flex: 1;
  height: 48px;
  background: var(--bg-card);
  border: 1px solid var(--gold-line);
  border-radius: var(--radius-md);
  color: var(--ink-soft);
}
.btn-cancel {
  flex: 1;
  height: 48px;
  background: var(--bg-sunken);
  border: 1px solid var(--gold-line);
  border-radius: var(--radius-md);
  color: var(--ink-soft);
  letter-spacing: 1px;
}
.btn-confirm {
  flex: 1;
  height: 48px;
  background: var(--primary);
  color: #f6ecd6;
  border-radius: var(--radius-lg);
  letter-spacing: 1px;
  box-shadow: 0 2px 10px rgba(139, 26, 26, 0.2);
}
.btn-confirm[disabled] {
  opacity: 0.5;
}
.check-mark {
  font-size: 20px;
}

/* 通用 */
.form-group {
  margin-bottom: 14px;
}
.form-label {
  font-size: 14px;
  color: var(--ink-soft);
  margin-bottom: 4px;
  display: block;
  font-family: var(--font-family-title);
  letter-spacing: 0.5px;
}
.form-input {
  width: 100%;
  height: 44px;
  border: 1px solid var(--gold-line);
  border-radius: var(--radius-md);
  padding: 0 12px;
  background: var(--bg-sunken);
}
.radio-group {
  display: flex;
  gap: 12px;
}
.radio {
  padding: 8px 20px;
  border: 1px solid var(--gold-line);
  border-radius: var(--radius-md);
  font-size: 14px;
  min-width: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.radio.active {
  border-color: var(--primary);
  background: var(--primary-wash);
  color: var(--primary);
  font-weight: bold;
}
.toggle-switch {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  border: 1px solid var(--gold-line);
  min-width: 48px;
  min-height: 48px;
}
.toggle-switch.on {
  border-color: var(--success);
  background: rgba(91, 140, 81, 0.12);
  color: var(--success);
}
</style>
