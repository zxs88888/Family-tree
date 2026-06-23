# 家族族谱管理 Web 应用

基于 uni-app（Vue3）的家族族谱管理应用。管理员可录入家族成员、管理生平时间线、批量导入数据；普通成员通过访问码即可浏览家族关系图谱。

## 技术栈

| 层 | 技术 |
|------|------|
| 前端框架 | uni-app (Vue 3 + Vite) |
| 托管 | Vercel |
| 后端与数据库 | Supabase (PostgreSQL + Auth + Storage + RPC) |
| 图谱可视化 | ECharts Graph |
| 状态管理 | Pinia |
| CSV/Excel 解析 | SheetJS (xlsx) |

## 从零开始部署

### 1. 前置条件

- [Node.js](https://nodejs.org/) >= 18
- [npm](https://www.npmjs.com/)（随 Node.js 安装）
- [Supabase](https://supabase.com/) 账号（免费层即可）

### 2. 安装依赖并启动

```bash
# 使用 nvm 切换到正确的 Node 版本
nvm use

# 安装依赖
npm install

# 启动开发服务器
npm run dev:h5
```

浏览器打开 `http://localhost:5173` 即可使用。

### 3. 生产构建

```bash
npm run build:h5
```

构建产物在 `dist/` 目录。

### 4. 创建 Supabase 项目

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 创建新项目
3. 进入项目 → **Project Settings → API**，记录以下两值：
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public key` → `VITE_SUPABASE_ANON_KEY`
4. 进入 **SQL Editor**，打开 `supabase/migrations/001_init.sql`，全选执行
5. 进入 **Storage** → 新建两个 Public Bucket：
   - `avatars`（用于成员头像）
   - `family_photos`（用于生平事件图片）
6. 进入 **Authentication → Settings** 启用 Anonymous Sign-In
7. 进入 **Table Editor → families** → 插入一条记录：
   - `name`: 你的家族名称
   - `access_code`: 自定义访问码（如 `Wang2026`）
   - 记录该行的 `id` → `VITE_FAMILY_ID`

### 4. 配置环境变量

复制 `.env.example` 为 `.env`，填入上一步获取的值：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_FAMILY_ID=your-family-uuid-here
```

### 5. 启动开发服务器

```bash
npm run dev:h5
```

浏览器打开控制台输出的地址（默认 `http://localhost:5173`）即可使用。

### 6. 首次使用流程

1. 打开链接 → 输入**访问码**（上一步设的 `access_code`）
2. 验证通过后，如果家族为空 → 弹出**三步建谱向导**，依次录入自己 → 父亲 → 祖父
3. 如果已有成员 → 搜索找到自己，确认身份
4. 进入图谱后，可点击节点查看成员详情

### 7. 部署到 Vercel

```bash
npm run build:h5
```

项目根目录已包含 `vercel.json`。在 Vercel Dashboard 中：
1. Import 该 Git 仓库
2. **Build Command**: `npm run build:h5`
3. **Output Directory**: `dist`
4. **Environment Variables**: 填入 `.env` 中的三个值
5. Deploy

### 8. 绑定自定义域名（可选）

1. 购买域名（如 `tree.yourname.top`，约 30-50 元/年）
2. DNS 添加 CNAME 记录 → `cname.vercel-dns.com`
3. Vercel Settings → Domains → 填入域名

## 项目结构

```
family/
├── .env.example              # 环境变量模板
├── index.html                # H5 入口
├── package.json              # 依赖声明
├── vite.config.js            # Vite + uni-app 插件
├── vercel.json               # Vercel 配置
├── supabase/migrations/
│   └── 001_init.sql          # 数据库迁移（建表 + RLS + RPC）
├── docs/
│   ├── PRD.md                # 产品需求文档 V1.8
│   ├── TDD.md                # 技术设计文档 V1.7
│   └── UIUX.md               # UI/UX 设计文档 V1.6
└── src/
    ├── pages/
    │   ├── index/index.vue   # 首页：图谱 + 访问码 + 空状态
    │   └── admin/admin.vue   # 管理页：成员 CRUD + 批量导入
    ├── components/
    │   ├── FamilyGraph.vue   # ECharts 关系图谱
    │   ├── MemberDrawer.vue  # 成员详情抽屉（含时间线）
    │   ├── AccessCodeModal.vue   # 访问码验证弹窗
    │   ├── OnboardingModal.vue   # 三步建谱向导 / 选我搜索
    │   ├── TimelineEditor.vue    # 生平时间线编辑器
    │   ├── TimelineView.vue      # 时间线展示（折叠/展开）
    │   ├── GalleryView.vue       # 全屏图库视图
    │   └── SkeletonLoader.vue    # 骨架屏
    ├── stores/
    │   ├── userStore.js      # 用户身份 / 字号
    │   └── familyStore.js    # 成员 / 图谱 / 事件缓存
    └── utils/
        ├── supabase.js           # Supabase 客户端
        ├── graphHelper.js        # 图谱转换 + BFS
        ├── timelineParser.js     # CSV 时间线解析
        ├── biographyGenerator.js # 生平简介生成
        ├── imageUtils.js         # 图片上传工具
        └── constants.js          # 标签图标映射
```

## 开发路线图

| Sprint | 内容 | 状态 |
|--------|------|------|
| Sprint 1 | 环境搭建、Auth、核心 Store、SQL 迁移 | ✅ |
| Sprint 2 | 成员 CRUD、批量导入、配偶同步、三步建谱 | ✅ |
| Sprint 3 | 生平时间线 CRUD + 展示、ECharts 图谱 | ✅ |
| Sprint 4 | 图片上传、GalleryView、前端设计系统 | ✅ |

## 关键业务规则

见 `docs/PRD.md` 第 4 节，包含：

- **配偶双向同步**：修改配偶关系时自动同步双方
- **访问码验证时序**：先验证 → 匿名登录 → 再加载数据
- **biography 自动清空**：添加第一个时间线事件后自动清空
- **yearsort 规则**：`1930年代→1935`，`80年代→1985`
- **在世成员标识**：`death_year = NULL`，节点绿色虚线
- **删除事件**：同步清理 Storage 文件和记录
