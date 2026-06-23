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
    <view ref="graphRef" class="graph-container"></view>
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from "vue";
import * as echarts from "echarts";
import { useFamilyStore } from "@/stores/familyStore";
import { useUserStore } from "@/stores/userStore";

const familyStore = useFamilyStore();
const userStore = useUserStore();
const graphRef = ref(null);
const currentView = ref("lineage");
const myMemberId = computed(() => userStore.myMemberId);

let chart = null;

function initChart() {
  if (!graphRef.value) return;
  chart = echarts.init(graphRef.value);
  renderChart();
}

function renderChart() {
  if (!chart || !familyStore.graphData.nodes?.length) return;

  const graphData = familyStore.graphData;
  const isLargeFont = userStore.fontSizePreference === 20;

  const coloredLinks = (graphData.links || []).map((link) => ({
    ...link,
    lineStyle: {
      color: link.isDirectLine ? "#C9A96E" : "#B0B0B0",
      width: link.isDirectLine ? 3 : 1.5,
      shadowBlur: link.isDirectLine ? 8 : 0,
      shadowColor: link.isDirectLine ? "rgba(201,169,110,0.5)" : "transparent",
    },
  }));

  const coloredNodes = (graphData.nodes || []).map((node) => ({
    ...node,
    symbolSize:
      node.category === "center"
        ? isLargeFont
          ? 65
          : 60
        : isLargeFont
          ? 45
          : 40,
    itemStyle: {
      borderColor: node.isAlive ? "#27AE60" : "#95A5A6",
      borderType: node.isAlive ? "dashed" : "solid",
      borderWidth: 2,
    },
  }));

  const option = {
    series: [
      {
        type: "graph",
        layout: "force",
        force: {
          repulsion: isLargeFont ? 350 : 300,
          edgeLength: isLargeFont ? 170 : 150,
          gravity: 0.1,
          friction: 0.1,
          layoutAnimation: false,
        },
        roam: true,
        draggable: true,
        data: coloredNodes,
        links: coloredLinks,
        edgeSymbol: (value, params) =>
          params.data?.showArrow ? ["none", "arrow"] : ["none", "none"],
        categories: [
          { name: "center", itemStyle: { color: "#8B1A1A" } },
          { name: "male", itemStyle: { color: "#2E86C1" } },
          { name: "female", itemStyle: { color: "#D81B60" } },
          { name: "member", itemStyle: { color: "#95A5A6" } },
        ],
        label: {
          show: true,
          position: "bottom",
          fontSize: userStore.fontSizePreference || 14,
          distance: 8,
          formatter: (params) => {
            const name = params.data.name;
            if (name?.length > 4 && userStore.fontSizePreference === 20) {
              return name.slice(0, 4) + "\n" + name.slice(4);
            }
            return name;
          },
        },
        lineStyle: { color: "#B0B0B0", width: 1.5 },
        emphasis: { focus: "adjacency", lineStyle: { width: 3 } },
      },
    ],
  };

  chart.setOption(option, true);
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

onMounted(() => initChart());
onUnmounted(() => {
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
}
.view-switcher {
  position: absolute;
  top: var(--spacing-sm);
  left: var(--spacing-sm);
  z-index: 10;
  display: flex;
  gap: 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(8px);
}
.switch-option {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-base);
  min-width: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}
.switch-option.active {
  background: var(--primary);
  color: #fff;
}
.switch-option.disabled {
  opacity: 0.5;
}
</style>
