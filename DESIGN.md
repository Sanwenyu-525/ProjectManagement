# Design System: ProjectManagement — Developer Agent Workbench

## 1. Visual Theme & Atmosphere

A **glassmorphism + Material Design 3** hybrid — clinical precision meets warm translucency. The interface feels like a well-lit developer cockpit: density-balanced (6/10), structured but never cluttered. Surfaces are layered frosted glass panes floating over a soft gradient wash. The atmosphere is focused, calm, and tool-like — no decorative flourishes, every pixel serves function.

- **Density:** Daily App Balanced (6) — compact data views with generous breathing room in primary workflows
- **Variance:** Offset Asymmetric (6) — sidebar + main split, stacked panels, no rigid symmetric grids
- **Motion:** Fluid CSS (5) — spring-physics transitions, staggered cascade reveals, no cinematic excess

**Light mode:** Soft blue-white wash background (#f8f9ff) with frosted glass surfaces at 70-80% opacity. Teal primary (#006b5f) anchors all interactive states.

**Dark mode:** Deep navy-charcoal (#0b1018) with dark glass surfaces at 88-94% opacity. Teal inverts to luminous cyan (#4fdbc8). Shadows deepen, borders become subtle luminous threads.

## 2. Color Palette & Roles

### Primary Palette

| Name | Light Hex | Dark Hex | Role |
|------|-----------|----------|------|
| Teal Primary | #006b5f | #4fdbc8 | CTAs, active states, focus rings, links |
| Teal Container | #14b8a6 | #006b5f | Filled buttons, active backgrounds |
| On Primary | #ffffff | #003d35 | Text on primary-filled surfaces |
| Charcoal Ink | #0b1c30 | #eaf1ff | Primary text, headings |
| Muted Steel | #3c4947 | #c0ccc9 | Secondary text, descriptions |
| Slate Ghost | #6c7a77 | #8a9a96 | Tertiary text, metadata, timestamps |

### Surface Hierarchy (Glassmorphism)

| Name | Light | Dark | Usage |
|------|-------|------|-------|
| Base Wash | #f8f9ff | #0b1018 | Page background gradient |
| Glass Surface | rgba(255,255,255,0.70) | rgba(13,20,29,0.88) | Cards, panels, sidebar |
| Glass Strong | rgba(255,255,255,0.80) | rgba(18,28,39,0.92) | Elevated cards, modals |
| Glass Input | rgba(255,255,255,0.75) | rgba(16,25,36,0.90) | Input fields, search boxes |
| Glass Border | rgba(255,255,255,0.50) | rgba(148,163,184,0.14) | Glass edge highlights |

All glass surfaces use `backdrop-filter: blur(20px) saturate(1.4)` with 1px solid borders.

### Semantic Accents

| Name | Light | Dark | Role |
|------|-------|------|------|
| Amber Warning | #d97706 | #f59e0b | Warnings, in-progress status |
| Purple Secondary | #6b38d4 | #8455ef | Secondary actions, tags, badges |
| Green Success | #16a34a | #22c55e | Completed status, success feedback |
| Red Error | #ba1a1a | #ffb4ab | Errors, destructive actions |
| Blue Info | #0ea5e9 | #38bdf8 | Informational callouts |

**Constraints:** Maximum 1 accent per context. Purple reserved for secondary/tag use only — never for primary CTAs. Amber for status/warnings only. No neon, no outer glows on any accent.

### Banned Colors
- Pure black (#000000) — use Charcoal Ink (#0b1c30) or dark surface tokens
- Pure white (#ffffff) only in `On Primary` text — use glass surface tokens for fills
- Neon purple/blue gradients — forbidden
- Oversaturated accents (saturation must stay below 80%)

## 3. Typography Rules

### Font Stacks

- **Display/Headlines:** Inter — weight 600-700, track-tight (-0.01em), hierarchy through weight and color, not oversized
- **Body:** Inter — weight 400-500, relaxed leading (1.5-1.6), max-width 65ch for readable paragraphs
- **Labels/UI:** Geist — weight 500, for sidebar labels, badges, compact UI elements
- **Mono/Code:** JetBrains Mono — for code blocks, terminal output, timestamps, file paths, data tables

### Type Scale

| Token | Size | Usage |
|-------|------|-------|
| --text-xs | 11px | Metadata, timestamps, badges |
| --text-sm | 13px | Secondary text, descriptions, inputs |
| --text-base | 14px | Body text, primary UI |
| --text-lg | 16px | Section headers, card titles |
| --text-xl | 20px | Page titles, modal headers |
| --text-2xl | 24px | Dashboard metrics |
| --text-3xl | 32px | Hero numbers, large metrics |

### Constraints
- Body text: max 65 characters per line for readability
- High-density views (density > 7): all numbers must use JetBrains Mono
- Chinese text: inherit same font stack, Inter/Geist handle CJK fallback via system fonts
- Never use font-size below 11px — accessibility floor

## 4. Component Stylings

### Buttons

**Primary (btn-md-primary):** Teal fill (#006b5f light / #4fdbc8 dark), white text. 8px radius, 8px 20px padding. On hover: brightness(1.1) + subtle shadow. On active: scale(0.98) + brightness(0.95). Tactile push feedback, no neon outer glow.

**Ghost (btn-md-ghost):** Transparent fill, 1px border (outline-variant). On hover: surface-container-high fill. On active: scale(0.98). Used for secondary actions.

**Icon (btn-md-icon):** 32x32px, 6px radius, transparent. On hover: surface-container-high fill. For toolbar actions and navigation.

**Subtle (btn-md-subtle):** Surface-container-high fill, no border. For tertiary actions and toggles.

### Cards (Glass Card)

Generously rounded (12px radius). Diffused shadow (`shadow-sm` on rest, `shadow-md` on hover). Background: glass surface token (70% opacity light / 88% dark). Border: 1px solid border token. On hover: shadow elevation shift. No overlapping — cards occupy their own spatial zone.

**Workspace panels:** Use reduced opacity glass (36-50%) with tighter blur (20px). Toolbar, navigator, tabbar each have distinct opacity levels for visual layering.

### Inputs

Label above input, helper text optional, error text below. Standard 8px gap between label and input. Focus ring: 2px primary-color glow (`0 0 0 2px var(--color-primary-light)`). No floating labels. Border radius: 8px. Background: glass-input token.

### Status Indicators

- **Done/Completed:** Green (#16a34a / #22c55e)
- **In Progress:** Amber (#d97706 / #f59e0b)
- **Todo/Pending:** Slate Ghost (#748198 / #718196)
- **Error/Cancelled:** Red (#dc2626 / #f87171)

### Tooltips

Dark in light mode (#0b1c30 bg, #f8fbff text). Light in dark mode (#f8fbff bg, #0b1c30 text). Rounded (8px), subtle shadow, 11px text.

### Skeleton Loaders

Gradient shimmer animation (teal-tinted at 12% opacity). Match exact layout dimensions — no generic spinners. 1.5s infinite cycle.

## 5. Layout Principles

### Structure

- **Sidebar (260px fixed):** Glass surface, vertical nav with icon + label. Active state: left border accent + primary-light fill.
- **Main Content:** Flexbox-driven, full remaining width. 24px container padding on desktop, 14-12px on mobile/tablet.
- **Workspace Split:** Agent panel + editor panel with draggable splitter (0.2-0.8 ratio). Terminal as collapsible bottom panel.

### Grid Philosophy

- Flexbox primary, CSS Grid for data tables and card grids
- Never use `calc()` percentage hacks — use flex ratios or grid template
- Max-width containment at 1400px for content-heavy pages
- Card grids: `repeat(auto-fill, minmax(180px, 1fr))` for responsive wrapping

### Spacing System

| Token | Value | Usage |
|-------|-------|-------|
| --space-1 | 4px | Tight gaps, icon-to-text |
| --space-2 | 8px | Component internal gaps |
| --space-3 | 12px | Card padding, list item gaps |
| --space-4 | 16px | Standard padding (responsive: 14px tablet, 12px mobile) |
| --space-5 | 20px | Section gaps |
| --space-6 | 24px | Container padding (responsive: 22px tablet, 20px mobile) |
| --space-8 | 32px | Major section dividers |

### Responsive Rules

- **Mobile (< 768px):** Sidebar collapses to icons-only (64px). All multi-column to single-column. Body text floor: 13px. Touch targets: min 44px.
- **Tablet (768-1024px):** Sidebar icons-only. Reduced padding. Two-column where appropriate.
- **Desktop (> 1024px):** Full sidebar with labels. Standard spacing.

## 6. Motion & Interaction

### Spring Physics

Default transition: `cubic-bezier(0.16, 1, 0.3, 1)` — fast entry, smooth settle. Duration: 0.2s standard, 0.15s fast, 0.3-0.4s slow.

Spring bounce for playful elements: `cubic-bezier(0.34, 1.56, 0.64, 1)` — subtle overshoot.

### Micro-Interactions

- **Hover lift:** `translateY(-4px)` + shadow-lg + glow shadow for card hover states
- **Click feedback:** `scale(0.97)` or `scale(0.98)` on all buttons and interactive elements
- **Focus ring:** 2px primary-color outline with 2px offset

### Cascade Reveals

Staggered entry animations for lists and card grids:
- `.animate-in`: fadeInUp 0.5s ease
- `.animate-in-delay-1` through `-4`: 0.1s increments
- Never mount lists instantly — always cascade

### Performance

Animate exclusively via `transform` and `opacity`. Never animate `top`, `left`, `width`, `height`. Backdrop-filter on glass elements only — no animated blur. Skeleton shimmer via `background-position` animation.

## 7. Anti-Patterns (Banned)

**Visual:**
- No emojis anywhere in the UI
- No pure black (#000000) backgrounds — use surface tokens
- No neon outer glow shadows on buttons or cards
- No oversaturated accent colors
- No gradient text on large headers
- No custom mouse cursors
- No overlapping elements — clean spatial separation always
- No 3-column equal card layouts — use asymmetric grids or auto-fill wrapping

**Typography:**
- No generic serif fonts (Times New Roman, Georgia, Garamond) — this is a developer tool, sans-serif only
- No font-size below 11px
- No centered hero sections with overlapping elements

**Copy:**
- No generic placeholder names ("John Doe", "Acme Corp")
- No fake round numbers ("99.99%", "50%")
- No AI copywriting cliches ("Elevate", "Seamless", "Unleash", "Next-Gen")
- No filler UI text ("Scroll to explore", "Swipe down")

**Layout:**
- No broken image links — use picsum.photos or SVG placeholders
- No horizontal scroll on mobile — critical failure
- No `h-screen` — use `min-h-[100dvh]` for iOS Safari compatibility
- No fixed pixel heights for content containers — use min-height or flex

**Code:**
- No `any` type in TypeScript
- No inline styles for colors — always reference CSS variables
- No hardcoded color hex values in components — use design tokens
