# 技术设计文档（TDD）：家族族谱管理 Web 应用

**版本**：V1.7
**匹配 PRD**：V1.8
**匹配 UIUX**：V1.6
**核心原则**：简单、可观测、AI 友好，优先使用 Supabase 原生能力

---

## 1. 技术架构

```
客户端 (uni-app Vue 3)
├── 托管于 Vercel (CDN加速)
└── 核心库：ECharts (Graph) + Pinia (状态管理)
        │ HTTPS (双轨认证)
        ▼
Supabase 后端服务 (免费层)
├── PostgreSQL (数据持久化 + RLS)
├── Auth (Magic Link + 匿名登录)
├── Storage (头像/事件图片, Public Bucket)
└── RPC Functions (访问码验证 + 脱敏提示)
```

### 1.1 依赖清单

- `@supabase/supabase-js` — Supabase 客户端
- `echarts` — ECharts Graph 关系图
- `xlsx` (SheetJS) — CSV/Excel 前端解析
- `pinia` — 状态管理
- `@dcloudio/uni-app` — uni-app 框架

---

## 2. 项目目录结构

```
src/
├── pages/
│   ├── index/index.vue           # 首页（家谱图主视图 + 访问码入口 + 空状态引导）
│   └── admin/admin.vue           # 后台管理（成员录入/编辑 + 批量导入）
├── components/
│   ├── FamilyGraph.vue           # ECharts Graph 关系图封装
│   ├── MemberDrawer.vue          # 成员详情底部抽屉（含时间线展示）
│   ├── OnboardingModal.vue       # 首次登录"选我"弹窗
│   ├── AccessCodeModal.vue       # 访问码输入弹窗
│   ├── SkeletonLoader.vue        # 骨架屏组件
│   ├── TimelineEditor.vue        # 生平时间线编辑器
│   └── GalleryView.vue           # 全屏图库视图
├── stores/
│   ├── familyStore.js            # Pinia：家族数据缓存 + 图谱数据 + 事件缓存
│   └── userStore.js              # Pinia：当前用户身份 + 登录状态
├── utils/
│   ├── supabase.js               # Supabase 客户端初始化
│   ├── graphHelper.js            # 扁平数据 → Graph nodes/links 转换（含 BFS）
│   ├── imageUtils.js             # 图片上传/缩略图工具
│   ├── timelineParser.js         # 时间线导入解析
│   ├── biographyGenerator.js     # 从时间线生成生平简介
│   └── constants.js              # 标签图标映射等
├── App.vue
├── main.js
├── manifest.json
├── index.html
└── package.json
```

---

## 3. 环境变量

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_FAMILY_ID=your-family-uuid-here
```

---

## 4. 数据库设计

### 4.1 建表语句

```sql
CREATE TABLE families (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  access_code VARCHAR(50) DEFAULT 'Wang2026',
  admin_contact VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  gender INT CHECK (gender IN (1,2)),
  birth_year INT,
  death_year INT DEFAULT NULL,
  is_alive BOOLEAN DEFAULT TRUE,
  biography TEXT,
  avatar_url TEXT,
  father_id UUID REFERENCES members(id) ON DELETE SET NULL,
  mother_id UUID REFERENCES members(id) ON DELETE SET NULL,
  spouse_id UUID REFERENCES members(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE life_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  event_type_label VARCHAR(50),
  event_title VARCHAR(100) NOT NULL,
  year_display VARCHAR(30) NOT NULL,
  year_sort INT,
  location VARCHAR(200),
  description TEXT,
  sort_order INT DEFAULT 0,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE member_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  event_id UUID REFERENCES life_events(id) ON DELETE SET NULL,
  media_url TEXT NOT NULL,
  media_type VARCHAR(20) DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'document')),
  caption VARCHAR(200),
  sort_order INT DEFAULT 0,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  family_id UUID REFERENCES families(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 索引

```sql
CREATE INDEX idx_members_father ON members(father_id);
CREATE INDEX idx_members_mother ON members(mother_id);
CREATE INDEX idx_members_spouse ON members(spouse_id);
CREATE INDEX idx_members_family ON members(family_id);
CREATE INDEX idx_members_is_deleted ON members(is_deleted);
CREATE INDEX idx_members_is_alive ON members(is_alive);
CREATE INDEX idx_life_events_member ON life_events(member_id);
CREATE INDEX idx_life_events_year_sort ON life_events(year_sort DESC NULLS LAST, sort_order ASC);
CREATE INDEX idx_member_media_member ON member_media(member_id);
CREATE INDEX idx_member_media_event ON member_media(event_id);
CREATE UNIQUE INDEX idx_admins_user_family ON admins(user_id, family_id);
```

### 4.3 RLS 行级安全策略

```sql
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "允许已登录用户查看成员" ON members
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "允许登录用户新增" ON members
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "管理员可更新所有成员" ON members
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid() AND family_id = members.family_id)
);

CREATE POLICY "创建者可更新自己创建的数据" ON members
FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "仅管理员可删除成员" ON members
FOR DELETE USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid() AND family_id = members.family_id)
);

-- life_events 和 member_media 的管理员操作需关联 members.family_id 校验家族归属
CREATE POLICY "允许已登录用户查看事件" ON life_events
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "管理员可操作所有事件" ON life_events
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admins
    JOIN members ON members.family_id = admins.family_id
    WHERE admins.user_id = auth.uid() AND members.id = life_events.member_id
  )
);

CREATE POLICY "允许已登录用户查看媒体" ON member_media
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "管理员可操作所有媒体" ON member_media
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM admins
    JOIN members ON members.family_id = admins.family_id
    WHERE admins.user_id = auth.uid() AND members.id = member_media.member_id
  )
);

-- families 表：不开放 SELECT，所有读取通过 SECURITY DEFINER RPC
-- 仅管理员可更新
CREATE POLICY "仅管理员可更新家族信息" ON families
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid() AND family_id = families.id)
);

CREATE POLICY "仅管理员可管理管理员" ON admins
FOR ALL USING (
  EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid() AND family_id = admins.family_id)
);
```

### 4.4 RPC 函数

```sql
CREATE OR REPLACE FUNCTION validate_access_code(input_code TEXT, family_id UUID)
RETURNS BOOLEAN AS $$
DECLARE stored_code TEXT;
BEGIN
  SELECT access_code INTO stored_code FROM families WHERE id = family_id LIMIT 1;
  IF stored_code IS NULL THEN RETURN FALSE; END IF;
  RETURN stored_code = input_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_access_code_hint(family_id UUID)
RETURNS VARCHAR AS $$
DECLARE full_code VARCHAR; hint VARCHAR;
BEGIN
  SELECT access_code INTO full_code FROM families WHERE id = family_id LIMIT 1;
  IF full_code IS NULL THEN RETURN '****'; END IF;
  hint := LEFT(full_code, 2) || '****';
  RETURN hint;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 获取家族展示信息（名称、简介、管理员的联系方式）
CREATE OR REPLACE FUNCTION get_family_info(family_id UUID)
RETURNS TABLE (name VARCHAR, description TEXT, admin_contact VARCHAR) AS $$
BEGIN
  RETURN QUERY
  SELECT f.name, f.description, f.admin_contact
  FROM families f
  WHERE f.id = family_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4.5 图片存储

| 存储桶 | 用途 | 路径规范 |
|--------|------|----------|
| `avatars` | 成员头像 | `avatars/{member_id}/{timestamp}_{filename}` |
| `family_photos` | 事件图片 | `family_photos/{member_id}/{event_id}/{timestamp}_{filename}` |

- 不自动压缩，保留原图
- 单张上限 10MB
- 支持格式：`image/jpeg`、`image/png`、`image/webp`、`image/tiff`
- 访问权限：公开（public）

---

## 5. 前端状态管理

### 5.1 userStore

```javascript
// stores/userStore.js
import { defineStore } from 'pinia'
import { supabase } from '@/utils/supabase'

export const useUserStore = defineStore('user', {
  state: () => ({
    myMemberId: localStorage.getItem('my_member_id') || null,
    isAdmin: false,
    fontSizePreference: parseInt(localStorage.getItem('font_size') || '16'),
    accessCodeVerified: localStorage.getItem('access_code_verified') === 'true',
  }),
  actions: {
    setMyMemberId(id) {
      this.myMemberId = id
      localStorage.setItem('my_member_id', id)
    },
    clearMyMemberId() {
      this.myMemberId = null
      localStorage.removeItem('my_member_id')
    },
    toggleFontSize() {
      this.fontSizePreference = this.fontSizePreference === 16 ? 20 : 16
      localStorage.setItem('font_size', String(this.fontSizePreference))
    },
    setAdmin(bool) {
      this.isAdmin = bool
    },
    async logout() {
      localStorage.removeItem('my_member_id')
      localStorage.removeItem('access_code_verified')
      this.clearMyMemberId()
      this.isAdmin = false
      this.accessCodeVerified = false
      await supabase.auth.signOut()
    }
  }
})
```

### 5.2 familyStore

```javascript
// stores/familyStore.js
import { defineStore } from 'pinia'
import { supabase } from '@/utils/supabase'
import { buildGraphData } from '@/utils/graphHelper'

export const useFamilyStore = defineStore('family', {
  state: () => ({
    allMembers: [],
    graphData: { nodes: [], links: [] },
    loading: false,
    loaded: false,
    isEmpty: true,
    eventsCache: {},
  }),
  actions: {
    async withAutoRefresh(queryFn) {
      try {
        return await queryFn()
      } catch (error) {
        if (error?.message?.includes('JWT expired') || error?.status === 403) {
          await supabase.auth.signInAnonymously()
          return await queryFn()
        }
        throw error
      }
    },
    async loadAllMembers(familyId) {
      this.loading = true
      const { data, error } = await this.withAutoRefresh(async () => {
        return await supabase
          .from('members')
          .select('*')
          .eq('family_id', familyId)
          .eq('is_deleted', false)
      })
      if (error) throw error
      this.allMembers = data || []
      this.isEmpty = this.allMembers.length === 0
      this.loaded = true
      this.loading = false
      return this.allMembers
    },
    async loadMemberTimeline(memberId) {
      if (this.eventsCache[memberId]) {
        return JSON.parse(JSON.stringify(this.eventsCache[memberId]))
      }
      const { data, error } = await this.withAutoRefresh(async () => {
        return await supabase
          .from('life_events')
          .select('*, images:member_media(*)')
          .eq('member_id', memberId)
          .order('year_sort', { ascending: false, nullsLast: true })
          .order('sort_order', { ascending: true })
      })
      if (error) throw error
      data?.forEach(event => {
        if (event.images?.length > 0) {
          event.images.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        }
      })
      this.eventsCache[memberId] = data || []
      return JSON.parse(JSON.stringify(this.eventsCache[memberId]))
    },
    clearEventsCache(memberId) {
      if (memberId) {
        delete this.eventsCache[memberId]
      } else {
        this.eventsCache = {}
      }
    },
    buildGraph(centerId, depth = 3) {
      this.graphData = buildGraphData(this.allMembers, centerId, depth)
    },
    async refresh(familyId) {
      this.clearEventsCache()
      await this.loadAllMembers(familyId)
    }
  }
})
```

### 5.3 Session 自动刷新

```javascript
async withAutoRefresh(queryFn) {
  try {
    return await queryFn()
  } catch (error) {
    if (error?.message?.includes('JWT expired') || error?.status === 403) {
      await supabase.auth.signInAnonymously()
      return await queryFn()
    }
    throw error
  }
}
```

### 5.4 事件缓存失效清单

| 操作 | 清空方式 |
|------|----------|
| 新增事件 | `clearEventsCache(memberId)` |
| 编辑事件 | `clearEventsCache(memberId)` |
| 删除事件 | `clearEventsCache(memberId)` |
| 上传事件图片 | `clearEventsCache(memberId)` |
| 删除事件图片 | `clearEventsCache(memberId)` |
| 刷新成员列表 | `clearEventsCache()`（全部清空） |
| 查看成员详情 | 不操作，读缓存 |
| 切换身份 | `clearEventsCache()`（全部清空） |

---

## 6. 页面加载时序

```
用户打开 H5 链接 → 显示骨架屏
    ↓
检查 localStorage.access_code_verified
    ↓
[分支一：管理员]
  └─ session 存在且为邮箱登录 → isAdmin = true → loadAllMembers()
    ↓
[分支二：访问码模式]
  ├─ access_code_verified === false → 弹出 AccessCodeModal
  ├─ 用户输入 → supabase.rpc('validate_access_code')
  ├─ 验证失败 → 提示错误，不加载数据
  ├─ 验证通过 →
  │   ├─ supabase.auth.signInAnonymously()
  │   ├─ localStorage.access_code_verified = true
  │   └─ loadAllMembers()
    ↓
loadAllMembers():
  ├─ 1 次查询拉取全量 members（不含 life_events）
  ├─ 存入 familyStore.allMembers
  ├─ 若成员总数为 0 → 空状态引导页
  ├─ 若 > 0 → 构建图谱
  ├─ 并行调用 supabase.rpc('get_family_info', { family_id }) 获取家族名称/简介/联系方式
  └─ 家族信息存入 userStore 或各自变量
    ↓
检查"我"的身份 → 渲染图谱
    ↓
点击成员节点 → 懒加载 life_events + images → 显示 MemberDrawer
```

### 6.1 关键 API 查询

| 功能 | 查询 |
|------|------|
| 全量成员 | `.from('members').select('*').eq('family_id', familyId).eq('is_deleted', false)` |
| 成员时间线 | `.from('life_events').select('*, images:member_media(*)').eq('member_id', id).order('year_sort', { ascending: false, nullsLast: true })` |
| 新增成员 | `.from('members').insert({...}).select()` |
| 更新成员 | `.from('members').update({...}).eq('id', id)` |
| 软删除 | `.from('members').update({ is_deleted: true }).eq('id', id)` |
| 验证访问码 | `supabase.rpc('validate_access_code', { input_code, family_id })` |
| 家族展示信息 | `supabase.rpc('get_family_info', { family_id })` |
| 访问码脱敏提示 | `supabase.rpc('get_access_code_hint', { family_id })` |
| 搜索成员 | `.from('members').select('name, father_id, mother_id').ilike('name', \`%${keyword}%\`).eq('is_deleted', false).limit(5)` |
| 批量插入 | `.from('members').insert(rows)` |

---

## 7. 核心算法

### 7.1 BFS 金色血脉 + 图谱构建

```javascript
export function buildGraphData(flatMembers, centerId, depth = 3) {
  const memberMap = new Map(flatMembers.map(m => [m.id, m]))

  // BFS 标记直系血脉（不受 depth 限制）
  const lineageNodes = new Set()
  if (centerId && memberMap.has(centerId)) {
    const queue = [centerId]
    const visited = new Set()
    while (queue.length > 0) {
      const currentId = queue.shift()
      if (visited.has(currentId)) continue
      visited.add(currentId)
      lineageNodes.add(currentId)
      const member = memberMap.get(currentId)
      if (!member) continue
      if (member.father_id) queue.push(member.father_id)
      if (member.mother_id) queue.push(member.mother_id)
      flatMembers.forEach(m => {
        if (m.father_id === currentId || m.mother_id === currentId) queue.push(m.id)
      })
    }
  }

  // BFS 构图（depth 限制的视口）
  const visitedGraph = new Set()
  const queueGraph = [{ id: centerId || flatMembers[0]?.id, currentDepth: 0 }]
  const resultNodes = [], resultLinks = [], linkSet = new Set()

  while (queueGraph.length > 0) {
    const { id, currentDepth } = queueGraph.shift()
    if (visitedGraph.has(id) || currentDepth > depth) continue
    visitedGraph.add(id)
    const member = memberMap.get(id)
    if (!member) continue

    let category = 'member'
    if (member.id === centerId) category = 'center'
    else if (member.gender === 1) category = 'male'
    else if (member.gender === 2) category = 'female'

    resultNodes.push({
      id: member.id, name: member.name,
      category, symbolSize: member.id === centerId ? 60 : 40,
      isAlive: member.is_alive !== false, raw: member
    })

    // 查找邻居
    const neighborIds = new Set()
    if (member.father_id) neighborIds.add(member.father_id)
    if (member.mother_id) neighborIds.add(member.mother_id)
    if (member.spouse_id) neighborIds.add(member.spouse_id)
    flatMembers.forEach(m => {
      if (m.father_id === id || m.mother_id === id) neighborIds.add(m.id)
    })

    neighborIds.forEach(neighborId => {
      const key = [id, neighborId].sort().join('-')
      if (!linkSet.has(key)) {
        linkSet.add(key)
        resultLinks.push({
          source: id, target: neighborId,
          isDirectLine: lineageNodes.has(id) && lineageNodes.has(neighborId)
        })
      }
      if (!visitedGraph.has(neighborId) && currentDepth + 1 <= depth) {
        queueGraph.push({ id: neighborId, currentDepth: currentDepth + 1 })
      }
    })
  }

  // 检测标记但未渲染的血脉节点（用于 edgeSymbol 箭头提示）
  const unrenderedLineage = []
  for (const lid of lineageNodes) {
    if (!visitedGraph.has(lid)) {
      unrenderedLineage.push(lid)
    }
  }
  // 在连线中标记：如果目标节点是 lineage 但未渲染，设置箭头
  resultLinks.forEach(link => {
    if (link.isDirectLine && unrenderedLineage.includes(link.target)) {
      link.showArrow = true
    }
  })

  return { nodes: resultNodes, links: resultLinks, lineageNodes: [...lineageNodes], unrenderedLineage }
}
```

### 7.2 配偶双向同步

```javascript
async function updateMemberWithSpouse(memberData) {
  const { data: oldData } = await supabase
    .from('members').select('spouse_id').eq('id', memberData.id).single()
  const oldSpouseId = oldData?.spouse_id

  // 清理旧配偶的反向关系
  if (oldSpouseId && oldSpouseId !== memberData.spouse_id) {
    await supabase.from('members').update({ spouse_id: null }).eq('id', oldSpouseId)
  }

  // 更新当前成员
  await supabase.from('members').update({ spouse_id: memberData.spouse_id }).eq('id', memberData.id)

  // 设置新配偶的反向关系
  if (memberData.spouse_id) {
    await supabase.from('members').update({ spouse_id: memberData.id }).eq('id', memberData.spouse_id)
  }
}
```

### 7.3 时间线解析（年代识别已按 PRD 修正）

```javascript
export function parseTimeline(timelineStr) {
  if (!timelineStr || timelineStr.trim() === '') return []

  const eventStrings = timelineStr.split('|||').map(s => s.trim()).filter(Boolean)
  const events = []

  for (const eventStr of eventStrings) {
    const parts = eventStr.split('||').map(s => s.trim())
    if (parts.length < 1) continue

    const firstPart = parts[0] || ''
    const yearMatch = firstPart.match(/\[([^\]]+)\]\s*(.*)/)
    if (!yearMatch) continue

    const yearDisplay = yearMatch[1].trim()
    const rest = yearMatch[2].trim()
    const labelTitleMatch = rest.match(/^([^：:]*)[：:]\s*(.*)/)
    const label = labelTitleMatch ? labelTitleMatch[1].trim() : ''
    const title = labelTitleMatch ? labelTitleMatch[2].trim() : rest
    const desc = (parts[1] || '').replace(/\\\|/g, '|')
    const location = (parts[2] || '').replace(/\\\|/g, '|')

    // year_sort: 先识别"年代"模式，再识别普通年份
    let yearSort = null
    const eraMatch = yearDisplay.match(/(\d{4})\s*年代/)
    if (eraMatch) {
      yearSort = parseInt(eraMatch[1]) + 5  // 1930年代 → 1935, 1880年代 → 1885
    } else {
      const shortEraMatch = yearDisplay.match(/(\d{2})\s*年代/)
      if (shortEraMatch) {
        yearSort = 1900 + parseInt(shortEraMatch[1]) + 5  // 80年代 → 1985（默认20世纪中值）
      } else {
        const numMatch = yearDisplay.match(/(\d{4})/)
        if (numMatch) yearSort = parseInt(numMatch[1])
      }
    }

    events.push({ year_display: yearDisplay, year_sort: yearSort, event_type_label: label, event_title: title, description: desc, location })
  }
  return events
}
```

### 7.4 循环依赖检测

```javascript
export function detectCircularDependency(rows, nameToRow) {
  const errors = [], visited = new Set(), recursionStack = new Set()

  function dfs(name, path) {
    if (recursionStack.has(name)) {
      errors.push(`检测到循环依赖：${path.join(' → ')} → ${name}`)
      return
    }
    if (visited.has(name)) return
    visited.add(name); recursionStack.add(name)
    const row = nameToRow.get(name)
    if (row) {
      if (row.父亲 && nameToRow.has(row.父亲)) dfs(row.父亲, [...path, name])
      if (row.母亲 && nameToRow.has(row.母亲)) dfs(row.母亲, [...path, name])
    }
    recursionStack.delete(name)
  }

  for (const [name] of nameToRow) {
    if (!visited.has(name)) dfs(name, [])
  }
  return errors
}
```

### 7.5 批量插入（分批 + 事务回滚）

```javascript
// 批量导入入口：校验失败全部回滚
async function batchImport(rows, familyId) {
  // Phase 1: 校验
  const nameErrors = detectDuplicateNames(rows)
  if (nameErrors.length > 0) return { success: false, errors: nameErrors }

  const nameToRow = new Map()
  rows.forEach((row, i) => { if (row.姓名) nameToRow.set(row.姓名, { ...row, _index: i }) })

  const circularErrors = detectCircularDependency(rows, nameToRow)
  if (circularErrors.length > 0) return { success: false, errors: circularErrors }

  // Phase 2: 生成 UUID + 解析引用
  const resolved = resolveReferences(rows, nameToRow, familyId)
  // resolved = { members: [...], events: [...] }

  // Phase 3: 分批插入成员，跟踪 ID
  const allInsertedIds = []
  const chunkSize = 500

  for (let i = 0; i < resolved.members.length; i += chunkSize) {
    const chunk = resolved.members.slice(i, i + chunkSize)
    const { data, error } = await supabase.from('members').insert(chunk).select('id')
    if (error) {
      // 回滚：软删除已插入的成员
      if (allInsertedIds.length > 0) {
        await supabase.from('members').update({ is_deleted: true }).in('id', allInsertedIds)
      }
      return { success: false, errors: [`批量插入成员失败（第 ${i/chunkSize + 1} 批）: ${error.message}`] }
    }
    allInsertedIds.push(...data.map(d => d.id))
  }

  // Phase 4: 分批插入事件，失败时回滚成员
  for (let i = 0; i < resolved.events.length; i += chunkSize) {
    const chunk = resolved.events.slice(i, i + chunkSize)
    const { error } = await supabase.from('life_events').insert(chunk)
    if (error) {
      await supabase.from('members').update({ is_deleted: true }).in('id', allInsertedIds)
      return { success: false, errors: [`批量插入事件失败（第 ${i/chunkSize + 1} 批）: ${error.message}`] }
    }
  }

  // Phase 5: 导入完成后清空 biography（对有事件成员的）
  await clearBiographyAfterImport(allInsertedIds)

  return {
    success: true,
    memberCount: resolved.members.length,
    eventCount: resolved.events.length
  }
}

// 分批插入事件（原 batchInsertEvents 保留为底层工具函数）
export async function batchInsertEvents(events, chunkSize = 500) {
  const results = { success: true, errors: [] }
  for (let i = 0; i < events.length; i += chunkSize) {
    const chunk = events.slice(i, i + chunkSize)
    const { error } = await supabase.from('life_events').insert(chunk)
    if (error) { results.errors.push(error); results.success = false }
  }
  return results
}
```

### 7.6 删除事件（同步删 Storage）

```javascript
async function deleteEventWithMedia(eventId, memberId) {
  const { data: mediaList } = await supabase
    .from('member_media').select('media_url').eq('event_id', eventId)
  if (mediaList?.length > 0) {
    const paths = mediaList.map(m => m.media_url.match(/\/family_photos\/(.+)$/)?.[1]).filter(Boolean)
    if (paths.length > 0) await supabase.storage.from('family_photos').remove(paths)
  }
  await supabase.from('member_media').delete().eq('event_id', eventId)
  await supabase.from('life_events').delete().eq('id', eventId)
  useFamilyStore().clearEventsCache(memberId)
}
```

### 7.7 从时间线生成生平简介

```javascript
export function generateBiographyFromTimeline(events) {
  if (!events?.length) return ''
  const sorted = [...events].sort((a, b) => (a.year_sort ?? 9999) - (b.year_sort ?? 9999))
  return sorted.map(e => {
    let text = ''
    if (e.year_display) text += `[${e.year_display}] `
    if (e.event_type_label) text += `${e.event_type_label}：`
    if (e.event_title) text += `${e.event_title}。`
    if (e.description) text += `${e.description}。`
    if (e.location) text += `（${e.location}）`
    return text
  }).join('\n')
}
```

---

## 8. 核心组件实现规范

### 8.1 FamilyGraph.vue

- ECharts 使用 DOM 初始化（非 `ec-canvas`）
- 力导向布局：`friction: 0.1`, `layoutAnimation: false`
- 金色连线：`color: '#C9A96E'`, `width: 3`, `shadowBlur: 8`
- 血脉标记但未渲染的连线：`edgeSymbol` 设为函数 `(value, params) => params.data.showArrow ? ['none', 'arrow'] : ['none', 'none']`，箭头颜色 `#C9A96E`
- 在世节点：`borderColor: '#27AE60'`, `borderType: 'dashed'`
- "我"节点：呼吸光晕动画（`requestAnimationFrame`，每 2 帧更新一次）
- 大字号模式：节点大小 45/65，排斥力 350，标签换行
- 页面卸载时调用 `chart.dispose()`

### 8.2 AccessCodeModal.vue

- 全屏居中弹窗，背景家族姓氏书法字水印
- 输入框默认密文（`type="password"`），右侧眼睛切换（点击区域 ≥ 48x48）
- 脱敏提示通过 RPC `get_access_code_hint` 获取
- 连续 5 次输错锁定 30 秒
- `uni.onKeyboardHeightChange` 监听键盘遮挡，输入框上移
- 匿名登录失败不关闭弹窗，允许重试

### 8.3 OnboardingModal.vue

- 搜索框 Debounce 300ms
- 候选人附带辅助信息："张三（父亲：张二）"
- 确认后刷新图谱

### 8.4 MemberDrawer.vue

- 底部抽屉，40% 折叠态 / 80% 展开态，可拖拽
- 折叠态：头像 + 姓名 + 在世标签 + 生平简介（3 行截断）
- 展开态：完整简介 + 关联关系 + 时间线
- 头像占位：无头像时使用姓名首字母 + 红色背景圆
- 只读模式隐藏"编辑资料"按钮

### 8.5 TimelineView.vue

- 事件卡片默认折叠/点击展开
- 有图事件展示缩略图（前 3 张），无图事件图片区域留空
- 标签图标匹配：包含匹配 + 最长匹配
- `uni.previewImage` 全屏预览
- 事件增删改后清除缓存并重新加载

---

## 9. 安全与性能清单

| 维度 | 实现 |
|------|------|
| 访问码验证 | RPC SECURITY DEFINER，前端不直接查 families |
| 数据访问 | RLS 要求 auth.role() = 'authenticated' |
| 家族归属 | life_events/member_media 写操作关联 members.family_id 校验 |
| Session 管理 | 自动刷新匿名登录 JWT |
| 图片上传 | 不压缩，≤ 10MB，格式限制 |
| XSS 防护 | Vue 3 默认转义 |
| 搜索防抖 | debounce 300ms |
| ECharts 生命周期 | 页面卸载时 dispose() |
| 数据缓存 | Pinia 全量 + eventsCache（深拷贝） |
| 缓存失效 | 写操作后自动清空对应缓存 |
| 批量导入 | 分批插入，回滚策略 |
| 文件清理 | 删除事件时同步删 Storage |

---

## 10. 部署配置

### 10.1 package.json

```json
{
  "scripts": {
    "dev:h5": "UNI_INPUT_DIR=src UNI_PLATFORM=h5 UNI_OUTPUT_DIR=dist vite",
    "build:h5": "UNI_INPUT_DIR=src UNI_PLATFORM=h5 UNI_OUTPUT_DIR=dist vite build"
  }
}
```

### 10.2 Vercel

- Build Command: `npm run build:h5`
- Output Directory: `dist`
- Install Command: `npm install`

### 10.3 vercel.json

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/(.*)", "headers": [{ "key": "X-Content-Type-Options", "value": "nosniff" }] }
  ]
}
```

---

## 11. Sprint 1 实施范围

Sprint 1 聚焦环境搭建和认证体系：

1. 创建 uni-app Vue3 项目，配置完整目录结构
2. 初始化 Supabase 客户端
3. 实现 `stores/userStore.js` 和 `stores/familyStore.js`（含 `withAutoRefresh`）
4. 实现访问码验证 + 匿名登录完整时序
5. 实现首页骨架屏 + 访问码弹窗 + 空状态
6. 实现 `utils/graphHelper.js` 的 `buildGraphData`
7. 实现 `utils/timelineParser.js`（完整功能）
8. 实现 `utils/biographyGenerator.js`
9. 创建 SQL 迁移脚本（建表 + RLS + RPC + 索引）
