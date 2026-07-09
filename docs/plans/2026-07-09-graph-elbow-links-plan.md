# 实现计划：家族图谱肘形连线 + 选中脉络高亮

基于设计文档 `2026-07-09-graph-elbow-links-design.md`。每个任务 2–5 分钟：先写失败测试 → 看红 → 实现 → 看绿 → 提交。

> 执行模式：本会话内顺序执行（非 subagent 派发，因改动集中在 1–2 文件、且需频繁读真实代码对齐）。TDD 强制。

---

## Task 1 — graphHelper：新增 `buildEdgeSegments`（几何 + 成员集）

**测试先写**：`/tmp/test_edge_segments.mjs`
- 6 人家族（树森-葛金莲 / 熙硕-我爱人 / 熙妮-熊烨 / 熊钰萱）经 `buildGraphData` 得到 nodes。
- 断言 `buildEdgeSegments` 返回：
  - `marriageLines` 含 2 条：树森↔葛金莲、熙妮↔熊烨；均为水平（`y1===y2`）、`members` 正确。
  - `busLines` 含 2 条单元：
    - 根单元：parents=[树森,葛金莲]，children=[熙硕,熙妮]；`d` 含 `M 80,0 V 110`（parentMidX=80,busY=110）与落到 x=0、x=160 的竖向段。
    - 姐夫单元：parents=[熙妮,熊烨]，children=[熊钰萱]；`d` 为 `M 240,220 V 330 V 440`（单子中点 240）。
  - 每条 `busLine.members` 为对应父+子 id 集合。
  - 13 人含堂表家族：单元分组不串（堂/表亲不并入父母单元）。

**实现**：在 `graphHelper.js` 末尾 `export function buildEdgeSegments(graphData, allMembers)`：
1. `byId` = allMembers map；`nodeById` = graphData.nodes map（取 x/y）。
2. marriageLines：遍历 `graphData.links` 中 `kind==='spouse'`，取两端节点坐标 → `{x1,y1,x2,y2,members:[a,b]}`。
3. 分组生育单元：遍历 nodes，按 `(bloodFather||father, bloodMother||mother)` 聚合 children（键用排序后 id 串）。空父集（根）跳过（根无上代总线）。
4. 每单元算 parentMidX/parentY/childY/busY，拼 `d`（含回总线 backtrack），`members`=父∪子，`kind` = 全员 ∈ `graphData.lineageNodes`? 'lineage':'blood'。
5. 返回 `{ marriageLines, busLines }`。

**验证**：`node /tmp/test_edge_segments.mjs` 全绿。

---

## Task 2 — 高亮集合 `highlightSet`（纯函数）

**测试先写**：同文件或 `/tmp/test_highlight.mjs`
- `buildGraphData` + `allMembers` 构造 `highlightSet(id, allMembers)`。
- 选 熊钰萱 → `H` ⊇ {熊钰萱,熊烨,熙妮,树森,葛金莲}；不含 熙硕/我爱人。
- 选 树森 → `H` ⊇ 全部（根祖先，含所有后代）。
- 选 熙硕 → `H` ⊇ {熙硕,我爱人,树森,葛金莲,熙妮,熊烨,熊钰萱}（含配偶、父母、姐妹及其后代）。
- 选 树森 → 其婚姻线两端都 ∈ H（true）；选 熙硕 → 树森-葛金莲 婚姻线两端都 ∈ H（true，因父母在 H）。

**实现**：`export function highlightSet(selectedId, allMembers)`：
- BFS 上溯（father/mother 链）收集祖先；BFS 下溯（childrenMap）收集后代；并入 `spouse_id`；返回 `Set`。
- 复用 `computeGenerations` 思路的 childrenMap 构建（局部）。

**验证**：测试全绿。

---

## Task 3 — FamilyGraph.vue 改写为纯 SVG 渲染

**不写测试先行**（UI 渲染，靠构建 + 离线证明图 + 截图）。但保留 Task1/2 单测守护几何逻辑。

- 移除 `import * as echarts` 与全部 ECharts 调用（initChart/renderChart/startBreathing/stopBreathing/__familyChart）。
- `<template>`：`<view class="family-graph">` 内含 `view-switcher`（不变）+ `<svg ref="svgRef" class="graph-svg">`：
  - `<g class="viewport" :transform="`translate(${tx},${ty}) scale(${k})`">`
    - `<g class="edges">`：先渲染 `marriageLines`（`<line dashed>`），再 `busLines`（`<path>`）。
    - `<g class="nodes">`：每个节点 `<g class="node" @click=onNodeClick(id)>`（色点 circle + 名卡）。
- `buildEdgeSegments` 在 `render()` 内调用（`graphData` + `allMembers`）。
- `relLabel` 逻辑整体搬入（kinshipTerm / 第N代 / 我）。
- 计算 `viewBox` = 节点包围盒 + padding（含 label 高度），初始 `tx=0,ty=0,k=fitK`（适配容器）。
- 样式：节点配色、名卡、金环；婚姻线为**实线**（同设计文档 §A，用户确认不用虚线）；沿用设计文档 §5 色值；`prefers-reduced-motion` 下去掉呼吸。

**验证**：`npm run build:h5` 通过（exit 0）。

---

## Task 4 — 平移 / 缩放 / 点击选中

- `onBackgroundPointerDown/Move/Up`：拖拽改 `tx,ty`。
- `onWheel`：以光标为锚点改 `k`（限 0.4–2.5），同步 `tx,ty` 保持光标下数据点不动。
- `onNodeClick(id)`：`emit('node-click', id)`（开人物卡，行为不变）+ `selectedId=id`。
- 背景 click（非节点）→ `selectedId=null`。
- 视图切换 `switchView`：调 `familyStore.buildGraph` 后 `render()` + 重置 `tx,ty,k` 适配。

**验证**：构建通过；离线证明图含可平移说明（或截图）。

---

## Task 5 — 选中高亮渲染（金线加粗 + 其余淡化）

- `highlightSet(id)` = `H ∪ V`，其中 `H = {id} ∪ 祖先(id) ∪ 后代(id) ∪ {本人配偶}`（金线判定集）；`V = H ∪ 同父同母的兄弟姐妹(id)`（可见集）。
  - 选中我时：**姐姐本人 ∈ V（可见、中性灰、非金）**；姐夫/外甥女 ∉ V → 淡化；姐姐→外甥女下行分支、姐姐↔姐夫婚姻线（任一端∉V）均淡化；姐姐→父母上行分支两端∈V → 可见。
- `render()` 中按 `selectedId` 计算 H 与 V；每条边与每个节点：
  - 无选中：全部中性灰（**默认无金线**；金线仅选中时出现）。
  - 节点淡化 ⇔ 节点 ∉ V；连线淡化 ⇔ 任一端 ∉ V；连线金线 ⇔ 两端都 ∈ H。
  - 每条「半肘形」按单个子女独立判定（`members=[父母…,该子女]`）：选中我 → 我的半肘亮（父母中点干线因共享重合于我这一侧而呈金），姐姐的下行半肘（→外甥女）淡，**金线绝不越过父母中点窜到姐姐头顶**。
  - 婚姻线：两端 ∈ H → 金加粗；否则淡化。
- 节点侧：`selectedId` 节点可加金描边强调（可选，不抢戏）。
- 名卡/呼吸：保留"我"的呼吸（CSS animation on 金环），尊重 reduced-motion。

**验证**：构建通过；离线证明图生成「选中熙硕」「选中熊钰萱」两态对照（金线+淡化可见，且姐夫/外甥女及其连线均淡）。

---

## Task 6 — 离线可视化自审 + 构建 + 截图

- 写 `/tmp/gen_edge_proof.mjs`：用真实 `buildGraphData`+`buildEdgeSegments`，mock 6 人数据，输出 SVG 证明图（含：默认态 / 选中熙硕态 / 选中熊钰萱态），双击可看肘形与高亮。
- `npm run build:h5` 通过。
- 若本环境可达 Supabase（VPN）：puppeteer 截图两视图 + 选中态逐张核对；否则以单测 + 证明图 + 构建为准，并明确告知用户本地 VPN 自测。

**验证**：证明图 + 单测 + 构建全绿。

---

## Task 7 — 提交与部署（待用户最终确认）

- 本任务连同前几轮未提交的所有 PRD 改动（`graphHelper.js`/`FamilyGraph.vue`/`index.vue`/`MemberDrawer.vue`/风格等），一次性 `git commit`。
- 按用户此前指示 C「整体优化完再部署 Vercel」：commit 后部署 Vercel，使线上可见本版（用户浏览器侧直连 Supabase，环境连不上不影响部署）。
- 提交信息遵循 conventional commits（`feat(graph): 肘形连线 + 选中脉络高亮`）。

---

## 依赖/不改项
- `graphHelper.computeLayout` / `kinshipTerm` / `computeGenerationMap` / `buildGraphData`（节点瘦身）**不动**。
- `familyStore` / `index.vue`（仅消费 `node-click` emit）**不改接口**。
- 风格 A（传统中式雅致风）**不动**。
