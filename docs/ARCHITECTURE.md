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

### Project files (.avsw)
Each project is one `.avsw` file the user saves anywhere, like a CAD file. It can be
copied to a server, backed up or sent to a colleague. The file is a ZIP container:

- `manifest.json`: format name and version, and the AV-SW version that saved it
- `project.json`: all project data (mode, survey, tools, draft, drawing list)
- `drawings/<id>.pdf|dxf`: the original drawing files, stored uncompressed

Code: `src/lib/projectFile.ts` (format), `src/lib/projectIO.ts` (dialogs and file
access), `src-tauri/src/files.rs` (native read, and atomic write via a temporary
file and rename). Opening a newer format version is refused with a clear message
instead of losing data. Every saved value is checked against the type of its default
(`src/lib/sanitize.ts`); invalid values are reset and the user is told which fields
changed, so a damaged file opens instead of crashing the workspace.

### Recovery copy
The open project, drawings included, is copied to the app's IndexedDB shortly after
every change (`src/lib/recovery.ts`). Each drawing is stored once when it is added;
later updates only write the small project data, so large drawing sets don't stall
the UI. After a crash, forced shutdown or reload, AV-SW
reopens exactly where the user left off, unsaved changes included. Choosing
"Don't Save" when closing discards the copy.

### SQLite
The app-level SQLite database (`av-sw.db`) is reserved for data that belongs to the
installation rather than to one project: settings, the offline product/document
cache and the local product library. Initial tables:
- projects
- project_files
- app_settings

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
