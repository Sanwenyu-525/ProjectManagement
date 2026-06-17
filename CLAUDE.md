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

**Workspace is the home page** (`/workspace`). The sidebar has 3 items:
- **工作区** (`/workspace`) — Agent + Terminal + Editor + Browser workspace
- **项目** (`/projects`, `/projects/:id`) — Project CRUD and detail
- **设置** (`/settings`)

Hidden routes (accessible via URL but not in sidebar): `/graph`, `/timeline`, `/data-screen`.

The root `/` redirects to `/workspace`.

### Frontend Directory Structure

```
src/features/
  workspace/           — Workspace page and all workspace sub-features
    WorkspacePage.tsx  — Main workspace view (home page)
    agent/             — AgentChat, AgentSelector, AgentProvider, ClaudeProvider, providers
    terminal/          — TerminalPane, BottomPanel
    editor/            — CodeEditorPane, FileEditor, FileViewer
    browser/           — BrowserWorkspacePage
    git/               — GitDashboardPage and related components
    builds/            — BuildCenterPage
    knowledge/         — KnowledgeCenterPage
    timeline/          — TimelinePage
    data-screen/       — DataScreenPage
    components/        — WorkspaceHeader, StatusDot, cmTheme, terminalFactory, useXtermTerminal
  project/             — ProjectsPage, ProjectDetailPage, NewProjectWizard, git/, health, dependency
  settings/            — SettingsPage
```

### Agent Provider System

Agent integration uses a pluggable provider pattern (`src/features/workspace/agent/`):
- `AgentProvider.ts` — Interface: `start()`, `send()`, `abort()`, `stop()`, `onStream()`, `isActive()`
- `ClaudeProvider.ts` — PTY-based implementation that spawns `claude --dangerously-skip-permissions` directly
- `providers.ts` — Registry: `getProviders()`, `getProvider(id)`

AgentChat delegates all transport to the active provider. To add a new agent backend, implement `AgentProvider` and register in `providers.ts`.

### Workspace System

Key components in `src/features/workspace/`:
- `WorkspacePage.tsx` — Main workspace view, composes Agent + Terminal + BottomPanel
- `agent/AgentChat.tsx` — Chat UI, delegates to AgentProvider for transport
- `terminal/TerminalPane.tsx` — Terminal display with pane management
- `terminal/BottomPanel.tsx` — Secondary terminal panel
- `editor/CodeEditorPane.tsx` — CodeMirror-based file editor

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
    → src-tauri/src/commands/project/projects.rs    // #[command] fn
      → src-tauri/src/db.rs: db.query_json(sql)     // SQLite via rusqlite
        → returns serde_json::Value
```

All commands are registered in `src-tauri/src/lib.rs` via `tauri::generate_handler![]`.

**Events** (terminal output/exit): Backend emits via `app.emit("event-name", payload)`, frontend listens via `listen()` from `@tauri-apps/api/event`.

### Backend Pattern (Rust)

Each domain has a command module in `src-tauri/src/commands/<domain>/`:
- `workspace/` — terminal, files, sessions, agent_tasks, workspaces
- `project/` — projects, tasks, repos, documents, milestones, tags, search, timeline, detect, brain, dependencies, health
- `git/` — git operations
- `build/` — builds, templates, integrations
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
- `terminal_start_agent` — Spawns agent CLI directly (e.g. `claude --dangerously-skip-permissions`) via PTY with xterm-256color.

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

1. Add function in `src-tauri/src/commands/<domain>/<module>.rs`
2. Register in `src-tauri/src/lib.rs` `invoke_handler` list
3. Add frontend wrapper in `src/api/<module>.ts`

## Development Rules

### Architecture Constraints
- **Feature-first layout**: New domain logic goes in `src/features/<domain>/`. Shared cross-cutting code goes in `src/shared/`. Utilities go in `src/lib/`.
- **No new top-level directories** under `src/` without explicit user approval.
- **API layer is centralized**: All Tauri IPC calls go through `src/api/index.ts`. Never call `tauriInvoke()` directly from components.
- **Types are centralized**: All domain types live in `src/types/index.ts`. API-specific types live in `src/api/types/index.ts`. Do not create inline type definitions for API payloads.

### Type Safety
- **No `any` types.** ESLint warns on `@typescript-eslint/no-explicit-any`. Existing suppressions in `src/api/index.ts` are legacy; new code must use proper types.
- **No unsafe type casts** (`as unknown as X`). If you need a narrowing cast, use a type guard function.
- **Discriminated unions preferred**: Use `type` field discriminants (see `PaneTab` union in `src/shared/workspace/types.ts`) rather than optional properties.
- **Unused variables and parameters are errors** (`noUnusedLocals`, `noUnusedParameters`). Prefix with `_` if intentionally unused.

### UI Consistency (Ant Design + Glassmorphism)
- **Ant Design is the component library.** Use `antd` components (Button, Card, Table, Modal, Form, etc.) rather than building custom equivalents.
- **No raw HTML forms, tables, or modals.** Use Ant Design's Form, Table, Modal.
- **Glassmorphism tokens**: Use CSS variables from `src/shared/styles/variables.css` (`--color-*`, `--shadow-*`, `--font-*`). Use utility classes `.glass`, `.glass-strong` from `src/shared/styles/glassmorphism.css`.
- **Inline styles are the established pattern** for layout/positioning (see `WorkspacePage.tsx`, `GlassCard.tsx`). The `styles: Record<string, React.CSSProperties>` object pattern at file bottom is standard. When adding new components, follow this same convention.
- **Ant Design ConfigProvider** theme is configured in `src/main.tsx` with light/dark palette. Do not hardcode color values; reference CSS variables or the theme palette.
- **Dark mode**: The app supports light/dark via `data-theme` attribute and `themeStore`. Components must respect both modes.

### State Management (Zustand)
- **One store per domain**: `terminalStore`, `workspaceStore`, `agentStore`, `themeStore`, `previewStore` in `src/stores/`.
- **Store pattern**: `create<StoreInterface>((set, get) => ({...}))`. Interface defined above `create()`, exported alongside the hook.
- **Selector pattern**: Use inline selectors `useStore(s => s.field)` -- never `useStore()` without a selector (causes unnecessary re-renders).
- **No derived state in stores** unless computed from multiple fields. Prefer `useMemo` in components for derived values.
- **Persistence**: localStorage for ephemeral UI state. Backend tables for durable data. Workspace layout uses both (localStorage fast-save + debounced backend save).

### Component Patterns
- **Extract hooks** when a component has 3+ `useState`/`useEffect` for a single concern. Custom hooks go in `src/hooks/` (shared) or co-located `use*.ts` in the feature directory.
- **Container/presentational**: Page components (`*Page.tsx`) handle data fetching and state. Extracted child components handle rendering.
- **Lazy loading**: Heavy or rarely-visited pages use `React.lazy()` + `Suspense` (see `App.tsx`).
- **Props interfaces**: Define inline or above the component. Export only if reused.

### Agent Behavior Rules
- **Minimal diff**: Change only what the task requires. Do not refactor unrelated code.
- **Match existing style**: Match the formatting, naming, and patterns of the surrounding file.
- **Verification loop**: After making changes, always run:
  ```bash
  npx tsc -b          # TypeScript compilation check
  npx eslint src/     # Lint check
  ```
  Fix all errors before considering the task complete.
- **No new dependencies** without user approval. Prefer existing libraries in `package.json`.
- **No test infrastructure exists.** Do not suggest adding test files or test runners unless asked.
- **IPC contract**: If adding a new backend command, ensure the frontend type matches the Rust `#[serde(rename_all = "camelCase")]` serialization.
