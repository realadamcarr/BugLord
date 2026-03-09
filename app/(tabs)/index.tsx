import { BugCamera, ScanMode } from '@/components/BugCamera';
import { BugInfoModal } from '@/components/BugInfoModal';
import { CollectionScreen } from '@/components/CollectionScreen';
import PixelatedEmoji from '@/components/PixelatedEmoji';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { XPProgressBar } from '@/components/XPProgressBar';
import { BUG_SPRITE } from '@/constants/bugSprites';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { bugIdentificationService } from '@/services/BugIdentificationService';
import { predictInsect } from '@/services/BackendPredictionService';
import { datasetUploadService } from '@/services/DatasetUploadService';
import { recordConfirmedLabel } from '@/services/LearningService';
import { appendScanLog } from '@/services/ScanLogService';
import { mlPreprocessingService } from '@/services/ml/MLPreprocessingService';
import { modelUpdateService } from '@/services/ml/ModelUpdateService';
import { onDeviceClassifier } from '@/services/ml/OnDeviceClassifier';
import { runBugScanPipeline, ScanResult } from '@/src/features/scanner/scanPipeline';
import { classifyBugImage, isClassifierReady, loadBugClassifier } from '@/src/ml/bugClassifier';
import { GbifSpeciesSuggestion } from '@/src/services/gbifService';
import { BugPrediction, buildPrediction } from '@/src/types/bugPrediction';
import { Bug, BugIdentificationResult, ConfirmationMethod, IdentificationCandidate, RARITY_CONFIG } from '@/types/Bug';
import { labelToCategory } from '@/utils/bugCategory';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: screenWidth } = Dimensions.get('window');

// Map raw YOLO / classification labels → BugLord SAMPLE_BUGS species names.
const YOLO_SPECIES_MAP: Record<string, string> = {
  'Butterfly':   'Monarch Butterfly',
  'Dragonfly':   'Blue Dasher Dragonfly',
  'Grasshopper': 'Grasshopper',
  'Ladybug':     'Ladybug',
  'Mosquito':    'Mosquito',
  'Moth':        'Luna Moth',
  'Bees':        'Honey Bee',
  'ant':         'Black Garden Ant',
  'beetle':      'Stag Beetle',
  'caterpillar': 'Caterpillar',
  'earthworms':  'Earthworm',
  'wasp':        'Paper Wasp',
};

export default function CaptureScreen() {
  const { theme } = useTheme();
  const { collection, addBugToCollection, addBugToParty, removeBugFromParty, switchParty, updateBugNickname, loading } = useBugCollection();
  const [showCamera, setShowCamera] = useState(false);
  const [showBugIdentification, setShowBugIdentification] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [showPartyManagement, setShowPartyManagement] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identificationResult, setIdentificationResult] = useState<BugIdentificationResult | null>(null);
  const [rescanCount, setRescanCount] = useState(0);
  const [identifiedBug, setIdentifiedBug] = useState<Bug | null>(null);
  const [selectedRecentBug, setSelectedRecentBug] = useState<Bug | null>(null);
  const [showRecentBugModal, setShowRecentBugModal] = useState(false);
  const [mlReady, setMlReady] = useState(false);
  const [modelVersion, setModelVersion] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<ScanMode>('photo');
  const [lastPrediction, setLastPrediction] = useState<BugPrediction | null>(null);
  const [lastGbifSuggestions, setLastGbifSuggestions] = useState<GbifSpeciesSuggestion[]>([]);

  // Scan mode slider animation
  const SCAN_MODES: ScanMode[] = ['photo', 'liveScan', 'gallery'];
  const SCAN_LABELS: Record<ScanMode, string> = { photo: '📷 Photo', liveScan: '🎯 Live Scan', gallery: '🖼️ Gallery' };
  const scanSliderAnim = useRef(new Animated.Value(0)).current;
  const scanScaleAnims = useRef(SCAN_MODES.map(() => new Animated.Value(1))).current;
  const [scanToggleWidth, setScanToggleWidth] = useState(0);

  const styles = createStyles(theme);

  // Animate scan mode slider on mode change
  useEffect(() => {
    const index = SCAN_MODES.indexOf(scanMode);
    Animated.spring(scanSliderAnim, {
      toValue: index,
      useNativeDriver: true,
      tension: 68,
      friction: 10,
    }).start();
    scanScaleAnims.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: i === index ? 1.08 : 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }).start();
    });
  }, [scanMode]);

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

      // Also initialize the new honest classifier (src/ml/bugClassifier.ts)
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        await loadBugClassifier(require('../../assets/ml/model.tflite'));
        console.log('✅ New BugClassifier ready:', isClassifierReady());
      } catch (err) {
        console.warn('⚠️ New BugClassifier init failed (non-fatal):', err);
      }

      // Process upload queue
      datasetUploadService.processQueue().catch(err =>
        console.warn('Upload queue processing failed:', err)
      );

    } catch (error) {
      console.error('❌ ML services initialization failed:', error);
    }
  };

  const loadMLModel = async () => {
    // YOLOv5 trained labels (12 classes from Kaggle insect dataset)
    // Superset of the original 6 — also handles the old model format.
    const MODEL_LABELS = [
      "Butterfly", "Dragonfly", "Grasshopper", "Ladybug",
      "Mosquito", "Moth", "Bees", "ant",
      "beetle", "caterpillar", "earthworms", "wasp",
    ];

    try {
      // 1. If a server-pushed model exists on disk, prefer that
      const hasLocal = await modelUpdateService.hasLocalModel();
      if (hasLocal) {
        const paths = modelUpdateService.getCurrentModelPaths();
        await onDeviceClassifier.loadModel(paths.modelPath, paths.labelsPath);
        const version = await modelUpdateService.getCurrentVersion();
        setModelVersion(version);
        setMlReady(true);
        console.log('✅ ML model loaded from server update:', version || 'bundled');
        return;
      }

      // 2. PRIMARY: Load directly from bundled asset via require()
      //    react-native-fast-tflite resolves the Metro asset ID natively,
      //    avoiding the entire copy-to-document-directory dance.
      console.log('🧠 Loading TFLite model from bundled asset...');
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const modelAssetModule = require('../../assets/ml/model.tflite');
        await onDeviceClassifier.loadModelFromAsset(modelAssetModule, MODEL_LABELS);

        if (onDeviceClassifier.isUsingRealModel()) {
          setModelVersion('bundled-tflite');
          setMlReady(true);
          console.log('✅ TFLite model loaded from bundled asset — REAL inference active');
          return;
        }
        // loadModelFromAsset sets modelLoaded=true even if the native module
        // isn't available (Expo Go) — check isUsingRealModel() above.
        console.warn('⚠️ TFLite native module unavailable — loaded labels only from asset approach');
        console.warn('   Reason:', onDeviceClassifier.modelLoadError ?? 'unknown');
      } catch (assetErr) {
        console.warn('⚠️ Bundled asset model load failed:', assetErr);
      }

      // 3. FALLBACK: Try file-path approach (copy asset to documentDirectory)
      //    This handles edge cases where direct asset loading doesn't work.
      console.log('📦 Trying file-path fallback...');
      try {
        const FileSystem = require('expo-file-system/legacy');
        const Asset = require('expo-asset').Asset;
        const modelDir = `${FileSystem.documentDirectory}ml/`;
        const modelPath = `${modelDir}model.tflite`;
        const labelsPath = `${modelDir}labels.json`;

        await FileSystem.makeDirectoryAsync(modelDir, { intermediates: true }).catch(() => {});

        // Write labels
        await FileSystem.writeAsStringAsync(labelsPath, JSON.stringify(MODEL_LABELS, null, 2));

        // Copy model via expo-asset
        const modelInfo = await FileSystem.getInfoAsync(modelPath);
        if (!modelInfo.exists || (modelInfo.size && modelInfo.size < 100000)) {
          const modelAsset = Asset.fromModule(require('../../assets/ml/model.tflite'));
          await modelAsset.downloadAsync();
          if (modelAsset.localUri) {
            await FileSystem.copyAsync({ from: modelAsset.localUri, to: modelPath });
            console.log('✅ Copied model to documentDirectory via expo-asset');
          }
        }

        // Try loading from file path
        const fileInfo = await FileSystem.getInfoAsync(modelPath);
        if (fileInfo.exists && fileInfo.size > 100000) {
          await onDeviceClassifier.loadModel(modelPath, labelsPath);
          if (onDeviceClassifier.isUsingRealModel()) {
            setModelVersion('bundled-file');
            setMlReady(true);
            console.log('✅ TFLite model loaded from file path — REAL inference active');
            return;
          }
        }
      } catch (fileErr) {
        console.warn('⚠️ File-path model loading failed:', fileErr);
      }

      // 4. LABELS-ONLY: Classifier can produce stubs but not real inference.
      //    iNaturalist + color analysis will handle identification.
      console.warn('⚠️ No real TFLite model available — using labels-only mode');
      console.warn('   Model load error:', onDeviceClassifier.modelLoadError ?? 'none');
      if (!onDeviceClassifier.isReady()) {
        // Ensure at least labels are loaded
        try {
          await onDeviceClassifier.loadModelFromAsset(
            require('../../assets/ml/model.tflite'),
            MODEL_LABELS
          );
        } catch {
          // Last resort — just make it not crash
        }
      }
      setModelVersion('labels-only');
      setMlReady(true);
      console.log('✅ ML ready in labels-only mode (iNaturalist + color analysis will run)');

    } catch (error) {
      console.error('❌ Model loading failed completely:', error);
      setMlReady(false);
    }
  };

  const handleCameraCapture = async (photoUri: string) => {
    setCapturedPhoto(photoUri);
    setShowCamera(false);
    
    // Automatically process the captured photo
    await processAndClassify(photoUri, photoUri);
  };

  // ─── Gallery Scan ─────────────────────────────────────────
  const pickFromGalleryAndScan = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'BugLord needs access to your photo library to scan existing bug photos.',
          [{ text: 'OK' }]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        exif: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const photoUri = result.assets[0].uri;
      setCapturedPhoto(photoUri);

      // Reuse the exact same detection pipeline as camera capture
      await processAndClassify(photoUri, photoUri);
    } catch (error) {
      console.error('Gallery scan failed:', error);
      Alert.alert('Error', 'Failed to scan the selected photo. Please try again.');
    }
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
    setRescanCount(0);
    setLastPrediction(null);
    setLastGbifSuggestions([]);

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

      // Use detected crop whenever available so identification isn't biased by background.
      const analysisPhoto = processedImage.croppedImage || imageToClassify || originalPhoto;

      // ── NEW HONEST PIPELINE ────────────────────────────────
      // Primary path: runBugScanPipeline → offline TFLite classifier + GBIF enrichment.
      // Falls back to legacy path only when the new classifier isn't loaded.

      let mlCandidates: any[] = [];
      let prediction: BugPrediction | null = null;
      let pipelineGbif: GbifSpeciesSuggestion[] = [];

      // ── PRIORITY 1: FastAPI backend (EVA-02 iNat21 model) ──────────
      // Always try the backend first — even for live-scan confirmed results,
      // the backend provides species-level precision the on-device model can't.
      let backendHandled = false;
      try {
        console.log('🌐 Trying FastAPI backend prediction…');
        const backendResult = await predictInsect(analysisPhoto);
        console.log('🌐 Backend result:', backendResult);

        // Accept any result where the backend returned a real prediction
        // (confidence > 0 means the model produced a usable output).
        // Also accept when topPredictions are available — even if the main
        // prediction was below threshold, the species-level candidates are
        // far more informative than the 6-class on-device model.
        const hasMainPrediction = backendResult.confidence > 0;
        const hasTopPredictions = backendResult.topPredictions && backendResult.topPredictions.length > 0;

        if (hasMainPrediction) {
            // Prefer common name from iNaturalist, then display label, then species name.
            const label = backendResult.commonName
              || backendResult.displayLabel
              || backendResult.speciesName
              || 'Unknown Bug';
            mlCandidates = [{
              label,
              confidence: backendResult.confidence,
              source: 'backend-eva02',
            }];
            backendHandled = true;
        } else if (hasTopPredictions) {
            // Main prediction was below threshold, but we still have top-N species.
            // Use the best one that maps to a BugLord category, or the overall best.
            const topPreds = backendResult.topPredictions!;
            const bestMapped = topPreds.find(t => t.mappedBuglordType);
            const best = bestMapped || topPreds[0];
            const label = (best as any).commonName
              || (best.mappedBuglordType
                ? best.mappedBuglordType.charAt(0).toUpperCase() + best.mappedBuglordType.slice(1)
                : best.speciesName);
            mlCandidates = [{
              label,
              confidence: best.confidence,
              source: 'backend-eva02',
            }];
            backendHandled = true;
            console.log('🌐 Using backend top prediction (main was below threshold):', mlCandidates[0]);
        }

        // Add runner-up candidates from topPredictions
        if (backendHandled && hasTopPredictions) {
            const topPreds = backendResult.topPredictions!;
            const primaryLabel = mlCandidates[0]?.label;
            topPreds.slice(0, 5).forEach(t => {
              const candidateLabel = (t as any).commonName
                || (t.mappedBuglordType
                  ? t.mappedBuglordType.charAt(0).toUpperCase() + t.mappedBuglordType.slice(1)
                  : t.speciesName);
              if (candidateLabel !== primaryLabel) {
                mlCandidates.push({
                  label: candidateLabel,
                  confidence: t.confidence,
                  source: 'backend-eva02',
                });
              }
            });
        }

        if (backendHandled) {
            console.log('✅ Backend identification accepted:', mlCandidates[0]);
          }
        } catch (backendErr) {
          console.warn('⚠️ Backend prediction failed, falling back to local pipeline:', backendErr);
        }

      if (backendHandled) {
        // Backend handled it — skip all other pipelines
      } else if (preConfirmedResult) {
        console.log('✅ Using pre-confirmed live scan result:', preConfirmedResult);
        mlCandidates = [{ label: preConfirmedResult.label, confidence: preConfirmedResult.confidence }];
        // Build a synthetic prediction for the UI
        prediction = buildPrediction([{ label: preConfirmedResult.label, confidence: preConfirmedResult.confidence }]);
      } else if (isClassifierReady()) {
        // ── Run the new honest scan pipeline ──
        console.log('🔬 Running honest scan pipeline (offline model + GBIF enrichment)…');
        const scanResult: ScanResult = await runBugScanPipeline(analysisPhoto);
        prediction = scanResult.prediction;
        pipelineGbif = scanResult.gbifSuggestions;

        if (prediction.accepted) {
          // Map the broad class through YOLO_SPECIES_MAP for game-friendly names
          const mapped = YOLO_SPECIES_MAP[prediction.broadClass] ?? prediction.broadClass;
          mlCandidates = [{ label: mapped, confidence: prediction.confidence, source: 'offline-model' }];
          // Also add runner-up classes as lower-priority candidates
          prediction.scores.slice(1, 5).forEach(s => {
            const m = YOLO_SPECIES_MAP[s.label] ?? s.label;
            mlCandidates.push({ label: m, confidence: s.confidence, source: 'offline-model' });
          });
        } else {
          // Model not confident — still provide candidates for manual selection
          prediction.scores.slice(0, 5).forEach(s => {
            const m = YOLO_SPECIES_MAP[s.label] ?? s.label;
            mlCandidates.push({ label: m, confidence: s.confidence, source: 'offline-model' });
          });
          if (mlCandidates.length === 0) {
            mlCandidates = [{ label: 'Unknown Bug', confidence: 0, source: 'manual' }];
          }
        }
      } else {
        // ── Legacy fallback when new classifier isn't available ──
        console.log('⚠️ New classifier not ready — falling back to legacy pipeline');
        const usingRealModel = onDeviceClassifier.isUsingRealModel();
        console.log(`🔍 ML Debug — mlReady: ${mlReady}, isUsingRealModel: ${usingRealModel}`);

        // Step 1: Run old TFLite on-device classification
        let tfliteCandidates: any[] = [];
        if (mlReady && onDeviceClassifier.isReady()) {
          try {
            const mlInput = await mlPreprocessingService.preprocessForInference(analysisPhoto, { targetSize: 224, quality: 0.9 });
            const candidates = await onDeviceClassifier.classifyImage(mlInput, 5);
            const allStubs = candidates.length > 0 && candidates.every((c: any) => c.source === 'stub');
            if (!allStubs) tfliteCandidates = candidates;
          } catch (err) { console.warn('⚠️ TFLite classification failed:', err); }
        }

        // Step 2: Query iNaturalist as enrichment
        let iNatCandidates: any[] = [];
        try {
          const tfliteTopLabel = tfliteCandidates[0]?.label;
          if (tfliteTopLabel) {
            const iNatResult = await bugIdentificationService.identifyWithINaturalistQuery(tfliteTopLabel);
            if (iNatResult?.candidates?.length) {
              iNatCandidates = iNatResult.candidates.map((c: any) => ({ label: c.label || c.species, confidence: c.confidence, source: c.source || 'iNaturalist' }));
            }
          }
          if (iNatCandidates.length === 0) {
            const fullResult = await bugIdentificationService.identify(analysisPhoto);
            if (fullResult?.candidates?.length) {
              iNatCandidates = fullResult.candidates.map((c: any) => ({ label: c.label || c.species, confidence: c.confidence, source: c.source || fullResult.provider || 'iNaturalist' }));
            }
          }
        } catch (err) { console.warn('⚠️ iNaturalist failed:', err); }

        // Merge
        const TFLITE_CONFIDENCE_FLOOR = 0.4;
        const tfliteTopConf = tfliteCandidates.length > 0 ? Math.max(...tfliteCandidates.map((c: any) => c.confidence)) : 0;
        if (tfliteCandidates.length > 0 && iNatCandidates.length > 0) {
          if (tfliteTopConf >= TFLITE_CONFIDENCE_FLOOR) {
            const seenLabels = new Set(tfliteCandidates.map((c: any) => c.label));
            mlCandidates = [...tfliteCandidates, ...iNatCandidates.filter((c: any) => !seenLabels.has(c.label))].slice(0, 10);
          } else {
            const seenLabels = new Set(iNatCandidates.map((c: any) => c.label));
            mlCandidates = [...iNatCandidates, ...tfliteCandidates.filter((c: any) => !seenLabels.has(c.label))].slice(0, 10);
          }
        } else if (tfliteCandidates.length > 0) { mlCandidates = tfliteCandidates; }
        else if (iNatCandidates.length > 0) { mlCandidates = iNatCandidates; }
        if (mlCandidates.length === 0) mlCandidates = [{ label: 'Unknown Bug', confidence: 0, source: 'manual' }];
      }

      // Store pipeline results for BugInfoModal
      setLastPrediction(prediction);
      setLastGbifSuggestions(pipelineGbif);

      // Use identification results
      console.log('✅ Identification results:', mlCandidates);
      
      // Convert predictions to BugIdentificationResult format.
      // Apply YOLO_SPECIES_MAP so raw model labels become game-friendly names.
      let candidates: IdentificationCandidate[] = mlCandidates.map(candidate => {
        const mapped = YOLO_SPECIES_MAP[candidate.label] ?? candidate.label;
        return {
          label: mapped,
          species: mapped,
          confidence: candidate.confidence,
          source: candidate.source || 'ML Model',
        };
      });

      // Refine ant predictions using color analysis (red vs black vs carpenter)
      if (candidates[0]?.label?.toLowerCase() === 'ant') {
        console.log('🐜 Top prediction is ant — running sub-classification...');
        candidates = await bugIdentificationService.refineAntPrediction(candidates, analysisPhoto);
      }

      // Rescue butterfly false-positive path from ML outputs:
      // if top is Ladybug but we have any butterfly/moth signal, promote that.
      if (candidates[0]?.label?.toLowerCase() === 'ladybug') {
        const butterflyCandidate = candidates.find((c) => /butterfly|moth/i.test(c.label));
        if (butterflyCandidate) {
          candidates = [
            { ...butterflyCandidate, confidence: Math.max(butterflyCandidate.confidence ?? 0.7, 0.86) },
            ...candidates.filter((c) => c.label !== butterflyCandidate.label),
          ];
          console.log(`🦋 ML rescue: promoted ${butterflyCandidate.label} over Ladybug`);
        }
        // Otherwise trust the Ladybug prediction — no forced Monarch override.
      }

      const result = {
        candidates,
        provider: candidates[0]?.source || 'ML',
        isFromAPI: false
      };

      setIdentificationResult(result);

      // Use first candidate as default preview
      const top = result.candidates[0];

      // Look up the matching SAMPLE_BUG to get proper rarity/biome/description/traits
      const { SAMPLE_BUGS: sampleBugs } = await import('@/types/Bug');
      const matchedSample = sampleBugs.find(b => b.name === top?.label);

      const bugData: Partial<Bug> = {
        name: top?.label || 'Unknown bug',
        species: top?.species || matchedSample?.species || 'Unknown',
        description: matchedSample?.description || (top ? `Identified via ${result.provider}` : 'Unknown insect captured'),
        rarity: matchedSample?.rarity || 'common',
        biome: matchedSample?.biome || 'garden',
        photo: originalPhoto,
        pixelArt: processedImage.pixelatedIcon,
        category: top?.label ? labelToCategory(top.label) : undefined,
        traits: matchedSample?.traits || (top ? ['AI Identified'] : ['Unknown']),
        size: matchedSample?.size || 'medium',
        xpValue: RARITY_CONFIG[matchedSample?.rarity || 'common'].xpRange[0],
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
      // Don't leave the modal in a broken state — close it and let user retry
      setShowBugIdentification(false);
      setIdentifiedBug(null);
      setIdentificationResult(null);
      Alert.alert(
        'Processing Error', 
        'Could not process the image. Please try again.',
        [
          { text: 'Retry', onPress: () => capturedPhoto && processAndClassify(capturedPhoto, capturedPhoto) },
          { text: 'Cancel', style: 'cancel' },
        ]
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

      // Record learning signal: original top prediction vs what user confirmed
      const originalLabel = identificationResult?.candidates?.find(
        (_, i) => i === rescanCount
      )?.label ?? identifiedBug.name;
      const finalLabel = confirmedLabel || identifiedBug.name;
      recordConfirmedLabel(originalLabel, finalLabel).catch(() => {});

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
    setLastPrediction(null);
    setLastGbifSuggestions([]);
  };

  const handleRescan = async () => {
    if (!capturedPhoto) return;

    // Always re-run the FULL identification pipeline (TFLite + iNaturalist).
    // This gives the user a fresh analysis every time instead of cycling
    // through stale/stub candidates.
    console.log('🔄 Rescan: re-running full identification pipeline...');
    setRescanCount(prev => prev + 1);
    setIdentifiedBug(null);
    setIdentificationResult(null);
    await processAndClassify(capturedPhoto, capturedPhoto);
  };

  // ─── Live Scan Callbacks ──────────────────────────────────────
  /** Classify a single photo for live scan.
   *  Priority: New bugClassifier (honest) → legacy TFLite → Unknown.
   *  Returns null ONLY when nothing at all is ready yet. */
  const handleClassifyPhoto = useCallback(async (photoUri: string): Promise<{ label: string; confidence: number } | null> => {
    console.log(`🔍 handleClassifyPhoto — newClassifierReady: ${isClassifierReady()}, mlReady: ${mlReady}`);

    // 1. New honest classifier — preferred path
    if (isClassifierReady()) {
      try {
        const scores = await classifyBugImage(photoUri);
        if (scores.length > 0 && scores[0].confidence >= 0.4) {
          const mapped = YOLO_SPECIES_MAP[scores[0].label] ?? scores[0].label;
          return { label: mapped, confidence: scores[0].confidence };
        }
        // Low confidence — fall through
        if (scores.length > 0) {
          const mapped = YOLO_SPECIES_MAP[scores[0].label] ?? scores[0].label;
          return { label: mapped, confidence: scores[0].confidence };
        }
      } catch (err) {
        console.warn('New classifier live scan error:', err);
      }
    }

    // 2. Legacy TFLite fallback
    if (mlReady && onDeviceClassifier.isReady() && onDeviceClassifier.isUsingRealModel()) {
      try {
        const mlInput = await mlPreprocessingService.preprocessForInference(photoUri, {
          targetSize: 224,
          quality: 0.7,
        });
        const candidates = await onDeviceClassifier.classifyImage(mlInput, 3);
        const real = candidates.filter((c: any) => c.source !== 'stub');
        if (real.length > 0 && real[0].label) {
          const mappedLabel = YOLO_SPECIES_MAP[real[0].label] ?? real[0].label;
          return { label: mappedLabel, confidence: real[0].confidence };
        }
      } catch (err) {
        console.warn('TFLite live scan error:', err);
      }
    }

    return { label: 'Unknown Bug', confidence: 0.15 };
  }, [mlReady]);

  /** Called in background after local ML result — sends photo to backend for species-level ID */
  const handleRefineScanLabel = useCallback(async (photoUri: string): Promise<{ label: string; confidence: number } | null> => {
    try {
      const backendResult = await predictInsect(photoUri);
      if (backendResult.confidence > 0) {
        const label = backendResult.commonName
          || backendResult.displayLabel
          || backendResult.speciesName
          || null;
        if (label) {
          return { label, confidence: backendResult.confidence };
        }
      }
      // Check top predictions as fallback
      if (backendResult.topPredictions?.length) {
        const best = backendResult.topPredictions.find(t => t.mappedBuglordType) || backendResult.topPredictions[0];
        const label = (best as any).commonName
          || (best.mappedBuglordType
            ? best.mappedBuglordType.charAt(0).toUpperCase() + best.mappedBuglordType.slice(1)
            : best.speciesName);
        if (label) {
          return { label, confidence: best.confidence };
        }
      }
    } catch (err) {
      console.warn('⚠️ Backend refine failed:', err);
    }
    return null;
  }, []);

  /** Called when user taps "Capture!" after live scan lock */
  const handleLiveScanConfirm = async (photoUri: string, label: string, confidence: number) => {
    console.log('🎯 Live scan confirmed — sending to backend for species-level ID…', { label, confidence });
    setShowCamera(false);
    setCapturedPhoto(photoUri);

    // Backend is tried first inside processAndClassify; preConfirmedResult is the local fallback.
    await processAndClassify(photoUri, photoUri, { label, confidence });
  };

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
          {bug.category && BUG_SPRITE[bug.category] ? (
            <Image source={BUG_SPRITE[bug.category]} style={styles.bugPhoto} />
          ) : bug.photo ? (
            <Image source={{ uri: bug.photo }} style={styles.bugPhoto} />
          ) : (
            <PixelatedEmoji type="bug" size={32} color={theme.colors.text} />
          )}
          <Text style={styles.bugLevel}>Lv.{bug.level}</Text>
          {/* Health Bar */}
          {(() => {
            const maxHp = bug.maxHp || 100;
            const currentHp = bug.currentHp ?? maxHp;
            const hpPercent = Math.max(0, Math.min(1, currentHp / maxHp));
            const hpColor = hpPercent > 0.5 ? '#4CAF50' : hpPercent >= 0.25 ? '#FFC107' : '#F44336';
            return (
              <View style={styles.partyHpBarContainer}>
                <View style={styles.partyHpBarTrack}>
                  <View style={[styles.partyHpBarFill, { width: `${hpPercent * 100}%`, backgroundColor: hpColor }]} />
                </View>
              </View>
            );
          })()}
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
          {/* Dev mode warning when real TFLite model isn't loaded */}
          {modelVersion === 'labels-only' && (
            <View style={styles.devModeBanner}>
              <Text style={styles.devModeBannerIcon}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.devModeBannerText}>Development Mode</Text>
                <Text style={styles.devModeBannerSubtext}>
                  ML model unavailable — results use local fallback. Build with EAS for real AI classification.
                </Text>
              </View>
            </View>
          )}
          {/* Scan Mode Toggle — animated slider */}
          <View
            style={styles.scanModeToggle}
            onLayout={(e) => setScanToggleWidth(e.nativeEvent.layout.width - 8)}
          >
            {/* Sliding highlight indicator */}
            {scanToggleWidth > 0 && (
              <Animated.View
                style={{
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  bottom: 4,
                  width: scanToggleWidth / 3,
                  backgroundColor: theme.colors.primary,
                  borderRadius: 8,
                  transform: [{
                    translateX: scanSliderAnim.interpolate({
                      inputRange: [0, 1, 2],
                      outputRange: [0, scanToggleWidth / 3, (scanToggleWidth / 3) * 2],
                    }),
                  }],
                }}
              />
            )}
            {/* Scan mode options */}
            {SCAN_MODES.map((mode, index) => (
              <Animated.View
                key={mode}
                style={{ flex: 1, transform: [{ scale: scanScaleAnims[index] }] }}
              >
                <TouchableOpacity
                  style={styles.scanModeOption}
                  onPress={() => setScanMode(mode)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.scanModeText,
                    scanMode === mode && styles.scanModeTextActive,
                  ]}>{SCAN_LABELS[mode]}</Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

          {/* Main Action Button — opens camera or gallery depending on mode */}
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={() => scanMode === 'gallery' ? pickFromGalleryAndScan() : setShowCamera(true)}
          >
            <Text style={styles.cameraIcon}>
              {scanMode === 'gallery' ? '🖼️' : scanMode === 'liveScan' ? '🎯' : '📸'}
            </Text>
            <ThemedText style={styles.cameraButtonText}>
              {scanMode === 'gallery' ? 'Pick from Gallery' : scanMode === 'liveScan' ? 'Live Scan' : 'Capture Bug'}
            </ThemedText>
            <ThemedText style={styles.cameraButtonSubtext}>
              {scanMode === 'gallery' ? 'Identify a bug from an existing photo' : scanMode === 'liveScan' ? 'Real-time AI detection' : 'Discover new species'}
            </ThemedText>
          </TouchableOpacity>

          {/* ML Engine Status Badge */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8, marginBottom: 4, gap: 6 }}>
            <View style={{
              backgroundColor: onDeviceClassifier.isUsingRealModel() ? '#1B5E20' : '#B71C1C',
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexDirection: 'row', alignItems: 'center',
            }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                {onDeviceClassifier.isUsingRealModel() ? '🧠 TFLite: ACTIVE' : '⚠️ TFLite: OFF'}
              </Text>
            </View>
            <View style={{
              backgroundColor: '#0D47A1',
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
            }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>🌿 iNaturalist: ON</Text>
            </View>
            {modelVersion && (
              <View style={{
                backgroundColor: theme.colors.cardBackground,
                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1,
                borderColor: theme.colors.border,
              }}>
                <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: '600' }}>
                  v: {modelVersion}
                </Text>
              </View>
            )}
          </View>

          {/* Quick Stats */}
          <View style={styles.quickStats}>
            <TouchableOpacity style={styles.statCard} onPress={() => setShowCollection(true)}>
              <ThemedText style={styles.statNumber}>{collection.bugs.length}</ThemedText>
              <ThemedText style={styles.statLabel}>Bugs Found</ThemedText>
            </TouchableOpacity>
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
            <Text style={styles.partyBadge}>Loadout {collection.activePartyIndex + 1}</Text>
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
                  {bug.category && BUG_SPRITE[bug.category] ? (
                    <Image source={BUG_SPRITE[bug.category]} style={styles.recentBugPhoto} />
                  ) : bug.photo ? (
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
          onRefineScanLabel={handleRefineScanLabel}
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
        onRescan={handleRescan}
        isNewCatch={true}
        candidates={identificationResult?.candidates || []}
        prediction={lastPrediction}
        scanGbifSuggestions={lastGbifSuggestions}
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

          {/* Party Loadout Tabs */}
          <View style={styles.partyTabsContainer}>
            {['Party 1', 'Party 2', 'Party 3'].map((label, idx) => {
              const isActive = collection.activePartyIndex === idx;
              const bugCount = collection.parties[idx]?.filter(Boolean).length ?? 0;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.partyTab,
                    isActive && styles.partyTabActive,
                  ]}
                  onPress={() => switchParty(idx)}
                >
                  <Text style={[
                    styles.partyTabText,
                    isActive && styles.partyTabTextActive,
                  ]}>
                    {label}
                  </Text>
                  <Text style={[
                    styles.partyTabCount,
                    isActive && styles.partyTabCountActive,
                  ]}>
                    {bugCount}/6
                  </Text>
                </TouchableOpacity>
              );
            })}
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
                        {bug.category && BUG_SPRITE[bug.category] ? (
                          <Image source={BUG_SPRITE[bug.category]} style={styles.partyManagementBugPhoto} />
                        ) : bug.photo ? (
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
                        <ThemedText style={styles.partyManagementBugHp}>
                          HP {bug.currentHp ?? bug.maxHp ?? bug.maxXp}/{bug.maxHp ?? bug.maxXp}
                        </ThemedText>
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
                      {bug.category && BUG_SPRITE[bug.category] ? (
                        <Image source={BUG_SPRITE[bug.category]} style={styles.partyManagementBugPhoto} />
                      ) : bug.photo ? (
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
                      <ThemedText style={styles.partyManagementBugHp}>
                        HP {bug.currentHp ?? bug.maxHp ?? bug.maxXp}/{bug.maxHp ?? bug.maxXp}
                      </ThemedText>
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
  devModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFECB5',
  },
  devModeBannerIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  devModeBannerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#856404',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  devModeBannerSubtext: {
    fontSize: 10,
    color: '#856404',
    marginTop: 2,
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
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
  partyBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4ecdc4',
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
    marginLeft: 'auto',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  partyHpBarContainer: {
    width: '80%',
    marginTop: 3,
  },
  partyHpBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    overflow: 'hidden',
  },
  partyHpBarFill: {
    height: '100%',
    borderRadius: 2,
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
  partyTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  partyTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  partyTabActive: {
    borderColor: '#4ecdc4',
    backgroundColor: 'rgba(78, 205, 196, 0.15)',
  },
  partyTabText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  partyTabTextActive: {
    color: '#4ecdc4',
  },
  partyTabCount: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  partyTabCountActive: {
    color: '#4ecdc4',
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
  partyManagementBugHp: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginBottom: 4,
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