# Design Rules Foundation

## General
- Design decisions must be traceable to room intent, geometry, product capability, construction conditions, and project constraints.
- Recommendations should include rationale, confidence, source/version, and approval status.
- Preserve statuses such as Proposed, Approved, Pre-wire Only, Model TBD, Location TBD, Field Verify, Requote Required, Existing/Reuse, Replace, and Remove.
- Every product decision should be checked for serviceability, thermal behavior, vibration/noise risk, installation sequencing, access, future replacement, and revision impact.
- Do not assume that because a device physically fits, it is properly ventilated, serviceable, acoustically suitable, structurally supported, or compatible with the surrounding construction.

## Mechanical / Thermal / Serviceability
- Track equipment heat output, ventilation path, ambient-temperature limits, and required clearances.
- Rack and cabinet designs must consider intake/exhaust airflow, door/perforation restrictions, fan noise, blocked vents, heat recirculation, and neighboring heat-producing equipment.
- Flag sealed millwork containing AV/network/lighting-control equipment unless an engineered ventilation strategy exists.
- Track rack units, chassis depth, cable-bend space, rear-service clearance, weight, rail/support requirements, and service-loop requirements.
- Heavy equipment, displays, speakers, subwoofers, mounts, and motorized assemblies must be checked against blocking, substrate, fasteners, and structural support assumptions.
- Accessibility matters: drivers, amplifiers, processors, power supplies, shade power panels, junctions, network gear, and serviceable electronics should not be buried behind inaccessible finish work.
- Flag equipment installed directly adjacent to plumbing, steam, high-humidity spaces, exterior moisture paths, or other environmental risks unless specifically rated/protected.
- Consider future replacement envelope: a device should be removable without unnecessary demolition where practical.

## Acoustic / Vibration / Rattle Control
- Speaker and subwoofer placement must consider structure-borne vibration, resonant cavities, loose millwork, grille vibration, glass, doors, hardware, lighting trims, HVAC diffusers, art, and nearby furniture.
- In-wall/in-ceiling speakers should use manufacturer-recommended backboxes/enclosures when required or beneficial for consistency, isolation, fire/acoustic separation, and bass control.
- Subwoofers require special review for floor/wall coupling, rattling millwork, cabinetry, glazing, nearby doors, lightweight partitions, and structural transmission into adjacent rooms.
- Flag subwoofers placed inside untreated cabinets unless ventilation, acoustic opening area, structure, isolation, access, and vibration control are deliberately designed.
- Avoid hard mechanical contact that can transmit vibration from a speaker/subwoofer enclosure into trim, millwork, drywall, or decorative panels unless the manufacturer requires it.
- Consider isolation pads, resilient interfaces, gasketing, bracing, backboxes, constrained-layer solutions, or structural reinforcement when appropriate to the product and construction.
- Invisible speakers require finish-build-up, substrate, curing, skim-coat, sanding, painting, and maximum finish-thickness checks because finish errors affect output and reliability.
- Speaker placement should check symmetry, listening axis, room boundaries, ceiling height, reflective surfaces, furniture, drapery, and expected listening positions.
- Multi-subwoofer systems should be evaluated for room-mode control and calibration rather than chosen only by visual symmetry.
- Do not hide rattles with DSP. Mechanical rattles and construction defects should be corrected physically.

## Electrical / Power Quality
- Track voltage, circuit, load, branch-circuit requirement, receptacle type/location, surge protection, UPS requirement, and power-sequencing needs.
- Check inrush/current draw and combined rack load, not only nameplate wattage.
- Critical control/network equipment should be considered for UPS and graceful shutdown where appropriate.
- Separate serviceability concerns from surge protection: a hidden receptacle may still be unacceptable if the power supply cannot be reached.
- Check dimming protocol, minimum/maximum load, LED driver compatibility, neutral requirements, and control wiring before choosing Lutron or other lighting-control hardware.
- Track transformer/driver heat and accessibility for linear and architectural lighting.

## Lighting
- Distinguish ambient, task, accent, decorative, cove, millwork, toe-kick, shelf, wall-wash, grazing, and specialty intent.
- Fixture placement should account for room geometry, furniture, artwork, millwork, ceiling conditions, photometrics, CCT, CRI, beam angle, aiming range, glare, dimming, and maintenance access.
- Lighting design should drive control-zone design, not the reverse.
- Check conflicts with speakers, sprinklers, HVAC diffusers, smoke detectors, access panels, shade pockets, beams, joists, ductwork, and ceiling features.
- Check driver location, heat, access, plenum/wet/damp rating, housing type, insulation/contact rating, and finish compatibility.
- For wall-wash/graze, track setback from wall, fixture spacing, ceiling height, and wall texture/material.
- For artwork, track aiming angle, UV/IR sensitivity where relevant, beam size, and glare/reflection risk.
- Account for visual comfort: avoid fixtures directly above screens, reflective stone, mirrors, or seating when glare is likely.

## Lutron
- Distinguish load control from user interface.
- Track processors, links, modules, panels, keypads, shades, HVAC integration, power supplies, accessories, firmware/software generation, and legacy/current status.
- Validate load type, control method, panel/module capacity, link power, wiring, and spare capacity.
- Keypad recommendations should account for room entry, bedside/use locations, scene intent, accessibility, architecture, wall clutter, and engraving.
- Track control-device backbox/depth, ganging, finish, trim, alignment, mounting height/AFF, and coordination with stone/millwork.
- For retrofit, check compatibility between existing QS/QSX/RadioRA generations and target hardware before recommending replacement.
- Shade design must validate pocket dimensions, access, fabric roll, operator, light gaps, side channels, power, communication, heat sources, sprinkler conflicts, and serviceability.

## QTL / Linear Lighting
- Each run should store room, application, measured length, product family/profile, CCT, output, lens, environment, mounting, feed, driver, control, and status.
- Recalculate wattage and driver requirements when run geometry changes.
- Track voltage drop, maximum run length, feed direction, field-cut rules, bend radius, corner/miter conditions, heat dissipation, channel mounting, diffuser continuity, and driver accessibility.
- Check integration with millwork tolerances and finish sequencing.
- Vendor quote data must be compared against the current design revision.
- Flag any quote where run length, profile, CCT, output, mounting, feed, or driver differs from the current drawing.

## UniFi / Network
- New network designs are UniFi-first unless a project explicitly requires otherwise.
- AP placement should consider RF performance, wall/material attenuation, architecture, visibility, serviceability, cable access, client aesthetics, and interference sources.
- Validate PoE budget, port capacity, uplinks, VLAN/SSID intent, gateway capability, rack space, power, heat, software/controller version, and reserve capacity.
- Predictive RF guidance must be field-verified.
- Check cable category, bend radius, pathway fill, termination method, certification test, patch-panel capacity, switch port speed, PoE standard, and future bandwidth.
- Avoid AP placement inside metal cabinets or heavily shielded millwork unless intentionally modeled/validated.
- Track cameras, NVR/storage, door access, intercom/doorbell, multicast, mDNS, IGMP, Sonos/AV dependencies, and QoS/pro-AV requirements.
- Rack network design should check airflow direction and thermal stacking.

## Audio
- Speaker selection must consider room use, listening area, room geometry, ceiling height, mounting surface, dispersion, aesthetics, amplifier requirements, and construction conditions.
- Store mounting height/AFF, cutout, backbox, orientation, clearance, wiring, finish requirements, amplifier channel, DSP/preset, impedance, and service access.
- Leon should be considered for premium/custom aesthetic solutions, especially custom-width soundbars, but not forced into every room.
- Sonance, James by Sonance, K-array, KSCAPE, Amina, Wisdom, Stealth, Origin, Theory, Meridian, and other families should be selectable by application and performance/aesthetic need.
- Passive soundbars should validate display width, channel configuration, amplifier channels, placement, mounting, grille/finish, and service access.
- In-wall/in-ceiling/invisible speakers should validate cavity depth, joists/studs, ductwork, insulation, backbox, finish thickness, fire/acoustic requirements, and rattling risk.
- Subwoofer design should explicitly check:
  - boundary loading and room modes
  - neighboring-room transmission
  - floor/wall structural coupling
  - cabinet resonance
  - rattling doors, glass, millwork, hardware, HVAC diffusers, lighting trims, and loose objects
  - ventilation if amplifier electronics are enclosed
  - access for gain/DSP/service
  - grille/opening free area if concealed
  - isolation/bracing requirements
- Large or high-output architectural speakers should include vibration and structural review.
- Outdoor/marine audio must validate IP/environment rating, corrosion exposure, mounting, drainage, UV exposure, cable type, and winterization/service expectations.

## Video / Mounting
- TV design should include display size, elevation, centerline/AFF, viewing distance/angle, mount, backbox, blocking, power, network/control, ventilation, glare, and soundbar relationship.
- Future Automation mount/backbox compatibility must be validated.
- Check mount travel/rotation against adjacent walls, art, cabinetry, soundbars, drapery/shades, and furniture.
- Recessed electronics behind displays require airflow, service access, cable radius, and heat review.
- Flag OLED/direct-view displays in enclosed millwork with insufficient heat clearance.
- Track stud/blocking layout and whether mount loads are supported by structure rather than finish material alone.

## Racks / Equipment Rooms
- Track total RU, rack depth, cable-management space, weight, power, UPS load, heat output, intake/exhaust direction, and future spare capacity.
- Consider front-to-back airflow and avoid heat recirculation.
- Provide ventilation/fans/active cooling where enclosure heat calculations or manufacturer requirements demand it.
- Consider fan noise if equipment is near occupied rooms.
- Maintain service clearance and removable panels/doors.
- Track patch panels, lacing, labeling, horizontal/vertical management, service loops, fiber management, and bend radii.
- Heavier amplifiers/UPS units should generally be placed lower for stability unless airflow or manufacturer requirements dictate otherwise.
- Keep equipment with conflicting airflow directions from creating hot spots.
- Include rack elevation and power/thermal schedule in final documentation.

## Shades
- Validate pocket/headbox depth and width, operator, roll direction, fabric, hembar, side channels, sill condition, light gaps, power, control, access, and finish.
- Check conflict with sprinklers, HVAC diffusers, recessed lights, crown molding, glazing hardware, drapery tracks, and window operation.
- Ensure shade pockets remain serviceable after ceiling/millwork closeout.
- For retrofit, verify existing pocket geometry before assuming hardware reuse.

## HVAC / Environmental Coordination
- Check equipment locations against supply/return airflow, condensation, steam, humidity, and heat sources.
- Avoid placing sensitive electronics where HVAC service can leak/condense over them.
- Speakers near HVAC diffusers should be reviewed for noise masking, grille vibration, airflow noise, and coverage disruption.
- Equipment rooms/racks should include HVAC/ventilation responsibility and expected heat load in coordination notes.

## Fire / Life-Safety / Code Coordination
- Track whether penetrations affect fire-rated assemblies and whether backboxes/firehoods/putty pads/firestopping are required by the project/code professional.
- Do not make unsupported code claims; AV-SW should surface coordination questions for the EC/GC/architect/code consultant.
- Maintain clearance from sprinklers, smoke detectors, strobes, emergency equipment, and required access panels.
- For plenum spaces, track cable/product ratings where applicable.

## Coordination
- Track responsibility by trade: integrator, GC, EC, architect, interior designer, HVAC/MEP, millwork, lighting designer, client, structural engineer when needed.
- Surface unresolved dependencies before release.
- Every concealed-device decision should identify who provides the opening, blocking, backbox, power, conduit/cable, finish, access panel, final trim, and programming.
- Track sequencing dependencies: rough-in -> inspection -> close-up -> finish -> trim -> programming -> calibration -> punch -> closeout.

## Procurement / Revision / Lifecycle
- Track current/legacy/discontinued status, firmware/software minimums, product revision, source revision, last verified date, lead time, quote expiration, and alternates.
- Product updates must not silently alter approved projects.
- When manufacturer specs/firmware/compatibility change, AV-SW should flag affected active projects for review.
- Maintain "design basis" and "current manufacturer data" separately so historical service decisions remain explainable.
- Flag substitutions that change cutout, depth, power, heat, PoE, amplifier load, shade pocket, RF, finish, mounting, or control dependencies.

## Design Check
Examples:
- Every AP has data and PoE.
- Every PoE device fits within switch and total PoE budgets.
- Every speaker has wiring and amplification.
- Every speaker/subwoofer has mechanical clearance and vibration/rattle review.
- Every subwoofer concealed in millwork has opening-area, ventilation, access, bracing, and isolation review.
- Every display has power and required data/control.
- Every recessed display/equipment cavity has thermal/serviceability review.
- Every QTL run has a suitable driver and accessible driver location.
- Every Lutron load has compatible control hardware.
- Every shade has power/control and coordinated pocket dimensions.
- Every rack has RU, depth, power, UPS, heat, airflow, and service clearance.
- No product is specified beyond current manufacturer/environmental ratings.
- No product update silently invalidates an approved design.
- No unresolved critical design, thermal, structural, acoustic, coordination, or serviceability issue may be omitted from released documentation.
