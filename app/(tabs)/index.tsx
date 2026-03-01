import { BugCamera, ScanMode } from '@/components/BugCamera';
import { BugInfoModal } from '@/components/BugInfoModal';
import { CollectionScreen } from '@/components/CollectionScreen';
import PixelatedEmoji from '@/components/PixelatedEmoji';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { XPProgressBar } from '@/components/XPProgressBar';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { bugIdentificationService } from '@/services/BugIdentificationService';
import { datasetUploadService } from '@/services/DatasetUploadService';
import { appendScanLog } from '@/services/ScanLogService';
import { mlPreprocessingService } from '@/services/ml/MLPreprocessingService';
import { modelUpdateService } from '@/services/ml/ModelUpdateService';
import { onDeviceClassifier } from '@/services/ml/OnDeviceClassifier';
import { Bug, BugIdentificationResult, ConfirmationMethod, IdentificationCandidate, RARITY_CONFIG } from '@/types/Bug';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: screenWidth } = Dimensions.get('window');

export default function CaptureScreen() {
  const { theme } = useTheme();
  const { collection, addBugToCollection, addBugToParty, removeBugFromParty, updateBugNickname, loading } = useBugCollection();
  const [showCamera, setShowCamera] = useState(false);
  const [showBugIdentification, setShowBugIdentification] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [showPartyManagement, setShowPartyManagement] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identificationResult, setIdentificationResult] = useState<BugIdentificationResult | null>(null);
  const [identifiedBug, setIdentifiedBug] = useState<Bug | null>(null);
  const [selectedRecentBug, setSelectedRecentBug] = useState<Bug | null>(null);
  const [showRecentBugModal, setShowRecentBugModal] = useState(false);
  const [mlReady, setMlReady] = useState(false);
  const [modelVersion, setModelVersion] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>('photo');

  const styles = createStyles(theme);

  // Initialize ML services on mount
  useEffect(() => {
    initializeMLServices();
  }, []);

  const initializeMLServices = async () => {
    try {
      console.log('🚀 Initializing ML services...');

      // Initialize services
      await datasetUploadService.initialize({
        // TODO: Set from env or config
        // baseUrl: process.env.EXPO_PUBLIC_API_URL,
        enabled: true, // Enable when backend is ready
      });

      await modelUpdateService.initialize({
        // TODO: Set from env or config
        // baseUrl: process.env.EXPO_PUBLIC_API_URL,
        enabled: false, // Enable when backend is ready
      });

      // Check for model updates (non-blocking)
      modelUpdateService.checkForUpdate().then(async (update) => {
        if (update) {
          console.log('📥 New model available, downloading...');
          await modelUpdateService.downloadAndActivate(update);
          await loadMLModel();
        }
      }).catch(err => console.warn('Model update check failed:', err));

      // Load current model
      await loadMLModel();

      // Process upload queue
      datasetUploadService.processQueue().catch(err =>
        console.warn('Upload queue processing failed:', err)
      );

    } catch (error) {
      console.error('❌ ML services initialization failed:', error);
    }
  };

  const loadMLModel = async () => {
    try {
      const hasLocal = await modelUpdateService.hasLocalModel();
      
      if (hasLocal) {
        const paths = modelUpdateService.getCurrentModelPaths();
        await onDeviceClassifier.loadModel(paths.modelPath, paths.labelsPath);
        const version = await modelUpdateService.getCurrentVersion();
        setModelVersion(version);
        setMlReady(true);
        console.log('✅ ML model loaded:', version || 'bundled');
      } else {
        // Load bundled model from assets
        console.log('⚠️  No local model, loading bundled assets...');
        try {
          // Use legacy FileSystem API for consistent behavior
          const FileSystem = require('expo-file-system/legacy');
          const Asset = require('expo-asset').Asset;
          
          // Bundled assets are in the app bundle, we need to copy them to accessible location
          const modelDir = `${FileSystem.documentDirectory}ml/`;
          const modelPath = `${modelDir}model.tflite`;
          const labelsPath = `${modelDir}labels.json`;
          
          console.log('📁 Checking for model files in:', modelDir);
          
          // Check if files exist using legacy API (simpler for file checks)
          const modelInfo = await FileSystem.getInfoAsync(modelPath);
          const labelsInfo = await FileSystem.getInfoAsync(labelsPath);
          
          // Check if model exists but is wrong size (corrupted)
          const expectedModelSize = 2800000; // ~2.8MB
          const isCorrupted = modelInfo.exists && modelInfo.size && modelInfo.size < expectedModelSize;
          
          if (!modelInfo.exists || !labelsInfo.exists || isCorrupted) {
            if (isCorrupted) {
              console.log(`🗑️  Deleting corrupted model file (${Math.round(modelInfo.size! / 1024)}KB instead of ~12MB)`);
              await FileSystem.deleteAsync(modelPath);
            }
            
            console.log('📦 Copying bundled assets to document directory...');
            
            // Ensure directory exists
            await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true }).catch(() => {});
            
            try {
              // Try to copy files from app bundle automatically
              console.log('📁 Attempting to copy from app bundle...');
              
              // Create labels.json directly (flat array matching model output classes)
              const labelsContent = [
                "Bees", "Butterfly", "Ladybug", "ant", "dragonfly", "wasp"
              ];
              
              if (!labelsInfo.exists) {
                await FileSystem.writeAsStringAsync(labelsPath, JSON.stringify(labelsContent, null, 2));
                console.log('✅ Created labels.json with 6 species');
              }
              
              // Try to copy model from app bundle
              if (!modelInfo.exists || isCorrupted) {
                try {
                  // Attempt multiple bundle paths
                  const possiblePaths = [
                    `${FileSystem.bundleDirectory}assets/ml/model.tflite`,
                    `${FileSystem.bundleDirectory}assets/assets/ml/model.tflite`,
                    `${FileSystem.bundleDirectory}bundled/assets/ml/model.tflite`
                  ];
                  
                  let copied = false;
                  for (const sourcePath of possiblePaths) {
                    try {
                      console.log('🔍 Trying bundle path:', sourcePath);
                      const sourceInfo = await FileSystem.getInfoAsync(sourcePath);
                      if (sourceInfo.exists) {
                        await FileSystem.copyAsync({
                          from: sourcePath,
                          to: modelPath
                        });
                        console.log('✅ Copied model from bundle:', sourcePath);
                        copied = true;
                        break;
                      }
                    } catch (pathError) {
                      console.log('❌ Path failed:', sourcePath);
                    }
                  }
                  
                  // If bundle copy fails, try expo-asset approach with error handling
                  if (!copied) {
                    console.log('📦 Trying expo-asset approach...');
                    try {
                      console.log('🔍 Asset module path: @/assets/ml/model.tflite');
                      // Import the model asset 
                      const modelAsset = Asset.fromModule(require('../../assets/ml/model.tflite'));
                      console.log('📋 Asset info:', {
                        name: modelAsset.name,
                        type: modelAsset.type,
                        hash: modelAsset.hash,
                        uri: modelAsset.uri,
                        downloaded: modelAsset.downloaded
                      });
                      
                      await modelAsset.downloadAsync();
                      console.log('📋 After download:', {
                        localUri: modelAsset.localUri,
                        downloaded: modelAsset.downloaded
                      });
                      
                      if (modelAsset.localUri) {
                        // Check source size before copying
                        const sourceInfo = await FileSystem.getInfoAsync(modelAsset.localUri);
                        console.log('📊 Source file info:', sourceInfo);
                        
                        await FileSystem.copyAsync({
                          from: modelAsset.localUri,
                          to: modelPath
                        });
                        
                        // Verify copy
                        const destInfo = await FileSystem.getInfoAsync(modelPath);
                        console.log('📊 Copied file info:', destInfo);
                        console.log('✅ Copied model using expo-asset');
                        copied = true;
                      }
                    } catch (assetError) {
                      console.log('❌ Expo-asset failed:', assetError);
                    }
                  }
                  
                  // Final fallback: Check downloads folder for manually copied model
                  if (!copied) {
                    console.log('📲 Trying downloads folder...');
                    try {
                      const downloadPath = '/storage/emulated/0/Download/model.tflite';
                      const downloadInfo = await FileSystem.getInfoAsync(`file://${downloadPath}`);
                      
                      if (downloadInfo.exists) {
                        await FileSystem.copyAsync({
                          from: `file://${downloadPath}`,
                          to: modelPath
                        });
                        console.log('✅ Copied model from downloads folder');
                        copied = true;
                      }
                    } catch (downloadError) {
                      console.log('❌ Downloads copy failed:', downloadError);
                    }
                  }
                  
                  if (!copied) {
                    // If bundle copy fails, create a placeholder for now
                    console.warn('⚠️ Could not copy from any source, using labels-only mode');
                    setMlReady(true);
                    setModelVersion('labels-only');
                    console.log('✅ ML ready in labels-only mode');
                    return;
                  }
                } catch (bundleError) {
                  console.error('❌ Bundle copy failed:', bundleError);
                  setMlReady(true);
                  setModelVersion('labels-only');
                  console.log('✅ ML ready in labels-only mode (fallback)');
                  return;
                }
              }
            } catch (copyError) {
              console.error('❌ Failed to copy from assets:', copyError);
              console.warn('⚠️  Model files not found in document directory.');
              console.warn('📋 Please ensure model files are in:', modelDir);
              console.warn('   Expected files:');
              console.warn('   - model.tflite (2.8 MB)');
              console.warn('   - labels.json');
              
              setMlReady(false);
              return;
            }
          }
          
          console.log('📦 Loading model from:', modelPath);
          await onDeviceClassifier.loadModel(modelPath, labelsPath);
          setModelVersion('bundled');
          setMlReady(true);
          console.log('✅ Bundled ML model loaded successfully');
        } catch (bundleError) {
          console.error('❌ Failed to load bundled model:', bundleError);
          setMlReady(false);
        }
      }
    } catch (error) {
      console.error('❌ Model loading failed:', error);
      setMlReady(false);
    }
  };

  const handleCameraCapture = async (photoUri: string) => {
    setCapturedPhoto(photoUri);
    setShowCamera(false);
    
    // Automatically process the captured photo
    await processAndClassify(photoUri, photoUri);
  };

  const handleRecentBugTap = (bug: Bug) => {
    setSelectedRecentBug(bug);
    setShowRecentBugModal(true);
  };

  const handleCloseRecentBugModal = () => {
    setShowRecentBugModal(false);
    setSelectedRecentBug(null);
  };

  const handleConfirmRecentBug = ({ nickname }: { nickname?: string; addToParty?: boolean; replaceBugId?: string; confirmedLabel?: string; confirmationMethod?: ConfirmationMethod; }) => {
    // Update nickname if provided and different from current
    if (selectedRecentBug && nickname && nickname !== selectedRecentBug.nickname) {
      updateBugNickname(selectedRecentBug.id, nickname);
      Alert.alert('Nickname Updated', `${selectedRecentBug.name} is now called "${nickname}"!`);
    }
    // Close the modal
    handleCloseRecentBugModal();
  };

  const processAndClassify = async (
    imageToClassify: string,
    originalPhoto: string,
    preConfirmedResult?: { label: string; confidence: number }
  ) => {
    setShowBugIdentification(true);
    setIsIdentifying(true);
    
    try {
      console.log('🖼️ Processing insect photo...');
      
      // Import the image processing service
      const { imageProcessingService } = await import('@/services/ImageProcessingService');
      
      // Process the image to detect, crop and pixelate the insect (for icon)
      const processedImage = await imageProcessingService.processInsectPhoto(originalPhoto, {
        pixelSize: 8,
        iconSize: 64,
        quality: 0.8,
        detectObjects: true
      });
      
      console.log('📸 Image processed:', processedImage);

      // If we already have a confirmed result from live scan, use it directly
      let mlCandidates: any[] = [];
      if (preConfirmedResult) {
        console.log('✅ Using pre-confirmed live scan result:', preConfirmedResult);
        mlCandidates = [{ label: preConfirmedResult.label, confidence: preConfirmedResult.confidence }];
      } else {
        // NEW: ML preprocessing for fixed input size
        const mlInput = await mlPreprocessingService.preprocessForInference(imageToClassify, {
          targetSize: 224,
          quality: 0.9,
        });

        console.log('🧠 Running ML classification...');

        // Check if real TFLite model is available (not stubs)
        const usingRealModel = onDeviceClassifier.isUsingRealModel();

        if (!usingRealModel) {
          // No real model → reject immediately instead of using fake stubs
          console.warn('⚠️ No real TFLite model available — cannot identify bugs');
          setIsIdentifying(false);
          setShowBugIdentification(false);
          Alert.alert(
            'ML Model Not Available',
            'The AI model is not loaded. Please use a production APK built with EAS to enable real bug identification.',
            [{ text: 'OK' }]
          );
          return;
        }

        // Run real on-device ML classification
        if (mlReady && onDeviceClassifier.isReady()) {
          try {
            mlCandidates = await onDeviceClassifier.classifyImage(mlInput, 5);
            console.log('✅ ML classification complete:', mlCandidates);
          } catch (error) {
            console.warn('⚠️  ML classification failed:', error);
          }
        }

        // VALIDATION: Check if insect is detected with minimum confidence
        const MIN_CONFIDENCE = 0.5; // 50% — reasonable for a 6-class model on real photos
        const hasValidDetection = mlCandidates.length > 0 && mlCandidates[0].confidence >= MIN_CONFIDENCE;

        if (!hasValidDetection) {
          const topConf = mlCandidates.length > 0 ? mlCandidates[0].confidence : 0;
          console.log(`⚠️ ML confidence too low (${(topConf * 100).toFixed(1)}%), rejecting scan`);
          setIsIdentifying(false);
          setShowBugIdentification(false);
          Alert.alert(
            'Could Not Identify Bug',
            topConf > 0
              ? `Best match was only ${Math.round(topConf * 100)}% confident (need 50%). Try getting closer, improving lighting, or adjusting the angle.`
              : 'No insect detected in this photo. Make sure the bug is clearly visible and well-lit.',
            [{ text: 'Try Again' }]
          );
          return;
        }
      }

      // USE REAL TENSORFLOW LITE PREDICTIONS
      console.log('✅ Using real TensorFlow Lite predictions:', mlCandidates);
      
      // Convert TensorFlow Lite predictions to BugIdentificationResult format
      let candidates: IdentificationCandidate[] = mlCandidates.map(candidate => ({
        label: candidate.label,
        species: candidate.label, // Use label as species for now
        confidence: candidate.confidence,
        source: 'TensorFlow Lite ML Model'
      }));

      // Refine ant predictions using color analysis (red vs black vs carpenter)
      if (candidates[0]?.label?.toLowerCase() === 'ant') {
        console.log('🐜 Top prediction is ant — running sub-classification...');
        candidates = await bugIdentificationService.refineAntPrediction(candidates, originalPhoto);
      }

      const result = {
        candidates,
        provider: 'TensorFlow Lite',
        isFromAPI: false
      };

      setIdentificationResult(result);

      // Use first candidate as default preview
      const top = result.candidates[0];
      const bugData: Partial<Bug> = {
        name: top?.label || 'Unknown bug',
        species: top?.species || 'Unknown',
        description: top ? `Identified from ${result.provider}` : 'Unknown insect captured',
        rarity: 'common',
        biome: 'garden',
        photo: originalPhoto,
        pixelArt: processedImage.pixelatedIcon,
        traits: top ? ['AI Identified'] : ['Unknown'],
        size: 'medium',
        xpValue: RARITY_CONFIG['common'].xpRange[0],
        level: 1,
        xp: 0,
        maxXp: 100,
        caughtAt: new Date(),
        predictedCandidates: result.candidates,
        provider: result.provider,
        modelVersionUsed: modelVersion || undefined,
        imageUri: originalPhoto,
        capturedAt: new Date().toISOString(),
      };
      
      setIdentifiedBug(bugData as Bug);

      // Provisional log (pre-confirmation)
      try {
        await appendScanLog({
          imageUri: originalPhoto,
          provider: result.provider,
          candidates: result.candidates,
        });
      } catch {}
      
      console.log('🐛 Bug identified:', result);
    } catch (error) {
      console.error('Bug identification failed:', error);
      Alert.alert(
        'Processing Error', 
        'Could not process the image automatically. You can still add the bug manually!'
      );
    } finally {
      setIsIdentifying(false);
    }
  };

  const handleBugInfoConfirm = async ({ nickname, addToParty, replaceBugId, confirmedLabel, confirmationMethod }: { nickname?: string; addToParty?: boolean; replaceBugId?: string; confirmedLabel?: string; confirmationMethod?: ConfirmationMethod; }) => {
    if (!identifiedBug) return;

    try {
      // Prepare bug data with all optional fields
      const bugData = {
        ...identifiedBug,
        ...(nickname && { nickname }),
        ...(confirmedLabel && { 
          userConfirmedLabel: confirmedLabel,
          confirmedLabel: confirmedLabel 
        }),
        ...(confirmationMethod && { confirmationMethod })
      };

      // Add the bug to collection
      const newBug = await addBugToCollection(bugData);

      if (addToParty) {
        if (replaceBugId) {
          // TODO: Implement party swap functionality
          console.log('TODO: Replace party bug', replaceBugId, 'with', newBug.id);
        } else {
          // Add to party if there's space
          addBugToParty(newBug);
        }
      }

      const confidenceText = identificationResult?.candidates?.[0]?.confidence 
        ? `\nTop guess: ${Math.round((identificationResult.candidates[0].confidence || 0) * 100)}%` 
        : '';
      
      Alert.alert(
        'Bug Captured!',
        `You caught a ${newBug.rarity} ${newBug.name}!${confidenceText}\n+${newBug.xpValue} XP${addToParty ? '\n\nAdded to your party!' : '\n\nAdded to your collection!'}`,
        [{ text: 'Awesome!', style: 'default' }]
      );

      // Queue labeled sample for upload to training dataset
      if (confirmedLabel && capturedPhoto) {
        try {
          await datasetUploadService.queueUpload({
            imageUri: capturedPhoto,
            confirmedLabel: confirmedLabel,
            predictedCandidates: identificationResult?.candidates.map(c => ({
              label: c.label,
              confidence: c.confidence || 0,
            })) || [],
            modelVersionUsed: modelVersion || 'unknown',
            capturedAt: new Date().toISOString(),
          });
          console.log('📤 Labeled sample queued for upload');
        } catch (error) {
          console.warn('Failed to queue upload:', error);
        }
      }

      // Append confirmation to latest log entry
      try {
        await appendScanLog({
          imageUri: capturedPhoto || undefined,
          provider: identificationResult?.provider || 'Local',
          candidates: identificationResult?.candidates || [],
          confirmedLabel: confirmedLabel,
          confirmationMethod: confirmationMethod,
        });
      } catch {}

      // Reset state
      setShowBugIdentification(false);
      setCapturedPhoto(null);
      setIdentificationResult(null);
      setIdentifiedBug(null);
    } catch (error) {
      console.error('Error adding bug to collection:', error);
      Alert.alert('Error', 'Failed to add bug to collection. Please try again.');
    }
  };

  const handleBugInfoClose = () => {
    setShowBugIdentification(false);
    setCapturedPhoto(null);
    setIdentificationResult(null);
    setIdentifiedBug(null);
  };

  // ─── Live Scan Callbacks ──────────────────────────────────────
  /** Classify a single photo using the on-device ML model.
   *  Returns null ONLY when the model is not loaded yet (BugCamera shows "not ready" alert).
   *  Returns { label, confidence } always when the model IS loaded — even for low-confidence
   *  results so BugCamera can show the "low confidence" message instead of "not ready". */
  const handleClassifyPhoto = useCallback(async (photoUri: string): Promise<{ label: string; confidence: number } | null> => {
    // Return null = model not loaded / no real model, so BugCamera can show a specific message
    if (!mlReady || !onDeviceClassifier.isReady() || !onDeviceClassifier.isUsingRealModel()) return null;
    try {
      const mlInput = await mlPreprocessingService.preprocessForInference(photoUri, {
        targetSize: 224,
        quality: 0.7,
      });
      const candidates = await onDeviceClassifier.classifyImage(mlInput, 3);
      if (candidates.length === 0) {
        // Model ran but produced no output — return zero-confidence so BugCamera
        // shows "could not identify" rather than "model not ready"
        return { label: '', confidence: 0 };
      }
      return { label: candidates[0].label, confidence: candidates[0].confidence };
    } catch (err) {
      console.warn('Photo classification error:', err);
      return { label: '', confidence: 0 };
    }
  }, [mlReady]);

  /** Called when user taps "Capture!" after live scan lock */
  const handleLiveScanConfirm = useCallback(async (photoUri: string, label: string, confidence: number) => {
    setShowCamera(false);
    setCapturedPhoto(photoUri);

    // Pass the already-confirmed ML result to skip redundant re-classification
    await processAndClassify(photoUri, photoUri, { label, confidence });
  }, []);

  const renderPartySlot = (bug: Bug | null, index: number) => (
    <TouchableOpacity
      key={index}
      style={[styles.partySlot, !bug && styles.emptyPartySlot]}
      onPress={() => {
        if (bug) {
          handleRecentBugTap(bug);
        }
      }}
    >
      {bug ? (
        <View style={styles.bugInSlot}>
          {bug.photo ? (
            <Image source={{ uri: bug.photo }} style={styles.bugPhoto} />
          ) : (
            <PixelatedEmoji type="bug" size={32} color={theme.colors.text} />
          )}
          <Text style={styles.bugLevel}>Lv.{bug.level}</Text>
        </View>
      ) : (
        <Text style={styles.emptySlotText}>+</Text>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ThemedText style={styles.loadingText}>Loading your bug collection...</ThemedText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header with XP Progress */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <PixelatedEmoji type="bug" size={24} color={theme.colors.text} />
            <ThemedText style={styles.title}>BugLord</ThemedText>
          </View>
          <ThemedText style={styles.subtitle}>Level {collection.level} Explorer</ThemedText>
          <XPProgressBar
            currentXP={collection.xp}
            maxXP={100}
            level={collection.level}
            animated={true}
          />
        </View>

        {/* Main Actions */}
        <View style={styles.actionsContainer}>
          {/* Scan Mode Toggle */}
          <View style={styles.scanModeToggle}>
            <TouchableOpacity
              style={[
                styles.scanModeOption,
                scanMode === 'photo' && { backgroundColor: theme.colors.primary },
              ]}
              onPress={() => setScanMode('photo')}
            >
              <Text style={[
                styles.scanModeText,
                scanMode === 'photo' && styles.scanModeTextActive,
              ]}>📷 Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.scanModeOption,
                scanMode === 'liveScan' && { backgroundColor: theme.colors.primary },
              ]}
              onPress={() => setScanMode('liveScan')}
            >
              <Text style={[
                styles.scanModeText,
                scanMode === 'liveScan' && styles.scanModeTextActive,
              ]}>🎯 Live Scan</Text>
            </TouchableOpacity>
          </View>

          {/* Camera Button - Main Action */}
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={() => setShowCamera(true)}
          >
            <Text style={styles.cameraIcon}>{scanMode === 'liveScan' ? '🎯' : '📸'}</Text>
            <ThemedText style={styles.cameraButtonText}>
              {scanMode === 'liveScan' ? 'Live Scan' : 'Capture Bug'}
            </ThemedText>
            <ThemedText style={styles.cameraButtonSubtext}>
              {scanMode === 'liveScan' ? 'Real-time AI detection' : 'Discover new species'}
            </ThemedText>
          </TouchableOpacity>

          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <View style={styles.statCard}>
              <ThemedText style={styles.statNumber}>{collection.bugs.length}</ThemedText>
              <ThemedText style={styles.statLabel}>Bugs Found</ThemedText>
            </View>
            <View style={styles.statCard}>
              <ThemedText style={styles.statNumber}>{collection.party.filter(Boolean).length}/6</ThemedText>
              <ThemedText style={styles.statLabel}>Party</ThemedText>
            </View>
          </View>
        </View>

        {/* Party Display */}
        <View style={styles.partyContainer}>
          <View style={styles.sectionTitleContainer}>
            <PixelatedEmoji type="party" size={20} color={theme.colors.text} />
            <ThemedText style={styles.sectionTitle}>Your Party</ThemedText>
          </View>
          <View style={styles.partyGrid}>
            {collection.party.map((bug, index) => renderPartySlot(bug, index))}
          </View>
          <TouchableOpacity 
            style={styles.managePartyButton}
            onPress={() => setShowPartyManagement(true)}
          >
            <ThemedText style={styles.managePartyButtonText}>Manage Party</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Collection Access */}
        <TouchableOpacity 
          style={styles.collectionButton}
          onPress={() => setShowCollection(true)}
        >
          <PixelatedEmoji type="dex" size={20} color="#ffffff" />
          <View style={styles.collectionButtonContent}>
            <ThemedText style={styles.collectionButtonText}>View Collection</ThemedText>
            <ThemedText style={styles.collectionButtonSubtext}>
              Browse all {collection.bugs.length} discovered bugs
            </ThemedText>
          </View>
          <Text style={styles.arrowIcon}>→</Text>
        </TouchableOpacity>

        {/* Recent Catches */}
        {collection.bugs.length > 0 && (
          <View style={styles.recentSection}>
            <ThemedText style={styles.sectionTitle}>🕐 Recent Discoveries</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentList}>
              {collection.bugs.slice(-5).reverse().map((bug) => (
                <TouchableOpacity 
                  key={bug.id} 
                  style={styles.recentBugCard}
                  onPress={() => handleRecentBugTap(bug)}
                  activeOpacity={0.7}
                >
                  {bug.photo ? (
                    <Image source={{ uri: bug.photo }} style={styles.recentBugPhoto} />
                  ) : bug.pixelArt ? (
                    <Image source={{ uri: bug.pixelArt }} style={styles.recentBugPhoto} />
                  ) : (
                    <View style={styles.recentBugPhoto}>
                      <PixelatedEmoji type="bug" size={24} color={theme.colors.text} />
                    </View>
                  )}
                  <ThemedText style={styles.recentBugName} numberOfLines={1}>
                    {bug.nickname || bug.name}
                  </ThemedText>
                  <Text style={[styles.rarityBadge, { backgroundColor: RARITY_CONFIG[bug.rarity].color }]}>
                    {bug.rarity}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Camera Modal */}
      <Modal
        visible={showCamera}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <BugCamera
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
          mode={scanMode}
          onClassifyPhoto={handleClassifyPhoto}
          onLiveScanConfirm={handleLiveScanConfirm}
        />
      </Modal>



      {/* Loading Modal for AI Processing */}
      {isIdentifying && (
        <Modal
          visible={isIdentifying}
          animationType="fade"
          transparent={true}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.loadingModal}>
              <ThemedText style={styles.modalTitle}>🤖 AI Analyzing...</ThemedText>
              {capturedPhoto && (
                <Image source={{ uri: capturedPhoto }} style={styles.capturedPhotoPreview} />
              )}
              <ActivityIndicator 
                size="large" 
                color={theme.colors.primary} 
                style={styles.loadingIndicator}
              />
              <ThemedText style={styles.modalText}>
                Using advanced AI to identify your bug...
              </ThemedText>
            </View>
          </View>
        </Modal>
      )}

      {/* Bug Information Modal */}
      <BugInfoModal
        visible={showBugIdentification && !isIdentifying}
        bug={identifiedBug}
        onClose={handleBugInfoClose}
        onConfirm={handleBugInfoConfirm}
        isNewCatch={true}
        candidates={identificationResult?.candidates || []}
      />

      {/* Recent Bug Info Modal */}
      <BugInfoModal
        visible={showRecentBugModal}
        bug={selectedRecentBug}
        onClose={handleCloseRecentBugModal}
        onConfirm={handleConfirmRecentBug}
        isNewCatch={false}
        candidates={[]}
      />

      {/* Party Management Modal */}
      <Modal
        visible={showPartyManagement}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <ThemedView style={styles.partyManagementContainer}>
          <View style={styles.partyManagementHeader}>
            <TouchableOpacity 
              onPress={() => setShowPartyManagement(false)}
              style={styles.closeButton}
            >
              <ThemedText style={styles.closeButtonText}>✕</ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.partyManagementTitle}>Manage Party</ThemedText>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.partyManagementScroll}>
            {/* Current Party */}
            <View style={styles.partyManagementSection}>
              <ThemedText style={styles.partyManagementSectionTitle}>Current Party (Tap to Remove)</ThemedText>
              <View style={styles.partyManagementGrid}>
                {collection.party.map((bug, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.partyManagementSlot,
                      !bug && styles.partyManagementEmptySlot
                    ]}
                    onPress={() => {
                      if (bug) {
                        removeBugFromParty(index);
                      }
                    }}
                  >
                    {bug ? (
                      <>
                        {bug.photo ? (
                          <Image source={{ uri: bug.photo }} style={styles.partyManagementBugPhoto} />
                        ) : bug.pixelArt ? (
                          <Image source={{ uri: bug.pixelArt }} style={styles.partyManagementBugPhoto} />
                        ) : (
                          <PixelatedEmoji type="bug" size={40} color={theme.colors.text} />
                        )}
                        <ThemedText style={styles.partyManagementBugName} numberOfLines={1}>
                          {bug.nickname || bug.name}
                        </ThemedText>
                        <ThemedText style={styles.partyManagementBugLevel}>Lv.{bug.level}</ThemedText>
                        <Text style={[
                          styles.partyManagementRarityBadge,
                          { backgroundColor: RARITY_CONFIG[bug.rarity].color }
                        ]}>
                          {bug.rarity}
                        </Text>
                      </>
                    ) : (
                      <ThemedText style={styles.partyManagementEmptyText}>Empty Slot</ThemedText>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Available Bugs */}
            <View style={styles.partyManagementSection}>
              <ThemedText style={styles.partyManagementSectionTitle}>
                Available Bugs (Tap to Add to Party)
              </ThemedText>
              <View style={styles.partyManagementGrid}>
                {collection.bugs
                  .filter(bug => !collection.party.some(partyBug => partyBug?.id === bug.id))
                  .map((bug) => (
                    <TouchableOpacity
                      key={bug.id}
                      style={styles.partyManagementSlot}
                      onPress={() => {
                        const hasSpace = collection.party.some(slot => slot === null);
                        if (hasSpace) {
                          addBugToParty(bug);
                        } else {
                          Alert.alert(
                            'Party Full',
                            'Your party is full! Remove a bug from your party first.',
                            [{ text: 'OK' }]
                          );
                        }
                      }}
                    >
                      {bug.photo ? (
                        <Image source={{ uri: bug.photo }} style={styles.partyManagementBugPhoto} />
                      ) : bug.pixelArt ? (
                        <Image source={{ uri: bug.pixelArt }} style={styles.partyManagementBugPhoto} />
                      ) : (
                        <PixelatedEmoji type="bug" size={40} color={theme.colors.text} />
                      )}
                      <ThemedText style={styles.partyManagementBugName} numberOfLines={1}>
                        {bug.nickname || bug.name}
                      </ThemedText>
                      <ThemedText style={styles.partyManagementBugLevel}>Lv.{bug.level}</ThemedText>
                      <Text style={[
                        styles.partyManagementRarityBadge,
                        { backgroundColor: RARITY_CONFIG[bug.rarity].color }
                      ]}>
                        {bug.rarity}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
              {collection.bugs.filter(bug => !collection.party.some(partyBug => partyBug?.id === bug.id)).length === 0 && (
                <ThemedText style={styles.partyManagementEmptyMessage}>
                  All bugs are in your party!
                </ThemedText>
              )}
            </View>
          </ScrollView>
        </ThemedView>
      </Modal>

      {/* Collection Modal */}
      <Modal
        visible={showCollection}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <CollectionScreen
          onClose={() => setShowCollection(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 100,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 2,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
    color: theme.colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  actionsContainer: {
    marginBottom: 20,
  },
  scanModeToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  scanModeOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanModeText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scanModeTextActive: {
    color: '#FFFFFF',
  },
  cameraButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    padding: 22,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: `${theme.colors.primary}90`,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  cameraIcon: {
    fontSize: 42,
    marginBottom: 6,
  },
  cameraButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
    marginBottom: 3,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  cameraButtonSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  partyContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  partyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  partySlot: {
    width: (screenWidth - 48) / 3,
    aspectRatio: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  emptyPartySlot: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderColor: theme.colors.separator,
  },
  bugInSlot: {
    alignItems: 'center',
  },
  bugPhoto: {
    width: 38,
    height: 38,
    borderRadius: 6,
    marginBottom: 4,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  bugEmoji: {
    fontSize: 30,
    marginBottom: 4,
  },
  bugLevel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.warning,
    textTransform: 'uppercase',
  },
  emptySlotText: {
    fontSize: 22,
    color: theme.colors.textMuted,
    fontWeight: '900',
  },
  managePartyButton: {
    backgroundColor: theme.colors.card,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  managePartyButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  collectionButton: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderLeftWidth: 5,
    borderLeftColor: theme.colors.primary,
  },
  collectionIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  collectionButtonContent: {
    flex: 1,
  },
  collectionButtonText: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  collectionButtonSubtext: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  arrowIcon: {
    fontSize: 18,
    color: theme.colors.primary,
    fontWeight: '900',
  },
  recentSection: {
    marginBottom: 20,
  },
  recentList: {
    marginTop: 6,
  },
  recentBugCard: {
    width: 96,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 10,
    marginRight: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  recentBugPhoto: {
    width: 46,
    height: 46,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  recentBugPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 6,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  recentBugEmoji: {
    fontSize: 22,
  },
  recentBugName: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 3,
  },
  rarityBadge: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
    overflow: 'hidden',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingModal: {
    backgroundColor: theme.colors.card,
    borderRadius: 10,
    padding: 22,
    marginHorizontal: 32,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  capturedPhotoPreview: {
    width: 110,
    height: 110,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 3,
    borderColor: theme.colors.border,
  },
  modalText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    color: theme.colors.textSecondary,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: `${theme.colors.primary}80`,
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  loadingIndicator: {
    marginVertical: 16,
  },
  resultContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  bugName: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  bugSpecies: {
    fontSize: 16,
    fontStyle: 'italic',
    marginBottom: 8,
    color: theme.colors.textSecondary,
  },
  bugDescription: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 10,
    color: theme.colors.textSecondary,
  },
  detailsContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 12,
  },
  detailText: {
    fontSize: 13,
    fontWeight: '600',
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  alternateButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  alternateButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  partyManagementContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  partyManagementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 3,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  closeButton: {
    padding: 8,
    width: 38,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.text,
  },
  partyManagementTitle: {
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  partyManagementScroll: {
    flex: 1,
    padding: 16,
  },
  partyManagementSection: {
    marginBottom: 28,
  },
  partyManagementSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  partyManagementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  partyManagementSlot: {
    width: (screenWidth - 48) / 3,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  partyManagementEmptySlot: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderColor: theme.colors.separator,
    justifyContent: 'center',
  },
  partyManagementBugPhoto: {
    width: 54,
    height: 54,
    borderRadius: 6,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  partyManagementBugName: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 3,
  },
  partyManagementBugLevel: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.warning,
    marginBottom: 3,
  },
  partyManagementRarityBadge: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
    overflow: 'hidden',
  },
  partyManagementEmptyText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    color: theme.colors.textMuted,
  },
  partyManagementEmptyMessage: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 18,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
});