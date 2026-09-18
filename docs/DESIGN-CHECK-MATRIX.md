# AV-SW Cross-System Design Check Matrix

This matrix captures the "things experienced designers remember to think about" that often do not appear in a simple BOM.

## 1. Space / architecture
- room use
- room dimensions
- ceiling height
- reflected ceiling plan
- millwork
- furniture
- drapery/shades
- art
- glass/mirrors
- stone/tile
- doors/windows
- service/access panels
- attic/cavity access
- joists/studs/beams
- ductwork/plumbing
- fire-rated assemblies
- wet/humid/exterior exposure

## 2. Device fit
- width/height/depth
- cutout
- mounting depth
- trim/flange
- access behind device
- cable bend radius
- connector clearance
- service/removal envelope
- neighboring-device conflicts
- orientation
- weight/load

## 3. Thermal
- device watts
- estimated BTU/hr
- ambient limits
- intake/exhaust orientation
- sealed-cabinet risk
- passive vent area
- active ventilation/fans
- fan noise
- hot-air recirculation
- heat from adjacent gear
- rack/cabinet temperature sensor
- responsibility for cooling

## 4. Vibration / acoustics
- structural coupling
- backbox/enclosure
- bracing
- resilient isolation
- grille rattle
- millwork rattle
- door/glass/hardware rattle
- HVAC diffuser rattle
- light-trim rattle
- ceiling resonance
- subwoofer boundary loading
- adjacent-room transmission
- room modes
- DSP/calibration
- listening position
- coverage
- symmetry / aiming

## 5. Power
- circuit
- voltage
- current
- receptacle location
- hidden-access risk
- UPS
- surge
- power sequence
- inrush
- dedicated circuit
- driver/transformer access
- emergency/critical-power needs

## 6. Data / control
- cable type
- cable count
- PoE standard
- bandwidth
- termination
- test/certification
- VLAN
- IP reservation
- firmware
- minimum controller/software
- multicast/mDNS/IGMP
- control driver
- cloud/account ownership
- commissioning credentials

## 7. Finish / aesthetics
- visible vs concealed
- grille/trim
- paint/color/RAL
- engraving
- alignment
- trim reveal
- flush condition
- shadow gaps
- custom width
- symmetry
- interior-designer approval
- client approval
- finish sample

## 8. Construction sequencing
- shop drawing approved
- rough opening
- backbox
- blocking
- conduit
- wire pull
- inspection
- drywall/plaster
- millwork
- painting
- device trim
- programming
- aiming/calibration
- punch
- closeout

## 9. Procurement
- approved model
- alternate
- quote revision
- quote expiration
- lead time
- long-lead flag
- PO
- ETA
- received
- damaged
- missing
- RMA
- warranty
- discontinued/update risk

## 10. Closeout
- serial
- MAC
- IP
- firmware
- location
- room/device tag
- photos
- test result
- calibration file
- programming backup
- final drawing revision
- training
- warranty docs
- service notes

## Device-specific reminders

### Subwoofer
- placement vs room modes
- structure-borne transmission
- cabinet/opening free area
- grille/opening airflow and acoustic restriction
- isolation
- bracing
- rattling nearby materials
- access to amplifier/DSP/connectors
- power/ventilation if active
- neighbor/noise considerations

### Invisible speaker
- substrate
- cavity/backbox
- finish system
- max finish thickness
- cure/dry time
- skim/sand process
- protection during construction
- pre-finish audio test
- post-finish verification

### TV / display
- centerline/AFF
- viewing angle
- glare
- mount travel
- backbox
- ventilation
- power
- data/control
- service access
- soundbar geometry
- blocking/structure

### Rack
- RU
- depth
- weight
- UPS
- heat
- airflow direction
- ventilation
- cable management
- fiber bend radius
- patching
- labeling
- spare ports
- spare RU
- spare PoE
- service clearance

### Shade
- opening size
- pocket
- fabric
- roll direction
- light gaps
- side channels
- power/control
- access
- window hardware conflicts
- sprinkler/HVAC/light conflicts

### AP
- mounting material
- attenuation
- ceiling height
- hidden/visible
- metal obstruction
- cable route
- PoE
- RF overlap
- channel/power plan
- field validation
