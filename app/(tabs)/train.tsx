import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { XPProgressBar } from '@/components/XPProgressBar';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useWalkMode } from '@/services/useWalkMode';
import { Bug, RARITY_CONFIG } from '@/types/Bug';
import { router } from 'expo-router';
import React from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export default function TrainScreen() {
  const { theme } = useTheme();
  const { collection } = useBugCollection();
  const { getInventorySummary } = useInventory();
  const {
    isActive: walkModeActive,
    statistics: walkStats,
  } = useWalkMode();

  const styles = createStyles(theme);

  // Check if player has any items
  const hasItems = getInventorySummary().length > 0;
  
  // Get first active bug for Walk Mode display
  const activeBug = collection.party.find(bug => bug !== null);

  const renderPartyBug = (bug: Bug | null, index: number) => (
    <View key={index} style={[styles.partySlot, !bug && styles.emptyPartySlot]}>
      {bug ? (
        <View style={styles.bugInSlot}>
          {bug.photo ? (
            <Image source={{ uri: bug.photo }} style={styles.bugPhoto} />
          ) : bug.pixelArt ? (
            <Image source={{ uri: bug.pixelArt }} style={styles.bugPhoto} />
          ) : (
            <Text style={styles.bugEmoji}>[BUG]</Text>
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
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.title}>[TRAIN] Training Center</ThemedText>
          <ThemedText style={styles.subtitle}>Train your bugs to increase their stats</ThemedText>
          
          {/* Player Level Progress */}
          <View style={styles.playerProgressContainer}>
            <ThemedText style={styles.playerLevelText}>
              Explorer Level {collection.level}
            </ThemedText>
            <XPProgressBar
              currentXP={collection.xp}
              maxXP={100}
              level={collection.level}
              animated={true}
            />
          </View>
        </View>

        {/* Party Display */}
        <View style={styles.partyContainer}>
          <ThemedText style={styles.sectionTitle}>[PARTY] Your Active Party</ThemedText>
          <View style={styles.partyGrid}>
            {collection.party.map((bug, index) => renderPartyBug(bug, index))}
          </View>
        </View>

        {/* Training Options */}
        <View style={styles.trainingContainer}>
          <ThemedText style={styles.sectionTitle}>[OPTS] Training Options</ThemedText>
          
          <TouchableOpacity 
            style={[styles.trainingCard, walkModeActive && styles.activeTrainingCard]}
            onPress={() => router.push('/walkmode')}
          >
            <Text style={styles.trainingIcon}>[WALK]</Text>
            <View style={styles.trainingCardContent}>
              <ThemedText style={styles.trainingCardTitle}>Walk Mode</ThemedText>
              <ThemedText style={styles.trainingCardSubtext}>
                {walkModeActive 
                  ? `Active: ${activeBug?.name} gaining XP from steps`
                  : "Gain XP and find items by walking"
                }
              </ThemedText>
              {walkModeActive ? (
                <ThemedText style={styles.activeText}>
                  {walkStats.sessionSteps} steps • {walkStats.stepsToNextXp} until next XP
                </ThemedText>
              ) : (
                <ThemedText style={styles.tapToStartText}>Tap to Configure</ThemedText>
              )}
            </View>
            <Text style={styles.arrowIcon}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.trainingCard} disabled>
            <Text style={styles.trainingIcon}>[HIVE]</Text>
            <View style={styles.trainingCardContent}>
              <ThemedText style={styles.trainingCardTitle}>Hive Mode</ThemedText>
              <ThemedText style={styles.trainingCardSubtext}>
                Battle other trainers and test your skills
              </ThemedText>
              <ThemedText style={styles.comingSoonText}>Coming Soon</ThemedText>
            </View>
          </TouchableOpacity>
        </View>

        {/* Item Management */}
        <View style={styles.trainingContainer}>
          <ThemedText style={styles.sectionTitle}>[ITEM] Item Management</ThemedText>
          
          <TouchableOpacity 
            style={styles.trainingCard}
            onPress={() => router.push('/inventory')}
          >
            <Text style={styles.trainingIcon}>📦</Text>
            <View style={styles.trainingCardContent}>
              <ThemedText style={styles.trainingCardTitle}>Check Items</ThemedText>
              <ThemedText style={styles.trainingCardSubtext}>
                {hasItems 
                  ? `View and manage your ${getInventorySummary().length} item types`
                  : "Use walk mode to get items"
                }
              </ThemedText>
            </View>
            <Text style={styles.arrowIcon}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Training Stats */}
        <View style={styles.statsContainer}>
          <ThemedText style={styles.sectionTitle}>[STAT] Training Statistics</ThemedText>
          
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <ThemedText style={styles.statNumber}>
                {collection.party.filter(Boolean).length}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Active Bugs</ThemedText>
            </View>
            
            <View style={styles.statCard}>
              <ThemedText style={styles.statNumber}>
                {collection.party
                  .filter(Boolean)
                  .reduce((total: number, bug: any) => total + bug.level, 0)}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Total Levels</ThemedText>
            </View>
          </View>
          
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <ThemedText style={styles.statNumber}>0</ThemedText>
              <ThemedText style={styles.statLabel}>Sessions Complete</ThemedText>
            </View>
            
            <View style={styles.statCard}>
              <ThemedText style={styles.statNumber}>0</ThemedText>
              <ThemedText style={styles.statLabel}>Hours Trained</ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
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
    paddingBottom: 100,
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
    fontSize: 16,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 20,
  },
  playerProgressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  playerLevelText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
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
    width: (screenWidth - 48) / 2,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    minHeight: 120,
  },
  emptyPartySlot: {
    backgroundColor: theme.colors.background,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bugInSlot: {
    alignItems: 'center',
  },
  bugPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 6,
  },
  bugEmoji: {
    fontSize: 40,
    marginBottom: 6,
  },
  bugName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  rarityBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
  },
  bugXpContainer: {
    width: '100%',
    alignItems: 'center',
  },
  bugXpBar: {
    width: '100%',
    height: 6,
    backgroundColor: theme.colors.border,
    borderRadius: 3,
    marginBottom: 4,
  },
  bugXpFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  bugXpText: {
    fontSize: 10,
    opacity: 0.8,
  },
  emptySlotContent: {
    alignItems: 'center',
  },
  emptySlotText: {
    fontSize: 32,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  emptySlotLabel: {
    fontSize: 12,
    opacity: 0.6,
  },
  trainingContainer: {
    marginBottom: 24,
  },
  trainingCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    opacity: 0.6,
  },
  trainingIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  trainingCardContent: {
    flex: 1,
  },
  trainingCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  trainingCardSubtext: {
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 4,
  },
  comingSoonText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  activeTrainingCard: {
    backgroundColor: `${theme.colors.primary}15`,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  activeText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  tapToStartText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  activeIcon: {
    fontSize: 18,
    color: theme.colors.primary,
    marginLeft: 8,
    alignSelf: 'center',
  },
  arrowIcon: {
    fontSize: 18,
    color: theme.colors.text,
    opacity: 0.6,
    marginLeft: 8,
    alignSelf: 'center',
  },
  statsContainer: {
    marginBottom: 24,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 6,
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
    textAlign: 'center',
  },
});