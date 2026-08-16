# BugLord App Icon Update Instructions

## Your New Caterpillar Icon

The attached green caterpillar image is perfect for BugLord! Here's how to set it up:

### Steps to Replace App Icons:

1. **Save the caterpillar image** to your computer first
2. **Resize the image** to the following dimensions (you can use any image editor):
   - **1024x1024** pixels for the main icon
   - Make sure it's a PNG file with transparency if needed

3. **Replace these files** in `assets/images/` with your caterpillar image:
   - `icon.png` (1024x1024) - Main app icon
   - `adaptive-icon.png` (1024x1024) - Android adaptive icon
   - `favicon.png` (256x256) - Web favicon
   - `splash-icon.png` (1024x1024) - Splash screen icon

### Automatic Setup Script:

If you have the caterpillar image saved as `caterpillar.png` in your Downloads folder, run:

```bash
# Copy your caterpillar image to the project (update the path as needed)
copy "C:\Users\%USERNAME%\Downloads\caterpillar.png" "assets\images\icon.png"
copy "C:\Users\%USERNAME%\Downloads\caterpillar.png" "assets\images\adaptive-icon.png"
copy "C:\Users\%USERNAME%\Downloads\caterpillar.png" "assets\images\favicon.png"
copy "C:\Users\%USERNAME%\Downloads\caterpillar.png" "assets\images\splash-icon.png"
```

### Configuration (Already Set Up):

Your `app.json` is already configured correctly:
- ✅ Main icon: `./assets/images/icon.png`
- ✅ Adaptive icon: `./assets/images/adaptive-icon.png` 
- ✅ Web favicon: `./assets/images/favicon.png`
- ✅ Splash screen: `./assets/images/splash-icon.png`

### After Replacing the Images:

1. **Clear Expo cache**: `npx expo start --clear`
2. **Rebuild the app** to see the new icon
3. The caterpillar will appear as your app icon! 🐛

### Icon Design Notes:

Your caterpillar image has:
- ✅ Simple, recognizable design
- ✅ Good contrast (light green on dark green)
- ✅ Appropriate for a bug collection app
- ✅ Works well at small sizes

Perfect choice for BugLord! 🎮