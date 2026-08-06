<template>
  <scroll-view scroll-x scroll-y class="tree-scroll">
    <div v-html="svgHtml" class="tree-svg-container" @click="handleSvgTap" />
  </scroll-view>
</template>

<script setup lang="ts">
import { computed, watch, nextTick } from 'vue'
import { useFamilyStore } from '@/stores/familyStore'
import { useUiStore } from '@/stores/uiStore'
import { useTreeLayout } from '@/composables/useTreeLayout'
import { SIZES, GEN_LABELS } from '@/utils/constants'
import type { LayoutNode } from '@/utils/treeTypes'

const familyStore = useFamilyStore()
const uiStore = useUiStore()

// 搜索定位：监听到 focusRequest 后滚动到目标节点并选中高亮
watch(
  () => uiStore.focusRequest,
  async req => {
    if (!req) return
    await nextTick()
    const el = document.getElementById(`node-${req.memberId}`)
    if (el) {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
      } catch {
        el.scrollIntoView()
      }
      // 同步选中并高亮脉系
      uiStore.selectMember(req.memberId)
      const path = calcLineage(req.memberId, familyStore.members)
      uiStore.setLineagePath(path)
    }
  },
)

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

const svgHtml = computed(() => {
  const L = layout.value
  const p: string[] = []

  p.push(`<svg viewBox="0 0 ${L.viewBox.width} ${L.viewBox.height}" style="width:100%;min-width:680px;" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">`)

  // ── Defs: gradients, shadows, filters ──
  p.push(`<defs>`)
  // Male gradient (deep blue)
  p.push(`<radialGradient id="gMale" cx="35%" cy="30%" r="70%">
    <stop offset="0%" stop-color="#4a6fa5"/>
    <stop offset="100%" stop-color="#2c3e50"/>
  </radialGradient>`)
  // Female gradient (warm red)
  p.push(`<radialGradient id="gFemale" cx="35%" cy="30%" r="70%">
    <stop offset="0%" stop-color="#c0564f"/>
    <stop offset="100%" stop-color="#8b1a1a"/>
  </radialGradient>`)
  // Root highlight gradient (gold)
  p.push(`<radialGradient id="gRoot" cx="35%" cy="30%" r="70%">
    <stop offset="0%" stop-color="#5a7faa"/>
    <stop offset="100%" stop-color="#2c3e50"/>
  </radialGradient>`)
  // Drop shadow filter
  p.push(`<filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="#2b2622" flood-opacity="0.15"/>
  </filter>`)
  // Glow filter for selected
  p.push(`<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="3" result="blur"/>
    <feFlood flood-color="#c9a96e" flood-opacity="0.6"/>
    <feComposite in2="blur" operator="in"/>
    <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>`)
  p.push(`</defs>`)

  // ── Generation bands (subtle, elegant) ──
  for (let i = 0; i < genBands.value.length; i++) {
    const b = genBands.value[i]
    const fill = i % 2 === 0 ? 'rgba(232,223,204,0.12)' : 'rgba(232,223,204,0.04)'
    p.push(`<rect x="0" y="${b.y}" width="${L.viewBox.width}" height="${b.h}" fill="${fill}" rx="6"/>`)
    if (GEN_LABELS[i]) {
      p.push(`<text x="8" y="${b.y + 14}" fill="#b8a88a" font-size="10" font-weight="600" font-family="'Noto Serif SC',serif" letter-spacing="2">${GEN_LABELS[i]}</text>`)
    }
  }

  // ── Connection lines (softer, layered) ──
  for (const line of L.lines) {
    if (line.type === 'marriage') {
      // Marriage: elegant double-line effect
      p.push(`<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="#a83232" stroke-width="3.5" opacity="0.9"/>`)
      p.push(`<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="#d4756e" stroke-width="1" opacity="0.5"/>`)
    } else {
      // Parent-child: subtle warm line
      p.push(`<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="#c9bba0" stroke-width="1.8" opacity="0.85"/>`)
    }
  }

  // ── Nodes (polished with shadows and gradients) ──
  const hasLineage = uiStore.lineagePath.size > 0
  for (const node of L.nodes) {
    // 占位角色（未记载的配偶）：灰色虚线样式，不可点击
    if (node.isPlaceholder) {
      const r = node.r
      p.push(`<g opacity="0.65">`)
      p.push(`<circle cx="${node.cx}" cy="${node.cy}" r="${r}" fill="#ece7db" stroke="#b8a88a" stroke-width="1.5" stroke-dasharray="3 2"/>`)
      p.push(`<text x="${node.cx}" y="${node.cy + 1}" text-anchor="middle" dominant-baseline="central" fill="#a89c87" font-size="9" font-weight="bold" font-family="'Noto Serif SC',serif">?</text>`)
      p.push(`<text x="${node.cx}" y="${node.cy + r + 11}" text-anchor="middle" fill="#a89c87" font-size="8" font-family="'Noto Serif SC',serif">未记载</text>`)
      p.push('</g>')
      continue
    }
    const isSelected = uiStore.selectedMemberId === node.id
    const isInLineage = uiStore.lineagePath.has(node.id)
    const dimmed = hasLineage && !isInLineage
    const opacity = dimmed ? 0.25 : 1

    const gradId = node.gender === 1 ? (node.isRoot ? 'gRoot' : 'gMale') : 'gFemale'
    const r = node.r

    p.push(`<g data-id="${node.id}" id="node-${node.id}" style="cursor:pointer" opacity="${opacity}">`)

    // Shadow circle (behind main circle)
    if (!dimmed) {
      p.push(`<circle cx="${node.cx}" cy="${node.cy + 1}" r="${r}" fill="rgba(43,38,34,0.1)" filter="url(#shadow)"/>`)
    }

    // Main circle with gradient
    const filter = isSelected ? 'url(#glow)' : ''
    p.push(`<circle cx="${node.cx}" cy="${node.cy}" r="${r}" fill="url(#${gradId})" ${filter ? `filter="${filter}"` : ''}/>` )

    // Selection ring
    if (isSelected || node.isRoot) {
      p.push(`<circle cx="${node.cx}" cy="${node.cy}" r="${r + 2.5}" fill="none" stroke="#c9a96e" stroke-width="2" opacity="0.9"/>`)
    }

    // Gender indicator: small dot at top
    const dotColor = node.gender === 1 ? '#7eb3e0' : '#e8a0a0'
    p.push(`<circle cx="${node.cx}" cy="${node.cy - r + 3}" r="2" fill="${dotColor}" opacity="0.7"/>`)

    // Short name inside circle
    const shortName = node.name.length <= 2 ? node.name : node.name.slice(-1)
    const fontSize = node.isRoot ? 11 : 9
    p.push(`<text x="${node.cx}" y="${node.cy + 1}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="${fontSize}" font-weight="bold" font-family="'Noto Serif SC',serif" style="text-shadow:0 1px 2px rgba(0,0,0,0.3)">${shortName}</text>`)

    // Full name below (clearer, larger)
    p.push(`<text x="${node.cx}" y="${node.cy + r + 11}" text-anchor="middle" fill="#3d3529" font-size="8" font-weight="500" font-family="'Noto Serif SC',serif">${node.name}</text>`)

    p.push('</g>')
  }

  p.push('</svg>')
  return p.join('')
})

function handleSvgTap(e: Event) {
  const target = e.target as HTMLElement
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
  background: linear-gradient(180deg, #faf6ef 0%, #f5efe3 100%);
}

.tree-svg-container {
  padding: 12px 8px;
}
</style>
