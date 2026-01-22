import { BugCamera } from '@/components/BugCamera';
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
import { Bug, BugIdentificationResult, ConfirmationMethod, RARITY_CONFIG } from '@/types/Bug';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export default function CaptureScreen() {
  const { theme } = useTheme();
  const { collection, addBugToCollection, addBugToParty, loading } = useBugCollection();
  const [showCamera, setShowCamera] = useState(false);
  const [showBugIdentification, setShowBugIdentification] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identificationResult, setIdentificationResult] = useState<BugIdentificationResult | null>(null);
  const [identifiedBug, setIdentifiedBug] = useState<Bug | null>(null);
  const [mlReady, setMlReady] = useState(false);
  const [modelVersion, setModelVersion] = useState<string | null>(null);

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
        // Try to load bundled model
        console.log('⚠️  No local model, attempting to load bundled assets...');
        // This would require bundling model files in assets/ml/
        // For now, classifier will use stub predictions
        setMlReady(false);
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

  const processAndClassify = async (imageToClassify: string, originalPhoto: string) => {
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

      // NEW: ML preprocessing for fixed input size
      const mlInput = await mlPreprocessingService.preprocessForInference(imageToClassify, {
        targetSize: 224,
        quality: 0.9,
      });

      console.log('🧠 Running ML classification...');

      // Try on-device ML first (if ready)
      let mlCandidates: any[] = [];
      if (mlReady && onDeviceClassifier.isReady()) {
        try {
          mlCandidates = await onDeviceClassifier.classifyImage(mlInput, 5);
          console.log('✅ ML classification complete:', mlCandidates);
        } catch (error) {
          console.warn('⚠️  ML classification failed, falling back to API:', error);
        }
      }

      // Fallback to API identification if ML not available or failed
      let result: BugIdentificationResult;
      if (mlCandidates.length > 0) {
        // Use ML results
        result = {
          candidates: mlCandidates.map(c => ({
            label: c.label,
            confidence: c.confidence,
            source: 'OnDevice',
            species: c.label,
          })),
          provider: 'OnDevice ML',
          isFromAPI: false,
        };
      } else {
        // Fallback to existing API pipeline
        result = await bugIdentificationService.identify(processedImage.croppedImage);
      }

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
      // Add nickname if provided
      if (nickname) {
        identifiedBug.nickname = nickname;
      }

      if (confirmedLabel) {
        identifiedBug.userConfirmedLabel = confirmedLabel;
        identifiedBug.confirmedLabel = confirmedLabel;
      }
      if (confirmationMethod) {
        identifiedBug.confirmationMethod = confirmationMethod;
      }

      // Add the bug to collection
      const newBug = await addBugToCollection(identifiedBug);

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
      setCroppedPhoto(null);
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

  const renderPartySlot = (bug: Bug | null, index: number) => (
    <TouchableOpacity
      key={index}
      style={[styles.partySlot, !bug && styles.emptyPartySlot]}
      onPress={() => {
        // TODO: Open party management
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
      <ThemedView style={styles.container}>
        <ThemedText style={styles.loadingText}>Loading your bug collection...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
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
          {/* Camera Button - Main Action */}
          <TouchableOpacity
            style={styles.cameraButton}
            onPress={() => setShowCamera(true)}
          >
            <Text style={styles.cameraIcon}>📸</Text>
            <ThemedText style={styles.cameraButtonText}>Capture Bug</ThemedText>
            <ThemedText style={styles.cameraButtonSubtext}>Discover new species</ThemedText>
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
          <TouchableOpacity style={styles.managePartyButton}>
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
                <View key={bug.id} style={styles.recentBugCard}>
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
                </View>
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
    </ThemedView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 100, // Space for tab bar
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    marginTop: 100,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 16,
  },
  actionsContainer: {
    marginBottom: 24,
  },
  cameraButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  cameraIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  cameraButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.background,
    marginBottom: 4,
  },
  cameraButtonSubtext: {
    fontSize: 14,
    color: theme.colors.background,
    opacity: 0.9,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.8,
    marginTop: 4,
  },
  partyContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  partyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  partySlot: {
    width: (screenWidth - 48) / 3,
    aspectRatio: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  emptyPartySlot: {
    backgroundColor: theme.colors.background,
    borderStyle: 'dashed',
  },
  bugInSlot: {
    alignItems: 'center',
  },
  bugPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 4,
  },
  bugEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  bugLevel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  emptySlotText: {
    fontSize: 24,
    color: theme.colors.textMuted,
  },
  managePartyButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  managePartyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  collectionButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  collectionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  collectionButtonContent: {
    flex: 1,
  },
  collectionButtonText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  collectionButtonSubtext: {
    fontSize: 14,
    opacity: 0.8,
  },
  arrowIcon: {
    fontSize: 20,
    color: theme.colors.primary,
  },
  recentSection: {
    marginBottom: 24,
  },
  recentList: {
    marginTop: 8,
  },
  recentBugCard: {
    width: 100,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
  },
  recentBugPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 8,
  },
  recentBugPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentBugEmoji: {
    fontSize: 24,
  },
  recentBugName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  rarityBadge: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingModal: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 32,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  capturedPhotoPreview: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalButtonText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingIndicator: {
    marginVertical: 20,
  },
  resultContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  bugName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  bugSpecies: {
    fontSize: 18,
    fontStyle: 'italic',
    marginBottom: 10,
    color: '#666',
  },
  bugDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  detailsContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 15,
  },

  detailText: {
    fontSize: 14,
  },
  confidenceText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#888',
  },
  alternateButton: {
    backgroundColor: '#666',
  },
  alternateButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});