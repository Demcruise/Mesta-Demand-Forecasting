# Mesta Demand Forecasting
## Frontend-Only Enterprise Product Backlog v3
### Indonesian UX Writing + White UI + React Bits + Frontend QA

**Version:** 3.0  
**Tanggal:** 25 September 2026  
**Repository:** `https://github.com/Demcruise/Mesta-Demand-Forecasting`  
**Scope:** Frontend only  
**Primary references:** Mesta Enterprise Product Master Prompt v2, current Mesta repository, React Bits Pro Application UI, Vestra dashboard visual reference

---

# 0. Scope

This backlog is intentionally **frontend-only**.

It covers:

- UX
- UI
- Information architecture
- Navigation
- Page hierarchy
- Frontend component architecture
- Design tokens
- Responsive behavior
- Frontend state handling
- Mock data presentation
- Client-side interactions
- Data table UX
- Data visualization
- Forms
- Wizards
- Drawers
- Dialogs
- Notifications
- Frontend permission presentation
- Accessibility
- Visual regression
- Responsive QA
- React Bits integration
- UX writing
- Indonesian terminology
- Frontend performance
- Component reuse
- Visual consistency
- Frontend documentation

Explicitly out of scope:

- Backend services
- Database implementation
- Server architecture
- Real forecasting engine
- Real model training
- Data warehouse
- API implementation
- Production authentication provider setup
- Server-side authorization
- Infrastructure
- Deployment infrastructure
- Backend telemetry pipelines
- Backend audit storage

The frontend may continue using the existing mock API and mock backend as a **presentation and interaction environment**.

Do not block frontend work on backend implementation.

---

# 1. Current Frontend Baseline

The repository already contains a substantial frontend implementation using:

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS v4
- Radix UI
- TanStack Query
- TanStack Table
- TanStack Virtual
- Recharts
- cmdk
- Vitest
- Playwright
- axe-core

Existing frontend architecture includes:

```text
src/
├── app/
├── components/
├── features/
├── hooks/
├── lib/
└── types/
```

Existing product areas include:

```text
Overview
Forecast Runs
Create Forecast
Forecast Processing
Forecast Explorer
Forecast Detail
Demand Data
Data Quality
Models
Backtesting
Scenarios
Planning
Exceptions
Approvals
Notifications
Monitoring
Audit
Users
Roles
Integrations
Settings
API UI
Saved Views
Scheduling UI
```

The focus of v3 is therefore:

> polish, consistency, clarity, frontend quality, and design-system enforcement.

---

# 2. Primary Frontend Goal

The final product should feel:

```text
White
Calm
Clear
Dense
Operational
Precise
Trustworthy
Easy to scan
```

It should not feel:

```text
Heavy
Gray
Over-designed
AI-demo-like
Marketing-like
Decorative
Visually noisy
```

---

# 3. Core Frontend Principles

## FE-001 — Clarity Over Decoration

Do not add a component because there is available space.

Ask:

```text
What does this help the user understand?
What decision does it support?
What action does it enable?
```

If the answer is unclear, remove it.

---

## FE-002 — Product Flow Over Visual Novelty

Prioritize:

```text
Understanding
↓
Decision
↓
Action
↓
Feedback
```

before:

```text
Animation
↓
Visual effect
↓
Decorative treatment
```

---

## FE-003 — White-First UI

Light mode uses:

```text
Canvas     #FFFFFF
Surface    #FFFFFF
Subtle     #FAFAFA
Muted      #F5F5F5
Border     #E5E7EB
```

Cards should not rely on gray backgrounds to separate themselves.

---

## FE-004 — Border Before Shadow

Default card treatment:

```text
background: white
border: 1px solid light-neutral
box-shadow: none
```

Shadow is reserved for:

- Dialog
- Drawer
- Popover
- Floating context

---

## FE-005 — Restrained Color

Majority of interface:

```text
white
near-black
neutral gray
thin borders
```

Accent is reserved for:

- active state
- selected state
- primary CTA
- focus
- forecast series
- important links

---

# 4. Visual Token Backlog

## V2-FE-001 — White Canvas

**Priority:** P0

Current canvas must be changed from a light gray surface to white.

### Required token

```css
--bg-canvas: #FFFFFF;
```

### Acceptance criteria

- Page background is white.
- No accidental gray body background remains.
- Light mode screenshots show white canvas.
- Sections do not introduce random gray backgrounds.

---

## V2-FE-002 — Surface Tokens

```text
surface          #FFFFFF
subtle           #FAFAFA
muted            #F5F5F5
hover            #F5F7FA
selected         semantic primary tint
```

### Acceptance criteria

- Components consume semantic tokens.
- No raw hex values are scattered inside page components.

---

## V2-FE-003 — Border System

Default:

```text
border-default  #E5E7EB
border-strong   #D0D5DD
border-subtle   #F0F2F4
```

### Rules

Use strong border only when separation needs emphasis.

Use subtle border for:

- table dividers
- nested content
- metadata blocks

---

## V2-FE-004 — Radius System

Recommended:

```text
xs  4px
sm  6px
md  8px
lg  10px
```

No global 16px+ rounded treatment.

---

## V2-FE-005 — Shadow System

```text
card       none
table      none
input      none
popover    subtle
drawer     medium
dialog     strong
```

---

## V2-FE-006 — Typography Roles

Keep:

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

### Typography rules

- Page title should be visible immediately.
- Numeric values use tabular numerals.
- Metadata should be visually quieter.
- Mono is only for technical identifiers.

---

# 5. Indonesian UX Writing System

## COPY-001 — Language

All user-facing product copy should default to Bahasa Indonesia.

Keep English only when:

- it is a technical identifier;
- it is an official third-party product name;
- translation would make the term less clear;
- the term is a commonly understood technical concept.

---

## COPY-002 — Tone

Target:

```text
Singkat
Natural
Langsung
Tidak kaku
Tidak terlalu teknis
```

Avoid:

```text
buzzword
jargon
kalimat panjang
corporate language
AI marketing copy
```

---

# 6. Terminology Dictionary

## Navigation

```text
Overview              → Ringkasan
Forecasting           → Perkiraan
Demand Data           → Data Permintaan
Models                → Model
Scenarios             → Skenario
Planning              → Perencanaan
Operations            → Operasional
Administration        → Administrasi
Monitoring            → Pemantauan
Audit Log             → Riwayat Aktivitas
Integrations          → Integrasi
Settings              → Pengaturan
```

## Forecast

```text
Forecast              → Perkiraan
Forecast Run          → Proses Perkiraan
Forecast Explorer     → Perkiraan Permintaan
Forecast Detail       → Detail Perkiraan
Forecast Horizon      → Periode Perkiraan
Previous Forecast     → Perkiraan Sebelumnya
Actual Demand         → Permintaan Aktual
Forecast Accuracy     → Akurasi Perkiraan
Forecast Error        → Selisih Perkiraan
Prediction Interval   → Rentang Perkiraan
Uncertainty           → Rentang Perkiraan
```

## Data

```text
Data Quality          → Kualitas Data
Data Source            → Sumber Data
Freshness             → Terakhir Diperbarui
Historical Demand     → Permintaan Historis
Missing Records       → Data Belum Lengkap
Duplicate Records     → Data Duplikat
Data Issue            → Masalah Data
```

## Planning

```text
Baseline              → Acuan
Override              → Ubah Perkiraan
Exception             → Perlu Ditinjau
Approval              → Persetujuan
Approve               → Setujui
Reject                → Tolak
Publish               → Terbitkan
Submit                → Kirim
```

---

# 7. CTA System

Never use a generic CTA when a specific action is possible.

Avoid:

```text
Continue
Next
Submit
Proceed
Confirm
```

Prefer:

```text
Pilih Periode
Pilih Model
Periksa Data
Tinjau Perkiraan
Jalankan Perkiraan
Simpan Skenario
Kirim untuk Persetujuan
Setujui Perubahan
Terapkan Perubahan
Lihat Hasil
Lihat Masalah Data
```

---

# 8. Error / Empty / Loading Copy

## Error

```text
Perkiraan tidak dapat dibuat.

12 produk memiliki data yang belum lengkap.

[Lihat Masalah Data]
```

## Empty

```text
Belum ada skenario.

Buat skenario untuk melihat kemungkinan perubahan permintaan.

[Buat Skenario]
```

## Loading

Use skeleton first.

When text is needed:

```text
Memuat data…
Menyiapkan hasil…
```

---

# 9. Global Navigation

## NAV-001 — Sidebar Information Architecture

Use:

```text
RINGKASAN

PERKIRAAN
  Proses Perkiraan
  Perkiraan Permintaan

DATA
  Produk
  Permintaan Historis
  Kualitas Data

MODEL
  Daftar Model
  Performa Model
  Uji Model

PERENCANAAN
  Rencana
  Skenario
  Perlu Ditinjau
  Persetujuan

SISTEM
  Integrasi
  Pemantauan
  Riwayat Aktivitas
  Pengaturan
```

### Acceptance criteria

- User can understand the product structure without opening every item.
- Sections are limited.
- Active route is obvious.
- Icons are consistent.
- Sidebar does not become a collection of unrelated links.

---

## NAV-002 — Search

Placeholder:

```text
Cari produk, perkiraan, atau skenario
```

Search categories:

```text
Produk
Perkiraan
Skenario
Model
Perlu Ditinjau
Persetujuan
```

Empty:

```text
Tidak ditemukan.

Coba kata lain.
```

---

## NAV-003 — Breadcrumb

Breadcrumb must show hierarchy, not duplicate the page title.

Example:

```text
Perkiraan
›
Perkiraan Permintaan
›
Kopi Arabika 250g
```

---

# 10. App Shell

## SHELL-001

Components:

```text
AppShell
AppSidebar
TopBar
WorkspaceSwitcher
Breadcrumbs
CommandMenu
NotificationCenter
UserMenu
PageContainer
```

### Visual rules

- white canvas;
- white header;
- thin bottom border;
- minimal shadow;
- stable sidebar width;
- stable top bar height.

---

## SHELL-002 — Mobile

Below desktop breakpoint:

- sidebar becomes drawer;
- top bar remains minimal;
- search becomes icon;
- secondary actions move to menu.

---

# 11. Workspace UI

Workspace selection remains a frontend flow using mock data.

Display:

```text
Ruang Kerja
Nama
Lingkungan
Peran
Status
```

Copy:

```text
Pilih Ruang Kerja
Pilih ruang kerja yang ingin digunakan.
```

Do not expose backend implementation details.

---

# 12. Overview Page

## PAGE-OVERVIEW-001

### Page title

```text
Ringkasan
```

### Subtitle

```text
Lihat kondisi permintaan dan hal yang perlu diperhatikan.
```

### Page structure

```text
Page Header
↓
Scope / Date
↓
Perlu Ditinjau
↓
Metric Strip
↓
Tren Permintaan
↓
Perubahan Terbesar
↓
Proses Perkiraan Terbaru
```

---

## PAGE-OVERVIEW-002 — Metric Strip

Maximum:

```text
4–5 metrics
```

Suggested:

```text
Total Permintaan
Akurasi Perkiraan
Perubahan
Produk Perlu Ditinjau
Data Terakhir
```

Do not show multiple metrics describing the same information.

---

## PAGE-OVERVIEW-003 — Attention Surface

Title:

```text
Perlu Ditinjau
```

Example:

```text
Kopi Arabika 250g

Perkiraan naik 31%
di atas batas tinjauan.

+2.840 unit
```

CTA:

```text
Tinjau
```

---

## PAGE-OVERVIEW-004 — Forecast Chart

Title:

```text
Tren Permintaan
```

Subtitle:

```text
Perbandingan permintaan aktual dan perkiraan.
```

Series:

```text
Aktual
Perkiraan
Rentang
```

---

# 13. Forecast Runs

## PAGE-RUNS-001

Title:

```text
Proses Perkiraan
```

Subtitle:

```text
Lihat proses yang sedang berjalan dan hasil perkiraan sebelumnya.
```

Primary CTA:

```text
Buat Perkiraan
```

Table:

```text
ID
Status
Cakupan
Model
Periode
Dibuat
Diperbarui
Aksi
```

---

## PAGE-RUNS-002 — Empty

```text
Belum ada proses perkiraan.

Buat proses perkiraan untuk mulai melihat hasil.

[Buat Perkiraan]
```

---

## PAGE-RUNS-003 — Table States

Must support:

```text
Loading
Empty
Error
Selected
Hover
Focus
Disabled action
Permission-limited action
```

---

# 14. Create Forecast Wizard

## PAGE-CREATE-001

Title:

```text
Buat Perkiraan
```

Description:

```text
Pilih data dan model untuk membuat perkiraan permintaan.
```

Steps:

```text
1. Cakupan
2. Periode
3. Rentang
4. Model
5. Periksa Data
6. Tinjau
```

---

## STEP-001 — Scope

Title:

```text
Pilih Cakupan
```

Helper:

```text
Tentukan produk atau kategori yang ingin diperkirakan.
```

CTA:

```text
Lanjut ke Periode
```

---

## STEP-002 — Period

Title:

```text
Pilih Periode
```

Helper:

```text
Pilih data historis yang akan digunakan.
```

---

## STEP-003 — Horizon

Title:

```text
Pilih Rentang Perkiraan
```

Helper:

```text
Tentukan berapa lama ke depan yang ingin diperkirakan.
```

---

## STEP-004 — Model

Title:

```text
Pilih Model
```

Helper:

```text
Pilih model yang akan digunakan.
```

Model row:

```text
Nama
Versi
Akurasi
Status
Diperbarui
```

---

## STEP-005 — Validation

Title:

```text
Periksa Data
```

Summary:

```text
Data siap
10 peringatan
2 masalah
```

Each validation item:

```text
Status
Masalah
Dampak
Tindakan
```

---

## STEP-006 — Review

Title:

```text
Tinjau Perkiraan
```

Show:

```text
Cakupan
Periode
Rentang
Model
Peringatan
```

CTA:

```text
Jalankan Perkiraan
```

---

# 15. Forecast Processing

## PAGE-PROCESSING-001

Title:

```text
Membuat Perkiraan
```

Progress:

```text
Menyiapkan data
Memeriksa data
Menjalankan model
Membuat hasil
Menyimpan hasil
```

Rules:

- progress must reflect mock job state;
- no fake percentage;
- failed state must include recovery CTA;
- completed state must link to results.

---

# 16. Forecast Explorer

## PAGE-EXPLORER-001

Title:

```text
Perkiraan Permintaan
```

Subtitle:

```text
Bandingkan perkiraan produk dan lihat perubahan yang perlu ditinjau.
```

Filter bar:

```text
Cari produk
Periode
Kategori
Lokasi
Status
Filter
Urutkan
```

---

## PAGE-EXPLORER-002 — Table

Columns:

```text
Produk
Aktual
Perkiraan
Perubahan
Rentang
Status
Diperbarui
```

Numeric columns align right.

---

## PAGE-EXPLORER-003 — Drawer

Drawer title:

```text
Detail Perkiraan
```

Sections:

```text
Ringkasan
Tren
Rentang
Perubahan
Model
Masalah
Riwayat
```

Drawer should preserve:

- filters;
- sort;
- pagination;
- list context.

---

# 17. Forecast Detail

## PAGE-DETAIL-001

Header:

```text
Kopi Arabika 250g
SKU-2048
```

Summary:

```text
Perkiraan
12.440 unit

Perubahan
+4,5%

Rentang
11.600–13.300 unit
```

---

## PAGE-DETAIL-002 — Chart

Chart should show:

```text
Aktual
Perkiraan
Perkiraan sebelumnya
Rentang
Hari ini
```

Tooltip:

```text
24 Sep 2026

Aktual
11.900

Perkiraan
12.440

Perubahan
+4,5%
```

---

# 18. Forecast Range UI

Title:

```text
Rentang Perkiraan
```

Description:

```text
Hasil perkiraan dapat berada di dalam rentang ini.
```

Visual:

```text
11.600 ───────── 12.440 ───────── 13.300
 minimum          perkiraan         maksimum
```

Do not show a statistical confidence percentage unless it is clearly meaningful and already part of the frontend data model.

---

# 19. Demand Data

## PAGE-DATA-001

Title:

```text
Data Permintaan
```

Routes/tabs:

```text
Produk
Permintaan Historis
Kualitas Data
Sumber Data
```

---

## PAGE-DATA-002 — Product Table

Columns:

```text
Produk
Kategori
SKU
Lokasi
Status
Diperbarui
```

Primary visual element should be product name, not technical ID.

---

## PAGE-DATA-003 — Historical Demand

Table:

```text
Tanggal
Produk
Lokasi
Permintaan
Status Data
Diperbarui
```

Use tabular numerals.

---

# 20. Data Quality

## PAGE-DQ-001

Title:

```text
Kualitas Data
```

Description:

```text
Periksa apakah data siap digunakan untuk membuat perkiraan.
```

Summary:

```text
Siap
Peringatan
Masalah
```

---

## PAGE-DQ-002 — Issue Detail

Example:

```text
12 produk memiliki data yang belum lengkap.

Masalah ini dapat memengaruhi hasil perkiraan.
```

CTA:

```text
Lihat Produk
```

---

# 21. Models

## PAGE-MODEL-001

Title:

```text
Daftar Model
```

Description:

```text
Lihat model yang tersedia dan kinerjanya.
```

Table:

```text
Model
Versi
Status
Akurasi
Bias
Diperbarui
```

---

## PAGE-MODEL-002 — Model Detail

Sections:

```text
Ringkasan
Detail Model
Performa
Uji Model
Batasan
Riwayat
```

---

## PAGE-MODEL-003 — Performance

Title:

```text
Performa Model
```

Metrics:

```text
Akurasi
Bias
Kesalahan
Rentang
```

Tooltip example:

```text
WAPE menunjukkan rata-rata selisih antara perkiraan dan permintaan aktual.
```

Keep detailed definitions in secondary information.

---

# 22. Backtesting

## PAGE-BACKTEST-001

UI label:

```text
Uji Model
```

Description:

```text
Bandingkan hasil model dengan data historis.
```

CTA:

```text
Jalankan Uji Model
```

Results:

```text
Ringkasan
Kesalahan
Per Segmen
Perbandingan Model
```

---

# 23. Scenarios

## PAGE-SCENARIO-001

Title:

```text
Skenario
```

Description:

```text
Buat dan bandingkan beberapa kemungkinan permintaan.
```

CTA:

```text
Buat Skenario
```

---

## PAGE-SCENARIO-002 — Builder

Steps:

```text
Acuan
Perubahan
Hasil
Simpan
```

Do not use overly technical step names.

---

## PAGE-SCENARIO-003 — Assumption Row

Display:

```text
Acuan
1.000 unit

Perubahan
+10%

Hasil
1.100 unit

Alasan
Promosi akhir bulan
```

---

## PAGE-SCENARIO-004 — Comparison

Title:

```text
Bandingkan Skenario
```

Table:

```text
Ukuran
Acuan
Skenario A
Perubahan
```

---

# 24. Planning

## PAGE-PLAN-001

Title:

```text
Perencanaan
```

Description:

```text
Tinjau hasil perkiraan sebelum digunakan dalam rencana.
```

Actions:

```text
Terima
Ubah
Tandai
Tolak
Kirim untuk Persetujuan
```

---

# 25. Forecast Override

## PAGE-OVERRIDE-001

User-facing term:

```text
Ubah Perkiraan
```

Form:

```text
Perkiraan Saat Ini
Perkiraan Baru
Perubahan
Alasan
Catatan
Lampiran
```

---

## PAGE-OVERRIDE-002 — Confirmation

```text
Anda akan mengubah perkiraan untuk 124 produk.

Saat ini
124.300 unit

Setelah diubah
131.800 unit

Perubahan
+6,0%

[Terapkan Perubahan]
[Batal]
```

---

# 26. Review Queue

## PAGE-REVIEW-001

Instead of user-facing "Exceptions":

```text
Perlu Ditinjau
```

Description:

```text
Item yang memerlukan pemeriksaan atau tindakan.
```

Table:

```text
Produk
Masalah
Dampak
Status
Diperbarui
```

---

## PAGE-REVIEW-002 — Detail

Show:

```text
Apa yang berubah
Mengapa ditandai
Dampak
Riwayat
Tindakan
```

---

# 27. Approval

## PAGE-APPROVAL-001

Title:

```text
Persetujuan
```

Description:

```text
Tinjau perubahan sebelum diterapkan.
```

Actions:

```text
Setujui
Tolak
Minta Perubahan
```

---

## PAGE-APPROVAL-002 — Detail

Structure:

```text
Yang berubah
Dampaknya
Alasan
Data terkait
Riwayat
```

High-impact confirmation:

```text
Anda akan menyetujui perubahan untuk 12 item.

Dampak perkiraan:
+3.240 unit

[Tolak]
[Minta Perubahan]
[Setujui Perubahan]
```

---

# 28. Notifications

## PAGE-NOTIFY-001

Notification titles:

```text
Perkiraan selesai
Data baru tersedia
Perlu persetujuan
Perkiraan gagal
Data belum diperbarui
```

Body example:

```text
Perkiraan untuk 2.480 produk sudah selesai.
```

CTA:

```text
Lihat Hasil
```

---

# 29. Audit UI

## PAGE-AUDIT-001

Title:

```text
Riwayat Aktivitas
```

Description:

```text
Lihat perubahan dan tindakan di ruang kerja.
```

Event:

```text
Rina mengubah perkiraan
24 Sep 2026 · 14:32
```

Detail:

```text
Sebelumnya
124.300

Setelah
131.800

Alasan
Promosi akhir bulan
```

---

# 30. Decision Lineage UI

## PAGE-LINEAGE-001

User-facing label:

```text
Sumber Keputusan
```

Flow:

```text
Data
↓
Kualitas Data
↓
Model
↓
Perkiraan
↓
Skenario
↓
Rencana
↓
Persetujuan
↓
Riwayat
```

The UI must make each node clickable where the route exists.

---

# 31. Settings UI

## PAGE-SETTINGS-001

Categories:

```text
Pribadi
Ruang Kerja
Perkiraan
Data & Integrasi
Persetujuan
Notifikasi
Pengguna & Akses
Keamanan
API
```

Do not mix personal preferences with workspace configuration visually.

---

# 32. Integrations UI

## PAGE-INTEGRATION-001

Treat integrations as a frontend management interface only.

Card:

```text
Nama
Status
Terakhir diperbarui
Sinkronisasi
```

Actions:

```text
Tes Koneksi
Sinkronkan Sekarang
Atur
Putuskan
```

Mock results must have realistic UI states.

---

# 33. Monitoring UI

## PAGE-MONITORING-001

Title:

```text
Pemantauan
```

Description:

```text
Pantau proses perkiraan dan kondisi sistem.
```

States:

```text
Normal
Perlu Perhatian
Gangguan
```

Do not expose backend implementation details to normal users.

---

# 34. Frontend Component Architecture

## COMPONENT-001 — Shell

```text
AppShell
AppSidebar
TopBar
WorkspaceSwitcher
Breadcrumbs
CommandMenu
NotificationCenter
UserMenu
PageContainer
```

---

## COMPONENT-002 — Navigation

```text
NavSection
NavItem
NavBadge
NavDivider
Breadcrumbs
CommandMenu
SearchButton
```

---

## COMPONENT-003 — Data

```text
DataTable
FilterBar
SearchInput
SortMenu
Pagination
ColumnManager
DensityToggle
ExportMenu
```

---

## COMPONENT-004 — Feedback

```text
StatusBadge
FreshnessIndicator
EmptyState
ErrorState
LoadingState
Skeleton
Toast
PermissionNotice
```

---

## COMPONENT-005 — Entity

```text
ProductIdentity
ForecastIdentity
ModelIdentity
ScenarioIdentity
UserIdentity
```

---

## COMPONENT-006 — Forecast

```text
ForecastMetric
ForecastDelta
ForecastChart
ForecastRange
ForecastStatus
ForecastScope
ForecastTable
```

---

## COMPONENT-007 — Workflow

```text
Wizard
WizardStep
StepIndicator
ValidationPanel
ReviewSummary
ConsequenceSummary
```

---

## COMPONENT-008 — Governance

```text
AuditEvent
ActivityItem
ApprovalStatus
ChangeSummary
ImpactSummary
DecisionLineage
```

---

# 35. Component Contract Rules

Every shared component must have:

```text
Purpose
Props
Variants
States
Accessibility
Responsive behavior
Usage example
```

---

# 36. State Matrix

Every important component must cover:

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
Permission limited
Stale
Unavailable
```

---

# 37. DataTable Frontend Backlog

## TABLE-001

Required:

- sorting
- filtering
- pagination
- selection
- sticky header
- column visibility
- column resizing
- density
- export
- keyboard navigation
- loading
- empty
- error
- responsive behavior
- virtualization where justified

---

## TABLE-002 — Numeric Alignment

Right-align:

```text
quantity
percentage
currency
delta
ratio
```

Use:

```css
font-variant-numeric: tabular-nums;
```

---

## TABLE-003 — Row Geometry

Every row:

```text
stable height
stable padding
stable icon slot
stable action slot
stable baseline
```

Long product names must not shift adjacent columns.

---

# 38. Filter System

## FILTER-001

Primary toolbar:

```text
Cari
Periode
Filter
Urutkan
```

Active:

```text
Kategori ×
Lokasi ×
Status ×
```

Requirements:

- progressive disclosure;
- active filter visibility;
- clear all;
- persistence;
- mobile-friendly filter sheet.

---

# 39. Drawer System

## DRAWER-001

Widths:

```text
400
480–560
560–640
```

Anatomy:

```text
Header
Summary
Evidence / Context
Related objects
Actions
```

Behavior:

- Escape closes.
- Focus trapped.
- Mobile becomes full screen.
- List state preserved.

---

# 40. Dialog System

## DIALOG-001

Use for:

- confirmation
- destructive action
- compact configuration
- bulk action
- high-impact action

Do not put a long workflow inside a dialog.

---

# 41. Chart System

## CHART-001

Every chart must answer one question.

Required:

```text
title
unit
timeframe
tooltip
legend where needed
annotation where useful
accessible alternative
```

---

## CHART-002 — Forecast Chart

Default palette:

```text
Actual       neutral
Forecast     primary accent
Previous     muted neutral
Range        accent with alpha
Scenario     secondary accent
```

No rainbow palette by default.

---

# 42. Chart Accessibility

Provide a text summary:

```text
Perkiraan periode:
25 Sep – 24 Okt

Perkiraan:
124.300 unit

Rentang:
116.100 – 133.700
```

---

# 43. Responsive System

## RESP-001

Required viewports:

```text
1440px
1280px
1024px
768px
390px
```

---

## RESP-002 — 1024

- sidebar can collapse;
- secondary columns reduce;
- filter bar compresses;
- drawers retain usable width.

---

## RESP-003 — 768

- sidebar becomes compact/drawer;
- secondary actions move;
- tables support controlled horizontal scroll;
- page hierarchy remains intact.

---

## RESP-004 — 390

- full-width content;
- mobile navigation;
- full-screen drawer;
- primary CTA visible;
- advanced filters become sheet;
- table reduces to priority columns.

Priority columns:

```text
Produk
Perkiraan
Perubahan
Status
```

---

# 44. Accessibility

## A11Y-001

Test manually:

```text
keyboard only
focus visible
screen reader
drawer
dialog
combobox
table
chart
mobile target size
```

Requirements:

- no keyboard trap;
- focus returns correctly;
- status cannot rely on color alone;
- charts have text alternative;
- tables use semantic headings;
- controls have labels.

---

# 45. Frontend Permission UX

Permission is represented in the UI.

States:

```text
Visible
Hidden
Disabled
Read-only
Permission Notice
```

Copy:

```text
Anda tidak memiliki akses untuk melakukan perubahan ini.
```

Do not show technical authorization terms.

---

# 46. Loading Strategy

Use skeletons that match final geometry.

Required skeletons:

```text
Page
Table
Card
Chart
Drawer
Detail
Timeline
Wizard
```

Do not use a blank screen while waiting.

---

# 47. Empty State Strategy

Every empty state must answer:

```text
Apa yang kosong?
Kenapa?
Apa yang bisa dilakukan?
```

Example:

```text
Belum ada skenario.

Buat skenario untuk melihat kemungkinan perubahan permintaan.

[Buat Skenario]
```

---

# 48. Frontend Error Strategy

Each error must include:

```text
Title
Short explanation
Recovery CTA
Optional secondary action
```

Example:

```text
Data tidak dapat dimuat.

Coba lagi atau ubah filter.

[Coba Lagi]
```

---

# 49. Frontend Demo Data Strategy

Mock backend remains the source for:

- deterministic datasets;
- loading state simulation;
- error state simulation;
- role simulation;
- permission simulation;
- mutation feedback.

Frontend backlog should not add backend requirements.

---

# 50. Frontend Performance

Focus on:

```text
render cost
table virtualization
chart rendering
bundle size
route transitions
large filter lists
drawer load behavior
```

Test datasets:

```text
1.000 rows
10.000 rows
50.000 rows
```

when the UI is designed to support those sizes.

Do not add optimization without evidence.

---

# 51. React Bits Strategy

React Bits is a frontend accelerator.

Use it selectively.

Potential mappings:

```text
App Shell
App Sidebar
Command Menu
Data Table
Dialog
Wizard
Notifications
Analytics
Filtering
Monitoring
```

---

# 52. React Bits Wrapper Architecture

Never:

```text
Page → Raw React Bits
```

Prefer:

```text
React Bits
↓
Mesta wrapper
↓
Domain component
↓
Page
```

Example:

```text
React Bits Data Table
↓
Mesta DataTable
↓
ForecastTable
```

---

# 53. React Bits Styling Rule

Do not blindly copy:

```text
color
radius
shadow
gradient
animation
typography
demo content
```

Mesta tokens always win.

---

# 54. React Bits State Audit

Every installed block must be checked for:

```text
Default
Hover
Focus
Selected
Disabled
Loading
Empty
Error
Success
Keyboard
Responsive
```

---

# 55. React Bits Selection Rule

Before using any block:

```text
Apa masalah user yang diselesaikan?
Apakah pola ini sudah ada?
Apakah lebih jelas dari existing component?
Apakah cocok dengan density enterprise?
Apakah accessible?
```

If not, do not add it.

---

# 56. Visual QA

## QA-VIS-001

Every page must pass:

```text
Canvas
Borders
Spacing
Typography
Alignment
Radius
Shadows
Buttons
Inputs
Tables
Charts
Status
Loading
Empty
Error
Responsive
Focus
```

---

# 57. Visual QA Reference Pages

At minimum:

```text
Sign In
Overview
Forecast Runs
Create Forecast
Forecast Explorer
Forecast Detail
Data Quality
Models
Scenarios
Planning
Review Queue
Approval
Audit
Settings
```

---

# 58. Visual Regression

Required baselines:

```text
1440 × 900
1280 × 800
1024 × 768
768 × 1024
390 × 844
```

Do not only test 1440px.

---

# 59. Manual Visual Review

Look for:

```text
gray canvas
unnecessary shadows
oversized cards
inconsistent radius
random borders
uneven spacing
too many colors
too many badges
oversized headings
weak hierarchy
duplicate labels
```

---

# 60. Copy QA

Every page must be checked for:

```text
Bahasa Indonesia
short sentences
consistent terminology
specific CTA
no unnecessary jargon
no "Continue"
no generic error
no generic empty state
no React Bits demo copy
```

---

# 61. Page Five-Second Test

Every page must pass:

### User can identify:

```text
Where am I?
What am I looking at?
What matters?
What should I do?
```

within approximately five seconds.

---

# 62. Frontend Regression Test Matrix

For every major page test:

```text
Normal content
Long content
Empty
Loading
Error
Disabled
Selected
Permission-limited
Narrow viewport
Large dataset
```

---

# 63. Role Simulation QA

Using existing frontend demo roles:

```text
Planner
Manager
Analyst
Administrator
Viewer
Suspended
```

Test:

```text
navigation
visible actions
disabled actions
read-only state
permission notice
deep link
```

This is frontend behavior testing only.

---

# 64. Route QA

Every frontend route must:

```text
render
show loading
handle empty
handle error
handle invalid route
handle missing permission
handle mobile
```

---

# 65. URL State UX

Lists should preserve:

```text
search
filters
sort
page
date range
selected entity
```

Returning from detail should preserve context.

---

# 66. Saved View UX

UI should allow:

```text
Simpan Tampilan
```

Store:

```text
filter
sort
columns
density
date range
```

Frontend should clearly indicate active saved view.

---

# 67. Export UX

User-facing label:

```text
Ekspor
```

Menu:

```text
Ekspor CSV
Ekspor Excel
```

Confirmation:

```text
2.480 baris akan diekspor.
```

The export UI must respect current visible/filter state.

---

# 68. Bulk Actions

Selection bar:

```text
12 dipilih
```

Actions should appear according to frontend permission state and selected object state.

High-impact actions show consequence dialog.

---

# 69. Frontend Notification Center

Requirements:

- unread state;
- read state;
- filters;
- deep link;
- empty state;
- loading;
- error;
- mobile layout.

Copy:

```text
Tidak ada pemberitahuan baru.
```

---

# 70. Frontend Form System

All forms must:

```text
show labels
show helper text only when useful
validate inline
show error next to field
preserve input on recoverable errors
support keyboard
```

Do not move users to a separate error page for a field-level error.

---

# 71. Frontend Wizard System

Wizard must show:

```text
current step
completed steps
remaining steps
back
next action
validation
```

Step labels should be user-oriented.

Good:

```text
Pilih Data
Pilih Periode
Pilih Model
Periksa
Tinjau
```

Bad:

```text
Configuration
Execution Parameters
Validation Context
```

---

# 72. Frontend Detail Pattern

All detail surfaces should use:

```text
Summary
Context
Evidence
Related items
Actions
History
```

Actions should stay visually separate from evidence.

---

# 73. Frontend State Language

Status labels:

```text
Draft
Menunggu
Sedang diproses
Selesai
Perlu ditinjau
Disetujui
Ditolak
Gagal
Dijeda
Diterbitkan
```

Avoid raw backend status names in the UI.

---

# 74. Frontend Copy Dictionary

Centralize:

```text
navigation labels
status labels
button labels
error labels
empty state labels
common tooltip labels
```

Do not keep repeated wording scattered across page files.

---

# 75. Design System Documentation

Create or maintain frontend documentation for:

```text
Color
Typography
Spacing
Radius
Borders
Shadows
Button
Input
Select
Table
Filter
Badge
Status
Freshness
Chart
Drawer
Dialog
Wizard
Notification
Navigation
```

Each component documentation must include:

```text
When to use
Anatomy
Variants
States
Accessibility
Responsive behavior
```

---

# 76. Frontend File Architecture

Recommended:

```text
src/
├── app/
├── components/
│   ├── ui/
│   ├── shell/
│   ├── tables/
│   ├── charts/
│   ├── feedback/
│   ├── entities/
│   ├── forecasting/
│   ├── governance/
│   └── workflows/
├── features/
│   ├── overview/
│   ├── forecasting/
│   ├── demand-data/
│   ├── models/
│   ├── scenarios/
│   ├── planning/
│   └── administration/
├── hooks/
├── lib/
└── types/
```

Keep route files thin.

---

# 77. Frontend Domain Ownership

Shared domain components:

```text
Price-like values
Forecast values
Delta
Product identity
Forecast identity
Model identity
Scenario identity
Status
Freshness
Audit event
Approval state
```

One concept should not have five separate visual implementations.

---

# 78. Frontend State Management

Use:

### Server-like mock state

For:

```text
forecasts
runs
models
scenarios
exceptions
approvals
data quality
notifications
```

### Local UI state

For:

```text
drawer
dialog
tabs
temporary form values
column visibility
density
```

### URL state

For:

```text
search
filter
sort
pagination
selected item
date range
```

---

# 79. Page Container Rules

Use a shared page container.

Rules:

```text
stable max width
stable horizontal padding
stable vertical spacing
```

Do not set unique page margins.

---

# 80. Section Spacing

Recommended:

```text
icon → text           8px
label → field         6–8px
field → field         16px
component → component 16–24px
section → section     32px
major page sections   40–48px
```

---

# 81. Frontend Anti-Pattern Audit

Reject:

```text
random hex colors
random spacing
random card radius
random shadows
gradient headers
decorative metrics
unnecessary charts
multiple primary buttons
long card descriptions
uppercase-heavy UI
English/Indonesian mixed labels
raw React Bits blocks
visual-only status
mobile as afterthought
```

---

# 82. Performance UX

Do not show a spinner for tiny interactions.

Use:

```text
instant state update
skeleton
optimistic UI where safe
progress state for long operation
```

For long mock operations:

```text
Menyiapkan data…
Memeriksa data…
Membuat hasil…
```

---

# 83. Animation Rules

Animation should communicate:

```text
opening
closing
transition
progress
state change
```

Avoid:

```text
floating cards
constant pulse
decorative loops
large transform
```

Respect reduced motion.

---

# 84. Focus Management

Required:

- dialog opens → focus enters;
- dialog closes → focus returns;
- drawer closes → trigger regains focus;
- route change → heading or main landmark receives meaningful focus when appropriate;
- keyboard navigation remains predictable.

---

# 85. Mobile Interaction

Touch target should remain comfortably tappable.

Primary actions should never become invisible merely because the screen is narrow.

Secondary actions can move into menus.

---

# 86. Chart Mobile Behavior

On mobile:

- preserve tooltip interaction;
- reduce decorative axis labels;
- preserve unit;
- preserve critical trend;
- allow horizontal chart scroll only when necessary;
- do not squeeze five series into unreadable space.

---

# 87. Table Mobile Behavior

Prefer:

```text
priority columns
+
detail drawer
```

instead of shrinking every column.

---

# 88. Form Mobile Behavior

Fields become single column.

Actions:

```text
Back
Primary action
```

Do not create multi-column forms at 390px.

---

# 89. Frontend Testing

## Unit

Test:

```text
formatting
permissions presentation
status mapping
copy mapping
date formatting
number formatting
table state
```

## E2E

Test:

```text
auth demo
navigation
forecast wizard
drawer
bulk action
approval UI
mobile navigation
```

## Accessibility

Use axe plus manual review.

## Visual

Use screenshot regression.

---

# 90. CI Frontend Quality Gate

Frontend CI should verify:

```text
typecheck
unit tests
build
E2E
accessibility
visual regression where configured
```

No backend deployment work is included in this backlog.

---

# 91. Frontend Production Simulation

Before final handoff, run the app using the existing mock system under:

```text
slow reads
failed reads
failed writes
empty datasets
long data
large tables
different roles
narrow screen
```

The UI must remain understandable.

---

# 92. Visual Review Sequence

Review in this order:

```text
1. App Shell
2. Overview
3. Forecast Explorer
4. Forecast Detail
5. Create Forecast
6. Demand Data
7. Data Quality
8. Models
9. Scenarios
10. Planning
11. Review Queue
12. Approval
13. Audit
14. Settings
```

Do not polish isolated pages before the global system.

---

# 93. Frontend Priority Backlog

## P0 — Foundation

```text
FE-P0-001 White canvas
FE-P0-002 Neutral-first tokens
FE-P0-003 Border system
FE-P0-004 Radius system
FE-P0-005 Shadow reduction
FE-P0-006 Typography QA
FE-P0-007 Indonesian terminology
FE-P0-008 CTA system
FE-P0-009 Error/empty/loading copy
FE-P0-010 Sidebar IA
FE-P0-011 Global search
FE-P0-012 App shell polish
```

---

## P0 — Core Pages

```text
FE-P0-013 Overview polish
FE-P0-014 Forecast Runs polish
FE-P0-015 Create Forecast polish
FE-P0-016 Processing polish
FE-P0-017 Forecast Explorer polish
FE-P0-018 Forecast Detail polish
FE-P0-019 Demand Data polish
FE-P0-020 Data Quality polish
```

---

## P1 — Intelligence

```text
FE-P1-001 Model Registry
FE-P1-002 Model Detail
FE-P1-003 Model Performance
FE-P1-004 Backtesting
FE-P1-005 Scenario List
FE-P1-006 Scenario Builder
FE-P1-007 Scenario Comparison
```

---

## P1 — Operations

```text
FE-P1-008 Planning
FE-P1-009 Forecast Override
FE-P1-010 Perlu Ditinjau
FE-P1-011 Approval
FE-P1-012 Notifications
FE-P1-013 Monitoring
```

---

## P1 — Governance

```text
FE-P1-014 Audit UI
FE-P1-015 Decision Lineage
FE-P1-016 Users
FE-P1-017 Roles
FE-P1-018 Integrations UI
FE-P1-019 Settings UI
```

---

## P1 — Quality

```text
FE-P1-020 Responsive QA
FE-P1-021 Manual accessibility
FE-P1-022 Visual regression
FE-P1-023 Large-data QA
FE-P1-024 Role simulation QA
FE-P1-025 Copy consistency QA
FE-P1-026 Performance profiling
```

---

## P1 — React Bits

```text
FE-P1-027 React Bits registry
FE-P1-028 Select blocks
FE-P1-029 Mesta wrappers
FE-P1-030 State audit
FE-P1-031 Responsive audit
```

---

# 94. Page-Level Acceptance Checklist

Each page passes only when:

```text
[ ] Page purpose obvious
[ ] Page title clear
[ ] Subtitle useful
[ ] White canvas
[ ] Correct border
[ ] Correct radius
[ ] Correct spacing
[ ] Correct type hierarchy
[ ] Accent controlled
[ ] Primary CTA clear
[ ] Loading state
[ ] Empty state
[ ] Error state
[ ] Disabled state
[ ] Permission state
[ ] Keyboard support
[ ] Focus support
[ ] Responsive
[ ] Mobile checked
[ ] Visual regression
[ ] Indonesian copy
```

---

# 95. Component Definition of Done

```text
[ ] Clear purpose
[ ] Shared token usage
[ ] No arbitrary colors
[ ] No one-off spacing
[ ] Complete state matrix
[ ] Keyboard
[ ] Focus
[ ] Responsive
[ ] Accessible label
[ ] Unit/E2E coverage where useful
[ ] Documented
```

---

# 96. Workflow Definition of Done

```text
[ ] Clear entry
[ ] Clear context
[ ] Progress visible
[ ] Validation visible
[ ] Back works
[ ] Recovery works
[ ] Success visible
[ ] Primary CTA explicit
[ ] Consequence visible
[ ] Mobile behavior
[ ] Accessibility
```

---

# 97. Final Visual Formula

```text
White canvas
+
Thin borders
+
Strong typography
+
Tight spacing
+
Small radius
+
Minimal shadow
+
Restrained accent
+
Semantic status
+
Simple charts
=
Mesta Frontend
```

---

# 98. Final UX Writing Formula

```text
Apa yang terjadi?
+
Kenapa?
+
Apa yang harus dilakukan?
=
Copy yang jelas
```

Example:

```text
Perkiraan gagal dibuat.

12 produk memiliki data yang belum lengkap.

[Lihat Masalah Data]
```

---

# 99. Final Product Experience

The frontend should make users understand:

```text
Apa yang terjadi?
Mengapa?
Data mana yang sedang dilihat?
Apa yang berubah?
Apa dampaknya?
Apa yang harus saya lakukan?
```

without requiring them to understand the implementation behind the system.

---

# 100. Final Frontend Principle

Do not optimize for:

```text
screenshot
wow effect
visual novelty
feature count
```

Optimize for:

```text
clarity
scanability
consistency
confidence
operational speed
simple language
predictable interaction
```

---

# 101. Final Frontend Master Flow

```text
User enters
   ↓
Understands scope
   ↓
Sees what matters
   ↓
Investigates
   ↓
Takes action
   ↓
Sees result
   ↓
Returns to context
```

This is the frontend target state for Mesta Demand Forecasting.

---

# 102. Frontend Handoff Gate

The frontend backlog is complete when:

```text
[ ] White UI is consistent
[ ] Indonesian copy is complete
[ ] Global components are consistent
[ ] All major pages use shared tokens
[ ] Forecast workflow is understandable
[ ] Tables are enterprise-ready
[ ] Charts are readable
[ ] Drawers/dialogs are predictable
[ ] Mobile is intentional
[ ] Accessibility is reviewed
[ ] Visual regression passes
[ ] Role simulation passes
[ ] Large-data scenarios remain usable
[ ] React Bits is properly wrapped
[ ] No major visual anti-pattern remains
```

---

# 103. Final Statement

Mesta Demand Forecasting should feel like a serious enterprise planning product without making the user feel that they are operating a complicated enterprise system.

The frontend should make complexity feel manageable through:

```text
clear hierarchy
simple Indonesian copy
white canvas
restrained color
predictable components
meaningful data visualization
strong spacing
reusable patterns
good states
accessible interaction
```

The goal is not to make the application look busy or impressive.

The goal is to make the next decision obvious.