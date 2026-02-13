# 🐛 BugLord

An immersive bug-collecting app built with React Native and Expo. Capture real-world insects with your camera, build your collection, and become the ultimate BugLord! Uses AI-powered identification to discover species, manage your 6-bug party, and level up as you explore the insect kingdom.

---

## ✨ Features

### 📸 Bug Scanning & Identification
- Real-time camera with targeting reticle for bug capture
- AI-powered multi-tier identification (iNaturalist → Google Vision → local heuristic)
- On-device ML inference when TFLite model is available; falls back to API/stub otherwise
- Photo storage and gallery integration via `expo-media-library`

### 🐛 Collection & Logs
- **Rarity System**: Common, Uncommon, Rare, Epic, Legendary
- **Biome Classification**: Forest, Garden, Wetland, Desert, Urban, Mountain, Meadow
- **Detailed Bug Cards**: Name, species, description, traits, catch location
- **Persistent Collection**: All discoveries saved with AsyncStorage

### 🏆 Party Management
- 6-slot active party lineup
- Strategic selection and quick swap interface
- Visual party display on the main hub

### 🎮 RPG Progression
- XP & Leveling — earn XP based on bug rarity (10–120 XP per catch)
- Explorer levels every 100 XP
- XP progress bars and level displays

### 🚶 Walk Mode
- GPS-driven encounters while walking
- Step tracking with expo-sensors
- Biome-aware spawns

### ⚔️ Hive Mode *(planned)*
- PvE battles using your bug party
- Item system with loot and buffs

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54 / React Native 0.81 |
| Navigation | Expo Router (file-based) |
| State | React Context + AsyncStorage |
| Camera | expo-camera |
| Image Processing | expo-image-manipulator |
| ML Inference | react-native-fast-tflite (stub until model ships) |
| Theming | System-driven light/dark via ThemeContext |

---

## 🚀 Setup & Run

### Prerequisites
- Node.js ≥ 18, npm
- Expo CLI (`npx expo`)
- Android Studio (for Android builds) or Xcode (for iOS)

### Install & Start
```bash
git clone https://github.com/yourusername/buglord.git
cd buglord
npm install
npm start          # press 'a' for Android, 'w' for web
```

### Run on Device
```bash
npm run android    # Android emulator / device
npm run web        # Web browser
```

---

## 📦 Build Notes (EAS)

Cloud builds are recommended:

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview   # APK for testing
eas build --platform android --profile production # release build
```

Local APK (requires Android SDK):
```bash
npx expo prebuild --platform android
cd android && gradlew assembleRelease
```

See [APK_BUILD_GUIDE.md](APK_BUILD_GUIDE.md) for detailed instructions.

> **Demo Mode**: In Expo Go, native modules (TFLite, dev-client) are unavailable. The app gracefully falls back to stub/API identification so the full UI flow still works.

---

## 📂 Project Structure

```
buglord/
├── app/                        # Screens (Expo Router file-based)
│   ├── _layout.tsx             # Root layout + providers
│   ├── (tabs)/
│   │   ├── _layout.tsx         # Tab bar config
│   │   ├── index.tsx           # Capture screen
│   │   ├── train.tsx           # Train / XP screen
│   │   └── player.tsx          # Player profile
│   ├── hivemode.tsx            # Hive Mode screen
│   ├── inventory.tsx           # Inventory screen
│   └── walkmode.tsx            # Walk Mode screen
├── components/                 # Reusable UI components
│   ├── BugCamera.tsx
│   ├── BugInfoModal.tsx
│   ├── ManualCropper.tsx
│   ├── CollectionScreen.tsx
│   └── ui/                     # Low-level UI primitives
├── contexts/                   # React Context providers
│   ├── BugCollectionContext.tsx # Collection, party, XP state
│   ├── InventoryContext.tsx     # Item inventory state
│   └── ThemeContext.tsx         # Light/dark theme
├── services/                   # Business logic & APIs
│   ├── BugIdentificationService.ts
│   ├── ImageProcessingService.ts
│   ├── WalkModeService.ts
│   ├── HiveBattleService.ts
│   └── ml/                     # ML inference pipeline
│       ├── OnDeviceClassifier.ts
│       ├── MLPreprocessingService.ts
│       └── ModelUpdateService.ts
├── types/                      # TypeScript domain types
│   ├── Bug.ts
│   ├── HiveMode.ts
│   └── Item.ts
├── constants/                  # Colors, item defs
├── assets/                     # Images, fonts, sprites, ML labels
├── app.json                    # Expo config
├── eas.json                    # EAS build profiles
└── package.json
```

---

## ⚠️ Known Limitations

- **TFLite stub mode**: On-device ML returns mock predictions until a trained model is bundled. The full capture → crop → classify UI still works.
- **ManualCropper**: Simplified crop UI (no drag/pinch gestures yet).
- **Upload / Model Update services**: Coded and ready but require a backend server to activate.
- **Expo Go**: Native modules (TFLite, dev-client) are unavailable; the app falls back gracefully.

---

## 🗺️ Roadmap

- [ ] Train and ship real TFLite insect classification model
- [ ] Backend for dataset upload and model OTA updates
- [ ] Full Hive Mode PvE battles with item integration
- [ ] Walk Mode encounter polish and biome detection
- [ ] iOS build support and App Store submission
- [ ] Leaderboards and social features

---

## 📄 License

MIT — see [LICENSE](LICENSE).
