import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { XPProgressBar } from '@/components/XPProgressBar';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Bug, RARITY_CONFIG } from '@/types/Bug';
import React from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export default function TrainScreen() {
  const { theme } = useTheme();
  const { collection } = useBugCollection();

  const styles = createStyles(theme);

  const renderPartyBug = (bug: Bug | null, index: number) => (
    <View key={index} style={[styles.partySlot, !bug && styles.emptyPartySlot]}>
      {bug ? (
        <View style={styles.bugInSlot}>
          {bug.pixelArt ? (
            <Image source={{ uri: bug.pixelArt }} style={styles.bugPhoto} />
          ) : bug.photo ? (
            <Image source={{ uri: bug.photo }} style={styles.bugPhoto} />
          ) : (
            <Text style={styles.bugEmoji}>🐛</Text>
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
          <ThemedText style={styles.title}>🏋️ Training Center</ThemedText>
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
          <ThemedText style={styles.sectionTitle}>🏆 Your Active Party</ThemedText>
          <View style={styles.partyGrid}>
            {collection.party.map((bug, index) => renderPartyBug(bug, index))}
          </View>
        </View>

        {/* Training Options */}
        <View style={styles.trainingContainer}>
          <ThemedText style={styles.sectionTitle}>📚 Training Options</ThemedText>
          
          <TouchableOpacity style={styles.trainingCard} disabled>
            <Text style={styles.trainingIcon}>⚡</Text>
            <View style={styles.trainingCardContent}>
              <ThemedText style={styles.trainingCardTitle}>Speed Training</ThemedText>
              <ThemedText style={styles.trainingCardSubtext}>
                Increases bug agility and movement speed
              </ThemedText>
              <ThemedText style={styles.comingSoonText}>Coming Soon</ThemedText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.trainingCard} disabled>
            <Text style={styles.trainingIcon}>💪</Text>
            <View style={styles.trainingCardContent}>
              <ThemedText style={styles.trainingCardTitle}>Strength Training</ThemedText>
              <ThemedText style={styles.trainingCardSubtext}>
                Builds physical power and combat abilities
              </ThemedText>
              <ThemedText style={styles.comingSoonText}>Coming Soon</ThemedText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.trainingCard} disabled>
            <Text style={styles.trainingIcon}>🧠</Text>
            <View style={styles.trainingCardContent}>
              <ThemedText style={styles.trainingCardTitle}>Intelligence Training</ThemedText>
              <ThemedText style={styles.trainingCardSubtext}>
                Enhances problem-solving and tactical skills
              </ThemedText>
              <ThemedText style={styles.comingSoonText}>Coming Soon</ThemedText>
            </View>
          </TouchableOpacity>
        </View>

        {/* Training Stats */}
        <View style={styles.statsContainer}>
          <ThemedText style={styles.sectionTitle}>📊 Training Statistics</ThemedText>
          
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