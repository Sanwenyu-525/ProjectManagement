# DevHub — 开发者个人项目全生命周期管理系统

## 项目概述

为独立开发者/个人开发者设计的一站式项目管理平台，覆盖从项目构想到退役的完整生命周期。集成 GitHub/GitLab/Gitee、CI/CD、部署平台等开发工具，提供统一的项目视图。支持远程仓库项目和本地项目的统一管理。

---

## 一、需求分析

### 1.1 业务背景

一个开发者同时维护多个项目时面临的问题：
- 项目分散在不同平台（GitHub、GitLab、各类云服务）
- 难以快速了解每个项目的当前状态、活跃度、健康度
- 项目的技术栈、依赖、文档散落各处
- 没有统一的时间线来追踪各项目的里程碑和进展
- 缺少项目间的关联视图（共享组件、依赖关系）

### 1.2 用户画像

| 属性 | 描述 |
|------|------|
| 角色 | 个人全栈/独立开发者 |
| 项目规模 | 同时维护 5-50+ 个项目 |
| 技术背景 | 熟悉多种技术栈，需要跨项目视角 |
| 核心诉求 | 高效管理、快速定位、全局洞察 |

### 1.3 功能需求

#### P0 — 核心功能（MVP）

| 模块 | 功能 | 描述 |
|------|------|------|
| 项目管理 | 项目 CRUD | 创建、编辑、归档、删除项目 |
| 项目管理 | 项目概览 | 名称、描述、技术栈、状态、仓库地址、域名 |
| 项目管理 | 项目状态机 | Idea → Planning → Development → Testing → Deployed → Maintained → Archived |
| 项目管理 | 项目图标生成 | 根据项目名首字母 + 技术栈颜色映射自动生成彩色图标；支持上传自定义图标 |
| 项目管理 | 双击打开项目 | 双击项目卡片 → 打开本地 IDE（如 VS Code）或启动 dev server；支持配置打开命令 |
| 项目管理 | 本地项目支持 | 本地项目记录 `localPath`（本地路径），支持一键打开 IDE / 启动开发环境 |
| 项目管理 | 项目来源区分 | 远程仓库项目（关联 RemoteRepo）和本地项目（有 `localPath`）统一管理，混合项目两者并存 |
| 仪表盘 | 全局视图 | 所有项目卡片/列表，按状态/活跃度/优先级筛选排序 |
| 仪表盘 | 统计概览 | 项目总数、各状态分布、近期活跃项目 |
| 认证 | 用户登录 | 本地账号，JWT 认证 |

#### P1 — 重要功能

| 模块 | 功能 | 描述 |
|------|------|------|
| Git 集成 | GitHub 对接 | 同步仓库信息、最近提交、分支、PR |
| Git 集成 | GitLab 对接 | 同步仓库信息、MR、Pipeline |
| Git 集成 | Gitee 对接 | 同步仓库信息、提交、PR、Pipeline，通过 Gitee Open API |
| 任务管理 | 任务看板 | 每个项目的 Todo / In Progress / Done |
| 任务管理 | 里程碑 | 项目的阶段目标和截止日期 |
| 文档中心 | 项目文档 | Markdown 编辑器，每个项目维护自己的文档 |
| 文档中心 | 笔记/日志 | 开发日志、决策记录 |
| 时间线 | 活动时间线 | 聚合各项目的提交、部署、任务变更 |
| 数据大屏 | 项目总览大屏 | 全屏展示所有项目状态、统计图表、实时活动，适合投屏/外接显示器 |

#### P2 — 增强功能

| 模块 | 功能 | 描述 |
|------|------|------|
| 依赖管理 | 依赖追踪 | 项目间依赖关系图、依赖版本、安全漏洞 |
| 部署监控 | 部署状态 | 集成 Vercel/Netlify/自建服务器的部署状态 |
| CI/CD | 流水线状态 | 展示各项目的 CI/CD 运行结果 |
| 技术债 | Tech Debt 追踪 | 记录已知问题、待优化项 |
| 搜索 | 全局搜索 | 跨项目搜索任务、文档、代码片段 |
| 标签系统 | 多维标签 | 按技术栈、类型、优先级等维度分类 |
| 数据导入 | 批量导入 | 从 GitHub/GitLab/Gitee 批量导入已有项目 |
| 数据导出 | 备份导出 | 导出所有数据为 JSON |

### 1.4 非功能需求

| 维度 | 要求 |
|------|------|
| 性能 | 页面加载 < 2s，API 响应 < 500ms |
| 可用性 | 本地部署，支持 Docker 一键启动 |
| 扩展性 | 插件化架构，方便后续集成新平台 |
| 安全性 | JWT + bcrypt，API Token 加密存储 |
| 数据 | 本地存储，不依赖外部 SaaS |
| 浏览器 | Chrome/Firefox/Edge 最新版 |

---

## 二、系统设计

### 2.1 系统架构

```
┌──────────────────────────────────────────────────────────┐
│                    Frontend (React)                       │
│  ┌───────────┐ ┌──────────┐ ┌──────────────────────────┐│
│  │ Dashboard  │ │ Projects │ │ Task Board / Docs / Data ││
│  │ + Data屏   │ │ + 图标   │ │         Screen           ││
│  └───────────┘ └──────────┘ └──────────────────────────┘│
│         ┌──────────────────────┐                         │
│         │   State (Zustand)    │                         │
│         └──────────────────────┘                         │
└─────────────────────┬────────────────────────────────────┘
                      │ HTTP / REST API
┌─────────────────────┴────────────────────────────────────┐
│                  Backend (Node.js/Express)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────────┐ │
│  │ API Layer│ │  Auth    │ │  Integration Svc          │ │
│  │ (REST)   │ │ (JWT)    │ │ (GitHub/GitLab/Gitee/..)  │ │
│  └──────────┘ └──────────┘ └──────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐│
│  │           Service Layer                              ││
│  │  ProjectService / TaskService / DocService           ││
│  │  IconService / LauncherService / StatsService        ││
│  │  RepoSyncService / RepoCompareService                ││
│  └──────────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────────┐│
│  │         Data Access Layer (Prisma ORM)               ││
│  └──────────────────────────────────────────────────────┘│
└─────────────────────┬────────────────────────────────────┘
                      │
            ┌─────────┴─────────┐
            │  SQLite / PostgreSQL│
            │  (开发SQLite, 生产PG) │
            └───────────────────┘
```

### 2.2 核心模块划分

```
ProjectManagement/
├── client/                         # 前端（独立项目，独立 package.json）
│   ├── src/
│   │   ├── features/               # 按功能模块组织
│   │   │   ├── dashboard/          # 仪表盘
│   │   │   ├── data-screen/        # 数据大屏（全屏展示）
│   │   │   ├── projects/           # 项目管理（含图标、启动器）
│   │   │   ├── repos/              # 远程仓库管理（多仓库视图、差异对比）
│   │   │   ├── tasks/              # 任务管理（支持按仓库范围筛选）
│   │   │   ├── documents/          # 文档中心
│   │   │   ├── timeline/           # 时间线
│   │   │   └── settings/           # 设置（含平台认证管理）
│   │   ├── shared/                 # 公共组件
│   │   │   ├── ProjectIcon/        # 项目图标组件（自动生成 + 自定义）
│   │   │   └── LauncherButton/     # 项目启动按钮组件
│   │   ├── lib/                    # 工具函数
│   │   └── api/                    # API 客户端
│   ├── package.json
│   └── vite.config.ts
│
├── server/                         # 后端（独立项目，独立 package.json）
│   ├── src/
│   │   ├── modules/                # 按业务模块
│   │   │   ├── auth/               # 认证
│   │   │   ├── projects/           # 项目（含图标生成、本地路径管理）
│   │   │   ├── repos/              # 远程仓库（多仓库同步、差异对比、clone 管理）
│   │   │   ├── tasks/              # 任务
│   │   │   ├── documents/          # 文档
│   │   │   ├── launcher/           # 项目启动器（打开 IDE / dev server）
│   │   │   └── integrations/       # 第三方集成（GitHub/GitLab/Gitee/部署平台）
│   │   ├── middleware/             # 中间件
│   │   ├── prisma/                 # 数据库 Schema
│   │   └── utils/                  # 工具
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

### 2.3 项目状态机

```
Idea ──→ Planning ──→ Development ──→ Testing ──→ Deployed ──→ Maintained
  │         │              │            │           │            │
  └─────────┴──────────────┴────────────┴───────────┴────────────┘
                              │
                           Archived
```

每个状态转换记录时间戳，支持回退。

---

## 三、技术选型

### 3.1 技术栈明细

| 层级 | 技术 | 理由 |
|------|------|------|
| **前端框架** | React 18 + TypeScript | 生态成熟，类型安全 |
| **构建工具** | Vite | 快速开发体验 |
| **UI 组件** | Ant Design 5 | 开箱即用的企业级组件，适合管理后台 |
| **状态管理** | Zustand | 轻量、简洁，适合中小型应用 |
| **路由** | React Router v6 | 标准方案 |
| **富文本/MD** | TipTap / react-markdown | 文档编辑 |
| **图表** | ECharts | 功能强大，适合数据大屏和复杂图表 |
| **数据大屏** | ECharts + CSS Grid/Flexbox | 全屏数据展示，暗色主题，动画效果 |
| **图标生成** | canvas / SVG | 根据项目名和技术栈动态生成彩色首字母图标 |
| **后端框架** | Express.js + TypeScript | 简单灵活，社区成熟 |
| **ORM** | Prisma | 类型安全，迁移方便 |
| **数据库（开发）** | SQLite | 零配置，本地开发友好 |
| **数据库（生产）** | PostgreSQL | 功能全面，适合后续扩展 |
| **认证** | JWT + bcrypt | 无状态认证 |
| **API 风格** | RESTful | 简单直接，个人项目足够 |
| **第三方集成** | Octokit (GitHub) / GitLab API / Gitee API | 各平台官方 SDK |
| **容器化** | Docker + docker-compose | 一键部署 |

### 3.2 项目结构（前后端独立）

前后端各为独立项目，各有自己的 `package.json`，无 monorepo 工具链，降低复杂度。

```
ProjectManagement/
├── client/           # React 前端（独立 package.json）
├── server/           # Express 后端（独立 package.json）
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 四、数据库设计

### 4.1 ER 图（核心实体）

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│   User   │────<│   Project    │────<│  RemoteRepo  │
└──────────┘     └──────────────┘     └──────────────┘
                       │                     │
                       │                     │
                 ┌─────┴──────┐         scope 引用
                 │            │              │
           ┌─────┴───┐  ┌────┴───┐    ┌─────┴───┐
           │Document  │  │Integration│  │  Task   │
           └─────────┘  └────────┘    └─────────┘
                              │
                        ┌─────┴──────┐
                        │            │
                    ┌───┴────┐  ┌────┴───┐
                    │Milestone│  │  Tag   │
                    └────────┘  └────────┘
```

关系说明：
- **Project 1:N RemoteRepo** — 一个项目可以关联多个远程仓库（GitHub/Gitee/GitLab 各一份）
- **Task.repoScope** — 指向特定 RemoteRepo（仅该仓库可见）或为 NULL（所有仓库共享）
- **Project** 不再直接存 `repoUrl`，远程仓库信息全部在 RemoteRepo 中

### 4.2 表结构设计

#### User（用户）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| username | String | 用户名 |
| email | String | 邮箱 |
| passwordHash | String | 密码哈希 |
| avatar | String? | 头像 URL |
| createdAt | DateTime | 创建时间 |

#### Project（项目）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | String | 项目名称 |
| description | String? | 项目描述 |
| status | Enum | Idea/Planning/Development/Testing/Deployed/Maintained/Archived |
| priority | Enum | Low/Medium/High/Critical |
| source | Enum | Local/Remote/Hybrid（项目来源：纯本地 / 纯远程 / 混合） |
| iconType | Enum | Auto/Custom（图标类型：自动生成 / 自定义上传） |
| iconUrl | String? | 自定义图标地址（iconType=Custom 时） |
| iconColor | String? | 自动生成图标的背景色（iconType=Auto 时由技术栈映射） |
| localPath | String? | 本地项目路径 |
| openCommand | String? | 打开命令，如 `code .`、`webstorm .`、`npm run dev` |
| liveUrl | String? | 线上地址 |
| domainName | String? | 域名 |
| techStack | String[] | 技术栈标签 |
| startDate | Date? | 开始日期 |
| targetDate | Date? | 目标完成日期 |
| ownerId | UUID | 所属用户 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

#### RemoteRepo（远程仓库）

一个项目可关联多个远程仓库，各仓库独立追踪同步状态和进度。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| projectId | UUID | 所属项目 |
| platform | Enum | GitHub/GitLab/Gitee/Bitbucket |
| repoUrl | String | 仓库地址 |
| repoFullName | String | 仓库全名（如 user/repo） |
| defaultBranch | String? | 默认分支 |
| repoStatus | Enum | Synced/Stale/Error/Disabled（仓库同步状态） |
| lastCommitSha | String? | 最后同步的 commit SHA |
| lastCommitAt | DateTime? | 最后 commit 时间 |
| lastSyncAt | DateTime? | 上次同步时间 |
| extraConfig | JSON? | 平台特有配置（分支过滤、webhook 等） |
| integrationId | UUID? | 关联的 Integration（复用认证 Token） |
| createdAt | DateTime | |
| updatedAt | DateTime | |

#### Task（任务）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| title | String | 标题 |
| description | String? | 描述 |
| status | Enum | Todo/InProgress/Done/Cancelled |
| priority | Enum | Low/Medium/High/Critical |
| dueDate | Date? | 截止日期 |
| projectId | UUID | 所属项目 |
| repoScope | UUID? | 作用范围：指向 RemoteRepo.id 时仅该仓库可见，NULL 则所有仓库共享 |
| milestoneId | UUID? | 所属里程碑 |
| parentId | UUID? | 父任务（子任务支持） |
| createdAt | DateTime | |
| updatedAt | DateTime | |

#### Milestone（里程碑）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | String | 名称 |
| description | String? | 描述 |
| dueDate | Date? | 截止日期 |
| status | Enum | Pending/InProgress/Completed/Overdue |
| projectId | UUID | 所属项目 |

#### Document（文档）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| title | String | 标题 |
| content | Text | Markdown 内容 |
| type | Enum | Doc/Note/Changelog/Decision |
| projectId | UUID | 所属项目 |
| createdAt | DateTime | |
| updatedAt | DateTime | |

#### Integration（第三方平台认证）

每个平台一个认证配置，被多个 RemoteRepo 复用。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| platform | Enum | GitHub/GitLab/Gitee/Bitbucket/Vercel/Netlify/Custom |
| accessToken | String | 加密存储的 Token |
| config | JSON | 平台特有配置（OAuth 刷新令牌、API 地址等） |
| userId | UUID | 所属用户 |
| lastSyncAt | DateTime? | 上次同步时间 |

#### Tag（标签）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | String | 标签名 |
| color | String | 颜色值 |
| userId | UUID | 所属用户 |

#### ProjectTag（项目-标签 多对多）

| 字段 | 类型 | 说明 |
|------|------|------|
| projectId | UUID | |
| tagId | UUID | |

#### ActivityLog（活动日志）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| action | String | 操作类型 |
| entityType | String | 实体类型 |
| entityId | UUID | 实体 ID |
| details | JSON | 操作详情 |
| projectId | UUID | 关联项目 |
| createdAt | DateTime | |

---

## 五、API 设计

### 5.1 RESTful 端点

#### 认证

```
POST   /api/auth/register      # 注册
POST   /api/auth/login         # 登录
POST   /api/auth/refresh       # 刷新 Token
GET    /api/auth/me            # 当前用户信息
```

#### 项目

```
GET    /api/projects           # 项目列表（支持筛选、排序、分页）
POST   /api/projects           # 创建项目
GET    /api/projects/:id       # 项目详情
PATCH  /api/projects/:id       # 更新项目
DELETE /api/projects/:id       # 删除项目
PATCH  /api/projects/:id/status  # 变更项目状态
GET    /api/projects/:id/stats   # 项目统计（任务完成率、活跃度等）
POST   /api/projects/:id/open    # 打开项目（启动 IDE / dev server）
POST   /api/projects/:id/icon    # 上传自定义图标
DELETE /api/projects/:id/icon    # 恢复自动生成图标
```

#### 远程仓库

```
GET    /api/projects/:pid/repos            # 项目关联的远程仓库列表
POST   /api/projects/:pid/repos            # 关联远程仓库（填写 URL，自动识别平台）
PATCH  /api/repos/:id                       # 更新仓库配置（分支过滤、同步设置）
DELETE /api/repos/:id                       # 移除仓库关联
POST   /api/repos/:id/sync                 # 触发单个仓库同步
POST   /api/projects/:pid/repos/sync-all   # 同步项目下所有仓库
GET    /api/repos/:id/commits              # 仓库最近提交记录
GET    /api/repos/:id/branches             # 仓库分支列表
GET    /api/repos/:id/compare              # 对比各仓库间的差异（commit/branch）
```

#### 任务

```
GET    /api/projects/:pid/tasks?repoScope=:rid  # 项目任务列表（按仓库范围筛选）
POST   /api/projects/:pid/tasks        # 创建任务（body 中可指定 repoScope）
GET    /api/tasks/:id                  # 任务详情
PATCH  /api/tasks/:id                  # 更新任务
DELETE /api/tasks/:id                  # 删除任务
PATCH  /api/tasks/:id/status           # 变更任务状态
```

#### 里程碑

```
GET    /api/projects/:pid/milestones   # 项目里程碑
POST   /api/projects/:pid/milestones   # 创建里程碑
PATCH  /api/milestones/:id             # 更新里程碑
DELETE /api/milestones/:id             # 删除里程碑
```

#### 文档

```
GET    /api/projects/:pid/documents    # 项目文档列表
POST   /api/projects/:pid/documents    # 创建文档
GET    /api/documents/:id              # 文档详情
PATCH  /api/documents/:id              # 更新文档
DELETE /api/documents/:id              # 删除文档
```

#### 第三方平台认证

```
GET    /api/integrations                # 当前用户的所有平台认证
POST   /api/integrations                # 添加平台认证（GitHub/GitLab/Gitee Token）
PATCH  /api/integrations/:id            # 更新认证信息
DELETE /api/integrations/:id            # 移除平台认证
GET    /api/integrations/:id/repos      # 列出该平台下所有可用仓库（用于添加关联）
```

#### 仪表盘

```
GET    /api/dashboard/overview          # 全局概览
GET    /api/dashboard/stats             # 统计数据
GET    /api/dashboard/timeline          # 时间线（聚合活动）
```

#### 数据大屏

```
GET    /api/data-screen/overview        # 大屏全局数据（项目状态分布、技术栈统计）
GET    /api/data-screen/activity        # 近期活动热力图
GET    /api/data-screen/milestones      # 里程碑时间轴
GET    /api/data-screen/health          # 项目健康度评分
```

#### 标签

```
GET    /api/tags                        # 标签列表
POST   /api/tags                        # 创建标签
PATCH  /api/tags/:id                    # 更新标签
DELETE /api/tags/:id                    # 删除标签
```

#### 搜索

```
GET    /api/search?q=keyword            # 全局搜索
```

### 5.2 统一响应格式

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

错误响应：

```json
{
  "success": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "项目不存在"
  }
}
```

---

## 六、页面设计

### 6.1 页面结构

```
┌────────────────────────────────────────────────────┐
│  Logo   [Dashboard] [Projects] [Timeline] [Search] │  ← 顶部导航
├──────────┬─────────────────────────────────────────┤
│          │                                         │
│  Project │         主内容区域                       │
│  List    │                                         │
│  (侧栏)  │                                         │
│          │                                         │
│  · All   │                                         │
│  · Active│                                         │
│  · Archived│                                       │
│          │                                         │
├──────────┴─────────────────────────────────────────┤
│  状态栏                                              │
└────────────────────────────────────────────────────┘
```

### 6.2 核心页面

| 页面 | 路由 | 说明 |
|------|------|------|
| 仪表盘 | `/` | 项目卡片网格（带图标）、统计图表、近期活动 |
| 项目列表 | `/projects` | 列表/看板视图，筛选排序，双击卡片打开项目 |
| 项目详情 | `/projects/:id` | 概览、**多仓库 Tab**（各仓库状态/差异对比）、任务、文档、时间线 |
| 任务看板 | `/projects/:id/tasks` | Kanban 拖拽看板，支持按仓库范围筛选任务 |
| 文档编辑 | `/projects/:id/docs/:docId` | Markdown 编辑器 |
| 数据大屏 | `/data-screen` | 全屏数据展示（暗色主题），项目状态分布、活动热力图、里程碑时间轴、健康度评分 |
| 全局时间线 | `/timeline` | 所有项目的活动流 |
| 设置 | `/settings` | 集成配置（GitHub/GitLab/Gitee）、偏好设置、数据管理 |

### 6.3 数据大屏设计

数据大屏为独立全屏页面，暗色主题，适合投屏展示。

```
┌────────────────────────────────────────────────────────────────┐
│                        DevHub 数据大屏                          │
├───────────────────┬────────────────────┬───────────────────────┤
│                   │                    │                       │
│  项目状态分布       │   技术栈使用统计    │   项目健康度雷达图     │
│  (环形图)          │   (横向柱状图)      │   (雷达图)            │
│                   │                    │                       │
├───────────────────┴────────────────────┴───────────────────────┤
│                                                               │
│                    近期活动热力图 (30天)                         │
│                    (GitHub 贡献图风格)                          │
│                                                               │
├───────────────────────────────┬───────────────────────────────┤
│                               │                               │
│  里程碑时间轴                  │   实时活动流                   │
│  (甘特图/时间线)               │   (滚动列表)                  │
│                               │                               │
└───────────────────────────────┴───────────────────────────────┘
```

- **全屏模式**：F11 或按钮触发浏览器全屏
- **自动刷新**：每 60 秒轮询更新数据
- **暗色主题**：深色背景 + 高对比度图表，护眼且适合投屏
- **动画效果**：数字滚动、图表渐入、数据更新时的过渡动画

### 6.4 项目图标生成规则

| 条件 | 图标内容 |
|------|---------|
| 项目名首字（中文取首字，英文取首字母） | 大号白色字符，居中 |
| 背景色 | 由技术栈主标签映射（React=#61DAFB, Vue=#4FC08D, Python=#3776AB, 默认=#6366F1） |
| 形状 | 圆角矩形（8px 圆角） |
| 尺寸 | 64x64（卡片）、128x128（详情）、256x256（大屏） |
| 自定义 | 支持上传 PNG/SVG，覆盖自动生成 |

### 6.5 项目打开机制

```
用户双击项目卡片
       │
       ▼
  ┌─ 有 localPath? ─┐
  │                  │
  Yes               No
  │                  │
  ▼                  ▼
执行 openCommand   ┌─ 有 RemoteRepo? ─┐
  │                │                   │
  │               Yes                 No
  │                │                   │
  │                ▼                   ▼
  │          ┌─ 已 clone? ─┐     提示：无本地路径
  │          │              │     请手动设置
  │         Yes            No
  │          │              │
  │          ▼              ▼
  │     执行 openCommand   从主仓库 clone 到默认目录
  │                         然后执行 openCommand
  ▼
 返回执行结果给前端
```

主仓库选取规则：有 GitHub 选 GitHub，否则选第一个 RemoteRepo。
用户可在设置中自定义"首选 clone 平台"。

`openCommand` 预设模板：
- VS Code: `code {path}`
- WebStorm: `webstorm {path}`
- VS Code + Dev: `code {path} && cd {path} && npm run dev`
- 自定义：用户输入任意命令，`{path}` 为占位符

### 6.6 多仓库视图（项目详情页）

项目详情页的"仓库"Tab 展示该项目关联的所有远程仓库：

```
┌────────────────────────────────────────────────────────────────┐
│  [概览] [仓库] [任务] [文档] [时间线]                             │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  GitHub: user/myapp         ● Synced    最后同步: 2h前   │  │
│  │  main branch | 128 commits | last: fix: login bug       │  │
│  │  [同步] [查看仓库] [设置]                                 │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │  Gitee: user/myapp          ● Stale     最后同步: 3天前   │  │
│  │  main branch | 120 commits | last: feat: add search     │  │
│  │  [同步] [查看仓库] [设置]                                 │  │
│  ├─────────────────────────────────────────────────────────┤  │
│  │  [+ 关联远程仓库]                                        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
│  ── 仓库差异对比 ─────────────────────────────────────────────  │
│  GitHub vs Gitee: 8 commits ahead, 0 behind                  │
│  差异详情: [查看]                                              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 七、项目规划

### 7.1 开发阶段

#### Phase 1 — MVP（4 周）

```
Week 1: 项目脚手架 + 数据库 + 认证
  ├─ 初始化前后端独立项目（client/ + server/）
  ├─ Prisma Schema + 迁移（Project、RemoteRepo、Task、Integration 等全部表）
  ├─ 注册/登录 API + JWT 中间件
  └─ 前端路由 + 登录页面
  → 验证：能注册、登录、获取 Token

Week 2: 项目 CRUD + 图标 + 多仓库 + 打开功能 + 仪表盘
  ├─ 项目 CRUD API
  ├─ RemoteRepo CRUD API（关联/移除远程仓库）
  ├─ 项目图标自动生成（首字母 + 技术栈颜色映射，Canvas/SVG）
  ├─ 双击打开项目功能（本地项目用 child_process 执行 openCommand）
  ├─ 项目列表/详情页面（卡片展示图标，双击交互，仓库 Tab 多仓库视图）
  ├─ 仪表盘概览页面
  └─ 项目状态流转
  → 验证：能管理项目、关联多仓库、看到自动生成的图标、双击能打开项目

Week 3: 任务管理 + 标签
  ├─ 任务 CRUD API（支持 repoScope 字段，按仓库范围筛选）
  ├─ 任务看板 (Kanban)（支持按仓库 Tab 切换筛选）
  ├─ 标签系统
  └─ 筛选排序
  → 验证：能在项目内管理任务，不同仓库的任务正确区分

Week 4: 文档 + 部署
  ├─ 文档 CRUD + Markdown 编辑器
  ├─ Docker 容器化
  ├─ 基础 UI 美化
  └─ README + 使用文档
  → 验证：Docker 一键启动，功能可用
```

#### Phase 2 — 增强（3 周）

```
Week 5: GitHub + Gitee 集成 + 多仓库同步
  ├─ GitHub OAuth / Token 认证 + RemoteRepo 自动同步（commit、branch、PR）
  ├─ Gitee Open API 对接 + RemoteRepo 自动同步
  ├─ 多仓库差异对比（commit 数、分支差异）
  ├─ 提交/PR/MR 数据拉取
  └─ 活动时间线
  → 验证：关联的多个仓库能独立同步，差异对比正确

Week 6: 里程碑 + 统计 + 数据大屏
  ├─ 里程碑管理
  ├─ 项目统计（任务完成率、时间线）
  ├─ 数据大屏页面（全屏、暗色主题、ECharts 动画）
  ├─ 大屏内容：项目状态分布、技术栈统计、活动热力图、健康度评分
  └─ 活动日志系统
  → 验证：数据大屏全屏展示、数据实时刷新

Week 7: GitLab 集成 + 搜索
  ├─ GitLab 对接
  ├─ 全局搜索
  ├─ 数据批量导入（GitHub/GitLab/Gitee）
  └─ 性能优化
  → 验证：支持多个 Git 平台
```

#### Phase 3 — 打磨（2 周）

```
Week 8: 部署集成 + 高级功能
  ├─ Vercel/Netlify 集成
  ├─ 依赖关系图
  ├─ 技术债追踪
  └─ 数据导出/备份

Week 9: 体验优化
  ├─ 响应式设计
  ├─ 键盘快捷键
  ├─ 暗色模式
  ├─ 错误处理完善
  └─ 性能优化 + 测试
```

### 7.2 技术风险

| 风险 | 概率 | 影响 | 对策 |
|------|------|------|------|
| GitHub API 限流 | 中 | 同步数据不及时 | 本地缓存 + 增量同步 + 合理的轮询间隔 |
| Gitee API 限流 | 中 | 同步数据不及时 | 同上，Gitee 限流策略需单独适配 |
| 第三方 Token 安全 | 高 | 凭证泄露 | 加密存储，不明文记录 |
| SQLite 并发瓶颈 | 低 | 个人使用影响小 | 生产环境可切 PostgreSQL |
| 集成平台 API 变更 | 中 | 功能失效 | 抽象集成层，隔离平台差异 |
| 项目启动命令执行 | 中 | 安全风险 / 命令注入 | 白名单校验，仅允许预设模板或明确确认的自定义命令 |
| 本地路径不存在 | 中 | 打开失败 | 启动前检查路径存在性，给出友好提示 |

---

## 八、开发规范

### 8.1 代码规范

- TypeScript strict 模式
- ESLint + Prettier 统一格式
- 提交信息遵循 Conventional Commits
- 前端组件：函数式组件 + Hooks
- 后端：Controller → Service → Repository 分层

### 8.2 分支策略

```
main          ← 生产就绪代码
  └── develop ← 开发分支
       └── feature/*  ← 功能分支
       └── fix/*      ← 修复分支
```

### 8.3 环境变量

```env
# .env.example
DATABASE_URL="file:./devhub.db"        # SQLite 开发
# DATABASE_URL="postgresql://..."       # PostgreSQL 生产
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""
GITLAB_CLIENT_ID=""
GITLAB_CLIENT_SECRET=""
GITEE_CLIENT_ID=""
GITEE_CLIENT_SECRET=""
# 项目启动器配置
DEFAULT_OPEN_COMMAND="code ."           # 默认打开命令
PORT=3001
NODE_ENV="development"
```

---

## 九、验收标准

### Phase 1 完成标志

- [ ] 可通过 Docker 一键启动前后端
- [ ] 用户注册、登录、JWT 认证正常
- [ ] 项目全状态生命周期可流转
- [ ] 项目可关联多个远程仓库（RemoteRepo CRUD）
- [ ] 项目图标自动生成（首字母 + 技术栈颜色）
- [ ] 双击项目卡片能打开本地 IDE 或启动 dev server
- [ ] 本地项目和远程项目均可创建和管理
- [ ] 任务支持 repoScope 区分仓库归属，Kanban 按仓库筛选
- [ ] 文档 Markdown 编辑器可用
- [ ] 仪表盘展示项目概览和统计
- [ ] 无阻断性 Bug，核心路径可走通

### Phase 2 完成标志

- [ ] GitHub/Gitee 远程仓库独立同步（commit、branch、PR 状态）
- [ ] 多仓库差异对比（commit 数量、分支差异）正确展示
- [ ] 数据大屏全屏展示，含 4 类图表，动画流畅
- [ ] GitLab 对接可用
- [ ] 全局搜索可用
- [ ] 批量导入已有的远程仓库项目
