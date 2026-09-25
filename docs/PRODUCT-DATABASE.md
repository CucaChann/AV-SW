# Product Database

> The implemented library schema, data files and review workflow are described in
> `docs/PRODUCT-LIBRARY.md`. The field list below is the backlog of specs to add to
> `src/library/specs.ts` as products need them.

## Goal
Create a versioned manufacturer/product library that separates factual product data from design rules.

## Core fields
- manufacturer
- brand
- family
- model
- model_status
- category
- subcategory
- application
- visible_invisible
- indoor_outdoor_marine
- width
- height
- depth
- cutout
- mounting_depth
- weight
- power
- voltage
- poe_standard
- impedance
- recommended_amplifier_range
- frequency_response
- sensitivity
- dispersion
- lumens
- cct
- cri
- beam_angle
- dimming_protocol
- network_speed
- wifi_standard
- radio_bands
- spatial_streams
- compatible_models
- required_accessories
- optional_accessories
- backbox
- blocking_required
- rough_in_required
- wire_type
- clearance
- list_price
- dealer_cost
- sell_price
- freight
- lead_time
- cad_url
- revit_url
- spec_sheet_url
- ies_url
- install_url
- source_url
- last_verified

## Initial manufacturers and brands
- Lutron
- DMF Lighting
- QTL
- Ubiquiti / UniFi
- Leon Speakers
- Sonance
- James by Sonance
- TRUFIG
- IPORT
- Blaze Audio
- Future Automation

## Rule
Never use AI-generated pricing or specifications as authoritative. Product data should be source-backed and versioned.