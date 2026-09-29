# SIBYL Design System

**Version:** 1.0  
**Design language:** Clinical / Institutional / Futuristic / Precise  
**Platforms:** Web, React, React Native, Expo  
**Web stack:** HeroUI + Tailwind CSS  
**Native stack:** React Native + Expo  
**Reference aesthetic:** Psycho-Pass-inspired institutional interfaces  
**Core principle:** *The interface should feel sterile before it feels beautiful.*

---

## 01 — Design Principles

### Clinical

The UI should feel engineered for an institution rather than designed for marketing.

Prefer:
- white
- cool gray
- blue
- thin borders
- precise typography
- structured information

Avoid:
- decorative gradients
- excessive shadows
- excessive rounding
- visual noise
- unnecessary illustrations

### Precise

Everything has a reason. Spacing, typography, alignment, status indicators, and hierarchy should feel deliberate.

### Restrained

Blue is an **operational color**, not a decorative color. A screen should still feel like SIBYL if the blue accents are removed.

### Informational

Data is beautiful because it is organized. Tables, values, timestamps, system states, graphs, and metadata are first-class visual elements.

### Slightly Unsettling

There should be a subtle sense that the interface is always:
- observing
- measuring
- evaluating
- recording
- analyzing

But never in a cheesy sci-fi way.

---

## 02 — Brand Vocabulary

| Concept | Meaning |
|---|---|
| System | The application/platform |
| Subject | A tracked entity/user/object |
| Analysis | Computation or processing |
| Scan | Data collection |
| Coefficient | Numeric evaluation |
| Status | Current system state |
| Record | Historical data |
| Event | Something that occurred |
| Alert | Something requiring attention |
| Protocol | A predefined workflow |
| Authorization | Permission/state |

Use this vocabulary in UI copy where appropriate to reinforce the system identity.

---

## 03 — Color Tokens

### Primitive Colors

```ts
export const colors = {
  white: '#FFFFFF',
  black: '#000000',

  ink: {
    950: '#071017',
    900: '#0D171E',
    800: '#15212B',
    700: '#24313B',
    600: '#3E4D57',
    500: '#64727D',
    400: '#87939B',
    300: '#AAB5BC',
    200: '#C8D1D6',
    100: '#E0E6E9',
    50: '#F3F6F7',
  },

  system: {
    950: '#002A35',
    900: '#003B4A',
    800: '#00566B',
    700: '#006F8A',
    600: '#008EAE',
    500: '#12AFCF',
    400: '#42C5E0',
    300: '#82D9EC',
    200: '#B9EAF7',
    100: '#DDF5FC',
    50: '#EFFBFF',
  },

  success: {
    700: '#087C70',
    600: '#0D9B8C',
    500: '#16B8A6',
    100: '#DDF7F3',
    50: '#EFFCF9',
  },

  warning: {
    700: '#986D15',
    600: '#B88622',
    500: '#D9A441',
    100: '#FBF1D8',
    50: '#FFF9EB',
  },

  danger: {
    700: '#9F3039',
    600: '#BD3C47',
    500: '#D84B55',
    100: '#F9E2E4',
    50: '#FEF4F5',
  },
} as const
```

### Semantic Colors

Never use primitive colors directly inside application components. Use semantic tokens.

```ts
export const semanticColors = {
  background: '#FFFFFF',
  backgroundSubtle: '#F7F9FA',
  backgroundCool: '#F1F6F9',

  foreground: '#15212B',
  foregroundSecondary: '#24313B',
  foregroundMuted: '#64727D',
  foregroundDisabled: '#AAB5BC',

  border: '#D9E1E6',
  borderSubtle: '#E9EEF1',
  borderStrong: '#AAB5BC',

  primary: '#12AFCF',
  primaryHover: '#008EAE',
  primaryActive: '#006F8A',
  primarySoft: '#EFFBFF',

  success: '#16B8A6',
  successSoft: '#EFFCF9',

  warning: '#D9A441',
  warningSoft: '#FFF9EB',

  danger: '#D84B55',
  dangerSoft: '#FEF4F5',
}
```

### Dark Mode

SIBYL is fundamentally a light interface. Dark mode should feel like **Night Operations Mode**, not a simple color inversion.

```ts
export const darkSemanticColors = {
  background: '#071017',
  backgroundSubtle: '#0D171E',
  backgroundCool: '#102029',

  foreground: '#F3F6F7',
  foregroundSecondary: '#D9E1E6',
  foregroundMuted: '#87939B',

  border: '#263640',
  borderSubtle: '#1B2931',
  borderStrong: '#40515B',

  primary: '#42C5E0',
  primaryHover: '#82D9EC',
  primaryActive: '#B9EAF7',
  primarySoft: '#003B4A',
}
```

Dark mode should remain relatively rare.

---

## 04 — Typography

### Font Stack

Primary:
- Inter

Technical:
- IBM Plex Mono

Fallback:
- `ui-monospace`
- `SFMono-Regular`
- Menlo
- Monaco
- Consolas
- monospace

### Type Tokens

```ts
export const typography = {
  display: {
    fontFamily: 'Inter',
    fontSize: 56,
    lineHeight: 1.05,
    fontWeight: 600,
    letterSpacing: '-0.03em',
  },

  h1: {
    fontSize: 36,
    lineHeight: 1.1,
    fontWeight: 600,
    letterSpacing: '-0.02em',
  },

  h2: {
    fontSize: 28,
    lineHeight: 1.2,
    fontWeight: 600,
  },

  h3: {
    fontSize: 22,
    lineHeight: 1.25,
    fontWeight: 600,
  },

  h4: {
    fontSize: 18,
    lineHeight: 1.3,
    fontWeight: 600,
  },

  body: {
    fontSize: 16,
    lineHeight: 1.5,
    fontWeight: 400,
  },

  bodySmall: {
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 400,
  },

  label: {
    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 600,
    letterSpacing: '0.04em',
  },

  technical: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 400,
  },

  technicalSmall: {
    fontFamily: 'IBM Plex Mono',
    fontSize: 10,
    lineHeight: 1.3,
    fontWeight: 400,
    letterSpacing: '0.04em',
  },
}
```

### Typography Rules

Use technical typography for:
- IDs
- timestamps
- measurements
- percentages
- coordinates
- system codes
- diagnostics
- versions
- numerical KPIs

Example:

```text
SUBJECT ID
PSY-04-8821

LAST SCAN
09:42:18

COEFFICIENT
142.7
```

Do not use monospace for paragraphs.

---

## 05 — Spacing

Base unit: **4px**

```ts
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
  32: 128,
}
```

Default component padding:
- small: 12px
- medium: 16px
- large: 24px

---

## 06 — Radius

SIBYL deliberately uses small radii.

```ts
export const radius = {
  none: 0,
  sm: 2,
  md: 4,
  lg: 6,
  xl: 8,
  full: 9999,
}
```

Default radius: **4px**

Avoid excessive `rounded-full`.

---

## 07 — Borders

Default:

```css
border: 1px solid #D9E1E6;
```

Subtle:

```css
border: 1px solid #E9EEF1;
```

Strong:

```css
border: 1px solid #AAB5BC;
```

Focus:

```css
border: 1px solid #12AFCF;
```

---

## 08 — Shadows

Default:

```text
none
```

Available:

```ts
export const shadows = {
  none: 'none',

  subtle:
    '0 1px 3px rgba(20, 40, 50, 0.06)',

  medium:
    '0 6px 20px rgba(20, 40, 50, 0.08)',

  overlay:
    '0 16px 48px rgba(20, 40, 50, 0.14)',
}
```

Use shadows sparingly.

---

## 09 — Layout

Desktop maximum content width:

```text
1440px
```

Standard page:

```text
max-width: 1440px
margin: auto
padding: 32px
```

Large dashboard:

```text
padding: 40px
```

Mobile:

```text
16px
```

Tablet:

```text
24px
```

### Grid

Desktop:
- 12 columns
- 24px gutters

Tablet:
- 8 columns
- 20px gutters

Mobile:
- 4 columns
- 16px gutters

---

## 10 — Core Component: SystemPanel

`SystemPanel` is the foundational SIBYL visual primitive.

```tsx
<SystemPanel
  eyebrow="SYSTEM / PSYCHO-SCAN"
  title="Current Coefficient"
  value="142.7"
  status="STABLE"
/>
```

Visual rules:
- white background
- 1px border
- 4px radius
- 24px padding
- small technical eyebrow
- strong title
- large technical value
- status indicator

Example:

```text
┌──────────────────────────────────────────┐
│ SYSTEM / PSYCHO-SCAN             09:42   │
├──────────────────────────────────────────┤
│                                          │
│ CURRENT COEFFICIENT                      │
│                                          │
│ 142.7                                    │
│                                          │
│ ─────────────────────────────────────    │
│                                          │
│ STATUS                         ● STABLE   │
└──────────────────────────────────────────┘
```

---

## 11 — SystemHeader

```tsx
<SystemHeader
  eyebrow="SYSTEM / ANALYSIS"
  title="Subject Overview"
  description="Current system analysis and records."
/>
```

Visual hierarchy:

```text
SYSTEM / ANALYSIS

Subject Overview
Current system analysis and records.
```

Eyebrows are uppercase and technical.

---

## 12 — SystemLabel

```tsx
<SystemLabel>
  LAST ANALYSIS
</SystemLabel>
```

Style:
- 10–12px
- uppercase
- IBM Plex Mono
- letter spacing: 0.06em
- muted

---

## 13 — SystemValue

Used for important numerical information.

```tsx
<SystemValue>
  142.7
</SystemValue>
```

Default:
- 48px
- IBM Plex Mono
- medium weight
- ink

Large:
- 72px

---

## 14 — SystemStatus

```tsx
<SystemStatus status="elevated" />
```

Supported statuses:

```ts
type SystemStatus =
  | 'online'
  | 'stable'
  | 'monitor'
  | 'elevated'
  | 'critical'
  | 'offline'
  | 'unknown'
```

Visual:

```text
● STABLE
```

Do not use pill badges by default.

---

## 15 — SystemButton

Three variants.

### Primary

```tsx
<SystemButton variant="primary">
  Execute Analysis
</SystemButton>
```

### Secondary

```tsx
<SystemButton variant="secondary">
  View Record
</SystemButton>
```

### Ghost

```tsx
<SystemButton variant="ghost">
  View Details →
</SystemButton>
```

Rules:
- 4px radius
- 40–44px height
- 12–14px typography
- medium weight
- minimal animation
- no pill buttons by default

---

## 16 — SystemInput

```tsx
<SystemInput
  label="SUBJECT IDENTIFIER"
  placeholder="PSY-04-8821"
/>
```

Structure:

```text
SUBJECT IDENTIFIER

┌──────────────────────────────────────┐
│ PSY-04-8821                          │
└──────────────────────────────────────┘
```

Focus:
- blue border
- subtle blue outer ring

---

## 17 — SystemSelect

```tsx
<SystemSelect
  label="ANALYSIS TYPE"
  options={[
    'Psycho-Scan',
    'Coefficient Analysis',
    'Historical Record',
  ]}
/>
```

Same visual language as `SystemInput`.

---

## 18 — SystemCheckbox

Minimal square checkbox.

```text
□ INCLUDE HISTORICAL RECORDS
```

Checked:

```text
☑ INCLUDE HISTORICAL RECORDS
```

Blue fill with white check.

---

## 19 — SystemSwitch

Used for persistent settings.

Example:

```text
AUTO ANALYSIS                         ●──
```

Avoid oversized modern mobile-style switches.

---

## 20 — SystemAlert

Variants:
- info
- success
- warning
- danger

Example:

```text
┌────────────────────────────────────────────┐
│ ● SYSTEM NOTICE                            │
│                                            │
│ Analysis completed successfully.           │
└────────────────────────────────────────────┘
```

Use semantic color primarily in:
- indicator
- eyebrow
- icon

Keep the surface mostly white.

---

## 21 — SystemModal

Example:

```text
┌──────────────────────────────────────────┐
│ SYSTEM / AUTHORIZATION                   │
│                                          │
│ Confirm analysis                         │
│                                          │
│ This operation will initiate a complete  │
│ subject analysis.                        │
│                                          │
│ ──────────────────────────────────────── │
│                                          │
│ CANCEL                  EXECUTE ANALYSIS │
└──────────────────────────────────────────┘
```

No giant rounded containers.

---

## 22 — SystemTable

Tables are a major SIBYL component.

```tsx
<SystemTable
  columns={[
    'ID',
    'STATUS',
    'COEFFICIENT',
    'LAST SCAN',
  ]}
/>
```

Visual:

```text
ID          STATUS       COEFFICIENT      LAST SCAN
──────────────────────────────────────────────────────
PSY-8821    ● STABLE     42.1             09:42:18
PSY-8822    ● MONITOR    87.4             09:41:03
PSY-8823    ● ELEVATED   121.8            09:39:42
```

Avoid vertical borders unless necessary.

---

## 23 — SystemTimeline

For event history:

```text
09:42:18
SUBJECT SCAN
PSY-8821
COMPLETE
    │
    │
09:41:03
COEFFICIENT ALERT
PSY-8822
MONITOR
    │
    │
09:39:42
SUBJECT SCAN
PSY-8823
COMPLETE
```

---

## 24 — SystemChart

Charts should use:
- white background
- subtle grid
- blue primary line
- minimal axes
- monospace values
- small labels

Avoid unnecessary gradients.

### Visualization palette

Primary:
`system-500`

Secondary:
`system-300`

Neutral:
`ink-300`

Success:
`success-500`

Warning:
`warning-500`

Danger:
`danger-500`

Maximum recommended simultaneous semantic colors: **3–4**.

---

## 25 — Icons

Recommended library: **Lucide**

Icon philosophy:
- thin
- technical
- simple
- consistent

Default:
- 16px

Large:
- 20px / 24px

Avoid:
- filled cartoon icons
- excessive icon decoration
- emoji
- huge illustrations

---

## 26 — Motion

Motion should feel like a machine.

### Durations

```ts
export const motion = {
  instant: 100,
  fast: 150,
  normal: 200,
  slow: 300,
  system: 400,
}
```

### Easing

```text
cubic-bezier(0.2, 0.8, 0.2, 1)
```

Avoid:
- bounce
- elastic
- overshoot
- playful spring animations

---

## 27 — Signature SIBYL Animations

### Scan

A thin blue line traverses a panel.

Duration:
- 600–1000ms

Use sparingly.

### Data Update

New values briefly transition through the system blue state and return to normal.

### System Initialization

```text
INITIALIZING
     ↓
CALIBRATING
     ↓
CONNECTING
     ↓
ONLINE
```

Use sparingly.

---

## 28 — Focus States

Accessibility is mandatory.

```css
outline: 2px solid #12AFCF;
outline-offset: 2px;
```

Do not rely exclusively on color.

---

## 29 — Accessibility

Target: **WCAG 2.2 AA**

Requirements:
- minimum 4.5:1 normal text contrast
- 3:1 large text
- visible focus
- keyboard navigation
- reduced-motion support
- accessible labels
- semantic HTML
- screen reader descriptions

System states cannot communicate through color alone.

Bad:

```text
●
```

Better:

```text
● ELEVATED
```

---

## 30 — Responsive Behavior

### Desktop

Dense information is acceptable.

Typical structure:

```text
sidebar
main content
secondary panel
```

### Tablet

Collapse secondary panels.

### Mobile

Prioritize:
1. status
2. primary metric
3. primary action
4. recent events

Tables should become cards or appropriately structured mobile lists instead of forcing tiny columns.

---

## 31 — Web Architecture

Recommended monorepo:

```text
apps/
  web/
  native/

packages/
  tokens/
  ui/
  ui-web/
  ui-native/
  icons/
  eslint-config/
  typescript-config/
```

### Web stack

- React
- HeroUI
- Tailwind CSS
- Lucide
- Storybook

---

## 32 — Token Architecture

```text
tokens/
├── colors.ts
├── typography.ts
├── spacing.ts
├── radius.ts
├── shadows.ts
├── motion.ts
└── index.ts
```

Everything should export from:

```text
packages/tokens/src/index.ts
```

---

## 33 — Web Component Architecture

```text
ui-web/
├── Button/
├── Input/
├── Select/
├── Checkbox/
├── Switch/
├── Modal/
├── Table/
├── Tabs/
├── Navigation/
├── Tooltip/
└── Toast/
```

HeroUI provides the behavioral/accessibility foundation. SIBYL supplies the visual system.

---

## 34 — HeroUI Strategy

Do not directly couple application code to HeroUI APIs everywhere.

Prefer:

```tsx
<SystemButton />
<SystemInput />
<SystemModal />
<SystemSelect />
```

Internally these may use HeroUI:

```tsx
HeroUI Button
HeroUI Input
HeroUI Modal
HeroUI Select
```

This abstraction layer makes it possible to change the underlying UI library later.

---

## 35 — Tailwind Strategy

Tailwind should consume SIBYL tokens.

Good:

```tsx
<div className="
  bg-surface
  border
  border-border
  rounded-md
  p-6
">
```

Avoid arbitrary design values:

```tsx
<div className="
  bg-[#ffffff]
  border-[#d9e1e6]
  rounded-[4px]
">
```

No arbitrary design values in application code unless genuinely necessary.

---

## 36 — Tailwind Theme

Conceptually:

```css
@theme {
  --color-surface: #ffffff;
  --color-surface-subtle: #f7f9fa;
  --color-surface-cool: #f1f6f9;

  --color-ink: #15212b;
  --color-text: #24313b;
  --color-muted: #64727d;

  --color-border: #d9e1e6;
  --color-border-subtle: #e9eef1;

  --color-system: #12afcf;
  --color-system-hover: #008eae;

  --color-success: #16b8a6;
  --color-warning: #d9a441;
  --color-danger: #d84b55;
}
```

---

## 37 — React Native / Expo Architecture

Expo/React Native consumes the exact same token definitions.

```text
ui-native/
├── SystemPanel.tsx
├── SystemButton.tsx
├── SystemInput.tsx
├── SystemStatus.tsx
├── SystemHeader.tsx
├── SystemTable.tsx
├── SystemModal.tsx
└── SystemTimeline.tsx
```

Use React Native primitives underneath:
- View
- Text
- Pressable
- TextInput
- ScrollView
- FlatList
- Modal

Do not attempt to make React Native behave like a browser. Preserve the visual language while using platform-appropriate interactions.

---

## 38 — Platform Differences

The design language remains identical, but implementation differs.

### Web

Optimize for:
- hover
- keyboard
- mouse
- tooltips
- dense tables
- sidebar navigation

### Mobile

Optimize for:
- press
- swipe
- safe areas
- bottom sheets
- stacked cards
- larger touch targets

---

## 39 — Mobile Touch Targets

Minimum:

```text
44 × 44px
```

Preferred:

```text
48 × 48px
```

The visual control can appear smaller as long as the interactive hit area is sufficiently large.

---

## 40 — Navigation

### Desktop

```text
┌────────────────────────────┐
│ SIBYL SYSTEM               │
│                            │
│ ▌ DASHBOARD                │
│   SUBJECTS                 │
│   ANALYSIS                 │
│   RECORDS                  │
│                            │
│ ────────────────────────── │
│                            │
│   SYSTEM                   │
│   SETTINGS                 │
└────────────────────────────┘
```

Active state:
- blue vertical bar
- blue text

Do not use a large blue rounded pill.

### Mobile

Bottom navigation is acceptable:

```text
┌──────────────────────────────┐
│                              │
│         APPLICATION          │
│                              │
├──────────────────────────────┤
│  ◉       ◇       ≡       ⚙  │
│ SYSTEM  ANALYSIS RECORDS SET │
└──────────────────────────────┘
```

Keep it restrained.

---

## 41 — Tabs

Use underline/indicator navigation.

```text
OVERVIEW     ANALYSIS     RECORDS
─────────
```

Active indicator: system blue.

Avoid pill tabs.

---

## 42 — Empty States

Do not use cute illustrations.

Example:

```text
NO RECORDS AVAILABLE

No analysis records have been generated
for this subject.

────────────────────────────────

INITIATE ANALYSIS →
```

---

## 43 — Loading States

Prefer skeletons and system language.

```text
ANALYZING SUBJECT...

██████████████████░░░░░

PROCESSING RECORD 04 / 07
```

Or:

```text
SCANNING...
```

Avoid casual language such as "Hang tight!"

---

## 44 — Error States

Use clinical, actionable language.

```text
SYSTEM ERROR

Analysis could not be completed.

ERROR CODE
ANL-00482

RETRY ANALYSIS →
```

Avoid casual copy such as "Oops!"

---

## 45 — Toasts

Minimal:

```text
● ANALYSIS COMPLETE
Subject record updated.
```

Auto-dismiss:
- 3–5 seconds

---

## 46 — Forms

Recommended hierarchy:

```text
SYSTEM / CONFIGURATION

Analysis Parameters

PARAMETER A
[input]

PARAMETER B
[input]

ANALYSIS MODE
[select]

────────────────────────────

CANCEL       SAVE CONFIGURATION
```

Labels go above inputs. Never rely on placeholders as labels.

---

## 47 — Cards

There are three primary levels:

### Panel

Standard information container.

### Elevated Panel

Used for emphasis.

### Critical Panel

Used for warnings or critical system states.

Avoid dozens of card variants.

---

## 48 — Background Philosophy

Primary:

```text
#FFFFFF
```

Secondary:

```text
#F7F9FA
```

Cool:

```text
#F1F6F9
```

Blue should generally appear inside the interface rather than behind it.

---

## 49 — Decorative System Elements

Optional subtle technical decoration:

```text
SYSTEM 04
────────────────────
STATUS: ONLINE
```

or:

```text
SYS/ANL
v1.04.28
```

or small corner markers.

Decoration must never compete with actual information.

---

## 50 — Logo Treatment

Wordmark:

```text
SIBYL
```

Typography:
- Inter SemiBold

Optional technical suffix:

```text
SIBYL / SYSTEM
```

or:

```text
SIBYL
SYSTEM 01
```

Logo should be monochrome by default. Blue can indicate an active system state.

---

## 51 — Voice & Copy

SIBYL copy should be:

**short, clinical, declarative.**

Prefer:

> Analysis complete.

Instead of:

> Your analysis has been successfully completed!

Prefer:

> Authorization required.

Instead of:

> Please enter your credentials to continue.

Prefer:

> No records available.

Instead of:

> Looks like there isn't anything here yet!

---

## 52 — Naming Convention

Components:

```text
SystemButton
SystemPanel
SystemHeader
SystemInput
SystemSelect
SystemStatus
SystemAlert
SystemTable
SystemChart
SystemTimeline
SystemModal
SystemLabel
SystemValue
```

Tokens:

```text
system.*
surface.*
foreground.*
border.*
spacing.*
radius.*
motion.*
```

---

## 53 — Component API Philosophy

Prefer semantic APIs.

Good:

```tsx
<SystemStatus status="elevated" />
```

Bad:

```tsx
<SystemBadge
  background="#f9e2e4"
  color="#d84b55"
/>
```

Good:

```tsx
<SystemPanel emphasis="critical" />
```

Bad:

```tsx
<SystemPanel
  borderColor="#D84B55"
/>
```

Application code should speak in **system concepts**, not colors.

---

## 54 — Component States

Every interactive component should define, where applicable:

```text
default
hover
pressed
focus
disabled
loading
error
success
```

Not every component needs every state visually.

---

## 55 — Design Token Ownership

The hierarchy must be:

```text
Primitive tokens
       ↓
Semantic tokens
       ↓
Component tokens
       ↓
Components
       ↓
Applications
```

Example:

```text
system-500
   ↓
primary
   ↓
button-primary-background
   ↓
SystemButton
   ↓
Dashboard
```

This makes global redesign possible.

---

## 56 — Component Token Example

```ts
export const buttonTokens = {
  primary: {
    background: colors.system[500],
    backgroundHover: colors.system[600],
    backgroundPressed: colors.system[700],
    foreground: colors.white,
  },

  secondary: {
    background: colors.white,
    border: colors.ink[200],
    foreground: colors.ink[800],
  },
}
```

---

## 57 — Storybook

The design system should have Storybook documentation.

```text
FOUNDATIONS
  Colors
  Typography
  Spacing
  Radius
  Motion
  Icons

COMPONENTS
  Buttons
  Inputs
  Forms
  Panels
  Tables
  Alerts
  Navigation
  Charts

PATTERNS
  Dashboards
  Analysis
  Records
  System States
  Empty States
  Error States
```

Every component should document:
- anatomy
- variants
- states
- accessibility
- responsive behavior
- usage guidance
- do/don't examples

---

## 58 — Canonical Dashboard

The reference SIBYL dashboard should demonstrate the entire system.

```text
SIBYL SYSTEM                              ● ONLINE
────────────────────────────────────────────────────────────

SYSTEM / OVERVIEW

Operational Overview
Current system state and active analysis.

┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ SUBJECTS         │ │ ACTIVE SCANS     │ │ ALERTS           │
│                  │ │                  │ │                  │
│ 1,482            │ │ 27               │ │ 03               │
│ +2.4%            │ │ LIVE             │ │ REQUIRES ACTION  │
└──────────────────┘ └──────────────────┘ └──────────────────┘


COEFFICIENT DISTRIBUTION

      ╭─────────╮
  ╭───╯         ╰────╮
──╯                   ╰────────

08:00     10:00     12:00     14:00


RECENT SYSTEM EVENTS

09:42:18   SUBJECT SCAN          PSY-8821     COMPLETE
09:41:03   COEFFICIENT ALERT     PSY-8822     MONITOR
09:39:42   SUBJECT SCAN          PSY-8823     COMPLETE
```

This dashboard is the visual reference implementation.

---

## 59 — SIBYL Visual Identity

A screenshot should be recognizable as SIBYL even without the logo.

The visual identity is the combination of:

**White canvas**

+

**Cool gray structure**

+

**Thin borders**

+

**Azure/cyan operational blue**

+

**Monospace technical metadata**

+

**Tiny uppercase labels**

+

**Precise tables**

+

**Sparse iconography**

+

**Small radius**

+

**Minimal shadows**

+

**Mechanical animation**

=

### SIBYL

---

## 60 — Explicit Anti-Patterns

Do not allow the implementation to drift into:

### Generic SaaS

```text
purple gradients
huge rounded cards
floating shadows
```

### Cyberpunk

```text
black backgrounds
neon cyan everywhere
glowing borders
scanlines everywhere
```

### Apple-ish

```text
giant rounded cards
heavy blur
excessive glass
```

### Material-ish

```text
large elevation
pill-shaped controls
strong color blocks
```

### Dashboard Bro

```text
every KPI has a giant colored card
```

SIBYL should remain **sterile, authoritative, and quiet**.

---

# 61 — Package Structure

Recommended packages:

```text
@sibyl/tokens
@sibyl/ui
@sibyl/ui-web
@sibyl/ui-native
@sibyl/icons
```

Applications:

```text
apps/
├── web
└── mobile
```

Web dependencies:

```text
React
HeroUI
Tailwind CSS
Lucide
Storybook
```

Native dependencies:

```text
React Native
Expo
Expo Router
React Native Reanimated
Lucide React Native
```

---

# 62 — Final Architecture

```text
                         ┌─────────────────────┐
                         │   SIBYL TOKENS      │
                         │                     │
                         │ colors              │
                         │ typography          │
                         │ spacing             │
                         │ radius              │
                         │ shadows             │
                         │ motion              │
                         └──────────┬──────────┘
                                    │
                       ┌────────────┴────────────┐
                       │                         │
              ┌────────▼────────┐       ┌────────▼────────┐
              │   SIBYL WEB     │       │  SIBYL NATIVE   │
              │                 │       │                 │
              │ Tailwind        │       │ React Native    │
              │ HeroUI          │       │ Expo            │
              │ React           │       │                 │
              └────────┬────────┘       └────────┬────────┘
                       │                         │
                       └────────────┬────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │   SIBYL COMPONENTS  │
                         │                     │
                         │ SystemPanel         │
                         │ SystemButton        │
                         │ SystemInput         │
                         │ SystemStatus        │
                         │ SystemTable         │
                         │ SystemChart         │
                         │ SystemAlert         │
                         │ SystemModal         │
                         │ SystemTimeline      │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │    APPLICATIONS      │
                         │                     │
                         │ Dashboard           │
                         │ Analysis            │
                         │ Records             │
                         │ Settings            │
                         └─────────────────────┘
```

---

# 63 — Implementation Directive for Codex

When implementing SIBYL in an existing application:

1. **Inspect the existing application architecture before modifying it.**
2. Identify the existing styling system, component library, routing, state management, and platform constraints.
3. Do not rewrite unrelated application logic.
4. Preserve existing functionality and business logic.
5. Introduce SIBYL tokens as the source of truth for visual decisions.
6. Replace ad-hoc colors with semantic SIBYL tokens.
7. Replace inconsistent spacing with the SIBYL spacing scale.
8. Replace excessive corner rounding with SIBYL radius tokens.
9. Reduce unnecessary shadows.
10. Preserve or improve accessibility.
11. Use HeroUI primitives on web where they provide appropriate behavior/accessibility.
12. Wrap HeroUI components with SIBYL components rather than coupling application code directly to HeroUI.
13. Use the same semantic tokens in React Native/Expo.
14. Keep native interactions platform appropriate.
15. Do not introduce web-specific assumptions into native components.
16. Do not introduce native-specific assumptions into web components.
17. Use Lucide icons consistently.
18. Keep animation restrained and mechanical.
19. Avoid decorative cyberpunk effects.
20. Keep the UI predominantly white/light.
21. Use blue as an operational accent.
22. Use monospace typography for technical data.
23. Use uppercase technical labels sparingly.
24. Do not use color alone to communicate state.
25. Support reduced motion.
26. Maintain WCAG 2.2 AA accessibility on web.
27. Maintain appropriate touch targets on native.
28. Document reusable components in Storybook where applicable.
29. Prefer reusable semantic components over page-specific styling.
30. Before creating a new component, check whether an existing SIBYL component can express the required behavior.

### Critical design constraint

**Do not interpret "Psycho-Pass-inspired" as "make everything neon, dark, glowing, or cyberpunk."**

The target is:

> **sterile institutional futurism**

The interface should feel like a highly regulated system designed for continuous monitoring and analysis.

### Source of truth

When implementation conflicts with an existing visual style, SIBYL should take precedence for the surfaces/components being migrated.

When SIBYL conflicts with platform conventions, preserve the SIBYL visual language while following platform accessibility and interaction conventions.

### Quality bar

The finished product should look like a coherent system designed by one organization—not a collection of third-party components.

The most important characteristics, in order:

1. Information hierarchy
2. Cleanliness
3. Consistency
4. Precision
5. Restraint
6. System identity
7. Animation/decorative effects

**Never sacrifice the first five for the last two.**
