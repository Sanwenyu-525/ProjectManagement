# DevHub UI V3 — World-Class Developer Tool Redesign

> Generated: 2026-06-24 | Based on full codebase audit

---

## Part 1: Current State Diagnosis

### 1.1 What Blocks Developer Efficiency

| Problem | Severity | Location |
|---------|----------|----------|
| Right panel (400px) cannot collapse — eats workspace space | Critical | `WorkspacePage.tsx` |
| Agent tabs render ALL terminals in DOM (display:none) — memory waste | High | `WorkspacePage.tsx` line ~390 |
| Agent tab bar takes 2 rows (~76px) — quick commands + tab strip | High | `AgentTabBar.tsx` |
| `terminalExpanded` is dead state — bottom panel never opens | Medium | `WorkspacePage.tsx` line 100 |
| File panel width not persisted to localStorage | Medium | `MainLayout.tsx` line 148 |
| Two parallel create-project paths (modal vs wizard) | Medium | `ProjectsPage.tsx` + `NewProjectWizard.tsx` |
| Overview tab has hardcoded placeholder data (git, quick actions) | Medium | `OverviewTab.tsx` lines 96-158 |
| Pull button in GitTab has no onClick handler | Low | `GitTab.tsx` line 242 |
| AgentTerminal + ClaudeProvider are two independent code paths | High | `AgentTerminal.tsx` vs `ClaudeProvider.ts` |
| 154 `!important` overrides make theme fragile | High | `index.css` (85), `design-system.css` (59) |
| Accent color change doesn't recompute Ant Design theme | Medium | `main.tsx` line 166 |

### 1.2 Space Waste Analysis

**Current horizontal layout (1200px viewport, defaults):**

```
Rail(52) + Agent(748) + RightPanel(400) = 1200px
```

- Right panel: **400px minimum, always visible, no collapse** — 33% of screen
- Agent tab bar: **~76px** (two rows) for just 5-7 tabs and 4 dropdown menus
- Summary bar: **32-52px** always-on top bar with project stats
- Topbar: **44px** fixed, mostly empty space with centered search

**Vertical waste in agent workspace:**
- Summary bar (52px) + Tab bar (76px) + right panel header = **128px before any content**
- The summary bar shows info duplicated from the project detail page

### 1.3 What Should Be Always Visible

| Information | Current State | Recommendation |
|-------------|--------------|----------------|
| Active agent status (running/idle/error) | StatusDot on tab | Keep — minimal footprint |
| Current git branch | Summary bar (compact only) | Move to status bar |
| File being edited | Editor tab | Keep |
| Agent conversation | Full xterm PTY view | Keep but optimize |
| Terminal output | Hidden (dead state) | Must become accessible |

### 1.4 What Should Be Hidden to Secondary Level

| Feature | Current Location | Proposed |
|---------|-----------------|----------|
| Quick commands (4 dropdowns) | Agent tab bar row 2 | Slash command palette (like Claude Code) |
| Plan/Git/Context/Memory/Prompts | Right panel always visible | Collapse to icon sidebar or command palette |
| Project stats (tasks, docs, issues) | Summary bar always visible | Status bar footer or hover tooltip |
| Prompt templates | Right panel Prompts tab | Command palette `>templates` |
| Memory management | Right panel Memory tab | Command palette `>memory` |

### 1.5 What Should Support Keyboard Shortcuts

| Action | Proposed Shortcut | Current |
|--------|-------------------|---------|
| Toggle right panel | `Cmd+\` | None |
| Toggle file explorer | `Cmd+B` | `Ctrl+B` (exists) |
| New agent tab | `Cmd+T` | None |
| Close agent tab | `Cmd+W` | None |
| Switch agent tabs | `Cmd+1-9` | None |
| Command palette | `Cmd+K` | Partial (SearchBox exists) |
| Toggle terminal | `` Ctrl+` `` | None |
| Toggle editor split | `Cmd+\` (editor) | None |
| Focus agent input | `Cmd+L` | None |
| Quick commit | `Cmd+Enter` | `Ctrl+Enter` in staging |

### 1.6 What Should Support Split Panes

| Module | Current Split | Proposed |
|--------|--------------|----------|
| Agent ↔ Editor | Yes (2-way horizontal) | Keep, improve |
| Agent ↔ Terminal | No (dead state) | Add vertical split below agent |
| Editor ↔ Preview | No | Add side-by-side preview |
| Terminal ↔ Preview | Tabbed in BottomPanel | Allow side-by-side |
| Agent ↔ Agent | No | Multi-agent side-by-side (like Warp splits) |

---

## Part 2: Competitive Analysis

### 2.1 vs Cursor

| Dimension | Cursor | DevHub Current | DevHub V3 Target |
|-----------|--------|---------------|-----------------|
| **Primary paradigm** | Code editor + AI inline | Agent terminal + panels | Agent workspace + code editor |
| **Layout** | VS Code fork — proven 3-panel | Custom — 2-panel always | Flexible N-panel with presets |
| **AI interaction** | Inline edits, chat sidebar, cmd-K | Raw xterm PTY | Structured chat + PTY fallback |
| **File navigation** | Command palette + explorer tree | Explorer tree only | Command palette + tree + fuzzy |
| **Git** | Source Control sidebar (simple) | Full 3-panel git client | Status bar + dedicated tab |
| **Split panes** | Unlimited splits | 2-way only | 3-way with presets |
| **Terminal** | Integrated bottom panel | Separate agent terminal | Unified terminal system |
| **Theme** | One dark theme, customizable | Glassmorphism + density modes | Refined glassmorphism |
| **Keyboard-first** | Yes — everything bound | Partial | Full keyboard coverage |

**Key lessons from Cursor:**
1. Command palette (`Cmd+K`) as primary navigation — faster than clicking
2. Inline AI edits within the editor — more natural than sending to terminal
3. Minimal chrome — every pixel serves the code
4. Status bar for ambient info (git branch, errors, encoding)

### 2.2 vs Claude Code (CLI)

| Dimension | Claude Code | DevHub Current | DevHub V3 Target |
|-----------|------------|---------------|-----------------|
| **Interface** | Terminal-only, no GUI | GUI wrapping terminal PTY | GUI with terminal as fallback |
| **Context** | Auto-selected files | Manual context panel | Auto + manual context |
| **Plan mode** | Built-in plan/act toggle | AgentPlanPanel | Integrated plan/act |
| **Output** | Streaming markdown | Raw ANSI in xterm | Structured + raw toggle |
| **Tool visibility** | Tool calls shown inline | Hidden in PTY scrollback | Visible in context panel |
| **Multi-agent** | Single session | Multi-tab | Multi-tab + parallel |
| **Memory** | CLAUDE.md + memory | AgentMemoryPanel | Unified memory system |
| **Config** | CLAUDE.md, settings.json | Prompt templates | CLAUDE.md-aware |

**Key lessons from Claude Code:**
1. Structured output (thinking, tool calls, results) beats raw PTY
2. Plan/Act mode toggle is essential for complex tasks
3. Auto-context from project files reduces friction
4. CLAUDE.md integration for project-specific behavior

### 2.3 Reference Products Summary

| Product | Key Takeaway for DevHub |
|---------|------------------------|
| **Warp** | AI-native terminal with block-based output, command palette, split panes |
| **Raycast** | Spotlight-style launcher, extensible, keyboard-first |
| **Linear** | Minimal chrome, keyboard shortcuts for everything, clean status system |
| **GitHub** | PR-centric workflow, clean diff viewer, status checks |
| **Vercel** | Deploy preview integration, environment management, clean dashboard |

---

## Part 3: V3 Layout Architecture

### 3.1 Shell Layout — 4 Zones

```
+------+----------+-----------------------------------+
| Icon | Primary  |          Content Area              |
| Rail | Sidebar  |  +------------------------------+  |
| (48) | (0-280)  |  | Topbar (40px)                |  |
|      | collaps. |  +------------------------------+  |
|      |          |  | Workspace                    |  |
|      |          |  | +----------+---+-----------+  |  |
|      |          |  | | Panel A  | | | Panel B   |  |  |
|      |          |  | | (flex)   | d | (0-400px) |  |  |
|      |          |  | |          | i | collaps.  |  |  |
|      |          |  | +----------+ v +-----------+  |  |
|      |          |  | +------------------------------+  |
|      |          |  | | Bottom Bar (24px)            |  |
|      |          |  | +------------------------------+  |
|      |          |  +------------------------------+  |
+------+----------+-----------------------------------+
```

### 3.2 Zone Definitions

**Zone 1 — Icon Rail (48px, fixed)**
- Reduced from 52px to 48px (align to 8px grid)
- Active indicator: left accent bar (2px) instead of background highlight
- Tooltip on hover (shows full name)
- Bottom: settings, theme toggle, density toggle

**Zone 2 — Primary Sidebar (0-280px, collapsible)**
- Default: collapsed (0px)
- Toggle: `Cmd+B` or click icon in rail
- Content: File explorer OR project list OR git panel OR agent list
- Switchable via rail icons — only one sidebar visible at a time
- Persisted width to localStorage

**Zone 3 — Content Area (flex: 1)**
- Contains Topbar + Workspace + Status Bar
- This is where all primary work happens

**Zone 4 — Bottom Bar (24px, always visible)**
- Replaces summary bar for ambient information
- Left: git branch, ahead/behind indicators
- Center: agent status, active task progress
- Right: terminal toggle, errors/warnings count, encoding, line ending

### 3.3 Workspace Layout Presets

The content area supports layout presets, switchable via `Cmd+Shift+P`:

**Preset 1: Agent Focus (default)**
```
+---------------------------+-----------+
|     Agent Chat/Terminal   |  Context  |
|     (flex: 1)             |  Panel    |
|                           |  (320px)  |
+---------------------------+-----------+
```

**Preset 2: Code + Agent**
```
+-------------------+---+-------------------+
|  Agent Chat       | | |  Code Editor      |
|  (40%)            | d |  (60%)            |
+-------------------+ i +-------------------+
|              Terminal (toggle)             |
+--------------------------------------------+
```

**Preset 3: IDE Mode**
```
+----------+-------------------+-----------+
|  File    |   Code Editor     |  Outline  |
|  Explorer|   (flex: 1)       |  (200px)  |
|  (240px) +-------------------+-----------+
|          |   Terminal (240px)            |
+----------+-------------------------------+
```

**Preset 4: Multi-Agent**
```
+-------------------+---+-------------------+
|  Agent 1          | | |  Agent 2          |
|  (50%)            | d |  (50%)            |
+-------------------+ i +-------------------+
|          Context / Plan Panel             |
+--------------------------------------------+
```

### 3.4 Panel Collapse Behavior

All secondary panels (right panel, bottom panel, sidebar) should:
- Default to collapsed
- Toggle via keyboard shortcut
- Persist state to localStorage
- Animate open/close (0.2s ease, existing pattern)
- Show icon-only indicators when collapsed (like VS Code activity bar)

---

## Part 4: Page Wireframes

### 4.1 Workspace Page — Agent Focus (Primary Mode)

```
┌─────────────────────────────────────────────────────────────┐
│ [≡] [📁] [⌘K: Search commands, files, actions...      ] [⚙]│  ← Topbar (40px)
├─────────────────────────────────────────────────────────────┤
│┌─────────────────────────────────────────────┐ ┌──────────┐│
││ ● New Conversation          ×               │ │ Plan  Git ││  ← Tab bar (36px)
││ ● Feature: Add auth         ×               │ │ Ctx  Mem  ││    single row
│├─────────────────────────────────────────────┤ │Prompt     ││
││                                             │ ├──────────┤│
││  ┌─────────────────────────────────────┐    │ │          ││
││  │ You: Add user authentication        │    │ │ [Context] ││
││  │                                     │    │ │          ││
││  │ Claude: I'll implement JWT auth...  │    │ │ Files: 3  ││
││  │                                     │    │ │ Read: 2   ││
││  │ ✓ Read src/auth.ts                  │    │ │ Write: 1  ││
││  │ ✓ Edit src/routes/login.ts          │    │ │          ││
││  │   Write src/middleware/auth.ts       │    │ │          ││
││  │                                     │    │ │          ││
││  │ ───────────────────────────────────  │    │ │          ││
││  │ > Type a message or / for commands  │    │ │          ││
││  └─────────────────────────────────────┘    │ │          ││
││                                             │ │          ││
│└─────────────────────────────────────────────┘ └──────────┘│
├─────────────────────────────────────────────────────────────┤
│  main ▸ +2 │ agent: idle │ 3 errors │ UTF-8 │ LF │ Ln 42  │  ← Status Bar
└─────────────────────────────────────────────────────────────┘
```

**Key changes from current:**
- Tab bar: **single row** (36px vs current 76px) — tab label + status dot only
- Quick commands removed from tab bar — available via `/` slash commands in input
- Right panel: **collapsible** with `Cmd+\`, shows icon rail when collapsed
- Status bar: **new** — ambient info that was in summary bar
- Agent input: **structured input area** at bottom (not raw xterm stdin)
- Tool calls: **visible inline** in chat (not hidden in ANSI scrollback)

### 4.2 Workspace Page — Code + Agent Split

```
┌─────────────────────────────────────────────────────────────┐
│ [≡] [📁] [⌘K                                    ] [⚙]      │
├─────────────────────────────────────────────────────────────┤
│┌──────────────────────────┐│┌─────────────────────────────┐│
││ ● Agent                  │││ src/auth.ts    ×  routes.ts ×│
│├──────────────────────────┤│├─────────────────────────────┤│
││ > Implement JWT auth     │││ import { sign } from 'jwt'; ││
││                          │││                             ││
││ Claude: Writing auth...  │││ export async function       ││
││ ✓ Created auth.ts        │││   login(req, res) {         ││
││ ✓ Updated routes.ts      │││     const token = sign({    ││
││ ● Writing middleware...  │││       userId: user.id       ││
││                          │││     }, SECRET);             ││
││                          │││     res.json({ token });    ││
││ [message input]          │││   }                         ││
│├──────────────────────────┤│├─────────────────────────────┤│
││ $ npm run dev            │││                             ││
││ VITE v6 ready on :5173   │││                             ││
│└──────────────────────────┘│└─────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  feat/auth ▸ +3 │ agent: running │ 0 errors │ UTF-8        │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Projects Page — Command Center

```
┌─────────────────────────────────────────────────────────────┐
│ [≡] [📁] [⌘K                                    ] [⚙]      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Projects (12)              [+ New] [Scan]  [⊞] [☰] [📋]   │
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│  │ ▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓ │      │
│  │ 🔷 DevHub│  │ 🟢 API  │  │ 🟡 Web  │  │ 🔴 iOS  │      │
│  │ Active   │  │ Active  │  │Planning │  │ Archived│      │
│  │ React+TS │  │ Rust+Ax │  │ Vue+Vite│  │ Swift   │      │
│  │          │  │         │  │         │  │         │      │
│  │ 🌿 main  │  │ 🌿 dev  │  │ 🌿 feat │  │ 🌿 main │      │
│  │ 3h ago   │  │ 12m ago │  │ 1d ago  │  │ 30d ago │      │
│  │ [▶] [>_] │  │ [▶] [>_]│  │ [▶] [>_]│  │ [▶] [>_]│      │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘      │
│                                                             │
│  ┌─────────┐  ┌─────────┐                                  │
│  │ ▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓ │                                  │
│  │ 🟣 ML   │  │ ⚪ Docs │                                  │
│  │ Active  │  │Completed│                                  │
│  │ Python  │  │ MDX     │                                  │
│  │         │  │         │                                  │
│  │ 🌿 main │  │ 🌿 main │                                  │
│  │ 2h ago  │  │ 5d ago  │                                  │
│  │ [▶] [>_]│  │ [▶] [>_]│                                  │
│  └─────────┘  └─────────┘                                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  6 active │ 2 planning │ 1 completed │ 1 archived          │
└─────────────────────────────────────────────────────────────┘
```

**Key changes:**
- Status bar shows aggregate project stats
- Cards show git branch (real data, not placeholder)
- Compact action buttons integrated into card footer
- Removed: health badge (move to detail page), task count (move to hover)

### 4.4 Project Detail Page — Consolidated Tabs

Current: **10 tabs** (overview, repos, git, tasks, docs, milestones, config, timeline, health, graph)

Proposed: **6 tabs** with grouped content:

| New Tab | Merges | Content |
|---------|--------|---------|
| **Overview** | overview + health + timeline | Dashboard with real git data, activity feed, health indicators |
| **Code** | git + graph | Git client + dependency graph (side-by-side toggle) |
| **Tasks** | tasks + milestones | Unified task board with milestone grouping |
| **Docs** | documents | Keep as-is |
| **Repos** | repos | Keep as-is |
| **Settings** | config | Project configuration |

---

## Part 5: Component Specifications

### 5.1 Status Bar Component (NEW)

```
Height: 24px
Background: var(--color-bg-card) with subtle top border
Font: var(--font-mono), var(--text-xs)

Left section:
  - Git branch icon + name
  - Ahead/behind badges (when > 0)
  - Dirty indicator (when uncommitted changes)

Center section:
  - Agent status: idle | running | thinking | error
  - Active task name (truncated)

Right section:
  - Error/warning count (clickable → opens problems)
  - File encoding (UTF-8)
  - Line ending (LF/CRLF)
  - Current line:column
  - Terminal toggle button
```

### 5.2 Agent Tab Bar (Redesigned)

Current: 2 rows, ~76px
Proposed: 1 row, 36px

```
┌─[●] New Conv ×─┬─[●] Add Auth ×─┬─[●]──────────┬───[+]──┐
│                 │                │              │        │
└─────────────────┴────────────────┴──────────────┴────────┘
```

- Single row, horizontal scroll when tabs overflow
- Each tab: StatusDot (6px) + label (max 24 chars) + close button
- `+` button to add new tab
- Right click context menu: Rename, Duplicate, Close Others
- Quick commands moved to slash command autocomplete

### 5.3 Command Palette (Enhanced SearchBox)

Current: SearchBox exists but limited
Proposed: Full command palette (Raycast-style)

```
┌──────────────────────────────────────────┐
│ 🔍 Search or type a command...           │
├──────────────────────────────────────────┤
│ Recent                                   │
│   ⏱  Open: src/auth.ts                   │
│   ⏱  Agent: "Add user authentication"    │
│                                          │
│ Commands                                  │
│   >  New Agent Tab                       │
│   >  Toggle Terminal                     │
│   >  Git: Commit                         │
│   >  Git: Push                           │
│                                          │
│ Files                                     │
│   📄 src/features/auth/LoginPage.tsx     │
│   📄 src/api/auth.ts                     │
│                                          │
│ Actions                                   │
│   ⚡ Build Project                       │
│   ⚡ Run Tests                           │
└──────────────────────────────────────────┘
```

Sections: Recent, Commands, Files, Actions
Fuzzy matching on all sections
`Cmd+K` to open, `Enter` to execute, `Escape` to close

### 5.4 Collapsible Right Panel

```
Expanded (320px):
┌──────────────────────┐
│ Plan │ Git │ Ctx │ ⋯ │
├──────────────────────┤
│                      │
│  [Panel Content]     │
│                      │
└──────────────────────┘

Collapsed (48px):
┌────┐
│ 📋 │  ← Plan icon
│ 🔀 │  ← Git icon
│ 📁 │  ← Context icon
│ 💾 │  ← Memory icon
│ ⋯  │  ← More
└────┘
```

- Toggle: `Cmd+\`
- Click icon to expand to that tab
- Persist collapsed/expanded state

### 5.5 Structured Agent Chat View

Replace raw xterm PTY with structured chat + PTY toggle:

```
┌─────────────────────────────────────┐
│ [Structured] [Terminal Raw]         │  ← Mode toggle
├─────────────────────────────────────┤
│                                     │
│  You                    14:32       │
│  ┌─────────────────────────────┐    │
│  │ Add JWT authentication      │    │
│  └─────────────────────────────┘    │
│                                     │
│  Claude                 14:32       │
│  ┌─────────────────────────────┐    │
│  │ I'll implement JWT auth.    │    │
│  │                             │    │
│  │ Steps:                      │    │
│  │ 1. Create auth middleware   │    │
│  │ 2. Add login route          │    │
│  │ 3. Update protected routes  │    │
│  │                             │    │
│  │ ┌─ Tool: Read ────────────┐ │    │
│  │ │ ✓ src/auth.ts (42 lines)│ │    │
│  │ └─────────────────────────┘ │    │
│  │                             │    │
│  │ ┌─ Tool: Edit ───────────┐ │    │
│  │ │ src/routes/login.ts     │ │    │
│  │ │ +12 lines, -3 lines     │ │    │
│  │ └─────────────────────────┘ │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ > Type message or / for cmds    ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

- Structured view: parsed messages with thinking, tool calls, results
- Terminal Raw view: existing xterm PTY (fallback)
- Tool calls: collapsible cards showing file operations
- Input: text area with `/` autocomplete (slash commands)

---

## Part 6: Information Architecture

### 6.1 Navigation Structure

```
Icon Rail (Primary Navigation)
├── 🏠 Workspace (default)
│   ├── Agent Chat / Terminal
│   ├── Code Editor (optional split)
│   ├── Context Panel (collapsible right)
│   └── Terminal / Preview (collapsible bottom)
│
├── 📂 Projects
│   ├── Project List (grid/list/kanban)
│   └── Project Detail
│       ├── Overview (dashboard)
│       ├── Code (git + graph)
│       ├── Tasks (tasks + milestones)
│       ├── Docs
│       ├── Repos
│       └── Settings
│
├── 📁 File Explorer (sidebar, not page)
│
├── 📊 Timeline (page)
├── 📈 Data Screen (page)
├── 📚 Knowledge (page)
└── ⚙ Settings (modal or page)

Global
├── ⌘K Command Palette
├── Status Bar (always visible)
└── Theme/Density toggles
```

### 6.2 Command Palette Categories

| Category | Prefix | Examples |
|----------|--------|---------|
| Navigation | (none) | "projects", "settings", "timeline" |
| Files | (none) | "auth.ts", "LoginPage" |
| Commands | `>` | "> new tab", "> git commit", "> toggle terminal" |
| Agent | `/` | "/compact", "/cost", "/plan" |
| Recent | `~` | "~ last conversation", "~ last file" |
| Actions | `!` | "! build", "! test", "! deploy" |

### 6.3 Keyboard Shortcut Map

**Global:**
| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Command palette |
| `Cmd+B` | Toggle sidebar |
| `Cmd+\` | Toggle right panel |
| `` Ctrl+` `` | Toggle terminal |
| `Cmd+Shift+P` | Layout preset picker |
| `Cmd+,` | Settings |
| `Cmd+N` | New project |
| `Cmd+Shift+N` | New agent tab |

**Agent workspace:**
| Shortcut | Action |
|----------|--------|
| `Cmd+T` | New agent tab |
| `Cmd+W` | Close agent tab |
| `Cmd+1-9` | Switch to tab N |
| `Cmd+[` / `Cmd+]` | Previous/next tab |
| `Cmd+L` | Focus agent input |
| `Cmd+Shift+C` | Copy conversation |
| `Escape` | Cancel current operation |

**Editor:**
| Shortcut | Action |
|----------|--------|
| `Cmd+S` | Save file |
| `Cmd+Shift+S` | Save all |
| `Cmd+P` | Quick file open |
| `Cmd+Shift+F` | Find in files |
| `Cmd+\` | Split editor |

---

## Part 7: Theme Specifications

### 7.1 Dark Theme (Primary)

**Philosophy:** Inspired by Warp/Vercel — deep neutral backgrounds, high-contrast text, single accent color for interactive elements.

```css
:root[data-theme="dark"] {
  /* Backgrounds — neutral dark, no green tint */
  --color-bg-base: #0a0a0b;        /* Deep black */
  --color-bg-elevated: #141416;    /* Elevated surfaces */
  --color-bg-card: rgba(20, 20, 22, 0.90);  /* Cards */
  --color-bg-glass: rgba(20, 20, 22, 0.75); /* Glass */
  --color-bg-hover: rgba(255, 255, 255, 0.06); /* Hover state */

  /* Surfaces */
  --color-surface-1: #18181b;      /* Panel background */
  --color-surface-2: #1e1e22;      /* Inset areas */
  --color-surface-3: #27272a;      /* Active states */

  /* Text — WCAG AA compliant */
  --color-text-primary: #fafafa;   /* 15.4:1 contrast */
  --color-text-secondary: #a1a1aa; /* 7.1:1 contrast */
  --color-text-tertiary: #71717a;  /* 4.6:1 contrast */
  --color-text-muted: #52525b;     /* Decorative only */

  /* Accent — single primary */
  --color-primary: #3b82f6;        /* Blue-500 */
  --color-primary-hover: #60a5fa;  /* Blue-400 */
  --color-primary-subtle: rgba(59, 130, 246, 0.15);

  /* Semantic */
  --color-success: #22c55e;
  --color-warning: #eab308;
  --color-error: #ef4444;
  --color-info: #3b82f6;

  /* Borders */
  --border: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.15);
  --divider: rgba(255, 255, 255, 0.06);

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.6);

  /* Glass */
  --glass-blur: 16px;
  --glass-bg: rgba(20, 20, 22, 0.75);
  --glass-border: rgba(255, 255, 255, 0.08);
}
```

**Key changes from current dark theme:**
- Removed green tint from backgrounds (`#0e1513` → `#0a0a0b`) — neutral is more professional
- Simplified accent to single blue — current teal+purple+green is busy
- Reduced glass blur from 20px to 16px — faster rendering, less visual noise
- Increased card opacity from 88% to 90% — better readability

### 7.2 Light Theme

```css
:root {
  /* Backgrounds */
  --color-bg-base: #fafafa;        /* Near-white */
  --color-bg-elevated: #ffffff;    /* Pure white for cards */
  --color-bg-card: rgba(255, 255, 255, 0.92); /* Cards */
  --color-bg-glass: rgba(255, 255, 255, 0.80); /* Glass */
  --color-bg-hover: rgba(0, 0, 0, 0.04);      /* Hover */

  /* Surfaces */
  --color-surface-1: #f4f4f5;      /* Panel background */
  --color-surface-2: #e4e4e7;      /* Inset areas */
  --color-surface-3: #d4d4d8;      /* Active states */

  /* Text */
  --color-text-primary: #09090b;   /* 18.6:1 contrast */
  --color-text-secondary: #52525b; /* 9.5:1 contrast */
  --color-text-tertiary: #71717a;  /* 5.3:1 contrast */
  --color-text-muted: #a1a1aa;     /* Decorative only */

  /* Accent */
  --color-primary: #2563eb;        /* Blue-600 */
  --color-primary-hover: #3b82f6;  /* Blue-500 */
  --color-primary-subtle: rgba(37, 99, 235, 0.10);

  /* Borders */
  --border: rgba(0, 0, 0, 0.08);
  --border-strong: rgba(0, 0, 0, 0.15);
  --divider: rgba(0, 0, 0, 0.06);

  /* Glass */
  --glass-blur: 16px;
  --glass-bg: rgba(255, 255, 255, 0.80);
}
```

### 7.3 Accent Color System

Replace current 4 presets with a proper HSL-based system:

```css
/* User picks hue, system derives the palette */
.accent-blue    { --accent-hue: 221; }
.accent-violet  { --accent-hue: 262; }
.accent-rose    { --accent-hue: 347; }
.accent-teal    { --accent-hue: 170; }
.accent-orange  { --accent-hue: 25;  }

:root {
  --color-primary: hsl(var(--accent-hue), 84%, 60%);
  --color-primary-hover: hsl(var(--accent-hue), 84%, 50%);
  --color-primary-subtle: hsla(var(--accent-hue), 84%, 60%, 0.15);
}
```

Benefits: One variable per accent, infinite color options, consistent saturation/lightness.

---

## Part 8: Developer Workflow Optimization

### 8.1 Workflow: Start New Feature

**Current flow (12 steps):**
1. Navigate to Projects page
2. Find project
3. Click to open detail
4. Navigate to Tasks tab
5. Create task
6. Navigate to Workspace
7. Open agent tab
8. Set CWD to project directory
9. Describe the feature
10. Agent works — no visibility into what it's doing
11. Switch to editor to review changes
12. Switch to git to commit

**Proposed flow (5 steps):**
1. `Cmd+K` → type project name → Enter (opens workspace at project)
2. `Cmd+T` → new agent tab (auto-CWD to project)
3. Type feature description → agent starts
4. Agent actions visible inline (tool calls, file edits)
5. `Cmd+Enter` in agent input → auto-commit with generated message

### 8.2 Workflow: Code Review

**Current flow:** Navigate to project → Git tab → click commits → view diff in center panel

**Proposed flow:**
1. Status bar shows "3 uncommitted changes" — click to open diff
2. Diff opens in editor panel (side-by-side with agent)
3. Agent can explain changes inline

### 8.3 Workflow: Debug Error

**Current flow:** Copy error from terminal → paste into agent → wait

**Proposed flow:**
1. Terminal shows error with clickable stack trace lines
2. Click error → opens file at line in editor
3. `Cmd+L` → "Fix this error" → agent gets file + error context automatically

### 8.4 Workflow: Quick Task

**Current flow:** Open workspace → open agent → type task → wait → review

**Proposed flow:**
1. `Cmd+K` → type task directly → Enter
2. Runs in background, notification on completion
3. Results viewable in agent tab or notification panel

---

## Part 9: Implementation Priority

### Phase 1 — Foundation ✅ 完成 (2026-06-24)
1. ~~Fix accent color theme bug (`main.tsx` memo dependency)~~ → 已修复：`useMemo` 依赖加入 `accent`，accent 切换后 Ant Design 主题立即重算
2. ~~Persist file panel width to localStorage~~ → 已实现：key `devhub_filePanelWidth`，拖拽松手自动持久化
3. ~~Remove dead `terminalExpanded` state~~ → **跳过**：实际已接底部面板 toggle UI + `BottomPanel`，非死代码
4. ~~Fix Pull button onClick handler~~ → 已修复：新增 `handlePull` + `pulling` loading 状态
5. ~~Wire up real data in OverviewTab git status card~~ → 已实现：`gitApi.branches` + `gitApi.status` 替换硬编码值

### Phase 2 — Layout ✅ 完成 (2026-06-24)
1. ~~Implement collapsible right panel (toggle + animation + persistence)~~ → 已实现：`panelCollapsed` 状态 + localStorage 持久化，折叠态显示 48px 图标栏（5 个图标竖排），点击图标展开到对应 tab；`Cmd+\` 快捷键切换
2. ~~Reduce agent tab bar to single row (36px)~~ → 已实现：删除 Row 2（4 个 quick command dropdown + 2 个 pill），minHeight 40→36，清除 ~220 行死代码
3. ~~Add status bar component (24px)~~ → 已实现：`StatusBar.tsx` 新组件，左侧 git 分支名、中间 agent 状态、右侧终端切换按钮，挂在 WorkspacePage 底部
4. ~~Implement bottom terminal panel (revive `terminalExpanded`)~~ → 确认可用：底部面板 toggle UI + `BottomPanel` 组件功能正常，StatusBar 终端按钮可触发切换
5. ~~Reduce icon rail from 52px to 48px~~ → 已实现：`MainLayout.tsx` railW 52→48

**Phase 2 布局结构变化：**
```
Before:  container (flex-row) → [agentArea | rightPanel]
After:   container (flex-col) → [mainRow (flex-row) → [agentArea | rightPanel]] + StatusBar(24px)
```

**关键文件变更：**
| 文件 | 变更类型 |
|------|----------|
| `src/stores/agentWorkspaceStore.ts` | 新增 `panelCollapsed` + `togglePanelCollapsed` |
| `src/features/workspace/agent/AgentRightPanel.tsx` | 重写：折叠态图标栏 + 展开态面板 |
| `src/features/workspace/agent/AgentTabBar.tsx` | 删除 Row 2 + 清除死代码（~220 行） |
| `src/features/workspace/components/StatusBar.tsx` | 新文件 |
| `src/features/workspace/WorkspacePage.tsx` | 挂载 StatusBar + `Cmd+\` 快捷键 + `streamingSessionId` |
| `src/shared/MainLayout.tsx` | railW 52→48 |

### Phase 3 — Command Palette (2-3 days) 🔲 待开始
1. Enhance SearchBox to full command palette
2. Add command registry (navigation, commands, files, actions)
3. Add fuzzy matching and recent items
4. Wire keyboard shortcuts

### Phase 4 — Structured Agent View (5-7 days) 🔲 待开始
1. Parse Claude stream-json into structured messages
2. Build chat bubble UI with tool call cards
3. Add structured/raw toggle
4. Implement slash command autocomplete in input area
5. Wire context panel to auto-track file access

### Phase 5 — Theme Refinement (2-3 days) 🔲 待开始
1. Neutral dark theme (remove green tint)
2. HSL-based accent system
3. Reduce `!important` overrides (target: <30)
4. Fix font-size preset rem consistency

### Phase 6 — Polish (3-5 days) 🔲 待开始
1. Project detail tab consolidation (10 → 6)
2. Layout presets (Agent Focus, Code+Agent, IDE, Multi-Agent)
3. Keyboard shortcut map (complete coverage)
4. NewProjectWizard fix (remove stubs, unify create flows)

---

## Part 10: DevHub vs Competitors — Positioning

### Unique Strengths to Preserve

| Strength | Why It Matters |
|----------|---------------|
| Multi-agent tabs | No competitor supports parallel agent sessions |
| Glassmorphism design | Distinctive visual identity (refine, don't remove) |
| Density modes | Accessibility advantage (comfortable/compact/dense) |
| Project health monitoring | Unique to DevHub — no competitor has this |
| Prompt template system | SDLC-aware templates are a differentiator |
| Full git client | Cursor has minimal git; DevHub has full 3-panel |

### Gaps to Close

| Gap | Competitor | Solution |
|-----|-----------|----------|
| Command palette | Cursor, Raycast, Linear | Enhanced SearchBox → full Cmd+K |
| Structured AI output | Claude Code, Cursor | Chat view with tool call cards |
| Keyboard shortcuts | Linear, Cursor, VS Code | Complete shortcut coverage |
| Inline AI edits | Cursor | Agent can edit files in editor pane |
| Context auto-detection | Claude Code | Auto-track opened files, git status |
| Status bar | VS Code, Cursor | ✅ 24px StatusBar 已实现 (Phase 2) |
| Split panes | VS Code, Warp | Multi-pane with presets |

### Market Position

> **DevHub: The AI-native project workspace.**
> Not just a code editor with AI bolted on — a workspace where agents, code, terminals, and project management coexist. Multi-agent parallelism, project health monitoring, and density-aware glassmorphism design — built for teams that ship.

---

*End of DevHub UI V3 Design Document*
