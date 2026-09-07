TRACE RACING — GAMEPLAY v3

Main fixes:
- Landscape-first layout with much better use of the available screen.
- Portrait devices show a rotate prompt.
- The instruction overlay has been removed from the track.
- The track is drawn as a clearly visible asphalt circuit with shoulders, kerbs, START and CÉL.
- The player's route remains a line; it is never filled as a red polygon.
- Drawing must start at START and finish near CÉL.
- The car moves continuously along the drawn route.
- Finish only occurs at the end of the route.
- Long-press text selection / callout UI is suppressed with user-select and touch-callout CSS.
- Pull-to-refresh / overscroll is suppressed with overscroll-behavior.
- Context menu is suppressed on the game canvas.
- Service-worker cache bumped to v3.

Replace these five root files:
index.html
style.css
game.js
manifest.json
sw.js

Keep the existing icons/assets folders.
