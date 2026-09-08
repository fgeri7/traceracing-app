TRACE RACING — GAMEPLAY v12

This is a focused correction of the race interaction.

Replace:
- index.html
- style.css
- game.js
- manifest.json
- sw.js

Keep:
- icons/
- assets/
- brand/

V12:
- Race button is bound directly with addEventListener; no inline handler dependency.
- Pressing VERSENY immediately creates and draws the car before the animation loop.
- The car follows the player's actual drawn polyline, not the predefined track.
- Each drawn segment stores the measured finger speed in canvas pixels/second.
- The race uses those per-segment speeds directly, with only light smoothing.
- The player only needs to draw a sufficiently long route starting and ending at the official gate.
- Removed the fragile theoretical circumference check that could reject a valid full oval.
- Turbo remains finite.
- Service-worker cache bumped to v12.
