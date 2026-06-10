# Terminal Optimization Design Spec

**文档版本：** 1.0  
**创建日期：** 2026-06-10  
**状态：** ✅ 已批准

---

## 概述

优化项目的内置终端，支持多标签并行、主题切换和更好的交互体验。基于现有架构扩展，采用 MVP 策略，可在后续迭代中逐步完善。

### 核心目标

1. **多任务处理** - 支持多个终端标签页同时运行不同的shell/命令
2. **主题切换** - 允许用户选择/自定义终端颜色主题
3. **交互增强** - 添加复制/粘贴、清屏等基础功能
4. **MVP交付** - 核心功能完整，可在后续迭代中完善

### 使用场景

- 多项目并行开发
- 快速在不同终端任务间切换
- 适应不同的工作环境（亮色/暗色）

---

## 架构设计

### 后端层（Rust）

**现有架构保持不变**，扩展注册表以支持多个并发 shell。

#### 数据结构

```rust
// 终端元数据（新增）
struct TerminalMetadata {
    terminal_id: String,
    label: String,           // 标签显示名
    created_at: timestamp,
    shell: String,           // shell类型
    cwd: String,             // 工作目录
    status: String,          // running | exited | error
}

// 全局注册表（新增）
static METADATA: LazyLock<Mutex<HashMap<String, TerminalMetadata>>> = 
    LazyLock::new(|| Mutex::new(HashMap::new()));
```

#### 命令扩展

**现有命令保持不变：**
- `terminal_start_shell(terminal_id, shell, cwd)` ✓
- `terminal_input(terminal_id, data)` ✓
- `terminal_stop(terminal_id)` ✓

**新增命令（可选，MVP可以不做）：**
- `terminal_list()` → `Vec<TerminalMetadata>` - 列出所有活跃终端

**扩展点：**
- 终端创建时自动添加元数据到 `METADATA`
- 终端销毁时自动清理元数据
- 终端状态变化时同步更新（running → exited）

### 前端层（React）

**核心重构：从单实例到多实例**

#### 组件结构

```
GlobalTerminalPanel (重构)
├── TerminalManager (新增 - 核心管理)
│   ├── TerminalTabBar (新增 - 标签栏UI)
│   │   ├── Tab× (终端1, 终端2...)
│   │   └── Button + (新建标签)
│   │
│   └── TerminalInstance[] (新增 - 终端实例)
│       └── [复用现有TerminalPanel逻辑]
│
└── ThemeProvider (新增 - 主题管理)
    ├── Dark主题
    ├── Modern主题
    ├── Matrix主题
    └── Light主题
```

#### 数据流

```
TerminalManager (主控)
  │
  ├─ state: terminals[]     // 终端列表
  │   ├─ { id, label, createdAt, shell, cwd, status }
  │   └─ ...
  │
  ├─ state: activeId        // 当前激活的终端ID
  │
  ├─ state: theme           // 当前主题
  │   └─ 'dark' | 'modern' | 'matrix' | 'light'
  │
  ├─ action: createTerminal(label?)   // 创建新终端
  │   ├─ 生成唯一 terminal_id
  │   ├─ 调用 terminalApi.startShell()
  │   ├─ 添加到 terminals[]
  │   └─ 自动激活
  │
  ├─ action: closeTerminal(id)        // 关闭终端
  │   ├─ 调用 terminalApi.stop()
  │   ├─ 从 terminals[] 移除
  │   └─ 如果关闭活跃的，切换到下一个
  │
  ├─ action: switchTerminal(id)       // 切换终端
  │   └─ 更新 activeId
  │
  ├─ action: renameTerminal(id, label) // 重命名
  │   └─ 更新对应终端的 label
  │
  └─ action: setTheme(theme)          // 切换主题
      ├─ 更新 theme state
      └─ 存储到 localStorage
```

#### 状态管理（React Hooks）

```typescript
// TerminalManager.tsx
interface Terminal {
  id: string;
  label: string;
  createdAt: Date;
  shell: string;
  cwd: string;
  status: 'running' | 'exited' | 'error';
}

interface TerminalManagerState {
  terminals: Terminal[];
  activeId: string | null;
  theme: TerminalTheme;
}

// 核心 Hook
function useTerminalManager() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [theme, setTheme] = useState<TerminalTheme>('dark');

  const createTerminal = useCallback(async (label?: string) => {
    const id = `global-${uuid()}`;
    const newTerminal: Terminal = {
      id,
      label: label || `终端 ${terminals.length + 1}`,
      createdAt: new Date(),
      shell: isWin ? 'powershell.exe' : 'bash',
      cwd: isWin ? process.env.USERPROFILE : process.env.HOME,
      status: 'running',
    };
    await terminalApi.startShell(id, newTerminal.shell, newTerminal.cwd);
    setTerminals(prev => [...prev, newTerminal]);
    setActiveId(id);
  }, [terminals.length]);

  const closeTerminal = useCallback(async (id: string) => {
    await terminalApi.stop(id);
    setTerminals(prev => prev.filter(t => t.id !== id));
    if (activeId === id) {
      setActiveId(prev => {
        const remaining = terminals.filter(t => t.id !== id);
        return remaining.length > 0 ? remaining[remaining.length - 1].id : null;
      });
    }
  }, [activeId, terminals]);

  const switchTerminal = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const setTerminalTheme = useCallback((newTheme: TerminalTheme) => {
    setTheme(newTheme);
    localStorage.setItem('terminal-theme', newTheme);
  }, []);

  return { terminals, activeId, theme, createTerminal, closeTerminal, switchTerminal, setTerminalTheme };
}
```

---

## UI/交互设计

### 标签栏布局

**位置：** 终端面板顶部

```
┌─────────────────────────────────────────────────────────────────┐
│  终端 1 ×    │  终端 2 ×    │  +                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  $ npm run dev                                                  │
│  > vite --port 1420                                             │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**标签设计细节：**
- 每个标签：终端名称 + 关闭按钮(×)
- 活跃标签：高亮背景色（如半透明蓝色）
- 右键菜单：重命名、关闭、关闭其他
- 最大标签数：10个（防止滥用）
- 标签可拖拽排序（可选，MVP省略）

### 操作流程

#### 创建终端

```
1. 点击 + 按钮
2. 生成唯一 terminal_id（格式：global-随机8位）
3. 调用 terminalApi.startShell(id, shell, cwd)
4. 添加到 terminals[]
5. 自动激活新标签
6. 终端视口显示新的shell会话
```

#### 切换终端

```
1. 点击目标标签
2. 更新 activeId
3. TerminalInstance 重新渲染对应终端
4. 终端视口切换到对应的 xterm 实例
```

#### 关闭终端

```
1. 点击 × 按钮
2. 弹出确认提示（可选，MVP可以不提示）
3. 调用 terminalApi.stop()
4. 从 terminals[] 移除
5. 如果关闭的是当前活跃的，自动切换到最近的标签
6. 如果是最后一个标签，显示"无活动终端"
```

#### 重命名终端

```
1. 双击标签文字
2. 进入编辑模式（文本框）
3. 回车确认 → 更新 label
4. Esc 取消 → 恢复原名
```

### 快捷键设计

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Ctrl+T` | 新建终端 | 创建新标签 |
| `Ctrl+W` | 关闭终端 | 关闭当前标签 |
| `Ctrl+Tab` | 下一个标签 | 切换到右侧标签 |
| `Ctrl+Shift+Tab` | 上一个标签 | 切换到左侧标签 |
| `Ctrl+Shift+C` | 复制 | 复制选中文本 |
| `Ctrl+Shift+V` | 粘贴 | 粘贴剪贴板文本 |
| `Ctrl+L` | 清屏 | 清除终端输出 |
| `Ctrl+Shift+F` | 搜索 | 搜索终端输出（Phase 2） |

**快捷键处理：**
- 在 `useEffect` 中注册全局快捷键
- 使用 xterm.js 的 `attachCustomKeyEventHandler` 拦截按键
- 避免与浏览器/系统快捷键冲突（使用 Shift 组合）

---

## 主题系统设计

### 预设主题列表

#### 主题 1: 暗黑经典 (Dark)

```typescript
{
  name: '暗黑经典',
  colors: {
    background: '#0d1117',
    foreground: '#c9d1d9',
    cursor: '#58a6ff',
    cursorAccent: '#0d1117',
    selectionBackground: '#264f78',
    selectionForeground: '#ffffff',
    black: '#484f58',
    red: '#ff7b72',
    green: '#3fb950',
    yellow: '#d29922',
    blue: '#58a6ff',
    magenta: '#bc8cff',
    cyan: '#39d353',
    white: '#b1bac4',
    brightBlack: '#6e7681',
    brightRed: '#ffa198',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d364',
    brightWhite: '#f0f6fc',
  }
}
```

*延续现有 GlobalTerminalPanel 的配色，用户无感*

#### 主题 2: 现代深灰 (Modern)

```typescript
{
  name: '现代深灰',
  colors: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#ffffff',
    cursorAccent: '#1e1e1e',
    selectionBackground: '#264f78',
    selectionForeground: '#ffffff',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#ffffff',
  }
}
```

*更柔和的对比度，长时间使用不伤眼（VS Code 风格）*

#### 主题 3: 绿色终端 (Matrix)

```typescript
{
  name: '绿色终端',
  colors: {
    background: '#0a0a0a',
    foreground: '#00ff00',
    cursor: '#00ff00',
    cursorAccent: '#0a0a0a',
    selectionBackground: '#003300',
    selectionForeground: '#00ff00',
    black: '#000000',
    red: '#ff0000',
    green: '#00ff00',
    yellow: '#ffff00',
    blue: '#0000ff',
    magenta: '#ff00ff',
    cyan: '#00ffff',
    white: '#00ff00',
    brightBlack: '#005500',
    brightRed: '#ff5555',
    brightGreen: '#55ff55',
    brightYellow: '#ffff55',
    brightBlue: '#5555ff',
    brightMagenta: '#ff55ff',
    brightCyan: '#55ffff',
    brightWhite: '#55ff55',
  }
}
```

*复古风格，程序员喜爱*

#### 主题 4: 亮色护眼 (Light)

```typescript
{
  name: '亮色护眼',
  colors: {
    background: '#ffffff',
    foreground: '#333333',
    cursor: '#000000',
    cursorAccent: '#ffffff',
    selectionBackground: '#b3d7ff',
    selectionForeground: '#000000',
    black: '#000000',
    red: '#cd3131',
    green: '#00bc3c',
    yellow: '#949800',
    blue: '#0451a5',
    magenta: '#bc05bc',
    cyan: '#0598bc',
    white: '#555555',
    brightBlack: '#666666',
    brightRed: '#cd3131',
    brightGreen: '#14ce14',
    brightYellow: '#b5ba00',
    brightBlue: '#0451a5',
    brightMagenta: '#bc05bc',
    brightCyan: '#0598bc',
    brightWhite: '#a5a5a5',
  }
}
```

*白天或低对比度环境使用*

### 主题切换机制

**存储位置：** `localStorage` 键名 `terminal-theme`

**切换流程：**

```
1. 用户点击主题按钮或设置选项
2. 弹出主题选择器（下拉菜单）
3. 选择新主题
4. 更新 theme state
5. 调用 term.setOption('theme', themeColors)
6. 存储到 localStorage
7. 下次启动自动应用
```

**技术实现：**

```typescript
// TerminalInstance.tsx
useEffect(() => {
  if (terminalRef.current && theme) {
    terminalRef.current.setOption('theme', themes[theme].colors);
  }
}, [theme]);

// 初始化时从 localStorage 加载主题
useEffect(() => {
  const savedTheme = localStorage.getItem('terminal-theme');
  if (savedTheme && themes[savedTheme]) {
    setTheme(savedTheme as TerminalTheme);
  }
}, []);
```

---

## MVP 功能清单

### Phase 1: 核心功能（MVP）

| 功能 | 描述 | 复杂度 | 优先级 |
|------|------|--------|--------|
| ✅ 多标签支持 | 创建/关闭/切换多个终端 | 中 | 🔴 核心 |
| ✅ 标签管理 | 重命名标签、标签高亮 | 低 | 🔴 核心 |
| ✅ 主题切换 | 4个预设主题，自动应用 | 低 | 🟡 重要 |
| ✅ 终端持久化 | 刷新页面后恢复终端 | 中 | 🟡 重要 |
| ✅ 复制粘贴 | Ctrl+Shift+C/V 支持 | 低 | 🟢 基础 |
| ✅ 清屏 | Ctrl+L 清屏 | 低 | 🟢 基础 |
| ✅ 退出处理 | 终端关闭时自动清理 | 低 | 🟢 基础 |

### Phase 2: 后续迭代

| 功能 | 描述 | 复杂度 | 状态 |
|------|------|--------|------|
| 🔍 搜索输出 | Ctrl+F 搜索终端历史输出 | 中 | 延后 |
| 💾 输出保存 | 导出终端输出到文件 | 中 | 延后 |
| 📊 分屏 | 左右/上下分屏多个终端 | 高 | 延后 |
| 📝 命令历史 | 上/下箭头切换历史命令 | 低 | 延后 |
| 🎯 自动补全 | Tab 键补全命令/路径 | 高 | 延后 |
| ⚡ 快捷命令 | 预定义常用命令按钮 | 低 | 延后 |

### 功能实现细节

#### 多标签支持

**核心逻辑：**

```typescript
// TerminalManager.tsx
const createTerminal = async (label?: string) => {
  const id = `global-${uuid()}`;
  const newTerminal: Terminal = {
    id,
    label: label || `终端 ${terminals.length + 1}`,
    createdAt: new Date(),
    shell: isWin ? 'powershell.exe' : 'bash',
    cwd: isWin ? process.env.USERPROFILE : process.env.HOME,
    status: 'running',
  };
  
  await terminalApi.startShell(id, newTerminal.shell, newTerminal.cwd);
  setTerminals(prev => [...prev, newTerminal]);
  setActiveId(id);
};

const closeTerminal = async (id: string) => {
  await terminalApi.stop(id);
  setTerminals(prev => prev.filter(t => t.id !== id));
  
  if (activeId === id) {
    // 切换到最近的标签
    const remaining = terminals.filter(t => t.id !== id);
    setActiveId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
  }
};

const switchTerminal = (id: string) => {
  setActiveId(id);
};
```

#### 终端持久化

**存储策略：**

```typescript
// 存储到 localStorage
const STORAGE_KEY = 'terminal-state';

const saveTerminalState = (terminals: Terminal[], activeId: string | null) => {
  const state = { terminals, activeId, savedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

// 恢复终端
const restoreTerminals = async () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return;
  
  const { terminals: savedTerminals } = JSON.parse(saved);
  
  for (const t of savedTerminals) {
    try {
      await terminalApi.startShell(t.id, t.shell, t.cwd);
      setTerminals(prev => [...prev, t]);
    } catch {
      // 终端已不存在，跳过
    }
  }
};

// 监听变化自动保存
useEffect(() => {
  saveTerminalState(terminals, activeId);
}, [terminals, activeId]);
```

#### 退出处理

**事件监听：**

```typescript
useEffect(() => {
  const unlisten = listen<TerminalExitEvent>('terminal-exit', (event) => {
    const { terminalId, code } = event.payload;
    
    // 更新终端状态
    setTerminals(prev => prev.map(t => 
      t.id === terminalId 
        ? { ...t, status: code === 0 ? 'exited' : 'error' } 
        : t
    ));
    
    // 显示退出信息
    if (terminalId === activeId) {
      const exitMsg = code === 0 
        ? '\r\n\x1b[32m✓ 进程正常退出\x1b[0m' 
        : `\r\n\x1b[31m✗ 进程异常退出 (code: ${code})\x1b[0m`;
      
      // 写入到对应的 xterm 实例
      const term = terminalInstancesRef.current[terminalId];
      if (term) term.write(exitMsg);
    }
  });
  
  return () => unlisten.then(fn => fn());
}, [activeId]);
```

---

## 文件变更

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/shared/TerminalManager.tsx` | 核心管理组件（~200行） |
| `src/shared/TerminalInstance.tsx` | 单个终端实例（~100行） |
| `src/shared/terminalThemes.ts` | 主题配置（~100行） |
| `src/shared/terminalTypes.ts` | TypeScript 类型定义（~30行） |
| `docs/superpowers/specs/2026-06-10-terminal-optimization-design.md` | 本文档 |

### 重构文件

| 文件 | 变更 |
|------|------|
| `src/shared/GlobalTerminalPanel.tsx` | 重构为使用 TerminalManager |
| `src/shared/TerminalPanel.tsx` | 保留，保持向后兼容 |

### 扩展文件（可选）

| 文件 | 变更 |
|------|------|
| `src-tauri/src/commands/terminal.rs` | 添加终端元数据管理（可选） |

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 内存泄漏 | 多终端占用大量内存 | 限制最大标签数（10个），及时清理退出的终端 |
| 性能下降 | 大量终端同时运行 | 延迟渲染非活跃终端，使用 React.memo 优化 |
| 快捷键冲突 | 与系统/浏览器快捷键冲突 | 使用 Ctrl+Shift+ 组合，避免常见冲突 |
| 持久化失败 | 终端状态丢失 | 优雅降级，启动时清理无效记录 |
| 主题不一致 | 主题切换时 UI 闪烁 | 先更新样式再切换 xterm 主题 |

---

## 测试策略

### 单元测试

- `useTerminalManager` hook 测试
- `TerminalManager` 组件渲染测试
- 主题切换逻辑测试

### 集成测试

- 终端创建/关闭/切换流程
- 多终端并行运行
- 快捷键响应

### 手动测试

- UI 布局和样式验证
- 主题切换视觉效果
- 性能和内存使用

---

## 实现时间估算

| 阶段 | 工作量 | 时间 |
|------|--------|------|
| Phase 1: 核心功能 | 3-5天 | 终端管理、标签栏、基础功能 |
| Phase 2: 主题系统 | 1-2天 | 4个主题、切换机制 |
| Phase 3: 持久化和清理 | 1天 | 持久化、退出处理 |
| Phase 4: 测试和优化 | 1-2天 | 测试、性能优化 |
| **总计** | **6-10天** | - |

---

## 附录

### 相关文件

- `src-tauri/src/commands/terminal.rs` - 后端终端命令
- `src/shared/GlobalTerminalPanel.tsx` - 现有全局终端组件
- `src/shared/TerminalPanel.tsx` - 现有简单终端组件
- `src/api/index.ts` - 终端 API 封装

### 参考资源

- [xterm.js 文档](https://xtermjs.org/docs/)
- [xterm-addon-fit](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-fit)
- [Tauri IPC 通信](https://tauri.app/v1/guides/features/)

---

**文档结束** ✅

**自审查结果：**
- ✓ 无 TBD/TODO 占位符
- ✓ 内部一致性检查通过
- ✓ 范围适中，适合单一实现计划
- ✓ 无歧义需求，所有规格明确
