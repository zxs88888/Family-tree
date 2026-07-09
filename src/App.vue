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
/* ===== 设计系统 · 传统中式雅致风 ===== */
:root {
  /* 宣纸底与纸卡 */
  --bg-page: #f3ede3; /* 宣纸：略带暖灰的米色 */
  --bg-card: #fcfaf5; /* 纸卡：温润暖白 */
  --bg-hover: #ece3d3;
  --bg-sunken: #efe7d8; /* 凹陷区，如输入框底 */

  /* 墨色文字 */
  --ink: #2b2622; /* 主文字（近墨） */
  --ink-soft: #6f6657; /* 次要文字 */
  --ink-faint: #a89c87; /* 弱提示 */

  /* 中国红（主色） */
  --primary: #8b1a1a;
  --primary-deep: #6e1414;
  --primary-light: #a8332b;
  --primary-wash: rgba(139, 26, 26, 0.06); /* 红之晕染 */

  /* 古金（强调） */
  --gold: #c9a96e;
  --gold-bright: #ddbb82;
  --gold-deep: #a8854c;
  --gold-line: #e0d2b4; /* 细金分隔线 */
  --gold-wash: rgba(201, 169, 110, 0.14);

  /* 状态 */
  --success: #5b8c51; /* 雅绿（在世） */
  --error: #c0392b;
  --info: #5a7a9a;

  /* 间距 */
  --spacing-xs: 6px;
  --spacing-sm: 10px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* 圆角 */
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 22px;
  --radius-xl: 28px;
  --radius-full: 50px;

  /* 字体 */
  --font-family-title: "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif;
  --font-family-body:
    "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --font-size-sm: 13px;
  --font-size-base: 15px;
  --font-size-md: 16px;
  --font-size-lg: 20px;
  --font-size-xl: 23px;
  --font-size-2xl: 28px;

  /* 阴影（柔、暖、低对比） */
  --shadow-sm: 0 1px 3px rgba(74, 56, 30, 0.07);
  --shadow-md: 0 6px 20px rgba(74, 56, 30, 0.1);
  --shadow-lg: 0 -8px 30px rgba(74, 56, 30, 0.14);

  /* 过渡 */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.28s cubic-bezier(0.22, 0.61, 0.36, 1);
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
  -webkit-font-smoothing: antialiased;
}

/* 图谱容器链：uni-app H5 会把 CSS 里的标签选择器 view 改写成 uni-view，
   但本项目编译出的 DOM 元素是 <view>（不是 <uni-view>），二者不匹配，
   导致 <view> 退回浏览器默认的 inline —— height:100% / calc 全部失效、
   图谱容器高度塌成 0、ECharts 按 0×0 初始化而空白。用类选择器（uni 不改写）
   显式把图谱容器链设为 block，让 height 链能解析。 */
.graph-area,
.family-graph,
.graph-container,
.main-content,
.page-index {
  display: block;
}

/* 宣纸底：暖色基底 + 极淡纤维纹理 + 柔光晕，营造「翻开家谱」的纸感 */
.app-container {
  min-height: 100vh;
  background-color: var(--bg-page);
  background-image:
    radial-gradient(circle at 18% 12%, rgba(255, 255, 255, 0.55) 0%, transparent 38%),
    radial-gradient(circle at 86% 88%, rgba(201, 169, 110, 0.08) 0%, transparent 42%),
    repeating-linear-gradient(
      0deg,
      rgba(120, 90, 50, 0.018) 0px,
      rgba(120, 90, 50, 0.018) 1px,
      transparent 1px,
      transparent 4px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(120, 90, 50, 0.018) 0px,
      rgba(120, 90, 50, 0.018) 1px,
      transparent 1px,
      transparent 4px
    );
  position: relative;
}

/* ===== 按钮微动效 ===== */
button {
  transition:
    transform var(--transition-fast),
    opacity var(--transition-fast),
    box-shadow var(--transition-fast);
}
button:active {
  transform: scale(0.97);
  opacity: 0.92;
}

/* ===== 淡入动画（页面切换） ===== */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(14px);
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
/* 金色呼吸（中心节点光晕） */
@keyframes goldBreath {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(201, 169, 110, 0.5);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(201, 169, 110, 0);
  }
}

/* ===== 骨架屏通用 ===== */
.skeleton-shimmer {
  background: linear-gradient(90deg, #e7dcc8 25%, #f3ecdd 50%, #e7dcc8 75%);
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

/* ===== 减少动态偏好：关闭装饰性动画 ===== */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
</style>
