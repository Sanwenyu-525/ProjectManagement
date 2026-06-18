---
name: DevHub Dark
colors:
  surface: '#0e1513'
  surface-dim: '#0e1513'
  surface-bright: '#333b39'
  surface-container-lowest: '#09100e'
  surface-container-low: '#161d1b'
  surface-container: '#1a211f'
  surface-container-high: '#242b2a'
  surface-container-highest: '#2f3634'
  on-surface: '#dde4e1'
  on-surface-variant: '#bacac5'
  inverse-surface: '#dde4e1'
  inverse-on-surface: '#2b3230'
  outline: '#859490'
  outline-variant: '#3c4a46'
  surface-tint: '#3cddc7'
  primary: '#57f1db'
  on-primary: '#003731'
  primary-container: '#2dd4bf'
  on-primary-container: '#00574d'
  inverse-primary: '#006b5f'
  secondary: '#ddb7ff'
  on-secondary: '#490080'
  secondary-container: '#6f00be'
  on-secondary-container: '#d6a9ff'
  tertiary: '#ffd1aa'
  on-tertiary: '#4b2800'
  tertiary-container: '#ffac5a'
  on-tertiary-container: '#744000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#62fae3'
  primary-fixed-dim: '#3cddc7'
  on-primary-fixed: '#00201c'
  on-primary-fixed-variant: '#005047'
  secondary-fixed: '#f0dbff'
  secondary-fixed-dim: '#ddb7ff'
  on-secondary-fixed: '#2c0051'
  on-secondary-fixed-variant: '#6900b3'
  tertiary-fixed: '#ffdcc0'
  tertiary-fixed-dim: '#ffb875'
  on-tertiary-fixed: '#2d1600'
  on-tertiary-fixed-variant: '#6b3b00'
  background: '#0e1513'
  on-background: '#dde4e1'
  surface-variant: '#2f3634'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.02em
  code-sm:
    fontFamily: jetbrainsMono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.6'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-margin: 24px
  gutter: 16px
  sidebar-width: 240px
  stack-gap: 8px
  section-gap: 32px
---

## Brand & Style
The design system focuses on high-performance productivity, blending the precision of developer tools with the elegance of luxury software. It targets technical power users who require high information density without sacrificing visual clarity.

The aesthetic is a fusion of **Modern Corporate** and **Glassmorphism**, heavily influenced by the "dark-ops" aesthetic found in tools like Linear and Cursor. It utilizes deep slate backgrounds, subtle semi-transparent layers, and vibrant neon accents to create a sense of depth and focus. The interface should feel fast, technical, and premium, evoking a sense of calm control through balanced proportions and subdued surface transitions.

## Colors
This design system uses a hierarchical dark palette. The base foundation is a deep navy-slate (#0f172a), with elevated surfaces using a slightly lighter slate (#1e293b). 

The primary teal has been shifted to a brighter, high-contrast shade (#2dd4bf) to ensure accessibility and "glow" against dark backgrounds. Module-specific accents are saturated to pierce through the dark UI:
- **Agents (Purple):** A vibrant lilac for AI-driven interactions.
- **Builds (Green):** A sharp mint for success states and deployment logs.
- **Browser (Orange):** A warm amber for preview environments.

Use transparency (alphas of 4% to 12%) for subtle borders and overlays to maintain the glass effect.

## Typography
The system relies on **Inter** for all UI elements to ensure maximum legibility at small sizes. Information density is achieved by prioritizing `body-sm` (13px) for data-heavy views and code blocks. 

Headlines use tighter letter-spacing and semi-bold weights to create a "machined" look. For technical content, **JetBrains Mono** is introduced as a secondary font to clearly differentiate code snippets and terminal outputs from the standard UI labels. Use `text-slate-400` for secondary body text to maintain hierarchy against the primary white text.

## Layout & Spacing
The layout follows a **Fixed-Fluid hybrid** model. A 240px sidebar remains fixed, while the main content area utilizes a fluid grid with a maximum content width of 1440px. 

Spacing is based on a strict 4px baseline. High density is achieved by using 8px (stack-gap) between related elements and 16px (gutter) between logical modules. Breakpoints are defined at 768px (Tablet) and 1200px (Desktop). On mobile, sidebars collapse into a bottom navigation bar or a top-level drawer, and horizontal padding reduces from 24px to 16px.

## Elevation & Depth
Depth is created through **Glassmorphism** and tonal layering rather than traditional heavy shadows.

1.  **Level 0 (Base):** #0f172a.
2.  **Level 1 (Cards/Sidebar):** #1e293b at 80% opacity with a 12px backdrop blur.
3.  **Level 2 (Modals/Popovers):** #1e293b with a 1px solid border at 10% white opacity.
4.  **Accents:** Use a "bloom" effect (a soft 20px blur shadow) matching the accent color for active states (e.g., a glowing teal dot for active builds).

Borders are essential; use `rgba(255, 255, 255, 0.08)` for subtle separators to define shapes without creating visual noise.

## Shapes
The system utilizes a 12px (`0.75rem`) corner radius for all primary containers and cards, providing a soft, modern feel that contrasts with the technical, high-density content. 

Small interactive components like buttons and input fields use an 8px radius. Secondary elements like tags or chips can use a fully rounded "pill" shape if they represent status, but should otherwise adhere to the 8px standard for consistency.

## Components
- **Buttons:** Primary buttons use a solid Teal (#14b8a6) with white text. Secondary buttons use a ghost style: a 1px border of `white/10` and a hover state that lightens the background to `white/5`.
- **Inputs:** Dark slate background (#0f172a) with a 1px border. On focus, the border turns Teal with a 2px outer glow.
- **Cards:** Semi-transparent slate (#1e293b at 60%) with a 12px radius. Inner padding should be 16px or 20px.
- **Chips/Badges:** Small font (11px) with a subtle background tint of the accent color (10% opacity) and a high-vibrancy text color.
- **Lists:** Rows should have a subtle 1px bottom border (`white/4`). Hovering over a list item should trigger a `white/4` background highlight with a transition speed of 150ms.
- **Specialized:** An "Active Glow" component for Agents—a purple gradient border with a slow pulse animation.