# Roadmap

## V0.0 — Hybrid desktop foundation — current
- Migrate the UI from Next.js to React + Vite
- Add Tauri desktop shell
- Keep browser development mode
- Add native Windows PDF selection
- Add local SQLite foundation
- Preserve PDF pan/zoom/page navigation
- Define local/cloud storage boundary

## V0.1 — Drawing intelligence and real local project workflow
- PDF + DXF import
- DXF layer/entity analysis
- DXF room-label detection
- First-draft recommendation generation
- Interactive system workspaces (Lighting, Lutron, QTL, Shades, Network, Audio, Video, Infrastructure)
- Preliminary BOM generation from drawing analysis and design rules
- Retrofit / Upgrade mode with Add / Replace / Reuse / Verify scope
- Editable existing-conditions survey
- Survey-aware retrofit delta BOM
- BOM CSV export
- DWG import planned after DXF pipeline stabilizes
- New Project
- Open Project
- Recent Projects
- Local project metadata in SQLite
- Import/reference floorplan
- Autosave project state
- Reopen project after application restart
- Manual scale calibration
- Project/revision selector

## V0.2 — Editable design layer
- React-Konva overlay
- Layer selector
- Device library
- Place/move/rotate/delete symbols
- Device properties
- Manual room assignment
- Persist design objects in SQLite

## V0.3 — Structured design data
- Product library
- Product-to-symbol relationships
- Automatic schedules
- BOM generation
- Cable/drop schedule
- QTL run length and wattage calculation
- Basic compatibility validation

## V0.4 — Design assistance
- Room recognition assistance
- Lighting recommendations
- UniFi AP candidate placement
- Speaker recommendations
- Lutron control recommendations
- QTL run recommendations

## V0.5 — Design Check
- Missing power/data/wiring checks
- PoE budget checks
- Amplification checks
- Lutron load/control checks
- QTL driver checks
- Coordination conflicts

## V0.6 — Revision intelligence
- Drawing revision comparison
- Quote/BOM mismatch detection
- Stale vendor quote warnings
- TBD/approval tracking

## V0.7 — Vendor quote ingestion
- Parse Lutron/QTL/Leon/other vendor quote PDFs
- Match vendor line items to design objects
- Flag mismatches

## V0.8 — Cloud product knowledge
- Shared manufacturer catalog
- Product/document versioning
- On-demand document download
- Pin for offline
- Make project available offline
- Optional project backup/sync

## V1.0
Professional desktop-first design, coordination, validation, scheduling, and quoting platform.
