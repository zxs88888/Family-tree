<template>
  <scroll-view scroll-x scroll-y class="tree-scroll">
    <svg
      :viewBox="`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`"
      style="width:100%;min-width:680px;"
    >
      <style>line,path{stroke-linecap:round;stroke-linejoin:round}</style>

      <!-- Generation bands -->
      <rect
        v-for="(_, gi) in genBands" :key="'b'+gi"
        :x="0" :y="genBands[gi].y" :width="layout.viewBox.width" :height="genBands[gi].h"
        :fill="gi % 2 === 0 ? COLORS.bandBg1 : COLORS.bandBg2" rx="4"
      />

      <!-- Generation labels -->
      <text
        v-for="(_, gi) in genBands" :key="'l'+gi"
        x="5" :y="genBands[gi].y + 13"
        :fill="COLORS.textLabel" font-size="9" font-weight="600" font-family="serif"
      >{{ GEN_LABELS[gi] || '' }}</text>

      <!-- Lines (below nodes) -->
      <line
        v-for="(line, li) in layout.lines" :key="'ln'+li"
        :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2"
        :stroke="line.type === 'marriage' ? COLORS.marriage : COLORS.parentChild"
        :stroke-width="line.type === 'marriage' ? 3 : 1.5"
        :opacity="lineDimmed(line) ? 0.2 : 1"
      />

      <!-- Nodes (above lines) -->
      <MemberNode
        v-for="node in layout.nodes" :key="node.id"
        :node="node"
        :is-selected="uiStore.selectedMemberId === node.id"
        :is-in-lineage="uiStore.lineagePath.has(node.id)"
        :has-lineage="uiStore.lineagePath.size > 0"
        @tap="handleTap(node)"
      />
    </svg>
  </scroll-view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFamilyStore } from '@/stores/familyStore'
import { useUiStore } from '@/stores/uiStore'
import { useTreeLayout } from '@/composables/useTreeLayout'
import { COLORS, SIZES, GEN_LABELS } from '@/utils/constants'
import type { LayoutNode, LayoutLine } from '@/utils/treeTypes'
import MemberNode from './MemberNode.vue'

const familyStore = useFamilyStore()
const uiStore = useUiStore()

const layout = computed(() => {
  const root = familyStore.rootMember
  if (!root) return { nodes: [], lines: [], viewBox: { width: 700, height: 350 } }
  return useTreeLayout(familyStore.members, root.id)
})

const genBands = computed(() => {
  // Find max gen
  let maxGen = 0
  for (const n of layout.value.nodes) {
    const gen = Math.round((n.cy - 23) / (SIZES.genHeight + SIZES.nodeRadius * 2 + 10))
    if (gen > maxGen) maxGen = gen
  }
  const bands = []
  for (let g = 0; g <= maxGen; g++) {
    const y = 23 + g * (SIZES.genHeight + SIZES.nodeRadius * 2 + 10) - SIZES.nodeRadius - 10
    bands.push({ y, h: SIZES.genHeight + SIZES.nodeRadius * 2 + 10 })
  }
  return bands
})

function handleTap(node: LayoutNode) {
  if (uiStore.selectedMemberId === node.id) {
    // Toggle off
    uiStore.selectMember(null)
    uiStore.setLineagePath(new Set())
  } else {
    uiStore.selectMember(node.id)
    // Calculate lineage
    const path = calcLineage(node.id, familyStore.members)
    uiStore.setLineagePath(path)
  }
}

function lineDimmed(line: LayoutLine): boolean {
  if (uiStore.lineagePath.size === 0) return false
  // A line is dimmed if neither endpoint node is in the lineage
  // Approximate: check if any lineage node is near the line endpoints
  return false // Keep all lines visible for now
}

// Simple lineage calculation
function calcLineage(memberId: string, members: any[]): Set<string> {
  const path = new Set<string>()

  // Go up: father chain
  let current = members.find((m: any) => m.id === memberId)
  while (current) {
    path.add(current.id)
    current = current.fatherId ? members.find((m: any) => m.id === current!.fatherId) : undefined
  }

  // Go down: all descendants
  function addDesc(id: string) {
    path.add(id)
    members.filter((m: any) => m.fatherId === id).forEach((child: any) => addDesc(child.id))
  }
  addDesc(memberId)

  return path
}
</script>

<style lang="scss">
.tree-scroll {
  width: 100vw;
  height: calc(100vh - 44px);
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  background: #faf6ef;
}
</style>
