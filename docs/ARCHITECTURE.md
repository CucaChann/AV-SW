# Initial Architecture

## Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- React-Konva for floorplan interaction
- PDF.js for architectural PDF rendering

## Backend
- Python
- FastAPI
- Shapely for geometry
- PyMuPDF for PDF processing

## Data
- PostgreSQL
- PostGIS for rooms, walls, points, lines, polygons, and spatial checks
- Supabase free tier may be used initially for hosted Postgres/auth/storage

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
5. Reference product data.
6. Explain recommendations.
7. Require human approval.
8. Generate downstream documentation and commercial outputs.

AI should assist interpretation and explanation. Deterministic rules should own critical compatibility and validation checks.