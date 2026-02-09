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

  const renderPartyBug = (bug: Bug | null, index: number) => {
    const maxHp = bug ? (bug.maxHp || bug.maxXp) : 0;
    const currentHp = bug ? (bug.currentHp !== undefined ? bug.currentHp : maxHp) : 0;
    const isFainted = bug ? currentHp <= 0 : false;
    const hpPercent = maxHp > 0 ? currentHp / maxHp : 1;

    return (
    <TouchableOpacity 
      key={index} 
      style={[styles.partySlot, !bug && styles.emptyPartySlot]}
      onPress={() => bug && handleBugTap(bug)}
      activeOpacity={bug ? 0.7 : 1}
      disabled={!bug}
    >
      {bug ? (
        <View style={[styles.bugInSlot, isFainted && { opacity: 0.5 }]}>
          {bug.photo ? (
            <Image source={{ uri: bug.photo }} style={styles.bugPhoto} />
          ) : bug.pixelArt ? (
            <Image source={{ uri: bug.pixelArt }} style={styles.bugPhoto} />
          ) : (
            <PixelatedEmoji type="bug" size={32} color={theme.colors.text} />
          )}
          {isFainted && (
            <Text style={{ fontSize: 12, color: '#FF6B6B', fontWeight: '700', marginTop: 2 }}>💀 FAINTED</Text>
          )}
          <ThemedText style={styles.bugName} numberOfLines={1}>
            {bug.nickname || bug.name}
          </ThemedText>
          <Text style={[styles.rarityBadge, { backgroundColor: RARITY_CONFIG[bug.rarity]?.color || '#666' }]}>
            Lv.{bug.level}
          </Text>
          
          {/* HP Bar */}
          <View style={styles.bugXpContainer}>
            <View style={styles.bugXpBar}>
              <View 
                style={[
                  styles.bugXpFill,
                  { 
                    width: `${Math.max(hpPercent * 100, 0)}%`,
                    backgroundColor: isFainted ? '#666' : hpPercent > 0.5 ? '#51CF66' : hpPercent > 0.25 ? '#FCC419' : '#FF6B6B',
                  }
                ]}
              />
            </View>
            <ThemedText style={styles.bugXpText}>
              {currentHp}/{maxHp} HP
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
  };

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
    gap: 14,
    marginBottom: 4,
  },
  heroButton: {
    backgroundColor: theme.colors.card,
    borderRadius: 10,
    padding: 22,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  walkModeButton: {
    minHeight: 150,
    borderLeftColor: theme.colors.primary,
    borderLeftWidth: 5,
  },
  hiveModeButton: {
    minHeight: 150,
    borderLeftColor: theme.colors.warning,
    borderLeftWidth: 5,
  },
  heroButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primaryLight}30`,
  },
  heroIconContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  heroIcon: {
    fontSize: 56,
  },
  activePulse: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.card,
    shadowColor: theme.colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: theme.colors.success,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: `${theme.colors.success}80`,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  activeLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 1,
  },
  section: {
    padding: 16,
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  partyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  partySlot: {
    width: (screenWidth - 52) / 3,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 10,
    minHeight: 115,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  emptyPartySlot: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.separator,
    justifyContent: 'center',
  },
  bugInSlot: {
    alignItems: 'center',
  },
  bugPhoto: {
    width: 46,
    height: 46,
    borderRadius: 6,
    marginBottom: 5,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  bugName: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 3,
  },
  rarityBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 5,
    overflow: 'hidden',
  },
  bugXpContainer: {
    width: '100%',
    alignItems: 'center',
  },
  bugXpBar: {
    width: '100%',
    height: 5,
    backgroundColor: theme.colors.xpBackground,
    borderRadius: 3,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bugXpFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  bugXpText: {
    fontSize: 8,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  emptySlotContent: {
    alignItems: 'center',
  },
  emptySlotText: {
    fontSize: 22,
    color: theme.colors.textMuted,
    fontWeight: '900',
    marginBottom: 2,
  },
  emptySlotLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  quickActionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickActionValue: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  statIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.warning,
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});