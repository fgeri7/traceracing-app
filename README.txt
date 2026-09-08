TRACE RACING — GAMEPLAY v11

This is a deliberate simplification of the circuit and race engine.

- Track 01 is now a clean, long oval only.
- There is one continuous asphalt loop with clearly separated green infield.
- START/CÉL is a single official line; the player must return to it after travelling most of a full lap.
- Shortcuts/straight-line cuts are rejected by minimum travelled-distance validation.
- The player can draw directly on the canvas with touch/pointer input.
- The race car follows the player's drawn line exactly.
- Every drawing segment stores the actual finger speed in pixels/second.
- During the race the car's speed follows those measured drawing speeds.
- Turbo is finite and drains only while held.
- Landscape layout and long-press/pull-to-refresh protections remain.
- Service-worker cache is v11.

Replace index.html, style.css, game.js, manifest.json and sw.js.
Keep the existing icons/assets/brand folders.
