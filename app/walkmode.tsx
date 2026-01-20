/**
 * Walk Mode Screen
 * 
 * Dedicated screen for Walk Mode with bug selection and progress tracking.
 * Features:
 * - Bug selection from party or collection
 * - Circular progress bar with bug photo
 * - Step tracking (1 kilometer = ~1312 steps for XP gain)
 * - Background tracking with notifications
 * - Blue theme styling
 */

import PixelatedEmoji from '@/components/PixelatedEmoji';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useWalkMode } from '@/services/useWalkMode';
import { Bug, RARITY_CONFIG } from '@/types/Bug';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const STEPS_PER_KM = 1312; // Average steps per kilometer

export default function WalkModeScreen() {
  const { theme } = useTheme();
  const { collection } = useBugCollection();
  const {
    isActive: walkModeActive,
    statistics: walkStats,
    startWalkMode,
    stopWalkMode,
    error: walkModeError,
  } = useWalkMode();

  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);
  const [showBugSelector, setShowBugSelector] = useState(false);

  const styles = createStyles(theme);

  // Calculate progress
  const currentSteps = walkStats.sessionSteps;
  const stepsToNextXp = STEPS_PER_KM - (currentSteps % STEPS_PER_KM);
  const progressPercentage = ((currentSteps % STEPS_PER_KM) / STEPS_PER_KM) * 100;

  // Get available bugs (party + collection)
  const availableBugs = [
    ...collection.party.filter(bug => bug !== null),
    ...collection.bugs.filter(bug => !collection.party.some(partyBug => partyBug?.id === bug.id))
  ];

  const handleBugSelection = (bug: Bug) => {
    setSelectedBug(bug);
    setShowBugSelector(false);
  };

  const handleStartWalkMode = async () => {
    if (!selectedBug) {
      Alert.alert('Select a Bug', 'Please select a bug to train before starting Walk Mode.');
      return;
    }

    try {
      await startWalkMode();
      Alert.alert(
        'Walk Mode Started!',
        `${selectedBug.name} is now training!\n\n• Walk 1 kilometer to gain XP\n• You may find items while walking\n• Progress is tracked even when the app is closed`
      );
    } catch (error) {
      Alert.alert('Error', walkModeError || 'Failed to start Walk Mode');
    }
  };

  const handleStopWalkMode = async () => {
    try {
      await stopWalkMode();
      Alert.alert('Walk Mode Stopped', 'Training session ended.');
    } catch (error) {
      Alert.alert('Error', 'Failed to stop Walk Mode');
    }
  };

  const renderBugSelector = () => (
    <Modal
      visible={showBugSelector}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <ThemedText style={styles.modalTitle}>Select Bug to Train</ThemedText>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowBugSelector(false)}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.bugList}>
          {availableBugs.map((bug) => (
            <TouchableOpacity
              key={bug.id}
              style={styles.bugListItem}
              onPress={() => handleBugSelection(bug)}
            >
              {bug.photo ? (
                <Image source={{ uri: bug.photo }} style={styles.bugListPhoto} />
              ) : bug.pixelArt ? (
                <Image source={{ uri: bug.pixelArt }} style={styles.bugListPhoto} />
              ) : (
                <View style={styles.bugListPhoto}>
                  <View style={styles.bugListEmoji}>
                    <PixelatedEmoji type="bug" size={24} color={theme.colors.text} />
                  </View>
                </View>
              )}
              <View style={styles.bugListInfo}>
                <ThemedText style={styles.bugListName}>
                  {bug.nickname || bug.name}
                </ThemedText>
                <ThemedText style={styles.bugListDetails}>
                  Level {bug.level} • {bug.rarity} • {bug.xp}/{bug.maxXp} XP
                </ThemedText>
              </View>
              <View style={[
                styles.rarityBadge,
                { backgroundColor: RARITY_CONFIG[bug.rarity]?.color || '#666' }
              ]}>
                <Text style={styles.rarityBadgeText}>Lv.{bug.level}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );

  const renderCircularProgress = () => {
    const circleSize = 200;
    const strokeWidth = 12;
    const radius = (circleSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

    return (
      <View style={styles.progressContainer}>
        {/* SVG Circle would go here in a real implementation */}
        {/* For now, using a simpler circular progress */}
        <View style={[styles.progressCircle, { width: circleSize, height: circleSize }]}>
          <View style={[
            styles.progressFill,
            {
              transform: [{ rotate: `${(progressPercentage / 100) * 360}deg` }],
              width: circleSize,
              height: circleSize,
            }
          ]} />
          <View style={styles.progressInner}>
            {selectedBug ? (
              selectedBug.photo ? (
                <Image source={{ uri: selectedBug.photo }} style={styles.selectedBugPhoto} />
              ) : selectedBug.pixelArt ? (
                <Image source={{ uri: selectedBug.pixelArt }} style={styles.selectedBugPhoto} />
              ) : (
                <View style={styles.selectedBugEmoji}>
                  <PixelatedEmoji type="bug" size={56} color="#ffffff" />
                </View>
              )
            ) : (
              <Text style={styles.selectBugText}>Select Bug</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Walk Mode</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Progress Section */}
        <View style={styles.progressSection}>
          <ThemedText style={styles.stepsToGoTitle}>
            {walkModeActive ? 'Steps to Next XP' : 'Ready to Train'}
          </ThemedText>
          <ThemedText style={styles.stepsToGoNumber}>
            {walkModeActive ? stepsToNextXp.toLocaleString() : STEPS_PER_KM.toLocaleString()}
          </ThemedText>
          <ThemedText style={styles.stepsToGoSubtitle}>
            steps (~1 kilometer)
          </ThemedText>

          {renderCircularProgress()}

          {walkModeActive && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statNumber}>
                  {currentSteps.toLocaleString()}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Steps Today</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statNumber}>
                  {walkStats.totalXpEarned}
                </ThemedText>
                <ThemedText style={styles.statLabel}>XP Earned</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statNumber}>
                  {walkStats.totalItemsDropped}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Items Found</ThemedText>
              </View>
            </View>
          )}
        </View>

        {/* Bug Selection */}
        <View style={styles.bugSection}>
          <View style={styles.sectionTitleRow}>
            <PixelatedEmoji type="train" size={20} color="#ffffff" />
            <ThemedText style={styles.sectionTitle}>Training Bug</ThemedText>
          </View>
          <TouchableOpacity
            style={styles.bugSelector}
            onPress={() => setShowBugSelector(true)}
          >
            {selectedBug ? (
              <View style={styles.selectedBugContainer}>
                {selectedBug.photo ? (
                  <Image source={{ uri: selectedBug.photo }} style={styles.bugSelectorPhoto} />
                ) : selectedBug.pixelArt ? (
                  <Image source={{ uri: selectedBug.pixelArt }} style={styles.bugSelectorPhoto} />
                ) : (
                  <View style={styles.bugSelectorEmoji}>
                    <PixelatedEmoji type="bug" size={36} color="#ffffff" />
                  </View>
                )}
                <View style={styles.selectedBugInfo}>
                  <ThemedText style={styles.selectedBugName}>
                    {selectedBug.nickname || selectedBug.name}
                  </ThemedText>
                  <ThemedText style={styles.selectedBugDetails}>
                    Level {selectedBug.level} • {selectedBug.xp}/{selectedBug.maxXp} XP
                  </ThemedText>
                </View>
              </View>
            ) : (
              <View style={styles.selectBugPrompt}>
                <View style={styles.selectBugIcon}>
                  <PixelatedEmoji type="bug" size={40} color="#ffffff" />
                </View>
                <ThemedText style={styles.selectBugPromptText}>
                  Tap to select a bug to train
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Action Button */}
        <View style={styles.actionSection}>
          {walkModeActive ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.stopButton]}
              onPress={handleStopWalkMode}
            >
              <View style={styles.actionButtonIcon}>
                <PixelatedEmoji type="stop" size={20} color="#ffffff" />
              </View>
              <ThemedText style={[styles.actionButtonText, styles.stopButtonText]}>
                Stop Training
              </ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton]}
              onPress={handleStartWalkMode}
              disabled={!selectedBug}
            >
              <View style={styles.actionButtonIcon}>
                <PixelatedEmoji type="walk" size={20} color="#ffffff" />
              </View>
              <ThemedText style={[
                styles.actionButtonText,
                styles.startButtonText,
                !selectedBug && styles.disabledButtonText
              ]}>
                Start Training
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.sectionTitleRow}>
            <PixelatedEmoji type="info" size={18} color="#ffffff" />
            <ThemedText style={styles.infoTitle}>How Walk Mode Works</ThemedText>
          </View>
          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}>
              <PixelatedEmoji type="walk" size={18} color="#ffffff" />
            </View>
            <ThemedText style={styles.infoText}>
              Walk 1 kilometer (~1,312 steps) to earn XP
            </ThemedText>
          </View>
          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}>
              <PixelatedEmoji type="item" size={18} color="#ffffff" />
            </View>
            <ThemedText style={styles.infoText}>
              Find items randomly while walking
            </ThemedText>
          </View>
          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}>
              <PixelatedEmoji type="info" size={18} color="#ffffff" />
            </View>
            <ThemedText style={styles.infoText}>
              Progress tracked even when app is closed
            </ThemedText>
          </View>
          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}>
              <PixelatedEmoji type="bell" size={18} color="#ffffff" />
            </View>
            <ThemedText style={styles.infoText}>
              Get notifications for XP gains and item drops
            </ThemedText>
          </View>
        </View>
      </ScrollView>

      {renderBugSelector()}
    </ThemedView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E3A8A', // Blue theme
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  headerSpacer: {
    width: 40,
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  progressSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  stepsToGoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 8,
  },
  stepsToGoNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: 'white',
    marginBottom: 4,
  },
  stepsToGoSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 30,
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  progressCircle: {
    borderRadius: 100,
    borderWidth: 12,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressFill: {
    position: 'absolute',
    borderRadius: 100,
    borderWidth: 12,
    borderColor: 'transparent',
    borderTopColor: '#60A5FA',
    borderRightColor: '#60A5FA',
  },
  progressInner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBugPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  selectedBugEmoji: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBugText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  bugSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 0,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  bugSelector: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  selectedBugContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bugSelectorPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  bugSelectorEmoji: {
    width: 36,
    height: 36,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBugInfo: {
    flex: 1,
  },
  selectedBugName: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  selectedBugDetails: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  selectBugPrompt: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  selectBugIcon: {
    width: 40,
    height: 40,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBugPromptText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  actionSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 16,
  },
  startButton: {
    backgroundColor: '#10B981',
  },
  stopButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonIcon: {
    width: 26,
    height: 26,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  startButtonText: {
    color: 'white',
  },
  stopButtonText: {
    color: 'white',
  },
  disabledButtonText: {
    opacity: 0.5,
  },
  infoSection: {
    paddingHorizontal: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginBottom: 0,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIconContainer: {
    width: 30,
    alignItems: 'center',
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  bugList: {
    flex: 1,
    padding: 20,
  },
  bugListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  bugListPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  bugListEmoji: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bugListInfo: {
    flex: 1,
  },
  bugListName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  bugListDetails: {
    fontSize: 12,
    opacity: 0.7,
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rarityBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});