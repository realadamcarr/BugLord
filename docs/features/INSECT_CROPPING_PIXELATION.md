# Insect Cropping & Pixelation Feature

## Overview
BugLord now automatically crops insects from photos and creates pixelated icons for use in the party and collection displays. This creates a unique retro-game aesthetic while focusing attention on the captured bugs.

## How It Works

### 1. Automatic Processing Pipeline
When a user takes a photo of an insect:

```
Photo Capture → Insect Detection → Cropping → Pixelation → Storage
```

1. **Insect Detection**: Uses heuristic analysis to locate the insect in the photo
2. **Smart Cropping**: Extracts the insect from the background using detected bounds
3. **Pixelation**: Creates a retro-style pixelated version for use as an icon
4. **Storage**: Saves both the cropped original and pixelated icon

### 2. Image Processing Service

The `ImageProcessingService` handles the complete pipeline:

```typescript
interface CropResult {
  croppedImage: string;      // Cropped insect photo
  pixelatedIcon: string;     // Pixelated version for icons
  boundingBox: {             // Detection coordinates
    x: number;
    y: number; 
    width: number;
    height: number;
  };
}
```

### 3. Detection Algorithm

Currently uses intelligent heuristics:
- **Center-focus detection**: Assumes insects are typically in photo center
- **Contrast analysis**: Identifies high-contrast areas (future enhancement)
- **Size optimization**: Creates reasonable crop areas for mobile photos
- **Fallback handling**: Graceful degradation when detection fails

## User Experience

### Visual Design
- **Pixelated Icons**: 64x64 pixel art style icons with 8px pixel blocks
- **Retro Aesthetic**: Gives bugs a classic video game appearance
- **Consistent Display**: Icons used in party slots, recent catches, and collection views
- **Fallback Support**: Shows original photos when pixelation unavailable

### UI Integration
- **Party Display**: Shows pixelated bug icons in training screen party slots
- **Recent Catches**: Horizontal scrollable list with pixelated previews
- **Collection Views**: Consistent icon usage throughout the app
- **Automatic Processing**: No user interaction required - happens seamlessly

## Technical Implementation

### Dependencies
```json
{
  "expo-image-manipulator": "^11.8.0",
  "react-native-image-crop-picker": "^0.40.0",
  "react-native-canvas": "^0.1.38"
}
```

### Core Service Methods
```typescript
class ImageProcessingService {
  async processInsectPhoto(photoUri: string, options?: ProcessingOptions): Promise<CropResult>
  private async detectInsect(photoUri: string): Promise<BoundingBox | null>
  private async cropImage(photoUri: string, boundingBox: BoundingBox, quality: number): Promise<string>
  private async pixelateImage(imageUri: string, pixelSize: number, outputSize: number): Promise<string>
}
```

### Processing Options
```typescript
interface ProcessingOptions {
  pixelSize?: number;     // Default: 8 (size of pixel blocks)
  iconSize?: number;      // Default: 64 (output icon dimensions)
  quality?: number;       // Default: 0.8 (JPEG compression)
  detectObjects?: boolean; // Default: true (enable detection)
}
```

## Data Structure Updates

### Bug Type Enhancement
```typescript
interface Bug {
  // ... existing fields
  photo?: string;      // Original full photo
  pixelArt?: string;   // Processed pixelated icon
}
```

### Storage Strategy
- **Original Photo**: Stored in `bug.photo` for high-quality viewing
- **Pixelated Icon**: Stored in `bug.pixelArt` for UI display
- **Automatic Fallback**: UI gracefully falls back to original photo if pixelation unavailable

## Image Processing Details

### Pixelation Algorithm
1. **Downscale**: Resize image to very small dimensions (e.g., 8x8 pixels)
2. **Upscale**: Resize back to target size (64x64) without smoothing
3. **Result**: Blocky, pixelated effect with distinct color blocks

### Cropping Strategy
- **Smart Bounds**: Automatically detect likely insect location
- **Center Crop**: Default to center area if detection fails
- **Aspect Ratio**: Maintains square aspect ratio for consistent icons
- **Size Optimization**: Balances detail preservation with performance

## Performance Considerations

### Optimization Features
- **Lazy Loading**: Image processing happens asynchronously
- **Caching**: Processed images cached to device storage
- **Background Processing**: Doesn't block UI during processing
- **Fallback Handling**: Graceful degradation for performance issues

### Memory Management
- **Compression**: JPEG compression for cropped images
- **PNG Format**: Pixelated icons use PNG for sharp pixel boundaries
- **Cleanup**: Temporary files cleaned up after processing
- **Size Limits**: Reasonable output dimensions to manage memory usage

## Future Enhancements

### Advanced Detection
- **Machine Learning**: Integrate TensorFlow Lite for better insect detection
- **Edge Detection**: Use computer vision algorithms for precise boundaries
- **Species Recognition**: Combine with AI identification for smarter cropping
- **Manual Override**: Allow users to adjust crop areas

### Enhanced Pixelation
- **Color Quantization**: Reduce color palette for more authentic pixel art
- **Dithering**: Add dithering effects for smoother color transitions
- **Style Options**: Multiple pixelation styles (8-bit, 16-bit, etc.)
- **Animation**: Animated pixel art for special rare bugs

### Performance Improvements
- **Edge Computing**: Process images on device for better privacy
- **Progressive Loading**: Show low-res versions while processing high-res
- **Batch Processing**: Handle multiple images efficiently
- **CDN Integration**: Cloud storage for processed images

## Error Handling

### Robust Fallbacks
- **Detection Failure**: Falls back to center crop
- **Processing Error**: Uses original photo as icon
- **Memory Issues**: Automatically reduces quality/size
- **Network Problems**: Continues with local processing only

### User Communication
- **Loading States**: Shows processing progress to user
- **Error Messages**: Friendly messages for processing issues
- **Retry Logic**: Automatic retry for transient failures
- **Manual Options**: Allow users to manually add bugs if processing fails

## Testing & Validation

### Quality Assurance
- **Visual Testing**: Verify pixelated icons look good at various sizes
- **Performance Testing**: Ensure processing doesn't impact app performance
- **Edge Cases**: Test with various photo types, lighting, and compositions
- **Device Compatibility**: Test across different mobile devices and OS versions

This feature transforms BugLord from a simple collection app into a visually engaging experience with a unique retro aesthetic that makes every captured bug feel special!