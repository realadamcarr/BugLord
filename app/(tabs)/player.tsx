import { CollectionScreen } from '@/components/CollectionScreen';
import PixelatedEmoji from '@/components/PixelatedEmoji';
import { ThemedText } from '@/components/ThemedText';
import { XPProgressBar } from '@/components/XPProgressBar';
import { FadeInView } from '@/components/animated/FadeInView';
import { ScalePressable } from '@/components/animated/ScalePressable';
import { SkiaSparkles } from '@/components/effects/SkiaSparkles';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatPill } from '@/components/ui/StatPill';
import { getProfilePictureSource, PROFILE_PICTURES } from '@/constants/profilePictures';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { clearScanLogs, getScanLogs, ScanLogEntry } from '@/services/ScanLogService';
import { BIOME_CONFIG, BugRarity, RARITY_CONFIG } from '@/types/Bug';
import React, { useEffect, useState } from 'react';
import { Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Dialog, Button as PaperButton, Portal } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: screenWidth } = Dimensions.get('window');

export default function PlayerScreen() {
  const { theme } = useTheme();
  const { collection, setProfilePicture } = useBugCollection();
  const [showCollection, setShowCollection] = useState(false);
  const [showPfpPicker, setShowPfpPicker] = useState(false);
  const [collectionInitialRarity, setCollectionInitialRarity] = useState<BugRarity | 'all'>('all');
  const [collectionInitialBiome, setCollectionInitialBiome] = useState<string>('all');
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<ScanLogEntry[]>([]);

  useEffect(() => {
    if (showLogs) {
      getScanLogs().then(setLogs);
    }
  }, [showLogs]);

  const styles = createStyles(theme);
  const profilePicSource = getProfilePictureSource(collection.profilePicture);

  // Calculate player statistics
  const totalBugs = collection.bugs.length;
  const partyCount = collection.party.filter(Boolean).length;
  
  // Count bugs by rarity
  const rarityStats = collection.bugs.reduce((acc: any, bug) => {
    if (bug && bug.rarity) {
      acc[bug.rarity] = (acc[bug.rarity] || 0) + 1;
    }
    return acc;
  }, {});

  // Count bugs by biome
  const biomeStats = collection.bugs.reduce((acc: any, bug) => {
    if (bug && bug.biome) {
      acc[bug.biome] = (acc[bug.biome] || 0) + 1;
    }
    return acc;
  }, {});

  const renderAchievement = (title: string, description: string, completed: boolean, icon: string) => (
    <View style={[styles.achievementCard, completed && styles.achievementCompleted]}>
      <View style={[styles.achievementIcon, !completed && styles.achievementIconLocked]}>
        <PixelatedEmoji type={icon as any} size={24} color={completed ? theme.colors.text : theme.colors.text + '40'} />
      </View>
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

  const openCollection = (rarity: BugRarity | 'all' = 'all', biome: string = 'all') => {
    setCollectionInitialRarity(rarity);
    setCollectionInitialBiome(biome);
    setShowCollection(true);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Player Header */}
        <View style={styles.header}>
          {/* Skia sparkle particles behind the avatar */}
          <View style={{ position: 'absolute', top: 0, alignSelf: 'center' }}>
            <SkiaSparkles
              width={180}
              height={120}
              count={10}
              colors={[theme.colors.primary, '#FFD700', '#F0B429', theme.colors.text + '60']}
            />
          </View>
          <TouchableOpacity style={styles.playerAvatar} onPress={() => setShowPfpPicker(true)}>
            {profilePicSource ? (
              <Image source={profilePicSource} style={styles.playerAvatarImage} />
            ) : (
              <PixelatedEmoji type="bug" size={48} color={theme.colors.text} />
            )}
          </TouchableOpacity>
          <ThemedText style={styles.changeAvatarHint}>Tap to change</ThemedText>
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
        <FadeInView delay={60} style={styles.statsContainer}>
          <SectionHeader title="Collection Stats" icon="📊" />
          <View style={styles.statPillRow}>
            <StatPill icon="🐛" value={totalBugs} label="Total Bugs" style={styles.statPill} />
            <StatPill icon="⚔️" value={`${partyCount}/6`} label="Party" color={theme.colors.warning} style={styles.statPill} />
          </View>
          <View style={styles.statPillRow}>
            <StatPill icon="🗺️" value={Object.keys(biomeStats).length} label="Biomes" color={theme.colors.success} style={styles.statPill} />
            <StatPill
              icon="💎"
              value={(rarityStats.rare || 0) + (rarityStats.epic || 0) + (rarityStats.legendary || 0)}
              label="Rare+"
              color={theme.colors.tierRare}
              style={styles.statPill}
            />
          </View>
        </FadeInView>

        {/* Collection Button */}
        <FadeInView delay={120} style={styles.collectionButtonContainer}>
          <ScalePressable onPress={() => openCollection('all')} style={{ marginBottom: 10 }}>
            <View style={[styles.collectionButton, { borderLeftColor: theme.colors.primary, borderLeftWidth: 4 }]}>
              <View style={styles.collectionButtonIcon}>
                <PixelatedEmoji type="dex" size={28} color={theme.colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.collectionButtonTitle}>View Collection</ThemedText>
                <ThemedText style={styles.collectionButtonSubtitle}>
                  {collection.bugs.length - collection.party.filter(Boolean).length} bugs in storage
                </ThemedText>
              </View>
              <Text style={styles.collectionButtonArrow}>›</Text>
            </View>
          </ScalePressable>
          <ScalePressable onPress={() => setShowLogs(true)}>
            <View style={[styles.collectionButton, { borderLeftColor: theme.colors.warning, borderLeftWidth: 4 }]}>
              <Text style={[styles.collectionButtonIcon, { fontSize: 22 }]}>🧪</Text>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.collectionButtonTitle}>Scan Logs</ThemedText>
                <ThemedText style={styles.collectionButtonSubtitle}>
                  Inspect recent identifications
                </ThemedText>
              </View>
              <Text style={styles.collectionButtonArrow}>›</Text>
            </View>
          </ScalePressable>
        </FadeInView>

        {/* Rarity Breakdown */}
        <View style={styles.rarityContainer}>
          <View style={styles.sectionTitleContainer}>
            <PixelatedEmoji type="rare" size={20} color={theme.colors.text} />
            <ThemedText style={styles.sectionTitle}>Collection by Rarity</ThemedText>
          </View>
          
          {Object.entries(RARITY_CONFIG).map(([rarity, config]) => (
            <TouchableOpacity
              key={rarity}
              style={styles.rarityRow}
              activeOpacity={0.8}
              onPress={() => openCollection(rarity as BugRarity)}
            >
              <View 
                style={[styles.rarityBadge, { backgroundColor: config.color }]}
              />
              <ThemedText style={styles.rarityName}>
                {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
              </ThemedText>
              <ThemedText style={styles.rarityCount}>
                {rarityStats[rarity] || 0}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Biome Progress */}
        <View style={styles.biomeContainer}>
          <View style={styles.sectionTitleContainer}>
            <PixelatedEmoji type="map" size={20} color={theme.colors.text} />
            <ThemedText style={styles.sectionTitle}>Biome Exploration</ThemedText>
          </View>
          
          <View style={styles.biomeGrid}>
            {Object.entries(BIOME_CONFIG).map(([biome, config]) => (
              <TouchableOpacity
                key={biome}
                style={styles.biomeCard}
                onPress={() => openCollection('all', biome)}
                activeOpacity={0.7}
              >
                <Text style={styles.biomeEmoji}>{config.emoji}</Text>
                <ThemedText style={styles.biomeName}>
                  {biome.charAt(0).toUpperCase() + biome.slice(1)}
                </ThemedText>
                <ThemedText style={styles.biomeCount}>
                  {biomeStats[biome] || 0} bugs
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Achievements */}
        <View style={styles.achievementsContainer}>
          <View style={styles.sectionTitleContainer}>
            <PixelatedEmoji type="rare" size={20} color={theme.colors.text} />
            <ThemedText style={styles.sectionTitle}>Achievements</ThemedText>
          </View>
          
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
            "dex"
          )}
          
          {renderAchievement(
            "Full Party",
            "Fill all 6 party slots",
            partyCount === 6,
            "ppl"
          )}
          
          {renderAchievement(
            "Rare Hunter",
            "Find a rare or higher rarity bug",
            (rarityStats.rare || 0) + (rarityStats.epic || 0) + (rarityStats.legendary || 0) >= 1,
            "gem"
          )}
          
          {renderAchievement(
            "Explorer",
            "Discover bugs in 5 different biomes",
            Object.keys(biomeStats).length >= 5,
            "map"
          )}
          
          {renderAchievement(
            "Level Up!",
            "Reach Explorer Level 5",
            collection.level >= 5,
            "up"
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
          <CollectionScreen
            onClose={() => setShowCollection(false)}
            initialRarityFilter={collectionInitialRarity}
            initialBiomeFilter={collectionInitialBiome as any}
          />
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
            <ThemedText style={{ fontSize: 18, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>Scan Logs</ThemedText>
            <TouchableOpacity
              style={styles.modalCloseButton}
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

      {/* Profile Picture Picker — Paper Dialog */}
      <Portal>
        <Dialog visible={showPfpPicker} onDismiss={() => setShowPfpPicker(false)} style={{ backgroundColor: theme.colors.card }}>
          <Dialog.Title style={styles.pfpTitle}>Choose Avatar</Dialog.Title>
          <Dialog.Content>
            <View style={styles.pfpGrid}>
              {PROFILE_PICTURES.map((option) => {
                const isSelected = collection.profilePicture === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.pfpOption,
                      { borderColor: isSelected ? theme.colors.primary : theme.colors.border },
                      isSelected && { borderWidth: 3 },
                    ]}
                    onPress={() => {
                      setProfilePicture(option.key);
                      setShowPfpPicker(false);
                    }}
                  >
                    {option.source ? (
                      <Image source={option.source} style={styles.pfpOptionImage} />
                    ) : (
                      <PixelatedEmoji type="bug" size={36} color={theme.colors.text} />
                    )}
                    <ThemedText style={styles.pfpOptionLabel}>{option.label}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <PaperButton onPress={() => setShowPfpPicker(false)}>Cancel</PaperButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  header: {
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: theme.colors.card,
    borderRadius: 10,
    padding: 20,
    borderWidth: 3,
    borderColor: theme.colors.border,
  },
  playerAvatar: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderWidth: 3,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  playerAvatarImage: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  changeAvatarHint: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginBottom: 8,
    fontWeight: '600',
  },
  playerName: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 2,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  playerLevel: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.warning,
    marginBottom: 14,
  },
  xpContainer: {
    width: '100%',
    alignItems: 'center',
  },
  totalXpText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  statsContainer: {
    marginBottom: 20,
  },
  statPillRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  statPill: {
    flex: 1,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
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
    textAlign: 'center',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rarityContainer: {
    marginBottom: 20,
  },
  rarityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  rarityBadge: {
    width: 14,
    height: 14,
    borderRadius: 3,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  rarityName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rarityCount: {
    fontSize: 15,
    fontWeight: '900',
    color: theme.colors.warning,
  },
  biomeContainer: {
    marginBottom: 20,
  },
  biomeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  biomeCard: {
    width: (screenWidth - 48) / 3,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  biomeEmoji: {
    fontSize: 22,
    marginBottom: 3,
  },
  biomeName: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  biomeCount: {
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    color: theme.colors.textMuted,
  },
  achievementsContainer: {
    marginBottom: 24,
  },
  achievementCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  achievementCompleted: {
    backgroundColor: `${theme.colors.primary}18`,
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  achievementIcon: {
    width: 26,
    height: 26,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementIconLocked: {
    opacity: 0.25,
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  achievementDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  achievementTextLocked: {
    opacity: 0.4,
  },
  checkmark: {
    fontSize: 18,
    color: theme.colors.success,
    fontWeight: '900',
  },
  collectionButtonContainer: {
    marginBottom: 20,
  },
  collectionButton: {
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  collectionButtonIcon: {
    width: 30,
    height: 30,
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionButtonTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  collectionButtonSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  collectionButtonArrow: {
    fontSize: 22,
    color: theme.colors.primary,
    fontWeight: '900',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    paddingTop: 18,
    borderBottomWidth: 3,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  modalCloseButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: 6,
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.colors.text,
  },
  pfpOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pfpModal: {
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  pfpTitle: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pfpGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  pfpOption: {
    width: 80,
    height: 100,
    borderRadius: 8,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
    padding: 4,
  },
  pfpOptionImage: {
    width: 56,
    height: 56,
    borderRadius: 6,
  },
  pfpOptionLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  pfpCloseBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  pfpCloseBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});