TRACE RACING — GAMEPLAY v6

Replace:
- index.html
- style.css
- game.js
- manifest.json
- sw.js

Keep icons/assets/brand unchanged.

v6 fixes the screenshot issue where the track was rendered only in the left portion
of the play area. The canvas now observes the actual flex container size with
ResizeObserver, so its internal drawing coordinate system always matches the
visible play area.

The circuit was also redesigned to use substantially more of the available width
and height while remaining a single readable circuit.

The right-side control panel remains separate from the track.

Global app UX rules remain:
- landscape-first
- no text selection / long-press text callout
- no pull-to-refresh / overscroll
- no canvas context menu
