TRACE RACING — GAMEPLAY v7

Replace:
index.html
style.css
game.js
manifest.json
sw.js

Keep icons/assets/brand unchanged.

v7:
- Reworked circuit: one coherent, non-crossing race circuit filling the play area.
- Long start/finish straight plus several distinct corners/hairpins/esses.
- Kerbs are attached to the road edge, never floating inside the road.
- Player drawing speed is sampled and used to drive race speed.
- Corner curvature reduces safe speed.
- Excessive corner-entry speed produces visible understeer/drift rather than ignoring the corner.
- Leaving the asphalt reduces effective speed.
- Turbo is a finite 100% reserve, consumed while held, with a visible meter.
- Right-hand controls and full-size play area retained.
- Long-press selection/callout and pull-to-refresh remain disabled.
- Service worker cache bumped to v7.
