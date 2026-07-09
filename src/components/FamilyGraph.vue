<template>
  <view class="family-graph">
    <view class="view-switcher">
      <text
        class="switch-option"
        :class="{ active: currentView === 'lineage', disabled: !myMemberId }"
        @click="switchView('lineage')"
        >🧬 脉系·以我为轴</text
      >
      <text
        class="switch-option"
        :class="{ active: currentView === 'global' }"
        @click="switchView('global')"
        >🌳 全局·以先祖为根</text
      >
    </view>

    <svg
      ref="svgRef"
      class="graph-svg"
      :class="{ grabbing }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
      @click="onBackgroundClick"
    >
      <g :transform="`translate(${transform.x} ${transform.y}) scale(${transform.k})`">
        <!-- 连线：干线 trunk / 连续水平脊 spine / 垂落支 bus / 婚姻 marriage -->
        <path
          v-for="(e, i) in model.edges"
          :key="'e' + i"
          class="edge"
          :class="[e.kind, edgeState[i].gold && 'hl', edgeState[i].dim && 'dim']"
          :d="e.d"
          fill="none"
        />
        <!-- 节点：色点 + 名卡 + 称谓 -->
        <g
          v-for="n in model.nodes"
          :key="'n' + n.id"
          class="node"
          :class="[
            n.isMe && 'is-me',
            nodeState[n.id] && nodeState[n.id].hl && 'hl',
            nodeState[n.id] && nodeState[n.id].dim && 'dim',
          ]"
          @click.stop="onNodeClick(n.id)"
        >
          <circle
            :cx="n.x"
            :cy="n.y"
            :r="NODE_R"
            :fill="nodeColor(n)"
            :stroke="n.isMe ? '#D4AF37' : n.isAlive ? '#5b8c51' : '#b7ad97'"
            :stroke-width="n.isMe ? 4 : 2"
            :stroke-dasharray="n.isAlive ? 'none' : '4 3'"
          />
          <text
            :x="n.x"
            :y="n.y + 6"
            text-anchor="middle"
            class="node-initial"
            >{{ n.name.slice(0, 1) }}</text
          >
          <text
            :x="n.x"
            :y="n.y + NODE_R + 24"
            text-anchor="middle"
            class="node-name"
            >{{ n.name }}</text
          >
          <text
            :x="n.x"
            :y="n.y + NODE_R + 44"
            text-anchor="middle"
            class="node-label"
            >{{ n.label }}</text
          >
        </g>
      </g>
    </svg>

    <!-- 轻量缩放工具条 -->
    <view class="zoom-bar">
      <text class="zoom-btn" @click="zoomBy(1.2)">＋</text>
      <text class="zoom-btn" @click="zoomBy(1 / 1.2)">－</text>
      <text class="zoom-btn" @click="fitView">⤢</text>
    </view>
    <view v-if="selectedId" class="sel-hint">
      已选中「{{ selectedIdName }}」· 金色高亮其关系脉络，点空白处取消
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, watch } from "vue";
import { useFamilyStore } from "@/stores/familyStore";
import { useUserStore } from "@/stores/userStore";
import {
  buildElbowGraph,
  computeH,
  computeVisible,
  NODE_R,
} from "@/utils/elbowGraph";

const familyStore = useFamilyStore();
const userStore = useUserStore();
const svgRef = ref(null);
const currentView = ref(userStore.myMemberId ? "lineage" : "global");
const myMemberId = computed(() => userStore.myMemberId);
const selectedId = ref(null);
const emit = defineEmits(["node-click"]);

const selectedIdName = computed(() => {
  const n = familyStore.allMembers.find((m) => m.id === selectedId.value);
  return n ? n.name : "";
});

// ── 图模型：随 graphData / 视图 / 我 变化重算 ──
const model = computed(() =>
  buildElbowGraph(familyStore.graphData, familyStore.allMembers, {
    isLineage: currentView.value === "lineage",
    myMemberId: myMemberId.value,
  })
);

// ── 高亮判据（纯函数）──
const H = computed(() =>
  selectedId.value ? computeH(model.value.rels, selectedId.value) : null
);
const V = computed(() =>
  selectedId.value ? computeVisible(model.value.rels, selectedId.value) : null
);
const edgeState = computed(() =>
  model.value.edges.map((e) => {
    const gold = H.value ? e.nodes.every((n) => H.value.has(n)) : false;
    const dim = !!V.value && !e.nodes.every((n) => V.value.has(n));
    return { gold, dim };
  })
);
const nodeState = computed(() => {
  const m = {};
  model.value.nodes.forEach((n) => {
    m[n.id] = {
      hl: !!H.value && H.value.has(n.id),
      dim: !!V.value && !V.value.has(n.id),
    };
  });
  return m;
});

const nodeColor = (n) =>
  n.category === "male"
    ? "#3A4A52"
    : n.category === "female"
      ? "#9C6B4A"
      : "#8A8275";

// ── 平移 / 缩放 ──
const transform = reactive({ x: 0, y: 0, k: 1 });
const grabbing = ref(false);
let needsFit = true;
let dragStart = null;

function svgPoint(e) {
  const rect = svgRef.value.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}
function fitView() {
  const svg = svgRef.value;
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  const w = rect.width,
    h = rect.height;
  if (!w || !h) return;
  const b = model.value.bounds;
  const cw = b.maxX - b.minX,
    ch = b.maxY - b.minY;
  if (cw <= 0 || ch <= 0) return;
  const k = Math.min(w / cw, h / ch) * 0.92;
  transform.k = k;
  transform.x = (w - cw * k) / 2 - b.minX * k;
  transform.y = (h - ch * k) / 2 - b.minY * k;
  needsFit = false;
}
function onPointerDown(e) {
  grabbing.value = true;
  const p = svgPoint(e);
  dragStart = { x: p.x, y: p.y, tx: transform.x, ty: transform.y };
  svgRef.value.setPointerCapture?.(e.pointerId);
}
function onPointerMove(e) {
  if (!dragStart) return;
  const p = svgPoint(e);
  transform.x = dragStart.tx + (p.x - dragStart.x);
  transform.y = dragStart.ty + (p.y - dragStart.y);
}
function onPointerUp(e) {
  grabbing.value = false;
  dragStart = null;
  svgRef.value?.releasePointerCapture?.(e.pointerId);
}
function onWheel(e) {
  e.preventDefault();
  const p = svgPoint(e);
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const newK = Math.min(4, Math.max(0.2, transform.k * factor));
  const wx = (p.x - transform.x) / transform.k;
  const wy = (p.y - transform.y) / transform.k;
  transform.x = p.x - wx * newK;
  transform.y = p.y - wy * newK;
  transform.k = newK;
}
function zoomBy(f) {
  const svg = svgRef.value;
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  const cx = rect.width / 2,
    cy = rect.height / 2;
  const newK = Math.min(4, Math.max(0.2, transform.k * f));
  const wx = (cx - transform.x) / transform.k;
  const wy = (cy - transform.y) / transform.k;
  transform.x = cx - wx * newK;
  transform.y = cy - wy * newK;
  transform.k = newK;
}

// ── 交互 ──
function onNodeClick(id) {
  selectedId.value = id;
  emit("node-click", id); // 打开成员详情抽屉（沿用旧交互）
}
function onBackgroundClick() {
  selectedId.value = null;
}
function switchView(view) {
  if (view === "lineage" && !myMemberId.value) {
    uni.showToast({ title: "请先在家族中选择您自己", icon: "none" });
    return;
  }
  if (currentView.value === view) return;
  currentView.value = view;
  selectedId.value = null;
  const centerId = view === "lineage" ? myMemberId.value : undefined;
  familyStore.buildGraph(centerId, 50);
  needsFit = true;
  nextTick(() => requestAnimationFrame(fitView));
}

// 数据到达 / 视口变化 → 复位并适配（带尺寸就绪重试，避免 0 高度塌缩）
function scheduleFit() {
  needsFit = true;
  let tries = 0;
  const tryFit = () => {
    const svg = svgRef.value;
    if (svg && svg.getBoundingClientRect().width > 0) {
      fitView();
    } else if (tries++ < 60) {
      requestAnimationFrame(tryFit);
    }
  };
  nextTick(tryFit);
}

watch(
  () => familyStore.graphData,
  () => scheduleFit()
);
watch(myMemberId, () => {
  selectedId.value = null;
  currentView.value = myMemberId.value ? "lineage" : "global";
  familyStore.buildGraph(myMemberId.value, 50);
  scheduleFit();
});

let ro = null;
onMounted(() => {
  svgRef.value.addEventListener("wheel", onWheel, { passive: false });
  ro = new ResizeObserver(() => {
    if (needsFit) fitView();
  });
  ro.observe(svgRef.value);
  scheduleFit();
});
onUnmounted(() => {
  svgRef.value?.removeEventListener("wheel", onWheel);
  ro?.disconnect();
});
</script>

<style>
.family-graph {
  display: block;
  width: 100%;
  height: 100%;
  position: relative;
}
.graph-svg {
  display: block;
  width: 100%;
  height: 100%;
  background: transparent;
  touch-action: none; /* 让指针拖拽/缩放手势不被浏览器默认滚动吞掉 */
  cursor: grab;
}
.graph-svg.grabbing {
  cursor: grabbing;
}

/* 连线 */
.edge {
  stroke: #c9bba0;
  stroke-width: 1.6;
  fill: none;
  transition:
    opacity 0.18s,
    stroke 0.18s,
    stroke-width 0.18s;
}
.edge.trunk {
  stroke-width: 1.8;
}
.edge.marriage {
  stroke: #b7a98c;
  stroke-width: 1.8;
}
.edge.hl {
  stroke: #d4af37 !important;
  stroke-width: 3.6 !important;
  opacity: 1 !important;
  filter: drop-shadow(0 0 4px rgba(212, 175, 55, 0.8));
}
.edge.dim {
  opacity: 0.12;
}

/* 节点 */
.node {
  cursor: pointer;
  transition: opacity 0.18s;
}
.node:hover circle {
  stroke: #8b1a1a;
}
.node .node-initial {
  font-size: 15px;
  font-weight: bold;
  fill: #fff;
  font-family: "Noto Serif SC", "Source Han Serif SC", serif;
  pointer-events: none;
}
.node .node-name {
  font-size: 15px;
  font-weight: bold;
  fill: #2b2622;
  font-family: "Noto Serif SC", "Source Han Serif SC", serif;
  pointer-events: none;
}
.node .node-label {
  font-size: 13px;
  fill: #6f6657;
  font-family: "Noto Serif SC", "Source Han Serif SC", serif;
  pointer-events: none;
}
.node.is-me circle {
  animation: mePulse 2.4s ease-in-out infinite;
}
@keyframes mePulse {
  0%,
  100% {
    filter: drop-shadow(0 0 6px rgba(212, 175, 55, 0.5));
  }
  50% {
    filter: drop-shadow(0 0 14px rgba(212, 175, 55, 0.9));
  }
}
.node.hl circle {
  stroke: #d4af37 !important;
  stroke-width: 4 !important;
}
.node.dim {
  opacity: 0.15;
}
@media (prefers-reduced-motion: reduce) {
  .node.is-me circle {
    animation: none;
  }
}

/* 视图切换 */
.view-switcher {
  position: absolute;
  top: var(--spacing-md);
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  padding: 4px;
  border-radius: var(--radius-full);
  background: rgba(252, 250, 245, 0.9);
  border: 1px solid var(--gold-line);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(8px);
}
.switch-option {
  padding: 8px 18px;
  font-size: var(--font-size-base);
  font-family: var(--font-family-title);
  letter-spacing: 1px;
  border-radius: var(--radius-full);
  min-width: 48px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink-soft);
  transition: all var(--transition-normal);
}
.switch-option.active {
  background: var(--primary);
  color: #f6ecd6;
  box-shadow: 0 2px 10px rgba(139, 26, 26, 0.3);
}
.switch-option.disabled {
  opacity: 0.45;
}

/* 缩放工具条 */
.zoom-bar {
  position: absolute;
  right: var(--spacing-md);
  bottom: var(--spacing-md);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.zoom-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(252, 250, 245, 0.92);
  border: 1px solid var(--gold-line);
  box-shadow: var(--shadow-sm);
  font-size: 20px;
  color: var(--ink);
  font-family: var(--font-family-title);
}
.zoom-btn:active {
  background: var(--gold-wash);
}
.sel-hint {
  position: absolute;
  left: var(--spacing-md);
  bottom: var(--spacing-md);
  z-index: 10;
  max-width: 60%;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  background: rgba(252, 250, 245, 0.9);
  border: 1px solid var(--gold-line);
  font-size: 12px;
  color: var(--ink-soft);
  font-family: var(--font-family-title);
}
</style>
