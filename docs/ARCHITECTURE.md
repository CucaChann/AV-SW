# AV-SW Architecture

## Product shape
AV-SW is a hybrid, desktop-first application.

- The primary user experience is a native desktop program built with Tauri.
- Active project work is local-first and must remain usable without internet access.
- A cloud-backed product knowledge library is planned for manufacturer data, documentation, revision history, and optional collaboration.
- Frequently used manufacturer documentation can be cached locally for offline use.

## Desktop frontend
- Tauri 2
- React
- TypeScript
- Vite
- PDF.js for architectural PDF rendering
- React-Konva planned for the editable design layer
- Tailwind CSS / shadcn/ui planned for reusable UI components

The same React frontend should remain browser-runnable during development. Browser mode is a fallback/development mode, not the long-term primary product.

## Local persistence
- SQLite inside the Tauri application
- Local project metadata and design state
- Current project revisions
- Placed devices and geometry
- Project-specific vendor quotes and documents
- Offline product/document cache

Initial SQLite tables:
- projects
- project_files
- app_settings

The schema will expand as design objects are implemented.

## Cloud knowledge layer — planned
The cloud layer is not required for the first desktop milestone.

Planned responsibilities:
- Master product catalog
- Manufacturer documentation references
- Product revision history
- Structured compatibility data
- Current/reference pricing metadata where permitted
- Optional project backup and team collaboration

Potential free-tier development backend:
- PostgreSQL / Supabase
- Object storage when needed

The product must not require cloud connectivity to open and edit an already-local project.

## Product/document ingestion
Manufacturer documents should be processed into structured product records while retaining the original source document as evidence.

Example:

Manufacturer PDF/CAD/manual
→ ingestion
→ structured product record
+ original source file/reference
+ source version/date
+ last verified timestamp

The software should not need to re-read an entire PDF merely to know common product properties already extracted and verified.

## Core domain objects
- Project
- ProjectRevision
- FloorPlan
- Floor
- Room
- Wall
- Opening
- Elevation
- Product
- ProductFamily
- ProductDocument
- PlacedDevice
- LightingFixture
- LightingZone
- QTLRun
- Shade
- Keypad
- NetworkDevice
- Speaker
- Display
- Mount
- Backbox
- CableRun
- DesignIssue
- Recommendation
- Approval

## Design architecture
1. Understand the architectural space.
2. Capture room/client intent.
3. Generate design candidates.
4. Apply deterministic geometry and compatibility rules.
5. Reference source-backed product data.
6. Explain recommendations.
7. Require human approval.
8. Generate downstream documentation and commercial outputs.

AI should assist interpretation, extraction, comparison, and explanation. Deterministic rules should own critical compatibility and validation checks.

## Offline philosophy
Local-first does not mean every industry document is permanently stored on every workstation.

AV-SW should support:
- on-demand download of manufacturer documents,
- project-level "Make available offline",
- product-level "Pin for offline",
- local caching of documents used by active projects,
- graceful operation when the cloud library is unavailable.
