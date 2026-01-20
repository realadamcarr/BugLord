# BugLord ML Integration - Testing Guide

## Quick Start Testing

### Option 1: Test in Expo Go (Recommended for Initial Testing)

```bash
cd "C:\Users\adamc\Desktop\personal projects\BugLord\BugLord"
npm start
```

Then:
1. Scan QR code with Expo Go app on your phone
2. App will load with ML integration (stub mode)
3. Test full capture → crop → classify → confirm flow

**What Works in Expo Go:**
- ✅ Full UI/UX flow
- ✅ Camera capture
- ✅ Manual cropper
- ✅ Image preprocessing
- ✅ Stub ML predictions (random labels)
- ✅ Candidate selection
- ✅ Upload queue persistence
- ❌ Real TFLite inference (requires dev build)

---

### Option 2: Test with Development Build (For Native ML)

```bash
# 1. Build development client
eas build --profile development --platform android

# 2. Download and install APK on device

# 3. Start dev server
npx expo start --dev-client
```

**What's Different:**
- Ready for native TFLite library
- Can test real ML when integrated
- Same stub mode until TFLite added

---

## Manual Test Script

### Test 1: Basic Capture Flow

**Steps:**
1. Open BugLord app
2. Navigate to **Capture** tab (camera icon)
3. Tap **"Capture Bug"** button
4. Point camera at any object (insect, plant, hand, etc.)
5. Tap the circular capture button
6. **ManualCropper** screen appears

**Expected:**
- ✅ Camera opens smoothly
- ✅ Photo captures successfully
- ✅ ManualCropper shows captured image
- ✅ Crop box overlay visible (dashed border)

**Console Logs:**
```
🖼️ Processing insect photo...
📸 Image processed: {...}
📐 Preprocessing image for ML inference (224x224)
```

---

### Test 2: Manual Crop

**Steps:**
1. In ManualCropper screen
2. Observe the crop rectangle overlay
3. Tap **"Crop & Continue"** button

**Expected:**
- ✅ Loading indicator shows
- ✅ Image crops to selected area
- ✅ Proceeds to AI analysis

**Console Logs:**
```
🔲 Cropping image: { cropOriginX, cropOriginY, cropWidth, cropHeight }
✅ Image cropped successfully
```

---

### Test 3: Skip Crop

**Steps:**
1. In ManualCropper screen
2. Tap **"Skip Crop"** button

**Expected:**
- ✅ Skips cropping
- ✅ Uses full image for processing
- ✅ Proceeds to AI analysis

**Console Logs:**
```
✅ Preprocessed image: 224x224
```

---

### Test 4: ML Classification (Stub Mode)

**Steps:**
1. After crop/skip, wait for "AI Analyzing..." modal
2. Observe loading animation
3. Wait for BugInfoModal to appear

**Expected:**
- ✅ Loading modal shows with captured photo preview
- ✅ "AI Analyzing..." text displayed
- ✅ After 1-2 seconds, BugInfoModal appears
- ✅ Shows multiple insect candidates (from labels.json)
- ✅ Each candidate has confidence percentage

**Console Logs:**
```
🧠 Running ML classification...
⚠️  Using STUB predictions (no real inference)
✅ ML classification complete: [...]
🐛 Bug identified: {...}
```

**Stub Labels (from assets/ml/labels.json):**
- Unknown
- Ant
- Bee
- Beetle
- Butterfly
- Caterpillar
- Cockroach
- Cricket
- Dragonfly
- Fly
- Grasshopper
- Ladybug
- Moth
- Mosquito
- Spider
- Wasp

---

### Test 5: Bug Confirmation

**Steps:**
1. In BugInfoModal, review candidate list
2. Tap on a candidate to select it (or tap first one by default)
3. Optionally enter a nickname
4. Tap **"Confirm & Add"** or **"Add to Party"**

**Expected:**
- ✅ Selected candidate highlighted
- ✅ Confirmation success alert appears
- ✅ Bug added to collection
- ✅ Returns to Capture screen

**Console Logs:**
```
📤 Labeled sample queued for upload
📤 Queued (1 pending)
```

---

### Test 6: Upload Queue

**Steps:**
1. Capture 2-3 bugs (repeat Test 1-5)
2. Check console logs for queue messages

**Expected:**
- ✅ Each confirmation queues an upload
- ✅ Queue persists in AsyncStorage
- ✅ Console shows: "Queued (N pending)"

**Console Logs:**
```
📤 Queuing sample for upload: Butterfly
✅ Queued (3 pending)
```

**Verify Queue (Dev Tools):**
```javascript
// In React DevTools or console
const stats = await datasetUploadService.getQueueStats();
console.log(stats);
// Output: { total: 3, pending: 3, failed: 0, uploading: 0 }
```

---

### Test 7: Service Initialization

**Steps:**
1. Close and reopen app
2. Watch console logs on startup

**Expected:**
- ✅ Services initialize automatically
- ✅ Model loading attempts (fails gracefully if no local model)
- ✅ Upload queue processing attempts
- ✅ Model update check (skipped if disabled)

**Console Logs:**
```
🚀 Initializing ML services...
📤 DatasetUploadService initialized: { enabled: false, baseUrl: '(not set)' }
🔄 ModelUpdateService initialized: { enabled: false, baseUrl: '(not set)' }
⚠️  No local model, attempting to load bundled assets...
⚠️  Using STUB classifier (no native TFLite loaded)
```

---

### Test 8: Collection View

**Steps:**
1. Navigate to **Player** tab (trophy icon)
2. Scroll through captured bugs
3. Tap on a bug to view details

**Expected:**
- ✅ All captured bugs displayed
- ✅ Bug details show photo and species
- ✅ ML metadata saved (predictedCandidates, modelVersionUsed, etc.)

---

### Test 9: Party View

**Steps:**
1. In **Player** tab, view party section
2. Captured bugs with "Add to Party" should appear

**Expected:**
- ✅ Up to 6 bugs in party
- ✅ Party slots filled or empty (+)

---

### Test 10: Error Handling

**Test Scenarios:**

**A) Camera Permission Denied**
- Deny camera permission
- Tap "Capture Bug"
- Expected: Permission request or error message

**B) Network Offline (Upload)**
- Turn off WiFi/mobile data
- Capture and confirm a bug
- Expected: Upload queued locally, no error

**C) Invalid Image**
- (Hard to test manually)
- Expected: Graceful fallback to "Unknown" bug

---

## Screens to Check

### 1. Capture Screen (`app/(tabs)/index.tsx`)

**Elements:**
- "Capture Bug" button
- Recent discoveries list
- Party display (6 slots)
- XP progress bar at top

**Interactions:**
- Tap "Capture Bug" → Opens camera
- Tap party slot → Party management (TODO)

**ML Integration:**
- ✅ Initializes ML services on mount
- ✅ Shows model status (ready/not ready)
- ✅ Processes captures through ML pipeline

---

### 2. BugCamera Component (`components/BugCamera.tsx`)

**Elements:**
- Live camera preview
- Capture button (large circle)
- Close button (X)
- Circular reticle overlay

**Interactions:**
- Tap capture → Takes photo, returns URI
- Tap close → Closes camera without capture

**ML Integration:**
- Returns photo URI to Capture screen
- Photo passed to ManualCropper

---

### 3. ManualCropper Component (`components/ManualCropper.tsx`)

**Elements:**
- Captured photo preview (centered)
- Dashed crop rectangle overlay
- Corner handles (visual only)
- Three action buttons:
  - Cancel
  - Skip Crop
  - Crop & Continue

**Interactions:**
- Tap "Crop & Continue" → Crops and proceeds
- Tap "Skip Crop" → Uses full image
- Tap "Cancel" → Discards photo

**ML Integration:**
- Returns cropped URI or original to Capture screen
- Cropped image sent to ML preprocessing

---

### 4. AI Analyzing Modal

**Elements:**
- Darkened overlay
- White card with:
  - "🤖 AI Analyzing..." title
  - Captured photo thumbnail
  - Loading spinner
  - "Using advanced AI to identify your bug..." text

**Expected Behavior:**
- Shows during ML processing
- Dismisses automatically when complete
- No user interaction needed

**ML Integration:**
- Displayed while preprocessing + classification runs
- Hides when BugInfoModal ready

---

### 5. BugInfoModal Component (`components/BugInfoModal.tsx`)

**Elements:**
- Bug photo (large)
- Candidate list:
  - Label name
  - Confidence percentage
  - Tap to select
- Nickname input field
- "Add to Collection" button
- "Add to Party" button (if space available)

**Interactions:**
- Tap candidate → Selects that label
- Enter nickname → Sets bug nickname
- Tap "Add to Collection" → Confirms, saves, queues upload
- Tap "Add to Party" → Same + adds to party

**ML Integration:**
- Displays `predictedCandidates` from classification
- On confirm:
  - Saves `confirmedLabel`
  - Sets `confirmationMethod`: 'AI_PICK' or 'MANUAL'
  - Queues upload to dataset service

---

### 6. Player Screen (`app/(tabs)/player.tsx`)

**Elements:**
- Player level and XP
- XP progress bar
- Collection stats (total bugs, rarities)
- Party display (6 slots with bug details)

**Expected:**
- Shows captured bugs with ML metadata
- Displays bug species names from confirmed labels

---

### 7. Train Screen (`app/(tabs)/train.tsx`)

**Elements:**
- (Existing train/level-up UI)

**Expected:**
- Unchanged by ML integration
- Future: Could show model training status

---

## Debugging Commands

### Check TypeScript Compilation

```bash
npx tsc --noEmit --skipLibCheck
```

Expected: 0 errors (minor type warnings OK)

---

### Check Upload Queue

```javascript
// In app console or React DevTools
const stats = await datasetUploadService.getQueueStats();
console.log('Queue stats:', stats);
```

Expected output:
```
{
  total: 3,
  pending: 3,
  failed: 0,
  uploading: 0
}
```

---

### Check Model Version

```javascript
const version = await modelUpdateService.getCurrentVersion();
console.log('Model version:', version);
```

Expected: `null` (no model yet) or `"1.0.0"` (if downloaded)

---

### Check Model Files

```javascript
const hasLocal = await modelUpdateService.hasLocalModel();
console.log('Has local model:', hasLocal);

const paths = modelUpdateService.getCurrentModelPaths();
console.log('Model paths:', paths);
```

Expected:
```
Has local model: false
Model paths: {
  modelPath: "file:///.../ml/model.tflite",
  labelsPath: "file:///.../ml/labels.json"
}
```

---

### Clear Upload Queue (Testing)

```javascript
await datasetUploadService.clearQueue();
console.log('Queue cleared');
```

---

### Force Model Update Check

```javascript
const update = await modelUpdateService.checkForUpdate(true);
console.log('Update available:', update);
```

Expected: `null` (no server configured yet)

---

## Performance Expectations

### Capture to Classification Time

**Stub Mode (Current):**
- Camera capture: ~100ms
- Manual crop: ~200ms (if used)
- Preprocessing: ~300-500ms
- Stub classification: ~50ms
- **Total: ~1-2 seconds**

**With Real TFLite (Future):**
- Camera capture: ~100ms
- Manual crop: ~200ms
- Preprocessing: ~300-500ms
- TFLite inference: ~200-500ms (depends on model)
- **Total: ~1-3 seconds**

### Upload Queue Processing

- Single upload: ~1-2 seconds (network dependent)
- Batch: ~2-5 seconds for 5 items
- Retries: 3 attempts with exponential backoff

---

## Common Issues & Solutions

### Issue: "Cannot find name 'ManualCropper'"

**Cause:** TypeScript cache issue

**Solution:**
```bash
# Clear TypeScript cache
rm -rf node_modules/.cache
npx tsc --noEmit --skipLibCheck
```

---

### Issue: "Model not loaded" logs

**Cause:** No local model file exists yet

**Solution:** Expected behavior. Stub mode will work fine. To add real model:
1. Place `model.tflite` in `assets/ml/`
2. Rebuild app or download via ModelUpdateService

---

### Issue: Upload queue not processing

**Cause:** Service not enabled or no backend URL

**Solution:**
```typescript
// In app/(tabs)/index.tsx
await datasetUploadService.initialize({
  baseUrl: 'https://your-api.com',
  enabled: true,  // ← Enable here
});
```

---

### Issue: Classification takes too long

**Cause:** Large image file

**Solution:** Already handled by MLPreprocessingService. If still slow:
- Reduce target size: `targetSize: 224` → `192`
- Increase compression: `quality: 0.9` → `0.7`

---

## Success Criteria

✅ **All Tests Pass:**
- Test 1-10 complete without errors
- Console logs show expected output
- Upload queue persists across app restarts

✅ **TypeScript Compiles:**
```bash
npx tsc --noEmit --skipLibCheck
# 0 errors
```

✅ **App Stability:**
- No crashes during capture flow
- Graceful handling of edge cases
- Proper error messages shown to user

✅ **Data Persistence:**
- Captured bugs saved with ML metadata
- Upload queue survives app restart
- Model version tracking works

---

## Next Steps After Testing

1. ✅ Verify all tests pass
2. 🔄 Install TFLite library (`react-native-fast-tflite`)
3. 🔄 Update OnDeviceClassifier with real inference
4. 🔄 Train initial model
5. 🔄 Set up backend API
6. 🔄 Enable upload and model update services
7. 🚀 Build and deploy

---

**Testing Date:** December 19, 2025
**Build Status:** ✅ Ready for Testing
**Test Environment:** Expo Go (stub mode) or Dev Client (native ready)
