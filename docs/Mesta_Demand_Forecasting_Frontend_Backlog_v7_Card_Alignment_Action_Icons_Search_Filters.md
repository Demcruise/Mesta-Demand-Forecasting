# Mesta Demand Forecasting
## Frontend-Only Backlog v7
### KPI Card Alignment Correction + Action-Icon Simplification + Table Search/Filter Controls

**Version:** 7.0  
**Date:** 26 September 2026  
**Scope:** Frontend only  
**Repository:** `https://github.com/Demcruise/Mesta-Demand-Forecasting`  
**Branch:** `main`  
**Basis:** latest committed frontend + latest screenshots supplied in this conversation + previous Mesta frontend backlog

---

# 0. Objective

This backlog is the next correction pass after the previous card-alignment update.

The previous implementation centered the KPI value horizontally inside the cards. That interpretation was incorrect.

The intended design is:

```text
Card
┌──────────────────────────────────────────────┐
│ [icon] Headline                              │
│                                              │
│                                              │
│ 4.77M                                       │
│ units                                       │
│                                              │
│ ↗ +1.6% vs previous run                     │
└──────────────────────────────────────────────┘
```

The large KPI value must be:

```text
vertically centered within the card's value area
```

but:

```text
LEFT ALIGNED
```

to the same content axis as the headline and supporting copy.

Do NOT horizontally center the number.

---

# 1. Current Issues

## ISSUE-001 — KPI Value Horizontal Alignment

Current incorrect behavior:

```text
Headline        left
Main value      center
Support         left
```

Required behavior:

```text
Headline        left
Main value      left
Support         left
```

The value is vertically centered inside the available middle area.

---

## ISSUE-002 — Card Headline Wrapping

Some KPI headings wrap into two lines.

Examples:

```text
Change
concentration

Lines needing a
decision

Sources with
problems
```

Required:

```text
headline = ONE LINE
```

If it cannot fit:

```text
truncate with ellipsis
```

and provide:

- tooltip;
- accessible name;
- full value to assistive technology.

Never make the compact KPI header a two-line title.

---

## ISSUE-003 — Verbose Bookmark / Export Actions

Current dense table surfaces still expose text such as:

```text
Views
Export 2,480 rows
```

For conventional actions:

```text
saved views / bookmark
download
export
```

use icon-only visual buttons.

The action still needs:

```text
tooltip
aria-label
keyboard focus
```

---

## ISSUE-004 — Missing Search / Status Controls

Some table surfaces only expose:

```text
Columns
```

Required:

### Forecast Schedules

```text
Search
Columns
```

### Data Sources

```text
Search
Status
Columns
```

### Integrations

```text
Search
Status
Columns
```

Controls must share one toolbar row at normal desktop widths.

---

# 2. Shared MetricCard Contract

## CARD-001 — Source of Truth

Target:

```text
src/components/forecasting/metrics.tsx
```

The current shared component already contains:

```text
MetricCard
CompactMetricCard
DetailedMetricCard
```

Use the compact variant as the source of truth.

Do not create page-specific metric cards.

---

## CARD-002 — Correct Anatomy

```text
┌─────────────────────────────────────┐
│ [icon] Label                        │
│                                     │
│ 4.77M                               │
│ units                               │
│                                     │
│ ↗ +1.6% vs previous run             │
└─────────────────────────────────────┘
```

Alignment:

```text
Header        left
Main value    left
Support       left
Value zone    vertically centered
```

---

## CARD-003 — Correct CSS Behavior

The value zone should conceptually use:

```css
display: flex;
flex-direction: column;
justify-content: center;
align-items: flex-start;
text-align: left;
min-height: 64px–76px;
```

The critical difference is:

```text
justify-content: center
align-items: flex-start
```

Do not use:

```text
align-items: center
```

for the KPI value.

---

## CARD-004 — Header

Header remains:

```text
icon + label
```

with:

```css
display: flex;
align-items: center;
gap: 8px;
```

Icon is never horizontally centered.

---

## CARD-005 — Support Area

Support copy remains:

```text
left aligned
```

Examples:

```text
vs previous run
Backtest · last 91 days
Tends to over-forecast
30 critical · 57 warning
```

---

## CARD-006 — Fixed Vertical Zones

Recommended:

```text
Header:
40–48px

Value zone:
64–76px minimum

Support:
24px minimum
```

Use a flex column so different text lengths do not change the vertical position of the number.

---

## CARD-007 — Single-Line Headline

Implement:

```css
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
```

Do not use two-line clamp for compact KPI titles.

---

## CARD-008 — Headline Wrapper

Recommended:

```tsx
<div className="flex min-w-0 items-center gap-2">
  <Icon className="shrink-0" />
  <span className="min-w-0 truncate">{label}</span>
</div>
```

The label wrapper must be allowed to shrink.

---

## CARD-009 — Tooltip for Truncated Labels

If a title is truncated, show the complete text through the shared tooltip system.

Do not change card height to make the complete title visible.

---

## CARD-010 — Equal Height

Every sibling compact KPI card must have:

```text
same height
same header area
same value zone
same support area
```

Recommended:

```text
180–192px
```

unless the existing design token dictates otherwise.

---

# 3. Overview

## OVERVIEW-001 — Four Forecast Health Cards

Target:

```text
src/features/overview/overview-view.tsx
```

Cards:

```text
Forecasted demand
Forecast accuracy
Forecast bias
Open exceptions
```

All inherit the shared compact alignment contract.

---

## OVERVIEW-002 — Forecasted Demand

Target:

```text
Forecasted demand
4.77M
units

↗ +1.6% vs previous run
```

The value starts on the same left axis as the headline.

---

## OVERVIEW-003 — Remove First Sparkline

Remove only the first Overview card's trend props:

```tsx
trend={trend.values}
trendForecastFrom={trend.forecastFrom}
```

Do NOT remove the shared `Sparkline` component globally.

---

## OVERVIEW-004 — Forecast Accuracy

```text
Forecast accuracy

21.6% WAPE

Backtest · last 91 days
```

Main value left aligned.

---

## OVERVIEW-005 — Forecast Bias

```text
Forecast bias

+2.5%

Tends to over-forecast
```

Main value left aligned.

---

## OVERVIEW-006 — Open Exceptions

```text
Open exceptions

87

30 critical · 57 warning
```

Main value left aligned.

---

## OVERVIEW-007 — Four-Card Guide

Use a shared vertical guide:

```text
Headline
|
| 4.77M
|
| Support
```

All four cards must share the same x-axis for these elements.

---

# 4. Forecast Explorer

## EXPLORER-001 — Remove Trend Column

Target:

```text
src/features/forecast-explorer/explorer-view.tsx
```

Current:

```text
Forecast
Previous
Actual (prior)
Change
Trend
80% interval
Status
Exceptions
```

Required:

```text
Forecast
Previous
Actual (prior)
Change
80% interval
Status
Exceptions
```

Remove only the table column.

Do not delete trend data from the domain model.

---

## EXPLORER-002 — Rebalance Columns

After removing Trend:

```text
Forecast
Previous
Actual (prior)
Change
80% interval
Status
Exceptions
```

must reflow cleanly.

No blank grid track.

---

## EXPLORER-003 — Preserve Alignment

Keep:

```text
Forecast        right
Previous        right
Actual (prior)  left
Change          right
80% interval    right
Status          left
Exceptions      left
```

---

## EXPLORER-004 — Saved Views Icon Only

Current:

```text
Views
```

Change to:

```text
[bookmark icon]
```

No visible text.

Accessibility:

```text
aria-label="Saved views"
```

Tooltip:

```text
Saved views
```

Indonesian:

```text
Tampilan tersimpan
```

---

## EXPLORER-005 — Export Icon Only

Current:

```text
Export 2,480 rows
```

Change visual presentation to:

```text
[download icon]
```

Retain row count in:

```text
tooltip
aria-label
```

Example:

```text
aria-label="Export 2,480 rows"
```

Indonesian:

```text
Ekspor 2.480 baris
```

---

## EXPLORER-006 — Keep Columns Labeled

Do not convert:

```text
Columns
```

to icon-only.

Target:

```text
[columns icon] Columns
```

because it is a configuration action that benefits from a visible label.

---

## EXPLORER-007 — Toolbar Grouping

Left:

```text
Search
Category
Status
Filters
Sort
```

Right:

```text
Saved views icon
Columns
Export icon
```

At standard desktop width, this should occupy one row.

---

## EXPLORER-008 — Toolbar Responsive

At narrow widths:

```text
row 1:
search + filters

row 2:
sort + actions
```

Wrap intentionally.

Never create an isolated one-button second row.

---

# 5. Global Action Icon Rule

## ACTION-001

Use icon-only visual controls for:

```text
Saved views / bookmark
Download
Export
```

Keep visible labels for:

```text
Filters
Columns
Status
Category
Date
Sort
```

---

## ACTION-002 — Icon Button Contract

Every icon-only control requires:

```text
aria-label
tooltip
focus-visible state
keyboard activation
```

---

## ACTION-003 — Icon Size

Recommended:

```text
16–18px icon
32–36px control
```

Use the existing control height token.

---

## ACTION-004 — Icon Hover

Default:

```text
transparent / secondary
```

Hover:

```text
bg-hover
```

Focus:

```text
focus ring
```

Active:

```text
primary-subtle
```

Avoid excessive blue fills.

---

# 6. Forecast Insights

## INSIGHTS-001

Target:

```text
src/features/analytics/insights-view.tsx
```

Cards:

```text
Total forecast
Change vs previous run
80% forecast range
Change concentration
```

---

## INSIGHTS-002 — Card Alignment

All large values:

```text
left aligned
vertically centered
```

---

## INSIGHTS-003 — Headline One Line

Do not wrap:

```text
Change concentration
```

Use ellipsis + tooltip only when width requires it.

---

## INSIGHTS-004 — Total Forecast

```text
Total forecast

4.77M units

↗ +1.6% vs previous run
```

---

## INSIGHTS-005 — Change vs Previous

```text
Change vs previous run

+73.8K units

↗ +1.6%
```

---

## INSIGHTS-006 — Forecast Range

Preferred:

```text
80% forecast range

4.45M–5.09M

Range width 13.3%
```

Try to keep the numeric range on one line.

If needed, slightly reduce the metric font before allowing a two-line range.

---

## INSIGHTS-007 — Change Concentration

```text
Change concentration

9.3%

from top 10 SKUs
```

Do not vertically shift the value because the label is long.

---

# 7. Data Quality

## DQ-001

Target:

```text
src/features/demand-data/quality-view.tsx
```

Cards:

```text
Blocking issues
Warnings
Coverage
Sources with problems
```

---

## DQ-002 — Header One Line

Do not allow:

```text
Sources with
problems
```

Use:

```text
Sources with problems
```

or ellipsis.

---

## DQ-003 — Main Values

```text
Blocking issues
1

Warnings
4

Coverage
94.3%

Sources with problems
2
```

All values:

```text
left aligned
vertically centered
```

---

## DQ-004 — Supporting Text

Keep:

```text
1 issue needs attention
May affect forecast accuracy
of SKUs without open issues
of 5 sources
```

in the bottom support region.

---

# 8. Planning

## PLANNING-001

Target:

```text
src/features/planning/plan-view.tsx
```

Cards:

```text
Baseline forecast
Planned quantity
Lines needing a decision
Decided
```

---

## PLANNING-002 — Main Values

```text
Baseline forecast
816K units

Planned quantity
816K units

Lines needing a decision
65

Decided
35
```

All:

```text
left aligned
vertically centered
```

---

## PLANNING-003 — One-Line Headline

Do not wrap:

```text
Lines needing a decision
```

Use ellipsis if necessary.

Tooltip exposes full label.

---

# 9. Exceptions

## EXCEPTIONS-001

Target:

```text
src/features/exceptions/exceptions-view.tsx
```

Cards:

```text
Open
Critical
Unassigned
Assigned to me
```

---

## EXCEPTIONS-002 — Main Values

```text
Open
87

Critical
30

Unassigned
43

Assigned to me
0
```

Left aligned and vertically centered.

---

## EXCEPTIONS-003 — Support

Keep:

```text
Open · investigating · escalated
25%+ change or blocking issue
No owner yet
Needs my attention
```

Avoid turning the support copy into multi-line paragraphs.

---

# 10. Approvals

## APPROVALS-001

Target:

```text
src/features/approvals/approvals-view.tsx
```

Cards:

```text
Awaiting decision
Due within 24h
Overdue
```

---

## APPROVALS-002 — Correct Alignment

The previous horizontal-centering implementation is incorrect.

Required:

```text
Awaiting decision
4

Due within 24h
2

Overdue
0
```

The values:

```text
align left
```

while remaining:

```text
vertically centered inside the value area
```

---

## APPROVALS-003 — One-Line Headings

Keep:

```text
Awaiting decision
Due within 24h
Overdue
```

on one line.

---

## APPROVALS-004 — Supporting Copy

Keep:

```text
Open requests
Decide today
None overdue
```

at the bottom support region.

---

# 11. Forecast Run Detail

## RUNDETAIL-001

Target:

```text
src/features/forecast-runs/run-detail-view.tsx
```

Cards:

```text
Forecast · 28 days
Previous run
Actual · last 28 days
SKUs needing review
```

---

## RUNDETAIL-002 — Values

```text
Forecast · 28 days
121,009 units

Previous run
118,932 units

Actual · last 28 days
116,858 units

SKUs needing review
0
```

All values:

```text
left aligned
vertically centered
```

---

## RUNDETAIL-003 — Headings One Line

The labels must remain one line whenever practical.

If the viewport forces truncation:

```text
ellipsis
+
tooltip
```

Do not increase card height.

---

## RUNDETAIL-004 — Support Zone

Keep:

```text
80% interval
change
review hint
```

inside a fixed support region.

A link such as:

```text
Review in explorer →
```

must not shift the main value vertically.

---

# 12. Global Card Headline Rules

## CARD-HEAD-001

Affected titles include:

```text
Forecasted demand
Forecast accuracy
Forecast bias
Open exceptions
Total forecast
Change vs previous run
80% forecast range
Change concentration
Blocking issues
Warnings
Coverage
Sources with problems
Baseline forecast
Planned quantity
Lines needing a decision
Decided
Open
Critical
Unassigned
Assigned to me
Awaiting decision
Due within 24h
Overdue
Forecast · 28 days
Previous run
Actual · last 28 days
SKUs needing review
```

All should occupy one visual line in the compact KPI pattern.

---

## CARD-HEAD-002 — Long Labels

For long labels:

```text
Do not wrap
Do not increase card height
Do not shrink text excessively
```

Use:

```text
ellipsis
+
tooltip
```

---

# 13. Forecast Schedules — Add Search

## SCHEDULE-001

Locate the current Forecast Schedules frontend route/file in the repository and use the existing shared DataTable + FilterBar architecture.

Current table toolbar exposes:

```text
Columns
```

Add:

```text
Search
```

---

## SCHEDULE-002 — Toolbar Layout

Target:

```text
┌──────────────────────────────────────────────┐
│ Search                         Columns       │
└──────────────────────────────────────────────┘
```

Search left.

Columns right.

---

## SCHEDULE-003 — Placeholder

English:

```text
Search schedules
```

Indonesian:

```text
Cari jadwal
```

---

## SCHEDULE-004 — Search Scope

Search visible schedule concepts such as:

```text
schedule name
category
scope
cadence
publication status
```

Do not expose technical fields users cannot see.

---

# 14. Data Sources — Add Search + Status

## SOURCES-001

Target:

```text
src/features/demand-data/sources-view.tsx
```

Add:

```text
Search
Status
```

alongside:

```text
Columns
```

---

## SOURCES-002 — Toolbar

Target:

```text
┌────────────────────────────────────────────────────┐
│ Search  Status                         Columns     │
└────────────────────────────────────────────────────┘
```

---

## SOURCES-003 — Search Placeholder

English:

```text
Search data sources
```

Indonesian:

```text
Cari sumber data
```

---

## SOURCES-004 — Search Scope

Search:

```text
source name
type
owner
```

---

## SOURCES-005 — Status Options

Use existing domain statuses:

```text
Connected
Warning
Failed
Disconnected
```

Indonesian:

```text
Terhubung
Peringatan
Gagal
Terputus
```

Never compare localized display strings in logic.

---

## SOURCES-006 — Search + Status Combined

Users must be able to:

```text
search ERP
+
filter status = Warning
```

and receive only rows matching both.

---

# 15. Integrations — Add Search + Status

## INTEGRATIONS-001

The repository already shares the Data Sources/Integrations surface through the shared source view.

Use that shared architecture.

Do not build a second implementation.

---

## INTEGRATIONS-002 — Toolbar

Target:

```text
┌────────────────────────────────────────────────────┐
│ Search  Status                         Columns     │
└────────────────────────────────────────────────────┘
```

---

## INTEGRATIONS-003 — Search Placeholder

English:

```text
Search integrations
```

Indonesian:

```text
Cari integrasi
```

---

## INTEGRATIONS-004 — Status Filter

Use:

```text
Connected
Warning
Failed
Disconnected
```

with the same shared filter component as Data Sources.

---

# 16. Shared FilterBar

## FILTER-001

Target:

```text
src/components/tables/filter-bar.tsx
```

The current FilterBar already supports:

```text
search
facets
sort
searchWidth
```

Use the existing API rather than creating page-specific filters.

---

## FILTER-002 — Search Width

Use:

```text
sm
md
lg
```

where:

```text
sm = compact
md = normal dense enterprise
lg = wide search
```

For the new pages:

```text
Forecast Schedules → md
Data Sources       → md
Integrations       → md
```

---

## FILTER-003 — Search Input

Keep:

```text
search icon
placeholder
clear action if active
```

Do not turn Search into an icon-only control.

---

# 17. Shared DataTable Toolbar

## TABLE-TOOLBAR-001

Target:

```text
src/components/tables/data-table.tsx
```

Continue using:

```text
toolbarStart
toolbarEnd
```

---

## TABLE-TOOLBAR-002 — Left Group

Use:

```text
Search
Status
Category
Filters
Sort
```

depending on page.

---

## TABLE-TOOLBAR-003 — Right Group

Use:

```text
Saved Views icon
Columns
Export icon
```

depending on page.

---

## TABLE-TOOLBAR-004 — No Dangling Control

At normal desktop widths:

```text
all controls = one row
```

If wrapping becomes necessary:

```text
wrap intentionally by group
```

Never let one control such as:

```text
Filters
```

or:

```text
Sort
```

be stranded alone beneath the toolbar.

---

# 18. Toolbar Width Priority

When the toolbar is too wide:

```text
1. Reduce search width
2. Make bookmark icon-only
3. Make export/download icon-only
4. Move advanced filters into Filters
5. Reduce gaps slightly
6. Only then allow intentional wrap
```

---

# 19. Search Width Responsive

Desktop:

```text
280–320px
```

Tablet:

```text
220–280px
```

Mobile:

```text
100%
```

Do not use unrestricted:

```text
flex: 1
```

for dense enterprise toolbars.

---

# 20. Button Icon Semantics

Use icon-only for:

```text
Bookmark
Download
Export
```

Keep visible text for:

```text
Columns
Filters
Status
Category
Date
Sort
```

This keeps action controls compact while keeping configuration controls understandable.

---

# 21. Accessibility — Cards

Semantic reading order:

```text
headline
value
unit
support
```

The visual position does not alter the DOM reading order.

---

# 22. Accessibility — Icon Actions

Every icon-only action:

```text
has aria-label
has tooltip
is keyboard reachable
has visible focus
```

---

# 23. Accessibility — Search / Status

Every new control:

```text
Search
Status
```

must:

```text
have accessible label
support keyboard
show selected filter state
support escape
```

---

# 24. Localization

New English strings:

```text
Saved views
Search schedules
Search data sources
Search integrations
Status
Connected
Warning
Failed
Disconnected
Export
```

New Indonesian strings:

```text
Tampilan tersimpan
Cari jadwal
Cari sumber data
Cari integrasi
Status
Terhubung
Peringatan
Gagal
Terputus
Ekspor
```

---

# 25. Visual QA — Overview

```text
[ ] 4 cards same height
[ ] values left aligned
[ ] values vertically centered
[ ] first sparkline removed
[ ] headings one line
[ ] support stays bottom aligned
```

---

# 26. Visual QA — Forecast Explorer

```text
[ ] Trend column removed
[ ] no empty column gap
[ ] Actual left aligned
[ ] Exceptions left aligned
[ ] Saved Views icon-only
[ ] Export icon-only
[ ] Columns remains labeled
[ ] toolbar balanced
```

---

# 27. Visual QA — Forecast Insights

```text
[ ] all 4 values left aligned
[ ] value vertically centered
[ ] titles one line
[ ] range value not clipped
[ ] card height consistent
```

---

# 28. Visual QA — Data Quality

```text
[ ] all 4 values left aligned
[ ] value vertical position consistent
[ ] labels one line
[ ] support baseline consistent
```

---

# 29. Visual QA — Planning

```text
[ ] all 4 values left aligned
[ ] headings one line
[ ] Lines needing a decision remains single-line/ellipsis
```

---

# 30. Visual QA — Exceptions

```text
[ ] all 4 values left aligned
[ ] zero state remains visually strong
[ ] headings one line
```

---

# 31. Visual QA — Approvals

```text
[ ] all 3 values left aligned
[ ] values vertically centered
[ ] headings one line
```

---

# 32. Visual QA — Forecast Run Detail

```text
[ ] all 4 values left aligned
[ ] headings one line
[ ] support region consistent
[ ] Review link does not shift value
```

---

# 33. Visual QA — Forecast Schedules

```text
[ ] Search exists
[ ] Search left aligned
[ ] Columns right aligned
[ ] One-row desktop toolbar
```

---

# 34. Visual QA — Data Sources

```text
[ ] Search exists
[ ] Status filter exists
[ ] Columns aligned right
[ ] Search + Status can combine
```

---

# 35. Visual QA — Integrations

```text
[ ] Search exists
[ ] Status filter exists
[ ] Columns aligned right
[ ] Search + Status can combine
```

---

# 36. Responsive QA

Viewports:

```text
1440 × 900
1280 × 800
1024 × 768
768 × 1024
390 × 844
```

---

# 37. Mobile Card QA

At 390px:

```text
title remains one line
value stays left aligned
value remains vertically centered
support remains readable
```

If the card becomes too narrow:

```text
switch from 2 columns to 1
```

before making type unreadably small.

---

# 38. Mobile Toolbar QA

At mobile:

```text
Search full width
```

then:

```text
Filters / Status
```

then:

```text
Columns / actions
```

Use intentional hierarchy.

---

# 39. Dark Theme QA

Repeat the full card and toolbar review in dark mode.

Verify:

```text
value visibility
headline contrast
icon contrast
tooltip contrast
button focus
filter states
table toolbar separation
```

No color change should alter layout.

---

# 40. English / Indonesian QA

Repeat affected pages in:

```text
English
Bahasa Indonesia
```

Verify:

```text
one-line card headings
search placeholders
status filter labels
tooltips
aria labels
export/download labels
```

Indonesian should remain concise enough to avoid breaking the one-line KPI rule.

---

# 41. Regression Risk — MetricCard

A global compact-card change may affect other pages.

Therefore:

```text
CompactMetricCard → corrected alignment
DetailedMetricCard → preserve existing behavior unless explicitly required
```

Do not globally center or otherwise redesign detailed cards.

---

# 42. Regression Risk — Toolbar

Reducing search width or converting actions to icons may affect other tables.

Review all tables using:

```text
FilterBar
DataTable
toolbarEnd
export
saved views
```

before final merge.

---

# 43. Regression Risk — DataTable

Removing Trend must be page-specific to Forecast Explorer.

Do not modify generic DataTable to assume every table has no trend-like column.

---

# 44. Test Fixture for MetricCard

Create a shared visual/test fixture covering:

```text
short label
long label
short value
large value
percentage
range
zero
positive
negative
with unit
without unit
with support
without support
```

Expected every compact card:

```text
left value
vertical center
single-line title
```

---

# 45. Search / Filter Test Cases

## Forecast Schedules

```text
search daily
clear
empty
loading
error
```

## Data Sources

```text
search ERP
status Warning
search + status
clear
empty
```

## Integrations

```text
search Promotions
status Failed
search + status
clear
empty
```

---

# 46. Action Icon Test Cases

## Saved Views

```text
icon visible
text hidden
tooltip visible
aria-label present
keyboard activation
```

## Export

```text
download icon visible
text hidden
tooltip visible
aria-label includes row count
keyboard activation
```

## Columns

```text
icon + visible label
existing dropdown behavior preserved
```

---

# 47. Engineering Rules

Do NOT:

```text
create one-off card CSS per page
use absolute positioning for KPI values
use transform to center values
duplicate SearchInput
duplicate StatusFilter
duplicate Data Sources and Integrations filtering logic
wrap card headlines to two lines
remove accessibility labels when converting to icon-only
```

---

# 48. Preferred Architecture

Shared:

```text
MetricCard
FilterBar
DataTable
IconActionButton
Tooltip
StatusFilter
```

Page-specific:

```text
data
labels
which filters exist
search placeholder
column definition
```

---

# 49. Implementation Sequence

## Phase 1 — Shared Metric System

```text
1. Correct value-zone alignment
2. Keep value left
3. Vertical center only
4. One-line heading
5. Tooltip for truncation
6. Equal support zone
```

## Phase 2 — Overview

```text
1. Remove first sparkline
2. Verify four cards
```

## Phase 3 — Action Icons

```text
1. Saved views
2. Export
3. Download
4. Tooltips
5. aria-label
```

## Phase 4 — Explorer

```text
1. Remove Trend
2. Rebalance columns
3. Toolbar icon-only actions
4. Verify one-row toolbar
```

## Phase 5 — KPI Surfaces

```text
1. Insights
2. Data Quality
3. Planning
4. Exceptions
5. Approvals
6. Run Detail
```

## Phase 6 — New Table Controls

```text
1. Forecast Schedules search
2. Data Sources search + status
3. Integrations search + status
```

## Phase 7 — QA

```text
Light
Dark
English
Indonesian
Desktop
Mobile
Keyboard
Visual regression
```

---

# 50. File Targets

## Shared

```text
src/components/forecasting/metrics.tsx
src/components/tables/data-table.tsx
src/components/tables/filter-bar.tsx
src/components/ui/button.tsx
```

## Overview

```text
src/features/overview/overview-view.tsx
```

## Forecast Explorer

```text
src/features/forecast-explorer/explorer-view.tsx
```

## Forecast Insights

```text
src/features/analytics/insights-view.tsx
```

## Historical Demand

```text
src/features/demand-data/historical-view.tsx
```

## Data Quality

```text
src/features/demand-data/quality-view.tsx
```

## Planning

```text
src/features/planning/plan-view.tsx
```

## Exceptions

```text
src/features/exceptions/exceptions-view.tsx
```

## Approvals

```text
src/features/approvals/approvals-view.tsx
```

## Forecast Run Detail

```text
src/features/forecast-runs/run-detail-view.tsx
```

## Data Sources / Integrations

```text
src/features/demand-data/sources-view.tsx
```

## Forecast Schedules

Locate the current route/feature file from the latest repository tree. Do not create a duplicate schedule page implementation.

---

# 51. Final Acceptance Criteria

## Cards

```text
[ ] Main value is NOT horizontally centered
[ ] Main value is vertically centered inside the value area
[ ] Main value aligns left with headline
[ ] Main value aligns left with support
[ ] Headline is one line
[ ] Ellipsis used when necessary
[ ] Tooltip reveals full headline
[ ] Card heights remain equal
```

## Overview

```text
[ ] 4 cards corrected
[ ] first sparkline removed
```

## Forecast Explorer

```text
[ ] Trend removed
[ ] Saved Views icon-only
[ ] Export icon-only
[ ] Columns remains labeled
```

## Forecast Insights

```text
[ ] 4 cards corrected
[ ] headings one line
```

## Data Quality

```text
[ ] 4 cards corrected
[ ] headings one line
```

## Planning

```text
[ ] 4 cards corrected
[ ] headings one line
```

## Exceptions

```text
[ ] 4 cards corrected
[ ] headings one line
```

## Approvals

```text
[ ] 3 cards corrected
[ ] headings one line
```

## Run Detail

```text
[ ] 4 cards corrected
[ ] headings one line
```

## Forecast Schedules

```text
[ ] Search added
[ ] Columns remains aligned right
```

## Data Sources

```text
[ ] Search added
[ ] Status filter added
[ ] Columns aligned right
```

## Integrations

```text
[ ] Search added
[ ] Status filter added
[ ] Columns aligned right
```

---

# 52. Final Product Principle

The correct KPI pattern is:

```text
Headline
|
| 4.77M
|
| Support
```

not:

```text
Headline
        4.77M
Support
```

The user should perceive one coherent left content axis while the metric itself occupies the vertical center of the available space.

For dense tables, the correct toolbar pattern is:

```text
[Search] [Filters] [Status]              [Columns] [icon actions]
```

not:

```text
[Search] [Filters] [Status]

                           [Columns]
```

and not:

```text
[Search] [Bookmark Views] [Columns] [Export 2,480 rows]
```

The UI should become:

```text
less verbose
more aligned
more compact
easier to scan
```

without sacrificing accessibility or product meaning.