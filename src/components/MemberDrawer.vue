<template>
  <view v-if="visible" class="drawer-backdrop" @click="hide"></view>
  <view v-if="visible" class="member-drawer">
    <text class="drawer-close" @click="hide">✕</text>
    <view
      class="drawer-handle"
      @touchstart="onDragStart"
      @touchmove="onDragMove"
      @touchend="onDragEnd"
    >
      <view class="handle-bar"></view>
    </view>
    <view class="drawer-body" :style="{ height: drawerHeight + '%' }">
      <view class="profile-section">
        <view class="avatar-wrapper">
          <image
            v-if="member?.avatar_url"
            :src="member.avatar_url"
            mode="aspectFill"
            class="avatar"
          />
          <view v-else class="avatar-placeholder">
            <text class="avatar-initial">{{ member?.name?.charAt(0) }}</text>
          </view>
        </view>
        <text class="member-name">{{ member?.name }}</text>
        <text v-if="member?.is_alive" class="alive-tag">🟢 在世</text>
        <text v-else class="years"
          >{{ member?.birth_year }} - {{ member?.death_year }}</text
        >
      </view>

      <!-- 折叠态：生平简介（3 行截断） -->
      <view v-if="collapsed" class="biography">
        <text class="bio-text">{{ truncatedBio }}</text>
      </view>

      <!-- 展开态：时间线 |
              biography（无事件时） -->
      <scroll-view v-else class="expanded-content">
        <TimelineView
          v-if="member"
          :member-id="member.id"
          :biography="member.biography"
          :member-name="member.name"
        />
        <view class="relations-section">
          <text class="section-title">关联关系</text>
          <view class="relation-row">
            <text class="relation-label">父亲</text>
            <text
              v-if="member?.father_id"
              class="relation-value"
              @click="goToMember(member.father_id)"
            >
              {{ getMemberName(member.father_id) }}
            </text>
            <text v-else class="relation-empty">暂无</text>
          </view>
          <view class="relation-row">
            <text class="relation-label">母亲</text>
            <text
              v-if="member?.mother_id"
              class="relation-value"
              @click="goToMember(member.mother_id)"
            >
              {{ getMemberName(member.mother_id) }}
            </text>
            <text v-else class="relation-empty">暂无</text>
          </view>
          <view class="relation-row">
            <text class="relation-label">配偶</text>
            <text
              v-if="member?.spouse_id"
              class="relation-value"
              @click="goToMember(member.spouse_id)"
            >
              {{ getMemberName(member.spouse_id) }}
            </text>
            <text v-else class="relation-empty">暂无</text>
          </view>
          <view class="relation-row">
            <text class="relation-label">子女</text>
            <text v-if="childrenNames.length > 0" class="relation-value">{{
              childrenNames.join("、")
            }}</text>
            <text v-else class="relation-empty">暂无</text>
          </view>
        </view>
      </scroll-view>

      <view class="action-bar">
        <button class="btn-set-identity" @click="setAsMe">设为我的身份</button>
        <button v-if="isAdmin" class="btn-edit" @click="openEditor">
          编辑资料
        </button>
        <text v-else class="hint-text">只读模式，如需修改请联系管理员</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from "vue";
import { useUserStore } from "@/stores/userStore";
import { useFamilyStore } from "@/stores/familyStore";
import { supabase } from "@/utils/supabase";
import TimelineView from "@/components/TimelineView.vue";

const userStore = useUserStore();
const familyStore = useFamilyStore();
const visible = ref(false);
const collapsed = ref(true);
const drawerHeight = ref(40);
const member = ref(null);
const isAdmin = computed(() => userStore.isAdmin);

const truncatedBio = computed(() => {
  if (!member.value?.biography) return "";
  return member.value.biography.length > 100
    ? member.value.biography.slice(0, 100) + "...展开"
    : member.value.biography;
});

const childrenNames = computed(() => {
  if (!member.value?.id) return [];
  return familyStore.allMembers
    .filter(
      (m) => m.father_id === member.value.id || m.mother_id === member.value.id,
    )
    .map((m) => m.name);
});

function getMemberName(id) {
  if (!id) return "";
  const m = familyStore.allMembers.find((x) => x.id === id);
  return m?.name || "";
}

function show(memberData) {
  member.value = memberData;
  visible.value = true;
  collapsed.value = true;
  drawerHeight.value = 40;
}

function hide() {
  visible.value = false;
  member.value = null;
}

function setAsMe() {
  if (!member.value) return;
  userStore.setMyMemberId(member.value.id);
  familyStore.clearEventsCache();
  familyStore.buildGraph(member.value.id, 3);
  uni.showToast({
    title: `已设为"${member.value.name}"的身份`,
    icon: "success",
    duration: 1500,
  });
  hide();
}

function openEditor() {
  if (!member.value) return;
  uni.navigateTo({ url: "/pages/admin/admin?memberId=" + member.value.id });
}

function goToMember(id) {
  const m = familyStore.allMembers.find((x) => x.id === id);
  if (m) {
    show(m);
  }
}

function onDragStart() {}
function onDragMove() {
  collapsed.value = false;
  drawerHeight.value = 80;
}
function onDragEnd() {
  drawerHeight.value = collapsed.value ? 40 : 80;
}

defineExpose({ show, hide });
</script>

<style>
.member-drawer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--bg-card);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-lg);
  border-top: 2px solid var(--gold);
  transition: transform var(--transition-normal);
}
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
  background: rgba(43, 38, 34, 0.4);
}
.drawer-close {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-md);
  z-index: 101;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: var(--ink-soft);
  border-radius: 50%;
}
.drawer-close:active {
  background: rgba(43, 38, 34, 0.06);
}
.drawer-handle {
  display: flex;
  justify-content: center;
  padding: var(--spacing-sm) 0;
  cursor: grab;
}
.handle-bar {
  width: 44px;
  height: 4px;
  background: var(--gold-line);
  border-radius: 2px;
}
.drawer-body {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.profile-section {
  text-align: center;
  padding: var(--spacing-sm) var(--spacing-lg) var(--spacing-md);
  border-bottom: 1px solid var(--gold-line);
}
.avatar-wrapper {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  margin: 0 auto var(--spacing-sm);
  border: 2px solid var(--gold);
  box-shadow: 0 2px 10px rgba(201, 169, 110, 0.35);
}
.avatar-placeholder {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(145deg, var(--primary) 0%, var(--primary-deep) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-initial {
  color: #f6ecd6;
  font-size: var(--font-size-2xl);
  font-weight: bold;
  font-family: var(--font-family-title);
}
.member-name {
  font-size: var(--font-size-xl);
  font-weight: bold;
  font-family: var(--font-family-title);
  letter-spacing: 1px;
  color: var(--ink);
  text-align: center;
}
.alive-tag {
  color: var(--success);
  font-size: var(--font-size-base);
  text-align: center;
  display: block;
  letter-spacing: 1px;
}
.years {
  color: var(--ink-soft);
  font-size: var(--font-size-base);
  text-align: center;
  display: block;
  font-family: var(--font-family-title);
  letter-spacing: 1px;
}
.biography {
  padding: var(--spacing-sm) var(--spacing-lg);
}
.bio-text {
  font-size: var(--font-size-base);
  color: var(--ink);
  line-height: 1.7;
}
.expanded-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-sm) var(--spacing-lg);
}

/* 关联 */
.relations-section {
  margin-top: var(--spacing-md);
}
.section-title {
  font-size: var(--font-size-base);
  font-weight: bold;
  font-family: var(--font-family-title);
  color: var(--gold-deep);
  letter-spacing: 1px;
  margin-bottom: var(--spacing-sm);
  display: block;
  border-left: 3px solid var(--gold);
  padding-left: var(--spacing-sm);
}
.relation-row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px dashed var(--gold-line);
}
.relation-label {
  width: 56px;
  font-size: var(--font-size-base);
  color: var(--ink-soft);
  font-family: var(--font-family-title);
}
.relation-value {
  font-size: var(--font-size-base);
  color: var(--primary);
}
.relation-empty {
  font-size: var(--font-size-base);
  color: var(--ink-faint);
  font-style: italic;
}

/* 动作栏 */
.action-bar {
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--gold-line);
}
.btn-set-identity {
  flex: 1;
  height: 48px;
  background: var(--primary);
  color: #f6ecd6;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-base);
  letter-spacing: 1px;
  box-shadow: 0 2px 10px rgba(139, 26, 26, 0.2);
}
.btn-edit {
  flex: 1;
  height: 48px;
  background: var(--bg-card);
  border: 1px solid var(--gold);
  color: var(--gold-deep);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  letter-spacing: 1px;
}
.hint-text {
  font-size: var(--font-size-base);
  color: var(--ink-soft);
  text-align: center;
  flex: 1;
  align-self: center;
  font-family: var(--font-family-title);
}
</style>
