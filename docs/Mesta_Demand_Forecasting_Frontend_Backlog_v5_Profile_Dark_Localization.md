# Mesta Demand Forecasting
## Frontend-Only Backlog v5
### Profile Menu IA + Vestra-Inspired Neutral Dark Theme + Complete English Localization

**Version:** 5.0  
**Date:** 26 September 2026  
**Scope:** Frontend only  
**Repository:** `https://github.com/Demcruise/Mesta-Demand-Forecasting`  
**Branch:** `main`  
**Reference:** Current committed repository + attached Mesta/Vestra screenshots + Mesta Product Master Prompt v2 + React Bits Pro UI principles

---

# 0. Scope

This backlog is strictly frontend.

Included:

- Profile menu information architecture
- Account menu UX
- Sign out UX
- Theme system
- Dark theme token refinement
- Light/dark visual consistency
- English/Indonesian localization
- Localization regression
- Typography
- Navigation
- Shared components
- Visual QA
- Responsive QA
- Accessibility
- Frontend state behavior

Excluded:

- backend implementation
- database
- API implementation
- forecasting engine
- model training
- infrastructure
- deployment
- server authentication implementation
- server-side authorization
- backend telemetry
- backend audit persistence

Existing mock/session/frontend mechanisms remain the implementation environment.

---

# 1. Current Repository Baseline

The latest repository is:

```text
Demcruise/Mesta-Demand-Forecasting
```

Repository metadata shows the current `main` branch was pushed on 26 September 2026 and the project is TypeScript-based.

The latest frontend already contains:

```text
Next.js / React
TypeScript
Tailwind
Radix UI
TanStack Query
TanStack Table
TanStack Virtual
Recharts
Vitest
Playwright
axe
i18n
theme preferences
session provider
profile menu
shared tables
shared status components
```

The frontend already has a working `signOut()` path in the session context, so this backlog is an IA and presentation refinement rather than an authentication implementation project.

---

# 2. Primary User Requests

This backlog directly addresses three current requests:

## Request A — Profile menu

The profile icon menu currently contains too many categories of information in one surface:

```text
User identity
Personal preferences
Settings
Language
Theme
Demo controls
Session information
Sign out
```

This increases cognitive load because the menu is doing the job of both:

```text
Account menu
+
Settings surface
+
Developer/demo controls
```

The profile menu must be reduced to an account-oriented menu.

---

## Request B — Dark theme

Current Mesta dark mode is too blue-gray.

The reference screenshot from Vestra is substantially more neutral:

```text
charcoal
near-black
subtle neutral surfaces
thin neutral borders
bright neutral text
accent colors used sparingly
```

Mesta should not copy Vestra branding.

Mesta should copy the **visual relationship**:

```text
Neutral dark foundation
+
Small surface separation
+
Thin borders
+
Strong primary text
+
Muted secondary text
+
Blue used as accent
```

---

## Request C — English locale

English still contains some Indonesian UI copy.

The fix must be systemic.

Do not patch only visible screenshots.

Audit:

```text
page copy
component copy
status labels
breadcrumb labels
localized trees
tooltips
empty states
errors
notifications
settings
profile menu
mock UI strings
```

Rule:

```text
English locale = entirely English UI
Indonesian locale = entirely Indonesian UI
```

Exceptions:

```text
SKU
WAPE
ERP
POS
API
model names
product names
workspace names
person names
official integration names
```

---

# 3. Profile Menu UX Audit

## PROFILE-001 — Cognitive Load Assessment

**Priority:** P0

### Current behavior

The profile menu contains multiple layers of controls.

Current content includes:

```text
Identity
Personal preferences
Settings
Language
Theme
Demo controls
Session metadata
Sign out
```

### Problem

Users click the avatar expecting:

```text
Who am I?
Account
Settings
Sign out
```

Instead they receive:

```text
account
preferences
global settings
theme
language
developer controls
session diagnostics
```

This increases scan time and makes the menu feel like another Settings page.

### Desired principle

Profile menu should answer:

```text
Who am I?
What account actions can I take?
How do I leave?
```

---

# 4. Profile Menu New Information Architecture

## PROFILE-002

Target structure:

```text
┌─────────────────────────────────┐
│ Avatar                          │
│ Dimas Santos                    │
│ dimas.santoso@mesta.click       │
│ Manager · Retail Indonesia      │
├─────────────────────────────────┤
│ Personal preferences        →   │
│ Settings                    →   │
├─────────────────────────────────┤
│ Language                        │
│   ○ English                     │
│   ○ Bahasa Indonesia            │
├─────────────────────────────────┤
│ Theme                           │
│   ○ Light                       │
│   ○ Dark                        │
│   ○ Match system                │
├─────────────────────────────────┤
│ Sign out                        │
└─────────────────────────────────┘
```

---

# 5. Profile Menu Remove Demo Controls

## PROFILE-003

Move these out of profile:

```text
Slow network
Fail reads
Fail writes
```

They are not profile preferences.

They are demo/testing controls.

### New location

Recommended:

```text
Settings
→
Demo controls
```

Alternative:

```text
Settings
→
Developer / Demo
```

Use whichever matches the existing Settings IA.

### Acceptance criteria

Profile menu contains no:

```text
Slow network
Fail reads
Fail writes
```

---

# 6. Profile Menu Remove Session Diagnostics

## PROFILE-004

Current text includes:

```text
Signed in via Mesta Demo IdP (OIDC)
Session expires...
```

This is useful for developers, not normal users.

Remove it from the default profile menu.

### Alternative

Show only when:

```text
Demo mode diagnostics
```

is enabled.

If it remains visible, move it to:

```text
Settings → Session / Security
```

---

# 7. Sign Out

## PROFILE-005

The current session provider already contains:

```text
signOut("user")
```

and routes the user to:

```text
/signed-out
```

Keep this behavior.

The UI backlog only changes presentation.

---

## PROFILE-006 — Sign Out Position

Place Sign out at the bottom:

```text
separator
↓
Sign out
```

It should be visually separated from preferences.

---

## PROFILE-007 — Sign Out Icon

Use:

```text
LogOut
```

with consistent 16px icon size.

Do not use red by default.

Use destructive styling only during a confirmation state if such confirmation is actually necessary.

For normal sign-out:

```text
neutral text
normal hover
```

---

# 8. Sign Out Confirmation

## PROFILE-008

Do not automatically add a confirmation dialog unless UX testing demonstrates a real risk of accidental sign-out.

Preferred:

```text
Click Sign out
↓
Immediate sign out
↓
Signed Out page
```

This is consistent with a low-consequence account action.

If confirmation is required later:

```text
Are you sure you want to sign out?

[Cancel]
[Sign out]
```

Do not use:

```text
Delete
```

visual semantics.

---

# 9. Profile Menu Width

## PROFILE-009

Current profile dropdown is wide enough to behave like a mini Settings panel.

Target:

```text
width: 280–320px
```

But only if the content fits cleanly.

### Rule

Do not solve information overload by making the dropdown wider.

Solve it by reducing content.

---

# 10. Profile Menu Internal Spacing

## PROFILE-010

Structure:

```text
Identity block: 16px
Section separator: 8–12px
Menu row: 36–40px
Radio option: 32–36px
Bottom action: 36–40px
```

Avoid tall vertical gaps.

---

# 11. Profile Menu Identity Block

## PROFILE-011

Display:

```text
Avatar
Name
Email
Role · Workspace
```

Do not show:

```text
environment
session expiry
IDP
technical metadata
```

in the main identity block.

---

# 12. Profile Menu Localization

English:

```text
Personal preferences
Settings
Language
English
Bahasa Indonesia
Theme
Light
Dark
Match system
Sign out
```

Indonesian:

```text
Preferensi pribadi
Pengaturan
Bahasa
English
Bahasa Indonesia
Tema
Terang
Gelap
Ikuti sistem
Keluar
```

Important:

`English` and `Bahasa Indonesia` remain the language names and should not be translated.

---

# 13. Profile Menu Cognitive Load Acceptance

Pass when:

```text
[ ] User can identify account identity immediately
[ ] Settings is clearly separate
[ ] Sign out is easy to find
[ ] Demo controls are absent
[ ] Technical session metadata is absent
[ ] Menu fits in one viewport
[ ] No long text blocks
[ ] No duplicated Settings content
```

---

# 14. Dark Theme Audit

## DARK-001 — Current Problem

Current Mesta dark base is too blue:

```css
--bg-canvas: #0d141d;
--bg-surface: #141d28;
--bg-subtle: #172231;
--bg-muted: #1d2938;
--bg-hover: #1f2c3c;
```

The interface therefore reads as:

```text
navy / blue-gray
```

rather than:

```text
neutral charcoal
```

---

# 15. Dark Theme Direction

Use the Vestra screenshot as the visual reference for:

```text
canvas
surface
sidebar
border
text
input
dropdown
hover
active
selected
```

Do NOT copy Vestra's brand identity.

Mesta's blue remains Mesta's accent.

---

# 16. Proposed Dark Canvas Tokens

## DARK-002

Target:

```css
--bg-canvas: #101010;
--bg-surface: #151515;
--bg-subtle: #191919;
--bg-muted: #202020;
--bg-hover: #242424;
--bg-selected: #202942;
--bg-overlay: rgb(0 0 0 / 0.62);
```

These are target direction values, not claims that they are Vestra's original source tokens.

---

# 17. Dark Border Tokens

## DARK-003

```css
--border-default: #292929;
--border-subtle: #202020;
--border-strong: #383838;
```

### Rules

Normal:

```text
border-default
```

Nested:

```text
border-subtle
```

Focused / emphasized:

```text
border-strong
```

Do not use blue borders for every active element.

---

# 18. Dark Text Tokens

## DARK-004

```css
--fg-primary: #F3F4F6;
--fg-secondary: #A7ADB7;
--fg-tertiary: #737984;
--fg-disabled: #555B64;
```

### Hierarchy

Primary:

```text
page title
main value
important table value
primary labels
```

Secondary:

```text
description
metadata
supporting labels
```

Tertiary:

```text
timestamps
hints
secondary metadata
```

---

# 19. Mesta Blue as Accent

## DARK-005

Keep blue for:

```text
primary action
active navigation
selected rows
selected control
focus
links
forecast line
interactive indicators
```

Do not use blue for:

```text
canvas
every surface
every border
every badge
```

---

# 20. Dark Input System

## DARK-006

Inputs:

```text
background: #151515 or #191919
border: #292929
text: #F3F4F6
placeholder: #737984
```

Focus:

```text
border: primary
ring: subtle primary alpha
```

No full blue fill.

---

# 21. Dark Dropdown System

## DARK-007

Dropdown:

```text
background: #161616
border: #2A2A2A
shadow: subtle dark elevation
```

Menu item:

```text
default: transparent
hover: #202020
selected: primary subtle
```

Checkbox:

```text
unchecked: neutral
checked: primary fill
```

---

# 22. Dark Sidebar

## DARK-008

The sidebar should be visually separated from the canvas but remain neutral.

Target:

```text
sidebar: #141414–#181818
canvas: #101010
```

Difference should be subtle.

Avoid:

```text
blue sidebar
bright blue selected background
```

Selected nav:

```text
neutral surface
+
primary accent indicator
```

---

# 23. Dark Active Navigation

## DARK-009

Target:

```text
background: #202020
left accent: Mesta primary
text: primary
icon: primary
```

Do not fill the entire nav item in blue.

---

# 24. Dark Cards

## DARK-010

Cards:

```text
background: #151515
border: 1px solid #292929
shadow: none
```

Do not use:

```text
blue card surface
heavy shadow
large glow
```

---

# 25. Dark Table

## DARK-011

Table:

```text
canvas: #101010
row: #101010
hover: #181818
selected: #1E293B
border: #202020
header: #121212 or #151515
```

Rows must remain clearly separated without heavy striping.

---

# 26. Dark Table Text

Primary:

```text
#F3F4F6
```

Secondary:

```text
#A7ADB7
```

Numeric:

```text
#F3F4F6
```

Metadata:

```text
#737984
```

---

# 27. Dark Metric Cards

## DARK-012

The compact metric cards should become:

```text
Card #151515
Border #292929

Label #A7ADB7
Value #F3F4F6
Delta semantic
Sparkline muted accent
```

No blue card fill.

---

# 28. Dark Charts

## DARK-013

Forecast:

```text
primary blue
```

Actual:

```text
near-white or muted neutral
```

Previous:

```text
tertiary gray
```

Prediction interval:

```text
primary blue alpha 0.12–0.18
```

Grid:

```text
#242424
```

Axis:

```text
#737984
```

---

# 29. Dark Semantic Colors

Maintain semantic distinction:

```text
Success
#6FBF5A

Warning
#E7A33E

Critical
#EF6166

Info
#4AA8DC
```

But reduce saturation where necessary against near-black.

Status badges must remain readable without glowing.

---

# 30. Dark Badge Style

Default:

```text
border
subtle tinted background
semantic text
```

Avoid:

```text
solid saturated backgrounds
large pills
glowing status
```

---

# 31. Dark Theme Visual Hierarchy

Desired:

```text
Level 1
Canvas
#101010

Level 2
Surface
#151515

Level 3
Subtle section
#191919

Level 4
Hover
#202020

Level 5
Selected
primary-subtle
```

Not:

```text
canvas navy
card blue-gray
nested card darker blue
nested control blue
```

---

# 32. Dark Theme Screenshot QA

Test these pages:

```text
Overview
Forecast Runs
Forecast Explorer
Forecast Insights
Data Quality
Planning
Scenarios
Exceptions
Approvals
Monitoring
Audit
Users & Roles
Decision Lineage
Settings
Profile menu
```

At:

```text
1440×900
1280×800
390×844
```

---

# 33. Dark Theme QA Checklist

```text
[ ] Canvas feels neutral
[ ] Sidebar feels neutral
[ ] Cards do not look blue
[ ] Text contrast is comfortable
[ ] Borders are visible but subtle
[ ] Blue is used as accent
[ ] Status colors remain semantic
[ ] Tables remain readable
[ ] Inputs are distinct
[ ] Dropdowns are distinct
[ ] Selected nav is clear
[ ] Selected table row is clear
[ ] Charts remain readable
[ ] No excessive glow
[ ] No bright border noise
```

---

# 34. English Localization Audit

## I18N-001

The latest repository already uses:

```text
en.ts
id.ts
localized()
localizedRecord()
pick()
```

The remaining problem is consistency.

The target is:

```text
EN = English everywhere
ID = Indonesian everywhere
```

---

# 35. Localization Rule

Do not allow:

```text
English page
+
Indonesian status
+
English button
+
Indonesian tooltip
```

A locale must control the entire UI tree.

---

# 36. Localization Exceptions

Do not translate:

```text
SKU
WAPE
ERP
POS
API
OIDC
SSO
model version
product name
person name
workspace name
company name
```

Everything else should be reviewed.

---

# 37. English Leakage Categories

Audit these sources:

```text
1. Hardcoded JSX text
2. English localized tree
3. Status mapping
4. Metadata labels
5. Breadcrumb segments
6. Tooltips
7. aria-label
8. Placeholders
9. Toast messages
10. Error messages
11. Empty states
12. Column names
13. Table controls
14. Settings labels
15. Profile menu
16. Mock UI-only text
```

---

# 38. English Leakage Example

Bad:

```ts
localized(
  [
    { key: "exception", label: "Perlu Ditinjau" }
  ],
  [
    { key: "exception", label: "Exceptions" }
  ]
)
```

Correct:

```ts
localized(
  [
    { key: "exception", label: "Perlu Ditinjau" }
  ],
  [
    { key: "exception", label: "Exception" }
  ]
)
```

---

# 39. Localization Dictionary Integrity

The following dictionaries must have matching key structures:

```text
en.ts
id.ts
```

Automated test:

```ts
expect(Object.keys(en)).toEqual(Object.keys(id))
```

Recursively compare nested keys.

---

# 40. Localization Regression Test

Build a frontend test that:

```text
locale = EN
visit affected pages
collect user-visible strings
detect Indonesian words

locale = ID
visit affected pages
collect user-visible strings
detect leftover English-only UI
```

Use a controlled dictionary of language signatures.

Do not blindly reject:

```text
product names
people
workspaces
technical terms
```

---

# 41. Profile Localization

English:

```text
Personal preferences
Settings
Language
English
Bahasa Indonesia
Theme
Light
Dark
Match system
Demo controls → moved out
Session details → moved out
Sign out
```

Indonesian:

```text
Preferensi pribadi
Pengaturan
Bahasa
English
Bahasa Indonesia
Tema
Terang
Gelap
Ikuti sistem
Kontrol demo → moved out
Detail sesi → moved out
Keluar
```

---

# 42. Settings Localization

English:

```text
Table density
Comfortable
Compact
Applies to all tables in Mesta.
```

Indonesian:

```text
Kerapatan tabel
Nyaman
Padat
Berlaku untuk semua tabel di Mesta.
```

---

# 43. Navigation Localization

English must remain:

```text
Overview
Forecasting
Forecast Runs
Forecast Explorer
Forecast Insights
Forecast Schedules
Demand Data
Products
Historical Demand
Data Quality
Data Sources
Models
Model Registry
Model Performance
Backtesting
Planning
Plan Workspace
Scenarios
Compare Scenarios
Exceptions
Approvals
System
Integrations
Monitoring
Audit Log
Users & Roles
Forecast Lineage
Settings
```

Indonesian counterpart must remain consistently Indonesian.

Do not mix:

```text
Forecast Explorer
+
Perlu Ditinjau
```

in English locale.

---

# 44. Status Localization

English:

```text
Draft
Queued
Processing
Completed
Published
Approved
Rejected
Needs review
Failed
Paused
Archived
Stale
Unavailable
Pending decision
Open
Investigating
Resolved
Dismissed
Escalated
Revision requested
In review
Simulated
Connected
Syncing
Warning
Disconnected
Active
Invited
Suspended
Production
Candidate
Training
Overridden
No issues
```

Indonesian must be fully mapped.

---

# 45. Breadcrumb Localization

Current segment maps are already locale-aware.

Audit every route:

```text
/overview
/forecasting/*
/demand-data/*
/models/*
/planning/*
/scenarios/*
/administration/*
/monitoring
```

No raw segment should appear in English locale if a mapped label exists.

---

# 46. Accessibility Localization

Every:

```text
aria-label
aria-describedby
aria-description
tooltip
```

must follow the active locale.

Do not localize visible labels while leaving accessibility labels Indonesian.

---

# 47. Placeholder Localization

English:

```text
Search products, runs, models or scenarios
```

Indonesian:

```text
Cari produk, proses, model, atau skenario
```

Keep placeholder short.

---

# 48. Error Localization

English:

```text
The forecast could not be loaded.
```

Indonesian:

```text
Perkiraan tidak dapat dimuat.
```

Avoid mixed error messages.

---

# 49. Notification Localization

English:

```text
Forecast completed
Data source needs attention
Approval required
```

Indonesian:

```text
Perkiraan selesai
Sumber data perlu diperiksa
Perlu persetujuan
```

---

# 50. Profile Menu Visual Relationship

Profile menu must feel connected to the top-right avatar.

Use:

```text
border
surface
subtle shadow
```

Dark mode:

```text
#161616
border #2A2A2A
```

Light:

```text
#FFFFFF
border #E5E7EB
```

---

# 51. Profile Menu Radio UX

Language/theme options should behave as radio groups.

Selected:

```text
filled indicator
primary
```

Unchecked:

```text
empty neutral circle
```

Never use a visually ambiguous state.

---

# 52. Profile Menu Demo Controls

If moved into Settings:

```text
Settings
→
Demo controls
```

Use:

```text
Slow network
Fail reads
Fail writes
```

Only show if environment is:

```text
Demo
Development
```

Do not expose demo controls in a normal enterprise workspace without context.

---

# 53. Settings IA Revision

Recommended:

```text
Personal
  Personal preferences
  Notifications

Workspace
  Workspace
  Forecasting
  Data & integrations
  Approvals
  Users & roles
  Audit & retention
  Security
  API

Appearance
  Language
  Theme
  Table density

Demo
  Demo controls
```

This makes the profile menu lighter.

---

# 54. Settings Page Intro

Current description is too long.

English:

```text
Manage your preferences and workspace settings.
```

Indonesian:

```text
Atur preferensi pribadi dan ruang kerja.
```

Avoid:

```text
Personal preferences apply only to you. Workspace settings apply to everyone and are recorded...
```

as a large page subtitle.

Move detailed explanation into contextual helper text.

---

# 55. Dark Settings Page

Settings should follow the same neutral dark system.

No special darker blue panel.

---

# 56. Dark Profile Menu

Profile dropdown should look like a subtle elevated surface:

```text
canvas #101010
menu #171717
border #2A2A2A
hover #212121
selected #202942
```

---

# 57. Profile Menu Responsive

Desktop:

```text
right aligned
```

Mobile:

```text
full-width or nearly full-width bottom sheet/popover
```

Do not let the menu extend beyond viewport.

---

# 58. Profile Menu Keyboard QA

Test:

```text
Tab
Arrow Up
Arrow Down
Enter
Space
Escape
```

Radio groups:

```text
Arrow Up/Down changes option
```

Sign out:

```text
Enter triggers
```

---

# 59. Dark Mode Theme Preference Behavior

The existing frontend preference mechanism supports theme:

```text
light
dark
system
```

Keep these three options.

Default can remain the existing preference behavior.

This backlog only changes the visual token system.

---

# 60. Dark Mode Transition

Avoid a dramatic flash between:

```text
light
↔
dark
```

Use existing theme bootstrap behavior.

Do not add unnecessary animation.

---

# 61. Global Dark Component Audit

Review:

```text
Button
Input
Select
Checkbox
Radio
Tabs
Badge
DataTable
Panel
Drawer
Dialog
Popover
Tooltip
Toast
MetricCard
Chart
Sidebar
Topbar
Profile Menu
```

Every component must consume semantic dark tokens.

---

# 62. No Hardcoded Dark Colors

Search:

```bash
rg -n "#0d141d|#141d28|#172231|#1d2938|#1f2c3c" src
```

Any remaining occurrences outside token definitions should be reviewed.

Preferred:

```text
bg-canvas
bg-surface
bg-subtle
bg-muted
bg-hover
```

---

# 63. Dark Token Migration

Do not change individual components first.

Order:

```text
globals.css
↓
shared component tokens
↓
page screenshots
↓
page-specific exceptions only if necessary
```

---

# 64. Color Acceptance

Dark theme passes only if:

```text
[ ] Canvas is neutral
[ ] Surface separation is visible
[ ] Blue no longer dominates surfaces
[ ] Primary action remains recognizable
[ ] Selected nav is visible
[ ] Text hierarchy works
[ ] Borders do not disappear
[ ] Borders do not glow
[ ] Charts remain legible
```

---

# 65. English Acceptance

English locale passes only if:

```text
[ ] No Indonesian UI string
[ ] No Indonesian breadcrumb
[ ] No Indonesian status
[ ] No Indonesian tooltip
[ ] No Indonesian error
[ ] No Indonesian notification
[ ] No Indonesian accessibility label
[ ] No Indonesian settings label
[ ] No Indonesian profile menu label
```

---

# 66. Profile Acceptance

```text
[ ] Profile menu no longer behaves like Settings
[ ] Demo controls removed
[ ] Session diagnostics removed
[ ] Settings link retained
[ ] Personal preferences retained
[ ] Language retained
[ ] Theme retained
[ ] Sign out added/retained at bottom
[ ] Menu fits in viewport
```

---

# 67. Frontend QA Matrix

## Light

```text
Overview
Settings
Profile menu
DataTable
Dropdown
Dialog
Chart
```

## Dark

```text
Overview
Settings
Profile menu
DataTable
Dropdown
Dialog
Chart
```

## English

```text
all affected routes
```

## Indonesian

```text
all affected routes
```

## Mobile

```text
390×844
```

---

# 68. Visual Regression Set

Create baselines for:

```text
Overview
Forecast Runs
Forecast Explorer
Forecast Insights
Data Quality
Planning
Scenarios
Exceptions
Approvals
Monitoring
Audit
Users & Roles
Decision Lineage
Settings
Profile Menu open
```

At:

```text
1440×900
1280×800
390×844
```

---

# 69. Profile Screenshot Tests

Screenshot states:

```text
Profile closed
Profile open
Language = EN
Language = ID
Theme = Light
Theme = Dark
```

---

# 70. Dark Screenshot Tests

At minimum:

```text
Overview
Settings
Profile menu
Forecast Explorer
Data Quality
Planning
```

These expose most shared surfaces.

---

# 71. Component-Level Testing

Test:

```text
MetricCard
Panel
DataTable
ColumnManager
DropdownMenuCheckboxItem
StatusBadge
ProfileMenu
ThemeControl
LocaleControl
```

---

# 72. Regression Test — Theme

Given:

```text
theme = dark
```

verify:

```text
body background
sidebar background
topbar background
card background
table background
input background
dropdown background
dialog background
```

all use intended semantic dark tokens.

---

# 73. Regression Test — Locale

Given:

```text
locale = en
```

visit all routes and ensure no known Indonesian UI term appears.

Given:

```text
locale = id
```

ensure no known English-only page label remains.

---

# 74. Final Implementation Sequence

## Phase 1 — Profile

```text
1. simplify profile menu
2. remove demo controls
3. remove session diagnostics
4. verify sign out
5. tighten menu spacing
6. localize
```

---

## Phase 2 — Dark Theme

```text
1. revise dark tokens
2. update surfaces
3. update borders
4. update text
5. update inputs
6. update dropdowns
7. update selected navigation
8. update tables
9. update charts
10. update metric cards
```

---

## Phase 3 — Localization

```text
1. audit en.ts
2. audit id.ts
3. audit localized trees
4. audit page hardcoded strings
5. audit tooltips
6. audit aria labels
7. audit status labels
8. audit breadcrumbs
9. add regression
```

---

## Phase 4 — QA

```text
1. light
2. dark
3. EN
4. ID
5. desktop
6. mobile
7. keyboard
8. visual regression
```

---

# 75. Anti-Patterns

Do not:

```text
turn profile menu into Settings
show developer controls to normal users
use blue as dark canvas
use blue cards everywhere
use bright borders
use glowing badges
translate technical identifiers
leave Indonesian in English locale
leave English in Indonesian locale
solve localization with manual if/else everywhere
```

---

# 76. Final Design Formula

## Light

```text
White canvas
+
white surfaces
+
thin borders
+
minimal shadow
+
restrained accent
```

## Dark

```text
Neutral charcoal canvas
+
slightly lighter surfaces
+
thin neutral borders
+
bright neutral text
+
Mesta blue accent
```

## Profile

```text
Identity
+
Preferences
+
Language
+
Theme
+
Sign out
```

## Localization

```text
One locale
=
One language system
```

---

# 77. Final User Experience

When the user clicks the avatar:

```text
"I see my account and the actions I need."
```

When the user switches to dark:

```text
"The interface becomes calm and neutral, not blue-heavy."
```

When the user switches to English:

```text
"The entire product becomes English."
```

When the user switches to Indonesian:

```text
"The entire product becomes Indonesian."
```

---

# 78. Final Definition of Done

The frontend refinement is complete when:

```text
[ ] Profile menu is concise
[ ] Sign out is visible and functional
[ ] Demo controls are moved out
[ ] Session diagnostics are moved out
[ ] Dark theme uses neutral foundation
[ ] Vestra-inspired tonal hierarchy is achieved without copying branding
[ ] Mesta blue remains accent
[ ] English is fully English
[ ] Indonesian is fully Indonesian
[ ] Theme changes consistently across all shared components
[ ] Profile menu works in light/dark
[ ] Settings works in light/dark
[ ] Tables work in light/dark
[ ] Dropdowns work in light/dark
[ ] Charts work in light/dark
[ ] Mobile profile menu works
[ ] Keyboard navigation works
[ ] Visual regression passes
[ ] Localization regression passes
```

---

# 79. Final Product Principle

Mesta should not ask users to understand the UI architecture.

The UI should make the architecture disappear.

```text
Profile
→ account actions

Settings
→ preferences

Dark mode
→ neutral and comfortable

Language
→ complete language switch

Forecasting
→ clear and operational
```

The goal is:

```text
less cognitive load
+
less visual noise
+
less language inconsistency
+
more product confidence
```