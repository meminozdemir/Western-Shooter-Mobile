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
| Mobile packaging | **Capacitor 6** _or_ **SwiftUI + WKWebView** | See below |
| PWA | Service Worker + Web App Manifest | Installable, offline-capable |

No external libraries or CDN dependencies — the game is 100 % self-contained.

## Running locally

```bash
# Quick start with any static-file server
npx serve .
# Then open http://localhost:3000 in a browser
```

## Building for native mobile (Android / iOS via Capacitor)

```bash
npm install

# Android
npm run android
# Opens Android Studio; build & run on device / emulator

# iOS (macOS + Xcode required)
npm run ios
# Opens Xcode; build & run on device / simulator
```

## Building for iOS — pure SwiftUI + WKWebView (no Capacitor)

The `ios/` folder contains a ready-to-open Xcode 15 project that wraps the game in
a native SwiftUI shell with zero third-party dependencies.

### Requirements

| Tool | Minimum version |
|------|----------------|
| macOS | Ventura 13 |
| Xcode | 15 |
| iOS deployment target | 16.0 |

### Quick start

```bash
open ios/WesternShooterApp.xcodeproj
```

Select a simulator or a connected device, then press **⌘ R** to build and run.

### What the native shell does

| Feature | Implementation |
|---------|---------------|
| Wraps the game | `WebGameView.swift` — `UIViewRepresentable` around `WKWebView` |
| Landscape-only | `AppDelegate` returns `.landscape` mask + `Info.plist` keys |
| Full-screen / notch | `.ignoresSafeArea()` in `ContentView` |
| Home Indicator hidden | `.persistentSystemOverlays(.hidden)` (iOS 16+) |
| Scroll disabled | `scrollView.isScrollEnabled = false` + `bounces = false` |
| Zoom disabled | `minimumZoomScale = maximumZoomScale = 1.0` + JS viewport script |
| No external navigation | `WKNavigationDelegate` blocks non-file:// link clicks |
| Background colour | Matches game's `#1A0800` — no white flash on load |

### iOS project structure

```
ios/
├── WesternShooterApp.xcodeproj/
│   └── project.pbxproj          Xcode project (Xcode 15 / objectVersion 56)
└── WesternShooterApp/
    ├── WesternShooterApp.swift   @main App entry-point + AppDelegate (landscape lock)
    ├── ContentView.swift         SwiftUI root view (ignoresSafeArea, hide home indicator)
    ├── WebGameView.swift         UIViewRepresentable / WKWebView wrapper
    ├── Info.plist                Landscape-only orientations, status bar hidden
    ├── Assets.xcassets/          Asset catalog (add your 1024×1024 AppIcon here)
    └── WebApp/                   Bundled web game files (folder reference in Xcode)
        ├── index.html
        ├── game.js
        ├── style.css
        ├── manifest.json
        ├── icon-192.png
        └── icon-512.png
```

### Customising the Bundle ID

In Xcode → Project navigator → select **WesternShooterApp** → **Signing & Capabilities**,
change the Bundle Identifier from `com.studioname.westernshooter` to your own
(e.g. `com.mystudio.westernshooter`).

Alternatively edit `PRODUCT_BUNDLE_IDENTIFIER` in
`ios/WesternShooterApp.xcodeproj/project.pbxproj`.

### Keeping game files in sync

`ios/WesternShooterApp/WebApp/` is an independent copy of the web assets.
After editing `game.js`, `style.css`, or `index.html` in the repo root,
copy the changed files into `WebApp/` so the iOS build picks them up:

```bash
cp game.js style.css index.html manifest.json ios/WesternShooterApp/WebApp/
```

### Adding the WebApp folder to Xcode (if you re-create the project)

When dragging the `WebApp/` folder into the Xcode project navigator, choose
**"Create folder references"** (the blue-folder option) — **not** "Create groups".
This ensures the entire folder is copied into the app bundle as-is, preserving
the relative paths that `game.js` and `style.css` rely on.

## Project structure

```
western-shooter/
├── index.html             Entry point (PWA-ready)
├── style.css              Minimal mobile-first styles
├── game.js                Complete game logic (~650 lines)
├── manifest.json          Web App Manifest (PWA)
├── sw.js                  Service Worker (offline caching)
├── capacitor.config.json  Native mobile config (Capacitor)
├── package.json           npm scripts + Capacitor deps
└── ios/                   Native iOS project (SwiftUI + WKWebView)
```

## Extending the game

- **More cover slots** → add objects to the `COVERS` array in `game.js`
- **New outlaw types** → extend the `OUTFITS` array
- **Sound effects** → add `Audio` calls inside `fireAt()`, `enemyShoot()`, `takeDamage()`
- **Sprite sheets** → replace the procedural `drawEnemy()` Canvas calls with `drawImage()`
