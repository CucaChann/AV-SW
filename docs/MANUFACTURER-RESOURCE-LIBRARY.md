# Manufacturer & Project-Manager Resource Library

_Last deep-research pass: 2026-09-18_

This file is the source map for AV-SW's manufacturer knowledge library. It intentionally points to official manufacturer resources instead of copying entire vendor libraries into the repository. AV-SW should store structured product metadata and source URLs, then cache documents locally on demand for active projects.

## Core principles

1. **Source-backed data only.** Every technical value should retain its source URL, document name/revision when available, and a `last_verified` date.
2. **Do not silently overwrite history.** Project BOMs should retain the product/document revision used when a design was approved.
3. **Documents are evidence; structured data powers the app.** A PDF is retained or linked for verification, but AV-SW should not need to re-read it every time.
4. **Official links first.** Prefer manufacturer-hosted spec sheets, manuals, CAD/DXF/DWG/Revit/BIM, IES/LDT, EASE/GLL/CF2, firmware, presets, and certification documents.
5. **On-demand offline cache.** "Pin for Offline" and "Make Project Available Offline" should cache only the documentation needed by the project.
6. **Legacy status matters.** Discontinued/retired products remain searchable for retrofit/service work.

---

## Core manufacturers already in AV-SW

### Lutron
**Use in AV-SW:** HomeWorks QSX/QS, Palladiom, Alisse, Ketra, Rania, Sivoia QS, shades, keypads, processors, links, DIN modules, panels, power supplies, HVAC/interface components.

Official resources:
- HomeWorks product specification submittals: https://support.lutron.com/us/en/product/homeworks/documents/product-specification-submittals
- Example HomeWorks QSX CAD hub: https://support.lutron.com/us/en/product/homeworks/component/processors/hqp7-1/documents/cad-downloads
- Ketra product specification submittals: https://support.lutron.com/us/en/product/homeworks/component/downlights/ketra/documents/product-specification-submittals
- Sivoia QS roller-shade submittals: https://support.lutron.com/us/en/product/shades/component/roller-shades/sivoia-qs/documents/product-specification-submittals
- HomeWorks power-supply submittals: https://support.lutron.com/us/en/product/homeworks/component/power-supplies/documents/product-specification-submittals

Resource types observed:
- PDF specification submittals
- DWG / DXF / PDF CAD blocks
- RFA/Revit for selected products
- one-line/system architecture drawings
- power-draw/PDU documentation
- shade power panels and roller shade specifications

AV-SW should track:
- system generation: QS / QSX / RadioRA2 / RadioRA3 / legacy
- processor/link compatibility
- load type and control method
- module/channel capacity
- QS Link power draw
- panel/enclosure requirements
- keypad family, button configuration, finish and engraving
- shade operator, dimensions, pocket, fabric, light gaps, power and communication

### DMF Lighting
**Use in AV-SW:** architectural downlights, adjustable, wall wash, cylinders, retrofit/remodel, True 1, X Series, H/M/S/C families, 0.5 Concealed Linear.

Official resource hub:
- https://www.dmflighting.com/resources/

DMF provides per-family:
- spec sheets
- IES files
- installation instructions
- Revit files on many families
- product videos
- retired-product documentation

AV-SW should track:
- family/model
- fixed/adjustable/wall-wash
- aperture
- housing type: new construction/remodel/retrofit
- flanged/flangeless
- CCT, CRI, beam/optic
- lumen/output
- dimming/control compatibility
- driver
- wet/damp/marine/fire/plenum ratings
- cutout and mounting depth
- IES/Revit links
- lifecycle: current/phasing out/retired

### QTL
**Use in AV-SW:** linear/millwork/cove/toe-kick/shelf lighting and vendor-quote workflow.

Official resources:
- Resource hub: https://www.qtl.lighting/resources/
- MICRO 5 ALTA-FLAT (01): https://www.qtl.lighting/products/alta-flat-01/
- Q-CAP KURV: https://www.qtl.lighting/products/kurv/

QTL product pages can expose:
- specification sheets
- ordering guides
- installation/application guides
- photometric/color data
- IES
- CAD
- Revit
- sustainability docs
- product configurators

AV-SW should track each run:
- exact measured length
- minimum/maximum allowed length and increment
- watts/ft and total wattage
- CCT/CRI
- lens/diffuser
- profile/extrusion
- mounting clip/channel/magnet
- bend direction and bend radius
- environment/IP rating
- feed type and feed location
- driver/control/dimming
- driver accessibility
- field-cut allowance
- quote revision and quote-vs-design mismatch

### Ubiquiti / UniFi
**Use in AV-SW:** default networking platform for new designs; gateway, switching, AP, Protect, Access, storage, rack connectivity.

Official resources:
- Tech Specs: https://techspecs.ui.com/
- UniFi Design Center: https://design.ui.com/projects
- WiFi overview/planning: https://www.ui.com/wifi

Examples worth modeling:
- U7 Pro Max: https://techspecs.ui.com/unifi/wifi/u7-pro-max
- Pro Max 24 PoE: https://techspecs.ui.com/unifi/switching/usw-pro-max-24-poe

AV-SW should track:
- gateway routing/IDS throughput
- WAN interfaces
- switch port count and speeds
- SFP/SFP+/SFP28 uplinks
- PoE type per port and total budget
- AP Wi-Fi generation/radios/spatial streams
- AP uplink speed
- max client guidance
- mounting and operating environment
- Protect camera/NVR storage dependencies
- Access door-control dependencies
- rack RU/depth/power/BTU
- UniFi Network minimum software version
- Pro AV/multicast feature support
- legacy/current status

The Design Center is also a valuable benchmark for AV-SW: floorplan upload, wall detection, RF coverage, rack/port relationships, BOM, provisioning, and installer documentation.

### Leon Speakers
**Use in AV-SW:** premium/custom-width soundbars, on-wall, in-wall/in-ceiling and design-driven architectural audio.

Official resources:
- Resource hub: https://www.leonspeakers.com/resources
- Technical downloads: https://www.leonspeakers.com/resources/technical-downloads

Technical downloads include product data sheets, PDF technical drawings, DWG files, installation manuals and literature for families including Horizon custom soundbars.

AV-SW should track:
- exact/custom width
- channel configuration
- display model/width relationship
- enclosure depth/height
- impedance/sensitivity/frequency response
- amplification
- mounting hardware
- grille/fabric/finish
- TV-logo/notch requirements where applicable
- ordering dimensions
- quote revision
- Future Automation mount/backbox pairing

### Sonance
**Use in AV-SW:** Visual Experience, Invisible Series, Mariner, outdoor/landscape, soundbars, DSP/amplification and architectural audio.

Official product pages frequently provide:
- data sheets
- manuals
- CAD PDFs
- DXF/DWG
- retrofit-enclosure drawings
- EASE/GLL/CF2
- DSP/preset libraries
- "Download All"

Examples:
- IS6 Invisible: https://sonance.com/products/93478
- IS10W Invisible subwoofer: https://sonance.com/products/93481
- VX66 SST: https://sonance.com/products/93685
- VX86R: https://sonance.com/products/96017
- Mariner MX56: https://sonance.com/products/93606

AV-SW should track:
- visible/invisible
- in-wall/in-ceiling/on-wall/outdoor/marine
- cutout/mounting depth
- retrofit/new-construction enclosure
- finish process for invisible speakers
- amplifier/preset dependencies
- EASE data
- grille/accessory compatibility
- IP/certification
- two-stage installation status

### James by Sonance
**Use in AV-SW:** custom passive soundbars, high-performance architectural speakers, Small Aperture, QX/QXC, PowerPipe X, hidden bass, marine.

Official collections/products:
- SPL Soundbars: https://sonance.com/collections/spl-soundbar
- Small Aperture: https://sonance.com/collections/small-aperture
- SA68: https://sonance.com/products/sa68
- PowerPipe X PPX12: https://sonance.com/products/ppx12
- PPX15: https://sonance.com/products/ppx15

Resources observed:
- data/sell sheets
- manuals and quick-start guides
- CAD PDF/DWG/DXF
- Revit packages for selected Small Aperture products
- EASE/GLL/CF2
- DSP preset libraries
- finish documents
- configuration guides

AV-SW should model:
- custom soundbar length and notches
- center/LR/LCR/Centergy configuration
- shallow/narrow/offset enclosure variants
- grille/aperture options
- PowerPipe port geometry and outlet/grille accessories
- required amplification and presets
- marine/weather options

### TRUFIG
**Use in AV-SW:** flush integration of speakers and other technology into gypsum/solid surfaces.

Official resources:
- https://sonance.com/pages/trufig
- https://www.trufig.com/support

Support includes CAD/assembly files and installation materials for round/square VX/VXQ mounting platforms.

AV-SW should track:
- compatible device
- surface type
- drywall thickness
- platform/router-template model
- rough-in stage
- finish trade responsibility
- final trim size/shape
- leveling/alignment dependency
- installer sequencing

### IPORT
**Use in AV-SW:** dedicated iPad control interfaces, PoE-powered wall mounts/docks.

Official resources:
- Data sheets: https://iport.io/pages/data-sheets
- Surface Mount: https://iport.io/products/sm

IPORT product pages provide manuals, PDF drawings, DWG/DXF and compatibility by iPad generation.

AV-SW should track:
- exact iPad generation/model numbers
- mount system
- PoE/PoE+ requirement
- CAT run requirement
- wall-box compatibility
- orientation
- color
- lock/security
- USB-C/power adapter dependencies
- device lifecycle risk when Apple changes hardware dimensions

### Blaze by Sonance
**Use in AV-SW:** network/DSP amplification and preset-driven architectural audio.

Examples:
- PowerZone Connect 2004: https://sonance.com/products/lbx-888-003
- PowerZone Connect 122: https://sonance.com/products/ubx-888-008

Resources include:
- data sheets
- manuals/quick-start
- mechanical PDF/DWG/STEP
- speaker preset libraries
- firmware
- release notes
- desktop control software

AV-SW should track:
- channel count
- Lo-Z / 70V / 100V capability
- power sharing
- DSP
- Dante where applicable
- speaker preset compatibility
- rack units
- heat/power
- firmware/release-note version

### Future Automation
**Use in AV-SW:** TV mounts, moving mounts, recessed/universal backboxes, motorized solutions and elevation coordination.

Example:
- PS65: https://www.futureautomation.net/Product/Details/PS65

Product pages expose technical sheet, instructions and CAD plus:
- screen-size guidance
- VESA/bolt patterns
- load limit
- minimum depth
- extension
- rotation
- indoor/outdoor/marine suitability
- related wall boxes/accessories

AV-SW should validate:
- display dimensions and weight
- VESA
- desired rotation vs screen width
- wall construction/blocking
- recessed box compatibility
- service access
- cable-management radius
- soundbar relationship
- finish/outdoor/marine requirement

---

## Additional luxury / architectural audio manufacturers to include

### K-array
Strong fit for luxury residential, hospitality, museum, retail, yacht and highly discreet architectural applications.

Official family/product pages provide datasheets, certifications, BIM, EASE, 3D/Layout files, architect specs, user guides, cut templates and in some cases DWG.

Examples:
- Lyzard KZ14 I: https://www.k-array.com/en/product/lyzard-kz14-i
- Vyper KV102 II: https://www.k-array.com/en/product/Vyper-KV102II
- Anakonda KAN200: https://www.k-array.com/en/product/anakonda-kan200
- Rumble KU210: https://www.k-array.com/en/product/rumble-ku210

AV-SW should track:
- dispersion H/V
- required subwoofer pairing
- required/recommended Kommander amplifier/preset
- impedance and parallel-module limits
- custom RAL/finish
- marine/IP option
- BIM/EASE/architect-spec availability
- flush/in-wall accessory options

### KSCAPE
K-array family solution combining architectural audio and lighting in one system.

Official:
- RAIL system: https://www.k-array.com/en/rail
- RAIL Symmetric: https://www.k-array.com/en/product/rail-symmetric
- RAIL Asymmetric: https://www.k-array.com/en/product/rail-asymmetric
- RAIL Diffused: https://www.k-array.com/en/product/rail-diffused
- RAIL Track: https://www.k-array.com/en/product/rail-track

Resources include BIM, EASE, DWG, user guides and LDT/IES.

AV-SW should treat RAIL as a cross-discipline object:
- audio + lighting
- optic
- direct/indirect
- mounting type
- line length/modules/joints
- audio preset
- subwoofer requirement
- 24/48 V supply
- DALI/Casambi/on-off control
- Lutron/lighting-control integration review
- custom RAL
- driver location
- lighting photometry + audio coverage

### Amina
High-priority addition for invisible/plaster-over audio.

Official:
- Resources: https://www.aminasound.com/resources/
- Invisible speakers: https://www.aminasound.com/invisible-products/invisible-speakers/
- Edge: https://www.aminasound.com/invisible-products/edge/
- Invisible subwoofers: https://www.aminasound.com/invisible-products/amina-invisible-subwoofers/
- Specification service: https://www.aminasound.com/specification-service/

Resources include datasheets, installation guides, application notes and CAD. Amina also documents construction/finish dependencies and offers specification guidance based on drawings, room dimensions, ceiling height and listening requirements.

AV-SW should track:
- plaster-over vs plaster-up-to install method
- allowable finish thickness/material
- backbox/mounting block/shim
- Guardian protection
- firehood
- SPL/coverage assumptions
- listening height
- cavity depth/stud spacing
- DSP/subwoofer requirement

### Wisdom Audio
High-end architectural/cinema line-source and planar-magnetic systems.

Official product resources often include owner manuals, PDF/DWG drawings, data sheets, 3D models and installation videos.

Examples:
- Sage L75i: https://www.wisdomaudio.com/product/sage-series-l75i/
- Sage P20i: https://www.wisdomaudio.com/product/sage-series-p20i/
- In-wall range: https://www.wisdomaudio.com/in-wall-2/

AV-SW should track:
- active crossover/DSP dependency
- amplifier channels per speaker
- multi-section impedance
- custom grille length
- integral backbox
- cinema vs distributed-audio use
- calibration/commissioning requirement

### Stealth Acoustics
Invisible speaker/subwoofer alternative.

Official:
- LRX-83: https://www.stealthacoustics.com/invisible-speakers/lrx83/

Resources include quick-start installation, dimensional drawings, test results, brochures and backbox/accessory options.

AV-SW should track:
- finish/build-up limits
- backbox option
- place saver/shim
- protection/transformer accessories
- minimum recommended amplifier power
- construction sequence

### Origin Acoustics
Architectural in-ceiling/in-wall/outdoor alternative useful for budget/performance options and retrofit.

Official speaker specification matrix:
- https://originacoustics.com/speaker-details/

Track cutout, depth, impedance, frequency response, woofer/tweeter, collection/tier and manual links.

### Theory Audio Design
High-output architectural/cinema/audio-bar option with controlled ecosystem.

Official technical PDFs are hosted at:
- https://downloads.theoryaudiodesign.com/

Important AV-SW rule: some Theory products are designed around Theory/PRO loudspeaker controllers, so amplifier/controller compatibility must be treated as a hard dependency rather than a generic amplifier suggestion.

### Trinnov Audio
Reference cinema processor/calibration platform.

Official downloads:
- https://www.trinnov.com/en/resources/downloads/
- Altitude16: https://www.trinnov.com/en/products/altitude-sup-16-sup/

Resources include manuals, tutorials, speaker-position guide, WaveForming/subwoofer-placement guidance, control protocol and DXF front/rear panels.

Track:
- output/channel count
- HDMI/input topology
- calibration/commissioning
- automation driver
- rack/power
- speaker/sub layout
- room-measurement dependencies

### StormAudio
Immersive cinema processor/receiver alternative.

Official product/manual resources are available from stormaudio.com, including ISP CORE 16 specifications and owner manuals.

Track:
- channel/output count
- Dirac/ART licensing/features
- HDMI version
- Dante/AES67 options where relevant
- bass-routing/subwoofer capabilities
- rack/power
- firmware

### Meridian
Luxury DSP loudspeaker ecosystem.

Example:
- DSP3200: https://www.meridian-audio.com/luxury-home-audio/loudspeakers/dsp3200/

Track SpeakerLink/network/control dependencies, power, active amplification, placement and system-controller requirements.

### Steinway Lyngdorf
Ultra-premium room/cinema ecosystem and useful CAD library.

Example technical drawings:
- https://steinwaylyngdorf.com/downloads/model-s-technical-drawings/

Track room processor, amplification, boundary woofer/subwoofer strategy, CAD, mounting and commissioning requirements.

---

## Project-manager fields AV-SW should add

The product database alone is not enough. Every project item should carry PM/coordination metadata.

### Procurement
- manufacturer
- model / configured part number
- quantity
- quote vendor
- quote number
- quote revision
- quoted date
- quote expiration
- dealer cost / sell price / allowance
- freight
- sales tax handling
- lead time
- long-lead flag
- order-by date
- PO number
- PO date
- ordered quantity
- backordered quantity
- ETA
- ship date
- tracking number
- received quantity
- damaged/missing status
- RMA number
- warranty expiration

### Design / submittal
- room
- floor
- system
- device tag
- drawing revision
- specification status
- product status: proposed / approved / ordered / installed / commissioned / retired
- submittal status
- architect approval
- interior designer approval
- client approval
- finish/sample approval
- engraving approval
- field-verify flag
- alternate/VE option
- source document + revision
- last verified date

### Coordination
- integrator responsibility
- EC responsibility
- GC responsibility
- architect responsibility
- interior designer responsibility
- millwork responsibility
- HVAC/MEP responsibility
- required rough-in date
- required blocking
- required backbox
- required power
- required low-voltage cable
- conduit/pathway
- ceiling/wall finish dependency
- access/service-panel requirement
- inspection/code note
- prerequisite task
- successor task
- RFI number
- issue owner
- due date
- issue severity

### Technical dependencies
- rack RU
- device depth
- weight
- heat/BTU
- power consumption
- UPS load
- PoE class/watts
- port speed
- VLAN/SSID
- IP reservation
- firmware
- software/controller minimum version
- DSP preset
- amplifier channel
- impedance/load
- control driver
- license/subscription
- commissioning tool
- test procedure
- acceptance criteria

### Construction-specific fields
- cutout
- mounting depth
- finish thickness
- stud/cavity constraints
- waterproof/marine/IP rating
- fire/plenum requirement
- trim/flange style
- paintable grille
- custom RAL/finish
- shade pocket size
- shade light gaps
- TV centerline/AFF
- keypad AFF
- speaker AFF/orientation
- ceiling height

### Closeout
- installed date
- technician
- as-built location
- serial number
- MAC address
- final IP
- firmware at handoff
- commissioning date
- test result
- punch status
- client training
- warranty docs
- final photos
- final programming backup
- service notes

---

## Recommended AV-SW document experience

For each product:

```text
PRODUCT
Leon Hz44UX

Structured data
├ dimensions
├ impedance
├ frequency response
├ custom-width rules
├ mounting
└ amplifier requirements

DOCUMENTS
├ Data Sheet                [Open] [Pin Offline]
├ Technical Drawing PDF     [Open] [Pin Offline]
├ DWG                       [Open in CAD / Download]
├ Installation Manual       [Open] [Pin Offline]
└ Finish Library            [Open]

SOURCE
Official manufacturer
Last verified: 2026-09-18
Product status: Current
```

Do not mirror an entire manufacturer's library into GitHub. Keep official source links in the cloud catalog, and cache only project-relevant files locally. This reduces copyright/licensing risk, avoids stale documents and keeps AV-SW installs small.

---

## Next ingestion priorities

1. Lutron HomeWorks/QSX + Sivoia + Ketra
2. UniFi gateway/switch/AP/Protect current catalog
3. Sonance Visual Experience + Invisible
4. James SPL + Small Aperture + PowerPipe X
5. Leon Horizon + Axis/Vault
6. Future Automation PS/UB/WB compatibility
7. DMF current families + IES
8. QTL MICRO 5/Q-CAP + driver/configuration rules
9. K-array Lyzard/Vyper/Anakonda/Rumble/Kommander
10. KSCAPE RAIL
11. Amina invisible audio
12. Wisdom/Stealth/Origin/Theory alternatives
13. Trinnov/StormAudio high-end cinema processing
