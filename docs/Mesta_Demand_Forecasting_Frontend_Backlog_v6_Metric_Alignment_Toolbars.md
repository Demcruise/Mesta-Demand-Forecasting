# Mesta Demand Forecasting
## Frontend-Only Backlog v6
### Metric Alignment, Chart Removal, Table Simplification, Toolbar Fitting & Shared Layout Refinement

**Version:** 6.0  
**Date:** 26 September 2026  
**Scope:** Frontend only  
**Repository:** `https://github.com/Demcruise/Mesta-Demand-Forecasting`  
**Branch:** `main`  
**Basis:** Latest committed frontend + attached screenshots + previous Mesta frontend backlog  
**Primary focus:** visual polish and shared-component consistency

---

# 0. Objective

This backlog is the next frontend refinement pass after the previous metric-card, density, alignment, profile, dark-theme, and localization work.

The current implementation already has a shared `MetricCard` component and shared `DataTable`/`FilterBar` infrastructure.

This backlog therefore focuses on fixing the remaining visual inconsistencies at the **shared component level** instead of patching each page independently.

Primary changes:

1. Center-align the large metric value inside all requested KPI cards.
2. Remove the sparkline/trend from the first Overview KPI card.
3. Remove the `Trend` table column from Forecast Explorer.
4. Center the large values in Forecast Insights cards.
5. Reduce Historical Demand search width so the toolbar fits one clean row.
6. Center Data Quality KPI values.
7. Center Planning KPI values.
8. Center Exceptions KPI values.
9. Center Approvals KPI values.
10. Center Forecast Run Detail KPI values.
11. Resize Audit Log search control so all toolbar controls stay on one row.
12. Keep the existing frontend-only architecture and shared design system.
13. Do not introduce page-specific hacks.
14. Preserve English/Indonesian localization.
15. Preserve light/dark theme behavior.

---

# 1. Source & Visual References

## 1.1 Current Repository

Use the latest committed state of:

```text
https://github.com/Demcruise/Mesta-Demand-Forecasting
```

Relevant shared sources include:

```text
src/components/forecasting/metrics.tsx
src/components/tables/data-table.tsx
src/components/tables/filter-bar.tsx
src/components/page/page.tsx
```

Affected features include:

```text
src/features/overview/overview-view.tsx
src/features/forecast-explorer/explorer-view.tsx
src/features/analytics/insights-view.tsx
src/features/demand-data/historical-view.tsx
src/features/demand-data/quality-view.tsx
src/features/planning/plan-view.tsx
src/features/exceptions/exceptions-view.tsx
src/features/approvals/approvals-view.tsx
src/features/forecast-runs/run-detail-view.tsx
src/features/governance/audit-view.tsx
```

---

## 1.2 Attached Screenshot Mapping

The current request includes ten reference screenshots.

Use them as visual evidence for:

```text
Screenshot 1
Overview

Screenshot 2
Forecast Explorer

Screenshot 3
Forecast Insights

Screenshot 4
Historical Demand

Screenshot 5
Data Quality

Screenshot 6
Planning

Screenshot 7
Exceptions

Screenshot 8
Approvals

Screenshot 9
Forecast Run Detail

Screenshot 10
Audit Log
```

The implementation must preserve the current information architecture while correcting the specific visual issues below.

---

# 2. Global Problem

Across the affected pages, the same pattern appears:

```text
Metric label
↓
Large value
↓
Some metadata
```

but the large value is visually anchored toward the left rather than being centered within its metric area.

This produces:

- inconsistent visual balance;
- too much empty space on one side;
- cards that feel unfinished;
- unequal visual weight;
- weak symmetry between four-card groups.

The solution must be shared.

---

# 3. Global Metric Card Rule

## METRIC-ALIGN-001

All compact KPI cards should follow:

```text
┌─────────────────────────────┐
│ icon   Metric label         │
│                             │
│          4.77M              │
│          units              │
│                             │
│      ↗ +1.6%                │
└─────────────────────────────┘
```

### Important

The **large value itself** is centered horizontally.

The label remains aligned to the normal card content axis.

The supporting comparison/meta line remains aligned according to the card variant.

This keeps the metric visually centered without turning the entire card into a centered text block.

---

# 4. Metric Card Anatomy

## METRIC-ALIGN-002

Preferred structure:

```text
Card
├── Header row
│   ├── Icon
│   └── Label
│
├── Value zone
│   ├── Main value
│   └── Unit
│
└── Supporting zone
    └── Delta / metadata
```

### Alignment

```text
Header        left
Main value    center
Support       left or center depending on variant
```

For four-card KPI grids, use:

```text
label = left
value = center
support = left
```

This is the specific treatment requested for the screenshots.

---

# 5. Shared MetricCard Implementation

## METRIC-ALIGN-003

Target file:

```text
src/components/forecasting/metrics.tsx
```

Current component already contains:

```text
MetricCard
CompactMetricCard
DetailedMetricCard
```

Modify the compact variant rather than adding page-specific CSS.

---

# 6. Compact Metric Value Container

## METRIC-ALIGN-004

Use a dedicated value wrapper:

```tsx
<div className="mt-5 flex min-h-[72px] flex-col items-center justify-center text-center">
  ...
</div>
```

Recommended structure:

```text
min-height:
64–76px

display:
flex

align-items:
center

justify-content:
center

text-align:
center
```

Do not use absolute positioning.

---

# 7. Value + Unit Alignment

## METRIC-ALIGN-005

If the value is:

```text
4.77M units
```

the value and unit should remain one visual group.

Preferred:

```text
4.77M
units
```

or inline baseline:

```text
4.77M units
```

depending on existing card proportions.

The large number itself must remain visually centered.

---

# 8. Long Number Handling

## METRIC-ALIGN-006

If the number is too long:

```text
4,770,960
```

do not allow:

```text
4.7...
```

unless shortening is intentionally part of the card design.

Preferred:

```text
4.77M
```

with exact number available in:

- tooltip;
- accessible label;
- detail page.

### Acceptance

No accidental CSS truncation.

---

# 9. Number Typography

## METRIC-ALIGN-007

Large metric:

```text
font-size: 2rem–2.25rem
font-weight: 700
font-variant-numeric: tabular-nums
```

Unit:

```text
font-size: 0.8125–0.875rem
font-weight: 500
```

Avoid making the unit visually louder than the value.

---

# 10. Metric Card Vertical Rhythm

## METRIC-ALIGN-008

Target:

```text
card padding
20–24px

header
24px

value zone
64–76px

support zone
20–24px
```

The large number should not sit directly against the top label.

---

# 11. Overview — Four KPI Cards

## OVERVIEW-METRIC-001

**Priority:** P0

Affected surface:

```text
Forecast health
```

Four cards:

```text
Forecasted demand
Forecast accuracy
Forecast bias
Open exceptions
```

All four must use identical large-value alignment.

---

# 12. Overview Card 1 — Forecasted Demand

## OVERVIEW-METRIC-002

Current visual:

```text
Forecasted demand
4.7...
units
small line chart
+1.6%
```

Requested change:

```text
Forecasted demand

          4.77M
          units

↗ +1.6% vs previous run
```

### Remove

The sparkline/trend from this card.

Do not render:

```tsx
trend={trend.values}
trendForecastFrom={trend.forecastFrom}
```

for this specific Overview card.

---

# 13. Why Remove the First Overview Sparkline

## OVERVIEW-METRIC-003

The screenshot shows the first card becoming visually different from the other three cards because it contains an additional chart line.

This creates:

```text
Card 1 = metric + chart
Card 2 = metric
Card 3 = metric
Card 4 = metric
```

The user is asking for a more balanced four-card group.

Therefore:

```text
All four cards should share the same visual rhythm.
```

---

# 14. Overview Card 2 — Forecast Accuracy

## OVERVIEW-METRIC-004

Target:

```text
Forecast accuracy

          21.6%
            WAPE

Backtest · last 91 days
```

The large value is centered.

The WAPE unit may remain inline/baseline with the number if it fits.

The supporting text remains in the lower region.

---

# 15. Overview Card 3 — Forecast Bias

## OVERVIEW-METRIC-005

Target:

```text
Forecast bias

          +2.5%

Tends to over-forecast
```

Main number centered.

Do not vertically center the label.

---

# 16. Overview Card 4 — Open Exceptions

## OVERVIEW-METRIC-006

Target:

```text
Open exceptions

             87

30 critical · 57 warning
```

Main value centered.

Supporting line may remain left if the existing component contract uses left metadata.

---

# 17. Overview Four-Card Equality

## OVERVIEW-METRIC-007

All four cards must have:

```text
same width
same height
same header height
same value-zone height
same main-value baseline
same supporting-zone baseline
```

No card should visually appear taller because it has more text.

---

# 18. Overview Responsive

## OVERVIEW-METRIC-008

Desktop:

```text
4 columns
```

Tablet:

```text
2 × 2
```

Mobile:

```text
1 column
```

Center alignment must remain intact.

---

# 19. Forecast Explorer — Remove Trend Column

## EXPLORER-TREND-001

**Priority:** P0

Target:

```text
src/features/forecast-explorer/explorer-view.tsx
```

Current table includes:

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

Remove:

```text
Trend
```

---

# 20. Forecast Explorer Columns After Removal

## EXPLORER-TREND-002

Preferred:

```text
Forecast
Previous
Actual (prior)
Change
80% interval
Status
Exceptions
```

No empty space should remain where the trend column was.

---

# 21. Forecast Explorer Table Redistribution

## EXPLORER-TREND-003

After removing the Trend column:

- give additional flexible width to `Forecast`;
- preserve numeric column readability;
- preserve `Status`;
- preserve `Exceptions`;
- avoid excessive whitespace between columns.

Suggested conceptual widths:

```text
Forecast        1.0fr
Previous        1.0fr
Actual          1.0fr
Change          0.8fr
Interval        1.2fr
Status          0.9fr
Exceptions      0.9fr
```

Exact widths should follow existing DataTable mechanics.

---

# 22. Forecast Explorer Alignment

## EXPLORER-TREND-004

Keep alignment contract:

```text
Forecast        right
Previous        right
Actual (prior)  left
Change          right
80% interval    right
Status          left
Exceptions      left
```

Removing Trend must not reintroduce alignment drift.

---

# 23. Forecast Explorer Mobile

## EXPLORER-TREND-005

The removed Trend column must not leave:

- a hidden placeholder;
- empty grid track;
- spacer;
- blank column.

Mobile priority remains:

```text
Forecast
Change
Status
Exceptions
```

Other values can remain in detail view depending on current responsive contract.

---

# 24. Forecast Insights — Four Cards

## INSIGHTS-METRIC-001

**Priority:** P0

Target:

```text
src/features/analytics/insights-view.tsx
```

Four cards:

```text
Total forecast
Change vs previous run
80% forecast range
Change concentration
```

---

# 25. Forecast Insights Value Centering

## INSIGHTS-METRIC-002

The screenshot shows the large values visually anchored too far left.

Update to:

```text
Total forecast

            4.77M
             units

↗ +1.6% vs previous run
```

The card header remains left aligned.

---

# 26. Insights Card 1

Target:

```text
Total forecast

          4.77M
           units

↗ +1.6% vs previous run
```

No chart.

---

# 27. Insights Card 2

Target:

```text
Change vs previous run

           +73.8K
            units

             ↗ +1.6%
```

The large change number is centered.

---

# 28. Insights Card 3

Target:

```text
80% forecast range

        4.45M–5.09M

Range width 13.3%
```

Important:

The range should not be visually truncated.

If needed:

```text
font-size slightly reduced
```

before using ellipsis.

---

# 29. Insights Card 4

Target:

```text
Change concentration

            9.3%

from top 10 SKUs
```

Centered value.

---

# 30. Insights Card Equality

All four cards:

```text
same height
same value-zone height
same main-value alignment
```

The card with the longest heading must not distort the value's vertical position.

---

# 31. Historical Demand Toolbar

## HIST-TOOLBAR-001

**Priority:** P0

Target:

```text
src/features/demand-data/historical-view.tsx
src/components/tables/filter-bar.tsx
```

Current controls:

```text
Search
Date
Location
Category
Quality
Columns
```

The search field currently occupies too much width, causing the `Quality` button to wrap.

---

# 32. Historical Demand Search Width

## HIST-TOOLBAR-002

Reduce search width slightly.

Suggested desktop width:

```text
320px
```

from a larger flexible width.

Alternative:

```text
min-width: 260px
max-width: 320px
```

depending on viewport.

---

# 33. Historical Demand Toolbar Target

Desktop:

```text
[ Search ] [ Date ] [ Location ] [ Category ] [ Quality ]         [ Columns ]
```

All on one row.

---

# 34. Historical Demand Toolbar Alignment

Use:

```text
display: flex
align-items: center
gap: 8–12px
```

Avoid:

```text
align-items: start
```

when all controls have equal vertical height.

---

# 35. Historical Demand Search Responsive

At >= 1280:

```text
width: 320px
```

At 1024:

```text
width: 260–280px
```

At 768:

```text
Search may take full first row
```

At mobile:

```text
Search = full width
```

The requested one-row desktop layout remains the target.

---

# 36. Historical Demand Filter Order

Keep:

```text
Search
Date
Location
Category
Quality
```

right-side:

```text
Columns
```

Do not reorder controls without need.

---

# 37. Historical Demand Columns Button

Columns should remain right aligned with the toolbar group.

Do not allow:

```text
Columns
```

to fall under the search group at desktop widths.

---

# 38. Historical Demand Data Table

After toolbar adjustment, ensure:

- table begins immediately below toolbar;
- no additional unwanted vertical gap;
- no filter control overlaps;
- no header clipping.

---

# 39. Data Quality — Four Cards

## DATAQUALITY-METRIC-001

**Priority:** P0

Affected cards:

```text
Blocking issues
Warnings
Coverage
Sources with problems
```

---

# 40. Data Quality Large Number Alignment

## DATAQUALITY-METRIC-002

Each large number must be centered:

```text
Blocking issues

          1
```

```text
Warnings

          4
```

```text
Coverage

         94.3%
```

```text
Sources with problems

          2
```

---

# 41. Data Quality Card Header

Do not center:

```text
icon
label
```

Keep:

```text
icon + label = left
```

Only center the KPI value zone.

---

# 42. Data Quality Supporting Text

Keep supporting metadata near the bottom:

```text
1 issue needs attention
May affect forecast accuracy
of SKUs without open issues
of 5 sources
```

Ensure the support baseline is consistent across all four cards.

---

# 43. Data Quality Card Height

All four:

```text
same min-height
same header area
same value area
same support area
```

---

# 44. Data Quality Card Long Label

`Sources with problems` may wrap.

Do not let wrapping push the large number downward.

Reserve a consistent header height:

```text
40–48px
```

---

# 45. Data Quality Responsive

Desktop:

```text
4 columns
```

Tablet:

```text
2 × 2
```

Mobile:

```text
1 column
```

Value remains centered.

---

# 46. Planning — Four Cards

## PLANNING-METRIC-001

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

# 47. Planning Card 1

Target:

```text
Baseline forecast

           816K
          units

100 lines
```

Large value centered.

---

# 48. Planning Card 2

Target:

```text
Planned quantity

           816K
          units

→ 0.0% vs forecast
```

Large value centered.

---

# 49. Planning Card 3

Target:

```text
Lines needing a decision

             65

52 pending · 13 flagged
```

Main value centered.

---

# 50. Planning Card 4

Target:

```text
Decided

             35

29 accepted · 6 adjusted
```

Main value centered.

---

# 51. Planning Card Header Wrapping

The screenshot shows:

```text
Lines needing a deci...
```

and:

```text
Decided
```

If title truncation occurs:

- use tooltip for full label;
- reserve title line height;
- prevent card value from moving.

---

# 52. Planning Card Value Zone

Use same shared compact metric card anatomy.

Do not create page-specific alignment classes.

---

# 53. Exceptions — Four Cards

## EXCEPTIONS-METRIC-001

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

# 54. Exceptions Card Values

Centered:

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

---

# 55. Exceptions Supporting Text

Keep:

```text
Open · investigating · escalated
25%+ change or blocking issue
No owner yet
Needs my attention
```

Use one line whenever possible.

Do not turn these into paragraphs.

---

# 56. Exceptions Zero State

For:

```text
Assigned to me
0
```

do not make the zero visually weak.

A zero is a valid KPI.

Keep same typography:

```text
font-size
font-weight
center alignment
```

---

# 57. Approvals — Three Cards

## APPROVALS-METRIC-001

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

# 58. Approvals Card Values

Centered:

```text
Awaiting decision
          4

Due within 24h
          2

Overdue
          0
```

---

# 59. Approvals Supporting Text

Keep:

```text
Open requests
Decide today
None overdue
```

near the bottom of each card.

---

# 60. Approval Value Hierarchy

Do not center the entire card.

Only:

```text
large number = center
```

Keep:

```text
title + icon = left
metadata = left
```

This preserves scanability.

---

# 61. Forecast Run Detail — Four Cards

## RUNDETAIL-METRIC-001

Target:

```text
src/features/forecast-runs/run-detail-view.tsx
```

Current cards:

```text
Forecast · 28 days
Previous run
Actual · last 28 days
SKUs needing review
```

---

# 62. Run Detail Card 1

Target:

```text
Forecast · 28 days

          121,009
             units

+1.7%
```

or, if compact formatting is used:

```text
121K
units
```

Full value available in tooltip/detail.

---

# 63. Run Detail Card 2

Target:

```text
Previous run

          118,932
             units

+1.7% change
```

Centered value.

---

# 64. Run Detail Card 3

Target:

```text
Actual · last 28 days

          116,858
             units

Same length as the horizon
```

Keep metadata readable.

---

# 65. Run Detail Card 4

Target:

```text
SKUs needing review

              0

64 up >5% · 21 down >5%
```

Main number centered.

---

# 66. Run Detail Card Actions

The current fourth card may contain:

```text
Review in explorer →
```

Keep this action in the supporting area, but make sure it does not shift the main number.

Preferred structure:

```text
fixed value zone
+
fixed support zone
```

---

# 67. Run Detail Card Height Equality

All four cards:

```text
equal height
equal header height
equal value zone
equal support zone
```

If one card has a link and others don't, reserve support space consistently.

---

# 68. Audit Log Toolbar

## AUDIT-TOOLBAR-001

**Priority:** P0

Current controls:

```text
Search
Date picker
Action
Person
Filters
Columns
Export
```

Problem:

`Filters` wraps to a second row because Search is too wide.

---

# 69. Audit Log Search Width

## AUDIT-TOOLBAR-002

Reduce search width.

Target desktop:

```text
320px
```

or:

```text
280–320px
```

depending on viewport.

---

# 70. Audit Log Toolbar Target

Desktop:

```text
[ Search ] [ Date ] [ Action ] [ Person ] [ Filters ]         [ Columns ] [ Export ]
```

Everything should stay on one row at normal desktop widths.

---

# 71. Audit Log Toolbar Grouping

Left group:

```text
Search
Date
Action
Person
Filters
```

Right group:

```text
Columns
Export
```

Use:

```text
justify-content: space-between
```

between the groups.

---

# 72. Audit Toolbar No Dangling Filter

Acceptance:

```text
Filters
```

must not appear alone underneath.

If viewport becomes too narrow to fit:

```text
Search
Date
Action
Person
Filters
```

then use intentional responsive wrapping.

Do not allow one random button to wrap.

---

# 73. Audit Log Search Placeholder

Current:

```text
Search object, person, reason or request ID
```

This is long.

Use shorter placeholder:

```text
Search object, person or ID
```

This improves fit without reducing functionality.

Indonesian:

```text
Cari objek, orang, atau ID
```

---

# 74. Audit Log Search Input Icon

Keep the search icon.

Input remains:

```text
search icon
placeholder
```

No need for additional help text inside the toolbar.

---

# 75. Global Toolbar Width Strategy

## TOOLBAR-GLOBAL-001

The problem across Historical Demand and Audit Log is not just the individual search component.

It is the toolbar width contract.

Create a reusable:

```text
ToolbarGroup
```

or improve FilterBar to support:

```text
start group
end group
```

---

# 76. Toolbar Layout Contract

Desktop:

```text
display: flex
align-items: center
justify-content: space-between
gap: 12px
```

Left group:

```text
display: flex
align-items: center
gap: 8px
min-width: 0
```

Right group:

```text
display: flex
align-items: center
gap: 8px
flex-shrink: 0
```

---

# 77. Search Width Contract

Do not let all search inputs use:

```text
flex: 1
```

without a max-width.

Recommended:

```text
max-width: 320px
```

for dense enterprise tables.

---

# 78. Search Width Variant

Create:

```ts
size?: "default" | "compact"
```

or:

```ts
width?: "sm" | "md" | "lg"
```

Potential:

```text
sm  240px
md  280px
lg  320px
```

Use:

```text
Historical Demand → md
Audit Log          → md
Forecast Explorer  → md
```

---

# 79. Search Input Responsive

Desktop:

```text
240–320px
```

Tablet:

```text
200–280px
```

Mobile:

```text
100%
```

---

# 80. Toolbar Wrap Policy

When the toolbar cannot fit:

### Preferred:

```text
Search + primary filters
```

on row 1.

```text
secondary filters + actions
```

on row 2.

### Avoid:

```text
Search + date + action + person
                  ↓
Filters
```

because the visual grouping becomes ambiguous.

---

# 81. Historical Demand Toolbar Implementation

Target:

```text
FilterBar
+ DateRangeFilter
+ custom facets
+ Columns
```

The layout should render:

```text
left:
Search
Date
Location
Category
Quality

right:
Columns
```

---

# 82. Audit Log Toolbar Implementation

Target:

```text
left:
Search
Date
Action
Person
Filters

right:
Columns
Export
```

This makes the grouping explicit.

---

# 83. Toolbar Vertical Height

All controls should use the same:

```text
control height
```

Current design token should remain the source of truth.

Do not create:

```text
search 42px
date 40px
filter 36px
columns 40px
```

---

# 84. Table Toolbar Mobile

At mobile:

```text
Search full width
```

Then:

```text
Filters
Columns
Export
```

in secondary row/menu.

Do not force desktop width on mobile.

---

# 85. MetricCard Shared API

Because multiple pages are affected, do not create:

```text
overviewCentered
insightsCentered
planningCentered
```

Create one shared prop or variant if needed:

```ts
valueAlign?: "left" | "center";
```

Recommended default for compact KPI cards:

```text
center
```

---

# 86. MetricCard Backward Compatibility

Existing detailed cards may still need:

```text
left-aligned value
```

Do not globally center every MetricCard without checking detailed variants.

Implement:

```ts
variant="compact"
```

with:

```text
valueAlign = center
```

and leave detailed card anatomy unchanged unless explicitly required.

---

# 87. Metric Card Value CSS

Potential:

```css
.metric-value {
  display: flex;
  min-height: 4rem;
  align-items: center;
  justify-content: center;
  text-align: center;
}
```

Avoid:

```css
position: absolute;
left: 50%;
transform: translateX(-50%);
```

---

# 88. Metric Card Support CSS

Support content:

```css
min-height: 1.5rem;
display: flex;
align-items: center;
```

If multiple lines exist, center vertically inside the support slot but preserve left text alignment unless the design explicitly uses centered metadata.

---

# 89. Metric Card Icon / Label

Keep:

```text
icon + label
```

left-aligned.

Do not center label just because the value is centered.

---

# 90. Metric Card Click Indicator

If the card is clickable and uses a link:

```text
small arrow
```

should not sit next to the number.

Place it:

```text
top-right
```

or as a subtle card hover indicator.

This prevents the value group from being visually interrupted.

---

# 91. Overview First Card Sparkline Removal

Specific implementation:

Current:

```tsx
<MetricCard
  ...
  trend={trend.values}
  trendForecastFrom={trend.forecastFrom}
/>
```

Change:

```tsx
<MetricCard
  ...
  trend={undefined}
/>
```

Do not remove the Sparkline component globally because other places may still use it meaningfully.

---

# 92. Forecast Explorer Trend Data

Removing the Trend column should NOT remove:

```text
trend
```

from domain data if other components consume it.

Only remove it from:

```text
Explorer table column definition
```

This keeps the data model reusable.

---

# 93. Forecast Explorer Table Testing

After removing Trend:

```text
[ ] table renders
[ ] columns count correct
[ ] header/body grid aligned
[ ] sorting still works
[ ] filtering still works
[ ] row click works
[ ] drawer works
[ ] mobile works
```

---

# 94. Metric Card Testing

For every affected page:

```text
[ ] value is centered
[ ] no clipping
[ ] no ellipsis
[ ] unit is legible
[ ] support text remains visible
[ ] equal card height
[ ] responsive
```

---

# 95. Long Value Testing

Test:

```text
1
87
816K
4.77M
121,009
4.45M–5.09M
94.3%
+2.5%
-8.5%
```

The centered value zone must handle all.

---

# 96. Card Width Testing

Test:

```text
1440
1280
1024
768
390
```

At 390:

```text
value should remain centered
```

At 1024:

```text
2×2 card layout
```

At 1280:

```text
4 columns
```

---

# 97. DataTable Toolbar Testing

Historical Demand:

```text
Search
Date
Location
Category
Quality
Columns
```

Audit:

```text
Search
Date
Action
Person
Filters
Columns
Export
```

At 1280:

```text
one row
```

At 1024:

```text
intentional wrap only if needed
```

---

# 98. Table Toolbar Width Regression

Create tests/visual regression for:

```text
Historical Demand
Audit Log
Forecast Explorer
Data Quality
Planning
Exceptions
Approvals
```

The purpose is to ensure search width changes do not break other tables.

---

# 99. Global Design Consistency

All KPI cards now use:

```text
same value alignment
same value sizing
same support position
same padding
same height
```

Differences should only occur when semantics justify them.

---

# 100. Global Visual Rules

Do not introduce:

```text
page-specific value positioning
absolute center tricks
one-off search widths
per-page toolbar wrappers
random card heights
```

Prefer shared components and props.

---

# 101. Required Files for Implementation

## Shared

```text
src/components/forecasting/metrics.tsx
src/components/tables/filter-bar.tsx
src/components/tables/data-table.tsx
src/components/page/page.tsx
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

## Audit

```text
src/features/governance/audit-view.tsx
```

---

# 102. Implementation Sequence

## Phase 1 — Shared Metric System

```text
1. update compact MetricCard
2. center value zone
3. equalize height
4. remove accidental value truncation
5. verify units
6. remove only Overview first-card sparkline usage
```

---

## Phase 2 — Shared Toolbar System

```text
1. add search width variants
2. set max-width
3. introduce toolbar start/end grouping
4. prevent dangling controls
5. responsive wrap rules
```

---

## Phase 3 — Forecast Explorer

```text
1. remove Trend column
2. rebalance columns
3. verify alignment
4. verify mobile
```

---

## Phase 4 — Page KPI Validation

```text
1. Overview
2. Insights
3. Data Quality
4. Planning
5. Exceptions
6. Approvals
7. Forecast Run Detail
```

---

## Phase 5 — Toolbar Validation

```text
1. Historical Demand
2. Audit Log
3. Forecast Explorer
4. Data Quality
5. Planning
6. Exceptions
7. Approvals
```

---

## Phase 6 — Final QA

```text
1. Visual regression
2. Responsive QA
3. Keyboard QA
4. Light theme
5. Dark theme
6. English
7. Indonesian
```

---

# 103. Acceptance Criteria — Overview

```text
[ ] Four forecast-health cards use equal height
[ ] Main values are horizontally centered
[ ] Header labels remain left aligned
[ ] Supporting text remains readable
[ ] First card sparkline removed
[ ] No awkward empty chart space remains
[ ] No number clipping
[ ] 1280 screenshot balanced
[ ] 1024 screenshot balanced
[ ] Mobile remains centered
```

---

# 104. Acceptance Criteria — Forecast Explorer

```text
[ ] Trend column removed
[ ] Grid tracks recalculated
[ ] Actual (prior) still aligned correctly
[ ] Exceptions still aligned correctly
[ ] No blank column remains
[ ] Sorting remains correct
[ ] Export still works
[ ] Drawer context retained
```

---

# 105. Acceptance Criteria — Forecast Insights

```text
[ ] Four KPI values centered
[ ] All four cards equal height
[ ] Range value not clipped
[ ] Main number visually dominant
[ ] Support text remains legible
[ ] No card appears heavier than another
```

---

# 106. Acceptance Criteria — Historical Demand

```text
[ ] Search width reduced
[ ] Date fits
[ ] Location fits
[ ] Category fits
[ ] Quality fits
[ ] Columns remains on same toolbar row
[ ] Search remains usable
[ ] At 1280 one-row toolbar
```

---

# 107. Acceptance Criteria — Data Quality

```text
[ ] 4 values centered
[ ] Same value zone height
[ ] Same card height
[ ] Coverage value centered
[ ] Source problems value centered
[ ] No label wraps into value zone
```

---

# 108. Acceptance Criteria — Planning

```text
[ ] 4 values centered
[ ] Baseline forecast centered
[ ] Planned quantity centered
[ ] Lines needing decision centered
[ ] Decided centered
[ ] Long title does not shift values
```

---

# 109. Acceptance Criteria — Exceptions

```text
[ ] 4 values centered
[ ] Open centered
[ ] Critical centered
[ ] Unassigned centered
[ ] Assigned to me centered
[ ] Zero remains visually strong
```

---

# 110. Acceptance Criteria — Approvals

```text
[ ] 3 values centered
[ ] Awaiting decision centered
[ ] Due within 24h centered
[ ] Overdue centered
[ ] Same card height
```

---

# 111. Acceptance Criteria — Forecast Run Detail

```text
[ ] 4 values centered
[ ] Forecast centered
[ ] Previous run centered
[ ] Actual centered
[ ] SKUs needing review centered
[ ] Supporting info remains bottom-aligned
[ ] Link does not shift value
```

---

# 112. Acceptance Criteria — Audit Log

```text
[ ] Search is narrower
[ ] Date remains visible
[ ] Action remains visible
[ ] Person remains visible
[ ] Filters remains same row
[ ] Columns remains right-aligned
[ ] Export remains right-aligned
[ ] No random second-row button
```

---

# 113. Global Metric QA

Run visual review for:

```text
Overview
Forecast Insights
Data Quality
Planning
Exceptions
Approvals
Forecast Run Detail
```

Check:

```text
same label baseline
same value position
same support position
same card height
same padding
```

---

# 114. Global Toolbar QA

Run visual review for:

```text
Historical Demand
Audit Log
Forecast Explorer
Data Quality
Planning
Exceptions
Approvals
```

Check:

```text
search width
button grouping
one-row fit
button alignment
right action group
responsive behavior
```

---

# 115. Regression Risk — MetricCard

Potential risk:

A global alignment change could affect detailed cards not intended for this request.

Therefore:

```text
Compact variant → center
Detailed variant → preserve existing behavior unless explicitly requested
```

---

# 116. Regression Risk — FilterBar

Potential risk:

Reducing search width globally could make some pages too short or leave unused space.

Therefore support:

```text
searchWidth
```

variant or per-page max width only through a controlled prop.

Do not add arbitrary utility classes to page markup.

---

# 117. Regression Risk — DataTable

Removing Trend only from Explorer must not alter:

```text
other table columns
```

or shared DataTable internals.

---

# 118. Responsive Risk

Centering metric values can create issues when:

```text
large numbers
long ranges
long labels
```

are shown on mobile.

Use:

```text
responsive font-size
```

and:

```text
min-width: 0
```

but never clip meaningful data.

---

# 119. Accessibility

Centered values must still have meaningful semantics.

Example:

```text
Forecasted demand: 4.77 million units, up 1.6% versus previous run.
```

The visual layout does not change the reading order.

---

# 120. Accessibility — Toolbar

Search and filters:

```text
logical tab order
```

must remain:

```text
Search
Date
Location
Category
Quality
Columns
```

Historical Demand.

Audit:

```text
Search
Date
Action
Person
Filters
Columns
Export
```

---

# 121. Visual QA — Light Theme

For all affected pages:

```text
[ ] white canvas
[ ] card border visible
[ ] KPI values centered
[ ] toolbar aligned
[ ] no clipping
[ ] no accidental wrap
```

---

# 122. Visual QA — Dark Theme

Repeat all affected pages in dark theme.

Verify:

```text
centered values
card hierarchy
toolbar border
table contrast
number legibility
button fit
```

No layout change should cause dark-only clipping.

---

# 123. Visual QA — English

Verify all affected pages with:

```text
English
```

No localization regression.

---

# 124. Visual QA — Indonesian

Verify:

```text
Bahasa Indonesia
```

No wrapping or layout break from longer strings.

---

# 125. Screenshot Regression Set

Required:

```text
Overview
Forecast Explorer
Forecast Insights
Historical Demand
Data Quality
Planning
Exceptions
Approvals
Forecast Run Detail
Audit Log
```

Viewports:

```text
1440 × 900
1280 × 800
1024 × 768
390 × 844
```

---

# 126. Final Code Quality Rules

Do not:

```text
add margin-left to individual cells
add absolute positioning to values
add page-specific centering wrappers
duplicate MetricCard
duplicate SearchInput
duplicate Toolbar
hide content with overflow hidden
```

unless explicitly justified by component architecture.

---

# 127. Preferred Engineering Pattern

Instead of:

```text
Overview fix
Insights fix
Planning fix
Exceptions fix
```

implement:

```text
MetricCard
   ↓
centered value zone
   ↓
all affected pages inherit fix
```

Instead of:

```text
Historical Demand fix
Audit Log fix
```

implement:

```text
Toolbar / Search width system
   ↓
page-level configuration
```

---

# 128. Final Frontend Definition of Done

The backlog is complete when:

```text
[ ] Overview values centered
[ ] Overview first sparkline removed
[ ] Forecast Explorer Trend removed
[ ] Forecast Insights values centered
[ ] Historical Demand toolbar fits
[ ] Data Quality values centered
[ ] Planning values centered
[ ] Exceptions values centered
[ ] Approvals values centered
[ ] Forecast Detail values centered
[ ] Audit Log toolbar fits
[ ] No page-specific alignment hacks
[ ] Shared components updated
[ ] Light mode reviewed
[ ] Dark mode reviewed
[ ] English reviewed
[ ] Indonesian reviewed
[ ] Desktop reviewed
[ ] Mobile reviewed
[ ] Keyboard reviewed
[ ] Visual regression passes
```

---

# 129. Final Visual Direction

The end state should feel:

```text
Balanced
Clean
Compact
Intentional
Enterprise-grade
Easy to scan
```

The specific visual rhythm should be:

```text
Label
↓
Centered value
↓
Small context
```

for KPI cards.

And:

```text
Search + filters              Actions
```

for dense table toolbars.

---

# 130. Final Product Principle

The goal of this pass is not to add more UI.

It is to remove visual friction.

The user should not notice:

```text
where the table grid starts
where the metric is positioned
why one toolbar wraps
why one card looks different
why one column is misaligned
```

They should only notice:

```text
what the number means
what needs attention
what they can do next
```