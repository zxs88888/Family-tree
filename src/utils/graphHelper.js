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
  // 种子：脉系视图从 centerId 出发（只看其连通血缘）；
  // 全局视图（无 centerId）从所有成员出发，覆盖全部连通分量，
  // 避免多个互不连通的子族只渲染其中一个（如树森支与永康支未连通时）。
  const seedIds = centerId
    ? [centerId]
    : flatMembers.map((m) => m.id);
  const queueGraph = seedIds.map((id) => ({ id, currentDepth: 0 }));
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

    // 性能：node.raw 只保留渲染/称谓所需字段，避免把 biography 等大字段
    // 内联进每个节点导致 ECharts option 随人数膨胀。点击时由 store 按 id 取全量成员。
    resultNodes.push({
      id: member.id,
      name: member.name,
      category,
      symbolSize: member.id === centerId ? 60 : 40,
      isAlive: member.is_alive !== false,
      raw: {
        id: member.id,
        name: member.name,
        gender: member.gender,
        birth_year: member.birth_year,
        is_alive: member.is_alive,
        father_id: member.father_id,
        mother_id: member.mother_id,
        spouse_id: member.spouse_id,
      },
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

  // 确定性层级布局：视图无关的整齐树（男左女右、子女垂直对齐父母、配偶挂外侧（远离同代血亲中心））。
  // 两种视图仅做纯平移（脉系：我居中；全局：整树居中），相对位置完全一致。
  const coords = computeLayout(resultNodes, memberMap, childrenMap, centerId);
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

// 对外：直接计算 成员id -> 代次 的映射（根代=0）。供图谱副标（全局视图「第N代」）与称谓兜底复用。
export function computeGenerationMap(flatMembers) {
  const memberMap = new Map(flatMembers.map((m) => [m.id, m]));
  const childrenMap = new Map();
  flatMembers.forEach((m) => {
    if (m.father_id) {
      const l = childrenMap.get(m.father_id) || [];
      l.push(m.id);
      childrenMap.set(m.father_id, l);
    }
    if (m.mother_id) {
      const l = childrenMap.get(m.mother_id) || [];
      l.push(m.id);
      childrenMap.set(m.mother_id, l);
    }
  });
  return computeGenerations(memberMap, childrenMap);
}

// 真实亲属称谓：相对「我」(me) 计算 node 的汉语称谓，彻底替代原先笼统的「男/女/族亲」占位。
// ctx = { byId, genMap, myChildren, mySiblings } 由调用方预计算一次，避免逐节点重复建索引。
// 覆盖：配偶/父母/子女/兄弟姐妹/祖辈/孙辈/侄·外甥（兄弟姐妹之子女）/姻亲（兄弟姐妹配偶、配偶父母、子女配偶）。
// 兜底按世代差（祖辈/父辈/同辈/子辈/孙辈），保证任何节点都有明确、非占位的称谓。
export function kinshipTerm(me, node, ctx) {
  if (!me || !node) return "";
  if (node.id === me.id) return "我";
  if (node.id === me.spouse_id) return "配偶";
  if (node.id === me.father_id || node.id === me.mother_id) return "父母";
  if (me.id === node.father_id || me.id === node.mother_id) return "子女";
  const sameFather = me.father_id && node.father_id === me.father_id;
  const sameMother = me.mother_id && node.mother_id === me.mother_id;
  if (sameFather || sameMother) {
    // 区分长幼：出生年早者为兄/姐（数据来自导入表的出生年龄）
    const hasYear = me.birth_year != null && node.birth_year != null;
    const older = hasYear && node.birth_year < me.birth_year;
    if (node.gender === 2) return hasYear ? (older ? "姐姐" : "妹妹") : "姐妹";
    if (node.gender === 1) return hasYear ? (older ? "哥哥" : "弟弟") : "兄弟";
    return "兄弟姐妹";
  }
  const { byId, genMap, myChildren, mySiblings } = ctx;
  const isGrandparent =
    (me.father_id &&
      (node.id === byId.get(me.father_id)?.father_id ||
        node.id === byId.get(me.father_id)?.mother_id)) ||
    (me.mother_id &&
      (node.id === byId.get(me.mother_id)?.father_id ||
        node.id === byId.get(me.mother_id)?.mother_id));
  if (isGrandparent) return "祖辈";
  if (myChildren.some((ch) => node.father_id === ch.id || node.mother_id === ch.id)) return "孙辈";
  const parentSibling = mySiblings.find((s) => node.father_id === s.id || node.mother_id === s.id);
  if (parentSibling) {
    const base = parentSibling.gender === 2 ? "外甥" : "侄";
    return node.gender === 2 ? base + "女" : base;
  }
  // 堂/表亲：与我同代，且其父/母与我父/母是亲兄弟姐妹。
  //   堂 = 双方父亲为亲兄弟（同宗同姓）；其余（姑/舅/姨之子女）皆表。
  const myFather = me.father_id ? byId.get(me.father_id) : null;
  const myMother = me.mother_id ? byId.get(me.mother_id) : null;
  const nodeFather = node.father_id ? byId.get(node.father_id) : null;
  const nodeMother = node.mother_id ? byId.get(node.mother_id) : null;
  const sis = (a, b) =>
    a && b && (a.father_id === b.father_id || a.mother_id === b.mother_id || a.father_id === b.mother_id || a.mother_id === b.father_id);
  const hasYear = me.birth_year != null && node.birth_year != null;
  const older = hasYear && node.birth_year < me.birth_year;
  const cousinLabel = (tang) => {
    const base = tang ? "堂" : "表";
    if (node.gender === 1) return hasYear ? (older ? base + "哥" : base + "弟") : base + "兄弟";
    return hasYear ? (older ? base + "姐" : base + "妹") : base + "姐妹";
  };
  if (myFather && nodeFather && sis(myFather, nodeFather)) return cousinLabel(true); // 堂
  if (
    (myFather && sis(myFather, nodeMother)) ||
    (myMother && sis(myMother, nodeFather)) ||
    (myMother && sis(myMother, nodeMother))
  )
    return cousinLabel(false); // 表
  // 姻亲：配偶的父母 / 子女的配偶（女婿·儿媳）/ 兄弟姐妹的配偶（姐夫·妹夫·嫂子·弟妹）
  if (me.spouse_id) {
    const sp = byId.get(me.spouse_id);
    if (sp && (node.id === sp.father_id || node.id === sp.mother_id)) return "姻亲";
  }
  const myChildSpouse = myChildren.find((ch) => node.id === ch.spouse_id);
  if (myChildSpouse) return myChildSpouse.gender === 2 ? "女婿" : "儿媳";
  const sib = mySiblings.find((s) => node.id === s.spouse_id);
  if (sib) {
    const hasYear = me.birth_year != null && sib.birth_year != null;
    const sibOlder = hasYear && sib.birth_year < me.birth_year;
    if (sib.gender === 2) return hasYear ? (sibOlder ? "姐夫" : "妹夫") : "姐夫/妹夫";
    return hasYear ? (sibOlder ? "嫂子" : "弟妹") : "嫂子/弟妹";
  }
  // 兜底：世代差（同一家族内总能算出相对代次）
  const gm = genMap.get(me.id) ?? 0;
  const gn = genMap.get(node.id) ?? 0;
  const d = gn - gm;
  if (d <= -2) return "祖辈";
  if (d === -1) return "父辈";
  if (d === 0) return "同辈";
  if (d === 1) return "子辈";
  return "孙辈";
}

// 视图无关的整齐树布局（见 computeLayout）。旧的 orderRow 已废弃。

function computeLayout(resultNodes, memberMap, childrenMap, centerId) {
  // ── 视图无关的整齐树布局 ──────────────────────────────────────────────
  // 规则（用户明确）：
  //  1) 男左女右：同一父母下的子女，男性在左、女性在右。
  //  2) 第二代节点垂直对齐第一代：2 子→分别位于对应父母正下方；1 子→父母下方居中；
  //     3+ 子→整代等距、整齐对称。
  //  3) 配偶挂在外侧：已婚入者（姐夫/嫂子等）挂在配偶远离同代血亲中心的一侧（我在左→妻在我左；姐在右→夫在姐右）；根代夫妻按男左女右。
  //  4) 两种视图仅做纯平移（脉系=我居中 / 全局=整树居中），相对位置完全一致。
  // 实现：世代为行(y)、列为 x；子女继承父母所在列（形成垂直直线），同代按
  // "男左女右"排序；夫妻占相邻两列；同代列占用用 genCols 去重防重叠。
  const gen = computeGenerations(memberMap, childrenMap);
  const ROW = 220; // 世代行高
  const COL = 160; // 单个人列宽

  const coords = new Map();
  const genCols = new Map(); // 每代已占用列（去重防重叠）
  const occ = (lvl, x) => (genCols.get(lvl) || []).includes(x);
  const reserve = (lvl, x) => {
    if (!genCols.has(lvl)) genCols.set(lvl, []);
    genCols.get(lvl).push(x);
  };
  // 从 preferred 向两侧就近找空列（半列步进，保证夫妻可紧邻）
  const nearestFree = (lvl, preferred) => {
    let d = 0;
    while (true) {
      const cands = d === 0 ? [preferred] : [preferred - d, preferred + d];
      for (const c of cands) {
        if (!occ(lvl, c)) {
          reserve(lvl, c);
          return c;
        }
      }
      d += COL / 2;
      if (d > 100000) return preferred + d; // 安全阀
    }
  };

  const spouseOf = (id) => {
    const m = memberMap.get(id);
    return m?.spouse_id && memberMap.has(m.spouse_id) ? m.spouse_id : null;
  };
  // 取"主血缘父/母"：优先父亲，其次母亲（用于把子女挂到单一树父节点）
  const bloodParentOf = (m) => {
    if (!m) return null;
    if (m.father_id && memberMap.has(m.father_id)) return memberMap.get(m.father_id);
    if (m.mother_id && memberMap.has(m.mother_id)) return memberMap.get(m.mother_id);
    return null;
  };
  // 已婚入者：无父母，但配偶有父母（即嫁/赘入本族）
  const isMarriedIn = (id) => {
    const m = memberMap.get(id);
    if (!m || m.father_id || m.mother_id) return false;
    const sp = spouseOf(id);
    if (!sp) return false;
    const sm = memberMap.get(sp);
    return !!(sm.father_id || sm.mother_id);
  };
  // 某人的"血缘子女"（以 bloodParentOf 选出的父/母 == id 者，避免双亲重复计数）
  const bloodChildrenOf = (id) =>
    (childrenMap.get(id) || []).filter((cid) => {
      const c = memberMap.get(cid);
      if (!c) return false;
      const p = bloodParentOf(c);
      return p && p.id === id;
    });
  // 同代排序：男左女右；同性别按出生年（早者居左）保证稳定
  const orderSiblings = (ids) =>
    ids.slice().sort((a, b) => {
      const ma = memberMap.get(a);
      const mb = memberMap.get(b);
      const ga = ma.gender === 1 ? 0 : 1;
      const gb = mb.gender === 1 ? 0 : 1;
      if (ga !== gb) return ga - gb;
      return (ma.birth_year ?? 0) - (mb.birth_year ?? 0);
    });
  // 同代血亲行中心：用于判定"配偶挂哪侧"（远离中心=外）。仅取血亲（排除已婚入者）避免反馈偏移。
  const rowCenterAt = (lvl) => {
    const xs = [...coords.entries()]
      .filter(([id, c]) => c.y === lvl * ROW && !isMarriedIn(id))
      .map(([, c]) => c.x);
    if (!xs.length) return 0;
    return (Math.min(...xs) + Math.max(...xs)) / 2;
  };

  // 递归布一个"家庭单元"（pLeft 与其配偶 pRight，pRight 可为 null）
  const placeFamily = (pLeft, pRight, genLevel) => {
    const nextLevel = genLevel + 1;
    // 配偶(pRight)挂到 pLeft 的「外侧」：以同代血亲行中心为界，
    // pLeft 在中心左→配偶更左（外）；在右→配偶更右（外）。这样无论男女，
    // 已婚入者都落家族外缘：我在左→妻在我左；姐姐在右→丈夫在姐姐右。
    // 居中（无兄弟姐妹的独子/根）→ 退化为夫妻内部男左女右（男→妻在左，女→夫在右）。
    if (pRight && !coords.has(pRight)) {
      const baseX = coords.get(pLeft).x;
      const center = rowCenterAt(genLevel);
      let side;
      if (baseX < center - 1) side = -COL; // 偏左 → 配偶更左（外）
      else if (baseX > center + 1) side = COL; // 偏右 → 配偶更右（外）
      else side = memberMap.get(pLeft).gender === 1 ? -COL : COL; // 居中 → 夫妻内部男左女右
      const sx = nearestFree(genLevel, baseX + side);
      coords.set(pRight, { x: sx, y: genLevel * ROW });
    }
    const leftX = coords.get(pLeft).x;
    const rightX = pRight && coords.has(pRight) ? coords.get(pRight).x : leftX;
    const center = (leftX + rightX) / 2;

    const childSet = new Set();
    bloodChildrenOf(pLeft).forEach((c) => childSet.add(c));
    if (pRight) bloodChildrenOf(pRight).forEach((c) => childSet.add(c));
    const childIds = orderSiblings([...childSet]);
    if (childIds.length === 0) return;

    if (childIds.length === 1) {
      // 独生子女：父母下方居中
      const cx = nearestFree(nextLevel, center);
      coords.set(childIds[0], { x: cx, y: nextLevel * ROW });
      placeFamily(childIds[0], spouseOf(childIds[0]), nextLevel);
    } else if (childIds.length === 2) {
      // 两子女：男孩落在父列、女孩落在母列 → 与对应父母垂直对齐
      const maleParentX =
        memberMap.get(pLeft).gender === 1 ? leftX : pRight ? rightX : leftX;
      const femaleParentX =
        memberMap.get(pLeft).gender === 2 ? leftX : pRight ? rightX : leftX;
      const maleChild = childIds.find((id) => memberMap.get(id).gender === 1) || childIds[0];
      const femaleChild = maleChild === childIds[0] ? childIds[1] : childIds[0];
      coords.set(maleChild, { x: nearestFree(nextLevel, maleParentX), y: nextLevel * ROW });
      coords.set(femaleChild, { x: nearestFree(nextLevel, femaleParentX), y: nextLevel * ROW });
      placeFamily(maleChild, spouseOf(maleChild), nextLevel);
      placeFamily(femaleChild, spouseOf(femaleChild), nextLevel);
    } else {
      // 三子及以上：整代等距、整齐对称（宽度至少铺满子女数）
      const width = Math.max(rightX - leftX, (childIds.length - 1) * COL);
      const start = center - width / 2;
      childIds.forEach((cid, i) => {
        const cx = nearestFree(nextLevel, start + (i * (width / (childIds.length - 1))));
        coords.set(cid, { x: cx, y: nextLevel * ROW });
        placeFamily(cid, spouseOf(cid), nextLevel);
      });
    }
  };

  // 根代：无父母且非已婚入者；按夫妻分组，自左向右排布，夫妻间留间距
  const roots = resultNodes
    .map((n) => n.id)
    .filter((id) => {
      const m = memberMap.get(id);
      return !m.father_id && !m.mother_id && !isMarriedIn(id);
    });
  const rootPlaced = new Set();
  const rootUnits = [];
  roots.forEach((id) => {
    if (rootPlaced.has(id)) return;
    rootPlaced.add(id);
    const sp = spouseOf(id);
    if (sp && roots.includes(sp) && !rootPlaced.has(sp)) {
      rootPlaced.add(sp);
      rootUnits.push([id, sp]);
    } else {
      rootUnits.push([id]);
    }
  });

  let cursor = 0;
  rootUnits.forEach((unit) => {
    const p1 = unit[0];
    const p2 = unit[1] || null;
    const maleLeft = !p2 || memberMap.get(p1).gender === 1;
    const leftId = p2 ? (maleLeft ? p1 : p2) : p1;
    const rightId = p2 ? (maleLeft ? p2 : p1) : null;
    const lx = nearestFree(0, cursor);
    coords.set(leftId, { x: lx, y: 0 });
    if (rightId) {
      const rx = nearestFree(0, lx + COL);
      coords.set(rightId, { x: rx, y: 0 });
    }
    cursor = (rightId ? coords.get(rightId).x : lx) + COL * 2;
    placeFamily(leftId, rightId, 0);
  });

  // 视图平移：仅改 x，不改相对位置。脉系=我居中；全局=整树居中。
  let shift = 0;
  if (centerId && coords.has(centerId)) {
    shift = -coords.get(centerId).x;
  } else {
    const xs = [...coords.values()].map((c) => c.x);
    shift = -((Math.min(...xs) + Math.max(...xs)) / 2);
  }
  const out = new Map();
  coords.forEach((c, id) => out.set(id, { x: c.x + shift, y: c.y }));
  return out;
}
