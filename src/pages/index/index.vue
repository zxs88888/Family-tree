<template>
  <view class="page-index">
    <AccessCodeModal v-if="!accessCodeVerified" />
    <OnboardingModal
      v-else-if="showOnboarding"
      @complete="onOnboardingComplete"
      @skip="onOnboardingSkip"
    />
    <SkeletonLoader v-else-if="familyStore.loading" />
    <view v-else-if="familyStore.isEmpty" class="empty-state">
      <template v-if="userStore.isAdmin">
        <text class="empty-icon">🏛️</text>
        <text class="empty-title">开启家族历史</text>
        <text class="empty-desc"
          >目前家族尚未录入成员，点击下方按钮开始修谱。</text
        >
        <button class="btn-start" @click="showOnboarding = true">
          + 添加先祖
        </button>
        <button class="btn-secondary" @click="goToAdmin">
          📥 批量导入成员
        </button>
      </template>
      <template v-else>
        <text class="empty-icon">🏛️</text>
        <text class="empty-title">家族数据正在建立中</text>
        <text class="empty-desc"
          >目前家族尚未录入成员，请联系管理员添加数据。</text
        >
        <text v-if="adminContact" class="contact-info" @click="copyContact">{{
          adminContact
        }}</text>
        <text v-else class="contact-info">请联系家族管理员添加成员。</text>
        <text class="contact-info" @click="showAccessModal"
          >管理员？点此登录 →</text
        >
      </template>
    </view>
    <view v-else class="main-content">
      <view class="top-nav">
        <text class="family-name">{{ familyName }}</text>
        <view class="nav-actions">
          <text
            class="action-icon"
            :class="{ active: userStore.fontSizePreference === 20 }"
            @click="toggleFontSize"
            >{{ userStore.fontSizePreference === 16 ? "Aa" : "Aa+" }}</text
          >
          <text class="action-icon" @click="switchIdentity">👤</text>
          <text v-if="userStore.isAdmin" class="action-icon" @click="goToAdmin"
            >⚙️</text
          >
          <text class="action-icon" @click="logout">↻</text>
        </view>
      </view>
      <view class="graph-area">
        <text v-if="familyName" class="graph-watermark">{{ familyName }}</text>
        <FamilyGraph @node-click="onNodeClick" />
      </view>
      <!-- UIUX §2.4：成员 < 4 人时显示引导提示 -->
      <view
        v-if="familyStore.allMembers.length < 4"
        class="few-members-tip"
      >
        <text class="few-members-text"
          >家族成员较少，继续添加以展现更完整的家族脉络</text
        >
        <button
          v-if="userStore.isAdmin"
          class="btn-add-member"
          @click="goToAdmin"
        >
          + 添加成员
        </button>
      </view>
      <MemberDrawer ref="drawerRef" />
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, watch } from "vue";
import { useUserStore } from "@/stores/userStore";
import { useFamilyStore } from "@/stores/familyStore";
import { supabase } from "@/utils/supabase";
import FamilyGraph from "@/components/FamilyGraph.vue";
import MemberDrawer from "@/components/MemberDrawer.vue";
import AccessCodeModal from "@/components/AccessCodeModal.vue";
import OnboardingModal from "@/components/OnboardingModal.vue";
import SkeletonLoader from "@/components/SkeletonLoader.vue";

const userStore = useUserStore();
const familyStore = useFamilyStore();
const drawerRef = ref(null);
const familyName = ref("");
const adminContact = ref("");
const showOnboarding = ref(false);
const accessCodeVerified = ref(userStore.accessCodeVerified);

const VITE_FAMILY_ID = import.meta.env.VITE_FAMILY_ID;

async function checkAdminSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.app_metadata?.provider !== 'email') return;

  // 自动注册：如果该家族尚无管理员，当前用户自动成为超级管理员
  const { count } = await supabase
    .from('admins')
    .select('*', { count: 'exact', head: true })
    .eq('family_id', VITE_FAMILY_ID);

  if (count === 0) {
    await supabase.from('admins').insert({
      user_id: session.user.id,
      family_id: VITE_FAMILY_ID,
    });
  }

  userStore.isAdmin = true;
  userStore.accessCodeVerified = true;
  localStorage.setItem('access_code_verified', 'true');
  accessCodeVerified.value = true;
  await loadAllMembers();
}

async function loadAllMembers() {
  familyStore.loading = true;
  try {
    await familyStore.loadAllMembers(VITE_FAMILY_ID);
    const { data: familyInfo } = await supabase.rpc("get_family_info", {
      family_id: VITE_FAMILY_ID,
    });
    if (familyInfo?.length > 0) {
      familyName.value = familyInfo[0].name;
      adminContact.value = familyInfo[0].admin_contact || "";
    }

    if (familyStore.isEmpty) {
      // 空家族：管理员显示空状态引导，非管理员显示联系信息
      if (userStore.isAdmin) {
        showOnboarding.value = false; // 在空状态中显示按钮，被动触发
      }
    } else {
      // 已有成员：检查是否需要"选我"
      if (!userStore.myMemberId) {
        showOnboarding.value = true;
        // 未设「我」也展示全局视图（第N代），避免空白让人误以为"没改"
        familyStore.buildGraph(undefined, 50);
      } else {
        familyStore.buildGraph(userStore.myMemberId, 50);
      }
    }
  } catch (e) {
    console.error("加载数据失败:", e);
  } finally {
    familyStore.loading = false;
  }
}

function toggleFontSize() {
  userStore.toggleFontSize();
  familyStore.buildGraph(userStore.myMemberId, 3);
  uni.showToast({
    title:
      userStore.fontSizePreference === 20 ? "已切换为大字号" : "已恢复标准字号",
    icon: "none",
    duration: 1000,
  });
}

function switchIdentity() {
  userStore.clearMyMemberId();
  familyStore.clearEventsCache();
  window.location.reload();
}

function goToAdmin() {
  uni.navigateTo({ url: "/pages/admin/admin" });
}

async function logout() {
  localStorage.removeItem("my_member_id");
  localStorage.removeItem("access_code_verified");
  familyStore.clearEventsCache();
  userStore.clearMyMemberId();
  userStore.accessCodeVerified = false;
  await supabase.auth.signOut();
  uni.showToast({
    title: "已退出，请重新输入访问码或登录",
    icon: "none",
    duration: 1500,
  });
  setTimeout(() => window.location.reload(), 1500);
}

function copyContact() {
  if (adminContact.value) {
    uni.setClipboardData({
      data: adminContact.value,
      success: () =>
        uni.showToast({
          title: "已复制管理员联系方式",
          icon: "success",
          duration: 1500,
        }),
    });
  }
}

function onOnboardingComplete() {
  showOnboarding.value = false;
  if (userStore.myMemberId) {
    familyStore.buildGraph(userStore.myMemberId, 50);
  }
}

function onOnboardingSkip() {
  showOnboarding.value = false;
}

function onNodeClick(memberId) {
  const full = familyStore.allMembers.find((m) => m.id === memberId);
  if (full) drawerRef.value?.show(full);
}

function showAccessModal() {
  accessCodeVerified.value = false;
}

onMounted(async () => {
  await checkAdminSession();
  if (accessCodeVerified.value && !familyStore.loaded) {
    await loadAllMembers();
  }
});

// 数据变化（导入 / 新增 / 编辑 / 删除成员）后自动重建图谱，
// 解决从 admin 返回 index 时 onMounted 不重跑、graphData 停留在旧数据的问题
watch(
  () => familyStore.allMembers,
  () => {
    if (familyStore.loaded && familyStore.allMembers.length) {
      familyStore.buildGraph(userStore.myMemberId, 50);
    }
  },
);
</script>

<style>
.page-index {
  min-height: 100vh;
  background: var(--bg-page);
}
.top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 56px;
  padding: 0 var(--spacing-lg);
  background: linear-gradient(180deg, var(--primary) 0%, var(--primary-deep) 100%);
  color: #f6ecd6;
  box-shadow: 0 2px 12px rgba(110, 20, 20, 0.35);
  border-bottom: 1px solid rgba(212, 175, 55, 0.35);
}
.family-name {
  font-size: var(--font-size-lg);
  font-weight: bold;
  font-family: var(--font-family-title);
  letter-spacing: 3px;
  color: #f7eed8;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
.nav-actions {
  display: flex;
  gap: var(--spacing-xs);
}
.action-icon {
  font-size: var(--font-size-lg);
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: #f6ecd6;
  transition: background var(--transition-fast);
}
.action-icon:active {
  background: rgba(255, 255, 255, 0.16);
}
.action-icon.active {
  color: var(--gold-bright);
  font-weight: bold;
  border-bottom: 2px solid var(--gold-bright);
}
.graph-area {
  width: 100%;
  height: calc(100vh - 56px);
  position: relative;
  animation: fadeIn 0.3s ease;
  overflow: hidden;
}
/* 家族姓氏水印：图谱如绘于纸上的家谱 */
.graph-watermark {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--font-family-title);
  font-size: 180px;
  font-weight: bold;
  letter-spacing: 20px;
  color: rgba(139, 26, 26, 0.03);
  z-index: 0;
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
}

/* 少成员引导（UIUX §2.4） */
.few-members-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--gold-wash);
  border-top: 1px solid var(--gold-line);
}
.few-members-text {
  font-size: var(--font-size-sm);
  color: var(--ink-soft);
  font-family: var(--font-family-title);
  letter-spacing: 0.5px;
}
.btn-add-member {
  height: 38px;
  padding: 0 var(--spacing-lg);
  background: var(--primary);
  color: #f6ecd6;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
  box-shadow: 0 2px 8px rgba(139, 26, 26, 0.2);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  padding: 40px var(--spacing-lg);
  animation: fadeInUp 0.4s ease;
}
.empty-icon {
  font-size: 60px;
  margin-bottom: var(--spacing-md);
  filter: sepia(0.3) saturate(0.8);
}
.empty-title {
  font-size: var(--font-size-xl);
  font-weight: bold;
  font-family: var(--font-family-title);
  letter-spacing: 2px;
  color: var(--ink);
  margin-bottom: var(--spacing-sm);
}
.empty-desc {
  font-size: var(--font-size-md);
  color: var(--ink-soft);
  text-align: center;
  margin-bottom: var(--spacing-lg);
  line-height: 1.7;
}
.btn-start {
  height: 48px;
  padding: 0 var(--spacing-xl);
  background: var(--primary);
  color: #f6ecd6;
  border-radius: var(--radius-lg);
  font-size: var(--font-size-md);
  letter-spacing: 1px;
  margin-bottom: var(--spacing-sm);
  box-shadow: 0 2px 10px rgba(139, 26, 26, 0.2);
}
.btn-secondary {
  height: 48px;
  padding: 0 var(--spacing-xl);
  background: var(--bg-card);
  color: var(--primary);
  border: 1px solid var(--gold);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  letter-spacing: 1px;
}
.contact-info {
  font-size: var(--font-size-base);
  color: var(--primary);
  text-decoration: underline;
  padding: var(--spacing-sm);
  min-width: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
