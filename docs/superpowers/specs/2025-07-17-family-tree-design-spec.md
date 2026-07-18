# 家族族谱管理应用 — 设计规格书

## 概述

基于 Taro (Vue 3) + Supabase 的跨端家族族谱管理应用，先以 H5 形态验证，后续可扩展微信小程序。采用渐进式 MVP 策略，分三阶段交付。

**布局方案**：A(垂直树) + D(世代卡片) 混合 — 纵向按世代分层展示家族树，每世代用带状背景区分。

## 项目目标与非目标

### 目标
1. **极低成本**：Vercel + Supabase 免费层，近乎零运维
2. **零门槛访问**：H5 链接在微信群传播，长辈点击即看，无需安装
3. **清晰的族谱可视化**：纯 SVG 渲染，支持多配偶、多世代
4. **高效数据录入**：支持 Excel/CSV 批量导入

### 非目标（明确砍掉）
- 社交互动（评论、点赞）
- 视频/音频上传
- 区块链存证
- 多家族管理

## 技术选型

| 层级 | 技术 | 理由 |
|------|------|------|
| 前端框架 | Taro + Vue 3 | 一套代码编译 H5 + 微信小程序双端 |
| 状态管理 | Pinia | Taro 生态兼容，轻量 |
| 后端 | Supabase | PostgreSQL + Auth + Storage + RPC，免费层 |
| 托管 | Vercel | H5 静态部署，自动 CI/CD |
| 可视化 | 纯 SVG | 不依赖 ECharts 等图表库，完全控制布局 |

## 渐进式 MVP 阶段

### Phase 1：能看到（核心验证）
- 访问码验证进入家族页
- 纯 SVG 渲染家族树（支持多配偶、多世代）
- “我的脉系”视图：点击节点高亮其直系上下代血亲路径
- 成员详情弹窗（点击节点查看：姓名、生卒年、性别、配偶、子女）
- 横向滚动 + 缩放适配移动端
- 节点点击反馈：金边高亮(#c9a96e) + 脉系路径加粗

### Phase 2：能编辑
- 管理员登录（Supabase Auth）
- CRUD 成员、婚姻、生活事件
- 数据导入（CSV/Excel）
- 权限控制：仅管理员/特定权限者可修改

### Phase 3：有温度
- 成员时间线
- 家族故事/记忆
- 照片/媒体上传
- 家族统计面板

## 数据库设计

复用旧项目 Supabase 迁移脚本，但需解决多配偶 schema 限制。

### 表结构

**families** — 家族基本信息
- id(UUID PK), name, description, access_code, admin_contact, created_at

**members** — 成员（自引用外键构建家族关系）
- id(UUID PK), family_id(FK→families), name, gender(1/2), birth_year, death_year
- is_alive, biography, avatar_url
- father_id(FK→members), mother_id(FK→members) — 亲子关系
- spouse_id(FK→members) — ⚠️ 仅支持单配偶，见下方改造方案
- created_by(FK→auth.users), is_deleted(软删除), created_at, updated_at

**spouses** — 🆕 多配偶关联表（解决 spouse_id 单字段限制）
- id(UUID PK), member_id(FK→members), spouse_id(FK→members)
- marriage_order(INT) — 婚配顺序（元配=1, 次配=2...）
- marriage_type(VARCHAR) — 元配/次配/三配/继配等
- UNIQUE(member_id, spouse_id)
- 双向同步：A↔B 双向插入，删除时双向清除
- RLS：与 members 相同（authenticated 可读，管理员可写）

> **关键改造**：旧 schema 的 `members.spouse_id` 只能存一个配偶。永康有 4 位妻子，必须新增 `spouses` 关联表。旧字段 `spouse_id` 保留但废弃，改由 `spouses` 表管理所有配偶关系。

**life_events** — 生活事件
- id(UUID PK), member_id(FK→members), event_type_label, event_title
- year_display, year_sort, location, description, sort_order
- created_by(FK→auth.users), created_at, updated_at

**member_media** — 媒体附件
- id(UUID PK), member_id(FK→members), event_id(FK→life_events)
- media_url, media_type(image/video/document), caption, sort_order
- created_by(FK→auth.users), created_at

**admins** — 管理员账户
- id(UUID PK), user_id(FK→auth.users), family_id(FK→families), created_at
- UNIQUE(user_id, family_id)

### RLS 权限概要

| 操作 | 普通用户(authenticated) | 管理员(admins表) |
|------|----------------------|----------------|
| 查看成员/事件/媒体 | ✓ | ✓ |
| 新增成员 | ✓ | ✓ |
| 更新成员 | 仅自己创建的 | 本家族全部 |
| 删除成员 | ✗ | ✓ |
| 管理家族信息 | ✗ | ✓ |
| 管理管理员 | ✗ | ✓ |

### RPC 函数
- `validate_access_code(input_code, family_id)` — 访问码验证
- `get_access_code_hint(family_id)` — 脱敏提示（前2位+****）
- `get_family_info(family_id)` — 家族名称/描述/联系方式

### Storage
- `avatars` — 头像（Public Bucket）
- `family_photos` — 事件图片（Public Bucket）

## 家族树可视化规格

### 视觉风格
- **传统中式**：暖色背景 (#faf6ef)、深棕文字 (#2b2622)、暗红强调 (#8b1a1a)
- **色板**：
  - 主背景: #faf6ef（暖米色）
  - 婚姻线/强调: #8b1a1a（暗红）
  - 亲子线: #c9bba0（浅棕）
  - 金边高亮: #c9a96e（聚焦节点描边）
  - 次文字: #6f6657（日期/备注）
  - 辅助文字: #a89c87（世代标签）
- **全部实线**，无虚线
- 粗实红线 (stroke-width: 3px, #8b1a1a) = 婚姻连接
- 细实棕线 (stroke-width: 1.5–2px, #c9bba0) = 亲子连接
- 统一节点大小：r=12（根节点/聚焦节点 r=14 强调，配金边 #c9a96e）
- 世代带状背景交替透明度（rgba(232,223,204, 0.06~0.18)）
- 世代标签：左侧小字 serif，#a89c87
- **SVG 全局渲染规则**：必须设置 `stroke-linecap: round; stroke-linejoin: round`（CSS 或内联属性），消除线段对接处的亚像素空白

### 布局核心规则

#### 婚姻连接
- 夫妻并排平行（同一 y 坐标）
- 婚姻红线画在两圆边缘之间：`x1 = 左人cx + 左人r`, `x2 = 右人cx - 右人r`（不假设夫左妻右）
- 不穿过任何圆圈
- 两圆边缘间距 ≥ 6px 以保证婚姻线可见

#### 多配偶家庭
- 丈夫居中，妻子并排两侧
- **妻子排序**：按婚配顺序（元配→末配），先排左侧再排右侧。如永康：陈氏(元配,左) · 唐氏(次配,左) · **永康**(中) · 徐氏(三配,右) · 肖氏(末配,右)
- 每位妻子有独立婚姻线连接丈夫方向
- 子女挂在各自母亲正下方
- **妻子对齐规则**：妻子 cx 必须等于其子女组的中心 x（即子女组最左cx + 最右cx 的平均值）

#### 单配偶家庭
- 夫妻并排，子女从夫妻连线中点垂直向下
- 中点 x = (夫cx + 妻cx) / 2

#### 子女分布
- 兄弟姐妹并排挂在父母子女横线上（bus line）
- **列宽** = 子树最大宽度，确保子树不重叠
- 亲子垂线从 bus line 下降到子节点圆圈顶部
- **最小边缘间距**：同代任意两节点的 edge_gap = |cx1 - cx2| - r1 - r2 ≥ 6px

#### 递归一致性
- 每人只出现一次
- 同一套规则贯穿所有世代

### 连线精确规则

#### 垂线起点规则（优先级从高到低）
1. **婚姻线优先**：当垂线 x 坐标位于两圆之间（不穿过任何父节点圆圈）且存在婚姻线时，从婚姻线 y 坐标开始（零间隙下垂）
2. **横线优先**：当垂线从 bus line 或妻子横线出发且 x 坐标不穿过任何圆圈时，从该横线 y 坐标开始
3. **圆圈底边退回**：当垂线 x 坐标会穿过父节点圆圈时，从圆圈底边 (cy + r) 开始，避免线条贯穿角色

> 规则 1 适用场景：夫妻中点垂线（如祖父祖母中点、兄B+嫂中点）。
> 规则 3 适用场景：单人垂线（如永康 bus drop、肖氏子女 drop）。

#### 垂线终止规则
- **遇横即止**：垂线终止于路径上遇到的第一条横线（bus line / 妻子横线 / 婚姻线），不穿越横线继续延伸。垂线可穿过圆圈（圆圈渲染在垂线之上，自然覆盖）

#### 婚姻线规则
- 只画在两圆边缘之间，不穿过圆圈
- 两圆边缘间距 ≥ 6px 以保证婚姻线可见
- 公式统一为 `left_cx + left_r` → `right_cx - right_r`，适用于任意左右排列

### 自检方法论（每次修改后必须执行）

1. **全局边缘间距扫描**：遍历同代所有节点对，`edge_gap = |cx1 - cx2| - r1 - r2`，任何 < 6px 标记为 BUG
2. **中点精度验证**：每条亲子垂直线的 x 坐标必须 = (配偶1_cx + 配偶2_cx) / 2，偏差 > 1px 标记为 BUG
3. **连线连续性检查**：婚姻线与亲子线必须无缝连接，不允许出现断裂/间隔
4. **跨组碰撞扫描**：检查不同家庭单元的节点是否因坐标接近而重叠
5. **婚姻线穿透检查**：婚姻线 x1/x2 必须在两个圆的边缘之间，不得越过圆心
6. **垂线起点验证**：不穿圆→婚姻线/横线优先；穿圆→圆圈底边退回
7. **垂线终止验证**：垂线不穿越任何横线

## 测试数据

永康支真实数据（约 27 人，五代 Gen 0–4，含多配偶）：

```
Gen 0: 祖父 + 祖母
Gen 1: 兄A, 永康(1903-1970)+陈氏(元配)+唐氏(次配)+徐氏(三配,1917-1946)+肖氏(末配,?-1954), 兄B+嫂
Gen 2: 兄A子女(X), 陈氏→树烈, 唐氏→树达, 徐氏→树陆+树炎, 肖氏→树艺+树牧+树森+葛金莲, 兄B子女(Y,Z)
Gen 3: 树炎(1944-)+杨氏(元配,1975婚,1982离)→熙杨(女,1976), 万氏(继配,1959-,1985婚)→熙涵(男,1986)
Gen 4: 熙涵+夏凡(1987-) → 廖舜君(女,2015), 廖舜珵(女,2018)
```

先验证此数据的导入和族谱显示无问题，再导入完整家族数据。

## 布局算法要点（程序化实现）

1. 后序遍历计算每个子树的宽度（考虑婚姻、多配偶）
2. 自顶向下分配 x 坐标，确保子树不重叠
3. 每世代 y 坐标递增（Gen 间距 ~50px）
4. 多配偶：妻子组以丈夫为中心对称分布
5. 子女 bus line：从母亲 x 垂直下降，水平线连接所有子女，各子女从 bus drop 到自身圆圈
6. 婚姻线/亲子线的 x1/x2/y1/y2 严格按上述规则计算
7. **动态 viewBox**：根据成员数量和子树宽度动态计算 `viewBox="0 0 {width} {height}"`，不硬编码

## 用户流程

1. 打开应用 → 输入访问码
2. 验证通过 → 展示家族树主视图
3. 点击节点 → 弹出成员详情
4. （Phase 2）管理员登录 → 编辑/添加成员
5. （Phase 3）浏览故事、时间线、照片
