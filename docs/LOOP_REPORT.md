# LOOP_REPORT.md — Loop #1

## 本轮发现

**扫描范围:** 4维度并行（项目结构、前端架构、Rust后端、构建配置）

### P0 发现 (4项)
| # | Issue | File | Status |
|---|-------|------|--------|
| P0-1 | Unnecessary `unsafe impl Send/Sync` | `src-tauri/src/db.rs:67-68` | ✅ FIXED |
| P0-2 | Migration errors silently swallowed | `src-tauri/src/db.rs:58-60` | ✅ FIXED |
| P0-3 | CSP disabled | `src-tauri/tauri.conf.json:24` | ⏳ Pending (需评估对终端功能的影响) |
| P0-4 | `files_delete` no path validation | `src-tauri/src/commands/files.rs:320` | ⏳ Pending |

### P1 发现 (13项)
- God files: WorkspaceNavigator(1022行), detect.rs(1781行), ProjectsPage(804行), FilePane(764行), workspaceStore(753行)
- Duplicate code: UID generation(14处), shell preference(6处)
- 20 eslint-disable, 8 `any` type, 9 exhaustive-deps suppressions
- No test framework, no CI/CD
- 2.1 MB main chunk, terminal exit polling

### P2 发现 (6项)
- Unused deps, empty dirs, dead migration code, mixed imports, LIKE full table scans

## 本轮修改

### 1. 移除不必要的 `unsafe impl Send/Sync` (P0-1)

**文件:** `src-tauri/src/db.rs`

`Database` 结构体包装 `r2d2::Pool<ConnectionManager>`。`ConnectionManager` 只持有 `PathBuf`（自动 `Send+Sync`），因此 `Pool` 自动是 `Send+Sync`。编译器可以安全推导这两个 trait。

手动 `unsafe impl` 不必要，削弱了编译器的并发安全检查能力。

**修改:** 删除第 67-68 行的 `unsafe impl Send/Sync`。

### 2. 迁移错误日志化 (P0-2)

**文件:** `src-tauri/src/db.rs`

原 `run_migration_sql` 使用 `let _ = conn.execute_batch(sql)` 静默丢弃所有错误。如果磁盘满、SQL损坏或任何迁移失败，应用会在不完整的 schema 下继续运行。

**修改:** 将 `let _ =` 替换为 `if let Err(e) = ...` + `eprintln!` 日志，确保错误可见但仍不阻止启动。

注意：ALTER TABLE 行（第 101-103 行）保持 `let _ =` — 那些"column already exists"错误是预期的。

## 修改文件

| File | Change |
|------|--------|
| `src-tauri/src/db.rs` | Removed 2 lines (unsafe impls), improved 3 lines (migration logging) |

## 风险评估

| Change | Risk | Rationale |
|--------|------|-----------|
| Remove unsafe impl | **极低** | cargo check 零错误零警告通过。编译器已自动推导 Send+Sync |
| Migration logging | **极低** | 仅添加 stderr 日志，不改变控制流。ALTER TABLE 保持静默 |

## 测试结果

| Check | Result |
|-------|--------|
| `cargo check` | ✅ 0 errors, 0 warnings |
| `npm run build` (tsc + vite) | ✅ Built in 15.66s |

## 下一轮计划

1. **P1-6:** 提取 `uid()` 共享工具函数 — 消除 14 处重复
2. **P1-7:** 提取 `getTerminalShell()` 共享工具函数 — 消除 6 处重复
3. **P0-3:** 评估 CSP 配置
