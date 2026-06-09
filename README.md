# DevHub — 开发者项目管理平台

管理所有开发项目的全生命周期，支持多远程仓库关联、本地项目启动、数据大屏。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Ant Design 5 + Zustand + ECharts |
| 后端 | Express + TypeScript + Prisma ORM |
| 数据库 | SQLite（开发） / PostgreSQL（生产） |
| 部署 | Docker + docker-compose |

## 快速开始

### 本地开发

```bash
# 1. 后端
cd server
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev

# 2. 前端（新终端）
cd client
npm install
npm run dev
```

- 前端: http://localhost:5173
- 后端: http://localhost:3001
- 数据库: server/prisma/devhub.db

### Docker 一键启动

```bash
docker-compose up --build
```

## 目录结构

```
ProjectManagement/
├── client/                    # React 前端
│   └── src/
│       ├── api/               # API 客户端
│       ├── features/          # 功能模块
│       │   ├── auth/          # 登录/注册
│       │   ├── dashboard/     # 仪表盘
│       │   ├── projects/      # 项目管理
│       │   ├── data-screen/   # 数据大屏
│       │   └── ...
│       ├── shared/            # 公共组件
│       └── stores/            # Zustand 状态管理
│
├── server/                    # Express 后端
│   ├── prisma/schema.prisma   # 数据库 Schema
│   └── src/
│       ├── modules/
│       │   ├── auth/          # 认证
│       │   ├── projects/      # 项目 CRUD + 图标 + 启动器
│       │   ├── repos/         # 远程仓库管理
│       │   ├── tasks/         # 任务管理
│       │   └── documents/     # 文档管理
│       ├── middleware/        # JWT 认证 + 错误处理
│       └── utils/             # Prisma 客户端 + 响应格式
│
├── docker-compose.yml
└── docs/                      # 项目分析文档
```

## 核心功能

- **项目管理** — CRUD + 状态机 + 自动生成图标 + 双击打开项目
- **多仓库关联** — 一个项目关联 GitHub/GitLab/Gitee 多个仓库，独立追踪同步状态
- **任务看板** — Kanban 看板，任务可通过 repoScope 区分仓库归属
- **文档中心** — Markdown 文档管理
- **数据大屏** — 全屏暗色主题，项目状态分布、技术栈统计

## API 概览

| 模块 | 端点前缀 | 说明 |
|------|---------|------|
| 认证 | `/api/auth` | 注册/登录/当前用户 |
| 项目 | `/api/projects` | 项目 CRUD + 状态变更 + 打开项目 |
| 仓库 | `/api/repos` | 远程仓库关联/同步/移除 |
| 任务 | `/api/tasks` | 任务 CRUD + 状态变更 |
| 文档 | `/api/documents` | 文档 CRUD |
