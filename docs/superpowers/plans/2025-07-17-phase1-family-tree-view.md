# Phase 1 实施计划：能看到（家族树可视化）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Phase 1 "能看到" — 访问码验证 + 纯 SVG 家族树渲染（多配偶/多世代）+ 成员详情 + "我的脉系"高亮 + 移动端适配。

**Architecture:** Taro Vue 3 前端，Supabase 后端。纯 SVG 布局引擎通过递归算法计算节点坐标，渲染家族树。访问码门控 → 主视图（SVG 树）→ 点击交互（详情弹窗 + 脉系高亮）。

**Tech Stack:** Taro + Vue 3 + Pinia + Supabase JS + 纯 SVG

**Spec:** `docs/superpowers/specs/2025-07-17-family-tree-design-spec.md`

---

## 文件结构

```
src/
├── pages/index/index.vue          # 主页面（访问码 + 家族树）
├── components/
│   ├── AccessCodeModal.vue        # 访问码输入弹窗
│   ├── FamilyTree.vue             # SVG 家族树主组件
│   ├── MemberNode.vue             # SVG 节点（圆圈+文字）
│   └── MemberDrawer.vue           # 成员详情底部抽屉
├── stores/
│   ├── familyStore.ts             # 家族数据 + 成员列表
│   └── uiStore.ts                 # UI 状态（选中节点、脉系高亮）
├── composables/
│   ├── useTreeLayout.ts           # 树布局算法（计算坐标+连线）
│   └── useLineage.ts              # 脉系高亮计算
├── utils/
│   ├── supabase.ts                # Supabase 客户端
│   ├── treeTypes.ts               # 类型定义
│   └── constants.ts               # 颜色/尺寸常量
├── data/
│   └── seed.ts                    # 永康支测试数据（硬编码）
├── styles/
│   └── global.scss                # 全局样式
├── app.config.ts
├── pages.json
├── App.vue
└── main.ts
supabase/
└── migrations/
    └── 001_init.sql               # 数据库迁移（含 spouses 表）
```

---

## Task 1: 项目初始化

**Files:**
- Create: `package.json`, `app.config.ts`, `src/main.ts`, `src/App.vue`, `src/pages.json`

- [ ] **Step 1: 使用 Taro CLI 初始化项目**

```bash
cd /Users/a1-6/QoderCN/family
npx @tauri-apps/create-taro-app --template vue3 --name family
```

> 如果 CLI 不可用，手动创建最小 Taro 项目结构。

- [ ] **Step 2: 安装依赖**

```bash
npm install @supabase/supabase-js pinia
npm install -D @tarojs/cli sass
```

- [ ] **Step 3: 配置 app.config.ts**

```typescript
export default defineAppConfig({
  pages: ['pages/index/index'],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#faf6ef',
    navigationBarTitleText: '家族族谱',
    navigationBarTextStyle: 'black'
  }
})
```

- [ ] **Step 4: 创建 src/App.vue**

```vue
<template>
  <view class="app">
    <slot />
  </view>
</template>

<style lang="scss">
.app {
  min-height: 100vh;
  background: #faf6ef;
}
</style>
```

- [ ] **Step 5: 验证编译**

```bash
npm run dev:h5
```

Expected: H5 服务启动，浏览器打开显示空白页。

- [ ] **Step 6: Commit**

```bash
git add . && git commit -m "chore: init Taro Vue 3 project"
```

---

## Task 2: 类型定义与常量

**Files:**
- Create: `src/utils/treeTypes.ts`, `src/utils/constants.ts`

- [ ] **Step 1: 定义类型**

```typescript
// src/utils/treeTypes.ts
export interface Member {
  id: string
  name: string
  gender: 1 | 2 // 1=男 2=女
  birthYear?: number
  deathYear?: number
  isAlive: boolean
  biography?: string
  fatherId?: string
  motherId?: string
  spouses: SpouseRelation[]
  children?: Member[]
}

export interface SpouseRelation {
  spouseId: string
  marriageOrder: number
  marriageType: string // 元配/次配/三配/继配
}

export interface LayoutNode {
  id: string
  name: string
  cx: number
  cy: number
  r: number
  gender: 1 | 2
  isRoot?: boolean
  birthYear?: number
  deathYear?: number
}

export interface LayoutLine {
  x1: number
  y1: number
  x2: number
  y2: number
  type: 'marriage' | 'parent-child'
}

export interface TreeLayout {
  nodes: LayoutNode[]
  lines: LayoutLine[]
  viewBox: { width: number; height: number }
}
```

- [ ] **Step 2: 定义常量**

```typescript
// src/utils/constants.ts
export const COLORS = {
  bg: '#faf6ef',
  marriage: '#8b1a1a',
  parentChild: '#c9bba0',
  highlight: '#c9a96e',
  textPrimary: '#2b2622',
  textSecondary: '#6f6657',
  textLabel: '#a89c87',
  bandBg1: 'rgba(232,223,204,0.18)',
  bandBg2: 'rgba(232,223,204,0.06)',
}

export const SIZES = {
  nodeRadius: 12,
  rootRadius: 14,
  marriageStroke: 3,
  parentChildStroke: 2,
  genHeight: 55, // 世代间距
  minEdgeGap: 6, // 最小边缘间距
}

export const GEN_LABELS = ['祖辈', '一世', '二世', '三世', '四世', '五世', '六世']
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/ && git commit -m "feat: add type definitions and constants"
```

---

## Task 3: 测试数据（Seed）

**Files:**
- Create: `src/data/seed.ts`
- Source: `/Users/a1-6/cursor_workspace/family/族谱_永康支.csv`

- [ ] **Step 1: 将 CSV 转换为硬编码 TypeScript 数据**

基于 `族谱_永康支.csv` 创建 `src/data/seed.ts`，包含约 27 个 Member 对象（含祖父/祖母占位、永康4妻、树炎2妻、熙涵+夏凡等）。

数据结构：每个 Member 含 id, name, gender, birthYear, deathYear, fatherId, motherId, spouses 数组。

- [ ] **Step 2: 验证数据完整性**

- 所有人 fatherId/motherId/spouseId 指向存在的 id
- 永康有 4 个 spouses（陈氏/唐氏/徐氏/肖氏）
- 树炎有 2 个 spouses（杨氏/万氏）
- 熙涵+夏凡互为配偶

- [ ] **Step 3: Commit**

```bash
git add src/data/ && git commit -m "feat: add seed data for 永康支 (27 members)"
```

---

## Task 4: Pinia Store

**Files:**
- Create: `src/stores/familyStore.ts`, `src/stores/uiStore.ts`

- [ ] **Step 1: familyStore — 家族数据管理**

```typescript
// src/stores/familyStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Member } from '@/utils/treeTypes'
import { seedMembers } from '@/data/seed'

export const useFamilyStore = defineStore('family', () => {
  const members = ref<Member[]>([])
  const isLoaded = ref(false)

  const rootMember = computed(() =>
    members.value.find(m => m.name === '永康')
  )

  function loadSeedData() {
    members.value = seedMembers()
    isLoaded.value = true
  }

  function getMemberById(id: string): Member | undefined {
    return members.value.find(m => m.id === id)
  }

  function getChildrenOf(memberId: string): Member[] {
    return members.value.filter(m => m.fatherId === memberId || m.motherId === memberId)
  }

  return { members, isLoaded, rootMember, loadSeedData, getMemberById, getChildrenOf }
})
```

- [ ] **Step 2: uiStore — UI 状态**

```typescript
// src/stores/uiStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const selectedMemberId = ref<string | null>(null)
  const lineagePath = ref<Set<string>>(new Set())
  const showAccessModal = ref(true)
  const isAuthenticated = ref(false)

  function selectMember(id: string | null) {
    selectedMemberId.value = id
  }

  function setLineagePath(ids: Set<string>) {
    lineagePath.value = ids
  }

  function authenticate() {
    isAuthenticated.value = true
    showAccessModal.value = false
  }

  return { selectedMemberId, lineagePath, showAccessModal, isAuthenticated, selectMember, setLineagePath, authenticate }
})
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/ && git commit -m "feat: add Pinia stores for family data and UI state"
```

---

## Task 5: 访问码门控

**Files:**
- Create: `src/components/AccessCodeModal.vue`
- Modify: `src/pages/index/index.vue`

- [ ] **Step 1: AccessCodeModal 组件**

传统中式风格弹窗：
- 输入框 + "进入家族" 按钮
- 硬编码访问码 `Wang2026`（Phase 1 不走 Supabase RPC）
- 验证通过 → `uiStore.authenticate()`
- 样式：暖色背景、暗红按钮、serif 字体

- [ ] **Step 2: 主页面集成**

```vue
<!-- src/pages/index/index.vue -->
<template>
  <view class="page">
    <AccessCodeModal v-if="uiStore.showAccessModal" />
    <view v-else class="tree-container">
      <FamilyTree v-if="familyStore.isLoaded" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useFamilyStore } from '@/stores/familyStore'
import { useUiStore } from '@/stores/uiStore'
import AccessCodeModal from '@/components/AccessCodeModal.vue'
import FamilyTree from '@/components/FamilyTree.vue'

const familyStore = useFamilyStore()
const uiStore = useUiStore()

onMounted(() => {
  familyStore.loadSeedData()
})
</script>
```

- [ ] **Step 3: 验证**

启动 H5 → 显示访问码弹窗 → 输入 Wang2026 → 进入主页面（树组件占位）。

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat: add access code gate"
```

---

## Task 6: 树布局算法（核心）

**Files:**
- Create: `src/composables/useTreeLayout.ts`

这是 Phase 1 最核心的任务。算法必须实现 spec 中所有布局规则。

- [ ] **Step 1: 子树宽度计算（后序遍历）**

```typescript
// 递归计算每个节点子树的最大宽度
function calcSubtreeWidth(node: Member, members: Member[]): number {
  const children = members.filter(m => m.motherId === node.id || m.fatherId === node.id)
  if (children.length === 0) {
    return SIZES.nodeRadius * 2 + SIZES.minEdgeGap
  }
  // 考虑配偶：每个配偶的子女组独立计算
  const spouseGroups = groupChildrenBySpouse(node, members)
  let totalWidth = 0
  for (const group of spouseGroups) {
    totalWidth += calcGroupWidth(group.children, members)
  }
  return Math.max(totalWidth, SIZES.nodeRadius * 2 + SIZES.minEdgeGap)
}
```

- [ ] **Step 2: 坐标分配（自顶向下）**

核心逻辑：
1. 根节点（永康）居中
2. 兄弟按列宽分配 x 坐标
3. 多配偶：妻子以丈夫为中心左右分布，按 marriageOrder 排序
4. 妻子 cx = 子女组中心 x
5. 子女 bus line 连接

- [ ] **Step 3: 连线生成**

生成 `LayoutLine[]`：
- 婚姻线：`type: 'marriage'`, stroke-width: 3, color: #8b1a1a
- 亲子线：`type: 'parent-child'`, stroke-width: 2, color: #c9bba0
- 遵循所有连线精确规则（垂线起点优先级、遇横即止、婚姻线不穿圆）

- [ ] **Step 4: viewBox 动态计算**

```typescript
const width = Math.max(totalTreeWidth + 100, 680) // 最小 680
const height = (maxGen + 1) * SIZES.genHeight + 100
```

- [ ] **Step 5: 导出 composable**

```typescript
export function useTreeLayout(members: Member[], rootId: string): TreeLayout {
  // 1. 构建树结构
  // 2. calcSubtreeWidth 后序遍历
  // 3. assignCoordinates 自顶向下
  // 4. generateLines 生成连线
  // 5. 计算 viewBox
  return { nodes, lines, viewBox }
}
```

- [ ] **Step 6: 用永康支数据验证**

运行算法，输出坐标与 spec mockup 坐标对比。重点验证：
- 妻子对齐规则（妻子 cx = 子女组中心）
- 边缘间距 ≥ 6px
- 婚姻线不穿过圆圈

- [ ] **Step 7: Commit**

```bash
git add src/composables/useTreeLayout.ts && git commit -m "feat: implement tree layout algorithm"
```

---

## Task 7: SVG 渲染组件

**Files:**
- Create: `src/components/FamilyTree.vue`, `src/components/MemberNode.vue`

- [ ] **Step 1: FamilyTree 主组件**

```vue
<template>
  <scroll-view scroll-x scroll-y class="tree-scroll">
    <svg :viewBox="`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`"
         style="width:100%;min-width:680px;">
      <style>line,path{stroke-linecap:round;stroke-linejoin:round}</style>
      <!-- 世代带状背景 -->
      <rect v-for="(band, i) in bands" :key="i" v-bind="band" />
      <!-- 世代标签 -->
      <text v-for="(label, i) in genLabels" :key="i" v-bind="label" />
      <!-- 连线（先画，在下层） -->
      <line v-for="(line, i) in layout.lines" :key="'l'+i"
            :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2"
            :stroke="line.type === 'marriage' ? COLORS.marriage : COLORS.parentChild"
            :stroke-width="line.type === 'marriage' ? 3 : 2" />
      <!-- 节点（后画，在上层覆盖线条） -->
      <MemberNode v-for="node in layout.nodes" :key="node.id"
                  :node="node"
                  :is-selected="uiStore.selectedMemberId === node.id"
                  :is-in-lineage="uiStore.lineagePath.has(node.id)"
                  @click="handleNodeClick(node)" />
    </svg>
  </scroll-view>
</template>
```

- [ ] **Step 2: MemberNode 子组件**

```vue
<template>
  <g @click="$emit('click')">
    <circle :cx="node.cx" :cy="node.cy" :r="node.r"
            :fill="node.gender === 1 ? '#2c3e50' : COLORS.marriage"
            :stroke="isSelected ? COLORS.highlight : (node.isRoot ? COLORS.highlight : 'none')"
            :stroke-width="isSelected || node.isRoot ? 2.5 : 0" />
    <text :x="node.cx" :y="node.cy + 4" text-anchor="middle"
          fill="white" :font-size="node.isRoot ? 10 : 9"
          font-weight="bold" font-family="serif">
      {{ node.name.slice(-1) }}
    </text>
    <text :x="node.cx" :y="node.cy + node.r + 8" text-anchor="middle"
          :fill="COLORS.textPrimary" font-size="8" font-family="serif">
      {{ node.name }}
    </text>
  </g>
</template>
```

- [ ] **Step 3: 验证渲染**

H5 页面显示完整家族树 SVG，与 spec mockup 视觉一致。

- [ ] **Step 4: Commit**

```bash
git add src/components/ && git commit -m "feat: render family tree SVG"
```

---

## Task 8: 成员详情弹窗

**Files:**
- Create: `src/components/MemberDrawer.vue`

- [ ] **Step 1: 底部抽屉组件**

点击节点 → 从底部滑出的详情卡片：
- 姓名、生卒年、性别
- 配偶列表（含婚配类型）
- 子女列表
- 生平简介（如有）
- 关闭按钮

样式：暖色卡片、serif 字体、暗红分割线。

- [ ] **Step 2: 集成到主页面**

`uiStore.selectedMemberId` 非空时显示 MemberDrawer。

- [ ] **Step 3: Commit**

```bash
git add src/components/MemberDrawer.vue && git commit -m "feat: add member detail drawer"
```

---

## Task 9: "我的脉系"高亮

**Files:**
- Create: `src/composables/useLineage.ts`
- Modify: `src/components/FamilyTree.vue`, `src/components/MemberNode.vue`

- [ ] **Step 1: 脉系路径计算**

```typescript
export function useLineage() {
  function calcLineagePath(memberId: string, members: Member[]): Set<string> {
    const path = new Set<string>()
    // 向上追溯：father → grandfather → ...
    let current = members.find(m => m.id === memberId)
    while (current) {
      path.add(current.id)
      current = current.fatherId ? members.find(m => m.id === current!.fatherId) : undefined
    }
    // 向下追溯：children → grandchildren → ...
    function addDescendants(id: string) {
      path.add(id)
      members.filter(m => m.fatherId === id).forEach(child => addDescendants(child.id))
    }
    addDescendants(memberId)
    return path
  }
  return { calcLineagePath }
}
```

- [ ] **Step 2: 视觉反馈**

- 脉系节点：金边高亮 (#c9a96e)
- 脉系连线：加粗（stroke-width + 1）
- 非脉系节点/连线：降低 opacity (0.3)

- [ ] **Step 3: 交互**

点击节点 → 计算脉系 → 高亮显示。再次点击 → 取消高亮。

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat: add lineage highlight on node click"
```

---

## Task 10: 移动端适配与验证

**Files:**
- Modify: `src/components/FamilyTree.vue`, `src/styles/global.scss`

- [ ] **Step 1: 横向滚动 + 缩放**

```vue
<scroll-view scroll-x scroll-y class="tree-scroll"
             :style="{ height: 'calc(100vh - 60px)' }">
```

- [ ] **Step 2: 全局样式微调**

```scss
.tree-scroll {
  width: 100vw;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}
```

- [ ] **Step 3: 端到端验证**

1. 启动 H5 → 访问码弹窗
2. 输入 Wang2026 → 进入主页面
3. 家族树完整渲染（27 人，5 代，多配偶）
4. 横向滚动正常
5. 点击节点 → 详情弹窗
6. 点击节点 → 脉系高亮
7. 自检 spec 7 步全部通过

- [ ] **Step 4: Commit**

```bash
git add . && git commit -m "feat: mobile adaptation and final polish"
```

---

## 验证清单

| 检查项 | 对应 Task |
|--------|----------|
| 访问码门控 | Task 5 |
| SVG 渲染 27 人 | Task 6, 7 |
| 多配偶（永康4妻、树炎2妻） | Task 6 |
| 多世代（5代） | Task 6, 7 |
| 边缘间距 ≥ 6px | Task 6 |
| 婚姻线不穿圆 | Task 6 |
| 垂线起点规则 | Task 6 |
| 成员详情弹窗 | Task 8 |
| 脉系高亮 | Task 9 |
| 移动端滚动 | Task 10 |
| SVG round linecap | Task 7 |
