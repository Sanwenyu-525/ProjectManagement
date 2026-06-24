# UI 优化全阶段 — 实施记录

> 日期：2026-06-23
> 状态：✅ 全部完成（P0 ~ P2）

## 背景

项目 UI 评估发现信息密度不足——开发者工具需要在视觉干净的前提下最大化信息量。通过 UI/UX Pro Max skill 评估后，按优先级分 P0-P2 三个阶段实施。

## 评估结论

| 优先级 | 问题 | 严重度 | 状态 |
|--------|------|--------|------|
| P0-1 | 信息密度不足（卡片/顶栏/聊天） | 🔴 高 | ✅ 已完成 |
| P0-2 | 微交互动画缺失（spring/stagger/页面过渡） | 🔴 高 | ✅ 已完成 |
| P1-1 | 视觉层次过于均匀（elevation/active indicator） | 🟡 中 | ✅ 已完成 |
| P1-2 | Typing indicator + loading states 缺失 | 🟡 中 | ✅ 已完成 |
| P1-3 | Disabled 状态 + focus-visible 补全 | 🟡 中 | ✅ 已完成 |
| P2-1 | Toast/undo 系统 | 🟢 低 | ✅ 已完成 |
| P2-2 | 页面路由过渡动画 | 🟢 低 | ✅ 已完成 |
| P2-3 | Keyboard shortcuts 可视化（`?` 快捷键面板） | 🟢 低 | ✅ 已完成 |

## 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 密度档位 | comfortable / compact / dense | 三档覆盖不同屏幕和偏好 |
| 切换方式 | themeStore + Settings UI | 用户随时可切换，localStorage 持久化 |
| CSS 机制 | `[data-density]` 类选择器 ×0.8/×0.6 缩放 | 沿用 fontSize 的 class 模式，零 JS 运行时开销 |
| 项目卡片 | 加 git 分支、进度条、构建状态、时间 | 开发者最关心的上下文信息 |
| 顶栏 | 52px → 38px compact，加 git 分支标签 | 释放垂直空间，补充版本控制信息 |
| Agent Chat | 12px 字体，加时间戳和模型名 | 提升对话可追溯性 |
| 动画方案 | 纯 CSS（`--ease-spring` + keyframes），无动画库 | 零新依赖，复用已有变量 |
| 动画降级 | `prefers-reduced-motion` 全局 kill switch（`design-system.css`） | 已有，无需额外代码 |
| 卡片层次 | `updatedAt` 24h 阈值，elevated vs normal shadow | 利用已有 `--card-shadow-elevated`，零新增变量 |
| Toast 方案 | Ant Design `message.open()` 自定义内容，不引入 sonner | 零新依赖，70+ 现有调用无需迁移 |
| Undo 方案 | 删除后"重新创建"近似 undo（仅 ProjectsPage） | 无需后端 soft-delete 支持 |
| 路由过渡 | `react-transition-group`（SwitchTransition + CSSTransition） | 专门路由过渡库，~4KB |
| 命令面板 | 扩展已有 SearchBox（Ctrl+K），不新建 | 避免重复，SearchBox 已支持分组命令 |

## 改动文件

### P0-1 信息密度
| 文件 | 改动 |
|------|------|
| `src/stores/themeStore.ts` | +`Density` 类型、`setDensity` 动作、localStorage 持久化 |
| `src/main.tsx` | +`data-density` 属性同步到 `<html>` |
| `src/shared/styles/variables.css` | +`.density-compact/dense` CSS 变量覆写、`--ease-spring` |
| `src/features/settings/SettingsPage.tsx` | +密度选择器 UI、左侧 active indicator（2px primary border） |
| `src/features/projects/ProjectsPage.tsx` | +compact 卡片模式、git 分支、进度条、构建状态、elevation 分层、stagger 入场、spring hover、toast + undo、Ctrl+N 支持 |
| `src/features/workspace/WorkspacePage.tsx` | +compact 顶栏 38px、git 分支标签、skeleton Suspense fallback |
| `src/features/workspace/agent/AgentGUIPanel.tsx` | +compact 聊天气泡、时间戳、模型名、thinking indicator、消息入场动画 |

### P0-2 微交互动画
| 文件 | 改动 |
|------|------|
| `src/shared/styles/variables.css` | +`--ease-spring` 裸 easing 变量 |
| `src/shared/styles/animations.css` | +`slideUpFade`、`cardEnter` keyframes |
| `src/index.css` | +`.thinking-dots` 样式、`.ant-modal` spring 打开动画、`.page-enter/exit` 路由过渡类 |

### P1-1 视觉层次
| 文件 | 改动 |
|------|------|
| `src/features/projects/ProjectsPage.tsx` | +`isRecent` 判断（updatedAt 24h），`--card-shadow-elevated` vs `--card-shadow` |

### P1-2 Loading States
| 文件 | 改动 |
|------|------|
| `src/features/workspace/agent/AgentGUIPanel.tsx` | +thinking dots indicator（streaming 且无 assistant 回复时） |
| `src/features/workspace/WorkspacePage.tsx` | Suspense fallback 纯文字 → skeleton shimmer |
| `src/features/projects/ProjectsPage.tsx` | `<Spin>` → 6 张 skeleton 卡片 |

### P1-3 可访问性
| 文件 | 改动 |
|------|------|
| `src/shared/styles/glassmorphism.css` | +`:disabled` 规则（opacity 0.38 + cursor not-allowed + pointer-events none） |
| `src/features/projects/ProjectsPage.tsx` | +`aria-haspopup="menu"` |

### P2-1 Toast/Undo
| 文件 | 改动 |
|------|------|
| `src/lib/toast.tsx`（新建） | `toastSuccess`（支持 undo 按钮）、`toastError`、`toastWarning` |
| `src/features/projects/ProjectsPage.tsx` | 14 处 `message.*` → toast 函数，项目删除加 undo |

### P2-2 路由过渡
| 文件 | 改动 |
|------|------|
| `package.json` | +`react-transition-group` 依赖 |
| `src/shared/MainLayout.tsx` | +`SwitchTransition` + `CSSTransition` 包裹 Outlet |

### P2-3 Keyboard Shortcuts
| 文件 | 改动 |
|------|------|
| `src/shared/ShortcutsModal.tsx`（新建） | 快捷键面板 Modal（6 个快捷键） |
| `src/shared/MainLayout.tsx` | +全局 keydown handler（`?`, `Ctrl+B`, `Ctrl+N`, `Ctrl+D`, `Ctrl+Shift+D`） |
| `src/shared/components/SearchBox.tsx` | +3 条 defaultCommands（查看快捷键/切换密度/切换主题） |
| `src/features/projects/ProjectsPage.tsx` | +`useSearchParams` 处理 `?new=true` 打开新建 Modal |

## 快捷键清单

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+K` | 搜索 / 命令面板 |
| `?` | 快捷键面板 |
| `Ctrl+B` | 切换文件浏览器 |
| `Ctrl+N` | 新建项目 |
| `Ctrl+D` | 切换密度（comfortable → compact → dense） |
| `Ctrl+Shift+D` | 切换暗色/亮色模式 |

输入焦点在 textarea/input 时，`?`、`Ctrl+D`、`Ctrl+Shift+D` 不触发。

## 提交记录

```
42c98ab7 feat(density): add density field to themeStore with DOM sync
8f13ad9d feat(density): add compact/dense CSS token overrides
137a91ad feat(density): add density picker to Settings > Appearance
40fcac71 feat(density): project cards — compact mode with git branch, progress, build status
8ffc63bf feat(density): summary bar — compact mode with git branch + separators
5e9b28e1 chore(density): remove unused userRow/assistantRow styles
（后续 P0-2 ~ P2-3 提交待补充 git log）
```

## 已知限制

- 项目卡片进度条宽度硬编码 60%（`ProjectWithStats` 无 `completedTasks` 字段，后续可动态化）
- dense 模式在小屏幕上可能过于紧凑，需实际使用验证
- 项目删除 undo 是"重新创建"近似恢复（不恢复 tasks/repos/docs 关联数据），需后端 soft-delete 支持才能完整实现
- SearchBox 中"查看快捷键"命令需要 ShortcutsModal 状态管理集成（当前只在 MainLayout 全局快捷键打开）
