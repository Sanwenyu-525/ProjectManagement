# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Environment Requirements

- Node.js >= 18
- Rust >= 1.75
- Windows: 需要安装 Visual Studio C++ Build Tools

首次运行 `npm run tauri dev` 会编译 Rust 依赖，需要几分钟。后续启动会快很多。

## Commands

```bash
# Development (starts both Vite dev server + Tauri native window)
npm run tauri dev

# Build frontend only
npm run build          # tsc -b && vite build

# Check Rust compilation (fast, no binary)
cd src-tauri && cargo check

# Full Tauri build (frontend + Rust + bundle)
npm run tauri build

# Frontend-only dev server (no native window, for UI iteration)
npm run dev            # Vite on port 1420
```

No test infrastructure exists (no vitest, jest, or cargo test config).

## Architecture

**Tauri 2.x desktop app** — Chinese-language developer project management tool. React+Vite frontend communicates with Rust backend via Tauri IPC (`invoke`).

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 6 |
| UI Components | Ant Design 5 |
| State Management | Zustand |
| Charts | ECharts |
| Drag & Drop | @dnd-kit |
| Backend | Rust, SQLite (rusqlite) |

### Feature Modules

- **仪表盘** — 项目统计概览、最近项目
- **项目管理** — CRUD、状态流转、多仓库关联、自动图标生成
- **任务看板** — 拖拽式看板、按仓库范围筛选
- **里程碑** — 项目阶段目标管理
- **文档中心** — Markdown 文档管理
- **活动时间线** — 全局/项目维度活动流
- **数据大屏** — ECharts 全屏数据可视化
- **全局搜索** — 跨项目/任务/文档搜索 (Ctrl+K)

### IPC Flow

```
Frontend: projectsApi.list()
  → src/api/index.ts: cmd('projects_list', args)  // wraps tauriInvoke()
    → src-tauri/src/commands/projects.rs            // #[command] fn
      → src-tauri/src/db.rs: db.query_json(sql)     // SQLite via rusqlite
        → returns serde_json::Value
```

All commands are registered in `src-tauri/src/lib.rs` via `tauri::generate_handler![]`.

**Events** (terminal output/exit): Backend emits via `app.emit("event-name", payload)`, frontend listens via `listen()` from `@tauri-apps/api/event`.

### Backend Pattern (Rust)

Each domain has a command module in `src-tauri/src/commands/`:
- Input structs use `#[serde(rename_all = "camelCase")]` for automatic JS↔Rust name conversion
- Commands receive `State<'_, Database>` for DB access
- All errors map to `String` via `.map_err(|e| e.to_string())`
- Partial updates use `macro_rules! add_field!` to build dynamic SET clauses
- Significant state changes call `db.log_activity()` for the timeline

Database: SQLite at `{app_data_dir}/devhub.db`, 9 tables with TEXT UUIDs, ON DELETE CASCADE. Schema in `src-tauri/migrations/001_init.sql`.

**Query patterns:**
- `db.query_json(sql)` — Returns `serde_json::Value`
- `db.execute(sql)` — For INSERT/UPDATE/DELETE
- Partial updates use `macro_rules! add_field!` to build dynamic SET clauses (see Backend Pattern above)

### Frontend Pattern

- **API layer** (`src/api/index.ts`): Domain-specific objects wrapping `cmd()` — one method per backend command
- **State management** (`src/stores/`): Zustand stores organized by feature domain
- **Normalization** (`src/lib/normalize.ts`): `techStack` is stored as JSON text in SQLite, parsed to array on frontend
- **Single-user, no auth**: Hardcoded `default-user`, `authStore` just sets this user on mount
- **Path alias**: `@/` → `./src/` (configured in both tsconfig.json and vite.config.ts)

### Terminal

Two backend variants:
- `terminal_start` — Runs command via `cmd /C` (Windows) / `sh -c` (Unix), line-by-line output. For non-interactive commands like `npm run dev`.
- `terminal_start_shell` — Spawns shell directly (no wrapper), byte-by-byte output. For interactive use (PowerShell/bash).

Process registry: `static LazyLock<Mutex<HashMap<String, Child>>>` in `terminal.rs`.

### Styling

Glassmorphism light theme — no Tailwind, no CSS modules:
- CSS variables in `src/index.css` (design tokens)
- Ant Design `ConfigProvider` theme in `src/main.tsx` (light mode, glass tokens)
- Extensive `.ant-*` overrides with `!important` for glass effects (backdrop-filter, semi-transparent backgrounds)
- Inline styles throughout components
- Gradient background body with decorative radial gradient pseudo-elements
- Fonts: Fira Sans (body) + Fira Code (mono), loaded via Google Fonts

## Adding a New Backend Command

1. Add function in `src-tauri/src/commands/<module>.rs`
2. Register in `src-tauri/src/lib.rs` `invoke_handler` list
3. Add frontend wrapper in `src/api/index.ts`
