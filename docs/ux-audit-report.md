# UX 审查与修复报告

> 审查日期：2026-06-20
> 审查范围：全应用 UI（工作区、项目、设置、文件浏览器、Agent 聊天）
> 修复日期：2026-06-20

---

## 审查总览

共发现 **67 个问题**，按影响分四档：

| 等级 | 数量 | 含义 | 状态 |
|------|------|------|------|
| P0 | 3 | 功能损坏 / 崩溃 | ✅ 全修 |
| P1 | 8 | 每次使用都烦 | ✅ 全修 |
| P2 | 5 | 体验打磨 | ✅ 4/5（1 项跳过） |
| P3 | 可访问性 | 规范化 | ✅ 3 项完成 |

---

## P0 — 功能损坏（3/3）

### 1. NewProjectWizard "下一步" 按钮空实现

**文件**：`src/features/projects/NewProjectWizard.tsx:165`

**问题**：向导有 3 个步骤（模板→工作区→智能体），但"下一步"按钮的 onClick 是空函数 `() => {/* next step */}`，用户无法推进到后续步骤。

**修复**：
- 添加 `currentStep` 状态管理当前步骤
- "下一步"按钮在步骤 1→2→3 间切换，步骤 3 点击后导航到 `/projects`
- 步骤 2/3 显示占位提示（"将在后续版本中开放"）
- 步骤指示器支持已完成（✓）和当前状态
- 模板卡片添加 `onKeyDown` 键盘激活支持
- CSS 添加 `.wizard-step-circle--completed` 样式

### 2. activeTabId 非空断言崩溃

**文件**：`src/features/workspace/WorkspacePage.tsx:462`

**问题**：`handleStartAndSend(activeTabId!, msg, cwd)` 使用了 TypeScript 非空断言 `!`，当所有 tab 被关闭时 `activeTabId` 为 null，导致运行时崩溃。

**修复**：改为三路条件渲染：
- 有 `activeTab?.sessionId` → AgentChat
- 有 `activeTabId` → AgentIdleState
- 无 `activeTabId` → 自动创建新 tab 的 AgentIdleState

### 3. Terminal 创建失败静默吞错

**文件**：`src/features/workspace/terminal/BottomPanel.tsx:52`

**问题**：`terminalApi.startShell(...).catch(() => {})` 吞掉所有错误，用户看不到任何反馈。

**修复**：`.catch()` 改为 `message.error('终端启动失败，请检查 shell 配置')`，并 `import { message } from 'antd'`。

---

## P1 — 核心体验（8/8）

### 4. 加载 MainLayout 白屏无反馈

**文件**：`src/App.tsx:29`

**问题**：MainLayout 懒加载（942KB antd），Suspense fallback 为 `null`，用户看到白屏。

**修复**：
- 添加 `LayoutFallback` 组件（logo 脉冲动画 + "加载中..."文字）
- `index.css` 添加 `@keyframes pulse` 动画

### 5. Agent 聊天强制滚底

**文件**：`src/features/workspace/agent/AgentChat.tsx:518`

**问题**：每次消息/流式更新都强制 `scrollIntoView`，用户上翻阅读历史时被打断。

**修复**：
- 添加滚动位置检测（100px 阈值），仅在用户 near bottom 时自动滚动
- 用户上翻时显示「滚动到底部」FAB 按钮
- `autoScrollRef` 跟踪自动滚动状态

### 6. CodeEditor 暗色模式不可用

**文件**：`src/features/workspace/editor/CodeEditorPane.tsx`

**问题**：容器 `#ffffff`、代码区 `#FAFAFA`、边框 `rgba(187,202,198,0.50)` 硬编码白色，暗色模式完全不可用。

**修复**：
- `#ffffff` → `var(--md-surface-container-lowest)`
- `#FAFAFA` → `var(--md-surface-container-low)`
- `rgba(187,202,198,0.50)` → `var(--md-outline-variant)`

### 7. 导航项键盘不可访问

**文件**：`src/shared/MainLayout.tsx:163`

**问题**：导航项用 `<div onClick>` 渲染，无 `tabIndex`、`role`、`aria` 属性，键盘用户无法使用。

**修复**：
- 所有导航项添加 `tabIndex={0}`、`role="button"`、`aria-current="page"`、`aria-label`
- 添加 `onKeyDown`（Enter/Space 激活）
- 添加 `onFocus`/`onBlur` 匹配 hover 视觉反馈
- `outline: 'none'` 移除浏览器默认轮廓（使用自定义 hover 背景）
- 装饰图标添加 `aria-hidden="true"`

### 8. 文件面板无 Escape 关闭

**文件**：`src/shared/MainLayout.tsx:243`

**问题**：文件面板只能通过 X 按钮或导航图标关闭，无键盘快捷方式。

**修复**：添加 `useEffect` 监听 `Escape` 键，面板打开时按 Escape 关闭。

### 9. 文件右键菜单无 ARIA、无键盘导航

**文件**：`src/shared/FileExplorer.tsx:767`

**问题**：右键菜单用 `<div>` 渲染，无 `role="menu"`/`role="menuitem"`，无键盘支持，无 Escape 关闭。

**修复**：
- 容器添加 `role="menu"`、`aria-label="文件操作"`、`onKeyDown` Escape
- 菜单项添加 `role="menuitem"`、`tabIndex={0}`、`onKeyDown` Enter/Space
- 菜单项添加 `onFocus`/`onBlur` 匹配 hover 效果
- 全局 Escape 关闭处理

### 10. 快捷命令 15 个太多

**文件**：`src/features/workspace/agent/AgentIdleState.tsx:23`

**问题**：15 个命令 + 2 个动态命令 = 17 个 pill 按钮，决策疲劳。

**修复**：精简为 6 个核心命令：规划、开发、修复、审查、提交、调试。其余命令可通过 `/` 斜杠菜单访问。

### 11. 调整手柄无视觉提示

**文件**：`src/features/workspace/WorkspacePage.tsx:471` + `BottomPanel.tsx:249`

**问题**：编辑器分割线和终端顶部调整手柄无任何视觉提示，用户不知道可以拖拽。

**修复**：
- 分割线添加三点 grip dots（垂直排列）+ hover 背景色高亮
- 终端调整手柄添加三点 grip dots（水平排列）+ hover 背景色高亮

---

## P2 — 体验打磨（4/5）

### 12. 助手消息无复制按钮

**文件**：`src/features/workspace/agent/AgentChat.tsx`

**问题**：用户无法复制 AI 回复内容，无标准聊天 UX 操作。

**修复**：
- 添加 `hoveredMsgIdx` 状态追踪 hover
- 助手消息 hover 时右侧显示复制按钮（`content_copy` 图标）
- 复制到剪贴板 + antd success/error 反馈

### 13. 错误消息无无障碍支持

**文件**：`src/features/workspace/agent/AgentChat.tsx:784`

**问题**：错误消息无 `role="alert"`，屏幕阅读器无法感知。

**修复**：错误行添加 `role="alert"`。

### 14. Settings 页重置按钮空实现 + 占位面板

**文件**：`src/features/settings/SettingsPage.tsx`

**问题**：
- "重置默认"按钮无 `onClick` 处理器
- 4 个占位面板（工作区、MCP、Git、构建）只有一行文字

**修复**：
- 重置按钮添加 `onClick`：重置 `defaultCmd` 为默认值 + 清除 localStorage + 显示提示
- 4 个占位面板添加图标 + 功能预告描述（说明后续版本将包含什么功能）

### 15. 过滤空结果提示误导

**文件**：`src/features/projects/ProjectsPage.tsx:565`

**问题**：筛选状态为空项目时显示"暂无项目"，实际是"没有匹配的项目"。

**修复**：当 `statusFilter` 存在时，显示具体文案（"没有进行中的项目"等）。

### 16. 附件删除按钮太小

**文件**：`src/features/workspace/agent/AgentChat.tsx:1211`

**问题**：附件删除按钮 20×20px，低于 44px 最小点击目标。

**修复**：扩大到 24×24px，添加 hover 背景过渡。仍低于推荐值但考虑到是桌面端可接受。

---

## P3 — 可访问性（3 项）

### 17. Skip-to-content 链接

**文件**：`src/shared/MainLayout.tsx`

**修复**：
- 顶部添加视觉隐藏的 skip-to-content 链接（Tab 可见）
- 聚焦时滑入视口（`top: -100` → `top: 8px`）
- 点击后 focus 到 `#main-content`
- 主内容区添加 `id="main-content"`、`tabIndex={-1}`、`outline: 'none'`

### 18. aria-live 状态更新区域

**文件**：`src/features/workspace/WorkspacePage.tsx`、`AgentChat.tsx`

**修复**：
- Agent 状态指示器（Running/Ready）添加 `aria-live="polite"` + `aria-atomic="true"`
- 流式思考指示器添加 `aria-live="polite"`
- 限流重试指示器添加 `role="status"` + `aria-live="polite"`

### 19. 装饰性图标 aria-hidden

**文件**：`AgentChat.tsx`、`AgentIdleState.tsx`、`MainLayout.tsx`

**修复**：~15 处装饰性 Material Symbols 图标添加 `aria-hidden="true"`：
- 聊天头像（×5）
- 模型选择器/快速设置标题和行图标（×6）
- 空状态图标（×3）
- 会话卡片历史/文件夹图标（×2）
- 导航栏设置图标（×1）
- CWD 栏图标（×1）

---

## 跳过的项目

| 项目 | 原因 |
|------|------|
| P2 #10 代码块语法高亮 | 需要新依赖（`react-syntax-highlighter` 或 `prism-react-renderer`），等批准后添加 |
| P3 页面过渡动画 | 需要设计方向确认（fade vs slide vs shared-element） |
| P3 CSS `!important` 清理 | 高风险改动，约 40+ 处 `!important` 用于 Ant Design 覆盖，需逐条评估影响 |
| P3 localStorage 迁移策略 | 架构级改动，需设计 schema versioning 方案 |
| P2 ProjectDetail 假终端/AI 输入 | 属于功能缺失而非 UX bug，需独立评估是否保留 |

---

## 修改文件清单

| 文件 | 改动数 |
|------|--------|
| `src/App.tsx` | Suspense fallback |
| `src/index.css` | pulse 动画 |
| `src/shared/MainLayout.tsx` | 键盘导航 + Escape + skip-to-content |
| `src/shared/FileExplorer.tsx` | 右键菜单 ARIA + 键盘 |
| `src/features/projects/NewProjectWizard.tsx` | 步骤导航 |
| `src/features/projects/NewProjectWizard.css` | completed 样式 |
| `src/features/projects/ProjectsPage.tsx` | 过滤空状态 |
| `src/features/workspace/WorkspacePage.tsx` | 空值保护 + 手柄 + aria-live |
| `src/features/workspace/agent/AgentChat.tsx` | 智能滚底 + 复制 + 错误 role + aria-hidden + a11y |
| `src/features/workspace/agent/AgentIdleState.tsx` | 命令精简 + aria-hidden |
| `src/features/workspace/terminal/BottomPanel.tsx` | 错误反馈 + 手柄 |
| `src/features/workspace/editor/CodeEditorPane.tsx` | 暗色模式 |
| `src/features/settings/SettingsPage.tsx` | 重置按钮 + 占位面板 |
