// elbowGraph.js —— 纯 SVG 族谱图模型构建（无 Vue / ECharts 依赖）
// 从定稿原型 gen_elbow.mjs 提炼，供 FamilyGraph.vue 与 Node 测试共用，
// 保证「原型即代码」、逻辑零漂移。
//
// 输出：
//   buildElbowGraph(graphData, allMembers, opts) →
//     { edges, nodes, rels, viewBox, bounds, labelOf }
// 高亮判据（纯函数，作用于 rels）：
//   computeH(rels, id)        脉络集 = {选中} ∪ 祖先 ∪ 后代 ∪ 配偶
//   fullSiblings(rels, id)    同父同母兄弟姐妹
//   computeVisible(rels, id)  可见集 = computeH ∪ fullSiblings（节点/连线是否淡化以此为准）
//
// 连线高亮规则：
//   金线 gold  ⇔ 连线两端节点都在 H
//   淡化 dim   ⇔ 连线任一端节点不在 V

import { computeGenerationMap, kinshipTerm } from "./graphHelper.js";

// 与定稿原型一致的放大系数（COL=160→256，ROW=220→352）
export const ELBOW_SCALE = 1.6;
const S = ELBOW_SCALE;
// 节点视觉半径（世界坐标）
export const NODE_R = 22;
// 内容四周留白（世界坐标）
const PAD = 70;

function childrenIndex(allMembers) {
  const map = new Map();
  allMembers.forEach((m) => {
    if (m.father_id) {
      const l = map.get(m.father_id) || [];
      l.push(m.id);
      map.set(m.father_id, l);
    }
    if (m.mother_id) {
      const l = map.get(m.mother_id) || [];
      l.push(m.id);
      map.set(m.mother_id, l);
    }
  });
  return map;
}

// ── 高亮判据 ────────────────────────────────────────────────────────────
export function computeH(rels, id) {
  const H = new Set([id]);
  // 向上：祖先
  let st = [id];
  while (st.length) {
    const c = st.pop();
    const r = rels[c];
    if (!r) continue;
    r.parents.forEach((p) => {
      if (!H.has(p)) {
        H.add(p);
        st.push(p);
      }
    });
  }
  // 向下：后代
  st = [id];
  while (st.length) {
    const c = st.pop();
    const r = rels[c];
    if (!r) continue;
    r.children.forEach((ch) => {
      if (!H.has(ch)) {
        H.add(ch);
        st.push(ch);
      }
    });
  }
  // 配偶：选中者本人 + 所有血脉成员的配偶。
  // 后代的垂落支连线端点含其配偶父母（如外甥女的生父=姐夫），
  // 必须把这部分配偶也纳入 H，金线才能连续连到孙辈，避免"节点亮着却无金线"。
  for (const cur of [...H]) {
    const sp = rels[cur] && rels[cur].spouse;
    if (sp) H.add(sp);
  }
  return H;
}

// 同父同母兄弟姐妹：选中一方时，另一方仍可见、不淡化
export function fullSiblings(rels, id) {
  const me = rels[id];
  if (!me || me.parents.length < 2) return [];
  const [f, m] = me.parents;
  const out = [];
  for (const [nid, r] of Object.entries(rels)) {
    if (nid === id) continue;
    if (r.parents.length === 2 && r.parents.includes(f) && r.parents.includes(m))
      out.push(nid);
  }
  return out;
}

// 可见集 = 脉络 H ∪ 同父同母兄弟姐妹
export function computeVisible(rels, id) {
  const V = computeH(rels, id);
  fullSiblings(rels, id).forEach((s) => V.add(s));
  return V;
}

// ── 主构建 ──────────────────────────────────────────────────────────────
export function buildElbowGraph(graphData, allMembers, opts = {}) {
  const { isLineage = false, myMemberId = null } = opts;
  const nodes = graphData.nodes || [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const memberMap = new Map(allMembers.map((m) => [m.id, m]));
  const childrenMap = childrenIndex(allMembers);

  // 称谓上下文
  const me = myMemberId ? memberMap.get(myMemberId) : null;
  const genMap = computeGenerationMap(allMembers);
  const myChildren = me
    ? allMembers.filter((c) => c.father_id === me.id || c.mother_id === me.id)
    : [];
  const mySiblings = me
    ? allMembers.filter(
        (s) =>
          (s.father_id && s.father_id === me.father_id) ||
          (s.mother_id && s.mother_id === me.mother_id)
      )
    : [];
  const ctx = { byId: memberMap, genMap, myChildren, mySiblings };

  const relLabel = (node) => {
    if (node.id === myMemberId)
      return isLineage ? "我" : `我·第${genMap.get(node.id) + 1}代`;
    if (!isLineage) return `第${genMap.get(node.id) + 1}代`;
    return me
      ? kinshipTerm(me, node.raw || memberMap.get(node.id), ctx)
      : node.category === "female"
        ? "女"
        : "男";
  };

  // 世界坐标（已放大）
  const scaledNodes = nodes.map((n) => ({
    id: n.id,
    name: n.name,
    category: n.category,
    gender: n.raw?.gender ?? (n.category === "female" ? 2 : 1),
    isAlive: n.isAlive,
    isMe: n.id === myMemberId,
    x: n.x * S,
    y: n.y * S,
    label: relLabel(n),
  }));

  // 内容边界（世界坐标）
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  scaledNodes.forEach((n) => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x);
    maxY = Math.max(maxY, n.y);
  });
  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }
  const bounds = {
    minX: minX - PAD,
    minY: minY - PAD,
    maxX: maxX + PAD,
    maxY: maxY + PAD,
  };
  const viewBox = `${bounds.minX} ${bounds.minY} ${bounds.maxX - bounds.minX} ${
    bounds.maxY - bounds.minY
  }`;

  // ── 肘形总线：把每个生育单元（父亲|母亲 → 子女集合）归并为一条 ──
  const unitMap = new Map();
  nodes.forEach((n) => {
    const m = memberMap.get(n.id);
    if (!m) return;
    const f = m.father_id,
      mo = m.mother_id;
    if ((!f || !nodeById.has(f)) && (!mo || !nodeById.has(mo))) return;
    const key = [f || "_", mo || "_"].join("|");
    if (!unitMap.has(key)) unitMap.set(key, { parents: new Set(), children: new Set() });
    const u = unitMap.get(key);
    if (f && nodeById.has(f)) u.parents.add(f);
    if (mo && nodeById.has(mo)) u.parents.add(mo);
    u.children.add(n.id);
  });

  const edges = [];
  unitMap.forEach((u) => {
    if (u.children.size === 0) return;
    const parents = [...u.parents].map((id) => nodeById.get(id));
    const children = [...u.children]
      .map((id) => nodeById.get(id))
      .sort((a, b) => a.x * S - b.x * S);
    const parentY = Math.max(...parents.map((p) => p.y * S));
    const childY = Math.min(...children.map((c) => c.y * S));
    const xm = parents.length === 2 ? (parents[0].x + parents[1].x) / 2 : parents[0].x;
    const busY = (parentY + childY) / 2;
    const XM = xm * S;
    const PYp = parentY;
    const BYp = busY;
    const CYp = childY;
    const parentIds = [...u.parents];
    const leftX = children[0].x * S;
    const rightX = children[children.length - 1].x * S;
    // 干线：父母中点垂直下到横向脊高度
    edges.push({ d: `M ${XM} ${PYp} L ${XM} ${BYp}`, nodes: parentIds, kind: "trunk" });
    // 连续水平脊：左段[最左子女↔XM]属最左子女，右段[XM↔最右子女]属最右子女（视觉相连，避免断桩错觉）
    edges.push({
      d: `M ${leftX} ${BYp} L ${XM} ${BYp}`,
      nodes: [children[0].id, ...parentIds],
      kind: "spine",
    });
    if (children.length > 1)
      edges.push({
        d: `M ${XM} ${BYp} L ${rightX} ${BYp}`,
        nodes: [children[children.length - 1].id, ...parentIds],
        kind: "spine",
      });
    // 每个子女的垂落支
    children.forEach((c) => {
      edges.push({
        d: `M ${c.x * S} ${BYp} L ${c.x * S} ${CYp}`,
        nodes: [c.id, ...parentIds],
        kind: "bus",
      });
    });
  });

  // 婚姻线：同层水平实线（墨米色；属直系脉络时随金）
  allMembers.forEach((m) => {
    const a = nodeById.get(m.id);
    const b = m.spouse_id && nodeById.get(m.spouse_id);
    // 去重：对称夫妻（双方互指 spouse_id）只画一次；非对称关系
    // （如一夫多妻时仅妻指夫、夫字段留空）也确保恰好画一次——
    // 只要对方未反向指回本节点，或本节点 id 较小即画。
    if (a && b && (b.spouse_id !== m.id || m.id < b.id)) {
      edges.push({
        d: `M ${a.x * S} ${a.y * S} L ${b.x * S} ${b.y * S}`,
        nodes: [a.id, b.id],
        kind: "marriage",
      });
    }
  });

  // 高亮用关系索引（仅当前视口内的节点）
  const rels = {};
  nodes.forEach((n) => {
    const m = memberMap.get(n.id);
    rels[n.id] = {
      parents: [m.father_id, m.mother_id].filter((id) => id && nodeById.has(id)),
      children: (childrenMap.get(n.id) || []).filter((id) => nodeById.has(id)),
      spouse: m.spouse_id && nodeById.has(m.spouse_id) ? m.spouse_id : null,
    };
  });

  const labelOf = Object.fromEntries(scaledNodes.map((n) => [n.id, n.label]));

  return { edges, nodes: scaledNodes, rels, viewBox, bounds, labelOf, isLineage, myMemberId };
}
