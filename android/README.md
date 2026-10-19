# 📱 Naura OS Android Native Wrapper

A high-performance, edge-to-edge native Android wrapper for the Naura Hoshino V2 Mobile Dashboard PWA.

---

## 🌟 Overview & Architecture

Naura OS Android combines the flexibility of modern responsive web development (Vite + Tailwind CSS + PWA) with the performance, deep OS integration, and stability of a native Android application.

```text
┌──────────────────────────────────────────────────────────────────┐
│                      NAURA OS ANDROID WRAPPER                    │
├──────────────────────────────────────────────────────────────────┤
│ 1. MainActivity (ComponentActivity)                              │
│    • Edge-to-Edge System Bars (#0B0F19 cyber dark)               │
│    • SwipeRefreshLayout (#FFB6C1 / #00FFFF brand accents)       │
│    • Hardware Accelerated WebView                                │
├──────────────────────────────────────────────────────────────────┤
│ 2. WebViewAssetLoader (Secure Asset Serving)                     │
│    • Domain: https://appassets.androidplatform.net/assets/www/   │
│    • Bundled offline-ready web application                       │
├──────────────────────────────────────────────────────────────────┤
│ 3. NauraNativeBridge (window.NauraNative)                        │
│    • getAppVersion(), isOnline(), vibrate(), showToast()         │
│    • copyToClipboard(), openExternal(), reload()                 │
├──────────────────────────────────────────────────────────────────┤
│ 4. Seamless Fallback & External Routing                          │
│    • Chrome Custom Tabs for OAuth & external links               │
│    • Offline screen (offline.html) with auto-reconnect listener  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

1. **Hardware-Accelerated WebView**:
   - Smooth 60 FPS animations and transitions.
   - Local bundled storage and DOM storage enabled.
   - Mixed content mode configured safely with restrictive file access flags.

2. **JavaScript Interface Bridge (`window.NauraNative`)**:
   - `getAppVersion()`: Returns current Android wrapper version (`2.3.0`).
   - `isOnline()`: Checks active network capability in real-time.
   - `vibrate(durationMs)`: Native haptic feedback via Vibrator / VibratorManager.
   - `showToast(message)`: Native Android toast notification.
   - `copyToClipboard(text)`: Native clipboard management.
   - `openExternal(url)`: Opens links in Chrome Custom Tabs without leaving app task.
   - `reload()`: Safely reloads or navigates back from offline mode.

3. **Offline Resilience**:
   - Built-in `offline.html` styled with cyber-sakura theme (`#0B0F19`, `#FFB6C1`, `#00FFFF`).
   - Automatically detects internet restoration via `window.addEventListener('online')` and auto-reloads.

4. **Brand Design System**:
   - Adaptive launcher icons matching the 3D Naura mascot.
   - Dark theme system status bar and navigation bar.
   - Native pull-to-refresh with dual-color palette.

---

## 🛠️ Build & Development Commands

From the repository root (`d:\Naura Hoshino V2`):

```powershell
# 1. Synchronize mobile web assets into Android project
npm run mobile:sync-android

# 2. Build the production debug APK
npm run android:build
```

The compiled APK will be verified and staged at:
- `android/app/build/outputs/apk/debug/app-debug.apk`
- `dashboard/dist/naura-os-mobile.apk`

---

## 📂 Project Structure

```text
android/
├── app/
│   ├── build.gradle.kts          # App-level build configuration and dependencies
│   └── src/
│       └── main/
│           ├── AndroidManifest.xml # Permissions, activity declarations
│           ├── assets/
│           │   └── www/          # Bundled mobile web build (synced via script)
│           ├── java/com/naura/dashboard/
│           │   ├── MainActivity.kt        # Main WebView container activity
│           │   ├── NauraNativeBridge.kt   # JavaScript bridge interface
│           │   ├── NauraWebChromeClient.kt# Progress bar and file chooser
│           │   └── NauraWebViewClient.kt  # AssetLoader and Custom Tabs router
│           └── res/              # Layouts, adaptive icons, themes, and strings
├── gradle/
│   └── libs.versions.toml        # Gradle Version Catalog
├── build.gradle.kts              # Root build configuration
└── settings.gradle.kts           # Module settings
```
