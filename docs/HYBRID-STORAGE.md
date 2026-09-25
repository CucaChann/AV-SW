# Hybrid Storage Strategy

AV-SW is local-first for project work and cloud-backed for shared product intelligence.

## Local by default

The desktop application should keep active work available without internet:

- project metadata
- current floorplans
- revisions
- placed devices
- rooms and geometry
- design issues
- project-specific quotes
- autosave state
- recently used manufacturer documents
- user preferences

SQLite is the local structured-data store.

Project-specific files will be stored in an AV-SW-managed local project workspace in a later milestone.

## Cloud-backed knowledge library

The cloud library is intended for information that benefits from being shared and updated centrally:

- manufacturer product catalog
- product families and sub-brands
- current and historical product revisions
- specifications
- compatibility relationships
- manufacturer documentation references
- CAD/Revit/IES references
- source verification dates
- reference pricing metadata where permitted

The first desktop version must not depend on the cloud library to open an existing local project.

## Offline cache

AV-SW should eventually support:

### Pin product for offline
Cache the documentation and structured data for one product/family.

### Make project available offline
Resolve every product used by a project and cache the relevant documentation.

### Cache management
Show:
- cached size
- last verified date
- source revision
- stale/newer-cloud-version status
- remove-from-cache controls

## Project-document ingestion

Project documents such as vendor quotes are treated differently from global manufacturer documents.

Example:

Example Residence / Lutron Shade Quote REV.1
→ stored with the Example Residence project
→ structured line-item extraction
→ linked to the drawing revision it was based on
→ compared with the current design
→ original file retained as source evidence

## Manufacturer-document ingestion

Example:

Leon HZ44UX specification PDF
→ source document/reference
→ structured product record
→ dimensions / electrical / mounting / compatibility fields
→ product revision/date
→ last verified timestamp

The structured record is used for fast design checks. The original source remains available for verification.

## Conflict policy

If local cached structured data and a newer cloud record disagree:
- never silently overwrite a project's historical design basis,
- show the version difference,
- let the user explicitly update/revalidate the product,
- preserve the original project revision history.
