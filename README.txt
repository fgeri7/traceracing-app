Trace Racing v25

Physics redesign:
- The car now has an actual 2D velocity vector instead of moving by a route progress value.
- The speed recorded while drawing is throttle intent; it is not an automatic speed override.
- Tyre grip has a finite lateral acceleration limit.
- A fast entry into a sharp bend therefore keeps the car's momentum going outward instead of snapping it to the drawn line.
- Excessive cornering speed creates genuine speed scrub through tyre slip.
- Sideways motion does not count as lap progress.
- Leaving the asphalt adds strong surface drag.
- There is no artificial pre-braking based only on the existence of a corner.
- Deliberately slowing the drawing before a corner is therefore the correct strategy.
- Normal-speed corners retain stable line following; severe overspeed produces a predictable slide and recovery.
- Full-lap checkpoint validation and automatic PWA updates are preserved.
