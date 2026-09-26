# Mesta Demand Forecasting
## Frontend Backlog v4 — Super Detailed UI/UX Polish, Alignment, Density, Localization & Forecast-Specific Lineage

**Version:** 4.0  
**Tanggal:** 26 September 2026  
**Scope:** Frontend only  
**Repository:** `https://github.com/Demcruise/Mesta-Demand-Forecasting`  
**Visual reference:** `https://vestra-dashboard01.vercel.app/` + attached screenshots  
**Primary product reference:** Mesta Enterprise Product Master Prompt v2  
**Implementation target:** Current repository state after latest updates

---

# 0. Executive Summary

This backlog is the next frontend implementation pass for Mesta Demand Forecasting.

The current frontend already has:

- App Shell
- Navigation
- Overview
- Forecast Runs
- Create Forecast Run
- Forecast Explorer
- Forecast Insights
- Demand Data
- Data Quality
- Models
- Scenarios
- Planning
- Exceptions
- Approvals
- Monitoring
- Audit Log
- Users & Roles
- Decision Lineage
- Settings
- Shared DataTable
- Shared MetricCard
- Shared StatusBadge
- Shared Column visibility menu
- i18n for English and Indonesian
- responsive primitives
- automated accessibility checks
- visual regression infrastructure

This backlog does **not** ask for a new product architecture.

It asks for a focused frontend refinement pass:

```text
Current implementation
        ↓
System-level audit
        ↓
Fix shared component contracts
        ↓
Simplify metric cards
        ↓
Remove per-table density controls
        ↓
Move density preference to Settings
        ↓
Fix table column alignment
        ↓
Fix checked-state styling
        ↓
Tighten Data Quality table
        ↓
Move Scenario Step 3 below Steps 1–2
        ↓
Fix monitoring badge vertical alignment
        ↓
Redesign Decision Lineage around forecasting
        ↓
Eliminate mixed-language UI
        ↓
Visual regression across all affected pages
```

---

# 1. Non-Goals

This backlog is frontend only.

Do NOT expand scope into:

- backend implementation;
- database;
- forecasting engine;
- ML model implementation;
- real authentication provider;
- server authorization;
- infrastructure;
- production deployment;
- API implementation;
- server-side audit storage;
- data pipeline implementation.

The existing mock/API layer remains the data source for this frontend implementation pass.

---

# 2. Current Repository Anchors

The following existing files are directly relevant to this backlog.

## Shared layout

```text
src/components/page/page.tsx
src/components/shell/app-shell.tsx
src/components/shell/app-sidebar.tsx
src/components/shell/nav-config.ts
```

## Shared tables

```text
src/components/tables/data-table.tsx
src/components/tables/filter-bar.tsx
src/components/tables/saved-views.tsx
src/components/tables/export-menu.tsx
```

## Shared UI controls

```text
src/components/ui/button.tsx
src/components/ui/controls.tsx
src/components/ui/overlay.tsx
src/components/ui/select.tsx
```

## Shared forecasting visuals

```text
src/components/forecasting/metrics.tsx
src/components/charts/*
src/components/feedback/status.tsx
src/components/feedback/freshness.tsx
```

## Affected feature pages

```text
src/features/overview/overview-view.tsx

src/features/forecast-runs/runs-view.tsx
src/features/forecast-runs/create-run-view.tsx

src/features/forecast-explorer/explorer-view.tsx

src/features/analytics/insights-view.tsx

src/features/demand-data/quality-view.tsx

src/features/planning/plan-view.tsx

src/features/scenarios/scenario-builder.tsx

src/features/exceptions/exceptions-view.tsx

src/features/approvals/approvals-view.tsx

src/features/monitoring/monitoring-view.tsx

src/features/governance/audit-view.tsx
src/features/governance/users-view.tsx
src/features/governance/lineage-view.tsx

src/features/settings/settings-view.tsx
```

## Localization

```text
src/lib/i18n/core.ts
src/lib/i18n/en.ts
src/lib/i18n/id.ts
src/lib/i18n/index.tsx
src/lib/i18n/types.ts
```

---

# 3. Global Design Direction

## FE-V4-001 — White-first canvas

**Priority:** P0  
**Scope:** Global

The entire light UI must use a true white page canvas.

### Target

```text
Canvas       #FFFFFF
Surface      #FFFFFF
Subtle       #FAFAFA
Muted        #F5F5F5
Hover        #F5F7FA
Border       #E5E7EB
```

### Rules

- `body` background = white.
- Main application canvas = white.
- Cards = white.
- Tables = white.
- Header = white.
- Sidebar = white.
- Gray surfaces only for intentional secondary zones.
- Never use gray as the default page background.

### Acceptance criteria

- Overview is white.
- Forecast Runs is white.
- Forecast Explorer is white.
- Data Quality is white.
- Planning is white.
- Exceptions is white.
- Monitoring is white.
- Audit is white.
- Decision Lineage is white.
- Settings is white.
- No accidental `#f5f7f9` canvas remains in light mode.

---

# 4. Visual Reference Principle

The attached reference dashboard should be interpreted as:

```text
sparse KPI presentation
+
white cards
+
small icon
+
clear label
+
large metric
+
small comparison row
+
small trend visual
```

Do NOT copy another product literally.

Extract only the useful visual principles:

- metric cards should breathe;
- text should be short;
- the main number should dominate;
- context should be secondary;
- trends can be represented visually;
- cards should not become mini-paragraphs.

---

# 5. Shared Metric Card Redesign

This is the largest shared-component task in this backlog.

Current `MetricCard` is intentionally information-heavy:

```text
label
value
context
footnote
link
tooltip
delta
```

That pattern is now causing the four-card sections to feel crowded.

## FE-METRIC-001 — Add compact metric card variant

**Priority:** P0  
**File:** `src/components/forecasting/metrics.tsx`

Create a shared presentation variant:

```text
MetricCard
  variant="compact"
```

or introduce:

```text
CompactMetricCard
```

Prefer a single shared component with variants rather than a second unrelated card implementation.

### Anatomy

```text
┌──────────────────────────────────────────┐
│ [icon] Label                             │
│                                          │
│ 4,770,960                                │
│ units                                    │
│                                          │
│ ↗ +1.6%       vs previous run    ~~~~~  │
└──────────────────────────────────────────┘
```

### Required hierarchy

1. Icon + label
2. Main value
3. Comparison/delta
4. Optional micro trend
5. Optional one-line metadata

### Remove from default card

Do NOT show all of:

- long explanatory paragraph;
- CTA link;
- footnote paragraph;
- tooltip indicator;
- comparison sentence;
- multiple metadata lines

at the same time.

### Interaction

The card may still be clickable, but:

- preferably make the entire card clickable;
- remove long inline CTA text;
- use subtle arrow icon on hover if needed;
- do not create a second CTA row.

### Height

All four sibling cards must be equal height.

Recommended:

```text
min-height: 176–192px
```

Exact height may be tuned after visual QA.

### Internal spacing

```text
card padding: 20–24px
header → value: 16–20px
value → comparison: 8–12px
comparison → trend: 4–8px
```

### Acceptance criteria

- No metric card becomes a paragraph.
- Main value is visually dominant.
- All sibling cards are equal height.
- No card has a dangling link.
- Card hierarchy is understandable in < 3 seconds.
- No card is visually denser than the others without reason.

---

# 6. Metric Card Icon System

## FE-METRIC-002

Each compact metric card may have one icon.

Use:

```text
size: 16–18px
```

Place:

```text
icon + label
```

Do NOT place:

```text
huge icon box
gradient icon container
```

Icon should be:

- neutral by default;
- semantic when status is important;
- same visual weight across siblings.

---

# 7. Metric Value Formatting

## FE-METRIC-003

Use one primary value.

Examples:

```text
$248.42K
4.77M
94.3%
87
21.6%
```

For Mesta demand data, prefer:

```text
4.77M
```

instead of:

```text
4,770,960
```

when the card is meant to be scanned quickly.

Full number can still be available in tooltip or detail surface.

Use exact full numbers in:

- tables;
- detailed views;
- tooltip;
- accessible label.

---

# 8. Metric Comparison Row

## FE-METRIC-004

Comparison row:

```text
↗ +1.6%
vs previous run
```

or:

```text
↘ -2.1 pts
vs previous evaluation
```

Rules:

- short;
- one line;
- tabular numbers;
- no paragraph;
- no duplicated explanation.

Important:

A positive/negative forecast change is not automatically good/bad.

Do not imply business judgment unless product semantics explicitly define it.

---

# 9. Micro Trend

## FE-METRIC-005

Add optional sparkline.

Use only when historical comparison data already exists.

Do not create fake trend values solely to make the card look complete.

If no trend data exists:

```text
comparison row only
```

not:

```text
fake sparkline
```

---

# 10. Forecast Health Cards — User Request #1

## PAGE-OVERVIEW-HEALTH-001

**Priority:** P0  
**File:** `src/features/overview/overview-view.tsx`

Current:

```text
Forecast health
4 very dense MetricCards
```

### Replace with

Section title:

```text
Forecast health
```

or localized equivalent.

Cards:

### Card 1

```text
Forecasted demand

4.77M
units

↗ +1.6%
vs previous run
```

Optional sparkline.

---

### Card 2

```text
Forecast accuracy

21.6%
WAPE

↓ 1.4 pts
vs previous evaluation
```

Use actual comparison if available.

---

### Card 3

```text
Forecast bias

+2.5%

vs previous evaluation
```

Optional sparkline.

---

### Card 4

```text
Open exceptions

87

29 critical · 58 warning
```

No long explanatory paragraph.

### Remove

From default visible card surface:

```text
Backtest BT-0411...
Positive means...
Target within ±3%
View model performance →
Review exceptions →
```

Those can move to:

- tooltip;
- detail page;
- section action;
- drawer.

### Acceptance criteria

- Four cards visually match the reference density.
- No card is a mini documentation block.
- Cards share the same anatomy.
- Cards remain readable at 1280px.
- No text wraps unnecessarily.
- No dangling CTA links.

---

# 11. Forecast Health Card Actions

## PAGE-OVERVIEW-HEALTH-002

Instead of four internal card CTA links, move primary actions to section-level actions.

Example:

```text
Forecast health                        View forecast details →
```

or:

```text
Forecast health
```

with each card clickable.

### Rule

Choose one pattern.

Do not mix:

```text
clickable card
+
inline CTA link
```

unless there is a clear accessibility reason.

---

# 12. Forecast Run Table — User Request #2

## PAGE-RUNS-001

**Priority:** P0  
**Files:**

```text
src/features/forecast-runs/runs-view.tsx
src/components/tables/data-table.tsx
```

### Problem

The Horizon/Periode column does not visually align consistently with its header and adjacent text columns.

### Target

```text
Periode
28 hari
60 hari
90 hari
```

must share the same left text axis.

### Rules

- qualitative fields = left;
- numeric fields = right unless product semantics require otherwise;
- horizon is a qualitative categorical field;
- do not mark horizon as numeric;
- no manual margin hacks.

### Acceptance criteria

Header and body:

```text
Periode
28 hari
60 hari
90 hari
```

all begin on the same x-coordinate.

---

# 13. Table Alignment Contract

## TABLE-ALIGN-001

Enhance `ColumnMeta`.

Current alignment is primarily inferred from:

```text
meta.numeric
```

Introduce explicit:

```ts
align?: "left" | "center" | "right"
```

### Resolution order

```text
meta.align
↓
if numeric → right
↓
default → left
```

### Example

```ts
{
  id: "horizon",
  header: "Horizon",
  meta: {
    width: "96px",
    align: "left"
  }
}
```

---

# 14. Forecast Explorer Alignment — User Request #4

## PAGE-EXPLORER-ALIGN-001

**Priority:** P0  
**File:** `src/features/forecast-explorer/explorer-view.tsx`

### Fields requested

```text
Actual (prior)
Exceptions
```

must use a controlled alignment instead of inheriting an inconsistent numeric alignment.

### Recommended

For this product pass:

```text
Actual (prior) → left
Exception      → left
```

because they are being used as contextual columns rather than financial amount columns.

### Important

Do not solve using:

```css
margin-left
translateX
position relative
```

Use `ColumnMeta.align`.

---

# 15. Forecast Explorer Column Contract

## PAGE-EXPLORER-ALIGN-002

Recommended:

```text
Produk          left
Forecast        right
Previous        right
Actual (prior)  left   ← requested
Change          right
Trend           left / center
80% interval    right
Status          left
Perlu Ditinjau  left   ← requested
```

### Acceptance criteria

Header and every row use identical alignment rules.

---

# 16. Remove Comfortable / Compact Toggle Everywhere — User Requests #2, #4, #7, #9, #12

## DENSITY-001

**Priority:** P0  
**Global component:** `src/components/tables/data-table.tsx`

Remove:

```text
Comfortable
Compact
```

from DataTable toolbars.

### Why

The control is a user preference, not a page-level table action.

It currently:

- consumes toolbar space;
- creates visual noise;
- causes toolbar controls to wrap awkwardly;
- makes each page look slightly different;
- introduces unnecessary local density choices.

---

# 17. Density Moves to Settings

## DENSITY-002

**Priority:** P0  
**File:** `src/features/settings/settings-view.tsx`

Settings should own:

```text
Table density
```

Options:

```text
Comfortable
Compact
```

### English UI

```text
Table density

Comfortable
Compact
```

Helper:

```text
Applies to tables across Mesta.
```

### Indonesian UI

```text
Kerapatan tabel

Nyaman
Padat
```

Helper:

```text
Berlaku untuk semua tabel di Mesta.
```

---

# 18. Density Preference Ownership

## DENSITY-003

`DataTable` should read:

```ts
prefs.density
```

as the default and preferred density.

Remove:

```text
localDensity
```

unless there is a documented special-case requirement.

### Preferred architecture

```text
Settings
   ↓
User preference
   ↓
DataTable
   ↓
All tables
```

not:

```text
Page
 ↓
DataTable local state
 ↓
Different density
```

---

# 19. Default Density

## DENSITY-004

Recommended product default:

```text
Compact
```

Reason:

- demand forecasting contains dense tables;
- the screenshots show excessive row height in current state;
- the reference visual language is compact and clean.

User can still choose:

```text
Comfortable
```

globally in Settings.

### Acceptance criteria

At first visit:

```text
table density = Compact
```

unless existing user preference already exists.

---

# 20. Density Toolbar Removal QA

## DENSITY-QA-001

Search source tree for:

```text
Comfortable
Compact
hideDensityToggle
Rows3
Row density
```

No page toolbar should render a density toggle after the implementation.

Allowed locations:

```text
Settings
Accessibility documentation
component tests
```

---

# 21. Toolbar Realignment After Density Removal

## TOOLBAR-001

After deleting Comfortable/Compact from tables, restructure each toolbar into:

```text
┌──────────────────────────────────────────────────────────────────┐
│ Search   Filter   Status   Sort            Views Columns Export │
└──────────────────────────────────────────────────────────────────┘
```

### Left group

```text
Search
primary filters
secondary filters
sort
```

### Right group

```text
Views
Columns
Export
```

Only include controls that exist for the page.

---

# 22. Toolbar Layout Rules

## TOOLBAR-002

Use:

```css
display: flex;
align-items: center;
justify-content: space-between;
gap: 8–12px;
flex-wrap: wrap;
```

### Important

Do not allow:

```text
Columns
```

to float alone vertically while the rest of the controls are in another line.

### Desktop

All controls should visually share the same toolbar row when width permits.

### Smaller width

Wrap as:

```text
Search + filters
↓
Views + Columns + Export
```

rather than:

```text
random wrap order
```

---

# 23. Create Forecast Run Freshness — User Request #3

## PAGE-CREATE-FRESH-001

**Priority:** P0  
**File:** `src/features/forecast-runs/create-run-view.tsx`

Current issue:

```text
Data freshness
POS updated 30 minutes ago
```

collides with the metric next to it.

### Target

Use stacked content:

```text
Data freshness

POS updated 30 minutes ago
```

inside one fixed-width metric column.

---

# 24. Create Run Data Summary Layout

## PAGE-CREATE-FRESH-002

The summary row should use:

```text
grid-template-columns:
repeat(4, minmax(0, 1fr))
```

or equivalent responsive grid.

Each cell:

```text
label
value
supporting line
```

No content should cross into adjacent cells.

### Example

```text
Historical window
365 days

Data available through
24 Sep 2026

Data freshness
POS updated
30 minutes ago

Missing periods
12 SKUs affected
```

---

# 25. Create Run Freshness Text

## PAGE-CREATE-FRESH-003

Use line break for the detail:

```text
Data freshness
POS updated
30 minutes ago
```

or:

```text
Data freshness

POS updated 30 minutes ago
```

depending on available width.

Do not use:

```text
POS updated 30 minutes ago        12 SKUs affected
```

on the same baseline when the columns are too narrow.

---

# 26. Responsive Create Run Summary

## PAGE-CREATE-FRESH-004

At 1280px:

```text
4 columns
```

At 1024px:

```text
2 × 2
```

At 640px:

```text
1 column
```

No overlap at any breakpoint.

---

# 27. Forecast Insights Cards — User Request #5

## PAGE-INSIGHTS-CARDS-001

**Priority:** P0  
**File:** `src/features/analytics/insights-view.tsx`

Current four cards:

```text
Forecast · horizon total
Change vs previous run
80% prediction interval
Concentration of change
```

are too text-heavy because each card has:

- long context;
- long footnote;
- units;
- comparison;
- extra explanatory text.

### Redesign

Use the shared compact metric pattern.

---

# 28. Insights Card 1

```text
Total forecast

4.77M
units

↗ +1.6%
vs previous run
```

Optional sparkline.

---

# 29. Insights Card 2

```text
Change vs previous run

+176K
units

+3.8%
```

Do not add:

```text
versus the previous published run
```

inside the card if the section title already gives the context.

---

# 30. Insights Card 3

```text
80% forecast range

4.45M–5.09M

Range width 13.2%
```

Use compact secondary text.

---

# 31. Insights Card 4

```text
Change concentration

42.7%

from top 10 SKUs
```

Small link icon may appear in top-right if clickable.

---

# 32. Insights Card Action

Instead of:

```text
Open in Forecast explorer
```

inside the card, use:

```text
View in Forecast Explorer →
```

as a section-level action or entire-card interaction.

Avoid adding a separate CTA footer to every card.

---

# 33. Insights Chart Section

The card simplification should create more room for:

```text
Why forecast changed
```

and:

```text
Where to focus review
```

The page should visually prioritize analysis over KPI prose.

---

# 34. Data Quality — User Request #6

## PAGE-DQ-001

**Priority:** P0  
**File:** `src/features/demand-data/quality-view.tsx`

Two issues:

1. top cards are too text-heavy;
2. table rows are too loose;
3. `SKUs affected` alignment is incorrect.

---

# 35. Data Quality Cards

Replace:

```text
Blocking issues
1
Runs covering affected SKUs fail validation.
Show blocking
```

with:

```text
Blocking issues

1

1 issue needs attention
```

Optional comparison:

```text
+1 vs yesterday
```

only if data exists.

---

# 36. Data Quality Card 2

```text
Warnings

4

May affect forecast accuracy
```

Only one short support line.

---

# 37. Data Quality Card 3

```text
Coverage

94.3%

of SKUs without open issues
```

No paragraph.

---

# 38. Data Quality Card 4

```text
Sources with problems

2

of 5 sources
```

No long inline link.

---

# 39. Data Quality Source Cards

The source freshness cards should also use:

```text
Source
Status
Last success
```

Avoid long text wrapping.

Example:

```text
POS transactions
Connected
Last success
16 min ago
```

---

# 40. Data Quality Table Density

## PAGE-DQ-TABLE-001

Use compact rows.

Target:

```text
42–44px
```

Current comfortable rows should not dominate the screen.

---

# 41. Data Quality Table Alignment

## PAGE-DQ-TABLE-002

Column behavior:

```text
Severity       left
Issue          left
Source         left
SKUs affected  left   ← requested
Detected       left
Owner          left
Status         left
```

Even though `SKUs affected` is numeric, the user explicitly wants its visual axis aligned with the other row content.

If numeric readability is required, keep tabular numerals but align left.

---

# 42. Data Quality Issue Row Geometry

Do not use overly tall rows for short issues.

For:

```text
Missing demand for 12 SKUs
DQ-001
```

use a compact two-line identity structure.

Target:

```text
Issue title
Issue metadata
```

within 42–48px.

---

# 43. Planning / Workplan — User Request #7

## PAGE-PLANNING-CARDS-001

**Priority:** P0  
**File:** `src/features/planning/plan-view.tsx`

Current cards:

```text
Baseline forecast
Planned quantity
Lines needing a decision
Decided
```

are text-heavy.

Apply the same compact metric card pattern.

---

# 44. Planning Card 1

```text
Baseline forecast

815.7K
units

100 lines
```

Optional mini trend.

---

# 45. Planning Card 2

```text
Planned quantity

815.5K
units

0.0% vs forecast
```

---

# 46. Planning Card 3

```text
Lines needing a decision

64

51 pending · 13 flagged
```

---

# 47. Planning Card 4

```text
Decided

36

30 accepted · 6 adjusted
```

Do not place a long CTA inside the card.

---

# 48. Planning Toolbar

Remove:

```text
Comfortable
Compact
```

The table must inherit global Settings density.

Remaining layout:

```text
Search
Decision
Exceptions
Filters
                    Columns
```

---

# 49. Planning Table Alignment

Review:

```text
Forecast
Planned
Change
Exceptions
Decision
Note
```

Use consistent axis rules.

Recommended:

```text
Forecast    right
Planned     right
Change      right
Exceptions  left
Decision    left
Note        left
```

---

# 50. Scenarios — User Request #8

## PAGE-SCENARIO-001

**Priority:** P0  
**File:** `src/features/scenarios/scenario-builder.tsx`

Current Step 3:

```text
Simulate and review impact
```

is positioned on the right side.

### Required change

Move Step 3 below Step 2.

---

# 51. Scenario Builder New Layout

Desktop:

```text
Step 1
Baseline & name
        ↓
Step 2
Assumptions
        ↓
Step 3
Simulate & review impact
```

All three sections should share one primary content width.

---

# 52. Scenario Builder Width

Current arrangement effectively creates:

```text
left narrow
right narrow
```

Change to:

```text
single main content column
max-width: 960–1120px
```

with the step panels spanning the full available width.

---

# 53. Scenario Step 1

Use full-width content.

Suggested grid:

```text
Baseline forecast     1fr
Scenario name         1fr
```

Description field:

```text
full width
```

---

# 54. Scenario Step 2

Assumptions should be full width.

Each assumption row:

```text
Driver
Scope
Baseline
Change
Result
Reason
Action
```

Use horizontal alignment on desktop.

On mobile:

```text
Driver
Scope
Baseline
Change
Result
Reason
```

stacked.

---

# 55. Scenario Step 3

Move Impact Preview below Step 2.

Structure:

```text
3. Simulate and review impact

No simulation yet.
Run the simulation to see the impact.

[Run simulation]

After simulation:
Impact summary
Category impact
Demand delta
Range
```

Bottom actions:

```text
Run simulation
Save scenario
```

---

# 56. Scenario Sticky Action Bar

Use bottom action bar only if content height makes actions hard to find.

Rules:

```text
Back / secondary left
Primary action right
```

Avoid duplicating the same actions in the card header.

---

# 57. Exceptions — User Request #9

## PAGE-EXCEPTIONS-CARDS-001

**Priority:** P0  
**File:** `src/features/exceptions/exceptions-view.tsx`

Current cards:

```text
Open
Critical
Unassigned
Assigned to me
```

simplify using compact metric card.

---

# 58. Exceptions Card 1

```text
Open

87

Open · investigating · escalated
```

---

# 59. Exceptions Card 2

```text
Critical

30

25%+ change or blocking issue
```

Shorten if needed:

```text
30 critical items
```

---

# 60. Exceptions Card 3

```text
Unassigned

42

No owner yet
```

---

# 61. Exceptions Card 4

```text
Assigned to me

1

Needs my attention
```

Use current user's context.

---

# 62. Exceptions Toolbar

Remove:

```text
Comfortable
Compact
```

Toolbar becomes:

```text
Search
Status
Severity
Filters
                   Views
                   Columns
```

---

# 63. Columns Dropdown Checked State — User Requests #9, #10, #12, #13

This is a **shared component bug**.

Affected pages:

```text
Exceptions
Approvals
Audit Log
Users & Roles
```

Potentially every page that uses `DropdownMenuCheckboxItem`.

---

# 64. Root Cause — Columns Checkbox

Current shared implementation in:

```text
src/components/ui/overlay.tsx
```

uses a child span with:

```text
data-[state=checked]
```

while the checked state is actually placed on the parent Radix CheckboxItem.

This means the visual fill selector is attached to the wrong element.

---

# 65. Checkbox Fix

## COLUMNS-CHECK-001

**Priority:** P0

Create a proper checked-state style:

```text
parent state = checked
↓
indicator container receives primary background
↓
check icon becomes primary foreground
```

Recommended pattern:

```text
CheckboxItem
  class="group ..."
  ↓
  indicator
    group-data-[state=checked]:bg-primary
    group-data-[state=checked]:border-primary
```

Do not rely on:

```text
data-[state=checked]
```

on a descendant that never receives the state attribute.

---

# 66. Column Checked Visual

Unchecked:

```text
□ Column name
```

Checked:

```text
[✓] Column name
```

where the square is visibly:

```text
primary fill
primary border
white/light check
```

The checked state must be obvious even without the check icon.

---

# 67. Column Menu Selected State

When a column is visible:

```text
primary-filled checkbox
```

When a column is hidden:

```text
white checkbox
```

When disabled:

```text
muted checkbox
```

---

# 68. Column Menu QA

Test:

```text
click checked → unchecked
click unchecked → checked
uncheck all allowed
recheck all
close menu
reopen menu
```

State must persist visually.

---

# 69. Columns Menu Keyboard QA

Test:

```text
Tab
Arrow Down
Arrow Up
Space
Enter
Escape
```

Checked state must update visually and accessibly.

---

# 70. Approvals — User Request #10

## PAGE-APPROVALS-COLUMNS-001

**Priority:** P0

Do not patch approvals separately.

It should automatically inherit the shared checkbox fix.

### Acceptance

- Checked columns use primary-filled checkbox.
- Hidden columns use empty checkbox.
- State persists after menu closes.
- No white-on-white ambiguity.

---

# 71. Audit Log — User Request #12

## PAGE-AUDIT-COLUMNS-001

Apply shared checkbox fix.

Additionally:

Remove:

```text
Comfortable
Compact
```

from Audit Log toolbar.

Use global setting.

---

# 72. Users & Roles — User Request #13

## PAGE-USERS-COLUMNS-001

Apply shared checkbox fix.

Do not add a custom checkbox implementation.

Use the shared:

```text
DropdownMenuCheckboxItem
```

---

# 73. Monitoring — User Request #11

## PAGE-MONITORING-BADGES-001

**Priority:** P0  
**File:** `src/features/monitoring/monitoring-view.tsx`

Current parent rows use:

```text
items-start
```

while status badges are designed to center-align vertically.

### Fix

For rows containing badge + content:

```text
items-center
```

not:

```text
items-start
```

---

# 74. Monitoring Alert Row

Current structure:

```text
Badge
Content
Timestamp
```

Target:

```text
[Critical]   Promotions calendar sync failing          2 hours ago
             3 consecutive failures
```

All vertical anchors should be centered against the row's primary content block.

---

# 75. Monitoring Service Row

Use:

```text
Service name
Description
Status badge
```

Status badge should align to the vertical center of the service row.

Do not pin status at the top.

---

# 76. Monitoring Badge Rule

All pill/status badges across Mesta:

```text
display: inline-flex
align-items: center
```

Parent grid/flex:

```text
align-items: center
```

unless a specific multi-line layout explicitly requires top alignment.

---

# 77. StatusBadge Shared QA

Review:

```text
StatusBadge
SeverityBadge
Tag
FreshnessIndicator
```

for:

- line-height;
- icon baseline;
- vertical centering;
- padding;
- height;
- border radius.

---

# 78. Audit Log — User Request #12

## PAGE-AUDIT-001

Simplify title copy if required.

English:

```text
Audit Log
```

description:

```text
See who changed what, when, and why.
```

Indonesian:

```text
Riwayat Aktivitas
```

description:

```text
Lihat siapa yang mengubah apa, kapan, dan alasannya.
```

Keep the page operational, not legalistic.

---

# 79. Decision Lineage — User Request #14

## PAGE-LINEAGE-001

**Priority:** P0  
**File:** `src/features/governance/lineage-view.tsx`

### Current issue

The current UI is visually clean but too generic.

It currently reads as a generic:

```text
Data
↓
Quality
↓
Model
↓
Forecast Run
↓
Forecast
↓
Scenario
↓
Plan
↓
Approval
↓
Published Plan
↓
Audit
```

This can describe many decision systems.

It does not immediately communicate:

```text
demand forecasting
```

---

# 80. Decision Lineage New Product Meaning

Rename concept to:

### English

```text
Forecast lineage
```

or:

```text
Forecast decision lineage
```

### Indonesian

```text
Jejak Perkiraan
```

or:

```text
Jejak Keputusan Perkiraan
```

Recommended primary page title:

```text
Forecast lineage
```

because it is more domain-specific than generic "Decision lineage."

---

# 81. Forecast Lineage Context Header

At top:

```text
Forecast lineage

Product:
Strawberry Yoghurt 250 ml

Forecast run:
FR-20260926-01

Horizon:
28 days

Generated:
26 Sep 2026, 06:01
```

This immediately anchors the page to demand forecasting.

---

# 82. Forecast Lineage Structure

Use:

```text
Demand data
↓
Data readiness
↓
Forecast model
↓
Forecast run
↓
Forecast baseline
↓
Scenario
↓
Planning decision
↓
Approval
↓
Published plan
↓
Activity
```

---

# 83. Node 1 — Demand Data

Display:

```text
Demand data
POS transactions + ERP sales orders

Last updated
26 Sep 2026, 06:01

Scope
2,480 SKUs · 4 regions
```

Status:

```text
Ready
Needs attention
Unavailable
```

---

# 84. Node 2 — Data Readiness

Display:

```text
Data readiness

Coverage
94.3%

Issues
6 open
1 blocking
```

CTA:

```text
View data quality
```

This makes the lineage specifically relevant to forecasting quality.

---

# 85. Node 3 — Forecast Model

Display:

```text
Forecast model

Gradient-boosted demand
v2.4

WAPE
21.4%

Last evaluated
26 Sep 2026
```

CTA:

```text
View model
```

---

# 86. Node 4 — Forecast Run

Display:

```text
Forecast run

FR-20260926-01
Daily refresh

28-day horizon
2,480 SKUs
```

Status:

```text
Published
Completed
Failed
```

---

# 87. Node 5 — Forecast Baseline

This is the key node that makes the product feel like demand forecasting.

Display:

```text
Forecast baseline

4.77M units
+1.6% vs previous run

80% range
4.45M–5.09M
```

Emphasize this node visually more than generic nodes.

---

# 88. Node 6 — Scenario

If present:

```text
Scenario

Year-end holiday uplift

+8% category demand

Status
Pending review
```

If absent:

```text
No scenario applied
```

Do not fake a scenario.

---

# 89. Node 7 — Planning Decision

Display:

```text
Planning decision

815.5K planned units

64 lines need a decision

36 lines decided
```

Link:

```text
View plan
```

---

# 90. Node 8 — Approval

Display:

```text
Approval

Pending

Requested by
Rina Wijaya

12 changes
```

or:

```text
Approved
```

---

# 91. Node 9 — Published Plan

Display:

```text
Published plan

Next 4 weeks

Published
26 Sep 2026 · 06:20
```

---

# 92. Node 10 — Activity

Display:

```text
Latest activity

Dimas Santos adjusted 12 planning lines
26 Sep 2026 · 06:24
```

---

# 93. Forecast Lineage Visual Hierarchy

Use one highlighted "forecast" center node.

Suggested:

```text
[Demand data]
      ↓
[Data readiness]
      ↓
[Forecast model]
      ↓
[Forecast run]
      ↓
╔═══════════════════════╗
║  Forecast baseline    ║
║  4.77M units          ║
║  +1.6%                ║
╚═══════════════════════╝
      ↓
[Scenario]
      ↓
[Planning decision]
      ↓
[Approval]
      ↓
[Published plan]
      ↓
[Activity]
```

The central forecast node should use the primary accent border/background tint.

---

# 94. Forecast Lineage Desktop Layout

Recommended:

```text
Content width: 960–1120px
```

Each node:

```text
stage
primary value
secondary metadata
status
action
```

Use 3-column internal structure:

```text
Stage | Forecast-specific value | State/action
```

---

# 95. Forecast Lineage Mobile

Stack:

```text
stage
value
status
action
```

One node per card.

Connect nodes with vertical line.

---

# 96. Forecast Lineage Copy

English:

```text
How this forecast was produced
```

not:

```text
How today's planning decision was produced...
```

Indonesian:

```text
Bagaimana perkiraan ini dibuat
```

This is much more direct.

---

# 97. Localization — User Request #15

## I18N-001

**Priority:** P0  
**Files:**

```text
src/lib/i18n/core.ts
src/lib/i18n/en.ts
src/lib/i18n/id.ts
src/lib/i18n/index.tsx
```

The repository already has live locale support, so the frontend should use it consistently.

---

# 98. No Mixed Language Rule

When locale = `en`:

```text
ALL visible UI = English
```

When locale = `id`:

```text
ALL user-facing UI = Indonesian
```

Allowed exceptions:

- SKU;
- model names;
- product names;
- official integration names;
- code-like identifiers;
- established acronyms.

---

# 99. Current Mixed-Language Problem Pattern

Known examples include source strings such as:

```text
Kerapatan tabel bawaan
Nyaman
Padat

Diterbitkan
Perlu Ditinjau
Cakupan
Baris
```

appearing in files while the active locale may be English.

Other pages mix:

```text
English title
Indonesian CTA
English technical copy
Indonesian status
```

This must be eliminated.

---

# 100. Localization Architecture Rule

Prefer:

```ts
pick(
  "Indonesian",
  "English"
)
```

or:

```ts
t("key")
```

for all user-facing strings.

Do NOT write:

```tsx
<span>Nyaman</span>
```

inside a page unless the component is explicitly locale-aware.

---

# 101. Settings Locale QA

The top-bar language control should remain the primary locale switch:

```text
EN
ID
```

### English tooltip

```text
Switch to Bahasa Indonesia
```

### Indonesian tooltip

```text
Ganti ke English
```

No mixed labels around it.

---

# 102. Global UX Writing Audit

Search all frontend source for hardcoded user-facing words.

Audit:

```text
src/app
src/components
src/features
src/lib
```

Search categories:

```text
title=
description=
label=
placeholder=
aria-label=
tooltip=
button text
empty state text
error text
status text
notification text
```

---

# 103. Language QA Banned-String Strategy

When locale = `en`, run a frontend test that checks affected pages for known Indonesian strings such as:

```text
Perlu Ditinjau
Kerapatan
Nyaman
Padat
Dibuat
Diperbarui
Masalah
Sumber
Pengguna
Pengaturan
Proses Perkiraan
Perkiraan
```

Do not treat product/user data as translatable UI text.

The test should ignore:

```text
product names
person names
SKU
workspace names
mock entity data
```

---

# 104. Locale Snapshot QA

For each affected page:

```text
open en
capture
open id
capture
```

Compare:

```text
layout
text wrapping
button width
table header width
badge width
card height
```

Localized text should not break the layout.

---

# 105. English Copy Standard

English should be:

```text
short
plain
operational
clear
```

Avoid:

```text
Forecasts that require additional investigation should be reviewed...
```

Prefer:

```text
Review unusual changes.
```

---

# 106. Indonesian Copy Standard

Indonesian should be:

```text
natural
short
easy to scan
```

Prefer:

```text
Tinjau perubahan
```

instead of:

```text
Lakukan peninjauan terhadap perubahan yang terdeteksi
```

---

# 107. User Request #15 — Page-by-Page Copy Cross Check

Review all visible strings on:

```text
Overview
Forecast Runs
Create Forecast
Forecast Explorer
Forecast Insights
Data Quality
Planning
Scenarios
Exceptions
Approvals
Monitoring
Audit Log
Users & Roles
Decision Lineage
Settings
Integrations
Model Registry
Model Performance
Backtesting
Notifications
```

No mixed locale.

---

# 108. Specific Page Copy Audit: Overview

English:

```text
Overview
Forecast health
Forecasted demand
Forecast accuracy
Forecast bias
Open exceptions
Demand outlook
Outlook by category
```

Indonesian:

```text
Ringkasan
Kondisi Perkiraan
Total Permintaan
Akurasi Perkiraan
Bias Perkiraan
Perlu Ditinjau
Tren Permintaan
Perkiraan per Kategori
```

---

# 109. Specific Page Copy Audit: Forecast Runs

English:

```text
Forecast runs
Create forecast
Scope
Model
Horizon
Created
Duration
Data freshness
Created by
```

Indonesian:

```text
Proses Perkiraan
Buat Perkiraan
Cakupan
Model
Periode
Dibuat
Durasi
Terakhir Diperbarui
Dibuat oleh
```

---

# 110. Specific Page Copy Audit: Forecast Explorer

English:

```text
Forecast Explorer
Search product, SKU or brand
Previous forecast
Actual (prior period)
Change
Trend
80% interval
Exceptions
```

Indonesian:

```text
Perkiraan Permintaan
Cari produk, SKU, atau merek
Perkiraan sebelumnya
Aktual (periode sebelumnya)
Perubahan
Tren
Rentang 80%
Perlu Ditinjau
```

---

# 111. Specific Page Copy Audit: Data Quality

English:

```text
Data quality
Blocking issues
Warnings
Coverage
Sources with problems
Source freshness
```

Indonesian:

```text
Kualitas Data
Masalah yang Menghambat
Peringatan
Cakupan
Sumber Bermasalah
Terakhir Diperbarui
```

---

# 112. Specific Page Copy Audit: Planning

English:

```text
Planning
Baseline forecast
Planned quantity
Lines needing a decision
Decided
```

Indonesian:

```text
Perencanaan
Perkiraan Acuan
Jumlah Direncanakan
Baris yang Perlu Diputuskan
Sudah Diputuskan
```

---

# 113. Specific Page Copy Audit: Scenarios

English:

```text
Create scenario
Baseline and name
Assumptions
Simulate and review impact
Run simulation
Save scenario
```

Indonesian:

```text
Buat Skenario
Acuan dan Nama
Asumsi
Simulasikan dan Tinjau Dampak
Jalankan Simulasi
Simpan Skenario
```

---

# 114. Specific Page Copy Audit: Exceptions

English:

```text
Exceptions
Open
Critical
Unassigned
Assigned to me
```

Indonesian:

```text
Perlu Ditinjau
Terbuka
Kritis
Belum Ditugaskan
Ditugaskan ke Saya
```

---

# 115. Specific Page Copy Audit: Monitoring

English:

```text
Monitoring
Alerts
System health
Operational
Warning
Critical
```

Indonesian:

```text
Pemantauan
Peringatan
Kondisi Sistem
Berjalan Normal
Peringatan
Kritis
```

---

# 116. Specific Page Copy Audit: Audit

English:

```text
Audit Log
When
Who
What happened
Object
Change
Why
Source
```

Indonesian:

```text
Riwayat Aktivitas
Kapan
Siapa
Apa yang Terjadi
Objek
Perubahan
Alasan
Sumber
```

---

# 117. Specific Page Copy Audit: Users

English:

```text
Users & roles
Members
Roles & permissions
Search name, email or title
```

Indonesian:

```text
Pengguna & Peran
Anggota
Peran & Hak Akses
Cari nama, email, atau jabatan
```

---

# 118. Specific Page Copy Audit: Decision Lineage

English:

```text
Forecast lineage
Demand data
Data readiness
Forecast model
Forecast run
Forecast baseline
Scenario
Planning decision
Approval
Published plan
Activity
```

Indonesian:

```text
Jejak Perkiraan
Data Permintaan
Kesiapan Data
Model Perkiraan
Proses Perkiraan
Acuan Perkiraan
Skenario
Keputusan Perencanaan
Persetujuan
Rencana Terbit
Aktivitas
```

---

# 119. Settings UX — Density

## SETTINGS-DENSITY-001

Current settings copy implies:

```text
Each table can still be changed individually.
```

This must be removed.

### English

```text
Table density
Choose the default density used across Mesta.

Comfortable
More spacing between rows

Compact
More rows visible at once
```

### Indonesian

```text
Kerapatan tabel
Pilih kerapatan yang digunakan di seluruh Mesta.

Nyaman
Jarak antarbaris lebih longgar

Padat
Lebih banyak baris terlihat
```

---

# 120. Settings UX — Locale

If language selector is available in Settings, keep:

```text
Language

English
Bahasa Indonesia
```

If language is only in TopBar, do not duplicate it unless there is a real need.

---

# 121. Settings UX — Appearance

Keep:

```text
Theme
Table density
Sidebar
```

Do not put page-specific table behavior here.

---

# 122. DataTable API Refactor

## TABLE-API-001

Current:

```text
density?: Density
hideDensityToggle?: boolean
localDensity state
```

Refactor toward:

```ts
density?: Density
```

as a deliberate internal variant only.

Remove:

```text
hideDensityToggle
localDensity
```

from normal user flow.

If `density` is omitted:

```text
use global preference
```

---

# 123. DataTable Toolbar API

Toolbar should expose:

```text
toolbarStart
toolbarEnd
```

and automatically layout:

```text
start = left
end = right
```

Density is not a toolbar concern.

---

# 124. DataTable Alignment API

Extend metadata:

```ts
type ColumnMeta = {
  width?: string;
  numeric?: boolean;
  align?: "left" | "center" | "right";
  sortKey?: string;
  hideBelow?: Breakpoint;
  pinned?: boolean;
  label?: string;
  description?: string;
}
```

---

# 125. DataTable Alignment Resolution

Pseudo behavior:

```ts
const align =
  meta.align ??
  (meta.numeric ? "right" : "left");
```

Header and body must use the same alignment.

---

# 126. DataTable Cell Classes

Do not separately infer header alignment and cell alignment.

Use one helper:

```ts
getColumnAlignment(meta)
```

Both header and cell call it.

This prevents:

```text
header = left
body = right
```

regressions.

---

# 127. Shared Alignment Helper

Implement:

```ts
function getColumnAlignment(meta?: ColumnMeta) {
  if (meta?.align) return meta.align;
  if (meta?.numeric) return "right";
  return "left";
}
```

Map:

```text
left   → justify-start text-left
center → justify-center text-center
right  → justify-end text-right
```

---

# 128. Forecast Runs Column Definitions

Suggested:

```ts
run       left
status    left
scope     left
model     left
horizon   left
created   left
duration  right or left by preference
freshness left
createdBy left
actions   center
```

---

# 129. Forecast Explorer Column Definitions

Suggested:

```text
product          left
forecast         right
previous         right
actual           left
change           right
trend            left/center
interval         right
status           left
exceptions       left
```

---

# 130. Data Quality Column Definitions

```text
severity         left
issue            left
source           left
skus             left
detected         left
owner            left
status           left
```

---

# 131. Planning Column Definitions

```text
product          left
forecast         right
planned          right
change           right
exceptions       left
decision         left
note             left
actions          center
```

---

# 132. Exceptions Column Definitions

```text
exception        left
severity         left
product          left
value            right
detected         left
owner            left
status           left
```

---

# 133. Approval Column Definitions

Review current table and explicitly define alignment for:

```text
request
type
requester
impact
status
created
```

Do not allow implicit alignment.

---

# 134. Audit Column Definitions

```text
when             left
who              left
what happened    left
object           left
change           left
why              left
source           left
```

---

# 135. Users & Roles Column Definitions

```text
user              left
title             left
role              left
status            left
last active       left
workspace         left
```

---

# 136. Column Width Contract

Avoid:

```text
auto everything
```

Use stable widths for:

```text
status
date
count
action
```

Use flexible tracks for:

```text
product
issue
description
scope
```

---

# 137. No Alignment Hacks

Do not use:

```css
margin-left
margin-right
left
transform
translateX
relative positioning
```

to fix table column alignment.

All alignment problems must be solved by:

```text
shared column definition
shared grid template
shared alignment helper
```

---

# 138. Data Row Action Alignment

Action column:

```text
width: 48–56px
display: flex
justify-content: center
align-items: center
```

Actions must not visually drift.

---

# 139. Column Visibility Dropdown Layout

Dropdown:

```text
width: 220–280px
```

Rows:

```text
height: 32–36px
```

Checkbox:

```text
16 × 16
```

Label:

```text
single line
truncate when necessary
```

---

# 140. Column Visibility Checked State

Visual hierarchy:

```text
checked:
primary fill + white check

unchecked:
white fill + border

disabled:
muted fill + muted border
```

Do not use only a check icon without filled background.

---

# 141. Columns Dropdown Hover

Selected row:

```text
checked checkbox = primary
row hover = subtle background
```

Do not override primary checkbox with hover white.

---

# 142. Columns Dropdown Keyboard

Checked item should remain visible as checked while focused.

Focus ring must be distinct from checked state.

---

# 143. Scenario Builder Detailed Responsive

At ≥1280:

```text
Step 1 full width
Step 2 full width
Step 3 full width
```

At 768–1279:

same order, narrower content.

At ≤767:

single column.

---

# 144. Scenario Builder Footer

Do not put:

```text
Run simulation
Save scenario
```

inside a cramped side panel.

Use a shared action footer:

```text
[secondary]                  [primary]
```

---

# 145. Forecast Insights Layout After Card Simplification

New vertical narrative:

```text
Page header
↓
Four compact metrics
↓
Why forecast changed
    ├── change by category
    └── change by lifecycle
↓
Where to focus review
↓
Largest movers
↓
Model accuracy by segment
```

This makes the page feel analytical rather than KPI-heavy.

---

# 146. Data Quality Layout After Card Simplification

```text
Page header
↓
Four compact metrics
↓
Source freshness
↓
Issue table
```

The issue table should start earlier on the screen.

---

# 147. Planning Layout After Card Simplification

```text
Page header
↓
Four compact metrics
↓
Plan table
```

This gives more vertical space to decision rows.

---

# 148. Exceptions Layout After Card Simplification

```text
Page header
↓
Four compact metrics
↓
Exception table
```

The exception table becomes the dominant operational surface.

---

# 149. Overview Layout After Card Simplification

```text
Page header
↓
Attention surface
↓
Forecast health compact metrics
↓
Trend chart
↓
Category chart
↓
Exceptions
↓
Recent runs
```

This preserves hierarchy.

---

# 150. Empty State Simplification

Cards and sections should not repeat the same explanatory language.

Prefer:

```text
No open exceptions
```

and one short line:

```text
Everything is within the current review thresholds.
```

not a paragraph.

---

# 151. Tooltip Strategy

Move detailed explanations from card body into tooltip.

Good:

```text
WAPE
```

Hover:

```text
Weighted absolute percentage error.
Lower is better.
```

The main card remains clean.

---

# 152. Tooltip Rule

Never use tooltip for information required to understand the card.

Use it for:

```text
definition
calculation
technical context
```

not:

```text
primary meaning
```

---

# 153. Forecast Health Specific Tooltip

Example:

```text
Forecast accuracy (WAPE)

Measures the weighted average difference between forecast and actual demand.
Lower is better.
```

Card should show only:

```text
Forecast accuracy
21.6%
WAPE
```

---

# 154. Forecast Range Tooltip

Card:

```text
80% forecast range
4.45M–5.09M
```

Tooltip:

```text
The forecast is expected to fall inside this range with the model's 80% interval.
```

---

# 155. Metric Card Clickability

If a card links to a page:

```text
whole card = interactive
```

not:

```text
card + tiny link
```

Hover:

```text
border → border-strong
```

Optional:

```text
arrow appears
```

---

# 156. Metric Card Accessibility

Each card should expose:

```text
label
value
comparison
destination if clickable
```

Example:

```text
Forecast accuracy, 21.6 percent WAPE, down 1.4 points versus previous evaluation, opens model performance.
```

---

# 157. Global Vertical Alignment Audit

Audit these parent patterns:

```text
items-start
items-center
items-end
```

especially where badges or icon-based status components appear.

Search:

```text
grep -R "items-start" src/features
```

Manually review every row that also contains:

```text
Badge
StatusBadge
SeverityBadge
Tag
FreshnessIndicator
```

---

# 158. Pill / Badge Alignment Contract

Default parent:

```css
align-items: center;
```

If a row contains multi-line content:

```text
Badge must center relative to the content block
```

Do not align badge to first line unless the badge is explicitly a label for the first line.

---

# 159. Monitoring Specific Alignment QA

Affected areas:

```text
Alerts
Platform services
Forecast pipeline
Recent jobs
Job status
```

All status pills should sit vertically centered.

---

# 160. Decision Lineage Navigation

Each node should be clickable if there is an existing route.

Example:

```text
Data
→ /demand-data/sources

Quality
→ /demand-data/quality

Model
→ /models/:id

Forecast run
→ /forecasting/runs/:id

Forecast
→ /forecasting/detail/:product

Scenario
→ /scenarios/:id

Plan
→ /planning

Approval
→ /planning/approvals

Published plan
→ /planning

Activity
→ /administration/audit
```

---

# 161. Decision Lineage Selected Context

If the page is opened from a product:

```text
product = Strawberry Yoghurt 250 ml
```

all lineage nodes should refer to that same context.

Do not show:

```text
all products
```

in one node and:

```text
single product
```

in another without explanation.

---

# 162. Decision Lineage Forecast Scope

Display:

```text
SKU
Category
Location
Forecast horizon
Forecast run
```

at the top when available.

---

# 163. Decision Lineage Visual Status

Keep semantic status:

```text
Ready
Needs attention
Blocking issue
Pending
Not started
```

Use:

```text
icon + label + color
```

not color-only.

---

# 164. Decision Lineage Avoid Generic Language

Avoid:

```text
How today's planning decision was produced
```

Prefer:

```text
How this forecast moved from source data to planning decision.
```

This makes the domain explicit.

---

# 165. Decision Lineage Detail

Each node can expand to show:

```text
What happened
Scope
Time
Current value
Previous value
Status
```

Do not expose every backend metadata field.

---

# 166. Localization of Decision Lineage

English:

```text
Demand data
Data readiness
Forecast model
Forecast run
Forecast baseline
Scenario
Planning decision
Approval
Published plan
Activity
```

Indonesian:

```text
Data Permintaan
Kesiapan Data
Model Perkiraan
Proses Perkiraan
Acuan Perkiraan
Skenario
Keputusan Perencanaan
Persetujuan
Rencana Terbit
Aktivitas
```

---

# 167. Page Copy Source of Truth

Do not define copy separately in:

```text
page
component
tooltip
mock
```

when the same label repeats.

Prefer:

```text
i18n key
↓
dictionary
↓
page/component
```

---

# 168. Translation Completeness

Both dictionaries:

```text
en.ts
id.ts
```

must have identical key structures.

Test:

```text
Object.keys(en)
=== Object.keys(id)
```

for all translation trees.

---

# 169. Mixed-Language Regression Test

Create an E2E test:

```text
set locale = en
visit each affected route
collect visible text
assert no known Indonesian UI tokens
```

Then:

```text
set locale = id
visit each affected route
assert English-only UI tokens are not left behind
```

Allow exceptions for:

```text
SKU
API
WAPE
ERP
POS
official names
```

---

# 170. Visual Regression Set — Affected Pages

Capture:

```text
Overview
Forecast Runs
Create Forecast
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
```

At:

```text
1440 × 900
1280 × 800
1024 × 768
768 × 1024
390 × 844
```

---

# 171. Screenshot Comparison Protocol

For each screenshot compare:

```text
Page title
Card height
Card density
Toolbar height
Column alignment
Badge position
Dropdown state
Spacing
Wrapping
Language
Mobile behavior
```

---

# 172. Acceptance Criteria — User Request #1

Pass when:

```text
[ ] Forecast health cards use compact metric anatomy
[ ] No long paragraph in cards
[ ] No repeated CTA in all four cards
[ ] Main value dominates
[ ] Optional sparkline is used only with real trend data
[ ] Equal card height
```

---

# 173. Acceptance Criteria — User Request #2

Pass when:

```text
[ ] Forecast Runs Horizon aligns left
[ ] Header/body use same grid track
[ ] Comfortable/Compact removed from toolbar
[ ] Settings owns density preference
[ ] Toolbar does not have dangling controls
```

---

# 174. Acceptance Criteria — User Request #3

Pass when:

```text
[ ] Data freshness is contained within one grid cell
[ ] POS updated text is on its own line
[ ] No overlap with Missing periods
[ ] 1024px still readable
[ ] 768px still readable
```

---

# 175. Acceptance Criteria — User Request #4

Pass when:

```text
[ ] Comfortable/Compact removed from Explorer
[ ] Actual (prior) left aligned
[ ] Exceptions left aligned
[ ] Columns remain in one toolbar row
[ ] Global density setting works
```

---

# 176. Acceptance Criteria — User Request #5

Pass when:

```text
[ ] Insights has four compact cards
[ ] No paragraph inside metric card
[ ] Chart section becomes visually dominant
[ ] Cards match shared Overview card anatomy
```

---

# 177. Acceptance Criteria — User Request #6

Pass when:

```text
[ ] Data Quality cards are compact
[ ] Table is compact
[ ] SKU affected aligns left
[ ] Source cards remain readable
[ ] No oversized vertical gaps
```

---

# 178. Acceptance Criteria — User Request #7

Pass when:

```text
[ ] Planning cards use compact metric anatomy
[ ] Comfortable/Compact removed
[ ] Toolbar controls align
[ ] Global density preference controls rows
```

---

# 179. Acceptance Criteria — User Request #8

Pass when:

```text
[ ] Scenario Step 3 is below Step 2
[ ] Steps 1–3 share main content width
[ ] No right-side floating panel on desktop
[ ] Action area remains easy to find
```

---

# 180. Acceptance Criteria — User Request #9

Pass when:

```text
[ ] Exception cards compact
[ ] Comfortable/Compact removed
[ ] Columns checkbox has primary fill when checked
[ ] Checked state survives close/reopen
[ ] All columns menu options behave consistently
```

---

# 181. Acceptance Criteria — User Request #10

Pass when:

```text
[ ] Approval column checkbox is filled when checked
[ ] No white checked state
[ ] Shared behavior matches Exceptions
```

---

# 182. Acceptance Criteria — User Request #11

Pass when:

```text
[ ] Monitoring badges vertically centered
[ ] Alert badges centered
[ ] Service badges centered
[ ] Job status badges centered
[ ] No `items-start` conflict remains
```

---

# 183. Acceptance Criteria — User Request #12

Pass when:

```text
[ ] Audit checkbox fill fixed
[ ] Comfortable/Compact removed
[ ] Toolbar aligns cleanly
```

---

# 184. Acceptance Criteria — User Request #13

Pass when:

```text
[ ] Users & Roles checkbox fill fixed
[ ] Visible columns state clear
[ ] Keyboard behavior correct
```

---

# 185. Acceptance Criteria — User Request #14

Pass when:

```text
[ ] Page is clearly demand-forecasting-specific
[ ] Forecast run is explicit
[ ] Forecast baseline is explicit
[ ] Demand data is explicit
[ ] Model performance is visible
[ ] Planning link is explicit
[ ] Approval/published plan is visible
[ ] Product/scope context is clear
```

---

# 186. Acceptance Criteria — User Request #15

Pass when:

```text
[ ] English locale = fully English UI
[ ] Indonesian locale = fully Indonesian UI
[ ] No hardcoded leftover language
[ ] TopBar switch changes all affected pages
[ ] Cards, tables, badges, tooltips and errors follow locale
```

---

# 187. Global Acceptance — Table System

```text
[ ] All DataTables use shared grid template
[ ] Header/body same tracks
[ ] Alignment metadata explicit
[ ] Numeric defaults right
[ ] User-requested contextual fields left
[ ] No per-page alignment hacks
[ ] No per-page density controls
```

---

# 188. Global Acceptance — Metric System

```text
[ ] One shared compact metric component
[ ] Four-card surfaces use same anatomy
[ ] Equal heights
[ ] Short copy
[ ] Optional sparkline
[ ] No dense footnotes
[ ] Click behavior consistent
```

---

# 189. Global Acceptance — Checkbox System

```text
[ ] Checked state = primary fill
[ ] Unchecked = white
[ ] Disabled = muted
[ ] Check icon high contrast
[ ] Hover doesn't erase selected state
[ ] Keyboard works
```

---

# 190. Global Acceptance — Badge System

```text
[ ] Vertical centering
[ ] Consistent height
[ ] Consistent icon size
[ ] Consistent line height
[ ] Parent alignment correct
```

---

# 191. Global Acceptance — Localization

```text
[ ] en dictionary complete
[ ] id dictionary complete
[ ] no mixed locale
[ ] no hardcoded duplicate labels
[ ] no layout regression from translation
```

---

# 192. Implementation Work Order

## Phase 1 — Shared Foundations

```text
1. MetricCard compact variant
2. DataTable density removal
3. Settings density preference
4. DataTable align metadata
5. Dropdown checkbox checked styling
6. Badge vertical alignment audit
7. i18n consistency audit
```

Do not start page-specific polish before these are complete.

---

# 193. Phase 2 — Affected Pages

Implement in this order:

```text
1. Overview
2. Forecast Runs
3. Create Forecast
4. Forecast Explorer
5. Forecast Insights
6. Data Quality
7. Planning
8. Scenarios
9. Exceptions
10. Approvals
11. Monitoring
12. Audit
13. Users & Roles
14. Decision Lineage
15. Settings
```

---

# 194. Phase 3 — Cross-Page QA

Run:

```text
Visual regression
Locale regression
Alignment regression
Density regression
Checkbox regression
Badge regression
Responsive regression
```

---

# 195. Phase 4 — Final Product Polish

Review:

```text
Spacing
Typography
Color
Copy
Card height
Table density
Toolbar hierarchy
Badge alignment
Lineage meaning
```

---

# 196. Git / Code Review Checklist

Before merge:

```text
[ ] No one-off metric card
[ ] No one-off checkbox
[ ] No one-off badge
[ ] No table-specific density toggle
[ ] No raw hex in page components
[ ] No hardcoded English in ID-only components
[ ] No hardcoded Indonesian in EN-only rendering
[ ] No margin hacks for alignment
[ ] No transform hacks for table alignment
[ ] No duplicated toolbar layout
```

---

# 197. Search Checklist For Implementer

Use repository-wide searches:

```bash
rg -n "Comfortable|Compact|Rows3|hideDensityToggle|localDensity" src
```

```bash
rg -n "items-start" src/features src/components
```

```bash
rg -n "DropdownMenuCheckboxItem" src
```

```bash
rg -n "MetricCard" src/features
```

```bash
rg -n "pick\\(|localized\\(|t\\(" src
```

```bash
rg -n "Kerapatan|Nyaman|Padat|Perlu Ditinjau|Dibuat|Diperbarui|Pengaturan|Pengguna|Sumber" src
```

The exact command output is part of implementation QA, not a replacement for visual review.

---

# 198. Shared Component Rule

When the same issue appears on:

```text
Overview
Insights
Data Quality
Planning
Exceptions
```

fix:

```text
MetricCard
```

not each page independently.

When the same issue appears on:

```text
Exceptions
Approvals
Audit
Users & Roles
```

fix:

```text
DropdownMenuCheckboxItem
```

not each page independently.

When the same issue appears in:

```text
Forecast Runs
Explorer
Data Quality
Planning
Audit
```

fix:

```text
DataTable
```

not each page independently.

---

# 199. Definition of Done — Compact Metric Card

```text
[ ] Shared component
[ ] Variant documented
[ ] Icon slot
[ ] Label slot
[ ] Main value
[ ] Unit
[ ] Delta
[ ] Optional trend
[ ] Optional tooltip
[ ] Optional navigation
[ ] Equal-height behavior
[ ] Responsive
[ ] Accessible
[ ] EN/ID copy compatible
```

---

# 200. Definition of Done — DataTable

```text
[ ] No density toggle
[ ] Reads global preference
[ ] Explicit alignment
[ ] Header/body aligned
[ ] Columns menu works
[ ] Checked state obvious
[ ] Toolbar clean
[ ] Responsive
[ ] Keyboard
```

---

# 201. Definition of Done — Decision Lineage

```text
[ ] Forecast-specific title
[ ] Product/scope context
[ ] Demand data node
[ ] Data readiness node
[ ] Model node
[ ] Forecast run node
[ ] Forecast baseline node
[ ] Scenario node
[ ] Planning node
[ ] Approval node
[ ] Published plan node
[ ] Activity node
[ ] Links
[ ] Status
[ ] Responsive
[ ] Locale
```

---

# 202. Definition of Done — Localization

```text
[ ] EN complete
[ ] ID complete
[ ] no mixed strings
[ ] no hardcoded visible copy
[ ] page screenshots checked in both locales
```

---

# 203. Final Page Quality Gate

Every page must pass:

## Hierarchy

```text
What is this page?
What matters?
What should I do?
```

## Visual

```text
White canvas
Thin borders
Small radius
Minimal shadow
Clear spacing
```

## Density

```text
No unnecessary controls
No oversized cards
No huge row spacing
```

## Language

```text
Single locale
Simple copy
Consistent terminology
```

## Interaction

```text
Clear active state
Clear checked state
Clear focus state
```

---

# 204. Final Product Experience

After this pass, the product should visually move from:

```text
Enterprise dashboard
with lots of information
```

to:

```text
Enterprise forecasting workspace
with a strong visual hierarchy
```

The intended rhythm is:

```text
Header
↓
Compact signal
↓
Primary analysis
↓
Dense operational table
↓
Action
```

not:

```text
Card
Card
Card
Card
paragraph
paragraph
button
table
```

---

# 205. Final Visual Formula

```text
White canvas
+
Thin border
+
Compact cards
+
Big metric
+
Small comparison
+
Minimal trend
+
Dense but aligned table
+
One clear toolbar
+
Consistent badges
+
Forecast-specific lineage
+
One locale at a time
=
Mesta Frontend v4
```

---

# 206. Final Master Principle

Do not solve these issues page-by-page.

Solve them as reusable frontend systems:

```text
Metric system
Table system
Toolbar system
Column alignment system
Density system
Badge system
Checkbox system
Localization system
Lineage system
```

The pages should then inherit the quality automatically.

---

# 207. Final Handoff Checklist

```text
[ ] Overview metric cards simplified
[ ] Forecast Runs horizon aligned
[ ] Forecast Runs density toggle removed
[ ] Create Forecast freshness stacked
[ ] Forecast Explorer density toggle removed
[ ] Forecast Explorer Actual aligned
[ ] Forecast Explorer Exceptions aligned
[ ] Forecast Insights cards simplified
[ ] Data Quality cards simplified
[ ] Data Quality rows tightened
[ ] Data Quality SKUs affected aligned
[ ] Planning cards simplified
[ ] Planning density toggle removed
[ ] Scenario Step 3 moved below Step 2
[ ] Scenario steps widened
[ ] Exception cards simplified
[ ] Exception density toggle removed
[ ] Exception columns checkbox fixed
[ ] Approval columns checkbox fixed
[ ] Monitoring badges centered
[ ] Audit columns checkbox fixed
[ ] Audit density toggle removed
[ ] Users columns checkbox fixed
[ ] Decision Lineage redesigned for demand forecasting
[ ] English locale contains no Indonesian UI leftovers
[ ] Indonesian locale remains complete
[ ] Global density preference works
[ ] All affected pages visually regression-tested
[ ] All affected pages keyboard-tested
[ ] All affected pages mobile-tested
```

---

# 208. End State

The final frontend should communicate:

```text
Forecast status
↓
Forecast quality
↓
What changed
↓
Where attention is needed
↓
What decision is available
↓
What happens next
```

without forcing the user to read every sentence or open every detail.

The UI should be:

```text
simple
dense
white
aligned
forecast-specific
localized
predictable
```

and should feel like one product rather than a collection of pages.