import { CollectionScreen } from '@/components/CollectionScreen';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { XPProgressBar } from '@/components/XPProgressBar';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { clearScanLogs, getScanLogs, ScanLogEntry } from '@/services/ScanLogService';
import { BIOME_CONFIG, RARITY_CONFIG } from '@/types/Bug';
import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

export default function PlayerScreen() {
  const { theme } = useTheme();
  const { collection } = useBugCollection();
  const [showCollection, setShowCollection] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<ScanLogEntry[]>([]);

  useEffect(() => {
    if (showLogs) {
      getScanLogs().then(setLogs);
    }
  }, [showLogs]);

  const styles = createStyles(theme);

  // Calculate player statistics
  const totalBugs = collection.bugs.length;
  const partyCount = collection.party.filter(Boolean).length;
  
  // Count bugs by rarity
  const rarityStats = collection.bugs.reduce((acc: any, bug) => {
    acc[bug.rarity] = (acc[bug.rarity] || 0) + 1;
    return acc;
  }, {});

  // Count bugs by biome
  const biomeStats = collection.bugs.reduce((acc: any, bug) => {
    acc[bug.biome] = (acc[bug.biome] || 0) + 1;
    return acc;
  }, {});

  const renderAchievement = (title: string, description: string, completed: boolean, icon: string) => (
    <View style={[styles.achievementCard, completed && styles.achievementCompleted]}>
      <Text style={[styles.achievementIcon, !completed && styles.achievementIconLocked]}>{icon}</Text>
      <View style={styles.achievementContent}>
        <ThemedText style={[styles.achievementTitle, !completed && styles.achievementTextLocked]}>
          {title}
        </ThemedText>
        <ThemedText style={[styles.achievementDescription, !completed && styles.achievementTextLocked]}>
          {description}
        </ThemedText>
      </View>
      {completed && <Text style={styles.checkmark}>✓</Text>}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Player Header */}
        <View style={styles.header}>
          <View style={styles.playerAvatar}>
            <Text style={styles.avatarText}>[BUG]</Text>
          </View>
          <ThemedText style={styles.playerName}>Bug Explorer</ThemedText>
          <ThemedText style={styles.playerLevel}>Level {collection.level}</ThemedText>
          
          <View style={styles.xpContainer}>
            <XPProgressBar
              currentXP={collection.xp}
              maxXP={100}
              level={collection.level}
              animated={true}
            />
            <ThemedText style={styles.totalXpText}>
              Total XP: {collection.totalXp}
            </ThemedText>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <ThemedText style={styles.sectionTitle}>[STAT] Collection Stats</ThemedText>
          
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <ThemedText style={styles.statNumber}>{totalBugs}</ThemedText>
              <ThemedText style={styles.statLabel}>Total Bugs</ThemedText>
            </View>
            <View style={styles.statCard}>
              <ThemedText style={styles.statNumber}>{partyCount}/6</ThemedText>
              <ThemedText style={styles.statLabel}>Active Party</ThemedText>
            </View>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <ThemedText style={styles.statNumber}>
                {Object.keys(biomeStats).length}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Biomes Explored</ThemedText>
            </View>
            <View style={styles.statCard}>
              <ThemedText style={styles.statNumber}>
                {rarityStats.rare || 0 + rarityStats.epic || 0 + rarityStats.legendary || 0}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Rare+ Bugs</ThemedText>
            </View>
          </View>
        </View>

        {/* Collection Button */}
        <View style={styles.collectionButtonContainer}>
          <TouchableOpacity 
            style={styles.collectionButton}
            onPress={() => setShowCollection(true)}
          >
            <Text style={styles.collectionButtonIcon}>[DEX]</Text>
            <View>
              <ThemedText style={styles.collectionButtonTitle}>View Collection</ThemedText>
              <ThemedText style={styles.collectionButtonSubtitle}>
                {collection.bugs.length - collection.party.filter(Boolean).length} bugs in storage
              </ThemedText>
            </View>
            <Text style={styles.collectionButtonArrow}>›</Text>
          </TouchableOpacity>
          <View style={{ height: 12 }} />
          <TouchableOpacity 
            style={styles.collectionButton}
            onPress={() => setShowLogs(true)}
          >
            <Text style={styles.collectionButtonIcon}>🧪</Text>
            <View>
              <ThemedText style={styles.collectionButtonTitle}>Scan Logs</ThemedText>
              <ThemedText style={styles.collectionButtonSubtitle}>
                Inspect recent identifications
              </ThemedText>
            </View>
            <Text style={styles.collectionButtonArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Rarity Breakdown */}
        <View style={styles.rarityContainer}>
          <ThemedText style={styles.sectionTitle}>[RARE] Collection by Rarity</ThemedText>
          
          {Object.entries(RARITY_CONFIG).map(([rarity, config]) => (
            <View key={rarity} style={styles.rarityRow}>
              <View 
                style={[styles.rarityBadge, { backgroundColor: config.color }]}
              />
              <ThemedText style={styles.rarityName}>
                {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
              </ThemedText>
              <ThemedText style={styles.rarityCount}>
                {rarityStats[rarity] || 0}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* Biome Progress */}
        <View style={styles.biomeContainer}>
          <ThemedText style={styles.sectionTitle}>[BIOM] Biome Exploration</ThemedText>
          
          <View style={styles.biomeGrid}>
            {Object.entries(BIOME_CONFIG).map(([biome, config]) => (
              <View key={biome} style={styles.biomeCard}>
                <Text style={styles.biomeEmoji}>{config.emoji}</Text>
                <ThemedText style={styles.biomeName}>
                  {biome.charAt(0).toUpperCase() + biome.slice(1)}
                </ThemedText>
                <ThemedText style={styles.biomeCount}>
                  {biomeStats[biome] || 0} bugs
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        {/* Achievements */}
        <View style={styles.achievementsContainer}>
          <ThemedText style={styles.sectionTitle}>[ACH] Achievements</ThemedText>
          
          {renderAchievement(
            "First Catch",
            "Capture your first bug",
            totalBugs >= 1,
            "🎯"
          )}
          
          {renderAchievement(
            "Bug Collector",
            "Capture 10 different bugs",
            totalBugs >= 10,
            "[DEX]"
          )}
          
          {renderAchievement(
            "Full Party",
            "Fill all 6 party slots",
            partyCount === 6,
            "[PPL]"
          )}
          
          {renderAchievement(
            "Rare Hunter",
            "Find a rare or higher rarity bug",
            (rarityStats.rare || 0) + (rarityStats.epic || 0) + (rarityStats.legendary || 0) >= 1,
            "[GEM]"
          )}
          
          {renderAchievement(
            "Explorer",
            "Discover bugs in 5 different biomes",
            Object.keys(biomeStats).length >= 5,
            "[MAP]"
          )}
          
          {renderAchievement(
            "Level Up!",
            "Reach Explorer Level 5",
            collection.level >= 5,
            "[UP]"
          )}
        </View>
      </ScrollView>

      {/* Collection Modal */}
      <Modal
        visible={showCollection}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCollection(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <CollectionScreen />
        </View>
      </Modal>

      {/* Scan Logs Modal */}
      <Modal
        visible={showLogs}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowLogs(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalCloseButton, { position: 'absolute', right: 12 }]}
              onPress={async () => { await clearScanLogs(); setLogs([]); }}
            >
              <Text style={styles.modalCloseText}>Clear</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
            {logs.length === 0 ? (
              <ThemedText style={{ textAlign: 'center', marginTop: 24 }}>No logs yet</ThemedText>
            ) : (
              logs.map((log) => (
                <View key={log.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                  <ThemedText style={{ fontWeight: '700' }}>{new Date(log.capturedAt).toLocaleString()}</ThemedText>
                  <ThemedText>Provider: {log.provider}</ThemedText>
                  {log.confirmedLabel && (
                    <ThemedText>Confirmed: {log.confirmedLabel} ({log.confirmationMethod})</ThemedText>
                  )}
                  <View style={{ marginTop: 8 }}>
                    {log.candidates.slice(0,5).map((c, idx) => (
                      <ThemedText key={c.label + idx}>• {c.label} {typeof c.confidence==='number' ? `(${Math.round(c.confidence*100)}%)` : ''} [{c.source}]</ThemedText>
                    ))}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
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
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  playerAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 40,
  },
  playerName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  playerLevel: {
    fontSize: 18,
    opacity: 0.8,
    marginBottom: 16,
  },
  xpContainer: {
    width: '100%',
    alignItems: 'center',
  },
  totalXpText: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
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
  rarityContainer: {
    marginBottom: 24,
  },
  rarityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  rarityBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  rarityName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  rarityCount: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  biomeContainer: {
    marginBottom: 24,
  },
  biomeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  biomeCard: {
    width: (screenWidth - 48) / 3,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  biomeEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  biomeName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  biomeCount: {
    fontSize: 10,
    opacity: 0.8,
    textAlign: 'center',
  },
  achievementsContainer: {
    marginBottom: 24,
  },
  achievementCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  achievementCompleted: {
    backgroundColor: theme.colors.primary + '20',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  achievementIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  achievementIconLocked: {
    opacity: 0.3,
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  achievementDescription: {
    fontSize: 14,
    opacity: 0.8,
  },
  achievementTextLocked: {
    opacity: 0.5,
  },
  checkmark: {
    fontSize: 20,
    color: theme.colors.success,
    fontWeight: '700',
  },
  collectionButtonContainer: {
    marginBottom: 24,
  },
  collectionButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  collectionButtonIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  collectionButtonTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  collectionButtonSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  collectionButtonArrow: {
    fontSize: 24,
    color: theme.colors.text,
    opacity: 0.5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  modalCloseButton: {
    backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
    shadowColor: theme.isDark ? '#ffffff' : '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: theme.isDark ? 0.1 : 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modalCloseText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.isDark ? '#ffffff' : '#000000',
  },
});