# Mesta Demand Forecasting
## Enterprise Product Design + Frontend Implementation Backlog

**Version:** 1.0  
**Date:** 25 September 2026  
**Repository:** `https://github.com/Demcruise/Mesta-Demand-Forecasting`  
**Reference System:** Mesta Enterprise Product Master Prompt v2  
**React UI Reference:** React Bits Pro - Installation + Application UI  
**Status:** Greenfield implementation backlog

---

# 0. Purpose

This document is the implementation-ready product backlog for **Mesta Demand Forecasting**.

It is designed to be used as the working source of truth for:

- Product design
- UX architecture
- Frontend architecture
- Design system implementation
- React component planning
- Enterprise workflow design
- Data visualization
- Forecasting workflow design
- Governance
- QA and regression testing
- Product-level consistency

The repository is currently a greenfield starting point. At the time this backlog was created, the repository contains a minimal `README.md` and `LICENSE` and does not yet contain an application frontend, routes, component system, or package manifest.

Therefore:

- Existing repository behavior must not be invented.
- Every UI and workflow in this document is a proposed product architecture.
- Forecasting business rules, model types, source systems, KPI definitions, approval policies, and production data contracts must be validated with product and domain stakeholders before being treated as final.
- The backlog intentionally separates **source-supported facts** from **product design proposals** and **implementation assumptions**.

---

# 1. Source of Truth Hierarchy

Use the following priority order when making implementation decisions.

```text
1. Approved product/business requirements
2. Existing repository implementation
3. Mesta Enterprise Product Master Prompt v2
4. Approved design references
5. React Bits Pro implementation references
6. Frontend best practices
7. Local implementation preference
```

When a conflict occurs:

```text
Business requirement
        ↓
Product semantics
        ↓
Mesta design system
        ↓
React Bits implementation reference
        ↓
Local code preference
```

React Bits is not the Mesta design system.

React Bits provides:

- Component starting points
- Application UI patterns
- Interaction references
- Installation mechanisms
- Reusable implementation accelerators

Mesta owns:

- Information architecture
- Product semantics
- Typography
- Color
- Density
- Workflow
- Content hierarchy
- Accessibility
- State model
- Governance behavior
- Interaction rules
- Enterprise trust model

---

# 2. Current Repository Assessment

## REPO-001 - Repository Baseline

**Priority:** P0  
**Type:** Foundation  
**Status:** Required before application implementation

### Current state

Repository:

```text
Demcruise/Mesta-Demand-Forecasting
```

Current root is minimal:

```text
README.md
LICENSE
```

No verified application implementation exists yet.

### Consequence

The project should be treated as a greenfield enterprise product build rather than a visual polish pass over an existing application.

### Acceptance criteria

- Repository structure documented.
- Frontend stack selected.
- Application architecture documented.
- Design system location defined.
- Route ownership defined.
- Component ownership defined.
- Data layer ownership defined.
- Environment strategy defined.
- Validation requirements documented.

---

# 3. Product Definition

## PRODUCT-001 - Product Positioning

**Priority:** P0

### Working product definition

Mesta Demand Forecasting is an enterprise decision-support product designed to help retail or planning teams understand expected future demand, inspect forecast quality, evaluate scenarios, and translate forecast outputs into operational planning decisions.

### Core user value

```text
Historical demand
        ↓
Forecast
        ↓
Confidence / uncertainty
        ↓
Scenario
        ↓
Planning decision
        ↓
Operational outcome
```

### Product principle

The product should not present the forecast as a magical answer.

The interface must make the following visible where applicable:

- What data was used
- What period is being forecast
- What model/version produced the result
- How fresh the input data is
- What confidence or uncertainty exists
- What assumptions apply
- What was overridden
- Who approved a material change
- What happened after publication

---

# 4. Product Design Principles

## DESIGN-001 - Clarity Over Cleverness

The UI should answer:

1. What is happening?
2. Why is it happening?
3. What should I look at?
4. What decision am I being asked to make?
5. What happens next?

Avoid:

- Decorative dashboards
- Unnecessary charts
- Arbitrary gradients
- Excessive rounded cards
- Excessive pills
- Decorative progress bars
- Large empty hero spaces
- Generic AI-dashboard aesthetics
- Interaction effects without operational value

---

## DESIGN-002 - Institutional Credibility

The product should feel:

- Operational
- Precise
- Controlled
- Reliable
- Mature
- Data-driven
- Enterprise-grade

It should not feel like:

- A marketing landing page
- An AI demo
- A design showcase
- A consumer analytics app

---

## DESIGN-003 - Transparency Beats Persuasion

Every consequential output should expose enough context for a user to understand:

- Source
- Time
- Scope
- State
- Assumption
- Confidence
- Constraint
- Consequence
- Owner
- Approval state

---

# 5. Primary Personas

> These personas are a proposed product model. Validate exact role names and responsibilities with stakeholders.

## PERSONA-001 - Demand Planner

Primary tasks:

- Review forecast
- Identify exceptions
- Compare forecast with historical demand
- Investigate unusual changes
- Apply justified overrides
- Publish or submit plans

Primary information:

- Forecast quantity
- Historical demand
- Forecast delta
- Uncertainty
- Exceptions
- Override history

---

## PERSONA-002 - Category / Commercial Manager

Primary tasks:

- Review category-level outlook
- Evaluate business implications
- Compare scenarios
- Review promotional or commercial assumptions
- Approve selected planning decisions

Primary information:

- Category demand
- Trend
- Scenario comparison
- Business impact
- Key exceptions

---

## PERSONA-003 - Supply / Operations Planner

Primary tasks:

- Translate demand forecast into operational planning
- Investigate supply-sensitive exceptions
- Review planned quantities
- Identify risk periods

Primary information:

- Forecast demand
- Inventory context
- Forecast uncertainty
- Exception queues
- Coverage / risk

---

## PERSONA-004 - Data / Analytics User

Primary tasks:

- Inspect data quality
- Evaluate model performance
- Investigate forecast errors
- Validate data freshness
- Compare model versions

Primary information:

- Data lineage
- Data quality
- Error metrics
- Model performance
- Backtesting

---

## PERSONA-005 - Administrator

Primary tasks:

- Manage workspace
- Manage integrations
- Configure permissions
- Manage users
- Review audit logs
- Configure system behavior

---

## PERSONA-006 - Executive / Decision Maker

Primary tasks:

- Understand overall demand outlook
- Identify material risks
- Review plan impact
- Monitor forecast reliability
- Review exceptions requiring executive attention

---

# 6. Core User Journeys

## JOURNEY-001 - Daily Forecast Review

```text
Sign in
 ↓
Workspace
 ↓
Overview
 ↓
Demand outlook
 ↓
Needs attention
 ↓
Open exception
 ↓
Inspect forecast
 ↓
Review historical context
 ↓
Inspect uncertainty
 ↓
Take action
 ↓
Save / Submit / Approve
 ↓
Feedback
 ↓
Audit event
```

### Success condition

The planner can understand the current demand outlook and resolve priority exceptions without losing context.

---

## JOURNEY-002 - Forecast Run

```text
Forecasting
 ↓
Create forecast run
 ↓
Select scope
 ↓
Select data period
 ↓
Select horizon
 ↓
Select model/version
 ↓
Validate inputs
 ↓
Review configuration
 ↓
Run forecast
 ↓
Processing
 ↓
Results
 ↓
Evaluate
 ↓
Publish / Save draft
```

---

## JOURNEY-003 - Forecast Investigation

```text
Overview
 ↓
Forecast Explorer
 ↓
Select SKU / Category
 ↓
Forecast Detail
 ↓
Historical trend
 ↓
Forecast
 ↓
Confidence interval
 ↓
Model metadata
 ↓
Signals / assumptions
 ↓
Related exceptions
 ↓
Action
```

---

## JOURNEY-004 - Scenario Planning

```text
Forecast Detail
 ↓
Create Scenario
 ↓
Clone baseline
 ↓
Define assumptions
 ↓
Adjust drivers
 ↓
Run simulation
 ↓
Compare baseline
 ↓
Review impact
 ↓
Save scenario
 ↓
Submit for review
```

---

## JOURNEY-005 - Approval

```text
Notification
 ↓
Approval queue
 ↓
Review change set
 ↓
Review impact
 ↓
Review assumptions
 ↓
Review evidence
 ↓
Approve / Reject / Request revision
 ↓
Audit event
```

---

## JOURNEY-006 - Data Quality Investigation

```text
Overview
 ↓
Data health
 ↓
Select issue
 ↓
Inspect source
 ↓
Inspect affected scope
 ↓
Review impact
 ↓
Retry / Resolve / Escalate
 ↓
Refresh state
```

---

# 7. Global Information Architecture

Recommended navigation:

```text
Mesta
│
├── Overview
│
├── Forecasting
│   ├── Forecast Runs
│   ├── Forecast Explorer
│   └── Forecast Detail
│
├── Demand Data
│   ├── Products
│   ├── Historical Demand
│   ├── Data Quality
│   └── Data Sources
│
├── Models
│   ├── Model Registry
│   ├── Model Performance
│   └── Backtesting
│
├── Scenarios
│   ├── Scenarios
│   └── Scenario Comparison
│
├── Planning
│   ├── Plan Workspace
│   ├── Exceptions
│   └── Approvals
│
└── Administration
    ├── Integrations
    ├── Users & Roles
    ├── Audit Log
    └── Settings
```

Navigation should be role-aware.

Do not hide a critical workflow simply because a user is not an administrator.

---

# 8. Global Application Shell

## SHELL-001 - Application Frame

**Priority:** P0

### Components

- `AppShell`
- `AppSidebar`
- `TopBar`
- `WorkspaceSwitcher`
- `Breadcrumbs`
- `CommandMenu`
- `GlobalSearch`
- `NotificationCenter`
- `UserMenu`
- `PageContainer`

### Layout

Desktop:

```text
┌──────────────────────────────────────────────────────────┐
│ Sidebar │ TopBar                                         │
│         ├───────────────────────────────────────────────  │
│         │ Breadcrumb / Context                            │
│         │ Page Title                                      │
│         │                                                 │
│         │ Main Content                                    │
│         │                                                 │
└─────────┴─────────────────────────────────────────────────┘
```

### Rules

- Sidebar has stable width.
- Main content must not shift because of changing navigation labels.
- Page content uses stable max-width rules.
- Primary action remains discoverable.
- Breadcrumbs show hierarchy, not decorative location.
- Workspace context should remain visible.

### States

- Sidebar expanded
- Sidebar collapsed
- Mobile
- Workspace switching
- Permission-restricted route
- Loading route
- Offline / degraded mode where relevant

### React Bits mapping

Primary references:

- App Shell
- App Sidebar
- Navbar
- Command Menu
- Mobile

React Bits should be wrapped behind Mesta components.

---

# 9. Authentication

## AUTH-001 - Enterprise Sign In

**Priority:** P0

### Flow

```text
Work email
 ↓
Organization discovery
 ↓
Continue with SSO
 ↓
Identity Provider
 ↓
MFA
 ↓
Callback
 ↓
Session
 ↓
Workspace
 ↓
Role
 ↓
Permissions
 ↓
Application
```

### Components

- `AuthShell`
- `WorkEmailField`
- `OrganizationDiscovery`
- `SSOButton`
- `AuthLoading`
- `AuthError`
- `AuthCallback`
- `SessionGuard`

### Supported standards

Potential:

- OIDC
- SAML 2.0
- SCIM
- RBAC

Exact provider support must be validated.

### States

- Idle
- Email validating
- Organization found
- Organization not found
- SSO redirecting
- Callback processing
- MFA handled by IdP
- Session expired
- Unauthorized
- Account disabled

### CTA language

Avoid:

- Continue

Prefer:

- Continue with SSO
- Continue to organization
- Return to sign in

### Acceptance criteria

- Authentication does not expose password creation unless explicitly required.
- Unauthorized users do not see protected application data.
- Workspace and role are resolved before protected route rendering.
- Session expiration has a recovery path.

### React Bits mapping

Use Authentication patterns only for structural reference. Do not copy consumer password/signup semantics into the enterprise flow.

---

# 10. Workspace Context

## WORKSPACE-001 - Workspace Switcher

**Priority:** P0

### Purpose

Allow users with access to multiple business environments to switch context safely.

### Components

- `WorkspaceSwitcher`
- `WorkspaceSearch`
- `WorkspaceList`
- `WorkspaceStatus`
- `WorkspaceContextBanner`

### Information

- Workspace name
- Organization
- Environment
- Status
- Role

### Behavior

Switching workspace must:

- update application context
- reset or validate scoped filters
- invalidate stale data
- update breadcrumb
- update audit context

### Guardrail

Never silently retain a filter or entity from Workspace A when entering Workspace B if that object does not exist there.

---

# 11. Global Command Menu

## NAV-001 - Command Menu

**Priority:** P1

### Commands

- Navigate to overview
- Search SKU
- Search forecast
- Search scenario
- Open exception
- Open approval
- Create forecast run
- Create scenario
- Open settings

### React Bits

Command Menu.

### Keyboard

```text
Ctrl/Cmd + K
```

### Acceptance criteria

- Search works without pointer input.
- Results are scoped to the current workspace and permissions.
- Commands display keyboard shortcuts where available.
- No unauthorized entity appears.

---

# 12. Global Design System Foundation

## DS-001 - Token Architecture

**Priority:** P0

Create:

```text
Primitive tokens
    ↓
Semantic tokens
    ↓
Component tokens
    ↓
Page usage
```

### Token groups

```text
color
typography
spacing
radius
border
elevation
motion
z-index
control-height
table-density
```

### Spacing

Recommended starting scale:

```text
4
8
12
16
20
24
32
40
48
64
```

---

## DS-002 - Typography

**Priority:** P0

Required roles:

```text
page-title
section-title
card-title
body
body-sm
label
caption
metadata
numeric-lg
numeric-md
mono-id
```

Numeric values must support:

```css
font-variant-numeric: tabular-nums;
```

---

## DS-003 - Semantic Color

Required semantics:

```text
Primary
Neutral
Info
Success
Warning
Critical
```

Statuses must not rely on color alone.

Use:

```text
icon + label + color
```

where appropriate.

---

## DS-004 - Core Controls

Implement standardized:

- Button
- Input
- Select
- Combobox
- DateRangePicker
- Checkbox
- Radio
- Switch
- Tabs
- Badge
- Tooltip
- Popover
- Toast
- Dialog
- Drawer
- DropdownMenu
- Pagination
- Skeleton

### Acceptance criteria

No page should introduce a one-off control for an existing pattern.

---

# 13. Entity System

## ENTITY-001 - Product Identity

```text
[Icon]
Product Name
Category · SKU
```

Variants:

- compact
- table
- detail
- searchable
- disabled

---

## ENTITY-002 - Forecast Identity

Show:

```text
Forecast Run
Run ID
Scope
Horizon
Created
Status
```

---

## ENTITY-003 - Scenario Identity

Show:

```text
Scenario Name
Baseline
Owner
Status
Last modified
```

---

## ENTITY-004 - Model Identity

Show:

```text
Model Name
Version
Status
Accuracy
Last trained
```

---

# 14. Status System

Create reusable statuses.

## STATUS-001

Statuses:

```text
Draft
Queued
Running
Completed
Published
Approved
Rejected
Needs Review
Failed
Paused
Archived
Stale
Unavailable
```

Each status needs:

- Label
- Icon
- Semantic color
- Tooltip
- Accessible text

---

# 15. Freshness System

## FRESH-001

Reusable component:

`FreshnessIndicator`

States:

```text
Fresh
Recent
Delayed
Stale
Unavailable
```

Example:

```text
Updated 15 minutes ago
Data is considered fresh
```

or:

```text
Observed 4 days ago
Source may be stale
```

Never show freshness where the underlying timestamp is unknown.

---

# 16. Core Data Table

## TABLE-001 - Enterprise DataTable Foundation

**Priority:** P0

### Required features

- Sorting
- Filtering
- Pagination
- Row selection
- Sticky header
- Column visibility
- Column resizing
- Density modes
- Export
- Keyboard navigation
- Loading
- Empty
- Error
- Responsive behavior
- Virtualization where necessary

### Density

```text
Comfortable: 52-56px
Compact: 40-44px
```

### Layout

Use shared grid tracks for header and body.

Do not implement header and body with independent flex layouts.

### Numeric

Right-align:

- quantities
- percentages
- currency
- ratios

### Example

```text
SKU              Forecast        Actual        Delta
SKU-001          12,440          11,900        +4.5%
```

### React Bits mapping

Data Table.

---

# 17. Global Filter System

## FILTER-001

Default toolbar:

```text
[Search]
[Date range]
[Filters]
[Sort]
```

Active filters:

```text
Category ×
Region ×
Status ×
Horizon ×
```

Requirements:

- Progressive disclosure
- Primary filters visible
- Advanced filters collapsed
- Clear all
- State persistence
- URL synchronization where appropriate
- Permission-aware values

### React Bits mapping

Filtering.

---

# 18. Overview Dashboard

# PAGE-OVERVIEW

**Priority:** P0  
**Primary persona:** Planner / Manager  
**Primary goal:** Understand the current forecast state within 5 seconds.

## Problem

Without a centralized overview, users have to navigate through separate forecast pages to determine:

- Current demand outlook
- Forecast quality
- Data health
- Exceptions
- Pending decisions

## UX consequence

Users lose context and spend time finding what actually requires attention.

## Page structure

```text
Page Header
↓
Scope / Date Context
↓
Needs Attention
↓
Forecast Health
↓
Demand Outlook
↓
Forecast Accuracy
↓
Exception Queue
↓
Recent Forecast Runs
↓
Activity
```

## Components

- `PageHeader`
- `ScopeBar`
- `MetricStrip`
- `AttentionPanel`
- `ForecastTrendChart`
- `AccuracyMetric`
- `ExceptionTable`
- `ForecastRunList`
- `ActivityFeed`
- `FreshnessIndicator`

## Metrics

Potential metrics requiring validation:

- Forecasted demand
- Forecast accuracy
- Forecast bias
- Number of exceptions
- Data freshness
- Active forecast run
- Pending approvals

Do not implement a KPI solely because it looks useful. Every KPI must support an actual decision.

## Acceptance criteria

- User understands active scope.
- User sees what requires attention.
- User can reach the forecast detail from the primary metric.
- Data freshness is visible.
- Loading and empty states retain structural geometry.

---

# 19. Forecast Run List

# PAGE-FORECAST-RUNS

**Priority:** P0

## Purpose

Provide operational visibility into forecast generation jobs.

## Table columns

```text
Run ID
Status
Scope
Model
Horizon
Created
Started
Completed
Data freshness
Created by
Actions
```

## Components

- `ForecastRunTable`
- `RunStatus`
- `ScopeBadge`
- `ModelIdentity`
- `FreshnessIndicator`
- `RunActions`

## Actions

- Open
- View results
- Duplicate configuration
- Retry
- Cancel
- Archive

Actions must be permission-aware.

## States

### Loading

Use table skeleton matching row geometry.

### Empty

```text
No forecast runs have been created for this workspace.

Create a forecast run to generate a new demand outlook.
```

CTA:

`Create forecast run`

### Error

```text
Forecast runs could not be loaded.

Check your connection and retry.
```

CTA:

`Retry loading runs`

---

# 20. Create Forecast Run

# PAGE-CREATE-FORECAST

**Priority:** P0

## Workflow

```text
1. Define scope
2. Select data period
3. Configure horizon
4. Select model
5. Validate data
6. Review configuration
7. Run forecast
```

## Step 1 - Define Scope

Fields:

- Business unit
- Region
- Store group
- Category
- Product group
- SKU
- Optional filters

Requirement:

Do not expose all dimensions as an overwhelming filter wall. Use progressive disclosure.

## Step 2 - Select Data Period

Fields:

- Historical start
- Historical end
- Data source
- Frequency

Display:

```text
Historical window
Data available through
Data freshness
Missing periods
```

## Step 3 - Configure Horizon

Potential values:

- 7 days
- 14 days
- 30 days
- 60 days
- 90 days
- Custom

Exact allowed values must be validated.

## Step 4 - Model

Show:

```text
Model
Version
Status
Last trained
Historical performance
```

Do not select a model based only on a marketing-like score.

## Step 5 - Validate

Validation panel:

```text
Data availability
Missing records
Duplicate records
Outliers
Freshness
Required fields
Model compatibility
```

Each result:

```text
Pass
Warning
Blocking
```

## Step 6 - Review

Summary:

```text
Scope
Historical period
Forecast horizon
Model
Expected output
Known warnings
```

## Step 7 - Execute

CTA:

`Run forecast`

Never use:

`Continue`

## Confirmation

For high-impact runs show consequences:

```text
This run will generate forecasts for:
2,480 SKUs

Historical window:
Jan 1 - Sep 24, 2026

Forecast horizon:
30 days

Model:
Model v2.4

Warnings:
12 SKUs have incomplete historical demand.

[Run forecast]
[Back to configuration]
```

---

# 21. Forecast Processing

# PAGE-FORECAST-PROCESSING

**Priority:** P0

## Purpose

Show operational progress during forecast generation.

## Components

- `RunProgress`
- `StepStatus`
- `ProcessingMetrics`
- `ActivityLog`
- `CancelRunButton`

## Steps

```text
Queued
↓
Loading data
↓
Validating data
↓
Running model
↓
Generating forecast
↓
Writing results
↓
Completed
```

## Requirements

- Never show fake progress.
- Progress must correspond to actual backend state where available.
- Show timestamps where useful.
- Provide recovery if processing fails.

---

# 22. Forecast Explorer

# PAGE-FORECAST-EXPLORER

**Priority:** P0

## Purpose

Allow users to scan forecast outputs across many entities.

## Layout

```text
Page Header
↓
Scope + Filter Bar
↓
Forecast Summary
↓
Forecast Table
↓
Detail Drawer
```

## Table

Potential columns:

```text
Product
Category
Forecast
Previous Forecast
Actual
Delta
Trend
Confidence
Status
Exception
Updated
```

## Row action

Clicking a row opens a detail drawer without destroying list context.

## Drawer width

Standard:

```text
480-560px
```

Investigation:

```text
560-640px
```

---

# 23. Forecast Detail

# PAGE-FORECAST-DETAIL

**Priority:** P0

## Purpose

Explain one forecasted entity or scope.

## Page anatomy

```text
Header
↓
Entity identity
↓
Forecast summary
↓
Historical demand
↓
Forecast projection
↓
Uncertainty
↓
Comparison
↓
Drivers / assumptions
↓
Model information
↓
Exceptions
↓
Actions
↓
Audit history
```

## Forecast chart

Must answer:

> What is expected to happen next, and how different is it from historical behavior?

Required:

- Time
- Actual series
- Forecast series
- Prediction interval
- Current date
- Forecast start
- Unit
- Timeframe
- Tooltip
- Data table alternative

## Chart accessibility

Provide textual equivalent:

```text
Forecast period
Sep 25 - Oct 24

Expected demand
124,300 units

Range
116,100 - 133,700 units
```

---

# 24. Forecast Uncertainty

# UNCERTAINTY-001

**Priority:** P0

## Goal

Make uncertainty understandable.

Avoid vague:

```text
Confidence: 82%
```

without context.

Preferred:

```text
Expected demand
124,300 units

Prediction interval
116,100 - 133,700

Coverage
80%
```

Exact statistical language must match the model implementation.

## Effective-bound visualization

```text
Lower bound ─────────────── Upper bound
                 │
              Forecast
```

Explicitly label:

- Current
- Forecast
- Lower bound
- Upper bound
- Source
- Effective result

---

# 25. Model Registry

# PAGE-MODEL-REGISTRY

**Priority:** P1

## Purpose

Manage forecasting model versions.

## Table

```text
Model
Version
Status
Last trained
Training period
Forecast horizon
Accuracy
Bias
Owner
```

## Actions

- View
- Compare
- Archive
- Mark default
- View training details

Exact model lifecycle requires validation.

---

# 26. Model Detail

# PAGE-MODEL-DETAIL

**Priority:** P1

## Sections

```text
Model overview
↓
Version metadata
↓
Training data
↓
Performance
↓
Backtesting
↓
Known limitations
↓
Usage
↓
Audit
```

## Metadata

Potential:

- Model name
- Version
- Training timestamp
- Training period
- Dataset
- Feature set
- Forecast horizon
- Frequency

Do not expose technical metadata that has no user decision value.

---

# 27. Model Performance

# PAGE-MODEL-PERFORMANCE

**Priority:** P1

## Metrics

Potential metrics:

- MAE
- RMSE
- MAPE / WAPE
- Bias
- Coverage

Metric definitions must be agreed with analytics owners.

## UX requirement

Every metric must include:

- Definition
- Unit
- Time period
- Population
- Comparison baseline where applicable

---

# 28. Backtesting

# PAGE-BACKTESTING

**Priority:** P1

## Workflow

```text
Select model
↓
Select historical window
↓
Select evaluation frequency
↓
Run backtest
↓
Review performance
↓
Compare versions
```

## Outputs

- Error metrics
- Forecast vs actual
- Error distribution
- Segment performance
- Bias
- Coverage where applicable

## Comparison

Allow users to compare model versions without creating false precision.

---

# 29. Demand Data

# PAGE-DEMAND-DATA

**Priority:** P0

## Purpose

Provide visibility into historical demand used for forecasting.

## Components

- Data table
- Source indicator
- Data freshness
- Date range
- Quality status
- Dimension filters

## Table

Potential columns:

```text
Date
SKU
Location
Category
Demand
Units
Source
Quality
Updated
```

---

# 30. Data Quality

# PAGE-DATA-QUALITY

**Priority:** P0

## Purpose

Make data readiness operationally visible.

## Overview

```text
Data health
↓
Blocking issues
↓
Warnings
↓
Coverage
↓
Freshness
↓
Source status
```

## Issue types

Potential:

- Missing records
- Duplicate records
- Missing dimensions
- Late data
- Unexpected zero demand
- Extreme outlier
- Schema mismatch
- Source unavailable

Exact checks must be defined with data owners.

## Issue detail

Show:

```text
What happened?
Affected scope
Detected at
Source
Forecast impact
Recommended action
Current state
Owner
```

---

# 31. Data Sources

# PAGE-DATA-SOURCES

**Priority:** P1

## Source list

```text
Source
Type
Status
Last sync
Freshness
Records
Owner
```

## Detail

- Connection
- Schedule
- Last successful sync
- Last failed sync
- Data mapping
- Health
- Recent activity

## React Bits mapping

Integrations.

---

# 32. Scenario Management

# PAGE-SCENARIOS

**Priority:** P1

## Purpose

Allow users to compare planning outcomes under alternate assumptions.

## List

```text
Scenario
Baseline
Owner
Status
Modified
Impact
Actions
```

## Actions

- Open
- Duplicate
- Compare
- Submit for review
- Archive

---

# 33. Scenario Builder

# PAGE-SCENARIO-BUILDER

**Priority:** P1

## Workflow

```text
Select baseline
↓
Define scenario name
↓
Configure assumptions
↓
Adjust drivers
↓
Validate
↓
Run simulation
↓
Review impact
↓
Save scenario
```

## Assumption model

Potential categories:

```text
Demand change
Price / commercial assumption
Promotion
Seasonality
External factor
Availability
Regional adjustment
Product lifecycle
```

Exact drivers require domain validation.

## Rule

Every modified assumption must show:

```text
Baseline
Changed value
Delta
Source / rationale
```

---

# 34. Scenario Comparison

# PAGE-SCENARIO-COMPARISON

**Priority:** P1

## Goal

Answer:

> What changes between baseline and scenario?

## Comparison surface

```text
Metric
Baseline
Scenario A
Delta
Delta %
```

## Required

- Shared scope
- Shared timeframe
- Clearly labeled assumptions
- Clear uncertainty
- Data timestamp
- Export capability

Avoid decorative comparison cards.

---

# 35. Planning Workspace

# PAGE-PLANNING

**Priority:** P1

## Purpose

Translate forecast into an operational planning decision.

## Layout

```text
Plan context
↓
Forecast baseline
↓
Exceptions
↓
Proposed changes
↓
Business impact
↓
Review
↓
Submit / Publish
```

## Actions

- Adjust
- Accept
- Reject
- Flag
- Submit for review
- Save draft

---

# 36. Forecast Override

# OVERRIDE-001

**Priority:** P1

## Purpose

Allow authorized users to modify a forecast when business context is not fully captured by the model.

## Form

```text
Original forecast
Override value
Delta
Reason
Evidence
Comment
Owner
```

## Required

Override must capture:

- Previous value
- New value
- User
- Timestamp
- Reason
- Supporting context
- Approval requirement where applicable

## Confirmation

```text
You are changing the forecast for 124 SKUs.

Original forecast:
124,300 units

New forecast:
131,800 units

Change:
+6.0%

Reason:
[reason]

This change will affect the planning baseline.

[Apply override]
[Cancel]
```

---

# 37. Exceptions

# PAGE-EXCEPTIONS

**Priority:** P1

## Purpose

Prioritize forecast items requiring human attention.

## Exception types

Potential:

- Large forecast delta
- Low confidence
- High forecast error
- Data freshness issue
- Data quality issue
- Model anomaly
- Manual override
- Threshold breach

## Table

```text
Exception
Severity
Entity
Value
Threshold
Detected
Owner
Status
```

## States

```text
Open
Investigating
Resolved
Dismissed
Escalated
```

---

# 38. Exception Detail

# PAGE-EXCEPTION-DETAIL

**Priority:** P1

## Drawer anatomy

```text
Header
↓
Exception summary
↓
Why triggered
↓
Affected entities
↓
Relevant forecast
↓
Historical context
↓
Data quality
↓
Recommended actions
↓
Activity
↓
Resolve
```

## Explain the trigger

Do not use:

```text
Anomaly detected
```

without detail.

Prefer:

```text
Forecast increased 31% versus the previous run.
The configured review threshold is 15%.
The increase affects 84 SKUs.
```

Exact copy depends on business rules.

---

# 39. Approval Queue

# PAGE-APPROVALS

**Priority:** P1

## Purpose

Centralized human review for consequential actions.

## Queue

```text
Type
Object
Requested by
Impact
Status
Created
Due
```

## Detail

```text
Request
↓
Change set
↓
Impact
↓
Evidence
↓
Assumptions
↓
Policy
↓
Approval history
```

## Actions

- Approve
- Reject
- Request revision

## High-impact confirmation

Always show:

```text
What will change?
How much?
Who is affected?
Why?
What policy applies?
What happens after approval?
```

---

# 40. Notifications

# NOTIFY-001

**Priority:** P1

Notification categories:

- Forecast completed
- Forecast failed
- Data quality issue
- Data freshness issue
- Approval requested
- Approval completed
- Exception opened
- Scenario simulation completed
- Model issue

Every actionable notification must deep-link to its source.

React Bits:

Notifications.

---

# 41. Activity and Audit

# PAGE-AUDIT

**Priority:** P1

## Purpose

Show a trustworthy record of consequential activity.

## Events

Potential:

```text
sign in
sign out
workspace switch
create forecast run
cancel forecast run
approve
reject
override
create scenario
edit scenario
publish plan
change settings
change permissions
integration update
```

## Audit event anatomy

```text
What happened?
Who did it?
When?
What changed?
Why?
Previous state?
Resulting state?
Related objects?
Source data?
```

---

# 42. Decision Lineage

# LINEAGE-001

**Priority:** P1

The system should make relationships navigable:

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
Planning Decision
 ↓
Approval
 ↓
Published Plan
 ↓
Monitoring
 ↓
Audit
```

Each object should provide contextual links forward and backward.

---

# 43. Settings

# PAGE-SETTINGS

**Priority:** P1

Separate:

```text
Personal
Workspace
Forecasting
Data & integrations
Approvals
Notifications
Roles & permissions
Audit / retention
Security
API / access
```

Do not mix personal preferences with administrative settings.

---

# 44. User and Role Management

# PAGE-USERS

**Priority:** P1

## Table

```text
User
Role
Workspace
Status
Last active
```

## Actions

- Invite
- Change role
- Suspend
- Remove
- View access

## Permission model

Proposed:

```text
Viewer
Planner
Manager
Analyst
Administrator
```

Exact roles require approval.

---

# 45. Integrations

# PAGE-INTEGRATIONS

**Priority:** P1

## Core states

```text
Connected
Syncing
Warning
Failed
Disconnected
```

## Detail

```text
Connection
Last successful sync
Last error
Schedule
Mapping
Records
Owner
```

## Actions

- Connect
- Test connection
- Sync now
- Disconnect
- Configure

---

# 46. API / Access

# API-001

**Priority:** P2 unless integrations require it earlier.

Potential:

- API keys
- Service accounts
- Webhooks
- Access scopes
- Rotation
- Last used

Security-sensitive actions require explicit confirmation.

---

# 47. Monitoring

# PAGE-MONITORING

**Priority:** P1

## Purpose

Monitor operational health of forecasting pipelines and data dependencies.

## Overview

```text
System health
↓
Forecast jobs
↓
Data sources
↓
Models
↓
Alerts
```

## React Bits mapping

Monitoring.

---

# 48. Global Drawer Pattern

# DRAWER-001

Standard sizes:

```text
Small: 400px
Standard: 480-560px
Investigation: 560-640px
```

Anatomy:

```text
Header
Summary
Evidence
Related entities
Actions
```

Requirements:

- Focus trap
- Escape closes
- Sticky footer when needed
- Responsive full screen on mobile
- Preserves list context
- Does not lose active filters

---

# 49. Dialog Pattern

# DIALOG-001

Use dialogs for:

- Focused creation
- Confirmation
- Compact configuration
- Bulk actions
- High-impact decisions

Do not put complex multi-step workflows inside a small dialog.

---

# 50. Chart System

# CHART-001

A chart must answer a question.

For demand forecasting, likely chart types:

- Time series
- Actual vs forecast
- Forecast interval
- Forecast error
- Scenario comparison
- Distribution
- Ranking bar
- Small multiples where justified

Every quantitative chart should provide:

- Title
- Unit
- Timeframe
- Legend where necessary
- Tooltip
- Annotation where useful
- Source
- Freshness where material
- Data-table alternative

---

# 51. Forecast Chart Interaction

# CHART-002

Tooltip should show:

```text
Date
Actual
Forecast
Lower bound
Upper bound
Delta
```

Example structure:

```text
Sep 24, 2026
Actual 11,900
Forecast 12,440
Delta +4.5%
```

Exact metric display depends on available data.

---

# 52. Empty States

# STATE-EMPTY-001

Never use:

```text
No data
```

Use context-specific states.

Examples:

```text
No forecast runs have been created for this workspace.

No recommendations require review.

No exceptions match the current filters.

No competitor or external signal data is available for this scope.
```

Each empty state should explain:

1. Why the state exists
2. What the user can do next

---

# 53. Loading States

# STATE-LOADING-001

Required skeletons:

- Page
- Table
- Card
- Chart
- Drawer
- Timeline
- Forecast detail
- Scenario result
- Approval detail

Skeleton geometry must match final content geometry.

Avoid unexplained full-page spinners.

---

# 54. Error States

# STATE-ERROR-001

Every important operation should answer:

```text
What failed?
Why?
What can the user do?
Retry?
Recovery path?
```

Example:

```text
Forecast run failed during data validation.

12 SKUs are missing historical demand records.

The run was not published.

[View data issues]
[Retry validation]
```

---

# 55. Responsive System

# RESPONSIVE-001

Design for:

```text
1440px
1280px
1024px
768px
390px
```

At smaller widths:

1. Preserve primary data
2. Remove tertiary columns
3. Collapse secondary actions
4. Move advanced filters
5. Allow horizontal table scrolling where appropriate
6. Preserve decision context
7. Preserve primary action

Do not simply shrink desktop UI.

---

# 56. Accessibility

# A11Y-001

Every interactive element must be:

- Keyboard accessible
- Focus-visible
- Screen-reader friendly
- Semantically labeled
- Logical in tab order
- Color-independent
- Adequately sized
- Usable on narrow screens

Charts require accessible textual alternatives.

Tables require semantic headers and relationships.

Dialogs require:

- Focus trap
- Escape handling
- Correct label
- Correct described-by semantics where relevant

---

# 57. React Bits Integration Strategy

React Bits Pro currently provides Application UI categories that include App Shell, App Sidebar, Command Menu, Data Table, Dashboard, Analytics, Filtering, Monitoring, Forms, Dialog, Notifications, Authentication, Wizard, Integrations, and Mobile patterns.

## RB-001 - Installation

**Priority:** P0

Use the React Bits Pro installation flow compatible with the chosen React stack.

Requirements from the current documentation include:

- Node.js 18+
- React project
- shadcn/ui initialized
- `components.json`
- React Bits registry configuration
- React Bits license configuration

Exact project commands should be applied according to the current React Bits documentation when implementation starts.

## RB-002 - Wrapper Layer

Never scatter raw React Bits components across page files.

Use:

```text
React Bits primitive
        ↓
Mesta wrapper
        ↓
Domain configuration
        ↓
Page
```

Examples:

```text
React Bits Data Table
        ↓
Mesta DataTable
        ↓
ForecastDataTable

React Bits App Dialog
        ↓
Mesta Dialog
        ↓
OverrideConfirmDialog

React Bits Filtering
        ↓
Mesta FilterBar
        ↓
ForecastFilterBar
```

## RB-003 - State Completeness

Every React Bits-derived component must support or explicitly define:

```text
Default
Hover
Focus
Active
Selected
Disabled
Loading
Empty
Error
Success
Keyboard
Responsive
```

## RB-004 - Do Not Copy Branding

Do not blindly copy:

- Colors
- Typography
- Radius
- Shadows
- Gradients
- Demo content
- Animation style

The Mesta design system remains authoritative.

---

# 58. Recommended React Bits Mapping

| Product area | React Bits reference |
|---|---|
| Application Shell | App Shell |
| Sidebar | App Sidebar |
| Global navigation | Navbar |
| Mobile navigation | Mobile |
| Global search | Command Menu |
| Forecast tables | Data Table |
| Overview | Dashboard |
| Forecast analytics | Analytics |
| Filter system | Filtering |
| Forecast form | Forms |
| Create forecast workflow | Wizard |
| Scenario workflow | Wizard |
| Approval | Agent Approval pattern where appropriate |
| Confirmation | App Dialog |
| Notifications | Notifications |
| Data integrations | Integrations |
| Data monitoring | Monitoring |
| Empty states | Empty State |
| Settings | Settings Form |
| Onboarding | Onboarding |

---

# 59. Frontend Architecture

Recommended structure:

```text
src/
├── app/
│   ├── auth/
│   ├── overview/
│   ├── forecasting/
│   ├── demand-data/
│   ├── models/
│   ├── scenarios/
│   ├── planning/
│   ├── administration/
│   └── settings/
│
├── components/
│   ├── shell/
│   ├── navigation/
│   ├── ui/
│   ├── forms/
│   ├── tables/
│   ├── charts/
│   ├── entities/
│   ├── forecasting/
│   ├── models/
│   ├── scenarios/
│   ├── planning/
│   ├── approvals/
│   ├── governance/
│   ├── monitoring/
│   └── feedback/
│
├── features/
│   ├── forecast-runs/
│   ├── forecast-explorer/
│   ├── forecast-detail/
│   ├── data-quality/
│   ├── model-performance/
│   ├── scenarios/
│   ├── exceptions/
│   └── approvals/
│
├── lib/
│   ├── auth/
│   ├── api/
│   ├── permissions/
│   ├── formatting/
│   ├── validation/
│   └── telemetry/
│
├── hooks/
├── types/
├── schemas/
├── stores/
└── styles/
```

This is a recommendation and should be adapted to the selected framework.

---

# 60. Domain Component Inventory

Create shared components when the same concept appears in 3 or more pages.

## Core

```text
AppShell
AppSidebar
PageHeader
PageSection
ScopeBar
FilterBar
SearchInput
EntityIdentity
StatusBadge
FreshnessIndicator
MetricCard
DataTable
EmptyState
ErrorState
LoadingSkeleton
Drawer
Dialog
Toast
NotificationItem
AuditEvent
```

## Forecast

```text
ForecastIdentity
ForecastMetric
ForecastDelta
ForecastChart
ForecastInterval
ForecastRunStatus
ForecastScope
ForecastTable
ForecastComparison
```

## Planning

```text
OverrideForm
ImpactSummary
ApprovalStatus
ApprovalTimeline
ExceptionBadge
ExceptionReason
```

## Models

```text
ModelIdentity
ModelVersion
ModelPerformanceMetric
BacktestChart
ModelComparison
```

---

# 61. Data Contracts

These are conceptual contracts and must be aligned with backend implementation.

## ForecastRun

```ts
type ForecastRun = {
  id: string
  status: ForecastRunStatus
  scope: ForecastScope
  modelId: string
  modelVersion: string
  historicalStart: string
  historicalEnd: string
  horizon: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  createdBy: string
  dataFreshness?: DataFreshness
}
```

## ForecastPoint

```ts
type ForecastPoint = {
  date: string
  actual?: number
  forecast?: number
  lowerBound?: number
  upperBound?: number
}
```

## ForecastSummary

```ts
type ForecastSummary = {
  forecastValue: number
  previousForecast?: number
  delta?: number
  deltaPercent?: number
  confidence?: number
  status: string
}
```

## Exception

```ts
type ForecastException = {
  id: string
  type: string
  severity: "info" | "warning" | "critical"
  entityId: string
  detectedAt: string
  reason: string
  status: string
  ownerId?: string
}
```

---

# 62. API Requirements

The frontend should not hardcode business calculations that belong to the backend.

Likely API domains:

```text
/auth
/workspaces
/users
/permissions
/forecast-runs
/forecasts
/products
/historical-demand
/data-quality
/data-sources
/models
/backtests
/scenarios
/plans
/exceptions
/approvals
/audit
/notifications
/settings
```

Each endpoint should define:

- Request
- Response
- Loading
- Empty
- Error
- Permission failure
- Rate limit where relevant
- Validation failure
- Freshness metadata
- Pagination

---

# 63. State Management

Recommended split:

## Server state

Use for:

- Forecast data
- Forecast runs
- Models
- Scenarios
- Exceptions
- Approvals
- Data quality
- Notifications

## Local UI state

Use for:

- Drawer open/close
- Modal open/close
- Temporary form values
- Tabs
- Column visibility
- Density mode

## URL state

Use where deep-linkable:

- Search
- Filters
- Sort
- Pagination
- Selected entity
- Date range

---

# 64. URL and Filter Persistence

For enterprise list pages:

Persist where useful:

```text
query
filters
sort
page
density
selected entity
date range
```

Opening an entity and returning to the list should preserve:

- filters
- sort
- pagination
- scroll position where practical

This prevents context loss.

---

# 65. Formatting Rules

## Numeric

Use tabular numeric typography.

## Percent

Consistent precision.

## Quantities

Unit visible where ambiguity exists.

## Dates

Use one product-wide convention.

## IDs

Use monospace where helpful.

## Long values

Use truncation + tooltip/copy action.

---

# 66. Security UX

Security-sensitive UI should make scope visible.

Before destructive or high-impact operations show:

```text
What
Scope
Consequence
Required permission
Approval requirement
```

Do not expose sensitive information to users without permission.

---

# 67. Bulk Actions

# BULK-001

For tables that support bulk actions:

```text
Select rows
↓
Show selection count
↓
Show allowed actions
↓
Preview impact
↓
Confirm
↓
Execute
↓
Report result
```

Example:

```text
12 forecasts selected

Available:
Approve
Flag
Export
```

Actions must reflect permissions and object state.

---

# 68. Export

# EXPORT-001

Export actions should be explicit.

Potential:

- CSV
- XLSX
- PDF summary

Export must respect:

- Active filters
- Active scope
- Permissions
- Data sensitivity

Display:

```text
Exporting 2,480 rows
Current filters applied
```

---

# 69. Search

# SEARCH-001

Global search can index:

- SKU
- Product
- Forecast Run
- Scenario
- Model
- Exception
- Approval

Search result anatomy:

```text
Type
Name
ID
Scope
Status
Last updated
```

---

# 70. Onboarding

# ONBOARDING-001

Only show onboarding if the user has no usable workspace context.

Suggested flow:

```text
Welcome
↓
Workspace
↓
Data source
↓
Data readiness
↓
First forecast
```

Do not force users through tutorials repeatedly.

---

# 71. Audit Requirements

Every consequential action must create an auditable event.

Required metadata:

```text
eventId
timestamp
actor
workspace
action
entityType
entityId
previousState
newState
reason
source
requestId
```

Audit events must be immutable from normal user workflows.

---

# 72. Telemetry

Track product usage without collecting unnecessary sensitive content.

Potential events:

```text
page_view
forecast_run_started
forecast_run_completed
forecast_run_failed
forecast_opened
scenario_created
scenario_simulated
exception_opened
exception_resolved
override_started
override_applied
approval_opened
approval_completed
filter_used
export_requested
```

Telemetry should support product improvement, not replace audit.

---

# 73. QA Strategy

## QA-001 - Visual QA

For every page:

```text
[ ] Page hierarchy
[ ] Horizontal alignment
[ ] Vertical alignment
[ ] Spacing
[ ] Typography
[ ] Icon size
[ ] Button size
[ ] Table alignment
[ ] Numeric alignment
[ ] Wrapping
[ ] Truncation
[ ] Loading
[ ] Empty
[ ] Error
[ ] Disabled
[ ] Focus
[ ] Responsive
[ ] Accessibility
```

---

# 74. Regression Matrix

Every shared component:

```text
Normal
Long content
Empty
Missing content
Loading
Error
Disabled
Selected
Active
Hover
Focus
Large dataset
Small viewport
```

Tables must test:

- Long IDs
- Long names
- Large numbers
- Small numbers
- Negative values
- Multiple statuses
- Different action counts

---

# 75. Performance Requirements

## PERF-001

The frontend must remain usable when:

- Tables contain thousands of records
- Charts contain long time series
- Filters are complex
- Drawers load large detail payloads

Use:

- Pagination
- Virtualization where required
- Memoization where justified
- Incremental loading
- Server-side filtering where appropriate

Do not optimize prematurely.

Measure before introducing complexity.

---

# 76. Definition of Done - Global

A feature is complete only when:

### Product

- Purpose is clear
- User journey is complete
- Primary action is explicit
- Consequences are understandable

### Design

- Uses Mesta design tokens
- Uses shared components
- No arbitrary visual exceptions
- Information hierarchy is clear

### Frontend

- Typed
- Reusable
- Responsive
- Accessible
- Error-handled
- Loading-handled
- Empty-handled

### Data

- API states defined
- Freshness handled
- Permissions handled
- Pagination handled where applicable

### Governance

- Consequential actions audited
- High-impact actions confirmed
- Permission gates enforced

### QA

- Visual QA complete
- Responsive QA complete
- Keyboard QA complete
- Regression tests complete

---

# 77. Master Backlog

## P0 - Foundation

| ID | Epic | Priority | Scope |
|---|---|---:|---|
| FND-001 | Repository foundation | P0 | Frontend project initialization |
| FND-002 | Design tokens | P0 | Color, typography, spacing, radius |
| FND-003 | Core components | P0 | Buttons, inputs, selects, dialogs |
| FND-004 | App Shell | P0 | Sidebar, topbar, workspace |
| FND-005 | Authentication | P0 | Enterprise SSO |
| FND-006 | Workspace context | P0 | Workspace switching |
| FND-007 | DataTable | P0 | Enterprise table foundation |
| FND-008 | Filtering | P0 | Shared filter system |
| FND-009 | Status system | P0 | Semantic states |
| FND-010 | Freshness system | P0 | Data freshness |
| FND-011 | Loading states | P0 | Skeletons |
| FND-012 | Empty/error states | P0 | Recovery UX |
| FND-013 | Accessibility foundation | P0 | Keyboard/focus/semantics |
| FND-014 | QA foundation | P0 | Visual/regression setup |
| FND-015 | React Bits integration | P0 | Registry + wrapper strategy |

---

# 78. P0 - Core Product

| ID | Epic | Priority | Scope |
|---|---|---:|---|
| CORE-001 | Overview | P0 | Forecast health and attention |
| CORE-002 | Forecast Runs | P0 | Run management |
| CORE-003 | Create Forecast | P0 | Forecast workflow |
| CORE-004 | Forecast Processing | P0 | Progress and execution state |
| CORE-005 | Forecast Explorer | P0 | Dense forecast table |
| CORE-006 | Forecast Detail | P0 | Forecast investigation |
| CORE-007 | Forecast Chart | P0 | Actual vs forecast |
| CORE-008 | Forecast Uncertainty | P0 | Prediction intervals |
| CORE-009 | Demand Data | P0 | Historical demand |
| CORE-010 | Data Quality | P0 | Readiness and issues |

---

# 79. P1 - Intelligence

| ID | Epic | Priority | Scope |
|---|---|---:|---|
| INT-001 | Model Registry | P1 | Model lifecycle |
| INT-002 | Model Detail | P1 | Model metadata |
| INT-003 | Model Performance | P1 | Accuracy and bias |
| INT-004 | Backtesting | P1 | Historical evaluation |
| INT-005 | Scenario List | P1 | Scenario management |
| INT-006 | Scenario Builder | P1 | Assumption workflow |
| INT-007 | Scenario Comparison | P1 | Baseline comparison |
| INT-008 | Advanced Analytics | P1 | Forecast insights |

---

# 80. P1 - Operations

| ID | Epic | Priority | Scope |
|---|---|---:|---|
| OPS-001 | Planning Workspace | P1 | Operational decision surface |
| OPS-002 | Forecast Override | P1 | Controlled manual changes |
| OPS-003 | Exceptions | P1 | Attention queue |
| OPS-004 | Exception Detail | P1 | Investigation |
| OPS-005 | Approval Queue | P1 | Human approval |
| OPS-006 | Notifications | P1 | Actionable system alerts |
| OPS-007 | Monitoring | P1 | System health |

---

# 81. P1 - Governance

| ID | Epic | Priority | Scope |
|---|---|---:|---|
| GOV-001 | Audit Log | P1 | Decision history |
| GOV-002 | Decision Lineage | P1 | Data-to-action traceability |
| GOV-003 | Users | P1 | User administration |
| GOV-004 | Roles | P1 | RBAC |
| GOV-005 | Integrations | P1 | Data connections |
| GOV-006 | Settings | P1 | Enterprise configuration |

---

# 82. P2 - Platform Expansion

| ID | Epic | Priority | Scope |
|---|---|---:|---|
| PLAT-001 | API access | P2 | API keys/service access |
| PLAT-002 | Webhooks | P2 | Event integrations |
| PLAT-003 | Advanced exports | P2 | Export formats |
| PLAT-004 | Saved views | P2 | User-defined table views |
| PLAT-005 | Advanced search | P2 | Enterprise search |
| PLAT-006 | Advanced notification rules | P2 | User-configurable alerts |
| PLAT-007 | Advanced scheduling | P2 | Scheduled forecast workflows |

---

# 83. Sprint / Delivery Sequence

## Phase 0 - Architecture

Deliver:

```text
Repository
Frontend stack
Architecture
Tokens
App Shell
Authentication
React Bits registry
Core components
```

Exit criteria:

- User can sign in
- User can enter workspace
- App shell works
- Design tokens work
- Component primitives exist

---

## Phase 1 - Core Forecast

Deliver:

```text
Overview
Forecast Runs
Create Forecast
Processing
Forecast Explorer
Forecast Detail
Forecast Chart
Forecast Uncertainty
```

Exit criteria:

- User can create a forecast run
- User can monitor it
- User can inspect results
- User can understand forecast uncertainty

---

## Phase 2 - Data Reliability

Deliver:

```text
Demand Data
Data Sources
Data Quality
Freshness
```

Exit criteria:

- User can tell whether data is ready
- User can identify blocking issues
- User understands data freshness

---

## Phase 3 - Model Intelligence

Deliver:

```text
Model Registry
Model Detail
Model Performance
Backtesting
```

Exit criteria:

- User can understand which model produced a forecast
- User can inspect model performance
- User can compare versions

---

## Phase 4 - Planning

Deliver:

```text
Scenarios
Scenario Builder
Scenario Comparison
Planning Workspace
Overrides
Exceptions
```

Exit criteria:

- User can explore alternate assumptions
- User can make a controlled override
- User can understand impact
- Changes remain auditable

---

## Phase 5 - Governance

Deliver:

```text
Approvals
Audit
Decision lineage
RBAC
Integrations
Settings
```

Exit criteria:

- High-impact actions are permission-aware
- Approvals are traceable
- Changes are auditable
- Administrative settings are separated from personal preferences

---

# 84. Page Acceptance Checklist

Every production page must pass:

## Purpose

- Can the user understand the page within 5 seconds?

## Hierarchy

- Is primary information visually dominant?

## Controls

- Are filters clear?
- Are selects aligned?
- Are actions explicit?
- Are widths intentional?

## Tables

- Header/body aligned
- Numbers aligned
- Stable row geometry
- Actions aligned
- Dense but readable

## Copy

- Explicit labels
- Action-specific CTAs
- Minimal jargon
- No vague "Continue"
- No unnecessary buzzwords

## Workflow

- User knows what happens next
- User understands consequences
- User can recover from failure

## States

- Loading
- Empty
- Error
- Disabled
- Success
- Focus
- Hover
- Selected

## Accessibility

- Keyboard
- Focus
- Screen reader
- Color-independent meaning

## Responsive

- Desktop
- Tablet
- Mobile
- Preserved hierarchy

## Enterprise

- Permission aware
- Auditable
- Freshness visible
- Source visible where relevant

---

# 85. Product-Level Acceptance Criteria

The overall product is considered structurally ready when:

1. All P0 foundation systems are centralized.
2. No page creates one-off controls for standard interactions.
3. Navigation hierarchy matches the approved IA.
4. Forecast workflow can be completed end-to-end.
5. Data freshness appears wherever freshness affects decisions.
6. Forecast uncertainty is communicated clearly.
7. High-impact actions show consequences before execution.
8. Forecast overrides are attributable and auditable.
9. Role and permission checks are enforced.
10. Tables support enterprise-scale datasets.
11. Charts answer a clear question.
12. Every important quantitative visualization has a textual/data alternative.
13. Loading, empty, and error states are implemented.
14. Responsive behavior is explicit.
15. Keyboard and focus behavior are verified.
16. React Bits components are wrapped by Mesta components.
17. Raw React Bits styling is not allowed to become accidental product branding.
18. Shared domain primitives are used consistently across pages.
19. Audit history can explain consequential changes.
20. The product feels like a production operating system, not a visual demo.

---

# 86. Anti-Patterns to Reject

Reject implementation that introduces:

```text
Random gradients
Oversized rounded cards
Decorative charts
Visual-only progress bars
Unexplained badges
Color-only statuses
Generic "Something went wrong"
Generic "No data"
Generic "Continue"
Five competing primary buttons
Per-page spacing values
Per-page status colors
Duplicate DataTable implementations
Duplicate filter implementations
Untracked overrides
Hidden consequences
Invisible freshness
Consumer-style password signup
Unpermissioned administrative settings
```

---

# 87. Root-Cause Engineering Rule

When a bug appears in multiple places, fix the shared cause.

Examples:

```text
Five misaligned table rows
→ fix table grid

Five bad dropdown chevrons
→ fix Select component

Five inconsistent cards
→ fix Card anatomy

Five spacing inconsistencies
→ fix spacing token/component contract
```

Do not patch symptoms one by one.

---

# 88. Product Flow Over Visual Beauty

Always optimize:

```text
Understanding
→ Decision
→ Action
→ Feedback
→ Outcome
```

before:

```text
Decoration
→ Animation
→ Visual novelty
```

---

# 89. Enterprise Trust Model

For every consequential feature ask:

```text
What is happening?
Why is it happening?
What data is being used?
How fresh is the data?
What rule or model caused it?
What constraint applies?
What will change?
Who approved it?
What happened afterward?
```

---

# 90. Final Implementation Sequence

The recommended implementation order is:

```text
01. Repository initialization
02. Frontend architecture
03. React Bits Pro integration
04. Design tokens
05. Core UI primitives
06. App Shell
07. Authentication / SSO
08. Workspace context
09. Global navigation
10. DataTable
11. FilterBar
12. Status / freshness
13. Loading / empty / error
14. Overview
15. Forecast Runs
16. Create Forecast
17. Processing
18. Forecast Explorer
19. Forecast Detail
20. Forecast Chart
21. Uncertainty
22. Demand Data
23. Data Quality
24. Data Sources
25. Model Registry
26. Model Detail
27. Performance
28. Backtesting
29. Scenarios
30. Scenario Builder
31. Scenario Comparison
32. Planning
33. Override
34. Exceptions
35. Approval
36. Notifications
37. Monitoring
38. Audit
39. Lineage
40. Users / Roles
41. Integrations
42. Settings
43. API access
44. Cross-product QA
45. Accessibility audit
46. Responsive audit
47. Performance audit
48. Security audit
49. Regression testing
50. Production readiness review
```

---

# 91. Final Principle

The product should converge toward:

```text
Complex demand system
        ↓
Clear information architecture
        ↓
Stable design system
        ↓
Reusable enterprise components
        ↓
Predictable workflows
        ↓
Explainable forecasting
        ↓
Controlled planning actions
        ↓
Auditable decisions
        ↓
Enterprise-grade demand planning product
```

Do not optimize for screenshots.

Optimize for:

```text
Clarity
Operational confidence
Consistency
Scalability
Explainability
Traceability
User agency
```

---

# 92. Source Notes

## Master Prompt

The Mesta Enterprise Product Master Prompt v2 defines:

- Repository-first workflow
- Product-level audit
- Enterprise layout
- Data table system
- Data visualization requirements
- Workflow behavior
- Authentication / SSO
- User journey audit
- Cross-page consistency
- Responsive requirements
- Accessibility
- Frontend architecture
- React Bits integration rules
- Visual QA
- Regression testing
- Backlog structure
- Acceptance criteria
- Definition of Done

## Repository

`https://github.com/Demcruise/Mesta-Demand-Forecasting`

Current baseline inspected on 25 September 2026:

```text
README.md
LICENSE
```

No existing frontend implementation was verified at the time of backlog creation.

## React Bits Pro

Installation reference:

`https://pro.reactbits.dev/docs/installation`

Application UI reference:

`https://pro.reactbits.dev/docs/app-ui`

The current React Bits Pro Application UI documentation describes 300 Application UI blocks across 38 categories, including navigation, data, forms, overlays, authentication, workflows, monitoring, integrations, and related product UI patterns.

---

# 93. Validation Required Before Locking Product Requirements

The following should be confirmed with the product/domain team before implementation is considered semantically final:

1. Exact target industry and retail operating model
2. Exact user roles
3. Product hierarchy
4. Forecast grain
5. Forecast frequency
6. Forecast horizon
7. Data source systems
8. Historical demand definitions
9. Model types
10. Accuracy metrics
11. Confidence / prediction interval definition
12. Exception rules
13. Override policy
14. Approval rules
15. Scenario drivers
16. Planning workflow
17. Integration requirements
18. RBAC policy
19. Audit retention
20. Data privacy requirements
21. Export requirements
22. Required enterprise identity provider
23. Required deployment environment
24. Backend/API contracts
25. Production SLA expectations

Until these are confirmed, UX should use clearly labeled proposed terminology and mock data rather than implying unverified business rules.

---

# 94. Implementation Rule

Do not skip directly from:

```text
Feature request
```

to:

```text
Page code
```

Use:

```text
Requirement
 ↓
User goal
 ↓
User journey
 ↓
Information architecture
 ↓
Workflow
 ↓
Page structure
 ↓
Component contract
 ↓
State model
 ↓
Data contract
 ↓
Responsive behavior
 ↓
Accessibility
 ↓
Implementation
 ↓
QA
```

This is the required operating system for Mesta Demand Forecasting.
