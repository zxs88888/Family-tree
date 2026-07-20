<template>
  <scroll-view scroll-x scroll-y class="tree-scroll">
    <div v-html="svgHtml" class="tree-svg-container" @tap="handleSvgTap" />
  </scroll-view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useFamilyStore } from '@/stores/familyStore'
import { useUiStore } from '@/stores/uiStore'
import { useTreeLayout } from '@/composables/useTreeLayout'
import { COLORS, SIZES, GEN_LABELS } from '@/utils/constants'
import type { LayoutNode } from '@/utils/treeTypes'

const familyStore = useFamilyStore()
const uiStore = useUiStore()

const layout = computed(() => {
  const root = familyStore.rootMember
  if (!root) return { nodes: [], lines: [], viewBox: { width: 700, height: 350 } }
  return useTreeLayout(familyStore.members, root.id)
})

const genBands = computed(() => {
  let maxGen = 0
  for (const n of layout.value.nodes) {
    const rowH = SIZES.genHeight + SIZES.nodeRadius * 2 + 10
    const gen = Math.round((n.cy - 23) / rowH)
    if (gen > maxGen) maxGen = gen
  }
  const bands = []
  const rowH = SIZES.genHeight + SIZES.nodeRadius * 2 + 10
  for (let g = 0; g <= maxGen; g++) {
    bands.push({ y: 23 + g * rowH - SIZES.nodeRadius - 10, h: rowH })
  }
  return bands
})

// Build SVG as raw HTML string to bypass Taro's template compiler
// (Taro transforms <text> to taro-text-core which breaks SVG)
const svgHtml = computed(() => {
  const L = layout.value
  const parts: string[] = []

  parts.push(`<svg viewBox="0 0 ${L.viewBox.width} ${L.viewBox.height}" style="width:100%;min-width:680px;" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">`)

  // Generation bands
  for (let i = 0; i < genBands.value.length; i++) {
    const b = genBands.value[i]
    const fill = i % 2 === 0 ? COLORS.bandBg1 : COLORS.bandBg2
    parts.push(`<rect x="0" y="${b.y}" width="${L.viewBox.width}" height="${b.h}" fill="${fill}" rx="4"/>`)
    if (GEN_LABELS[i]) {
      parts.push(`<text x="5" y="${b.y + 13}" fill="${COLORS.textLabel}" font-size="9" font-weight="600" font-family="serif">${GEN_LABELS[i]}</text>`)
    }
  }

  // Lines
  for (const line of L.lines) {
    const stroke = line.type === 'marriage' ? COLORS.marriage : COLORS.parentChild
    const sw = line.type === 'marriage' ? 3 : 1.5
    parts.push(`<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="${stroke}" stroke-width="${sw}"/>`)
  }

  // Nodes
  const hasLineage = uiStore.lineagePath.size > 0
  for (const node of L.nodes) {
    const isSelected = uiStore.selectedMemberId === node.id
    const isInLineage = uiStore.lineagePath.has(node.id)
    const dimmed = hasLineage && !isInLineage
    const opacity = dimmed ? 0.3 : 1

    const fill = node.gender === 1 ? '#2c3e50' : COLORS.marriage
    const strokeColor = isSelected || node.isRoot ? COLORS.highlight : 'none'
    const strokeW = isSelected || node.isRoot ? 2.5 : 0

    // Circle
    parts.push(`<g data-id="${node.id}" style="cursor:pointer">`)
    parts.push(`<circle cx="${node.cx}" cy="${node.cy}" r="${node.r}" fill="${fill}" stroke="${strokeColor}" stroke-width="${strokeW}" opacity="${opacity}"/>`)

    // Short name inside circle
    const shortName = node.name.length <= 2 ? node.name : node.name.slice(-1)
    const fontSize = node.isRoot ? 10 : 8
    parts.push(`<text x="${node.cx}" y="${node.cy + 4}" text-anchor="middle" fill="white" font-size="${fontSize}" font-weight="bold" font-family="serif" opacity="${opacity}">${shortName}</text>`)

    // Full name below
    parts.push(`<text x="${node.cx}" y="${node.cy + node.r + 10}" text-anchor="middle" fill="${COLORS.textPrimary}" font-size="7" font-family="serif" opacity="${opacity}">${node.name}</text>`)

    // Year text
    const { birthYear, deathYear } = node
    let yearText = ''
    if (birthYear && deathYear) yearText = `${birthYear}-${deathYear}`
    else if (birthYear) yearText = `${birthYear}-`
    else if (deathYear) yearText = `?-${deathYear}`
    if (yearText) {
      parts.push(`<text x="${node.cx}" y="${node.cy + node.r + 19}" text-anchor="middle" fill="${COLORS.textSecondary}" font-size="6" font-family="serif" opacity="${opacity}">${yearText}</text>`)
    }

    parts.push('</g>')
  }

  parts.push('</svg>')
  return parts.join('')
})

function handleSvgTap(e: Event) {
  const target = e.target as HTMLElement
  // Walk up to find the <g> with data-id
  let el: HTMLElement | null = target
  while (el && el.tagName !== 'svg') {
    if (el.dataset?.id) {
      const id = el.dataset.id
      if (uiStore.selectedMemberId === id) {
        uiStore.selectMember(null)
        uiStore.setLineagePath(new Set())
      } else {
        uiStore.selectMember(id)
        const path = calcLineage(id, familyStore.members)
        uiStore.setLineagePath(path)
      }
      return
    }
    el = el.parentElement
  }
}

function calcLineage(memberId: string, members: any[]): Set<string> {
  const path = new Set<string>()
  let current = members.find((m: any) => m.id === memberId)
  while (current) {
    path.add(current.id)
    current = current.fatherId ? members.find((m: any) => m.id === current!.fatherId) : undefined
  }
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

.tree-svg-container {
  padding: 8px;
}
</style>
