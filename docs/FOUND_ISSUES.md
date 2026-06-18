# FOUND_ISSUES.md — Loop #1

## P0 (Critical)

| # | Issue | File | Description |
|---|-------|------|-------------|
| P0-1 | Unnecessary `unsafe impl` | `src-tauri/src/db.rs:67-68` | `unsafe impl Send/Sync for Database` is unnecessary — `r2d2::Pool` is auto `Send+Sync`. Undermines compiler safety. |
| P0-2 | Migration errors silently swallowed | `src-tauri/src/db.rs:59` | `run_migration_sql` uses `let _ = conn.execute_batch(sql)` — discards ALL errors including genuine failures. App proceeds with incomplete schema. |
| P0-3 | CSP disabled | `src-tauri/tauri.conf.json:24` | `"csp": null` removes all XSS protection. |
| P0-4 | `files_delete` no path validation | `src-tauri/src/commands/files.rs:320-333` | Recursive deletion on arbitrary paths — no bounds checking. |

## P1 (Important)

| # | Issue | File | Description |
|---|-------|------|-------------|
| P1-1 | God component: WorkspaceNavigator | `src/shared/workspace/WorkspaceNavigator.tsx` | 1022 lines — does too much |
| P1-2 | God component: ProjectsPage | `src/features/projects/ProjectsPage.tsx` | 804 lines |
| P1-3 | God component: FilePane | `src/shared/workspace/FilePane.tsx` | 764 lines |
| P1-4 | God store: workspaceStore | `src/stores/workspaceStore.ts` | 753 lines — manages pane tree, tabs, browser logs, automation, file panel |
| P1-5 | God file: detect.rs | `src-tauri/src/commands/detect.rs` | 1781 lines — monolithic detection module |
| P1-6 | Duplicate UID generation | 14 occurrences across 8 files | `Math.random().toString(36).slice(2, 10)` copy-pasted |
| P1-7 | Duplicate shell preference lookup | 6 occurrences across 5 files | `localStorage.getItem('devhub_terminal_shell')` |
| P1-8 | 20 eslint-disable comments | 9 exhaustive-deps, 9 any, 2 other | Stale closure risk from suppressed deps |
| P1-9 | 8 `any` type usages | 8 files | Weak type safety |
| P1-10 | No test framework | — | Zero tests, no test runner configured |
| P1-11 | No CI/CD | — | No automated pipeline |
| P1-12 | Bundle size: 2.1 MB main chunk | `vite.config.ts` | Missing code-splitting for echarts, xterm, CM langs |
| P1-13 | Terminal exit polling | `src-tauri/src/commands/terminal.rs:151-179` | 500ms sleep loop instead of `child.wait()` |

## P2 (Optimization)

| # | Issue | File | Description |
|---|-------|------|-------------|
| P2-1 | Unused deps: dayjs, react-markdown | `package.json` | Imported nowhere |
| P2-2 | Empty legacy dirs | `client/`, `server/`, `design-system/` | Dead directories |
| P2-3 | Dead migration code | `migrations/001_init.sql` | `users` table created then dropped in 002 |
| P2-4 | `projects.rs:933` references dropped `users` table | `src-tauri/src/commands/projects.rs` | INSERT will silently fail |
| P2-5 | Mixed static/dynamic imports | `workspaceStore.ts`, `plugin-dialog` | Vite code-splitting warnings |
| P2-6 | global_search LIKE full table scans | `src-tauri/src/commands/search.rs` | No index optimization |

---

**Loop #1 Target:** P0-1 (unsafe impl removal) + P0-2 (migration error handling)
