/**
 * Walk Tab Screen
 *
 * Walk Mode as a navbar tab. Same functionality as walkmode.tsx
 * but without the back-button header (it's a root tab, not a pushed screen).
 */

import PixelatedEmoji from '@/components/PixelatedEmoji';
import { ThemedText } from '@/components/ThemedText';
import { WalkHistoryModal } from '@/components/WalkHistoryModal';
import { BUG_SPRITE } from '@/constants/bugSprites';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useWalkMode } from '@/services/useWalkMode';
import { Bug, RARITY_CONFIG } from '@/types/Bug';
import { Pedometer } from 'expo-sensors';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    AppState,
    Image,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STEPS_PER_KM = 1312;

export default function WalkTabScreen() {
  const { theme } = useTheme();
  const { collection } = useBugCollection();
  const {
    isActive: walkModeActive,
    statistics: walkStats,
    startWalkMode,
    stopWalkMode,
    error: walkModeError,
    getWalkHistory,
  } = useWalkMode();

  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);
  const [showBugSelector, setShowBugSelector] = useState(false);
  const [showWalkHistory, setShowWalkHistory] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied' | 'na'>('checking');

  useEffect(() => {
    async function checkPermission() {
      if (Platform.OS === 'web') { setPermissionStatus('na'); return; }
      try {
        const { status } = await Pedometer.getPermissionsAsync();
        setPermissionStatus(status === 'granted' ? 'granted' : 'denied');
      } catch { setPermissionStatus('na'); }
    }
    checkPermission();
  }, []);

  const handleRequestPermission = async () => {
    if (Platform.OS === 'web') return;
    try {
      const { status, canAskAgain } = await Pedometer.requestPermissionsAsync();
      if (status === 'granted') {
        setPermissionStatus('granted');
      } else if (!canAskAgain) {
        Alert.alert(
          'Permission Required',
          'BugLord needs Physical Activity permission to count your steps.\n\nPlease enable it in Settings → Apps → BugLord → Permissions.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        Alert.alert('Permission Required', 'Walk Mode needs access to your physical activity data to track steps. Please grant the permission to continue.');
      }
    } catch {}
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState: string) => {
      if (nextState === 'active') {
        if (Platform.OS !== 'web') {
          try {
            const { status } = await Pedometer.getPermissionsAsync();
            setPermissionStatus(status === 'granted' ? 'granted' : 'denied');
          } catch {}
        }
        if (walkModeActive) {
          try {
            const { walkModeService } = require('@/services/WalkModeService');
            await walkModeService.recoverMissedSteps();
          } catch {}
        }
      }
    });
    return () => sub.remove();
  }, [walkModeActive]);

  useEffect(() => {
    if (walkModeActive && walkStats.activeBugId && !selectedBug) {
      const allBugs = [
        ...collection.party.filter((b): b is Bug => b !== null),
        ...collection.bugs,
      ];
      const restoredBug = allBugs.find(bug => bug.id === walkStats.activeBugId);
      if (restoredBug) setSelectedBug(restoredBug);
    }
  }, [walkModeActive, walkStats.activeBugId, collection]);

  const styles = createStyles(theme);

  const currentSteps = walkStats.sessionSteps;
  const stepsToNextXp = STEPS_PER_KM - (currentSteps % STEPS_PER_KM);

  const availableBugs = [
    ...collection.party.filter(bug => bug !== null),
    ...collection.bugs.filter(bug => !collection.party.some(partyBug => partyBug?.id === bug.id))
  ].filter(bug => {
    const maxHp = bug.maxHp || bug.maxXp;
    const currentHp = bug.currentHp !== undefined ? bug.currentHp : maxHp;
    return currentHp > 0;
  });

  const handleBugSelection = (bug: Bug) => {
    setSelectedBug(bug);
    setShowBugSelector(false);
  };

  const handleStartWalkMode = async () => {
    if (!selectedBug) {
      Alert.alert('Select a Bug', 'Please select a bug to train before starting Walk Mode.');
      return;
    }
    const maxHp = selectedBug.maxHp || selectedBug.maxXp;
    const currentHp = selectedBug.currentHp !== undefined ? selectedBug.currentHp : maxHp;
    if (currentHp <= 0) {
      Alert.alert('Bug Fainted', `${selectedBug.nickname || selectedBug.name} has 0 HP and cannot train! Use a Revive item first.`);
      return;
    }
    if (Platform.OS !== 'web') {
      try {
        const { status, canAskAgain } = await Pedometer.requestPermissionsAsync();
        setPermissionStatus(status === 'granted' ? 'granted' : 'denied');
        if (status !== 'granted') {
          if (!canAskAgain) {
            Alert.alert('Permission Required', 'BugLord needs Physical Activity permission to count your steps.\n\nPlease enable it in Settings → Apps → BugLord → Permissions.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]);
          } else {
            Alert.alert('Permission Required', 'Walk Mode needs access to your physical activity data to track steps. Please grant the permission to continue.');
          }
          return;
        }
      } catch (permErr) {
        console.warn('Failed to request pedometer permissions:', permErr);
      }
    }
    try {
      await startWalkMode(selectedBug.id, selectedBug.nickname || selectedBug.name);
      if (Platform.OS === 'android') {
        Alert.alert(
          'Walk Mode Started!',
          `${selectedBug.name} is now training!\n\n• Walk 1 kilometer to gain XP\n• You may find items while walking\n\n⚡ IMPORTANT: To track steps when the app is closed, disable battery optimization for BugLord.\n\nGo to Settings → Apps → BugLord → Battery → Unrestricted`,
          [
            { text: 'Open Battery Settings', onPress: () => Linking.openURL('android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS').catch(() => Linking.openSettings().catch(() => {})) },
            { text: 'Got it', style: 'cancel' },
          ],
        );
      } else {
        Alert.alert('Walk Mode Started!', `${selectedBug.name} is now training!\n\n• Walk 1 kilometer to gain XP\n• You may find items while walking\n• Progress is tracked even when the app is closed`);
      }
    } catch {
      Alert.alert('Error', walkModeError || 'Failed to start Walk Mode');
    }
  };

  const handleStopWalkMode = async () => {
    try {
      await stopWalkMode();
      Alert.alert('Walk Mode Stopped', 'Training session ended.');
    } catch {
      Alert.alert('Error', 'Failed to stop Walk Mode');
    }
  };

  const renderCircularProgress = () => {
    const size = 200;
    const strokeWidth = 8;
    const halfSize = size / 2;
    const fillColor = theme.colors.primary;
    const trackColor = theme.colors.border;
    const currentMilestoneSteps = currentSteps % STEPS_PER_KM;
    const progress = currentMilestoneSteps / STEPS_PER_KM;
    const progressDeg = progress * 360;
    const rightRotation = -135 + Math.min(progressDeg, 180);
    const leftRotation = -135 + Math.max(0, progressDeg - 180);
    const showLeftHalf = progressDeg > 180;

    return (
      <View style={styles.progressContainer}>
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ position: 'absolute', width: size, height: size, borderRadius: halfSize, borderWidth: strokeWidth, borderColor: trackColor }} />
          <View style={{ position: 'absolute', width: halfSize, height: size, left: halfSize, overflow: 'hidden' }}>
            <View style={{ width: size, height: size, borderRadius: halfSize, borderWidth: strokeWidth, borderTopColor: fillColor, borderRightColor: fillColor, borderBottomColor: 'transparent', borderLeftColor: 'transparent', position: 'absolute', left: -halfSize, transform: [{ rotate: `${rightRotation}deg` }] }} />
          </View>
          {showLeftHalf && (
            <View style={{ position: 'absolute', width: halfSize, height: size, left: 0, overflow: 'hidden' }}>
              <View style={{ width: size, height: size, borderRadius: halfSize, borderWidth: strokeWidth, borderTopColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: fillColor, borderLeftColor: fillColor, position: 'absolute', left: 0, transform: [{ rotate: `${leftRotation}deg` }] }} />
            </View>
          )}
          <View style={styles.progressInner}>
            {selectedBug ? (
              <>
                {selectedBug.category && BUG_SPRITE[selectedBug.category] ? (
                  <Image source={BUG_SPRITE[selectedBug.category]} style={styles.selectedBugPhoto} />
                ) : selectedBug.photo ? (
                  <Image source={{ uri: selectedBug.photo }} style={styles.selectedBugPhoto} />
                ) : selectedBug.pixelArt ? (
                  <Image source={{ uri: selectedBug.pixelArt }} style={styles.selectedBugPhoto} />
                ) : (
                  <View style={styles.selectedBugEmoji}>
                    <PixelatedEmoji type="bug" size={56} color="#ffffff" />
                  </View>
                )}
                <View style={styles.progressTextContainer}>
                  <Text style={styles.progressPercentage}>{Math.floor(progress * 100)}%</Text>
                  <Text style={styles.progressSteps}>{currentMilestoneSteps}/{STEPS_PER_KM}</Text>
                </View>
              </>
            ) : (
              <Text style={styles.selectBugText}>Select Bug</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Walk Mode</ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {permissionStatus === 'denied' && (
          <TouchableOpacity style={styles.permissionBanner} onPress={handleRequestPermission} activeOpacity={0.8}>
            <Text style={styles.permissionBannerIcon}>⚠️</Text>
            <View style={styles.permissionBannerTextContainer}>
              <Text style={styles.permissionBannerTitle}>Step Tracking Disabled</Text>
              <Text style={styles.permissionBannerSubtitle}>Tap to enable physical activity permission</Text>
            </View>
            <Text style={styles.permissionBannerArrow}>→</Text>
          </TouchableOpacity>
        )}

        <View style={styles.progressSection}>
          <ThemedText style={styles.stepsToGoTitle}>{walkModeActive ? 'Steps to Next XP' : 'Ready to Train'}</ThemedText>
          <ThemedText style={styles.stepsToGoNumber}>{walkModeActive ? stepsToNextXp.toLocaleString() : STEPS_PER_KM.toLocaleString()}</ThemedText>
          <ThemedText style={styles.stepsToGoSubtitle}>steps (~1 kilometer)</ThemedText>
          {renderCircularProgress()}
          {walkModeActive && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statNumber}>{currentSteps.toLocaleString()}</ThemedText>
                <ThemedText style={styles.statLabel}>Steps Today</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statNumber}>{walkStats.totalXpEarned}</ThemedText>
                <ThemedText style={styles.statLabel}>XP Earned</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statNumber}>{walkStats.totalItemsDropped}</ThemedText>
                <ThemedText style={styles.statLabel}>Items Found</ThemedText>
              </View>
            </View>
          )}
        </View>

        <View style={styles.bugSection}>
          <View style={styles.sectionTitleRow}>
            <PixelatedEmoji type="train" size={20} color="#ffffff" />
            <ThemedText style={styles.sectionTitle}>Training Bug</ThemedText>
          </View>
          <TouchableOpacity style={styles.bugSelector} onPress={() => setShowBugSelector(true)}>
            {selectedBug ? (
              <View style={styles.selectedBugContainer}>
                {selectedBug.category && BUG_SPRITE[selectedBug.category] ? (
                  <Image source={BUG_SPRITE[selectedBug.category]} style={styles.bugSelectorPhoto} />
                ) : selectedBug.photo ? (
                  <Image source={{ uri: selectedBug.photo }} style={styles.bugSelectorPhoto} />
                ) : selectedBug.pixelArt ? (
                  <Image source={{ uri: selectedBug.pixelArt }} style={styles.bugSelectorPhoto} />
                ) : (
                  <View style={styles.bugSelectorEmoji}><PixelatedEmoji type="bug" size={36} color="#ffffff" /></View>
                )}
                <View style={styles.selectedBugInfo}>
                  <ThemedText style={styles.selectedBugName}>{selectedBug.nickname || selectedBug.name}</ThemedText>
                  <ThemedText style={styles.selectedBugDetails}>Level {selectedBug.level} • {selectedBug.xp}/{selectedBug.maxXp} XP</ThemedText>
                </View>
              </View>
            ) : (
              <View style={styles.selectBugPrompt}>
                <View style={styles.selectBugIcon}><PixelatedEmoji type="bug" size={40} color="#ffffff" /></View>
                <ThemedText style={styles.selectBugPromptText}>Tap to select a bug to train</ThemedText>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.actionSection}>
          {walkModeActive ? (
            <TouchableOpacity style={[styles.actionButton, styles.stopButton]} onPress={handleStopWalkMode}>
              <View style={styles.actionButtonIcon}><PixelatedEmoji type="stop" size={20} color="#ffffff" /></View>
              <ThemedText style={[styles.actionButtonText, styles.stopButtonText]}>Stop Training</ThemedText>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.actionButton, styles.startButton]} onPress={handleStartWalkMode} disabled={!selectedBug}>
              <View style={styles.actionButtonIcon}><PixelatedEmoji type="walk" size={20} color="#ffffff" /></View>
              <ThemedText style={[styles.actionButtonText, styles.startButtonText, !selectedBug && styles.disabledButtonText]}>Start Training</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.historyButton} onPress={() => setShowWalkHistory(true)}>
          <Text style={styles.historyButtonIcon}>📊</Text>
          <ThemedText style={styles.historyButtonText}>Walk History</ThemedText>
          <Text style={styles.historyArrow}>→</Text>
        </TouchableOpacity>

        <View style={styles.infoSection}>
          <View style={styles.sectionTitleRow}>
            <PixelatedEmoji type="info" size={18} color="#ffffff" />
            <ThemedText style={styles.infoTitle}>How Walk Mode Works</ThemedText>
          </View>
          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}><PixelatedEmoji type="walk" size={18} color="#ffffff" /></View>
            <ThemedText style={styles.infoText}>Walk 1 kilometer (~1,312 steps) to earn XP</ThemedText>
          </View>
          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}><PixelatedEmoji type="item" size={18} color="#ffffff" /></View>
            <ThemedText style={styles.infoText}>Find items randomly while walking</ThemedText>
          </View>
          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}><PixelatedEmoji type="info" size={18} color="#ffffff" /></View>
            <ThemedText style={styles.infoText}>Progress tracked even when app is closed</ThemedText>
          </View>
          <View style={styles.infoItem}>
            <View style={styles.infoIconContainer}><PixelatedEmoji type="bell" size={18} color="#ffffff" /></View>
            <ThemedText style={styles.infoText}>Get notifications for XP gains and item drops</ThemedText>
          </View>
        </View>
      </ScrollView>

      <WalkHistoryModal
        visible={showWalkHistory}
        onClose={() => setShowWalkHistory(false)}
        getWalkHistory={getWalkHistory}
      />

      {/* Bug Selector Modal */}
      <Modal visible={showBugSelector} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Select Bug to Train</ThemedText>
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowBugSelector(false)}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.bugList}>
            {availableBugs.map((bug) => (
              <TouchableOpacity key={bug.id} style={styles.bugListItem} onPress={() => handleBugSelection(bug)}>
                {bug.category && BUG_SPRITE[bug.category] ? (
                  <Image source={BUG_SPRITE[bug.category]} style={styles.bugListPhoto} />
                ) : bug.photo ? (
                  <Image source={{ uri: bug.photo }} style={styles.bugListPhoto} />
                ) : bug.pixelArt ? (
                  <Image source={{ uri: bug.pixelArt }} style={styles.bugListPhoto} />
                ) : (
                  <View style={styles.bugListPhoto}>
                    <View style={styles.bugListEmoji}><PixelatedEmoji type="bug" size={24} color={theme.colors.text} /></View>
                  </View>
                )}
                <View style={styles.bugListInfo}>
                  <ThemedText style={styles.bugListName}>{bug.nickname || bug.name}</ThemedText>
                  <ThemedText style={styles.bugListDetails}>Level {bug.level} • HP: {bug.currentHp !== undefined ? bug.currentHp : (bug.maxHp || bug.maxXp)}/{bug.maxHp || bug.maxXp} • {bug.xp}/{bug.maxXp} XP</ThemedText>
                </View>
                <View style={[styles.rarityBadge, { backgroundColor: RARITY_CONFIG[bug.rarity]?.color || '#666' }]}>
                  <Text style={styles.rarityBadgeText}>Lv.{bug.level}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 3,
    borderBottomColor: theme.colors.border,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  scrollContainer: { paddingBottom: 40 },
  permissionBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#7B5E00', marginHorizontal: 16, marginTop: 16, borderRadius: 10, borderWidth: 3, borderColor: '#A67C00', paddingHorizontal: 14, paddingVertical: 12 },
  permissionBannerIcon: { fontSize: 22, marginRight: 10 },
  permissionBannerTextContainer: { flex: 1 },
  permissionBannerTitle: { color: '#FFF8DC', fontSize: 14, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  permissionBannerSubtitle: { color: '#FFE4A0', fontSize: 12, fontWeight: '600', marginTop: 2 },
  permissionBannerArrow: { color: '#FFE4A0', fontSize: 20, fontWeight: '900', marginLeft: 8 },
  progressSection: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 24, backgroundColor: theme.colors.card, marginHorizontal: 16, marginTop: 16, borderRadius: 10, borderWidth: 3, borderColor: theme.colors.border },
  stepsToGoTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  stepsToGoNumber: { fontSize: 28, fontWeight: '900', color: theme.colors.warning, marginBottom: 2 },
  stepsToGoSubtitle: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 24, fontWeight: '600' },
  progressContainer: { alignItems: 'center', marginBottom: 24 },
  progressInner: { position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderRadius: 100, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.border },
  selectedBugPhoto: { width: 90, height: 90, borderRadius: 8, marginBottom: 6, borderWidth: 2, borderColor: theme.colors.border },
  selectedBugEmoji: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  progressTextContainer: { alignItems: 'center', marginTop: 2 },
  progressPercentage: { fontSize: 20, fontWeight: '900', color: theme.colors.primary },
  progressSteps: { fontSize: 9, color: theme.colors.textMuted, marginTop: 1, fontWeight: '700' },
  selectBugText: { color: theme.colors.textMuted, fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  statItem: { alignItems: 'center', backgroundColor: theme.colors.surface, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 2, borderColor: theme.colors.border, minWidth: 90 },
  statNumber: { fontSize: 18, fontWeight: '900', color: theme.colors.primary },
  statLabel: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  bugSection: { paddingHorizontal: 16, marginTop: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: theme.colors.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  bugSelector: { backgroundColor: theme.colors.card, borderRadius: 8, padding: 16, borderWidth: 2, borderColor: theme.colors.border },
  selectedBugContainer: { flexDirection: 'row', alignItems: 'center' },
  bugSelectorPhoto: { width: 52, height: 52, borderRadius: 6, marginRight: 14, borderWidth: 2, borderColor: theme.colors.border },
  bugSelectorEmoji: { width: 36, height: 36, marginRight: 14, alignItems: 'center', justifyContent: 'center' },
  selectedBugInfo: { flex: 1 },
  selectedBugName: { fontSize: 16, fontWeight: '800', color: theme.colors.text, marginBottom: 3 },
  selectedBugDetails: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' },
  selectBugPrompt: { alignItems: 'center', paddingVertical: 16 },
  selectBugIcon: { width: 40, height: 40, marginBottom: 10, alignItems: 'center', justifyContent: 'center' },
  selectBugPromptText: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', fontWeight: '700' },
  actionSection: { paddingHorizontal: 16, marginBottom: 20 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 8, borderWidth: 3 },
  startButton: { backgroundColor: theme.colors.success, borderColor: `${theme.colors.success}80` },
  stopButton: { backgroundColor: theme.colors.error, borderColor: `${theme.colors.error}80` },
  actionButtonIcon: { width: 24, height: 24, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  actionButtonText: { fontSize: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  startButtonText: { color: '#FFF' },
  stopButtonText: { color: '#FFF' },
  disabledButtonText: { opacity: 0.4 },
  historyButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, marginHorizontal: 16, marginBottom: 16, borderRadius: 8, padding: 16, borderWidth: 2, borderColor: theme.colors.border },
  historyButtonIcon: { fontSize: 22, marginRight: 12 },
  historyButtonText: { flex: 1, fontSize: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  historyArrow: { fontSize: 18, color: theme.colors.primary, fontWeight: '900' },
  infoSection: { paddingHorizontal: 16, backgroundColor: theme.colors.card, marginHorizontal: 16, borderRadius: 10, padding: 16, borderWidth: 2, borderColor: theme.colors.border },
  infoTitle: { fontSize: 14, fontWeight: '900', color: theme.colors.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  infoIconContainer: { width: 28, alignItems: 'center', marginRight: 10 },
  infoText: { flex: 1, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18, fontWeight: '600' },
  modalContainer: { flex: 1, backgroundColor: theme.colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 3, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.card },
  modalTitle: { flex: 1, fontSize: 18, fontWeight: '900', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  closeButton: { width: 34, height: 34, borderRadius: 6, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.border },
  closeButtonText: { fontSize: 14, fontWeight: '900', color: theme.colors.text },
  bugList: { flex: 1, padding: 16 },
  bugListItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 2, borderColor: theme.colors.border },
  bugListPhoto: { width: 46, height: 46, borderRadius: 6, marginRight: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: 2, borderColor: theme.colors.border },
  bugListEmoji: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  bugListInfo: { flex: 1 },
  bugListName: { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  bugListDetails: { fontSize: 11, fontWeight: '600', color: theme.colors.textMuted },
  rarityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  rarityBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
});
