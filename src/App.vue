<template>
  <view class="app-container">
    <router-view />
  </view>
</template>

<script setup>
import { onLaunch } from "@dcloudio/uni-app";
import { supabase } from "@/utils/supabase";

onLaunch(async () => {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      console.log("Auth session ready:", data.session.user.email);
    }
  } catch (e) {
    // 静默处理，非认证用户走访问码流程
  }
});
</script>

<style>
/* ===== 设计系统 ===== */
:root {
  /* 色彩 */
  --bg-page: #f5f0eb;
  --bg-card: #ffffff;
  --bg-hover: #ede8e0;
  --primary: #8b1a1a;
  --primary-light: #c0392b;
  --primary-hover: #a02020;
  --accent-gold: #c9a96e;
  --accent-gold-light: rgba(201, 169, 110, 0.15);
  --text-primary: #2c2c2c;
  --text-secondary: #6b6b6b;
  --text-hint: #aaaaaa;
  --border-light: #e8e4de;
  --success: #27ae60;
  --error: #e74c3c;
  --info: #3498db;

  /* 间距 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* 圆角 */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-xl: 24px;
  --radius-full: 50px;

  /* 字体 */
  --font-family-title: "Noto Serif SC", "Source Han Serif SC", serif;
  --font-family-body:
    "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --font-size-sm: 13px;
  --font-size-base: 14px;
  --font-size-md: 16px;
  --font-size-lg: 20px;
  --font-size-xl: 22px;
  --font-size-2xl: 28px;

  /* 阴影 */
  --shadow-sm: 0 1px 4px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 2px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 -4px 20px rgba(0, 0, 0, 0.1);

  /* 过渡 */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.25s ease;
}

/* ===== 全局重置 ===== */
page,
view,
text,
input,
button,
textarea {
  font-family: var(--font-family-body);
  box-sizing: border-box;
}

.app-container {
  min-height: 100vh;
  background: var(--bg-page);
  position: relative;
}

/* ===== 按钮微动效 ===== */
button {
  transition:
    transform var(--transition-fast),
    opacity var(--transition-fast);
}
button:active {
  transform: scale(0.96);
  opacity: 0.9;
}

/* ===== 淡入动画（页面切换） ===== */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
@keyframes ripple {
  to {
    transform: scale(4);
    opacity: 0;
  }
}

/* ===== 骨架屏通用 ===== */
.skeleton-shimmer {
  background: linear-gradient(90deg, #e8e4de 25%, #f5f2ed 50%, #e8e4de 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

/* ===== 过渡通用 ===== */
.slide-up-enter,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all var(--transition-normal);
}
</style>
