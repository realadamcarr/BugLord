# 🐛## ✨ Features

### 📸 **Bug Photography & Identification**

- Real-time camera with targeting reticle for bug capture
- AI-powered bug identification (species, rarity, traits)
- Photo storage and gallery integration
- Smart species recognition with confidence scoring

### 🐛 **Bug Collection System**

- **Rarity System**: Common, Uncommon, Rare, Epic, Legendary bugs
- **Biome Classification**: Forest, Garden, Wetland, Desert, Urban, Mountain, Meadow
- **Detailed Bug Cards**: Name, species, description, traits, catch location
- **Persistent Collection**: All discoveries saved with AsyncStorage

### 🏆 **Party Management**

- **Active Party**: Maximum 6 bugs in your active lineup
- **Strategic Selection**: Choose your best bugs for your party
- **Quick Swap**: Easy party management interface
- **Visual Display**: See your party bugs on the main hub

### 🎮 **RPG Progression System**

- **XP & Leveling**: Earn XP based on bug rarity (10-120 XP per catch)
- **Explorer Levels**: Level up every 100 XP as a bug explorer
- **Achievement System**: Track your collection milestones
- **Visual Progress**: Beautiful XP bars and level displaysive bug collecting app built with React Native and Expo. Capture real-world insects with your camera, build your collection, and become the ultimate BugLord! Use AI-powered identification to discover species, manage your 6-bug party, and level up as you explore the insect kingdom.

## ✨ Features

### � **Smart Note Taking**

- Create, edit, and complete notes with a beautiful interface
- Mark notes as complete to earn XP
- Persistent storage using AsyncStorage

### 🎮 **RPG Gamification System**

- **XP & Leveling**: Earn 10 XP per completed note
- **Character Progression**: Level up every 100 XP
- **Cosmetic Unlocks**: Unlock hats, outfits, accessories, and backgrounds
- **Visual Character**: Customizable sprite-based character display

### 🎨 **Character Customization**

- **Hats**: Baseball Cap, Crown, Wizard Hat, Party Hat
- **Outfits**: Casual, Formal, Superhero, Ninja
- **Accessories**: Sunglasses, Briefcase, Trophy
- **Backgrounds**: Forest, City, Space
- **Smart Sprite System**: Use custom sprites or emoji fallbacks

### 📱 **Modern UI/UX**

- Beautiful tab-based navigation
- Parallax scrolling effects
- Level-up celebrations with confetti
- Character preview in cosmetics showcase
- Responsive design for all screen sizes

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- Android Studio (for Android builds) or Xcode (for iOS builds)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/buglord.git
   cd buglord
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the development server**

   ```bash
   npm start
   ```

4. **Run on device/simulator**

   ```bash
   # Android
   npm run android
   
   # iOS
   npm run ios
   
   # Web
   npm run web
   ```

## 📱 Building APK

To create an APK for testing:

1. **Install EAS CLI**

   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**

   ```bash
   eas login
   ```

3. **Build APK**

   ```bash
   eas build --platform android --profile preview
   ```

## 🎨 Custom Sprites

The app supports custom character sprites! See [`SPRITE_GUIDE.md`](SPRITE_GUIDE.md) for detailed instructions on:

- Adding your own sprite artwork
- Recommended sprite specifications
- File naming conventions
- Enabling/disabling the sprite system

## 🛠️ Project Structure

```
buglord/
├── app/                    # Main app screens
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── index.tsx      # Notes screen (main)
│   │   ├── explore.tsx    # Character & stats screen
│   │   └── _layout.tsx    # Tab layout configuration
│   └── _layout.tsx        # Root layout
├── components/            # Reusable components
│   ├── Character.tsx      # Character display & logic
│   ├── CosmeticsShowcase.tsx  # Cosmetics grid
│   ├── SpriteAssets.ts    # Sprite loading system
│   └── ui/               # UI components
├── assets/               # Static assets
│   ├── images/          # App icons & images
│   └── sprites/         # Character sprite files
├── constants/           # App constants & themes
└── hooks/              # Custom React hooks
```

## 🎯 Key Components

### Character System

- **Character.tsx**: Main character display with cosmetics
- **SpriteAssets.ts**: Sprite loading with emoji fallbacks
- **CosmeticsShowcase.tsx**: Grid view of all cosmetics

### Game Logic

- **XP System**: 10 XP per completed note
- **Leveling**: Level up every 100 XP
- **Auto-equip**: Highest unlocked cosmetics are equipped
- **Persistence**: All progress saved locally

## 🔧 Configuration

### App Settings

- **app.json**: Expo configuration
- **eas.json**: Build configuration
- **tsconfig.json**: TypeScript settings

### Customization

- **Colors.ts**: App color scheme
- **Character.tsx**: Cosmetics & unlock levels
- **SpriteAssets.ts**: Sprite file mappings

## 📦 Dependencies

### Core

- **Expo**: ~52.0.11
- **React Native**: 0.76.3
- **React**: 18.3.1
- **TypeScript**: ^5.3.3

### Features

- **@react-native-async-storage/async-storage**: Data persistence
- **expo-router**: Navigation
- **react-native-reanimated**: Animations
- **expo-haptics**: Tactile feedback

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🎉 Acknowledgments

- Built with [Expo](https://expo.dev/)
- Icons from [Expo Vector Icons](https://icons.expo.fyi/)
- Inspired by RPG progression systems

---

**Turn your productivity into an adventure! 🗡️✨**
