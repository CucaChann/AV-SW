# Revision and Coordination System

## Goal
Treat revisions as first-class project data.

## Track
- Drawing revision
- Date
- Author/source
- Changed objects
- Added/removed devices
- Geometry changes
- Product/model changes
- Quote/BOM revision associated with each design revision
- Approval status

## Mismatch examples
- Current shade pocket dimension differs from an older Lutron quote.
- Current QTL run length differs from vendor quote footage.
- TV size changed but Leon/Future Automation package was not requoted.
- AP removed from plan but still present in BOM.

## Issue states
- Critical before release
- Awaiting Architect / Interior Designer
- Client decision required
- Field verify
- Vendor requote required
- Resolved

## Release rule
Before a design is released, the software should identify stale quotes, unresolved critical TBDs, and mismatches between current design and commercial documents.