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
  spouseSide?: 'left' | 'right' // 配偶排布方向（非独生子女时配偶在外侧）
}

const byId = (ms: Member[], id: string) => ms.find(m => m.id === id)
// 夫妻组合的子女：不限性别角色（father/mother 任一匹配两人即可）
const kidsOfCouple = (ms: Member[], a: string, b: string) =>
  ms.filter(m => (m.fatherId === a && m.motherId === b) || (m.fatherId === b && m.motherId === a))
// 单亲的子女：该成员是父亲或母亲
const kidsOfSingle = (ms: Member[], id: string) =>
  ms.filter(m => m.fatherId === id || m.motherId === id)

function kidsW(kids: PNode[]): number {
  if (!kids.length) return 0
  return kids.reduce((s, k, i) => s + k.w + (i ? GAP : 0), 0)
}

function build(m: Member, ms: Member[], gen: number, isRoot: boolean, seen: Set<string>): PNode {
  seen.add(m.id)
  const n: PNode = { m, gen, root: isRoot, r: isRoot ? RR : R, sgs: [], skids: [], w: 0, cx: 0, cy: 0, ssCx: 0 }
  const sps = (m.spouses || []).sort((a, b) => a.marriageOrder - b.marriageOrder)

  if (sps.length === 0) {
    const kids = kidsOfSingle(ms, m.id).filter(c => !seen.has(c.id))
    if (kids.length > 0) {
      // 有子女但无配偶：创建“未记载”占位配偶，使子女连线挂到双亲
      n.ss = {
        id: m.id + '__placeholder',
        name: '未记载',
        gender: m.gender === 1 ? 2 : 1,
        isAlive: false,
        spouses: [],
        isPlaceholder: true,
      }
    }
    for (const c of kids)
      n.skids.push(build(c, ms, gen + 1, false, seen))
  } else if (sps.length === 1) {
    const sp = byId(ms, sps[0].spouseId)
    if (sp && !seen.has(sp.id)) {
      seen.add(sp.id)
      n.ss = sp
      for (const c of kidsOfCouple(ms, m.id, sp.id).filter(c => !seen.has(c.id)))
        n.skids.push(build(c, ms, gen + 1, false, seen))
    }
  } else {
    for (const rel of sps) {
      const sp = byId(ms, rel.spouseId)
      if (!sp || seen.has(sp.id)) continue
      seen.add(sp.id)
      const kids: PNode[] = []
      for (const c of kidsOfCouple(ms, m.id, sp.id).filter(c => !seen.has(c.id)))
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
  // 已婚独生子女：本人（血亲后代）居中于父母中点，配偶排右侧，使连线直指本人、明确子女身份
  if (kids.length === 1) {
    const k = kids[0]
    if (k.ss) {
      place(k, centerX + (GAP / 2 + R) - (k.w - GAP) / 2)
    } else {
      place(k, centerX - k.w / 2)
    }
    return
  }
  const tw = kidsW(kids)
  let cx = centerX - tw / 2
  const midIdx = kids.length / 2
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i]
    // 非独生子女：左半侧的子女其配偶排左侧（外侧），右半侧排右侧（外侧）
    if (k.ss && kids.length > 1) {
      k.spouseSide = i < midIdx ? 'left' : 'right'
    }
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
        // Check single spouse position
        if (k.ss) maxRight = Math.max(maxRight, k.ssCx + R + GAP)
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
    if (n.spouseSide === 'left') {
      // 配偶在外侧（左），人物在右
      n.ssCx = centerX - (GAP / 2 + R)
      n.cx = centerX + (GAP / 2 + R)
    } else {
      // 默认：人物在左，配偶在右
      n.cx = centerX - (GAP / 2 + R)
      n.ssCx = centerX + (GAP / 2 + R)
    }
    placeKidsCentered(n.skids, (n.cx + n.ssCx) / 2)
  } else {
    n.cx = left + n.w / 2
    placeKidsCentered(n.skids, n.cx)
  }
}

function toNodes(n: PNode, out: LayoutNode[]): void {
  out.push({ id: n.m.id, name: n.m.name, cx: n.cx, cy: n.cy, r: n.r, gender: n.m.gender, isRoot: n.root, birthYear: n.m.birthYear, deathYear: n.m.deathYear })
  if (n.ss) {
    out.push({ id: n.ss.id, name: n.ss.name, cx: n.ssCx, cy: n.cy, r: R, gender: n.ss.gender, isPlaceholder: n.ss.isPlaceholder, birthYear: n.ss.birthYear, deathYear: n.ss.deathYear })
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
    // 婚姻线只在两圆边缘之间绘制，需适配配偶在左/右两种方向
    if (wN.cx < nN.cx) {
      out.push({ x1: wN.cx + wN.r, y1: wN.cy, x2: nN.cx - nN.r, y2: nN.cy, type: 'marriage' })
    } else {
      out.push({ x1: nN.cx + nN.r, y1: nN.cy, x2: wN.cx - wN.r, y2: wN.cy, type: 'marriage' })
    }
    if (n.skids.length) {
      const midX = (nN.cx + wN.cx) / 2
      if (n.skids.length === 1 && n.skids[0].ss) {
        // 已婚独生子女：垂线从父母中点直达子女本人节点顶部，明确指向血亲后代
        const k = n.skids[0]
        out.push({ x1: midX, y1: nN.cy, x2: midX, y2: k.cy - k.r, type: 'parent-child' })
      } else {
        const busY = nN.cy + Math.max(nN.r, wN.r) + 10
        out.push({ x1: midX, y1: nN.cy, x2: midX, y2: busY, type: 'parent-child' })
        // 横线总线连接父中点与所有子女（含未婚独生子女偏移的情况，保证连线不断裂）
        const kidXs = n.skids.map(k => k.cx)
        const busLeft = Math.min(midX, ...kidXs)
        const busRight = Math.max(midX, ...kidXs)
        if (busRight > busLeft)
          out.push({ x1: busLeft, y1: busY, x2: busRight, y2: busY, type: 'parent-child' })
        for (const k of n.skids)
          out.push({ x1: k.cx, y1: busY, x2: k.cx, y2: k.cy - k.r, type: 'parent-child' })
      }
    }
  }

  // ── 多妻婚姻线：按相邻圆圈逐段连接成链，避免穿过中间妻子圆圈 ──
  const wifeNodes = n.sgs
    .map(sg => nodes.find(nd => nd.id === sg.spouse.id))
    .filter((w): w is LayoutNode => !!w)
  // 左侧妻子：由内（近夫）到外排序
  const leftWives = wifeNodes.filter(w => w.cx < nN.cx).sort((a, b) => b.cx - a.cx)
  // 右侧妻子：由内（近夫）到外排序
  const rightWives = wifeNodes.filter(w => w.cx > nN.cx).sort((a, b) => a.cx - b.cx)

  // 左链：夫左缘 ← 内妻右缘，内妻左缘 ← 外妻右缘 …
  let prevRightEdge = nN.cx - nN.r
  for (const w of leftWives) {
    out.push({ x1: w.cx + w.r, y1: nN.cy, x2: prevRightEdge, y2: nN.cy, type: 'marriage' })
    prevRightEdge = w.cx - w.r
  }
  // 右链：夫右缘 → 内妻左缘，内妻右缘 → 外妻左缘 …
  let prevLeftEdge = nN.cx + nN.r
  for (const w of rightWives) {
    out.push({ x1: prevLeftEdge, y1: nN.cy, x2: w.cx - w.r, y2: nN.cy, type: 'marriage' })
    prevLeftEdge = w.cx + w.r
  }

  // 子女连线（从各妻子正下方垂直展开）
  for (const sg of n.sgs) {
    const wN = nodes.find(nd => nd.id === sg.spouse.id)
    if (!wN) continue
    if (sg.kids.length) {
      const busY = wN.cy + R + 10
      out.push({ x1: wN.cx, y1: wN.cy + R, x2: wN.cx, y2: busY, type: 'parent-child' })
      // 横线总线连接妻子中点与所有子女（含独生子女偏移）
      const kidXs = sg.kids.map(k => k.cx)
      const busLeft = Math.min(wN.cx, ...kidXs)
      const busRight = Math.max(wN.cx, ...kidXs)
      if (busRight > busLeft)
        out.push({ x1: busLeft, y1: busY, x2: busRight, y2: busY, type: 'parent-child' })
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
    ? kidsOfSingle(members, root.fatherId).filter(c => !seen.has(c.id))
    : [root]

  const sibNodes: PNode[] = []
  for (const s of siblings) {
    if (seen.has(s.id)) continue
    sibNodes.push(build(s, members, 1, s.id === rootId, seen))
  }

  for (const s of sibNodes) calcW(s)

  let cursor = GAP
  const sibMid = sibNodes.length / 2
  for (let i = 0; i < sibNodes.length; i++) {
    const s = sibNodes[i]
    // 非独生子女：根节点的兄弟姐妹也遵循配偶外侧规则
    if (s.ss && sibNodes.length > 1) {
      s.spouseSide = i < sibMid ? 'left' : 'right'
    }
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
