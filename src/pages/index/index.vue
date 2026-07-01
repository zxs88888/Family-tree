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
        <FamilyGraph @node-click="onNodeClick" />
      </view>
      <MemberDrawer ref="drawerRef" />
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from "vue";
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
      } else {
        familyStore.buildGraph(userStore.myMemberId, 3);
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
    familyStore.buildGraph(userStore.myMemberId, 3);
  }
}

function onOnboardingSkip() {
  showOnboarding.value = false;
}

function onNodeClick(member) {
  drawerRef.value?.show(member);
}

onMounted(async () => {
  await checkAdminSession();
  if (accessCodeVerified.value && !familyStore.loaded) {
    await loadAllMembers();
  }
});
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
  background: var(--primary);
  color: #fff;
  box-shadow: 0 2px 8px rgba(139, 26, 26, 0.3);
}
.family-name {
  font-size: var(--font-size-lg);
  font-weight: bold;
  font-family: var(--font-family-title);
  letter-spacing: 2px;
}
.nav-actions {
  display: flex;
  gap: var(--spacing-xs);
}
.action-icon {
  font-size: var(--font-size-lg);
  min-width: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}
.action-icon:active {
  background: rgba(255, 255, 255, 0.15);
}
.action-icon.active {
  color: var(--accent-gold);
  font-weight: bold;
  border-bottom: 2px solid var(--accent-gold);
}
.graph-area {
  width: 100%;
  height: calc(100vh - 56px);
  animation: fadeIn 0.3s ease;
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
  font-size: 64px;
  margin-bottom: var(--spacing-md);
}
.empty-title {
  font-size: var(--font-size-xl);
  font-weight: bold;
  font-family: var(--font-family-title);
  margin-bottom: var(--spacing-sm);
}
.empty-desc {
  font-size: var(--font-size-md);
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: var(--spacing-lg);
  line-height: 1.6;
}
.btn-start {
  height: 48px;
  padding: 0 var(--spacing-xl);
  background: var(--primary);
  color: #fff;
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  margin-bottom: var(--spacing-sm);
}
.btn-secondary {
  height: 48px;
  padding: 0 var(--spacing-xl);
  background: var(--bg-card);
  color: var(--primary);
  border: 1px solid var(--primary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
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
