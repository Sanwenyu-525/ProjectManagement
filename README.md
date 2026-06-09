# DevHub — 开发者项目管理平台

为独立开发者设计的一站式桌面端项目管理工具。基于 Tauri 2.x + React 18 + Rust 构建。

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) >= 1.75
- Windows: 需要安装 [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run tauri dev
```

首次运行会编译 Rust 依赖，需要几分钟。后续启动会快很多。

### 构建安装包

```bash
npm run tauri build
```

产出物位于 `src-tauri/target/release/bundle/`：
- Windows: `.msi` 安装包
- macOS: `.dmg`
- Linux: `.deb` / `.AppImage`

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite 6 |
| UI 组件 | Ant Design 5 |
| 状态管理 | Zustand |
| 图表 | ECharts |
| 拖拽 | @dnd-kit |
| 桌面框架 | Tauri 2.x |
| 后端语言 | Rust |
| 数据库 | SQLite (rusqlite) |

## 项目结构

```
├── src/                    # React 前端
│   ├── api/                # API 层（Tauri invoke）
│   ├── stores/             # Zustand 状态管理
│   ├── shared/             # 公共组件
│   └── features/           # 功能模块
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── commands/       # Tauri 命令（API 端点）
│   │   ├── db.rs           # 数据库管理
│   │   ├── lib.rs          # Tauri 应用配置
│   │   └── main.rs         # 入口
│   ├── migrations/         # SQL 迁移
│   └── Cargo.toml          # Rust 依赖
├── vite.config.ts
├── package.json
└── tsconfig.json
```

## 功能模块

- **仪表盘** — 项目统计概览、最近项目
- **项目管理** — CRUD、状态流转、多仓库关联、自动图标生成
- **任务看板** — 拖拽式看板、按仓库范围筛选
- **里程碑** — 项目阶段目标管理
- **文档中心** — Markdown 文档管理
- **活动时间线** — 全局/项目维度活动流
- **数据大屏** — ECharts 全屏数据可视化
- **全局搜索** — 跨项目/任务/文档搜索 (Ctrl+K)
