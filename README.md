# Western Shooter — Mobile Game

A **touch-first western shooting-gallery game** playable in any mobile browser, installable as a PWA, and packagable as a native app with [Capacitor](https://capacitorjs.com/).

## Gameplay

- **Enter the bar** through the saloon door
- **Outlaws** (up to 4 at once) hide behind barrels and tables, then peek out to shoot you
- **Tap an outlaw** before it shoots you — but you only have **6 bullets**!
- A **warning `!`** flashes above an outlaw a split-second before it fires
- **Tap RELOAD** (or the cylinder UI) to reload — takes 2 seconds, so plan ahead
- Survive **waves** — each wave brings more outlaws, faster spawns, and tougher enemies (2 HP from wave 3)

## Controls

| Action | How |
|--------|-----|
| Shoot  | Tap an enemy |
| Reload | Tap the **RELOAD** button (bottom-right) or tap when empty |
| Restart | Tap **PLAY AGAIN** on the game-over screen |

## Technology

| Layer | Choice | Reason |
|-------|--------|--------|
| Rendering | **HTML5 Canvas 2D** | Zero dependencies, runs everywhere |
| Scripting | **Vanilla JavaScript (ES2020)** | No build step, instant load |
| Mobile packaging | **Capacitor 6** | Wraps any web app into a native Android/iOS binary |
| PWA | Service Worker + Web App Manifest | Installable, offline-capable |

No external libraries or CDN dependencies — the game is 100 % self-contained.

## Running locally

```bash
# Quick start with any static-file server
npx serve .
# Then open http://localhost:3000 in a browser
```

## Building for native mobile (Android / iOS)

```bash
npm install

# Android
npm run android
# Opens Android Studio; build & run on device / emulator

# iOS (macOS + Xcode required)
npm run ios
# Opens Xcode; build & run on device / simulator
```

## Project structure

```
western-shooter/
├── index.html             Entry point (PWA-ready)
├── style.css              Minimal mobile-first styles
├── game.js                Complete game logic (~650 lines)
├── manifest.json          Web App Manifest (PWA)
├── sw.js                  Service Worker (offline caching)
├── capacitor.config.json  Native mobile config
└── package.json           npm scripts + Capacitor deps
```

## Extending the game

- **More cover slots** → add objects to the `COVERS` array in `game.js`
- **New outlaw types** → extend the `OUTFITS` array
- **Sound effects** → add `Audio` calls inside `fireAt()`, `enemyShoot()`, `takeDamage()`
- **Sprite sheets** → replace the procedural `drawEnemy()` Canvas calls with `drawImage()`
