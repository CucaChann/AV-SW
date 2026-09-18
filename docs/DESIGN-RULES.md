# Design Rules Foundation

## General
- Design decisions must be traceable to room intent, geometry, product capability, and project constraints.
- Recommendations should include rationale, confidence, and approval status.
- Preserve statuses such as Proposed, Approved, Pre-wire Only, Model TBD, Location TBD, Field Verify, and Requote Required.

## Lighting
- Distinguish ambient, task, accent, decorative, cove, millwork, toe-kick, and wall-wash intent.
- Fixture placement should account for room geometry, furniture, millwork, ceiling conditions, photometrics, CCT, CRI, beam angle, dimming, and maintenance access.
- Lighting design should drive control-zone design, not the reverse.

## Lutron
- Distinguish load control from user interface.
- Track processors, links, modules, panels, keypads, shades, HVAC integration, power supplies, and accessories.
- Validate load type, control method, panel/module capacity, wiring, and spare capacity.
- Keypad recommendations should account for room entry, scene intent, architecture, and wall clutter.

## QTL
- Each run should store room, application, measured length, product family/profile, CCT, output, lens, environment, mounting, feed, driver, control, and status.
- Recalculate wattage and driver requirements when run geometry changes.
- Vendor quote data must be compared against the current design revision.

## UniFi
- New network designs are UniFi-first.
- AP placement should consider RF performance, wall/material attenuation, architecture, visibility, serviceability, cable access, and client aesthetics.
- Validate PoE budget, port capacity, uplinks, VLAN/SSID intent, gateway capability, rack space, and power.
- Predictive RF guidance must be field-verified.

## Audio
- Speaker selection must consider room use, listening area, room geometry, ceiling height, mounting surface, dispersion, aesthetics, amplifier requirements, and construction conditions.
- Store mounting height/AFF, cutout, backbox, orientation, clearance, wiring, and finish requirements.
- Leon should be considered for premium/custom aesthetic solutions, especially custom-width soundbars, but not forced into every room.
- Sonance and James by Sonance should be modeled by family and installation type, including invisible and small-aperture options.

## Video / Mounting
- TV design should include display size, elevation, centerline/AFF, mount, backbox, blocking, power, network/control, ventilation, and soundbar relationship.
- Future Automation mount/backbox compatibility must be validated.

## Coordination
- Track responsibility by trade: integrator, GC, EC, architect, interior designer, HVAC, millwork, client.
- Surface unresolved dependencies before release.

## Design Check
Examples:
- Every AP has data and PoE.
- Every speaker has wiring and amplification.
- Every display has power and required data/control.
- Every QTL run has a suitable driver and accessible driver location.
- Every Lutron load has compatible control hardware.
- Every shade has power/control and coordinated pocket dimensions.
- No unresolved critical design issue may be silently omitted from released documentation.