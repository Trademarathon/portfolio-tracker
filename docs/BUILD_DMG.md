# Build a fully updated DMG (install replaces old app)

Use this when you want a **single DMG** built from your **latest project code**, and when installing you want it to **replace** the previous app completely.

## One command (on your Mac)

```bash
cd "/Users/ravi/Documents/portfolio tracker/portfolio-tracker"
npm run build:dmg:fresh
```

**Requires:** Node.js, npm, and **Rust** (install from https://rustup.rs if needed).

## What it does

1. **Full clean** — removes `.next`, `out`, old DMG, and Tauri bundle so nothing is reused.
2. **Builds Next.js** from your current source (production).
3. **Builds the Tauri app** (native shell + your built frontend).
4. **Creates the DMG** and copies it to the project root.

Output file:

- **`Trade Marathon®_0.1.0_aarch64.dmg`** (in the project folder)

## Install so the new app replaces the old one

1. Double-click the DMG.
2. Drag **Trade Marathon®** to **Applications**.
3. When macOS asks, choose **Replace** so the new version overwrites the old one.

You can share this same DMG file; others get the same fully updated app.

## Other scripts

| Command | Use case |
|--------|----------|
| `npm run build:dmg:fresh` | Fully updated DMG, clean build, install replaces old app (recommended). |
| `npm run build:dmg:optimized` | Same as above but uses the older script with `FULL_CLEAN=1`. |
| `npm run build:dmg` | Quick DMG from existing build (no clean). |
