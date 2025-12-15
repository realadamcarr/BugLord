# Copilot Instructions for BugLord

Purpose: Make AI coding agents immediately productive in this Expo React Native app by documenting the architecture, workflows, and project-specific conventions.

## Quick Start
- Run dev server: `npm start` (Expo + Metro).
- Open platforms: press `a` (Android), `w` (web) in the Expo CLI UI, or run `npm run android` / `npm run web`.
- Lint: `npm run lint`.

## Build & APKs
- Cloud builds (recommended): `eas build --platform android --profile preview` (see `eas.json`). Owner is `stackzilla`; projectId in `app.json` under `extra.eas.projectId`.
- Local APK: `cd android; gradlew assembleRelease` (see `build-local-apk.bat`). Prebuild native with `npx expo prebuild --platform android` if needed.
- Helper scripts: `start-android.bat`, `build-apk.bat`, `build-test-apk.bat`, and guide `APK_BUILD_GUIDE.md`.

## Architecture (Big Picture)
- Navigation: Expo Router (file-based) under `app/`.
  - Root stack in `app/_layout.tsx` wraps providers and renders `(tabs)` layout.
  - Tabs defined in `app/(tabs)/_layout.tsx` with three screens: `index` (Capture), `train`, `player`.
- State & Persistence: `contexts/BugCollectionContext.tsx` manages the collection and party state, persisted via `AsyncStorage` under key `bug_collection_data`.
- Theming: `contexts/ThemeContext.tsx` provides a system-driven light/dark theme and a `useTheme()` hook; no manual toggle (system-only).
- Domain Types & Config: `types/Bug.ts` defines `Bug`, rarity/biome enums, XP ranges, and `SAMPLE_BUGS` used in AI fallbacks.
- Services:
  - `services/ImageProcessingService.ts`: crops insect from photos and generates a pixelated icon using `expo-image-manipulator`. Falls back to a center-crop when detection fails.
  - `services/BugIdentificationService.ts`: multi-tier identification (iNaturalist → Google Vision → local heuristic). Returns `BugIdentificationResult` enriched with rarity/biome/traits.

## Capture → Identify → Add Flow
1. `app/(tabs)/index.tsx` opens `<BugCamera>` to capture a photo.
2. On capture, it calls `imageProcessingService.processInsectPhoto()` to crop + pixelate icon.
3. Then `bugIdentificationService.identifyBug()` runs API chain; result is shown in `BugInfoModal` and on confirm is saved via `addBugToCollection()` and optionally `addBugToParty()`.
4. Recent discoveries and party are rendered using the shared rarity colors from `types/Bug.ts`.

## Project Conventions
- Imports use path alias `@/*` mapped to repo root (see `tsconfig.json`). Prefer `@/...` instead of relative paths.
- Typed routes are enabled (`app.json → experiments.typedRoutes: true`). Keep screen files colocated under `app/`.
- Party is always 6 slots (`BugCollection.party`), with `null` for empty; use `addBugToParty`, `removeBugFromParty`, `swapPartySlots` from context—do not mutate arrays directly.
- Leveling: player levels every 100 XP (`BugCollectionContext.gainXP`). Bug XP bars in Train screen are derived from `bug.xp / bug.maxXp`.
- Rarity colors and XP ranges come from `RARITY_CONFIG`—re-use instead of duplicating color literals.
- Theme: use `useTheme()` and `ThemedView`/`ThemedText` components for colors; do not hardcode palette except where already established.

## External Integrations & Config
- Camera: `expo-camera` (permissions defined in `app.json` under `android.permissions`). Captures save to gallery via `expo-media-library` where allowed.
- Image manipulation: `expo-image-manipulator` for crop/pixelation; returns file URIs (PNG/JPEG).
- AI Identification:
  - iNaturalist (free) is enabled by default (simulated response currently).
  - Google Vision is optional; set `API_CONFIG.GOOGLE_VISION.API_KEY` and flip `ENABLED: true` in `BugIdentificationService.ts` to activate.
  - Local analysis fallback uses `SAMPLE_BUGS` with weighted rarity.

## Patterns to Follow (Examples)
- Add a new tab: create `app/(tabs)/newtab.tsx` and export a component; the label/icon is configured in `app/(tabs)/_layout.tsx` via `Tabs.Screen`.
- Add a new collection action: extend `BugCollectionContext` API and wire UI via `useBugCollection()`—persisted automatically via `saveCollection()` effect.
- Show themed UI: wrap content in `ThemedView` and use `theme.colors.*` for styles; see `app/(tabs)/player.tsx` and `components/XPProgressBar.tsx`.

## Gotchas
- `app.json.slug` is currently `note-quest` while the app name is BugLord; keep consistent if you change slugs since EAS uses it for project linking.
- When enabling Google Vision, ensure requests use base64 content; the service already formats the payload.
- Android builds may require prebuild if you introduce native modules: run `npx expo prebuild` and commit changes as needed.

## Useful Files
- `app/_layout.tsx`, `app/(tabs)/*`: routing and screens
- `contexts/ThemeContext.tsx`, `contexts/BugCollectionContext.tsx`: providers and hooks
- `services/ImageProcessingService.ts`, `services/BugIdentificationService.ts`
- `types/Bug.ts`: domain model and constants
- `APK_BUILD_GUIDE.md`, `eas.json`, `app.json`: build/config

If any part is unclear or you need deeper guidance on a specific flow (e.g., swapping bugs in party or persisting new fields), tell me which section to refine and I’ll iterate.