# 🐛 BugLord

> **Combining Entomology and gamification to make learning about insects and their role in the ecosystem fun and engaging.**

BugLord is a cross-platform mobile app built with **React Native + Expo**. Players use their phone camera to photograph real-world insects, which the app identifies using an on-device AI model. Discovered bugs are added to a personal collection, organized into a 6-bug party, and used to progress through an RPG-style leveling system — rewarding real-world exploration and ecological curiosity.

---

## 📲 Live Demo

A pre-built Android APK is available for immediate testing — no build environment required.

**Download APK:**
[https://expo.dev/accounts/stackzilla/projects/note-quest/builds/c58d5694-2db5-4d17-af71-4c885d933b44](https://expo.dev/accounts/stackzilla/projects/note-quest/builds/c58d5694-2db5-4d17-af71-4c885d933b44)

> **To install:** Download the APK, transfer to your Android device, and enable *Install from Unknown Sources* in your device settings before installing.

---

## ✨ Features

### 📸 Bug Photography & AI Identification
- Real-time camera with a targeting reticle for capturing insects
- On-device TFLite model identifies species from your photo
- Confidence scoring and species metadata returned per identification
- Graceful fallback if identification confidence is below threshold

### 🐛 Bug Collection System
- **Rarity Tiers:** Common → Uncommon → Rare → Epic → Legendary
- **Biome Classification:** Forest, Garden, Wetland, Desert, Urban, Mountain, Meadow
- **Detailed Bug Cards:** Species name, description, traits, catch location, and rarity badge
- **Persistent Storage:** Full collection saved locally with AsyncStorage

### 🏆 Party Management
- Maintain an active party of up to **6 bugs**
- Swap bugs in and out of your lineup strategically
- Visual party display on the main hub screen

### 🎮 RPG Progression System
- **XP per catch:** 10 XP (Common) up to 120 XP (Legendary)
- **Explorer Levels:** Level up every 100 XP
- **Achievement Milestones:** Track collection progress and exploration goals
- **Visual Feedback:** XP bars, level-up celebrations, and progress indicators

### 🐝 Hive Mode
- A cooperative/competitive mode centered around insect ecosystem roles
- Item system tied to bug types and biomes
- See `docs/features/HIVE_MODE_README.md` for full details

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Mobile Framework | React Native + Expo (SDK ~52) |
| Language | TypeScript |
| Navigation | Expo Router (file-based) |
| Styling | NativeWind (Tailwind for RN) |
| Backend / Auth / DB | Firebase (Firestore, Auth, Functions) |
| ML / Bug ID | TensorFlow Lite (converted from YOLO) |
| Animations | React Native Reanimated |
| Storage (local) | AsyncStorage |
| Build System | EAS Build (Expo Application Services) |

---

## 📁 Project Structure

```
BugLord/
├── app/                        # Screen files (Expo Router)
│   ├── (tabs)/                 # Tab navigation screens
│   │   ├── index.tsx           # Main hub / collection view
│   │   ├── camera.tsx          # Bug capture screen
│   │   ├── party.tsx           # Party management screen
│   │   └── _layout.tsx         # Tab bar configuration
│   └── _layout.tsx             # Root layout / providers
│
├── components/                 # Reusable UI components
│   ├── BugCard.tsx             # Bug display card
│   ├── PartySlot.tsx           # Party member slot
│   ├── CameraReticle.tsx       # Camera targeting overlay
│   └── ui/                     # Generic UI primitives
│
├── contexts/                   # React Context providers
│   └── GameContext.tsx         # Global game state (XP, level, collection)
│
├── hooks/                      # Custom React hooks
│   └── useBugIdentification.ts # ML inference hook
│
├── services/                   # External integrations
│   ├── firebase.ts             # Firebase initialization
│   ├── firestore.ts            # Firestore read/write helpers
│   └── bugIdentification.ts   # TFLite model wrapper
│
├── models/                     # ML model file(s)
│   └── bug_detector.tflite    # On-device insect detection model
│
├── training/                   # Python scripts for model training
│   └── (YOLO training pipeline — see docs/ml/)
│
├── backend/                    # Firebase Cloud Functions
│   └── functions/
│
├── assets/                     # Static assets
│   ├── images/                 # App icons, splash screens
│   └── bugs/                   # Bug artwork and thumbnails
│
├── constants/                  # App-wide constants
│   └── Colors.ts               # Color palette
│
├── types/                      # TypeScript type definitions
│   └── bug.ts                  # Bug, Rarity, Biome interfaces
│
├── utils/                      # Utility / helper functions
│
├── scripts/                    # Build and utility scripts
│   ├── build-apk.sh
│   ├── build-apk.bat
│   └── download_model.ps1
│
├── docs/                       # Extended documentation
│   ├── ml/                     # ML model guides
│   ├── features/               # Feature-specific docs
│   └── build/                  # APK and deployment guides
│
├── __tests__/                  # Unit and integration tests
├── app.json                    # Expo app configuration
├── eas.json                    # EAS Build profiles
├── firebase.json               # Firebase project config
├── firestore.rules             # Firestore security rules
├── package.json
└── tsconfig.json
```

---

## 🚀 Getting Started

### Prerequisites

Ensure the following are installed before proceeding:

- **Node.js** v18 or higher — [nodejs.org](https://nodejs.org)
- **npm** v9+ (bundled with Node) or **yarn**
- **Expo CLI** — `npm install -g expo-cli`
- **EAS CLI** (for builds) — `npm install -g eas-cli`
- **Android Studio** (for Android emulator) or **Xcode** (for iOS simulator)
- A **Firebase project** (see Firebase Setup below)

---

### 1. Clone the Repository

```bash
git clone https://github.com/realadamcarr/BugLord.git
cd BugLord
```

---

### 2. Install Dependencies

```bash
npm install
```

---

### 3. Firebase Setup

BugLord uses Firebase for authentication, Firestore database, and Cloud Functions.

#### 3a. Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** and follow the prompts
3. Enable **Authentication** → Sign-in method → Email/Password (and any others you want)
4. Enable **Cloud Firestore** in production or test mode
5. Enable **Cloud Functions** if using the backend module

#### 3b. Register Your App

- In the Firebase console, click **Add app** → iOS and/or Android
- For Android: enter the package name from `app.json` (`com.stackzilla.buglord` or similar)
- For iOS: enter the bundle ID from `app.json`
- Download the config files:
  - Android → `google-services.json` → place in `/android/app/`
  - iOS → `GoogleService-Info.plist` → place in `/ios/BugLord/`

#### 3c. Environment Variables

Create a `.env` file in the project root (never commit this file):

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

These values are found in your Firebase project settings under **General → Your apps → SDK setup**.

#### 3d. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

---

### 4. ML Model Setup

The bug identification model must be present for the camera identification feature to work.

```bash
# Option A — PowerShell (Windows)
./download_model.ps1

# Option B — place manually
# Copy your bug_detector.tflite file into the /models directory
```

See `docs/ml/ML_INTEGRATION_SUMMARY.md` for full details on the model and `docs/ml/YOLO_TO_TFLITE_CONVERSION.md` for how it was trained and converted.

---

### 5. Run the Development Server

```bash
npx expo start
```

This opens the Expo Developer Tools. From here:

- Press **`a`** to launch on an Android emulator
- Press **`i`** to launch on an iOS simulator
- Scan the **QR code** with the Expo Go app on a physical device

---

## 📱 Building a Release APK / IPA

BugLord uses **EAS Build** for generating release binaries.

### Android APK (Preview Build)

```bash
# Login to your Expo account
eas login

# Build a preview APK (no signing required)
eas build --platform android --profile preview
```

### iOS (Ad-hoc / TestFlight)

```bash
eas build --platform ios --profile preview
```

Build profiles are configured in `eas.json`. See `docs/build/APK_BUILD_GUIDE.md` for detailed instructions including local builds.

---

## 🔒 What's Excluded from the Repository

The following are intentionally **not committed** to source control:

| Excluded Item | Reason |
|---|---|
| `node_modules/` | Regenerated via `npm install` |
| `.env` | Contains private API keys |
| `google-services.json` | Firebase credentials — private |
| `GoogleService-Info.plist` | Firebase credentials — private |
| `dist/` | Build output — not source |
| `*.tflite` (large models) | Binary assets managed separately |

---

## 🗺 Roadmap

- [ ] iNaturalist API integration for extended species data
- [ ] Social features — compare collections with friends
- [ ] Augmented Reality bug overlay mode
- [ ] Expanded Hive Mode multiplayer events
- [ ] iOS App Store and Google Play release

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to your branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 👥 Team

Built by the BugLord team as part of a software engineering capstone project.

---

*Turn the world around you into a living Pokédex. 🌿🐛*
