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
