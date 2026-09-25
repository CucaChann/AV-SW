# Product Library (v1)

The product library holds manufacturer facts, the relationships between
products, and the deterministic rules that check designs. It is the source the
design checks, BOM and recommendations read from, so every value in it must be
traceable to a manufacturer document.

`docs/PRODUCT-DATABASE.md` lists the fields we eventually want. This document
describes what is implemented and how to add to it.

## Where it lives

| Path | What |
| --- | --- |
| `data/library/*.json` | Library data, one file per manufacturer (plus `manufacturers.json`) |
| `src/library/schema.ts` | Record shapes (zod), checked when files load |
| `src/library/specs.ts` | Spec keys, their types and units (controlled vocabulary) |
| `src/library/validate.ts` | Cross-record checks: references, units, sources, review rules |
| `src/library/rules/` | Deterministic rule engines, one per rule `kind` |
| `src/library/*.test.ts` | Tests; they also validate every file in `data/library/` |

Run `npm run validate:library` to check the data. CI runs it on every pull request.

**Why JSON files in git for now:** both AIs and people change the library through
pull requests. Changes show up as readable diffs, CI blocks bad data, and git keeps
the history. Later milestones load the same records into SQLite for the desktop
app (offline cache) and into the cloud catalog (V0.8). The schema carries over;
only the storage changes.

## Record types

| Record | Meaning | Example |
| --- | --- | --- |
| `manufacturers` | Who makes it | Lutron, DMF, Savant |
| `sources` | A page or document that facts come from, declared once | DMF "Next Generation Dimming" page |
| `ecosystems` | A control platform that products belong to | HomeWorks QSX |
| `families` | A product line; specs shared by every model | Palladiom keypads, DMF DRD2 |
| `products` | One orderable model, exactly as printed | (none yet; see "Next steps") |
| `requirements` | What an item needs to work, and what satisfies it | Palladiom keypads need a HomeWorks QSX processor |
| `compatibility` | Whether two items work together, with conditions and the rules that must pass | DMF DRD2 on Lutron dimming, conditional |
| `alternatives` | What can stand in for an item, and the trade-offs | (none yet) |
| `rules` | Parameters for a deterministic check implemented in `src/library/rules/` | Dimmer LED derating, 50% |

Relationships point at items with a **selector**: any combination of
`manufacturerId`, `ecosystemId`, `familyId` and `productId`, where every field
given must match. That lets a relationship cover one model, a whole family, or
everything from a manufacturer.

## Data rules

1. **Every value has a source.** Specs are `{ value, unit, source }`, and every
   record has a `source`. A `sourceRef` names a declared source and can add a
   `locator` (page, table, section) and an `excerpt`.
2. **Excerpts are verbatim.** Copy text exactly from the source, or leave
   `excerpt` out. Never paraphrase inside `excerpt`.
3. **No invented values.** If a value isn't in a source you have read, leave it
   out and say so in `review.notes`. An empty field is correct; a guessed one is
   a defect.
4. **Specs use registered keys.** Keys, types, units and allowed values come from
   `src/library/specs.ts`. To add one, add it there in the same pull request.
5. **Every record is `proposed` or `verified`.**
   - `proposed`: entered by an AI or a person, not yet checked against the source.
   - `verified`: a person checked every value against the cited source.
     `verifiedBy` must be a person (the validator rejects AI agent names), and
     every source the record cites needs an `accessedOn` date.
6. **No dealer pricing or dealer-portal documents** without confirming the dealer
   agreement allows it. Rep price lists go under `price-list` sources.
7. **No client information.** Project quotes and client documents never go in
   `data/library/`; this repository is public.

## Review workflow

```
AI or person reads a spec sheet
  → adds records with status "proposed" on its own branch
  → opens a pull request (CI validates the data)
  → a person opens each cited source and checks every value
  → sets the source's accessedOn, sets review to "verified"
     with verifiedBy / verifiedOn, and merges
```

The app and rules engines can read `proposed` data, but results built on it are
marked unverified (see below) and must not be issued as final.

## How rules use the data

Rules own compatibility and capacity decisions; AI text never overrides them.
Each rule `kind` has an engine in `src/library/rules/` that takes library records
and returns a result with:

- the numbers (capacity, load, max units, pass/fail),
- an explanation a designer can read,
- the source references it relied on, and
- `verified: true` only if the rule and every record it read are verified.

## Worked example: DMF DRD2 on a Lutron dimmer

Data (`data/library/dmf.json`):

- Compatibility `dmf-drd2-with-lutron-dimming`: DRD2 works with Lutron dimming,
  **conditionally**. It must pass rule `dmf-dimmer-led-derating`, and the specific
  dimmer should be confirmed against DMF's compatibility documentation.
- Rule `dmf-dimmer-led-derating` (kind `dimmer-led-capacity`): a dimmer with no
  published LED rating is held to `0.5` × its rated load.

Engine (`src/library/rules/dimmerLedCapacity.ts`), for a dimmer rated 600 W
(incandescent) with no LED rating, driving modules drawing 12.5 W each:

```
capacity  = 600 W × 0.5 = 300 W        (basis: derated-incandescent-rating)
max units = floor(300 / 12.5) = 24
24 modules → 300.0 W  ✓ within capacity
25 modules → 312.5 W  ✗ over capacity
```

If the dimmer publishes an LED rating (for example 250 W), the engine uses that
rating instead and does not derate. If either the rating or the module wattage is
missing, the result is "cannot check", not a guess.

The 600 W dimmer and 12.5 W module above are **test inputs**
(`src/library/rules/dimmerLedCapacity.test.ts`), not library records. Real models
get added with their spec-sheet sources.

## Current state of the seed data

Everything in `data/library/` is `proposed` by Claude and needs a person to verify it:

- **Lutron:** the HomeWorks QSX ecosystem, plus families for processors, Palladiom
  keypads, Sivoia QS shades and Ketra, sourced to the Lutron submittal pages
  already listed in `data/manufacturer-sources.json`, and one requirement
  (Palladiom needs a HomeWorks QSX processor). No model numbers or numeric specs
  yet.
- **DMF:** the DRD2 family, conditional compatibility with Lutron and Savant
  dimming, and the 50% derating rule. These claims were captured in a claude.ai
  research session. Nobody has read the page directly since, because the build
  environment could not reach dmflighting.com.
- **QTL:** proposed source-backed records for Q-CAP KURV, VERS-FLUSH (02),
  QZ-PRO-PH/0-10V and QZ-ND. Deterministic rules cover published fixture
  length/increment constraints, Exact-vs-Optimal handling where documented,
  QZ output-channel grouping, and QTL voltage-drop target guidance. These were
  proposed by ChatGPT from official QTL pages/documents and still require human
  verification before issue-ready use.

## Next steps

1. Verify the seed records against their sources and flip them to `verified`.
2. Add Lutron model records for the families actually specified (processors,
   Palladiom keypads, Sivoia QS, Ketra, and the dimmers/modules that drive DMF
   loads), with `dimming.*` ratings from spec sheets.
3. Add DRD2 product records per lumen package with `led.inputPowerW`.
4. Make Savant a full ecosystem (it currently exists only as a manufacturer).
5. Finish migrating the legacy QTL catalog from `src/lib/qtlCatalog.ts` into
   `data/library/qtl.json`; the first source-backed fixture/PSU records and rule
   engines are in place, but the remaining QTL families still need sourced data.
6. Wire QTL Studio to the library rule engines after the floor-plan/QTL bridge
   lands, so UI code no longer performs product-capacity math.
7. Show library records and rule results in the Library & Validation view.
8. Publish a JSON Schema generated from `schema.ts`, so editors validate data as
   it's typed.
