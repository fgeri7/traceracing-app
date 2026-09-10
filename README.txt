Trace Racing v29

This version keeps the stable drawn-line following from v16 and adds a speed-sensitive tyre/grip model.

Corner behaviour:
- Normal speed: the car closely follows the player's drawn racing line.
- High speed + sharp corner: required lateral grip rises with speed^2 and route curvature.
- If grip is exceeded, the car develops outward lateral velocity and drifts outside the drawn line.
- The slide scrubs speed, creating a time penalty.
- As speed falls and grip returns, spring/damper recovery brings the car smoothly back toward the drawn line.

The route itself is still exactly the player's drawn path. No predefined racing line replaces it.
