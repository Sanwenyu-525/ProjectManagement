# Project Graph — 项目依赖图谱

## 概述

项目依赖图谱是 DevHub 的一项核心能力，用于扫描项目源码中的 import/require/use 语句，构建文件级依赖关系图，为 AI 提供项目级上下文。

**核心目标：** 建立项目级上下文，让 AI 不需要反复阅读整个项目。

---

## 当前完成状态（Phase 1）

### 已实现功能

- [x] 数据库迁移（graph_nodes + graph_edges 表）
- [x] Rust 扫描模块（目录遍历 + import 解析 + 3 个 Tauri 命令）
- [x] 前端类型定义 + API 层 + React Query Hooks
- [x] ECharts 力导向图谱可视化组件（GraphTab）
- [x] 接入 ProjectDetailPage（"图谱" Tab）
- [x] cargo check + tsc 编译通过

### 支持的语言（import 解析）

| 语言 | 解析的语法 |
|------|-----------|
| TypeScript/JavaScript | `import ... from 'X'`、`require('X')`、`import('X')`、`export ... from 'X'` |
| Rust | `use crate::X`、`mod X;`、`use super::X` |
| Python | `import X`、`from X import Y` |
| Go | `import "X"`、`import (...)` 块 |

### 不支持的（Phase 1 限制）

- `tsconfig.json` 路径别名（如 `@/components`）
- `package.json` exports 字段
- 函数/类型级调用图
- 增量扫描（每次全量重扫）
- 功能标注（"登录模块"分组）

---

## 文件清单

### 新建文件

| 文件 | 说明 |
|------|------|
| `src-tauri/migrations/020_project_graph.sql` | graph_nodes + graph_edges 表定义 |
| `src-tauri/src/commands/project/graph.rs` | Rust 扫描模块（~500 行） |
| `src/features/projects/tabs/GraphTab.tsx` | ECharts 可视化组件 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src-tauri/Cargo.toml` | 添加 `regex = "1"` 依赖 |
| `src-tauri/src/db.rs` | 注册 020 迁移 |
| `src-tauri/src/commands/project/mod.rs` | `pub mod graph` |
| `src-tauri/src/lib.rs` | 注册 3 个 invoke_handler 命令 |
| `src/types/index.ts` | 6 个 Graph 类型接口 |
| `src/api/project.ts` | `graphApi` + 类型导入 |
| `src/api/index.ts` | 导出 `graphApi` |
| `src/api/queryKeys.ts` | `project.graph` + `project.graphStats` |
| `src/hooks/useProjects.ts` | 3 个 Graph 相关 hooks |
| `src/features/projects/ProjectDetailPage.tsx` | 图谱 Tab 接入 |

---

## 后续规划

### Phase 2：功能标注

> **状态：** 未开始
> **优先级：** P1（强烈推荐）
> **预估工作量：** 3-5 天

#### 目标

允许用户/Agent 为文件组打标签（如"Auth 模块"），建立**功能到文件的映射关系**。

Phase 1 的图谱是文件级的 import 关系——"谁 import 了谁"。但业务上更有价值的是："登录功能涉及哪些文件"、"支付流程经过哪些模块"。这是全自动无法推断的，需要人工标注 + AI 辅助。

#### 数据模型

```sql
-- 功能组定义
CREATE TABLE "feature_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,              -- "Auth"、"支付"、"用户管理"
    "description" TEXT,                -- 功能说明
    "color" TEXT,                      -- 图谱中的展示颜色
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE
);

-- 功能组与文件的关联（多对多）
CREATE TABLE "feature_group_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,             -- 关联 graph_nodes.id
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("groupId") REFERENCES "feature_groups" ("id") ON DELETE CASCADE,
    FOREIGN KEY ("nodeId") REFERENCES "graph_nodes" ("id") ON DELETE CASCADE
);
```

#### 交互方式

**手动标注：**
- 在 GraphTab 中框选多个节点 → 右键"添加到功能组"
- 或在功能面板中手动输入功能名 + 选择文件

**AI 辅助推断：**
- 扫描图谱后，Agent 根据文件名、目录结构、import 关系自动建议分组
- 例如：看到 `LoginPage.tsx` → `AuthStore.ts` → `AuthService.ts` → `UserRepository.ts`，建议标记为"Auth"功能组
- 用户确认或修改后存入数据库

**Rust 命令：**

| 命令 | 说明 |
|------|------|
| `graph_create_group` | 创建功能组 |
| `graph_delete_group` | 删除功能组 |
| `graph_add_files_to_group` | 批量添加文件到功能组 |
| `graph_remove_file_from_group` | 从功能组移除文件 |
| `graph_list_groups` | 列出项目的所有功能组 |
| `graph_suggest_groups` | AI 辅助推断功能分组 |

#### 前端改动

- GraphTab 增加功能组面板（侧边栏或底部抽屉）
- 图谱中功能组内的节点用相同颜色高亮，组间连线加粗
- 点击功能组名称 → 聚焦到该组的所有节点

---

### Phase 3：AI Context Engine

> **状态：** 未开始
> **优先级：** P2（差异化核心）
> **预估工作量：** 5-7 天
> **依赖：** Phase 2 完成

#### 目标

Agent 接到任务时，**自动**根据图谱和功能标注筛选相关文件，只把必要的上下文注入 Agent 的 system prompt，替代当前的全量 grep/read 模式。

这是 DevHub 相对于 Cursor/Codex/Windsurf 的**核心差异化**——长期项目知识库 + 图谱 + 智能上下文压缩。

#### 工作流程

```
用户输入任务描述（如"修改登录逻辑"）
    ↓
Context Engine 分析任务关键词
    ↓
查询 feature_groups 匹配 "登录"/"Auth"
    ↓
找到功能组：Auth（5 个文件）
    ↓
扩展：查 graph_edges 找到直接上下游文件（±1 跳）
    ↓
最终上下文：8 个文件（而非全项目 500+ 个文件）
    ↓
生成 context snippet 注入 Agent system prompt
    ↓
Agent 在精确上下文中工作
```

#### Context Snippet 格式

注入 Agent system prompt 的内容示例：

```
## 项目图谱上下文

当前任务涉及：登录功能

### 相关文件（8/500）

核心文件：
- src/pages/LoginPage.tsx（登录页面，入口）
- src/stores/AuthStore.ts（认证状态管理）
- src/services/AuthService.ts（认证业务逻辑）
- src/repositories/UserRepository.ts（用户数据访问）
- src/api/auth.ts（认证 API 层）

关联文件：
- src/middleware/authMiddleware.ts（认证中间件）
- src/types/User.ts（用户类型定义）
- src/utils/jwt.ts（JWT 工具函数）

### 依赖关系
LoginPage → AuthStore → AuthService → UserRepository
AuthService → auth API → authMiddleware
```

#### 集成方式

**与 AgentProvider 集成：**

在 `ClaudeProvider.ts` 的 `start()` 方法中，启动 Agent 前：
1. 根据用户任务描述查询图谱和功能组
2. 生成 context snippet
3. 追加到 `--system-prompt` 参数或首条消息中

**与现有 Brain 分析联动：**

`brain_analyze_project` 已经分析了目录结构和文件分类。Context Engine 可以复用这些数据，结合图谱做更精准的文件筛选。

**Rust 命令：**

| 命令 | 说明 |
|------|------|
| `graph_resolve_context` | 根据任务描述返回相关文件列表 + 上下文 snippet |
| `graph_expand_from_files` | 从给定文件出发，沿依赖图扩展 N 跳 |

#### 智能匹配策略

| 层级 | 方法 | 示例 |
|------|------|------|
| L1 关键词匹配 | 功能组名称/描述包含任务关键词 | "登录" → Auth 组 |
| L2 文件名匹配 | 任务关键词出现在文件名/路径中 | "login" → LoginPage.tsx |
| L3 依赖扩展 | 从 L1/L2 命中的文件出发，沿 graph_edges 扩展 1-2 跳 | LoginPage → AuthStore → AuthService |
| L4 目录聚集 | 命中文件集中的目录，拉取同目录其他文件 | 命中 3 个 `src/services/auth*` → 拉取整个目录 |

---

### Phase 4：增强（远期）

> **状态：** 未开始
> **优先级：** P3

#### tsconfig 路径别名解析

读取项目的 `tsconfig.json`，解析 `paths` 字段（如 `"@/*": ["./src/*"]`），在 import 解析时正确映射到实际文件路径。

#### 函数/类型级调用图

从文件级图谱深入到函数级，解析函数定义和调用关系。需要 AST 解析（如 SWC for JS/TS, syn for Rust），工作量显著增大。

#### 增量扫描

监听文件变更（已有 `notify` crate 依赖），只重新解析变更文件的 import，更新 graph_edges，避免每次全量重扫。

#### 图谱导出

支持导出为 Mermaid/Graphviz DOT 格式，方便嵌入文档。

---

## 产品价值总结

```
Phase 1（已完成）  文件级依赖图谱 + 可视化
    ↓
Phase 2（待开发）  功能标注：人工 + AI 辅助建立功能→文件映射
    ↓
Phase 3（待开发）  AI Context Engine：智能上下文压缩，替代全量 grep
    ↓
Phase 4（远期）    增强：路径别名、函数级图谱、增量扫描
```

**最终形态：**

DevHub = 项目管理 + 项目图谱 + AI 上下文引擎

这是目前 Cursor/Codex/Windsurf 都没有做好的能力——**长期项目知识库 + 智能上下文压缩**。如果 DevHub 能做到这一点，会形成非常明显的产品差异化，而不只是另一个 AI IDE。

---

## 技术细节

### Rust 命令

| 命令 | 说明 |
|------|------|
| `graph_scan_project` | 扫描项目 + 存储图谱，返回 GraphSummary |
| `graph_get` | 返回完整图谱数据（nodes + edges） |
| `graph_get_stats` | 返回统计（被引用 Top N、孤立文件、语言分布） |

### ECharts 可视化特性

- 力导向布局（force-directed graph）
- 节点大小按入度（被引用次数）缩放
- 节点颜色按语言映射（TypeScript=#3178c6, Rust=#dea584 等）
- 悬停高亮关联节点（adjacency focus）
- 支持缩放、平移、拖拽节点
- 主题感知（亮色/暗色/主题色切换）
- 底部语言图例

### 验证方式

```bash
cd src-tauri && cargo check    # Rust 编译
npx tsc -b                     # TypeScript 编译
npm run tauri dev               # 启动后 → 项目详情 → 图谱 Tab → 扫描项目
```
