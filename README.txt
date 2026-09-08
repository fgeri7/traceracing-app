TRACE RACING — GAMEPLAY v13

Focused gameplay correction.

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

V13:
- Simple single continuous oval circuit.
- Full-lap validation uses 28 ordered checkpoints around the entire oval.
- A tiny loop near START cannot satisfy the checkpoint sequence.
- The drawn route must return to the official START/CÉL gate.
- Race route is the player's actual drawn polyline.
- Every drawn segment stores measured finger speed.
- Car target speed follows those measured per-segment speeds.
- Off-road drawn routes are slowed significantly.
- Excessive corner entry speed causes speed loss, reduced steering grip and visible lateral drift.
- Sliding creates time loss by reducing speed.
- Race button validates the full lap again immediately before starting.
- Service-worker cache bumped to v13.
