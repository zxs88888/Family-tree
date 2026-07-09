# 设计文档：家族图谱肘形连线 + 选中脉络高亮

日期：2026-07-09
作者：产品通（PM）+ 工程实现
状态：待评审（HARD GATE：未批准前不写代码）

---

## 1. Why（为什么做）

当前家族图谱用 ECharts `graph`（layout:none）渲染，每个节点与**双亲各自**直连：2 个孩子 = 4 条线（含对角线），视觉杂乱，用户原话"任务之间的连线也比较复杂"。

用户期望的连线是**经典族谱肘形总线（elbow / bus connector）**：
> 父母之间一条婚姻线 → 中点向下一条竖干线 → 在子女层高度横向展开成"总线" → 再竖向分别落到每个子女。

并期望**交互聚焦**：选中某角色时，只把与之相关的连线（祖先链 + 后代链 + 自身婚姻线）加粗发光，其余淡化，呈现"关系脉络"。

## 2. 渲染架构决策（已与用户确认）

**采用纯 SVG 自绘，弃用 ECharts（本视图）。**

- ECharts 的 graph 边只支持直线/弧线，**原生无法画正交肘形**；若保留 ECharts 节点 + SVG 叠层，需 `convertToPixel` 在 roam 时频繁同步，脆弱。
- 纯 SVG 对肘形路径（`M…V…H…V…`）、选中高亮（`stroke-width`/`opacity`）、平移缩放（`<g transform>`）均为一等公民，最可控、最好维护。
- 附带收益：此前"`<view>` 被 uni-app 改写为 `uni-view` 导致画布 0 高度空白"的 bug 类，SVG 元素不受该 CSS 改写影响，**天然规避**。

`graphHelper.js` 的布局算法（`computeLayout`）、称谓（`kinshipTerm`）、节点瘦身（`buildGraphData`）**全部复用，不动**。仅新增一个纯函数用于生成连线几何。

## 3. 数据结构

### 3.1 复用
- `buildGraphData(flatMembers, centerId, depth)` → `graphData = { nodes:[{id,name,category,x,y,raw:{…}}], links:[{source,target,kind,isDirectLine,showArrow}] }`
- 节点 `x/y` 已是整齐树坐标（COL=160, ROW=220），SVG 直接采用（1 数据单位 = 1 用户单位）。

### 3.2 新增：`buildEdgeSegments(graphData, allMembers)`
纯函数，输出两类连线几何（与节点坐标同源、可单测）：

**A. marriageLines（婚姻线）**
- 对每个 `kind==='spouse'` 的 link，取两端节点坐标，输出**水平实线**段 `{x1,y1,x2,y2, members:[a,b]}`（用户确认：婚姻线用实线，不用虚线）。
- 仅当两端 `y` 相同（同代夫妻）才水平；已婚入者本就同层，成立。

**B. busLines（血缘总线）—— 连续水平脊 + XM 处分段的经典肘形**
- 按"生育单元"分组：子女按 `(bloodFatherId, bloodMotherId)` 对聚合（单亲则用 `(fatherId)` 或 `(motherId)`）。
- 对每个单元：
  - `parents` = 该对的双亲节点（若无配偶则单点）。
  - `parentMidX` = 双亲中点 x（单亲=该节点 x）。`parentY` = 双亲 y。
  - `childY` = 子女 y（同代一致）。`busY = (parentY + childY) / 2`。
  - **几何**（子女按 x 升序排为 `children[0..n-1]`）：
    ```
    干线 trunk : M parentMidX,parentY  V busY                          // 双亲中点垂直下到脊高度
    水平脊 spine: 左段 M children[0].x,busY  L parentMidX,busY          // 属最左子女
                 （若子女>1）右段 M parentMidX,busY  L children[n-1].x,busY  // 属最右子女
    垂落支 drop : 每个子女 M child.x,busY  V child.y                   // 从脊垂下到该子女
    ```
    - **水平脊是连续的**（左段与右段在 `parentMidX` 共享端点），视觉上是一条完整横向线，解决"线只连一半"的错觉。
    - 左/右脊段分别"属于"最左/最右子女，`members = [该侧子女, parentIds]`，因此选中某人时**仅其所在侧脊段上金**，另一侧（如姐姐那侧）保持可见的中性灰而非被淡化的断桩。
  - `trunk`（双亲中点干线）`members = parentIds`；`drop` `members = [childId, parentIds]`。
- 输出 `busLines:[{ d, members:[...], kind:'trunk'|'spine'|'blood' }]`。

## 4. 高亮逻辑（选中脉络）

- 状态：`selectedId`（点击节点设置；点同一节点 / 点空白清除）。点击仍 `emit('node-click', id)` 打开人物卡（行为不变）。
- `highlightSet(selectedId)`：
  - `H = {selectedId} ∪ ancestors(selectedId) ∪ descendants(selectedId) ∪ {spouse(selectedId)}`（沿父子/配偶链 BFS，纯函数，复用 `allMembers`）。
  - **可见集 `V = H ∪ 同父同母的兄弟姐妹(selectedId)`**：选中某人时，其亲兄弟姐妹**本人仍可见（不淡化）**，但亲兄弟姐妹的配偶/子女不在 V 内（属于"小家庭"），随之淡化。
  - **节点淡化 ⇔ 节点 ∉ V**；**连线淡化 ⇔ 任一端 ∉ V**；**连线金线 ⇔ 两端都 ∈ H**。
- 边高亮判定（每条边**两端都在 H 内**才亮）：
  - `busLine`（每子女半肘，`members=[父母…, 该子女]`）高亮 ⇔ `members` 中**每个**成员 ∈ H（即该子女 ∈ H 且该单元双亲 ∈ H）。
  - `marriageLine` 高亮 ⇔ 两端 `members` 都 ∈ H。
- 视觉：
  - **无选中**：所有线中性灰（`stroke:#C9BBA0` `width:1.6`；婚姻线 `stroke:#B7A98C` `solid`）。**默认无任何金线**——金线只在选中时出现，使"选中加粗脉络"才有意义（早期默认全金会让金线横穿被淡化兄弟，已废弃）。
  - **有选中且高亮**：`stroke:#D4AF37`（金），`width:3.5`，`filter:drop-shadow(金晕)`。
  - **有选中未高亮**：`opacity:0.12`（淡化）。

## 5. 节点渲染（SVG）

每个节点一个 `<g class="node" transform="translate(x,y)">`：
- **色点**：`<circle r=21>`（大字号 r=24）；填充 男=黛`#3A4A52` / 女=赭`#9C6B4A` / 旁系=墨灰`#8A8275` / 我=红`#8B1A1A`。
- **我**：额外 `<circle>` 金环 `stroke:#D4AF37 stroke-width:4` + CSS 呼吸 `filter` 动画（尊重 `prefers-reduced-motion`）。
- **名卡**：色点下方 `<g class="label">`：`rect`（宣纸底 `rgba(252,250,245,.96)` 圆角）+ `<text>` 姓名（宋体加粗 `#2b2622`）+ `<text>` 关系副标（`#6F6657`）。副标复用现有 `relLabel`（kinshipTerm / 第N代 / 我）。

## 6. 交互

- **平移**：背景 `pointerdown`+`move` 改 `<g transform="translate(tx,ty)">`；松手停。
- **缩放**：`wheel` 以光标为锚点改 `scale(k)`（限 0.4–2.5）。
- **点击节点**：`emit('node-click', id)` + 设 `selectedId`（触发高亮重算）。
- **点击空白**：清 `selectedId`。
- **视图切换**：脉系/全局 仍由 `familyStore.buildGraph(centerId, 50)` 驱动；坐标用纯平移（已验证两视图相对位置一致），SVG 重算 `viewBox` 适配。

## 7. Non-goals（明确不做什么）

- 不引入力导向 / 动态布局（坐标已由 graphHelper 确定性计算）。
- 不重写布局算法（computeLayout 不动）。
- 不做节点拖拽改坐标（仅平移视图）。
- 不改变导入/称谓/风格 A 等既有成果。
- 不新增后端/数据库改动。

## 8. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 纯 SVG 替换 ECharts 回归交互 | 交互均为基础 DOM/SVG 事件，单测 + 真实浏览器截图自审 |
| 平移缩放手感差 | 锚点缩放 + 拖拽惯性克制；保留 view-switcher 一键复位视图 |
| 大数据量（几百人）性能 | SVG path 比 ECharts 内联整条 member 更轻；节点 payload 已瘦身；必要时分代虚拟滚动（本期不做） |
| 本环境连不上 Supabase | 用真实 `graphHelper` 算法 + mock 6 人/13 人数据生成**离线 SVG 证明图**自审；用户本地 VPN 看真机 |

## 9. 验收标准

1. 父母→子女为单一肘形总线（非每人双连），婚姻线为同层水平实线。
2. 6 人家族：2 条总线（根→2 子女；姐夫姐→外甥女）+ 2 条婚姻线；无对角线。
3. 选中任意节点：其**祖先链 + 后代链 + 本人配偶**加粗发光（金线），其余淡化；但**同父同母的亲兄弟姐妹本人仍可见（不淡化、也非金）**，而其小家庭（配偶/子女）连同相关连线一并淡化；再次点/点空白还原。
   - **可见集/高亮规则（关键常识）**：`V = H ∪ 同父同母兄弟姐妹`；节点 ∉ V 才淡化；连线**任一端 ∉ V 即淡化**；连线**两端都 ∈ H 才金**。故每条「脊段/垂落支」按其所挂子女独立判定（`members=[父母…,该子女]`）：
     - 选中我 → 姐姐本人 ∈ V（可见、中性灰，非金）；姐姐所属的右半脊段与"姐姐→父母"上行垂落支两端都在 V → 可见（连续脊相连，非断桩）；姐姐→外甥女下行分支（外甥女∉V）与姐姐↔姐夫婚姻线（姐夫∉V）均淡化；金线仅在我所属的左半脊段与我的垂落支上，绝不越过父母中点窜到姐姐头顶。
     - 姐姐本人的"上行分支→父母"可见，但其"下行分支→外甥女"因连到淡化角色而淡化——二者均以姐姐为端点但判定方向不同，需按脊段独立判定，不可整体同亮同淡。
4. 两视图（脉系/全局）连线几何一致（仅平移），高亮行为一致。
5. `npm run build:h5` 通过；离线单测 + 可视化证明图通过。
