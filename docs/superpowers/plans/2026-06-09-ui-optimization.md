# UI 优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 优化DevHub的全局搜索框布局和页面视觉设计，实现精致玻璃风格和丰富的交互动画

**Architecture:** 采用模块化的方式重构：先建立CSS变量和动画系统，然后重构Header实现搜索框居中，接着优化卡片组件和整体视觉效果，最后进行响应式优化和测试

**Tech Stack:** React + TypeScript, Ant Design, CSS Variables, CSS Animations, Glassmorphism

---

## 文件结构

### 新增文件
- `src/shared/styles/variables.css` - CSS变量定义（颜色、阴影、间距、动画）
- `src/shared/styles/animations.css` - 动画关键帧和类
- `src/shared/styles/glassmorphism.css` - 玻璃效果样式
- `src/shared/components/SearchBox.tsx` - 优化的搜索框组件
- `src/shared/components/GlassCard.tsx` - 玻璃卡片组件
- `src/shared/components/AnimatedButton.tsx` - 动画按钮组件

### 修改文件
- `src/shared/MainLayout.tsx` - 重构Header布局实现搜索框居中
- `src/features/dashboard/DashboardPage.tsx` - 应用卡片优化和动画
- `src/index.css` - 引入新的样式系统

---

## Task 1: 基础样式系统 - CSS变量

**Files:**
- Create: `src/shared/styles/variables.css`
- Modify: `src/index.css`

- [ ] **Step 1: 创建CSS变量文件**

```css
/* src/shared/styles/variables.css */

:root {
  /* 颜色系统 */
  --color-primary: #22c55e;
  --color-primary-dark: #16a34a;
  --color-primary-light: rgba(34, 197, 94, 0.1);
  
  --color-text: #1a1f36;
  --color-text-secondary: #6b7a99;
  --color-text-muted: #9eadc0;
  
  /* 玻璃效果 */
  --color-bg-glass: rgba(255, 255, 255, 0.08);
  --color-border-glass: rgba(255, 255, 255, 0.15);
  
  /* 阴影系统 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
  --shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.16);
  --shadow-glow: 0 0 20px rgba(34, 197, 94, 0.1);
  
  /* 间距系统 */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  
  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  
  /* 字体 */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'Fira Code', 'Consolas', monospace;
  
  /* 字体大小 */
  --text-xs: 11px;
  --text-sm: 13px;
  --text-base: 14px;
  --text-lg: 16px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 32px;
  
  /* 动画时长 */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.3s ease;
  --transition-slow: 0.4s ease;
  --transition-spring: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

- [ ] **Step 2: 在index.css中引入variables.css**

打开 `src/index.css` 并在文件顶部添加：

```css
@import './shared/styles/variables.css';
```

- [ ] **Step 3: 提交基础设置**

```bash
git add src/shared/styles/variables.css src/index.css
git commit -m "chore: add CSS variables system for colors, shadows, spacing, and animations"
```

---

## Task 2: 动画关键帧和类

**Files:**
- Create: `src/shared/styles/animations.css`
- Modify: `src/index.css`

- [ ] **Step 1: 创建动画文件**

```css
/* src/shared/styles/animations.css */

/* 页面载入动画 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 动画工具类 */
.animate-in {
  animation: fadeInUp 0.5s ease forwards;
}

.animate-in-delay-1 {
  animation: fadeInUp 0.5s ease 0.1s forwards;
  opacity: 0;
}

.animate-in-delay-2 {
  animation: fadeInUp 0.5s ease 0.2s forwards;
  opacity: 0;
}

.animate-in-delay-3 {
  animation: fadeInUp 0.5s ease 0.3s forwards;
  opacity: 0;
}

.animate-in-delay-4 {
  animation: fadeInUp 0.5s ease 0.4s forwards;
  opacity: 0;
}

/* Hover效果类 */
.hover-lift {
  transition: transform var(--transition-spring), box-shadow var(--transition-normal);
}

.hover-lift:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg), var(--shadow-glow);
}

/* 点击效果类 */
.clickable {
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.clickable:active {
  transform: scale(0.97);
}
```

- [ ] **Step 2: 在index.css中引入animations.css**

打开 `src/index.css` 并在引入variables之后添加：

```css
@import './shared/styles/animations.css';
```

- [ ] **Step 3: 提交动画系统**

```bash
git add src/shared/styles/animations.css src/index.css
git commit -m "feat: add animation keyframes and utility classes for hover/click effects"
```

---

## Task 3: 玻璃效果样式

**Files:**
- Create: `src/shared/styles/glassmorphism.css`
- Modify: `src/index.css`

- [ ] **Step 1: 创建玻璃效果文件**

```css
/* src/shared/styles/glassmorphism.css */

/* 玻璃效果基类 */
.glass {
  background: var(--color-bg-glass);
  backdrop-filter: blur(40px) saturate(1.3);
  -webkit-backdrop-filter: blur(40px) saturate(1.3);
  border: 1px solid var(--color-border-glass);
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    var(--shadow-md);
}

/* 强化玻璃效果 */
.glass-strong {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(48px) saturate(1.5);
  -webkit-backdrop-filter: blur(48px) saturate(1.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 
    inset 0 2px 0 rgba(255, 255, 255, 0.5),
    0 8px 32px rgba(0, 0, 0, 0.15);
}

/* 玻璃卡片 */
.glass-card {
  background: var(--color-bg-glass);
  backdrop-filter: blur(40px) saturate(1.3);
  -webkit-backdrop-filter: blur(40px) saturate(1.3);
  border: 1px solid var(--color-border-glass);
  border-radius: var(--radius-lg);
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    var(--shadow-md);
  padding: var(--space-5);
  transition: transform var(--transition-spring), box-shadow var(--transition-normal);
}

.glass-card:hover {
  transform: translateY(-4px);
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    var(--shadow-lg),
    var(--shadow-glow);
}

/* 导航菜单active状态 */
.glass-menu-item-active {
  background: var(--color-primary-light);
  border-left: 3px solid var(--color-primary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}
```

- [ ] **Step 2: 在index.css中引入glassmorphism.css**

打开 `src/index.css` 并在引入animations之后添加：

```css
@import './shared/styles/glassmorphism.css';
```

- [ ] **Step 3: 提交玻璃效果**

```bash
git add src/shared/styles/glassmorphism.css src/index.css
git commit -m "feat: add glassmorphism CSS classes for glass effects and card styling"
```

---

## Task 4: 优化搜索框组件

**Files:**
- Create: `src/shared/components/SearchBox.tsx`
- Modify: `src/shared/MainLayout.tsx:150-167`

- [ ] **Step 1: 创建SearchBox组件**

```tsx
/* src/shared/components/SearchBox.tsx */

import { useState, useEffect, useRef } from 'react';
import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

interface SearchBoxProps {
  onClick?: () => void;
}

export default function SearchBox({ onClick }: SearchBoxProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<any>(null);

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(40px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.3)',
        border: `1px solid ${focused ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.15)'}`,
        borderRadius: 8,
        padding: '10px 20px',
        minWidth: 320,
        maxWidth: 400,
        boxShadow: focused 
          ? 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 0 20px rgba(34, 197, 94, 0.1)'
          : 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 4px 12px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)';
        e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 4px 12px rgba(0, 0, 0, 0.12)';
      }}
      onMouseLeave={(e) => {
        if (!focused) {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 4px 12px rgba(0, 0, 0, 0.08)';
        }
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <SearchOutlined 
        style={{ 
          color: focused ? '#22c55e' : '#9eadc0',
          fontSize: 16,
          transition: 'color 0.3s ease',
        }} 
      />
      <span style={{ 
        color: '#9eadc0', 
        fontSize: 14,
        flex: 1,
      }}>
        搜索项目、任务、文档...
      </span>
      <kbd style={{
        fontSize: 11,
        color: '#9eadc0',
        background: 'rgba(255, 255, 255, 0.1)',
        padding: '2px 6px',
        borderRadius: 4,
        border: '1px solid rgba(255, 255, 255, 0.15)',
        fontFamily: "'Fira Code', monospace",
      }}>
        ⌘K
      </kbd>
    </div>
  );
}
```

- [ ] **Step 2: 重构MainLayout的Header布局**

打开 `src/shared/MainLayout.tsx`，找到Header部分（第135-192行），替换为以下布局：

```tsx
<Header style={{
  background: 'rgba(255, 255, 255, 0.08)',
  padding: '0 24px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
  height: 64,
  lineHeight: '64px',
  backdropFilter: 'blur(40px) saturate(1.3)',
  WebkitBackdropFilter: 'blur(40px) saturate(1.3)',
  position: 'relative',
  zIndex: 10,
  boxShadow: 'inset 0 -1px 0 rgba(255, 255, 255, 0.4), 0 4px 12px rgba(0, 0, 0, 0.08)',
}}>
  {/* Logo和菜单 - 左侧 */}
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    {/* Logo已在Sider中 */}
  </div>

  {/* 搜索框 - 中间 */}
  <div style={{ 
    flex: 1, 
    display: 'flex', 
    justifyContent: 'center',
    alignItems: 'center',
  }}>
    <SearchBox onClick={() => setSearchOpen(true)} />
  </div>

  {/* 用户菜单 - 右侧 */}
  <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      cursor: 'pointer',
      padding: '6px 12px',
      borderRadius: 8,
      transition: 'background 0.15s ease',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <Avatar
        size={32}
        icon={<UserOutlined />}
        style={{
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          boxShadow: '0 2px 8px rgba(34, 197, 94, 0.2)',
        }}
      />
      <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1f36' }}>{user!.username}</span>
    </div>
  </Dropdown>
</Header>
```

在文件顶部导入SearchBox组件：

```tsx
import SearchBox from './components/SearchBox';
```

- [ ] **Step 3: 测试搜索框布局**

启动开发服务器并检查：
- 搜索框应显示在Header正中间
- 左右两侧有足够的间距
- 悬浮效果和边框变化正常

```bash
npm run dev
```

- [ ] **Step 4: 提交搜索框优化**

```bash
git add src/shared/components/SearchBox.tsx src/shared/MainLayout.tsx
git commit -m "feat: create SearchBox component and center it in Header"
```

---

## Task 5: 玻璃卡片组件

**Files:**
- Create: `src/shared/components/GlassCard.tsx`

- [ ] **Step 1: 创建GlassCard组件**

```tsx
/* src/shared/components/GlassCard.tsx */

import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  hover?: boolean;
}

export default function GlassCard({ 
  children, 
  className = '', 
  style = {},
  hover = true 
}: GlassCardProps) {
  const baseStyles: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(40px) saturate(1.3)',
    WebkitBackdropFilter: 'blur(40px) saturate(1.3)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 4px 12px rgba(0, 0, 0, 0.08)',
    padding: 20,
    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease',
    ...style,
  };

  const hoverStyles = hover ? {
    ':hover': {
      transform: 'translateY(-4px)',
      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 8px 24px rgba(0, 0, 0, 0.12), 0 0 20px rgba(34, 197, 94, 0.1)',
    }
  } : {};

  return (
    <div 
      className={`${className} glass-card`}
      style={baseStyles}
      onMouseEnter={(e) => {
        if (hover) {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 8px 24px rgba(0, 0, 0, 0.12), 0 0 20px rgba(34, 197, 94, 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (hover) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 4px 12px rgba(0, 0, 0, 0.08)';
        }
      }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: 测试卡片组件**

在DashboardPage中使用GlassCard来验证效果（我们将在下一步应用它）。

- [ ] **Step 3: 提交GlassCard组件**

```bash
git add src/shared/components/GlassCard.tsx
git commit -m "feat: create GlassCard component with glassmorphism styling"
```

---

## Task 6: 优化DashboardPage

**Files:**
- Modify: `src/features/dashboard/DashboardPage.tsx`

- [ ] **Step 1: 导入GlassCard和动画样式**

在DashboardPage.tsx顶部添加导入：

```tsx
import GlassCard from '../../shared/components/GlassCard';
```

- [ ] **Step 2: 优化StatCard组件**

找到StatCard组件（第22-75行），更新样式使用CSS变量和动画：

```tsx
function StatCard({ title, value, icon: Icon, gradient, border, delay }: {
  title: string; value: number; icon: any; gradient: string; border: string; delay: number;
}) {
  return (
    <div
      className={`animate-in animate-in-delay-${delay}`}
      style={{
        background: gradient,
        borderRadius: 12,
        padding: '22px 20px',
        border: `1px solid ${border}`,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'default',
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      onMouseEnter={e => { 
        e.currentTarget.style.transform = 'translateY(-4px)'; 
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12), 0 0 20px rgba(34, 197, 94, 0.1)'; 
      }}
      onMouseLeave={e => { 
        e.currentTarget.style.transform = 'translateY(0)'; 
        e.currentTarget.style.boxShadow = 'none'; 
      }}
    >
      {/* Glow dot */}
      <div style={{
        position: 'absolute',
        right: -10,
        top: -10,
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: 'rgba(34, 197, 94, 0.06)',
        filter: 'blur(20px)',
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: '#6b7a99', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            {title}
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#1a1f36', fontFamily: "'Fira Code', monospace", letterSpacing: '-1px', lineHeight: 1 }}>
            {value}
          </div>
        </div>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'rgba(0, 0, 0, 0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon style={{ fontSize: 18, color: '#9eadc0' }} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 优化Recent Projects列表**

找到"最近活跃项目"部分（第135-203行），使用GlassCard包装：

```tsx
{/* Recent projects */}
<GlassCard 
  className="animate-in animate-in-delay-3"
  style={{
    overflow: 'hidden',
  }}
>
  <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
    <Text strong style={{ fontSize: 14, color: '#1a1f36' }}>最近活跃项目</Text>
  </div>
  {recentProjects.length === 0 ? (
    <div style={{ padding: 48 }}><Empty description={<span style={{ color: '#9eadc0' }}>还没有项目</span>} /></div>
  ) : (
    <List
      grid={{ gutter: 0, xs: 1, sm: 2, md: 3 }}
      dataSource={recentProjects}
      renderItem={(project, index) => (
        <List.Item style={{ padding: 0 }}>
          <div
            onClick={() => navigate(`/projects/${project.id}`)}
            style={{
              padding: '18px 24px',
              cursor: 'pointer',
              borderRight: index % 3 !== 2 ? '1px solid rgba(0, 0, 0, 0.04)' : 'none',
              borderBottom: index < recentProjects.length - 3 ? '1px solid rgba(0, 0, 0, 0.04)' : 'none',
              transition: 'background 0.3s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34, 197, 94, 0.04)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <ProjectIcon
                name={project.name}
                techStack={project.techStack}
                iconType={project.iconType}
                iconUrl={project.iconUrl}
                iconColor={project.iconColor}
                size={40}
              />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontWeight: 600,
                  fontSize: 13,
                  marginBottom: 6,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: '#1a1f36',
                }}>
                  {project.name}
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <Tag color={STATUS_COLORS[project.status] || 'default'} style={{ fontSize: 11, margin: 0 }}>
                    {project.status}
                  </Tag>
                  {project.techStack?.slice(0, 2).map((t: string) => (
                    <Tag key={t} style={{ fontSize: 11, margin: 0, background: 'rgba(0, 0, 0, 0.05)', color: '#6b7a99' }}>{t}</Tag>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </List.Item>
      )}
    />
  )}
</GlassCard>
```

- [ ] **Step 4: 测试页面效果**

启动开发服务器查看效果：

```bash
npm run dev
```

检查：
- 统计卡片有浮动和光晕效果
- 最近项目卡片有玻璃效果
- 所有动画延迟按顺序播放

- [ ] **Step 5: 提交DashboardPage优化**

```bash
git add src/features/dashboard/DashboardPage.tsx
git commit -m "feat: optimize DashboardPage with GlassCard and animation delays"
```

---

## Task 7: 响应式优化和最终调整

**Files:**
- Modify: `src/shared/components/SearchBox.tsx`
- Modify: `src/shared/MainLayout.tsx`
- Modify: `src/shared/styles/variables.css`

- [ ] **Step 1: 添加响应式CSS媒体查询**

在 `src/shared/styles/variables.css` 文件末尾添加：

```css
/* 响应式媒体查询 */
@media (max-width: 768px) {
  :root {
    --space-4: 12px;
    --space-6: 20px;
    --text-base: 13px;
  }
}

@media (max-width: 1024px) {
  :root {
    --space-4: 14px;
    --space-6: 22px;
  }
}
```

- [ ] **Step 2: 更新SearchBox支持移动端**

在 `src/shared/components/SearchBox.tsx` 中，在div的style里添加响应式支持：

```tsx
style={{
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  background: 'rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(40px) saturate(1.3)',
  WebkitBackdropFilter: 'blur(40px) saturate(1.3)',
  border: `1px solid ${focused ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.15)'}`,
  borderRadius: 8,
  padding: '10px 20px',
  width: '100%',
  maxWidth: 400,
  minWidth: 0, // 允许在小屏幕上缩小
  boxShadow: focused 
    ? 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 0 20px rgba(34, 197, 94, 0.1)'
    : 'inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 4px 12px rgba(0, 0, 0, 0.08)',
  transition: 'all 0.3s ease',
  cursor: 'pointer',
}}
```

- [ ] **Step 3: 更新MainLayout的Header响应式**

在MainLayout的Header div的style中添加响应式处理：

```tsx
style={{
  background: 'rgba(255, 255, 255, 0.08)',
  padding: '0 24px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
  height: 64,
  lineHeight: '64px',
  backdropFilter: 'blur(40px) saturate(1.3)',
  WebkitBackdropFilter: 'blur(40px) saturate(1.3)',
  position: 'relative',
  zIndex: 10,
  boxShadow: 'inset 0 -1px 0 rgba(255, 255, 255, 0.4), 0 4px 12px rgba(0, 0, 0, 0.08)',
  flexWrap: 'nowrap',
}}
```

- [ ] **Step 4: 全面测试响应式**

启动开发服务器并在不同屏幕尺寸下测试：

```bash
npm run dev
```

测试：
- 桌面（1200px+）：搜索框完整显示
- 平板（768-1024px）：搜索框缩小但保持功能
- 手机（<768px）：搜索框只显示图标，点击后展开全屏搜索模态框

- [ ] **Step 5: 性能优化检查**

检查浏览器开发者工具中的性能面板：
- 动画帧率应保持在60fps
- 没有重绘或重排的性能瓶颈
- Glass效果不影响滚动流畅度

- [ ] **Step 6: 提交最终优化**

```bash
git add src/shared/components/SearchBox.tsx src/shared/MainLayout.tsx src/shared/styles/variables.css
git commit -m "feat: add responsive design for search box and final performance optimizations"
```

---

## Task 8: 文档和清理

**Files:**
- Create: `docs/ui-optimization.md`

- [ ] **Step 1: 创建UI优化文档**

```markdown
# UI 优化说明

## 概述

DevHub界面进行了全面优化，包括：
- 全局搜索框居中布局
- 精致玻璃效果（Glassmorphism）
- 丰富的交互动画和过渡效果
- 响应式设计

## 文件结构

```
src/shared/styles/
├── variables.css      # CSS变量系统
├── animations.css     # 动画关键帧和工具类
└── glassmorphism.css  # 玻璃效果类

src/shared/components/
├── SearchBox.tsx      # 优化的搜索框组件
├── GlassCard.tsx      # 玻璃卡片组件
└── AnimatedButton.tsx # 动画按钮（可选）
```

## 使用指南

### 使用GlassCard

```tsx
import GlassCard from '../shared/components/GlassCard';

<GlassCard hover={true}>
  <div>卡片内容</div>
</GlassCard>
```

### 使用动画类

```tsx
<div className="animate-in animate-in-delay-1">内容</div>
<div className="hover-lift">悬浮时浮动</div>
```

### 使用CSS变量

```css
.my-component {
  padding: var(--space-4);
  background: var(--color-bg-glass);
  box-shadow: var(--shadow-md);
}
```

## 设计规范

- **阴影系统**: sm (1px), md (4px), lg (8px), xl (16px)
- **动画时长**: fast (0.15s), normal (0.3s), slow (0.4s)
- **缓动函数**: spring (cubic-bezier(0.34, 1.56, 0.64, 1))
- **间距**: 4px (1), 8px (2), 12px (3), 16px (4), 20px (5), 24px (6), 32px (8)
```

- [ ] **Step 2: 提交文档**

```bash
git add docs/ui-optimization.md
git commit -m "docs: add UI optimization guide with usage examples and design specs"
```

---

## 完成检查清单

- [ ] 全局搜索框在Header中心正确显示
- [ ] 搜索框悬浮和聚焦效果正常
- [ ] DashboardPage统计卡片有浮动和光晕效果
- [ ] 最近项目卡片有玻璃效果
- [ ] 页面载入动画按延迟顺序播放
- [ ] 所有组件在桌面/平板/手机上正确响应
- [ ] 浏览器中动画帧率保持60fps
- [ ] 全局CSS变量系统正确应用
- [ ] 所有提交遵循规范
- [ ] 文档清晰完整
