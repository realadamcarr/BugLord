# Development Build Guide for BugLord

## Why Development Builds?

**Expo Go cannot run native TensorFlow Lite inference.** To use on-device ML classification, you must build a custom development client that includes the necessary native modules.

This guide explains how to:
1. Build a development client with EAS
2. Run the app with the dev client
3. Test the full ML pipeline locally

---

## Prerequisites

- Node.js 18+ installed
- EAS CLI installed globally: `npm install -g eas-cli`
- EAS account logged in: `eas login`
- Android device or emulator (for testing)
- Optional: Physical Android device with USB debugging enabled

---

## Step 1: Build Development Client

### For Android

Run the following command to build a development APK:

```bash
eas build --profile development --platform android
```

**What this does:**
- Creates a custom Expo development client
- Bundles all native modules (including any TFLite libraries when added)
- Uploads to EAS Build service
- Provides a download link when complete (~10-20 minutes)

### Configuration

The development build profile is defined in `eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    }
  }
}
```

---

## Step 2: Install Development Client

Once the build completes:

1. **Download the APK** from the EAS build page
2. **Transfer to your Android device** (via USB, cloud storage, or direct download)
3. **Install the APK**:
   - Enable "Install from Unknown Sources" if prompted
   - Open the APK file to install
4. **Open the BugLord Dev Client** app

---

## Step 3: Start Development Server

In your project directory:

```bash
npx expo start --dev-client
```

**Or for network/tunnel access:**

```bash
npx expo start --dev-client --tunnel
```

**What this does:**
- Starts Metro bundler
- Provides QR code and connection URL
- Hot reloads code changes
- Works with your development client app

---

## Step 4: Connect Dev Client to Server

### Option A: Same Network (Recommended)

1. Ensure your dev machine and device are on the same WiFi
2. Open the BugLord Dev Client app
3. Scan the QR code from the terminal
4. App will connect and load

### Option B: Tunnel (Remote/Different Networks)

1. Start with `--tunnel` flag
2. Wait for tunnel URL to generate
3. Scan QR code in dev client
4. App connects via ngrok tunnel

### Option C: Manual URL

1. In dev client, tap "Enter URL manually"
2. Enter the `exp://` URL from terminal
3. Tap "Connect"

---

## Development Workflow

### Hot Reloading

Code changes will hot reload automatically. For native changes:
1. Make changes to native modules
2. Rebuild dev client: `eas build --profile development --platform android`
3. Install updated APK

### Debugging

- **Console logs**: Visible in terminal running `expo start`
- **React DevTools**: Open in browser at provided URL
- **Network inspector**: Use React Native Debugger or Flipper

---

## Adding TensorFlow Lite (Future Step)

When ready to integrate real TFLite inference:

### 1. Install Native Library

Choose one of:

```bash
# Option A: react-native-fast-tflite (if available)
npm install react-native-fast-tflite

# Option B: TensorFlow.js React Native
npm install @tensorflow/tfjs @tensorflow/tfjs-react-native

# Option C: Custom native module
# Follow React Native native module guide
```

### 2. Update OnDeviceClassifier

In `services/ml/OnDeviceClassifier.ts`:

- Uncomment native library imports
- Replace stub methods with real TFLite calls
- Implement model loading and inference

### 3. Prebuild Native Code

```bash
npx expo prebuild --clean
```

This generates native Android/iOS folders with proper configurations.

### 4. Rebuild Development Client

```bash
eas build --profile development --platform android
```

### 5. Test ML Pipeline

1. Install new dev client APK
2. Start dev server
3. Capture insect photo
4. Verify on-device classification works
5. Check logs for ML inference output

---

## Testing the ML Pipeline

### End-to-End Flow

1. **Launch app** in development client
2. **Navigate to Capture tab**
3. **Tap "Capture Bug"** button
4. **Take photo** of an insect (or any object for testing)
5. **Crop manually** or tap "Skip Crop"
6. **Wait for classification**:
   - Green checkmark = on-device ML worked
   - API fallback = no local model or error
7. **Confirm bug identity** in modal
8. **Check upload queue**: Labeled sample queued for training

### Verifying Services

Check console logs for:

```
🚀 Initializing ML services...
✅ ML model loaded: v1.0.0
🔍 Classifying image: file://...
✅ ML classification complete: [...]
📤 Labeled sample queued for upload
```

### Testing Without TFLite

The current implementation uses **stub predictions** if no TFLite library is installed. This allows you to:
- Test the full capture → crop → classify → confirm flow
- Verify UI/UX works correctly
- Queue uploads to dataset service
- Validate model update checks

Stub mode returns random insect predictions from `labels.json`.

---

## Common Issues

### "Module not found: react-native-fast-tflite"

**Solution**: The native library isn't installed yet. Stub mode will work for testing. When ready, install the library and rebuild.

### "Model not loaded"

**Solution**: 
- Check `assets/ml/` contains `model.tflite` and `labels.json`
- Verify model files copied to FileSystem on first run
- Enable model update service to download from server

### "Cannot connect to dev server"

**Solution**:
- Verify same WiFi network
- Try `--tunnel` flag
- Check firewall settings
- Use manual URL entry

### "APK install failed"

**Solution**:
- Enable "Install Unknown Sources" in Android settings
- Uninstall previous version first
- Check storage space available

---

## Production Builds

### Preview Build (APK for Testing)

```bash
eas build --profile preview --platform android
```

Downloads APK for distribution to testers.

### Production Build (Google Play)

```bash
eas build --profile production --platform android
```

Generates AAB for Play Store submission.

---

## Environment Configuration

### API Endpoints

Set in `app.json` or `.env`:

```json
{
  "extra": {
    "apiUrl": "https://your-backend.com",
    "modelUpdateUrl": "https://your-backend.com/model"
  }
}
```

Or use `.env`:

```
EXPO_PUBLIC_API_URL=https://your-backend.com
```

Access via:

```typescript
import Constants from 'expo-constants';
const apiUrl = Constants.expoConfig?.extra?.apiUrl;
```

### Enabling Services

In `app/(tabs)/index.tsx`, update service initialization:

```typescript
await datasetUploadService.initialize({
  baseUrl: process.env.EXPO_PUBLIC_API_URL,
  enabled: true, // Enable when backend ready
});

await modelUpdateService.initialize({
  baseUrl: process.env.EXPO_PUBLIC_API_URL,
  enabled: true, // Enable when backend ready
});
```

---

## Next Steps

1. ✅ **Build dev client**: `eas build --profile development --platform android`
2. ✅ **Install on device**: Transfer and install APK
3. ✅ **Start dev server**: `npx expo start --dev-client`
4. ✅ **Test capture flow**: Take photo → crop → classify → confirm
5. ⏸️ **Add TFLite library**: When ready for real inference
6. ⏸️ **Train model**: Use uploaded dataset
7. ⏸️ **Enable model updates**: Point to your model server

---

## Resources

- [Expo Development Builds](https://docs.expo.dev/development/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [React Native TFLite](https://github.com/mrousavy/react-native-fast-tflite)
- [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/)
- [Expo Camera](https://docs.expo.dev/versions/latest/sdk/camera/)

---

## Support

For issues or questions:
1. Check console logs for errors
2. Verify EAS build succeeded
3. Test in Expo Go first (without ML)
4. Review this guide for troubleshooting steps
