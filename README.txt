TRACE RACING – AUTO UPDATE v14

This package keeps the v13 gameplay and changes the PWA update/cache behavior.

IMPORTANT:
Replace/upload these files in the existing GitHub repository:
- index.html
- sw.js
- game.js
- style.css
- manifest.json

The icons already in the repository can remain unchanged.

WHAT CHANGED:
- App JS/CSS/HTML/manifest use a v14 cache-busting query string.
- Service Worker is network-first for app code, so the newest published version is preferred.
- Service Worker uses updateViaCache: "none" and an explicit update() check on every app launch.
- When a new Service Worker takes control, the page reloads automatically once.
- Old Service Worker caches are deleted during activation.
- If the network is unavailable, cached app files can still be used.

EXPECTED WORKFLOW:
1. Upload/replace the changed files in GitHub.
2. Wait only for GitHub Pages to publish the commit.
3. Open the app normally.
4. The app checks for the new Service Worker and reloads once if an update is available.

NOTE:
GitHub Pages itself still needs a short amount of time to publish a new commit. This change removes the extra waiting caused by the PWA's old cached app files.
