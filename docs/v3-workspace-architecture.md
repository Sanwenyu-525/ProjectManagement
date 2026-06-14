# V3 工作区架构设计

> 状态：Phase 1-5 已完成，V3.0-V4 已完成，V5 自动验证已实现
> 日期：2026-06-13

## 战略方向

**DevHub 是 Agent 操作系统，不是 Agent 本身。**

产品核心价值是 终端 + Agent + 浏览器 + 项目状态 的统一编排层。Agent 集成采用适配器模式——包装现有 CLI（Claude、Gemini、Codex），而非自研 AI。

---

## 已完成功能

### Phase 1: Pane 树核心

DIY 递归分屏布局，不用第三方库。

| 组件 | 文件 | 说明 |
|------|------|------|
| 类型定义 | `src/shared/workspace/types.ts` | `PaneLeaf` / `PaneSplit` / `PaneTab` / `WorkspaceLayout` |
| 状态管理 | `src/stores/workspaceStore.ts` | Zustand store，树操作 + 持久化 |
| 递归渲染 | `src/shared/workspace/WorkspacePane.tsx` | `SplitNode` 递归渲染分屏 |
| 拖拽分割 | `src/shared/workspace/PaneDivider.tsx` | 拖拽调整面板大小 |
| 标签栏 | `src/shared/workspace/PaneTabBar.tsx` | 标签切换、关闭、状态指示 |

**类型结构：**
```typescript
interface PaneLeaf {
  type: 'leaf'; id: string; tabIds: string[]; activeTabId: string | null;
}
interface PaneSplit {
  type: 'split'; id: string; direction: 'horizontal' | 'vertical';
  children: PaneNode[]; sizes: number[];
}
type PaneNode = PaneLeaf | PaneSplit;

interface PaneTab {
  id: string; label: string;
  contentType: 'terminal' | 'agent' | 'browser' | 'build' | 'log';
  status?: 'running' | 'exited' | 'error';
  runtimeId?: string;  // Agent 适配器 ID
  shell?: string;      // 终端 shell 路径
  cwd?: string;        // 终端工作目录
}
```

### Phase 2: 终端集成

在工作区面板中运行真实终端。

- `src/shared/workspace/TerminalLeafContent.tsx` — 桥接 terminalStore 和 workspace
- 通过 `terminalApi.startShell()` 创建真实 PTY 终端
- xterm.js 渲染，支持终端输入/输出
- 切换工作区时自动从 tab 元数据重建缺失终端

### Phase 3: Navigator + 工具栏

左侧资源树 + 顶部工作区标签切换。

- `src/shared/workspace/WorkspaceNavigator.tsx` — 左侧边栏，终端/Agent/构建三个分区
- `src/shared/workspace/WorkspaceToolbar.tsx` — 顶部标签栏，内联创建工作区
- `src/shared/workspace/WorkspacePreview.tsx` — 主编排器
- 快捷键：Ctrl+`` ` `` 终端面板，Ctrl+Shift+`` ` `` 工作区面板

### Phase 4: 工作区持久化

布局保存到 SQLite，localStorage 作为快速备份。

- 后端命令：`workspaces_save_layout` / `workspaces_load_layout`
- 迁移文件：`src-tauri/migrations/006_workspace_layout.sql`
- 防抖保存（500ms）+ localStorage 即时备份
- 切换工作区时从后端加载布局并重建终端

### Phase 5: Agent CLI 适配器

Agent = 运行特定 CLI 命令的终端。

| 组件 | 文件 | 说明 |
|------|------|------|
| 运行时定义 | `src/shared/workspace/agent-runtimes/types.ts` | `AgentRuntime` 接口 + 注册表 |
| Agent 面板 | `src/shared/workspace/AgentPane.tsx` | 启动 shell → 发送命令 → 渲染输出 |

**当前支持：**
- `claude` — Claude CLI (`claude`)

**添加新 Agent：** 在 `AGENT_RUNTIMES` 加一条记录即可。

### Phase 5.5: 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+1~9` | 切换到第 N 个面板 |
| `Ctrl+Shift+C` | 新建终端 |
| `Ctrl+Shift+A` | 新建 Claude Agent |
| `Ctrl+Shift+W` | 关闭当前面板 |
| `Ctrl+`` ` `` | 终端面板 |
| `Ctrl+Shift+`` ` `` | 工作区面板 |

焦点状态：点击面板获得紫色内边框指示，快捷键作用于当前焦点面板。

---

## 待实现功能

### Phase 6: Project Browser

不是内嵌 Chrome，是服务于项目的 **验证层**。

核心闭环：

```
Terminal → 构建运行
Agent    → 编写代码
Browser  → 验证结果
```

Browser 是第五个 Pane（Terminal / Agent / Browser / Build / Log），不是独立窗口。

---

#### 技术方案

iframe（MVP），不需要 Tauri 多 WebView。

| 方案 | 优点 | 缺点 |
|------|------|------|
| **iframe** ✅ | 零 Rust 改动、与 pane 模式一致、localhost 无 CORS | 跨域受限（开发场景无此问题） |
| Tauri 多 WebView | 完整浏览器能力 | Rust 端需创建子 WebView，生命周期复杂 |

升级路径：V4 阶段若需要跨域能力，可升级为 Tauri 多 WebView。

---

#### 类型扩展

`src/shared/workspace/types.ts`：

```typescript
export interface PaneTab {
  id: string;
  label: string;
  contentType: 'terminal' | 'agent' | 'browser' | 'build' | 'log';
  status?: 'running' | 'exited' | 'error';
  runtimeId?: string;   // agent
  shell?: string;       // terminal
  cwd?: string;         // terminal
  // browser
  url?: string;
  urlHistory?: string[];
  urlHistoryIndex?: number;
}
```

---

#### V3.0 — 基础浏览器

**目标：** 能预览本地开发服务器，能切换多个预览。

**能力：**
- iframe 渲染，地址栏输入 URL 导航
- 后退 / 前进 / 刷新
- 多预览切换（Frontend / Swagger / Storybook）
- Workspace 持久化浏览器标签状态

**Preview 自动发现：**

Terminal 输出检测 `localhost:PORT` 模式：

| 框架 | 模式 |
|------|------|
| Vite | `Local:   http://localhost:5173/` |
| Next.js | `- Local:        http://localhost:3000` |
| webpack | `http://localhost:8080` |

检测到后在 Navigator 显示快捷入口：

```
Previews
  ● Frontend        localhost:5173
  ● Swagger         localhost:8080/swagger
  ● Storybook       localhost:6006
```

点击直接打开。

**组件：**

```
src/shared/workspace/
├── BrowserPane.tsx           # iframe 渲染 + 工具栏
└── BrowserToolbar.tsx        # URL 栏 + 后退/前进/刷新
```

**布局：**

```
┌ BrowserToolbar ────────────────────────────────┐
│  ← → ↻  │  localhost:5173               │ 📋  │
├───────────────────────────────────────────────┤
│                                               │
│            <iframe src={url} />               │
│                                               │
└───────────────────────────────────────────────┘
```

**URL 历史管理（workspaceStore）：**

```typescript
pushHistory(tabId, url)  // 截断 index+1，push，index++，上限 50
goBack(tabId)            // index--，更新 tab.url
goForward(tabId)         // index++，更新 tab.url
```

**快捷键：** `Ctrl+Shift+B` 新建浏览器标签

**实现步骤：**

1. 扩展 PaneTab 类型 → `url` / `urlHistory` / `urlHistoryIndex`
2. workspaceStore → `pushHistory` / `goBack` / `goForward`
3. BrowserToolbar 组件 → URL 栏 + 导航按钮
4. BrowserPane 组件 → iframe + 工具栏
5. WorkspacePane 路由 → `contentType === 'browser'` 分支
6. Navigator 集成 → "浏览器" 分区
7. 快捷键 → `Ctrl+Shift+B`
8. Preview 发现 → terminal 输出正则匹配

---

#### V3.5 — 浏览器开发工具 + Agent 联动

**目标：** 浏览器成为 Agent 的眼睛，不再是哑渲染。

---

**Console 集成：**

Browser 底部面板：

```
┌ BrowserPane ───────────────────────────────────┐
│  ← → ↻  │  localhost:5173               │ 📋  │
├───────────────────────────────────────────────┤
│                                               │
│           React App 渲染区                     │
│                                               │
├ Console ──────────────────────────────────────┤
│  ❌ ReferenceError: xxx is not defined         │
│     at Button.tsx:52                          │
│                                                 │
│  ⚠️ Warning: Each child in a list...           │
└───────────────────────────────────────────────┘
```

通过 iframe `contentWindow.console` 拦截 `error` / `warn` / `log`，显示在面板底部。

---

**Network 精简版：**

```
/api/login          500   23ms
/api/user           200   12ms
/assets/main.css    200    3ms
```

通过 iframe `contentWindow.fetch` 包装，拦截请求/响应，记录 URL、状态码、耗时。

点击行展开：

```json
{
  "message": "token expired"
}
```

---

**截图发送 Agent：**

Browser 工具栏新增按钮（或右键菜单）：

```
[📸 截图] → 保存当前 iframe 截图 → 附加到 Agent 上下文
```

Agent 收到：

```
用户发送了页面截图，附带消息：
"这个页面布局有什么问题？"
```

比手动截图粘贴到 Claude 强很多——上下文自动关联当前页面。

---

**Console 错误 → Agent：**

```
❌ ReferenceError: xxx is not defined
   at Button.tsx:52

[🔧 修复此错误]
```

点击后自动构造 Agent 指令：

```
修复此错误：
ReferenceError: xxx is not defined
文件：src/components/Button.tsx
行：52

相关代码：
<自动读取该文件上下文>
```

---

**实现步骤：**

1. BrowserPane 底部可折叠面板 → Console
2. iframe 拦截 console.error / console.warn
3. Network 请求拦截（fetch 包装）
4. 截图 API → `html2canvas` 或 iframe `postMessage` + `toBlob`
5. "修复此错误" 按钮 → 构造 Agent 指令并发送
6. Navigator 显示 Console 错误计数

---

#### V4 — 智能浏览器

**目标：** 元素检查 + 浏览器自动化，Browser 成为 Agent 的手和眼。

---

**元素检查（轻量 Dev Inspector）：**

iframe 内注入脚本，监听点击，高亮元素，上报信息：

```
用户点击：
  Button "提交"

显示：
  文件：src/components/SubmitButton.tsx
  行号：52
  组件：<SubmitButton />

操作：
  [在 Agent 中打开]
```

Agent 收到完整上下文：文件路径 + 组件名 + 元素属性，直接开始工作。

---

**浏览器自动化（Browser Agent）：**

Agent 不只写代码，还能操作浏览器验证：

```
Agent 指令："测试登录功能"

Browser 执行：
  1. 打开 localhost:5173/login
  2. 填写 username: testuser
  3. 填写 password: 123456
  4. 点击 "登录" 按钮
  5. 等待页面跳转
  6. 截图 → 验证登录成功
```

技术路径：通过 iframe `postMessage` 注入操作指令，或 iframe 内注入 Playwright-like 脚本。

---

**"Agent 修复 UI" 工作流：**

```
用户在 Browser 中看到问题
        ↓
右键元素 → "交给 Agent"
        ↓
Agent 收到：截图 + 元素信息 + 源码位置
        ↓
Agent 修改代码
        ↓
Browser 自动刷新
        ↓
用户确认修复
```

---

#### V4 — 已实现

**元素检查 ✅**
- `INSPECT_SCRIPT` 注入 iframe，hover 高亮 + click 上报
- inspect 面板显示 tag/id/class/size/text
- "交给 Agent" 按钮自动构造结构化 prompt

**浏览器自动化 ✅**
- `browserAutomationScript.ts` — 注入 iframe 的自动化脚本
- 支持命令：`navigate` / `click` / `fill` / `wait` / `scroll` / `screenshot`（DOM 分析）
- Agent 命令格式：`[devhub-browser:<tabId>] <action> <args>`
- BrowserPane 监听 `terminal-output` 事件，拦截并执行命令
- 结果通过 `terminalApi.input()` 注入回 Agent 终端

**截图 ✅（双模式）**
- DOM 分析：`screenshot` → 返回页面结构（title/headings/buttons/inputs/forms/text）
- 像素截图：`pixel-screenshot` → `tauri-plugin-screenshots` 捕获窗口 → 保存 PNG 到 `{app_data}/tauri-plugin-screenshots/`

**命令协议：**

```
Agent 终端输出：[devhub-browser:browser-xxx] navigate http://localhost:5173/login
                [devhub-browser:browser-xxx] fill input[name="username"] testuser
                [devhub-browser:browser-xxx] click #login-button
                [devhub-browser:browser-xxx] wait .dashboard
                [devhub-browser:browser-xxx] screenshot
```

BrowserPane 拦截 → postMessage 到 iframe → 执行 → 结果注入回 Agent 终端。

**V5 验证命令 ✅：**
- `verify` 命令支持 8 种检查：`exists` / `not-exists` / `text` / `value` / `visible` / `count` / `url` / `title`
- Agent 命令格式：`[devhub-browser:<tabId>] verify <check> <selector> [expectedValue]`
- 结果返回 `[verify] ✅` 或 `[verify] ❌` + 详情

**V5 测试报告协议：**

Agent 使用 V4 命令 + V5 verify 自主执行测试，输出标准化报告：

```
# 测试: 登录功能
1. ✅ navigate → http://localhost:5173/login
2. ✅ fill input[name="user"] → testuser
3. ✅ fill input[name="pass"] → 123456
4. ✅ click #login-btn
5. ✅ wait .dashboard
6. ✅ verify url dashboard → ✅ URL matches
7. ✅ verify text h1 Welcome → ✅ Text matches
结果: 7/7 通过
```

**V5 Scenario 批量命令：**

Agent 可一次执行多步测试场景，无需逐条等待：

```
[devhub-browser:<tabId>] scenario <label> <base64-JSON-steps>
```

步骤格式（JSON + base64 编码）：
```json
[
  {"action":"navigate","url":"http://localhost:5173/login"},
  {"action":"fill","selector":"#username","value":"testuser"},
  {"action":"fill","selector":"#password","value":"123456"},
  {"action":"click","selector":"#login-btn"},
  {"action":"wait","selector":".dashboard","timeout":10000},
  {"action":"verify","check":"text","selector":"h1","value":"Welcome"}
]
```

返回结构化报告：
```
[scenario] 测试: 登录功能 (6/6 通过)
  ✅ 1. navigate → http://localhost:5173/login
  ✅ 2. fill #username → testuser
  ✅ 3. fill #password → 123456
  ✅ 4. click #login-btn
  ✅ 5. wait .dashboard [3200ms]
  ✅ 6. verify text h1 Welcome → Welcome
  耗时: 8.2s
```

**实现细节：**
- 场景执行完全在 iframe 注入脚本内，一次 postMessage → 一次 result 返回
- 每步有 try/catch，失败不中断后续步骤
- `navigate` 作为中间步骤时，通过 localStorage 传递剩余步骤到新页面继续执行
- 测试报告自动存储到 workspaceStore（localStorage，上限 50 条）
- Navigator 侧边栏显示"测试报告"区域，可展开查看步骤详情

---

#### V5 — 自动验证 ✅

**目标：** Agent 自动测试、自动验收、自动回归。

---

**Agent 自动测试：**

```
Agent 任务："修复登录 bug"
    ↓
Agent 修改代码
    ↓
Browser 自动打开登录页
    ↓
自动输入测试账号
    ↓
自动点击登录
    ↓
截图验证
    ↓
通过 → 标记任务完成
失败 → Agent 继续修复
```

---

**自动验收：**

```
用户："验证这个 PR 的所有功能点"
    ↓
Agent 读取 PR 描述
    ↓
提取功能点列表
    ↓
逐个在 Browser 中验证
    ↓
输出验收报告：
  ✅ 登录功能正常
  ✅ 列表页渲染正常
  ❌ 导出按钮点击无响应
```

---

**回归测试：**

```
Agent："检查最近修改是否影响已有功能"
    ↓
Browser 遍历关键页面
    ↓
截图对比（与上次快照）
    ↓
输出差异报告
```

---

#### Project Browser 能力总览

| 版本 | 能力 | 核心价值 | 状态 |
|------|------|----------|------|
| V3.0 | iframe + 多预览 + 持久化 | 能看 | ✅ |
| V3.5 | Console + Network + 截图→Agent | 能诊断 | ✅ |
| V4 | 元素检查 + 浏览器自动化 + DOM 分析 | 能操作 | ✅ |
| V5 | 自动测试 + 自动验收 + 回归测试（verify + scenario 命令） | 能验证 | ✅ |

最终形态：

```
Terminal → 构建运行
Agent    → 编写代码
Browser  → 验证结果
```

三者闭环，Project Browser 成为 DevHub 除了 Agent Workspace 之外，第二个核心竞争力模块。

---

## 架构决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| Pane 库 | DIY 递归树 | flexlayout-react 不支持自定义内容，react-mosaic 太重 |
| Agent 模式 | 适配器包装 CLI | 不自研 AI，专注编排层 |
| 状态管理 | Zustand | 轻量、 selector 模式避免不必要的重渲染 |
| 持久化 | SQLite + localStorage 双写 | SQLite 持久，localStorage 快速恢复 |
| 终端 | xterm.js + portable_pty | 已有基础设施，复用 |
| Browser 名称 | Project Browser | 不是内嵌 Chrome，服务于项目开发 |
| Browser 嵌入 | iframe（V3.0） | localhost 无 CORS、零 Rust 改动；V4 可升级 Tauri 多 WebView |
| Browser↔Agent | 截图/错误/元素→Agent 上下文 | Browser 是 Agent 的眼睛，核心价值在联动 |
| Preview 发现 | terminal 输出正则匹配 | 自动检测 localhost:PORT，零配置 |

## 关键文件索引

```
src/shared/workspace/
├── types.ts                    # Pane 类型定义
├── WorkspacePreview.tsx        # 主编排器
├── WorkspacePane.tsx           # 递归分屏渲染（含 browser 路由）
├── WorkspaceToolbar.tsx        # 工作区标签栏
├── WorkspaceNavigator.tsx      # 左侧资源树（含 Preview 发现）
├── WorkspaceShortcuts.tsx      # 键盘快捷键
├── PaneDivider.tsx             # 拖拽分割线
├── PaneTabBar.tsx              # 标签栏
├── TerminalLeafContent.tsx     # 终端面板（含自动重建）
├── AgentPane.tsx               # Agent 面板
├── BrowserPane.tsx            # Project Browser（iframe + 自动化拦截）
├── BrowserToolbar.tsx         # URL 栏 + 后退/前进/刷新 + 截图 + 元素检查
├── BrowserDevTools.tsx        # Console + Network 面板（合并实现）
├── browserAutomationScript.ts # [V4] 自动化注入脚本（navigate/click/fill/wait/screenshot）
└── agent-runtimes/
    └── types.ts                # Agent 运行时注册表

src/stores/
├── workspaceStore.ts           # 工作区状态（含 URL 历史管理）
└── terminalStore.ts            # 终端状态（含 Preview 发现事件）
```
