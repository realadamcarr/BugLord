import { BugCamera } from '@/components/BugCamera';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { XPProgressBar } from '@/components/XPProgressBar';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Bug, RARITY_CONFIG, SAMPLE_BUGS } from '@/types/Bug';
import React, { useState } from 'react';
import { Alert, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export default function BugHubScreen() {
  const { theme } = useTheme();
  const { collection, addBugToCollection, addBugToParty, loading } = useBugCollection();
  const [showCamera, setShowCamera] = useState(false);
  const [showBugIdentification, setShowBugIdentification] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const styles = createStyles(theme);

  const handleCameraCapture = (photoUri: string) => {
    setCapturedPhoto(photoUri);
    setShowCamera(false);
    setShowBugIdentification(true);
  };

  const handleBugIdentification = async (bugName?: string) => {
    if (!capturedPhoto) return;

    // For MVP, we'll use a random bug from our sample data
    const randomBug = SAMPLE_BUGS[Math.floor(Math.random() * SAMPLE_BUGS.length)];
    
    const newBug = await addBugToCollection({
      name: bugName || randomBug.name,
      species: randomBug.species,
      description: randomBug.description,
      rarity: randomBug.rarity,
      biome: randomBug.biome,
      photo: capturedPhoto,
      traits: randomBug.traits,
      size: randomBug.size,
      xpValue: RARITY_CONFIG[randomBug.rarity].xpRange[0],
    });

    // Try to add to party automatically
    const addedToParty = addBugToParty(newBug);
    
    Alert.alert(
      '🐛 Bug Captured!',
      `You caught a ${newBug.rarity} ${newBug.name}!\n+${newBug.xpValue} XP${addedToParty ? '\n\nAdded to your party!' : '\n\nParty is full - check your collection!'}`,
      [{ text: 'Awesome!', style: 'default' }]
    );

    setShowBugIdentification(false);
    setCapturedPhoto(null);
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
            <Text style={styles.bugEmoji}>🐛</Text>
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
          <ThemedText style={styles.title}>🐛 Bug Collector</ThemedText>
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
          <ThemedText style={styles.sectionTitle}>🏆 Your Party</ThemedText>
          <View style={styles.partyGrid}>
            {collection.party.map((bug, index) => renderPartySlot(bug, index))}
          </View>
          <TouchableOpacity style={styles.managePartyButton}>
            <ThemedText style={styles.managePartyButtonText}>Manage Party</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Collection Access */}
        <TouchableOpacity style={styles.collectionButton}>
          <Text style={styles.collectionIcon}>📚</Text>
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
                  ) : (
                    <View style={styles.recentBugPlaceholder}>
                      <Text style={styles.recentBugEmoji}>🐛</Text>
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

      {/* Bug Identification Modal */}
      <Modal
        visible={showBugIdentification}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.identificationModal}>
            <ThemedText style={styles.modalTitle}>🔍 Bug Identified!</ThemedText>
            {capturedPhoto && (
              <Image source={{ uri: capturedPhoto }} style={styles.capturedPhotoPreview} />
            )}
            <ThemedText style={styles.modalText}>
              Great catch! This looks like a new species for your collection.
            </ThemedText>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => handleBugIdentification()}
              >
                <ThemedText style={styles.modalButtonText}>Add to Collection</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.secondaryButton]}
                onPress={() => {
                  setShowBugIdentification(false);
                  setCapturedPhoto(null);
                }}
              >
                <ThemedText style={styles.secondaryButtonText}>Discard</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  identificationModal: {
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
});