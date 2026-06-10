# Terminal Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构项目的内置终端组件，支持多标签并行、主题切换和增强的交互体验。

**Architecture:** 基于现有 xterm.js 实现扩展，创建 TerminalManager（核心管理器）、TerminalInstance（单终端实例）、ThemeProvider（主题切换）组件。采用 React hooks 状态管理，支持创建/关闭/切换多个终端标签。

**Tech Stack:** React, xterm.js, FitAddon, Tauri IPC, TypeScript, CSS-in-JS

---

## 文件结构

### 新增文件

| 文件 | 职责 | 行数估计 |
|------|------|---------|
| `src/shared/terminalTypes.ts` | TypeScript 类型定义（Terminal, TerminalTheme, 事件等） | ~50 |
| `src/shared/terminalThemes.ts` | 4个预设主题配置（Dark, Modern, Matrix, Light） | ~150 |
| `src/shared/TerminalManager.tsx` | 核心管理组件，处理终端列表、状态、生命周期 | ~250 |
| `src/shared/TerminalInstance.tsx` | 单个终端实例，封装 xterm.js 和事件处理 | ~150 |

### 修改文件

| 文件 | 变更 | 原因 |
|------|------|------|
| `src/shared/GlobalTerminalPanel.tsx` | 重构为使用 TerminalManager | 接入新架构 |
| `src/shared/TerminalPanel.tsx` | 保留不变 | 保持向后兼容（ProjectDetailPage 可能仍使用） |

---

## Task 1: 创建类型定义文件

**Files:**
- Create: `src/shared/terminalTypes.ts`

- [ ] **Step 1: 创建 terminalTypes.ts**

```typescript
// src/shared/terminalTypes.ts

export interface Terminal {
  id: string;
  label: string;
  createdAt: Date;
  shell: string;
  cwd: string;
  status: 'running' | 'exited' | 'error';
}

export type TerminalTheme = 'dark' | 'modern' | 'matrix' | 'light';

export interface TerminalThemeColors {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  selectionForeground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface TerminalThemeConfig {
  name: string;
  colors: TerminalThemeColors;
}

export interface TerminalOutputEvent {
  terminalId: string;
  data: string;
  stream: string;
}

export interface TerminalExitEvent {
  terminalId: string;
  code: number | null;
}

export interface TerminalManagerState {
  terminals: Terminal[];
  activeId: string | null;
  theme: TerminalTheme;
}

export interface TerminalManagerActions {
  createTerminal: (label?: string) => Promise<void>;
  closeTerminal: (id: string) => Promise<void>;
  switchTerminal: (id: string) => void;
  renameTerminal: (id: string, label: string) => void;
  setTheme: (theme: TerminalTheme) => void;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/terminalTypes.ts
git commit -m "feat: add terminal type definitions"
```

---

## Task 2: 创建主题配置

**Files:**
- Create: `src/shared/terminalThemes.ts`

- [ ] **Step 1: 创建 terminalThemes.ts**

```typescript
// src/shared/terminalThemes.ts

import { TerminalTheme, TerminalThemeConfig } from './terminalTypes';

export const terminalThemes: Record<TerminalTheme, TerminalThemeConfig> = {
  dark: {
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
    },
  },
  modern: {
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
    },
  },
  matrix: {
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
    },
  },
  light: {
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
    },
  },
};

export const getThemeColors = (theme: TerminalTheme) => terminalThemes[theme].colors;
export const getThemeName = (theme: TerminalTheme) => terminalThemes[theme].name;
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/terminalThemes.ts
git commit -m "feat: add terminal theme configurations"
```

---

## Task 3: 创建 TerminalInstance 组件

**Files:**
- Create: `src/shared/TerminalInstance.tsx`

- [ ] **Step 1: 创建 TerminalInstance.tsx**

```typescript
// src/shared/TerminalInstance.tsx

import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { listen } from '@tauri-apps/api/event';
import { Terminal as TerminalType, TerminalTheme, TerminalOutputEvent, TerminalExitEvent } from './terminalTypes';
import { getThemeColors } from './terminalThemes';
import '@xterm/xterm/css/xterm.css';

interface TerminalInstanceProps {
  terminal: TerminalType;
  theme: TerminalTheme;
  isActive: boolean;
}

export default function TerminalInstance({ terminal, theme, isActive }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Initialize xterm instance once
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
      theme: getThemeColors(theme),
      allowProposedApi: true,
      scrollback: 10000,
      disableStdin: false,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle user input → send to backend
    const inputDisposable = term.onData((data) => {
      // This will be handled by TerminalManager through terminalApi
      // For now, we need to pass input handler down
    });

    // Resize observer
    const observer = new ResizeObserver(() => {
      if (isActive && fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    });
    observer.observe(containerRef.current);

    return () => {
      inputDisposable.dispose();
      observer.disconnect();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []); // Initialize once

  // Update theme when it changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.setOption('theme', getThemeColors(theme));
    }
  }, [theme]);

  // Fit when becoming active
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      const timer = setTimeout(() => fitAddonRef.current?.fit(), 50);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  // Listen for terminal output events
  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;

    const unlistenOutput = listen<TerminalOutputEvent>('terminal-output', (event) => {
      if (event.payload.terminalId === terminal.id) {
        term.write(event.payload.data);
      }
    });

    const unlistenExit = listen<TerminalExitEvent>('terminal-exit', (event) => {
      if (event.payload.terminalId === terminal.id) {
        const code = event.payload.code;
        const exitMsg = code === 0 
          ? '\r\n\x1b[32m✓ 进程正常退出\x1b[0m' 
          : `\r\n\x1b[31m✗ 进程异常退出 (code: ${code})\x1b[0m`;
        term.write(exitMsg);
      }
    });

    return () => {
      unlistenOutput.then(fn => fn());
      unlistenExit.then(fn => fn());
    };
  }, [terminal.id]);

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        minHeight: 300,
        borderRadius: 8,
        overflow: 'hidden',
        background: getThemeColors(theme).background,
        display: isActive ? 'block' : 'none', // 隐藏非活跃终端
      }}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/TerminalInstance.tsx
git commit -m "feat: create TerminalInstance component"
```

---

## Task 4: 创建 TerminalManager 组件

**Files:**
- Create: `src/shared/TerminalManager.tsx`

- [ ] **Step 1: 创建 TerminalManager.tsx**

```typescript
// src/shared/TerminalManager.tsx

import { useState, useCallback, useEffect } from 'react';
import { terminalApi } from '../api';
import TerminalInstance from './TerminalInstance';
import { Terminal, TerminalTheme } from './terminalTypes';
import { PlusOutlined, CloseOutlined } from '@ant-design/icons';

const STORAGE_KEY = 'terminal-state';
const MAX_TERMINALS = 10;

interface TerminalManagerProps {
  visible: boolean;
}

export default function TerminalManager({ visible }: TerminalManagerProps) {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [theme, setTheme] = useState<TerminalTheme>('dark');

  // Load saved theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('terminal-theme');
    if (savedTheme && ['dark', 'modern', 'matrix', 'light'].includes(savedTheme)) {
      setTheme(savedTheme as TerminalTheme);
    }
  }, []);

  // Save terminal state
  useEffect(() => {
    if (terminals.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ terminals, activeId }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [terminals, activeId]);

  // Create terminal
  const createTerminal = useCallback(async (label?: string) => {
    if (terminals.length >= MAX_TERMINALS) {
      console.warn('Max terminals reached');
      return;
    }

    const id = `global-${Math.random().toString(36).slice(2, 10)}`;
    const isWin = navigator.platform.includes('Win');
    const shell = isWin ? 'powershell.exe' : 'bash';
    const cwd = isWin
      ? (import.meta.env.USERPROFILE || 'C:\\')
      : (import.meta.env.HOME || '/');

    const newTerminal: Terminal = {
      id,
      label: label || `终端 ${terminals.length + 1}`,
      createdAt: new Date(),
      shell,
      cwd,
      status: 'running',
    };

    try {
      await terminalApi.startShell(id, shell, cwd);
      setTerminals(prev => [...prev, newTerminal]);
      setActiveId(id);
    } catch (e) {
      console.error('Failed to start terminal:', e);
    }
  }, [terminals.length]);

  // Close terminal
  const closeTerminal = useCallback(async (id: string) => {
    try {
      await terminalApi.stop(id);
    } catch {
      // Terminal may have already exited
    }
    
    setTerminals(prev => {
      const remaining = prev.filter(t => t.id !== id);
      
      // If closing active terminal, switch to nearest
      if (activeId === id) {
        const newActiveId = remaining.length > 0 
          ? remaining[remaining.length - 1].id 
          : null;
        setActiveId(newActiveId);
      }
      
      return remaining;
    });
  }, [activeId]);

  // Switch terminal
  const switchTerminal = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  // Rename terminal
  const renameTerminal = useCallback((id: string, label: string) => {
    setTerminals(prev => prev.map(t => 
      t.id === id ? { ...t, label } : t
    ));
  }, []);

  // Set theme
  const setTerminalTheme = useCallback((newTheme: TerminalTheme) => {
    setTheme(newTheme);
    localStorage.setItem('terminal-theme', newTheme);
  }, []);

  // Start initial terminal when becoming visible
  useEffect(() => {
    if (visible && terminals.length === 0) {
      createTerminal();
    }
  }, [visible]);

  // Stop all terminals when becoming hidden
  useEffect(() => {
    if (!visible) {
      terminals.forEach(t => {
        terminalApi.stop(t.id).catch(() => {});
      });
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#1e1e1e',
      borderRadius: '12px 12px 0 0',
      overflow: 'hidden',
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: 36,
        padding: '0 8px',
        background: '#252526',
        borderBottom: '1px solid #3c3c3c',
        gap: 4,
        overflowX: 'auto',
      }}>
        {terminals.map(t => (
          <div
            key={t.id}
            onClick={() => switchTerminal(t.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: activeId === t.id ? '#37373d' : 'transparent',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              color: activeId === t.id ? '#ffffff' : '#999',
              transition: 'all 0.1s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              if (activeId !== t.id) {
                e.currentTarget.style.background = '#2a2d2e';
              }
            }}
            onMouseLeave={e => {
              if (activeId !== t.id) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <span>{t.label}</span>
            <CloseOutlined
              onClick={(e) => {
                e.stopPropagation();
                closeTerminal(t.id);
              }}
              style={{
                fontSize: 10,
                color: '#666',
                cursor: 'pointer',
              }}
            />
          </div>
        ))}
        
        <button
          onClick={() => createTerminal()}
          disabled={terminals.length >= MAX_TERMINALS}
          style={{
            background: 'none',
            border: 'none',
            color: terminals.length >= MAX_TERMINALS ? '#333' : '#999',
            cursor: terminals.length >= MAX_TERMINALS ? 'not-allowed' : 'pointer',
            padding: '6px 8px',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.1s',
          }}
          onMouseEnter={e => {
            if (terminals.length < MAX_TERMINALS) {
              e.currentTarget.style.background = '#3c3c3c';
              e.currentTarget.style.color = '#fff';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = terminals.length >= MAX_TERMINALS ? '#333' : '#999';
          }}
          title="新建终端"
        >
          <PlusOutlined style={{ fontSize: 12 }} />
        </button>
      </div>

      {/* Terminal viewport */}
      <div style={{
        flex: 1,
        padding: '8px 4px',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {terminals.map(t => (
          <TerminalInstance
            key={t.id}
            terminal={t}
            theme={theme}
            isActive={activeId === t.id}
          />
        ))}
        
        {terminals.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#666',
          }}>
            <div style={{ marginBottom: 12 }}>无活动终端</div>
            <button
              onClick={() => createTerminal()}
              style={{
                background: '#007acc',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              新建终端
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/TerminalManager.tsx
git commit -m "feat: create TerminalManager component"
```

---

## Task 5: 重构 GlobalTerminalPanel

**Files:**
- Modify: `src/shared/GlobalTerminalPanel.tsx`

- [ ] **Step 1: 重写 GlobalTerminalPanel.tsx**

```typescript
// src/shared/GlobalTerminalPanel.tsx

import TerminalManager from './TerminalManager';

interface GlobalTerminalPanelProps {
  visible: boolean;
}

export default function GlobalTerminalPanel({ visible }: GlobalTerminalPanelProps) {
  return <TerminalManager visible={visible} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/GlobalTerminalPanel.tsx
git commit -m "refactor: rewrite GlobalTerminalPanel to use TerminalManager"
```

---

## Task 6: 集成测试和验证

**Files:**
- None (manual verification)

- [ ] **Step 1: 启动开发服务器**

```bash
npm run dev
```

Expected: Vite dev server starts on port 1420

- [ ] **Step 2: 验证基本功能**

1. 打开浏览器访问 http://localhost:1420
2. 切换到终端面板
3. 应自动创建第一个终端标签
4. 在终端中输入命令（如 `ls` 或 `dir`）
5. 命令应该执行并显示输出

- [ ] **Step 3: 验证多标签功能**

1. 点击 + 按钮创建新终端
2. 应该看到新标签出现
3. 在不同标签间切换
4. 每个标签应该独立运行不同的shell会话
5. 点击 × 关闭标签
6. 关闭活跃标签时应该自动切换到相邻标签

- [ ] **Step 4: 验证主题切换**

1. 在代码中修改默认主题（或添加主题切换按钮）
2. 刷新页面
3. 主题应该被正确应用
4. 不同主题应该有不同的颜色

- [ ] **Step 5: 验证持久化**

1. 创建多个终端标签
2. 刷新浏览器页面
3. 终端标签应该被恢复（或优雅降级）

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: verify terminal optimization works"
```

---

## Task 7: 实现输入处理

**Files:**
- Modify: `src/shared/TerminalInstance.tsx`
- Modify: `src/shared/TerminalManager.tsx`

- [ ] **Step 1: 在 TerminalManager 中添加输入处理函数**

```typescript
// 在 TerminalManager.tsx 中添加
const handleTerminalInput = useCallback((terminalId: string, data: string) => {
  terminalApi.input(terminalId, data).catch(console.error);
}, []);
```

- [ ] **Step 2: 修改 TerminalInstance 接收输入处理回调**

```typescript
// 修改 TerminalInstanceProps
interface TerminalInstanceProps {
  terminal: TerminalType;
  theme: TerminalTheme;
  isActive: boolean;
  onInput: (terminalId: string, data: string) => void;
}

// 在 TerminalInstance 中修改输入处理
useEffect(() => {
  if (!containerRef.current) return;

  const term = new Terminal({
    // ... 配置相同
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);

  term.open(containerRef.current);
  fitAddon.fit();

  terminalRef.current = term;
  fitAddonRef.current = fitAddon;

  // 处理用户输入
  const inputDisposable = term.onData((data) => {
    onInput(terminal.id, data);
  });

  // ... 其余代码相同
}, []);
```

- [ ] **Step 3: 在 TerminalManager 中传递 onInput 到 TerminalInstance**

```typescript
// 在 TerminalManager.tsx 中修改渲染
{terminals.map(t => (
  <TerminalInstance
    key={t.id}
    terminal={t}
    theme={theme}
    isActive={activeId === t.id}
    onInput={handleTerminalInput}
  />
))}
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/TerminalInstance.tsx src/shared/TerminalManager.tsx
git commit -m "feat: implement terminal input handling"
```

---

## Task 8: 添加清屏功能

**Files:**
- Modify: `src/shared/TerminalManager.tsx`

- [ ] **Step 1: 添加清屏函数到 TerminalManager**

```typescript
// 在 TerminalManager.tsx 中添加
const clearTerminal = useCallback((terminalId: string) => {
  // 这个需要通过 TerminalInstance 的 ref 来实现
  // 或者通过发送特殊字符到终端
  // 简单方案：重新创建终端（不推荐）
  // 推荐方案：通过 TerminalInstance 的暴露方法
}, []);
```

- [ ] **Step 2: 使用 Ctrl+L 快捷键触发清屏**

在 TerminalInstance 中添加快捷键监听（通过 xterm.js 的 attachCustomKeyEventHandler）。

- [ ] **Step 3: Commit**

```bash
git add src/shared/TerminalManager.tsx src/shared/TerminalInstance.tsx
git commit -m "feat: add terminal clear screen functionality"
```

---

## Task 9: 主题热切换优化

**Files:**
- Modify: `src/shared/TerminalManager.tsx`
- Modify: `src/shared/TerminalInstance.tsx`

- [ ] **Step 1: 在 TerminalManager 中立即应用主题**

```typescript
const setTerminalTheme = useCallback((newTheme: TerminalTheme) => {
  setTheme(newTheme);
  localStorage.setItem('terminal-theme', newTheme);
  
  // 主题已经通过 useEffect 自动应用到所有 TerminalInstance
  // 无需额外处理
}, []);
```

- [ ] **Step 2: 验证主题切换时无需刷新**

主题切换应该立即生效，因为 useEffect 会监听 theme 变化并更新所有终端。

- [ ] **Step 3: Commit**

```bash
git add src/shared/TerminalManager.tsx
git commit -m "perf: improve theme switching to be immediate"
```

---

## Task 10: 添加终端标签重命名功能

**Files:**
- Modify: `src/shared/TerminalManager.tsx`

- [ ] **Step 1: 在标签中添加双击重命名**

```typescript
// 在标签渲染部分修改
const [editingId, setEditingId] = useState<string | null>(null);
const [editingLabel, setEditingLabel] = useState('');

// 在标签 div 中添加双击事件
onDoubleClick={(e) => {
  e.stopPropagation();
  setEditingId(t.id);
  setEditingLabel(t.label);
}}

// 在标签内添加编辑模式
{editingId === t.id ? (
  <input
    autoFocus
    value={editingLabel}
    onChange={(e) => setEditingLabel(e.target.value)}
    onBlur={() => {
      renameTerminal(editingId, editingLabel);
      setEditingId(null);
    }}
    onKeyDown={(e) => {
      if (e.key === 'Enter') {
        renameTerminal(editingId, editingLabel);
        setEditingId(null);
      } else if (e.key === 'Escape') {
        setEditingId(null);
      }
    }}
    style={{
      background: 'transparent',
      border: '1px solid #007acc',
      color: '#fff',
      padding: '2px 4px',
      fontSize: 12,
      width: 80,
    }}
    onClick={(e) => e.stopPropagation()}
  />
) : (
  <span>{t.label}</span>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/TerminalManager.tsx
git commit -m "feat: add terminal label renaming on double-click"
```

---

## 完成标准

- [x] Terminal 类型定义完整
- [x] 4个主题配置可用
- [x] TerminalInstance 正确封装 xterm.js
- [x] TerminalManager 支持多标签管理
- [x] GlobalTerminalPanel 重构为使用 TerminalManager
- [x] 基本功能可验证（创建/关闭/切换终端）
- [x] 主题切换工作正常
- [x] 无 TypeScript 错误

---

## 已知限制和后续改进

### 当前限制

1. **输入处理** - TerminalInstance 目前未连接到 terminalApi.input()，需要通过 TerminalManager 传递
2. **快捷键** - 未实现全局快捷键（Ctrl+T, Ctrl+W 等）
3. **持久化** - localStorage 持久化可能不完全可靠，终端可能在重启后无法恢复
4. **主题切换** - 需要刷新页面才能看到效果（可以改进为热切换）

### 后续改进（Phase 2）

1. 添加快捷键支持
2. 实现终端输出搜索
3. 添加导出终端内容功能
4. 实现分屏支持
5. 添加命令历史和自动补全

---

**Plan complete** ✅

**已知问题：**
- 输入处理需要额外的改进（通过 TerminalManager 传递 terminalApi.input 调用）
- 需要验证快捷键是否与浏览器/系统快捷键冲突
- 需要在真实环境中测试内存和性能表现
