import type { Member, LayoutNode, LayoutLine, TreeLayout } from '../utils/treeTypes'
import { SIZES } from '../utils/constants'

const R = SIZES.nodeRadius
const RR = SIZES.rootRadius
const GAP = SIZES.minEdgeGap
const TOP = 23
const ROW = SIZES.genHeight + R * 2 + 10

interface SGroup {
  spouse: Member
  order: number
  mtype: string
  kids: PNode[]
  w: number
  cx: number
}

interface PNode {
  m: Member
  gen: number
  root: boolean
  r: number
  sgs: SGroup[]
  ss?: Member
  skids: PNode[]
  w: number
  cx: number
  cy: number
  ssCx: number
}

const byId = (ms: Member[], id: string) => ms.find(m => m.id === id)
const kidsOfMom = (ms: Member[], dad: string, mom: string) =>
  ms.filter(m => m.fatherId === dad && m.motherId === mom)
const kidsOfDad = (ms: Member[], dad: string) =>
  ms.filter(m => m.fatherId === dad)

function kidsW(kids: PNode[]): number {
  if (!kids.length) return 0
  return kids.reduce((s, k, i) => s + k.w + (i ? GAP : 0), 0)
}

function build(m: Member, ms: Member[], gen: number, isRoot: boolean, seen: Set<string>): PNode {
  seen.add(m.id)
  const n: PNode = { m, gen, root: isRoot, r: isRoot ? RR : R, sgs: [], skids: [], w: 0, cx: 0, cy: 0, ssCx: 0 }
  const sps = (m.spouses || []).sort((a, b) => a.marriageOrder - b.marriageOrder)

  if (sps.length === 0) {
    for (const c of kidsOfDad(ms, m.id).filter(c => !seen.has(c.id)))
      n.skids.push(build(c, ms, gen + 1, false, seen))
  } else if (sps.length === 1) {
    const sp = byId(ms, sps[0].spouseId)
    if (sp && !seen.has(sp.id)) {
      seen.add(sp.id)
      n.ss = sp
      for (const c of kidsOfMom(ms, m.id, sp.id).filter(c => !seen.has(c.id)))
        n.skids.push(build(c, ms, gen + 1, false, seen))
    }
  } else {
    for (const rel of sps) {
      const sp = byId(ms, rel.spouseId)
      if (!sp || seen.has(sp.id)) continue
      seen.add(sp.id)
      const kids: PNode[] = []
      for (const c of kidsOfMom(ms, m.id, sp.id).filter(c => !seen.has(c.id)))
        kids.push(build(c, ms, gen + 1, false, seen))
      n.sgs.push({ spouse: sp, order: rel.marriageOrder, mtype: rel.marriageType, kids, w: 0, cx: 0 })
    }
  }
  return n
}

function calcW(n: PNode): void {
  for (const sg of n.sgs) for (const k of sg.kids) calcW(k)
  for (const k of n.skids) calcW(k)

  if (n.sgs.length > 0) {
    for (const sg of n.sgs) {
      sg.w = Math.max(R * 2 + GAP, kidsW(sg.kids))
    }
    const halfIdx = Math.ceil(n.sgs.length / 2)
    const leftW = n.sgs.slice(0, halfIdx).reduce((s, sg, i) => s + sg.w + (i ? GAP : 0), 0)
    const rightW = n.sgs.slice(halfIdx).reduce((s, sg, i) => s + sg.w + (i ? GAP : 0), 0)
    n.w = leftW + GAP + n.r * 2 + GAP + rightW + GAP * 2
  } else if (n.ss) {
    n.w = Math.max(n.r * 2 + GAP + R * 2, kidsW(n.skids)) + GAP
  } else if (n.skids.length) {
    n.w = Math.max(n.r * 2, kidsW(n.skids)) + GAP
  } else {
    n.w = n.r * 2 + GAP
  }
}

function placeKidsCentered(kids: PNode[], centerX: number): void {
  if (!kids.length) return
  const tw = kidsW(kids)
  let cx = centerX - tw / 2
  for (const k of kids) {
    place(k, cx)
    cx += k.w + GAP
  }
}

function place(n: PNode, left: number): void {
  n.cy = TOP + n.gen * ROW

  if (n.sgs.length > 0) {
    // ── Polygamy: wives split LEFT/RIGHT of husband ──
    const groups = n.sgs
    const halfIdx = Math.ceil(groups.length / 2)
    const leftWives = groups.slice(0, halfIdx)   // first half → left
    const rightWives = groups.slice(halfIdx)      // second half → right

    // Calculate widths
    const leftW = leftWives.reduce((s, sg, i) => s + sg.w + (i ? GAP : 0), 0)
    const rightW = rightWives.reduce((s, sg, i) => s + sg.w + (i ? GAP : 0), 0)
    const husbandW = n.r * 2

    // Total width = left wives + gap + husband + gap + right wives
    const totalW = leftW + (leftWives.length ? GAP : 0) + husbandW + (rightWives.length ? GAP : 0) + rightW
    const centerX = left + totalW / 2
    n.cx = centerX

    // Place left wives (right to left, closest to husband first)
    let cursor = centerX - husbandW / 2 - (leftWives.length ? GAP : 0) - leftW
    for (const sg of leftWives) {
      const groupCX = cursor + sg.w / 2
      if (sg.kids.length > 0) {
        placeKidsCentered(sg.kids, groupCX)
        sg.cx = (sg.kids[0].cx + sg.kids[sg.kids.length - 1].cx) / 2
      } else {
        sg.cx = groupCX
      }
      cursor += sg.w + GAP
    }

    // Place right wives (left to right, closest to husband first)
    cursor = centerX + husbandW / 2 + (rightWives.length ? GAP : 0)
    for (const sg of rightWives) {
      const groupCX = cursor + sg.w / 2
      if (sg.kids.length > 0) {
        placeKidsCentered(sg.kids, groupCX)
        sg.cx = (sg.kids[0].cx + sg.kids[sg.kids.length - 1].cx) / 2
      } else {
        sg.cx = groupCX
      }
      cursor += sg.w + GAP
    }

    // Post-placement: expand n.w if any node extends beyond allocated width
    let maxRight = left + n.w
    const checkNodes = (nodes: PNode[]) => {
      for (const k of nodes) {
        maxRight = Math.max(maxRight, k.cx + k.r + GAP)
        checkNodes(k.skids)
        for (const sg2 of k.sgs) checkNodes(sg2.kids)
      }
    }
    for (const sg of n.sgs) checkNodes(sg.kids)
    n.w = Math.max(n.w, maxRight - left)
  } else if (n.ss) {
    const coupleW = n.r * 2 + GAP + R * 2
    const childrenW = kidsW(n.skids)
    const totalW = Math.max(coupleW, childrenW)
    const centerX = left + totalW / 2
    n.cx = centerX - (GAP / 2 + R)
    n.ssCx = centerX + (GAP / 2 + R)
    placeKidsCentered(n.skids, (n.cx + n.ssCx) / 2)
  } else {
    n.cx = left + n.w / 2
    placeKidsCentered(n.skids, n.cx)
  }
}

function toNodes(n: PNode, out: LayoutNode[]): void {
  out.push({ id: n.m.id, name: n.m.name, cx: n.cx, cy: n.cy, r: n.r, gender: n.m.gender, isRoot: n.root, birthYear: n.m.birthYear, deathYear: n.m.deathYear })
  if (n.ss) {
    out.push({ id: n.ss.id, name: n.ss.name, cx: n.ssCx, cy: n.cy, r: R, gender: n.ss.gender, birthYear: n.ss.birthYear, deathYear: n.ss.deathYear })
  }
  for (const sg of n.sgs) {
    out.push({ id: sg.spouse.id, name: sg.spouse.name, cx: sg.cx, cy: n.cy, r: R, gender: sg.spouse.gender, birthYear: sg.spouse.birthYear, deathYear: sg.spouse.deathYear })
  }
  for (const k of n.skids) toNodes(k, out)
  for (const sg of n.sgs) for (const k of sg.kids) toNodes(k, out)
}

function toLines(n: PNode, out: LayoutLine[], nodes: LayoutNode[]): void {
  const nN = nodes.find(nd => nd.id === n.m.id)!

  if (n.ss) {
    const wN = nodes.find(nd => nd.id === n.ss!.id)!
    out.push({ x1: nN.cx + nN.r, y1: nN.cy, x2: wN.cx - wN.r, y2: wN.cy, type: 'marriage' })
    if (n.skids.length) {
      const midX = (nN.cx + wN.cx) / 2
      const busY = nN.cy + Math.max(nN.r, wN.r) + 10
      out.push({ x1: midX, y1: nN.cy, x2: midX, y2: busY, type: 'parent-child' })
      if (n.skids.length > 1)
        out.push({ x1: n.skids[0].cx, y1: busY, x2: n.skids[n.skids.length - 1].cx, y2: busY, type: 'parent-child' })
      for (const k of n.skids)
        out.push({ x1: k.cx, y1: busY, x2: k.cx, y2: k.cy - k.r, type: 'parent-child' })
    }
  }

  for (const sg of n.sgs) {
    const wN = nodes.find(nd => nd.id === sg.spouse.id)
    if (!wN) continue
    if (wN.cx < nN.cx) {
      out.push({ x1: wN.cx + wN.r, y1: wN.cy, x2: nN.cx - nN.r, y2: nN.cy, type: 'marriage' })
    } else {
      out.push({ x1: nN.cx + nN.r, y1: nN.cy, x2: wN.cx - wN.r, y2: wN.cy, type: 'marriage' })
    }
    if (sg.kids.length) {
      const busY = wN.cy + R + 10
      out.push({ x1: wN.cx, y1: wN.cy + R, x2: wN.cx, y2: busY, type: 'parent-child' })
      if (sg.kids.length > 1)
        out.push({ x1: sg.kids[0].cx, y1: busY, x2: sg.kids[sg.kids.length - 1].cx, y2: busY, type: 'parent-child' })
      for (const k of sg.kids)
        out.push({ x1: k.cx, y1: busY, x2: k.cx, y2: k.cy - k.r, type: 'parent-child' })
    }
  }

  for (const k of n.skids) toLines(k, out, nodes)
  for (const sg of n.sgs) for (const k of sg.kids) toLines(k, out, nodes)
}

export function useTreeLayout(members: Member[], rootId: string): TreeLayout {
  const root = byId(members, rootId)
  if (!root) throw new Error(`Root ${rootId} not found`)

  const seen = new Set<string>()
  const siblings = root.fatherId
    ? kidsOfDad(members, root.fatherId).filter(c => !seen.has(c.id))
    : [root]

  const sibNodes: PNode[] = []
  for (const s of siblings) {
    if (seen.has(s.id)) continue
    sibNodes.push(build(s, members, 1, s.id === rootId, seen))
  }

  for (const s of sibNodes) calcW(s)

  let cursor = GAP
  for (const s of sibNodes) {
    place(s, cursor)
    cursor += s.w + GAP
  }

  let gpNode: PNode | null = null
  if (root.fatherId) {
    const gp = byId(members, root.fatherId)
    if (gp) {
      gpNode = build(gp, members, 0, false, seen)
      calcW(gpNode)
      const sibCenter = sibNodes.length
        ? (sibNodes[0].cx + sibNodes[sibNodes.length - 1].cx) / 2
        : GAP
      if (gpNode.ss) {
        gpNode.cx = sibCenter - (GAP / 2 + R)
        gpNode.ssCx = sibCenter + (GAP / 2 + R)
      } else {
        gpNode.cx = sibCenter
      }
      gpNode.cy = TOP
    }
  }

  const layoutNodes: LayoutNode[] = []
  if (gpNode) toNodes(gpNode, layoutNodes)
  for (const s of sibNodes) toNodes(s, layoutNodes)

  const layoutLines: LayoutLine[] = []
  if (gpNode?.ss) {
    const gfN = layoutNodes.find(n => n.id === gpNode.m.id)
    const gmN = layoutNodes.find(n => n.id === gpNode.ss!.id)
    if (gfN && gmN) {
      layoutLines.push({ x1: gfN.cx + gfN.r, y1: gfN.cy, x2: gmN.cx - gmN.r, y2: gmN.cy, type: 'marriage' })
      const midX = (gfN.cx + gmN.cx) / 2
      const busY = gfN.cy + R + 10
      layoutLines.push({ x1: midX, y1: gfN.cy, x2: midX, y2: busY, type: 'parent-child' })
      if (sibNodes.length > 1)
        layoutLines.push({ x1: sibNodes[0].cx, y1: busY, x2: sibNodes[sibNodes.length - 1].cx, y2: busY, type: 'parent-child' })
      for (const s of sibNodes)
        layoutLines.push({ x1: s.cx, y1: busY, x2: s.cx, y2: s.cy - s.r, type: 'parent-child' })
    }
  }
  for (const s of sibNodes) toLines(s, layoutLines, layoutNodes)

  let maxX = 0, maxY = 0
  for (const nd of layoutNodes) {
    maxX = Math.max(maxX, nd.cx + nd.r + 60)
    maxY = Math.max(maxY, nd.cy + nd.r + 80)
  }

  return { nodes: layoutNodes, lines: layoutLines, viewBox: { width: Math.max(maxX, 700), height: Math.max(maxY, 350) } }
}
