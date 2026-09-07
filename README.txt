TRACE RACING — GAMEPLAY v4

Replace these root files:
index.html
style.css
game.js
manifest.json
sw.js

Keep existing icons/, assets/ and brand/ folders.

Major changes:
- Much larger play area: controls moved to a right-hand sidebar.
- Track fills the available height.
- Clear circuit direction with continuous asphalt, shoulders, proper alternating kerbs,
  START/CÉL gates and direction arrows.
- Removed the instruction card from the track surface.
- Drawing starts at START and must finish at CÉL.
- Race animation uses continuous interpolation rather than an integer-only index,
  fixing the previous "car appears but does not move" behaviour.
- Long-press text selection/callout is disabled.
- Overscroll / pull-to-refresh is disabled.
- Landscape is enforced as the game orientation.
