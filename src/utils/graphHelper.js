export function buildGraphData(flatMembers, centerId, depth = 3) {
  if (!flatMembers?.length) {
    return { nodes: [], links: [], lineageNodes: [], unrenderedLineage: [] };
  }

  const memberMap = new Map(flatMembers.map((m) => [m.id, m]));

  // 预计算子嗣索引（O(n) 替代 O(n²)）
  const childrenMap = new Map();
  flatMembers.forEach((m) => {
    if (m.father_id) {
      const list = childrenMap.get(m.father_id) || [];
      list.push(m.id);
      childrenMap.set(m.father_id, list);
    }
    if (m.mother_id) {
      const list = childrenMap.get(m.mother_id) || [];
      list.push(m.id);
      childrenMap.set(m.mother_id, list);
    }
  });
  const getChildren = (id) => childrenMap.get(id) || [];

  // BFS 标记直系血脉（不受 depth 限制）
  const lineageNodes = new Set();
  if (centerId && memberMap.has(centerId)) {
    const queue = [centerId];
    const visited = new Set();
    while (queue.length > 0) {
      const currentId = queue.shift();
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      lineageNodes.add(currentId);
      const member = memberMap.get(currentId);
      if (!member) continue;
      if (member.father_id) queue.push(member.father_id);
      if (member.mother_id) queue.push(member.mother_id);
      getChildren(currentId).forEach((cid) => queue.push(cid));
    }
  }

  // BFS 构图（depth 限制的视口）
  const visitedGraph = new Set();
  const queueGraph = [{ id: centerId || flatMembers[0]?.id, currentDepth: 0 }];
  const resultNodes = [];
  const resultLinks = [];
  const linkSet = new Set();

  while (queueGraph.length > 0) {
    const { id, currentDepth } = queueGraph.shift();
    if (visitedGraph.has(id) || currentDepth > depth) continue;
    visitedGraph.add(id);
    const member = memberMap.get(id);
    if (!member) continue;

    let category = "member";
    if (member.id === centerId) category = "center";
    else if (member.gender === 1) category = "male";
    else if (member.gender === 2) category = "female";

    resultNodes.push({
      id: member.id,
      name: member.name,
      category,
      symbolSize: member.id === centerId ? 60 : 40,
      isAlive: member.is_alive !== false,
      raw: member,
    });

    const neighborIds = new Set();
    if (member.father_id) neighborIds.add(member.father_id);
    if (member.mother_id) neighborIds.add(member.mother_id);
    if (member.spouse_id) neighborIds.add(member.spouse_id);
    getChildren(id).forEach((cid) => neighborIds.add(cid));

    neighborIds.forEach((neighborId) => {
      const key = [id, neighborId].sort().join("-");
      if (!linkSet.has(key)) {
        linkSet.add(key);
        // 区分关系类型：夫妻线（虚线/暖色）与血缘线（实线/金），用于图谱样式差异化
        let kind = "parent";
        if (neighborId === member.spouse_id) kind = "spouse";
        else if (
          neighborId === member.father_id ||
          neighborId === member.mother_id ||
          getChildren(id).includes(neighborId)
        )
          kind = "parent";
        resultLinks.push({
          source: id,
          target: neighborId,
          kind,
          isDirectLine: lineageNodes.has(id) && lineageNodes.has(neighborId),
        });
      }
      if (!visitedGraph.has(neighborId) && currentDepth + 1 <= depth) {
        queueGraph.push({ id: neighborId, currentDepth: currentDepth + 1 });
      }
    });
  }

  // 检测标记但未渲染的血脉节点
  const unrenderedLineage = [];
  for (const lid of lineageNodes) {
    if (!visitedGraph.has(lid)) unrenderedLineage.push(lid);
  }
  resultLinks.forEach((link) => {
    if (link.isDirectLine && unrenderedLineage.includes(link.target)) {
      link.showArrow = true;
    }
  });

  // 确定性层级布局：替掉纯力导向的随机排布，让"脉络"清晰且节点稳定不漂移。
  // 脉系视图以 centerId 为第 0 层（祖先在上、后代在下）；全局视图以首位先祖为根。
  const isLineage = !!centerId;
  const coords = computeLayout(resultNodes, memberMap, childrenMap, centerId, isLineage);
  resultNodes.forEach((n) => {
    const c = coords.get(n.id);
    if (c) {
      n.x = c.x;
      n.y = c.y;
    }
  });

  return {
    nodes: resultNodes,
    links: resultLinks,
    lineageNodes: [...lineageNodes],
    unrenderedLineage,
  };
}

// 按父链 BFS 计算代数（无父无母者为第 0 代，子代 +1，取最长路径）
function computeGenerations(memberMap, childrenMap) {
  const gen = new Map();
  const roots = [];
  memberMap.forEach((m, id) => {
    if (!m.father_id && !m.mother_id) roots.push(id);
  });
  const q = roots.map((id) => ({ id, g: 0 }));
  roots.forEach((id) => gen.set(id, 0));
  while (q.length) {
    const { id, g } = q.shift();
    (childrenMap.get(id) || []).forEach((cid) => {
      const ng = g + 1;
      if (!gen.has(cid) || ng > gen.get(cid)) {
        gen.set(cid, ng);
        q.push({ id: cid, g: ng });
      }
    });
  }
  // 无父无母且未在 roots 中（如仅通过配偶连入者）兜底为第 0 代
  memberMap.forEach((m, id) => {
    if (!gen.has(id)) gen.set(id, 0);
  });
  // 配偶代数对齐：无父无母但与有代数的配偶相连者，取配偶代数，使夫妻同层
  let changed = true;
  let guard = 0;
  while (changed && guard < 10) {
    changed = false;
    guard++;
    memberMap.forEach((m, id) => {
      if (!m.father_id && !m.mother_id && m.spouse_id && gen.has(m.spouse_id)) {
        const sg = gen.get(m.spouse_id);
        if (gen.get(id) !== sg) {
          gen.set(id, sg);
          changed = true;
        }
      }
    });
  }
  return gen;
}

// 同层排版：配偶相邻；center 居左首（不为"居中"而拆散夫妻对）
function orderRow(list, memberMap, centerId, centerAtMiddle) {
  const placed = new Set();
  const out = [];
  const pushWithSpouse = (node) => {
    if (placed.has(node.id)) return;
    placed.add(node.id);
    out.push(node);
    const sp = node.raw?.spouse_id;
    if (sp) {
      const spNode = list.find((x) => x.id === sp && !placed.has(x.id));
      if (spNode) {
        placed.add(spNode.id);
        out.push(spNode);
      }
    }
  };
  if (centerAtMiddle && centerId) {
    const c = list.find((x) => x.id === centerId);
    if (c) pushWithSpouse(c);
  }
  list.forEach((node) => pushWithSpouse(node));
  return out;
}

function computeLayout(resultNodes, memberMap, childrenMap, centerId, isLineage) {
  const gen = computeGenerations(memberMap, childrenMap);
  const genOfCenter = isLineage && centerId && gen.has(centerId) ? gen.get(centerId) : 0;
  const ROW = 220;
  const COL = 200;

  const byLevel = new Map();
  resultNodes.forEach((n) => {
    const g = gen.get(n.id) ?? 0;
    const level = isLineage ? g - genOfCenter : g;
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level).push(n);
  });

  const coords = new Map();
  byLevel.forEach((list, level) => {
    const ordered = orderRow(list, memberMap, centerId, level === 0 && isLineage);
    // 中心行（脉系视图的"我"所在代）：把 center 锚定在 x=0 作为焦点，
    // 其余节点（夫妻对/兄弟姐妹）向两侧铺开，保证夫妻始终相邻、center 不被夹在中间。
    const centerThisRow = level === 0 && isLineage && centerId;
    if (centerThisRow) {
      const ci = ordered.findIndex((n) => n.id === centerId);
      const left = ordered.slice(0, ci).reverse();
      const right = ordered.slice(ci + 1);
      coords.set(ordered[ci].id, { x: 0, y: level * ROW });
      let rx = COL;
      for (const n of right) {
        coords.set(n.id, { x: rx, y: level * ROW });
        rx += COL;
      }
      let lx = -COL;
      for (const n of left) {
        coords.set(n.id, { x: lx, y: level * ROW });
        lx -= COL;
      }
    } else {
      const n = ordered.length;
      ordered.forEach((node, i) => {
        coords.set(node.id, { x: (i - (n - 1) / 2) * COL, y: level * ROW });
      });
    }
  });
  return coords;
}
