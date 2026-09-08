TRACE RACING — GAMEPLAY v9

Replace index.html, style.css, game.js, manifest.json and sw.js.
Keep icons/, assets/ and brand/.

v9 is a substantive gameplay/track correction:
- Replaced the previous self-merging circuit with a clearly separated single closed loop.
- Road sections have deliberate green infield gaps between them.
- Narrower road and proper kerbs make the circuit readable at a glance.
- The circuit has an outer lap plus a deep inner hairpin, with several distinct corners.
- Race button and redraw button use explicit Android-safe click handlers.
- Drawing speed is sampled in actual canvas pixels/sec.
- Race progress is calculated from that physical drawing speed and elapsed time.
- On straights, car speed directly follows the user's drawn speed.
- Corner speed is reduced only when the entry speed exceeds a curvature-dependent threshold.
- Excessive corner entry creates lateral slip/drift.
- Leaving the asphalt reduces speed.
- Turbo remains finite at 100% and is consumed only while held.
- Landscape/overscroll/long-press protections retained.
- Service-worker cache bumped to v9.
