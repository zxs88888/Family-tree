import type { Member, LayoutNode, LayoutLine, TreeLayout } from '../utils/treeTypes'
import { SIZES } from '../utils/constants'

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════
const R = SIZES.nodeRadius     // 12
const RR = SIZES.rootRadius    // 14
const GAP = SIZES.minEdgeGap   // 6
const TOP = 23                 // top padding
const ROW = SIZES.genHeight    // 55 between generations

// ═══════════════════════════════════════════
// Internal types
// ═══════════════════════════════════════════
interface SGroup {
  spouse: Member
  order: number
  mtype: string
  kids: PNode[]
}

interface PNode {
  m: Member
  gen: number
  root: boolean
  r: number
  // polygamy
  sgs: SGroup[]
  // single spouse
  ss?: Member
  skids: PNode[]
  // computed
  w: number
  x: number
  y: number
}

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════
const byId = (ms: Member[], id: string) => ms.find(m => m.id === id)

function kidsOfMom(ms: Member[], dad: string, mom: string): Member[] {
  return ms.filter(m => m.fatherId === dad && m.motherId === mom)
}

function kidsOfDad(ms: Member[], dad: string): Member[] {
  return ms.filter(m => m.fatherId === dad)
}

function genOf(m: Member, ms: Member[]): number {
  if (!m.fatherId) return 0
  const f = byId(ms, m.fatherId)
  return f ? genOf(f, ms) + 1 : 0
}

function kidsW(kids: PNode[]): number {
  if (!kids.length) return 0
  return kids.reduce((s, k, i) => s + k.w + (i ? GAP : 0), 0)
}

// ═══════════════════════════════════════════
// Build tree
// ═══════════════════════════════════════════
function build(
  m: Member, ms: Member[], gen: number, isRoot: boolean, seen: Set<string>
): PNode {
  seen.add(m.id)
  const n: PNode = {
    m, gen, root: isRoot, r: isRoot ? RR : R,
    sgs: [], skids: [], w: 0, x: 0, y: 0,
  }

  const sps = (m.spouses || []).sort((a, b) => a.marriageOrder - b.marriageOrder)

  if (sps.length === 0) {
    // No spouse: find children by fatherId only (motherId unset)
    const ch = kidsOfDad(ms, m.id).filter(c => !seen.has(c.id))
    for (const c of ch) n.skids.push(build(c, ms, gen + 1, false, seen))
  } else if (sps.length === 1) {
    const sp = byId(ms, sps[0].spouseId)
    if (sp && !seen.has(sp.id)) {
      seen.add(sp.id)
      n.ss = sp
      const ch = kidsOfMom(ms, m.id, sp.id).filter(c => !seen.has(c.id))
      for (const c of ch) n.skids.push(build(c, ms, gen + 1, false, seen))
    }
  } else {
    // Polygamy
    for (const rel of sps) {
      const sp = byId(ms, rel.spouseId)
      if (!sp || seen.has(sp.id)) continue
      seen.add(sp.id)
      const ch = kidsOfMom(ms, m.id, sp.id).filter(c => !seen.has(c.id))
      const kids: PNode[] = []
      for (const c of ch) kids.push(build(c, ms, gen + 1, false, seen))
      n.sgs.push({ spouse: sp, order: rel.marriageOrder, mtype: rel.marriageType, kids })
    }
  }
  return n
}

// ═══════════════════════════════════════════
// Width calculation (post-order)
// ═══════════════════════════════════════════
function calcW(n: PNode): void {
  for (const sg of n.sgs) for (const k of sg.kids) calcW(k)
  for (const k of n.skids) calcW(k)

  if (n.sgs.length > 0) {
    // Polygamy: sum of all spouse group widths
    let total = 0
    for (let i = 0; i < n.sgs.length; i++) {
      const sg = n.sgs[i]
      const cw = kidsW(sg.kids)
      const gw = Math.max(R * 2 + GAP, cw) // wife + gap at minimum
      ;(sg as any)._gw = gw // store group width
      total += gw + (i ? GAP : 0)
    }
    n.w = total + GAP * 2 // padding
  } else if (n.ss) {
    const couple = n.r * 2 + GAP + R * 2
    n.w = Math.max(couple, kidsW(n.skids)) + GAP
  } else if (n.skids.length) {
    n.w = Math.max(n.r * 2, kidsW(n.skids)) + GAP
  } else {
    n.w = n.r * 2 + GAP
  }
}

// ═══════════════════════════════════════════
// Coordinate assignment (top-down)
// ═══════════════════════════════════════════
function placeKids(kids: PNode[], centerX: number): void {
  if (!kids.length) return
  const tw = kidsW(kids)
  let cx = centerX - tw / 2
  for (const k of kids) {
    place(k, cx)
    cx += k.w + GAP
  }
}

function place(n: PNode, left: number): void {
  n.y = TOP + n.gen * (ROW + R * 2)

  if (n.sgs.length > 0) {
    // ── Polygamy: wives left/right of husband ──
    const groups = n.sgs
    const halfIdx = Math.ceil(groups.length / 2) // left count

    // Calculate group widths & place children first
    const gWidths: number[] = []
    for (let i = 0; i < groups.length; i++) {
      gWidths.push((groups[i] as any)._gw || (R * 2 + GAP))
    }

    // Total width
    let totalW = gWidths.reduce((s, w, i) => s + w + (i ? GAP : 0), 0)
    n.x = left + totalW / 2 // husband at center of all groups

    // Place each group
    let cursor = left
    for (let i = 0; i < groups.length; i++) {
      const sg = groups[i]
      const gw = gWidths[i]
      const groupCX = cursor + gw / 2

      // Place children centered in this group
      placeKids(sg.kids, groupCX)

      cursor += gw + GAP
    }
  } else if (n.ss) {
    // ── Single spouse: couple side by side ──
    const tw = Math.max(n.r * 2 + GAP + R * 2, kidsW(n.skids))
    n.x = left + tw / 2 - GAP / 2 - R // husband slightly left

    // Children from couple midpoint
    const midX = n.x + n.r + GAP / 2 + R // approximate midpoint
    placeKids(n.skids, midX)
  } else {
    // ── No spouse ──
    n.x = left + n.w / 2
    placeKids(n.skids, n.x)
  }
}

// ═══════════════════════════════════════════
// Collect LayoutNodes
// ═══════════════════════════════════════════
function toNodes(n: PNode, out: LayoutNode[]): void {
  out.push({
    id: n.m.id, name: n.m.name,
    cx: n.x, cy: n.y, r: n.r,
    gender: n.m.gender, isRoot: n.root,
    birthYear: n.m.birthYear, deathYear: n.m.deathYear,
  })

  // Single spouse node
  if (n.ss) {
    const wifeX = n.x + n.r + GAP + R
    out.push({
      id: n.ss.id, name: n.ss.name,
      cx: wifeX, cy: n.y, r: R,
      gender: n.ss.gender,
      birthYear: n.ss.birthYear, deathYear: n.ss.deathYear,
    })
  }

  // Polygamy spouse nodes
  if (n.sgs.length > 0) {
    const groups = n.sgs
    const halfIdx = Math.ceil(groups.length / 2)

    // Calculate positions for each wife
    // Wives are placed at group centers (same as their children)
    let cursor = n.x - groups.reduce((s, sg, i) => {
      const gw = (sg as any)._gw || (R * 2 + GAP)
      return s + gw + (i ? GAP : 0)
    }, 0) / 2

    for (let i = 0; i < groups.length; i++) {
      const sg = groups[i]
      const gw = (sg as any)._gw || (R * 2 + GAP)
      const wifeCX = cursor + gw / 2

      out.push({
        id: sg.spouse.id, name: sg.spouse.name,
        cx: wifeCX, cy: n.y, r: R,
        gender: sg.spouse.gender,
        birthYear: sg.spouse.birthYear, deathYear: sg.spouse.deathYear,
      })
      cursor += gw + GAP
    }
  }

  // Recurse children
  for (const k of n.skids) toNodes(k, out)
  for (const sg of n.sgs) for (const k of sg.kids) toNodes(k, out)
}

// ═══════════════════════════════════════════
// Collect LayoutLines
// ═══════════════════════════════════════════
function toLines(n: PNode, out: LayoutLine[], nodes: LayoutNode[]): void {
  const nNode = nodes.find(nd => nd.id === n.m.id)!

  if (n.ss) {
    const wNode = nodes.find(nd => nd.id === n.ss!.id)!

    // Marriage line
    out.push({
      x1: nNode.cx + nNode.r, y1: nNode.cy,
      x2: wNode.cx - wNode.r, y2: wNode.cy,
      type: 'marriage',
    })

    // Parent-child
    if (n.skids.length) {
      const midX = (nNode.cx + wNode.cx) / 2
      const busY = nNode.cy + Math.max(nNode.r, wNode.r) + 10

      out.push({ x1: midX, y1: nNode.cy, x2: midX, y2: busY, type: 'parent-child' })

      if (n.skids.length > 1) {
        const fx = n.skids[0].x, lx = n.skids[n.skids.length - 1].x
        out.push({ x1: fx, y1: busY, x2: lx, y2: busY, type: 'parent-child' })
      }
      for (const k of n.skids) {
        out.push({ x1: k.x, y1: busY, x2: k.x, y2: k.y - k.r, type: 'parent-child' })
      }
    }
  }

  if (n.sgs.length) {
    for (const sg of n.sgs) {
      const wNode = nodes.find(nd => nd.id === sg.spouse.id)
      if (!wNode) continue

      // Marriage line (from husband edge to wife edge)
      if (wNode.cx < nNode.cx) {
        out.push({
          x1: wNode.cx + wNode.r, y1: wNode.cy,
          x2: nNode.cx - nNode.r, y2: nNode.cy,
          type: 'marriage',
        })
      } else {
        out.push({
          x1: nNode.cx + nNode.r, y1: nNode.cy,
          x2: wNode.cx - wNode.r, y2: wNode.cy,
          type: 'marriage',
        })
      }

      // Parent-child from wife
      if (sg.kids.length) {
        const busY = wNode.cy + R + 10

        out.push({
          x1: wNode.cx, y1: wNode.cy + R,
          x2: wNode.cx, y2: busY,
          type: 'parent-child',
        })

        if (sg.kids.length > 1) {
          const fx = sg.kids[0].x, lx = sg.kids[sg.kids.length - 1].x
          out.push({ x1: fx, y1: busY, x2: lx, y2: busY, type: 'parent-child' })
        }
        for (const k of sg.kids) {
          out.push({ x1: k.x, y1: busY, x2: k.x, y2: k.y - k.r, type: 'parent-child' })
        }
      }
    }
  }

  // Recurse
  for (const k of n.skids) toLines(k, out, nodes)
  for (const sg of n.sgs) for (const k of sg.kids) toLines(k, out, nodes)
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════
export function useTreeLayout(members: Member[], rootId: string): TreeLayout {
  const root = byId(members, rootId)
  if (!root) throw new Error(`Root ${rootId} not found`)

  const rootGen = genOf(root, members)
  const seen = new Set<string>()

  // Build root's generation (siblings)
  const siblings = root.fatherId
    ? kidsOfDad(members, root.fatherId).filter(c => !seen.has(c.id))
    : [root]

  const sibNodes: PNode[] = []
  for (const s of siblings) {
    if (seen.has(s.id)) continue
    sibNodes.push(build(s, members, rootGen, s.id === rootId, seen))
  }

  // Widths
  for (const s of sibNodes) calcW(s)

  // Assign coords
  let cursor = GAP
  for (const s of sibNodes) {
    place(s, cursor)
    cursor += s.w + GAP
  }

  // Grandparents (Gen 0)
  let gpNode: PNode | null = null
  if (root.fatherId) {
    const gp = byId(members, root.fatherId)
    if (gp) {
      gpNode = build(gp, members, 0, false, seen)
      calcW(gpNode)

      // Center grandparents over siblings
      const sibCenter = sibNodes.length
        ? (sibNodes[0].x + sibNodes[sibNodes.length - 1].x) / 2
        : GAP
      gpNode.x = sibCenter
      gpNode.y = TOP
    }
  }

  // Collect nodes
  const layoutNodes: LayoutNode[] = []
  if (gpNode) toNodes(gpNode, layoutNodes)
  for (const s of sibNodes) toNodes(s, layoutNodes)

  // Collect lines
  const layoutLines: LayoutLine[] = []

  // Grandparent → sibling bus
  if (gpNode?.ss) {
    const gfN = layoutNodes.find(n => n.id === gpNode.m.id)
    const gmN = layoutNodes.find(n => n.id === gpNode.ss!.id)
    if (gfN && gmN) {
      // Marriage
      layoutLines.push({
        x1: gfN.cx + gfN.r, y1: gfN.cy,
        x2: gmN.cx - gmN.r, y2: gmN.cy,
        type: 'marriage',
      })

      // Bus
      const midX = (gfN.cx + gmN.cx) / 2
      const busY = gfN.cy + R + 10

      layoutLines.push({ x1: midX, y1: gfN.cy, x2: midX, y2: busY, type: 'parent-child' })

      if (sibNodes.length > 1) {
        layoutLines.push({
          x1: sibNodes[0].x, y1: busY,
          x2: sibNodes[sibNodes.length - 1].x, y2: busY,
          type: 'parent-child',
        })
      }
      for (const s of sibNodes) {
        layoutLines.push({
          x1: s.x, y1: busY,
          x2: s.x, y2: s.y - s.r,
          type: 'parent-child',
        })
      }
    }
  }

  // Subtree lines
  for (const s of sibNodes) toLines(s, layoutLines, layoutNodes)

  // ViewBox
  let maxX = 0, maxY = 0
  for (const nd of layoutNodes) {
    maxX = Math.max(maxX, nd.cx + nd.r + 50)
    maxY = Math.max(maxY, nd.cy + nd.r + 80)
  }

  return {
    nodes: layoutNodes,
    lines: layoutLines,
    viewBox: { width: Math.max(maxX, 700), height: Math.max(maxY, 350) },
  }
}
