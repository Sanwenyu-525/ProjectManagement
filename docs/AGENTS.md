# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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

**Tauri 2.x desktop app** — Agent Workspace OS for developers. React+Vite frontend communicates with Rust backend via Tauri IPC (`invoke`).

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 6 |
| UI Components | Ant Design 5 |
| State Management | Zustand |
| Charts | ECharts |
| Drag & Drop | @dnd-kit |
| Backend | Rust, SQLite (rusqlite) |

### App Structure

**Workspace is the home page** (`/`). The sidebar has 3 items:
- **工作区** (`/`) — Multi-pane workspace with Terminal, Agent, Browser tabs
- **项目管理** (`/projects`, `/projects/:id`) — Project CRUD and detail
- **设置** (`/settings`)

Hidden routes (accessible via URL but not in sidebar): `/git`, `/graph`, `/timeline`, `/data-screen`.

### Workspace System

The workspace is a recursive pane tree (`src/shared/workspace/types.ts`):
- `PaneLeaf` — Contains tab IDs (terminal, agent, browser, plugin)
- `PaneSplit` — Horizontal/vertical split with size ratios
- Tab types: `TerminalTab`, `AgentTab`, `BrowserTab`, `BuildTab`, `LogTab`, `PluginTab`

Key components:
- `WorkspacePage.tsx` — Main workspace view (toolbar + navigator + pane tree)
- `WorkspacePane.tsx` — Recursive split renderer
- `WorkspaceNavigator.tsx` — Left sidebar listing terminals, agents, browsers
- `WorkspaceToolbar.tsx` — Workspace switching (multiple workspaces)
- `AutomationRouter.tsx` — Routes Agent output to Browser automation commands
- `AgentSessionRecorder.tsx` — Records Agent I/O to database

### Browser Adapter Pattern

Browser automation is abstracted behind `BrowserAdapter` interface (`src/shared/workspace/browser/types.ts`):
- `IframeAdapter` — Current implementation using iframe + postMessage
- Future: `PlaywrightAdapter` for cross-origin automation

AutomationRouter parses Agent terminal output for `[devhub-browser:<tabId>] <action> <args>` commands and dispatches via the active adapter.

### Project Brain

`brain_analyze_project` command analyzes a project's structure:
- Directory tree (4 levels deep)
- Entry point detection (main, config, test, lint)
- Directory purpose inference (source, test, config, build, docs, assets, scripts)
- Environment requirements (Node version, required tools)
- Project stats (file counts, languages, lines of code)

### Agent Sessions & Browser Memory

Agent sessions are recorded to `agent_sessions` + `agent_messages` tables.
Browser visits are recorded to `browser_visits` table (URL, title, DOM analysis).

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

Database: SQLite at `{app_data_dir}/devhub.db`, 11 tables with TEXT UUIDs, ON DELETE CASCADE.
Schema: `src-tauri/migrations/001_init.sql` through `008_browser_memory.sql`.

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
- `terminal_start_agent` — Spawns agent CLI (Codex/gemini/codex) via PTY with xterm-256color.

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
