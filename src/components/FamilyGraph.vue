<template>
  <view class="family-graph">
    <view class="view-switcher">
      <text
        class="switch-option"
        :class="{ active: currentView === 'lineage', disabled: !myMemberId }"
        @click="switchView('lineage')"
        >🧬 脉系视图</text
      >
      <text
        class="switch-option"
        :class="{ active: currentView === 'global' }"
        @click="switchView('global')"
        >🌳 全局视图</text
      >
    </view>
    <view ref="graphRef" id="family-graph-canvas" class="graph-container"></view>
  </view>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from "vue";
import * as echarts from "echarts";
import { useFamilyStore } from "@/stores/familyStore";
import { useUserStore } from "@/stores/userStore";

const familyStore = useFamilyStore();
const userStore = useUserStore();
const graphRef = ref(null);
const currentView = ref("lineage");
const myMemberId = computed(() => userStore.myMemberId);
const emit = defineEmits(["node-click"]);

let chart = null;
let initRetries = 0;

function getChartDom() {
  // H5 下直接用真实 DOM（getElementById 拿到的才是真正可测量尺寸的 div），
  // 避免 uni-app 把 <view> 的 ref 解析成组件实例代理导致 ECharts 按 0×0 初始化
  if (typeof document !== "undefined") {
    const byId = document.getElementById("family-graph-canvas");
    if (byId) return byId;
  }
  return graphRef.value?.$el || graphRef.value || null;
}

function initChart() {
  const el = getChartDom();
  if (!el) {
    // DOM 尚未就绪，下一帧重试（带上限，避免永久空转）
    if (initRetries < 60) {
      initRetries++;
      requestAnimationFrame(() => initChart());
    }
    return;
  }
  // 容器尚未完成布局（clientHeight 为 0）时，延迟到下一帧再初始化。
  // 但最多重试约 1s（60 帧），超时则直接按当前尺寸初始化——
  // 最坏退化为旧版"节点塌缩在左上角"（至少可见），绝不再因永久重试导致空白画布。
  if ((!el.clientWidth || !el.clientHeight) && initRetries < 60) {
    initRetries++;
    requestAnimationFrame(() => initChart());
    return;
  }
  try {
    if (chart) {
      chart.dispose();
      chart = null;
    }
    chart = echarts.init(el);
    // 调试钩子：便于 headless 测试读取真实 option（生产环境无害）
    if (typeof window !== "undefined") window.__familyChart = chart;
    renderChart();
    chart.on("click", "series", (params) => {
      if (params.data?.raw) {
        emit("node-click", params.data.raw);
      }
    });
  } catch (err) {
    console.error("[FamilyGraph] init/render failed:", err);
  }
  // 初始挂载时容器可能尚未完成布局（0 尺寸），下一帧再 resize 校正，
  // 否则力导布局会按 0×0 初始化、节点全塌缩到左上角
  nextTick(() => {
    requestAnimationFrame(() => chart?.resize());
  });
}

function handleResize() {
  chart?.resize();
}

function renderChart() {
  if (!chart || !familyStore.graphData.nodes?.length) return;

  const graphData = familyStore.graphData;
  const isLargeFont = userStore.fontSizePreference === 20;
  const isLineageView = currentView.value === "lineage";

  // 关系副标：相对「我」的称谓（仅在脉系视图有意义）
  const relLabel = (node) => {
    if (node.category === "center") return "我";
    if (!isLineageView)
      return node.category === "female" ? "女" : node.category === "male" ? "男" : "族亲";
    const me = familyStore.allMembers.find((m) => m.id === myMemberId.value);
    if (!me) return node.category === "female" ? "女" : "男";
    if (node.raw?.father_id === me.id || node.raw?.mother_id === me.id) return "子女";
    if (me.father_id === node.id || me.mother_id === node.id) return "父母";
    if (node.raw?.spouse_id === me.id) return "配偶";
    if (node.raw?.father_id === me.father_id && me.father_id) return "兄弟姐妹";
    return node.category === "female" ? "女" : "男";
  };

  const coloredLinks = (graphData.links || []).map((link) => {
    // 三种连线：金线血脉 / 血缘（父母子女）/ 姻缘（夫妻）
    const isSpouse = link.kind === "spouse";
    const gold = link.isDirectLine;
    // 金色只留给直系血脉；夫妻线用柔和赭灰虚线，不与金线争夺视觉焦点
    const color = gold ? "#D4AF37" : isSpouse ? "#B7A98C" : "#C9BBA0";
    const width = gold ? 4 : isSpouse ? 2 : 1.6;
    return {
      ...link,
      symbol: link.showArrow ? ["none", "arrow"] : ["none", "none"],
      lineStyle: {
        color,
        width,
        type: isSpouse && !gold ? "dashed" : "solid",
        opacity: gold ? 1 : 0.85,
        curveness: isSpouse ? 0.18 : 0,
        shadowBlur: gold ? 14 : 0,
        shadowColor: gold ? "rgba(212,175,55,0.7)" : "transparent",
        cap: "round",
      },
    };
  });

  const coloredNodes = (graphData.nodes || []).map((node) => {
    const isCenter = node.category === "center";
    const size = isCenter ? (isLargeFont ? 70 : 64) : isLargeFont ? 48 : 42;
    return {
      ...node,
      symbolSize: size,
      // 节点本体=色点（头像意象）；雅致名卡由 label.rich 绘制在下方
      itemStyle: {
        // 节点收敛到中国传统色：男=黛、女=赭、旁系=墨灰；金色只留给中心与血脉
        color:
          node.category === "male"
            ? "#3A4A52"
            : node.category === "female"
              ? "#9C6B4A"
              : node.category === "member"
                ? "#8A8275"
                : "#8B1A1A",
        borderColor: isCenter ? "#D4AF37" : node.isAlive ? "#5b8c51" : "#b7ad97",
        borderType: isCenter ? "solid" : node.isAlive ? "solid" : "dashed",
        borderWidth: isCenter ? 4 : 2,
        shadowBlur: isCenter ? 22 : 6,
        shadowColor: isCenter ? "rgba(212,175,55,0.55)" : "rgba(74,56,30,0.18)",
      },
    };
  });

  const option = {
    series: [
      {
        type: "graph",
        // 确定性层级布局：节点坐标由 graphHelper 计算（脉系以"我"居中、全局以先祖为根），
        // 不再用力导向，保证脉络清晰、刷新不漂移（UIUX §9.4）。
        layout: "none",
        roam: true,
        draggable: true,
        data: coloredNodes,
        links: coloredLinks,
        edgeSymbol: ["none", "none"],
        categories: [
          { name: "center", itemStyle: { color: "#8B1A1A" } },
          { name: "male", itemStyle: { color: "#3A4A52" } },
          { name: "female", itemStyle: { color: "#9C6B4A" } },
          { name: "member", itemStyle: { color: "#8A8275" } },
        ],
        // 名卡：色点下方一块温润纸卡，宋体姓名 + 关系副标 + 金边
        label: {
          show: true,
          position: "bottom",
          distance: 10,
          formatter: (params) => {
            const name = params.data.name || "";
            const sub = relLabel(params.data);
            const wrapName =
              name.length > 4 && isLargeFont ? name.slice(0, 4) + "\n" + name.slice(4) : name;
            return `{name|${wrapName}}\n{sub|${sub}}`;
          },
          rich: {
            name: {
              fontFamily: "Noto Serif SC, Source Han Serif SC, serif",
              fontSize: isLargeFont ? 17 : 15,
              fontWeight: "bold",
              color: "#2b2622",
              backgroundColor: "rgba(252,250,245,0.96)",
              padding: [6, 11, 2, 11],
              borderRadius: 9,
              align: "center",
              lineHeight: 21,
            },
            sub: {
              fontFamily: "Noto Serif SC, Source Han Serif SC, serif",
              fontSize: 11,
              color: "#6F6657",
              backgroundColor: "rgba(252,250,245,0.96)",
              padding: [0, 11, 6, 11],
              borderRadius: 9,
              align: "center",
            },
          },
        },
        lineStyle: { color: "#C9BBA0", width: 1.6, cap: "round" },
        emphasis: {
          focus: "adjacency",
          lineStyle: { width: 4, color: "#D4AF37" },
          itemStyle: { shadowBlur: 18 },
          label: { rich: { name: { color: "#8b1a1a" } } },
        },
      },
    ],
  };

  // 关键：先 resize 到当前正确尺寸，再 setOption。
  // 若 init 时容器尺寸未就绪（0 高度），这句 resize 会把画布校正为真实尺寸，
  // 使下面的力导布局按正确高度计算，避免节点塌缩到顶部/左上角。
  chart.resize();
  chart.setOption(option, true);
  // 数据到达时容器可能已完成布局，补一次 resize 校正画布尺寸
  requestAnimationFrame(() => chart?.resize());
  startBreathing();
}

let breatheId = null;
let breatheVal = 10;
let breatheDir = 1;
let frameCount = 0;

// 缓存当前完整节点数据（含 x/y），呼吸动画每帧在其基础上只改"我"节点的光晕，
// 避免反复调用 getOption（坏状态）与非法 replaceMerge（会让后续 setOption 被忽略）。
let baseData = null;

function startBreathing() {
  stopBreathing();
  if (!chart || !myMemberId.value) return;
  // 尊重「减少动态」偏好：不启动常驻呼吸动画
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  baseData = chart.getOption().series?.[0]?.data || null;
  if (!baseData?.length) return;
  function tick() {
    frameCount++;
    breatheVal += breatheDir * 1.2;
    // 收敛光晕强度（6–14），避免过强抢戏，让金线成为焦点
    if (breatheVal > 14 || breatheVal < 6) breatheDir *= -1;
    if (frameCount % 2 !== 0) { breatheId = requestAnimationFrame(tick); return; }
    try {
      const data = baseData.map((d) => {
        if (d.id === myMemberId.value) {
          return { ...d, itemStyle: { ...d.itemStyle, shadowBlur: breatheVal, shadowColor: `rgba(201,169,110,${0.18 + breatheVal / 80})` } };
        }
        return d;
      });
      // 关键：用普通 setOption（series 按 index 合并），data 含 x/y 故坐标不变；
      // 绝不用 replaceMerge:['data']（'data' 非合法组件名），否则会令 chart 进入
      // 坏状态，导致后续 setOption 被 ECharts 静默忽略（表现为视图切换无效）。
      chart.setOption({ series: [{ data }] });
    } catch (_) {}
    breatheId = requestAnimationFrame(tick);
  }
  tick();
}

function stopBreathing() {
  if (breatheId) { cancelAnimationFrame(breatheId); breatheId = null; frameCount = 0; }
}

function switchView(view) {
  if (view === "lineage" && !myMemberId.value) {
    uni.showToast({ title: "请先在家族中选择您自己", icon: "none" });
    return;
  }
  currentView.value = view;
  const centerId = view === "lineage" ? myMemberId.value : undefined;
  const depth =
    view === "global" ? (familyStore.allMembers.length > 300 ? 3 : 5) : 3;
  familyStore.buildGraph(centerId, depth);
  renderChart();
}

watch(myMemberId, () => {
  if (myMemberId.value) {
    familyStore.buildGraph(myMemberId.value, 3);
    renderChart();
  }
});

// 数据到达即重绘：buildGraph 会整体替换 graphData，此处必触发，
// 覆盖"异步数据到达 / 回头用户初始值不触发 watch"等所有场景。
// chart 未就绪则先 init（避免 renderChart 因 chart 为 null 直接返回）。
watch(
  () => familyStore.graphData,
  () => {
    if (chart) renderChart();
    else initChart();
  }
);

onMounted(() => {
  initChart();
  window.addEventListener("resize", handleResize);
});
onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
  stopBreathing();
  chart?.dispose();
});
</script>

<style>
.family-graph {
  width: 100%;
  height: 100%;
  position: relative;
  animation: fadeIn 0.3s ease;
}
.graph-container {
  width: 100%;
  height: 100%;
  /* 透明，让宣纸底纹透出，图谱如绘于纸上 */
  background: transparent;
}
.view-switcher {
  position: absolute;
  top: var(--spacing-md);
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  gap: 0;
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
</style>
