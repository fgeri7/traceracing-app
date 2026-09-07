TRACE RACING — GAMEPLAY PROTOTYPE v2

Replaces the broken proof-of-concept gameplay.

Changes:
- Landscape-first game layout.
- Portrait devices show a rotate-phone prompt.
- No instruction panel over the track while drawing/racing.
- Real asphalt track with shoulders, curbs, start and finish.
- Drawing must begin at START and end at FINISH.
- The drawn line is rendered as a racing line, not a filled red blob.
- Race mode animates a car continuously along the drawn route.
- Finish is triggered only after the car reaches the end of the route.
- Service-worker cache version bumped to v2.

Replace:
index.html
style.css
game.js
manifest.json
sw.js

Do not replace the existing icons/assets with files from this ZIP.
