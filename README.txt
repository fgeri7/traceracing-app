TRACE RACING — GAMEPLAY v10

This version is a substantive rewrite of the track and race engine.

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

V10 goals:
1. One continuous, clearly separated circuit.
2. Start and finish are on the same road but separated by the full lap.
3. The drawing must pass ordered checkpoints around the whole circuit.
   A short shortcut to the finish is rejected.
4. The player's measured finger speed is stored per section of the drawing.
5. During the race, the car's target speed follows those measured speeds.
6. Corner curvature only penalizes the car when the entry speed is too high.
7. Excessive corner speed causes lateral slip/drift.
8. Off-road drawing reduces speed.
9. Turbo is finite (100%) and drains while held.
10. Race and redraw buttons use explicit Android-safe handlers.
11. Landscape-first layout and overscroll/long-press protections remain.
12. Service-worker cache is v10.
