import { BugInfoModal } from '@/components/BugInfoModal';
import PixelatedEmoji from '@/components/PixelatedEmoji';
import { ThemedText } from '@/components/ThemedText';
import { WalkHistoryModal } from '@/components/WalkHistoryModal';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useWalkMode } from '@/services/useWalkMode';
import { Bug, ConfirmationMethod, RARITY_CONFIG } from '@/types/Bug';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: screenWidth } = Dimensions.get('window');

export default function TrainScreen() {
  const { theme } = useTheme();
  const { collection, updateBugNickname } = useBugCollection();
  const { getInventorySummary } = useInventory();
  const {
    isActive: walkModeActive,
    statistics: walkStats,
    getWalkHistory
  } = useWalkMode();

  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);
  const [showBugInfo, setShowBugInfo] = useState(false);
  const [showWalkHistory, setShowWalkHistory] = useState(false);

  const styles = createStyles(theme);

  // Check if player has any items
  const hasItems = getInventorySummary().length > 0;
  
  // Get first active bug for Walk Mode display
  const activeBug = collection.party.find(bug => bug !== null);

  const handleBugTap = (bug: Bug) => {
    setSelectedBug(bug);
    setShowBugInfo(true);
  };

  const handleCloseBugInfo = () => {
    setShowBugInfo(false);
    setSelectedBug(null);
  };

  const handleConfirmBugInfo = ({ nickname }: { nickname?: string; addToParty?: boolean; replaceBugId?: string; confirmedLabel?: string; confirmationMethod?: ConfirmationMethod; }) => {
    // Update nickname if provided and bug is selected
    if (selectedBug && nickname && nickname !== selectedBug.nickname) {
      updateBugNickname(selectedBug.id, nickname);
    }
    handleCloseBugInfo();
  };

  const renderPartyBug = (bug: Bug | null, index: number) => (
    <TouchableOpacity 
      key={index} 
      style={[styles.partySlot, !bug && styles.emptyPartySlot]}
      onPress={() => bug && handleBugTap(bug)}
      activeOpacity={bug ? 0.7 : 1}
      disabled={!bug}
    >
      {bug ? (
        <View style={styles.bugInSlot}>
          {bug.photo ? (
            <Image source={{ uri: bug.photo }} style={styles.bugPhoto} />
          ) : bug.pixelArt ? (
            <Image source={{ uri: bug.pixelArt }} style={styles.bugPhoto} />
          ) : (
            <PixelatedEmoji type="bug" size={32} color={theme.colors.text} />
          )}
          <ThemedText style={styles.bugName} numberOfLines={1}>
            {bug.nickname || bug.name}
          </ThemedText>
          <Text style={[styles.rarityBadge, { backgroundColor: RARITY_CONFIG[bug.rarity]?.color || '#666' }]}>
            Lv.{bug.level}
          </Text>
          
          {/* XP Progress Bar for each bug */}
          <View style={styles.bugXpContainer}>
            <View style={styles.bugXpBar}>
              <View 
                style={[
                  styles.bugXpFill,
                  { width: `${(bug.xp / bug.maxXp) * 100}%` }
                ]}
              />
            </View>
            <ThemedText style={styles.bugXpText}>
              {bug.xp}/{bug.maxXp}
            </ThemedText>
          </View>
        </View>
      ) : (
        <View style={styles.emptySlotContent}>
          <Text style={styles.emptySlotText}>+</Text>
          <ThemedText style={styles.emptySlotLabel}>Empty</ThemedText>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Large Training Mode Buttons */}
        <View style={styles.heroSection}>
          <TouchableOpacity 
            style={[styles.heroButton, styles.walkModeButton, walkModeActive && styles.heroButtonActive]}
            onPress={() => router.push('/walkmode')}
            activeOpacity={0.8}
          >
            <View style={styles.heroIconContainer}>
              <Text style={styles.heroIcon}>🚶</Text>
              {walkModeActive && <View style={styles.activePulse} />}
            </View>
            <ThemedText style={styles.heroTitle}>Walk Mode</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              {walkModeActive 
                ? `${walkStats.sessionSteps} steps walked`
                : "Train bugs while walking"
              }
            </ThemedText>
            {walkModeActive && (
              <View style={styles.activeIndicator}>
                <View style={styles.activeDot} />
                <ThemedText style={styles.activeLabel}>ACTIVE</ThemedText>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.heroButton, styles.hiveModeButton]}
            onPress={() => router.push('/hivemode')}
            activeOpacity={0.8}
          >
            <View style={styles.heroIconContainer}>
              <Text style={styles.heroIcon}>🐝</Text>
            </View>
            <ThemedText style={styles.heroTitle}>Hive Mode</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Battle 10 rounds of bugs
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Party Display */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Your Party</ThemedText>
            <ThemedText style={styles.sectionCount}>
              {collection.party.filter(Boolean).length}/6
            </ThemedText>
          </View>
          <View style={styles.partyGrid}>
            {collection.party.map((bug, index) => renderPartyBug(bug, index))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Quick Actions</ThemedText>
          
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => router.push('/inventory')}
            >
              <Text style={styles.quickActionIcon}>🎒</Text>
              <ThemedText style={styles.quickActionTitle}>Items</ThemedText>
              <ThemedText style={styles.quickActionValue}>
                {getInventorySummary().length}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => setShowWalkHistory(true)}
            >
              <Text style={styles.quickActionIcon}>📊</Text>
              <ThemedText style={styles.quickActionTitle}>History</ThemedText>
              <ThemedText style={styles.quickActionValue}>View</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Statistics</ThemedText>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>⭐</Text>
              <ThemedText style={styles.statNumber}>
                {collection.level}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Explorer Level</ThemedText>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>🐛</Text>
              <ThemedText style={styles.statNumber}>
                {collection.party.filter(Boolean).length}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Active Bugs</ThemedText>
            </View>
            
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>📈</Text>
              <ThemedText style={styles.statNumber}>
                {collection.party
                  .filter(Boolean)
                  .reduce((total: number, bug: any) => total + bug.level, 0)}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Total Levels</ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bug Info Modal */}
      <BugInfoModal
        visible={showBugInfo}
        bug={selectedBug}
        onClose={handleCloseBugInfo}
        onConfirm={handleConfirmBugInfo}
        isNewCatch={false}
      />

      {/* Walk History Modal */}
      <WalkHistoryModal
        visible={showWalkHistory}
        onClose={() => setShowWalkHistory(false)}
        getWalkHistory={getWalkHistory}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    paddingBottom: 100,
  },
  heroSection: {
    padding: 16,
    gap: 16,
    marginBottom: 8,
  },
  heroButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  walkModeButton: {
    minHeight: 160,
  },
  hiveModeButton: {
    minHeight: 160,
  },
  heroButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}10`,
  },
  heroIconContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  heroIcon: {
    fontSize: 64,
  },
  activePulse: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#4CAF50',
    borderRadius: 16,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  section: {
    padding: 16,
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  sectionCount: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.6,
  },
  partyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  partySlot: {
    width: (screenWidth - 56) / 3,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 12,
    minHeight: 110,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyPartySlot: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    justifyContent: 'center',
  },
  bugInSlot: {
    alignItems: 'center',
  },
  bugPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 6,
  },
  bugName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  rarityBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  bugXpContainer: {
    width: '100%',
    alignItems: 'center',
  },
  bugXpBar: {
    width: '100%',
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    marginBottom: 2,
  },
  bugXpFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  bugXpText: {
    fontSize: 8,
    opacity: 0.7,
  },
  emptySlotContent: {
    alignItems: 'center',
  },
  emptySlotText: {
    fontSize: 24,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  emptySlotLabel: {
    fontSize: 10,
    opacity: 0.5,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickActionIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.7,
  },
  quickActionValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    opacity: 0.7,
    textAlign: 'center',
  },
});