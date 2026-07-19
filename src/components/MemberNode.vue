<template>
  <g @tap="$emit('tap')">
    <circle
      :cx="node.cx" :cy="node.cy" :r="node.r"
      :fill="node.gender === 1 ? '#2c3e50' : COLORS.marriage"
      :stroke="isSelected || node.isRoot ? COLORS.highlight : 'none'"
      :stroke-width="isSelected || node.isRoot ? 2.5 : 0"
      :opacity="dimmed ? 0.3 : 1"
    />
    <text
      :x="node.cx" :y="node.cy + 4"
      text-anchor="middle" fill="white"
      :font-size="node.isRoot ? 10 : 8"
      font-weight="bold" font-family="serif"
      :opacity="dimmed ? 0.3 : 1"
    >{{ shortName }}</text>
    <text
      :x="node.cx" :y="node.cy + node.r + 10"
      text-anchor="middle" :fill="COLORS.textPrimary"
      font-size="7" font-family="serif"
      :opacity="dimmed ? 0.3 : 1"
    >{{ node.name }}</text>
    <text
      v-if="yearText"
      :x="node.cx" :y="node.cy + node.r + 19"
      text-anchor="middle" :fill="COLORS.textSecondary"
      font-size="6" font-family="serif"
      :opacity="dimmed ? 0.3 : 1"
    >{{ yearText }}</text>
  </g>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LayoutNode } from '@/utils/treeTypes'
import { COLORS } from '@/utils/constants'

const props = defineProps<{
  node: LayoutNode
  isSelected?: boolean
  isInLineage?: boolean
  hasLineage?: boolean
}>()

defineEmits(['tap'])

const shortName = computed(() => {
  const n = props.node.name
  return n.length <= 2 ? n : n.slice(-1)
})

const yearText = computed(() => {
  const { birthYear, deathYear } = props.node
  if (birthYear && deathYear) return `${birthYear}-${deathYear}`
  if (birthYear) return `${birthYear}-`
  if (deathYear) return `?-${deathYear}`
  return ''
})

const dimmed = computed(() => {
  return props.hasLineage && !props.isInLineage
})
</script>
