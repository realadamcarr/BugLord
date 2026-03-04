import { BugInfoModal } from '@/components/BugInfoModal';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { BUG_SPRITE } from '@/constants/bugSprites';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Bug, BugRarity, RARITY_CONFIG } from '@/types/Bug';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const ITEM_SIZE = (screenWidth - 60) / GRID_COLUMNS; // Account for padding and gaps

interface CollectionScreenProps {
  onClose: () => void;
  initialRarityFilter?: BugRarity | 'all';
}

export const CollectionScreen: React.FC<CollectionScreenProps> = ({ onClose, initialRarityFilter = 'all' }) => {
  const { theme } = useTheme();
  const { collection } = useBugCollection();
  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);
  const [showBugDetails, setShowBugDetails] = useState(false);

  // Filter / sort state
  const [showAll, setShowAll] = useState(true); // true = all bugs, false = storage only
  const [rarityFilter, setRarityFilter] = useState<BugRarity | 'all'>(initialRarityFilter);
  const [sortBy, setSortBy] = useState<'newest' | 'level-asc' | 'level-desc' | 'rarity'>('newest');

  const styles = createStyles(theme);

  const RARITIES: { key: BugRarity | 'all'; label: string; color: string }[] = [
    { key: 'all', label: 'All', color: theme.colors.primary },
    { key: 'common', label: 'Common', color: RARITY_CONFIG.common.color },
    { key: 'uncommon', label: 'Uncommon', color: RARITY_CONFIG.uncommon.color },
    { key: 'rare', label: 'Rare', color: RARITY_CONFIG.rare.color },
    { key: 'epic', label: 'Epic', color: RARITY_CONFIG.epic.color },
    { key: 'legendary', label: 'Legendary', color: RARITY_CONFIG.legendary.color },
  ];

  const SORTS: { key: typeof sortBy; label: string }[] = [
    { key: 'newest', label: '🕐 Newest' },
    { key: 'level-desc', label: '⬆️ Level ↓' },
    { key: 'level-asc', label: '⬇️ Level ↑' },
    { key: 'rarity', label: '💎 Rarity' },
  ];

  const RARITY_ORDER: Record<string, number> = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 };

  useEffect(() => {
    setRarityFilter(initialRarityFilter);
    setShowAll(true);
  }, [initialRarityFilter]);

  // Derive filtered + sorted bugs list
  const partyBugIds = new Set(collection.party.filter(Boolean).map(bug => bug!.id));

  const filteredBugs = useMemo(() => {
    let bugs = showAll ? [...collection.bugs] : collection.bugs.filter(b => !partyBugIds.has(b.id));

    if (rarityFilter !== 'all') {
      bugs = bugs.filter(b => b.rarity === rarityFilter);
    }

    switch (sortBy) {
      case 'level-desc':
        bugs.sort((a, b) => b.level - a.level);
        break;
      case 'level-asc':
        bugs.sort((a, b) => a.level - b.level);
        break;
      case 'rarity':
        bugs.sort((a, b) => (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99));
        break;
      case 'newest':
      default:
        // newest first — bugs are appended, so reverse
        bugs.reverse();
        break;
    }
    return bugs;
  }, [collection.bugs, showAll, rarityFilter, sortBy]);

  const handleBugPress = (bug: Bug) => {
    setSelectedBug(bug);
    setShowBugDetails(true);
  };

  const handleBugDetailsClose = () => {
    setShowBugDetails(false);
    setSelectedBug(null);
  };

  const handleBugDetailsConfirm = (options: { nickname?: string; addToParty?: boolean; replaceBugId?: string }) => {
    // TODO: Implement bug details update logic
    console.log('Update bug:', selectedBug?.id, options);
    
    // For now, just close the modal
    handleBugDetailsClose();
  };

  const renderBugItem = ({ item: bug }: { item: Bug }) => {
    const maxHp = bug.maxHp || bug.maxXp;
    const currentHp = bug.currentHp !== undefined ? bug.currentHp : maxHp;
    const isFainted = currentHp <= 0;
    const rarityColor = RARITY_CONFIG[bug.rarity]?.color ?? theme.colors.border;

    return (
    <TouchableOpacity
      style={[styles.bugCard, { borderColor: rarityColor }]}
      onPress={() => handleBugPress(bug)}
    >
      <View style={[styles.bugImageContainer, isFainted && { opacity: 0.4 }]}>
        {bug.category && BUG_SPRITE[bug.category] ? (
          <Image source={BUG_SPRITE[bug.category]} style={styles.bugIcon} />
        ) : bug.photo ? (
          <Image source={{ uri: bug.photo }} style={styles.bugIcon} />
        ) : bug.pixelArt ? (
          <Image source={{ uri: bug.pixelArt }} style={styles.bugIcon} />
        ) : (
          <View style={styles.placeholderIcon}>
            <Text style={styles.placeholderEmoji}>🐛</Text>
          </View>
        )}
      </View>
      
      <ThemedText style={[styles.bugName, isFainted && { opacity: 0.5 }]} numberOfLines={2}>
        {isFainted ? '💀 ' : ''}{bug.nickname || bug.name}
      </ThemedText>

      {/* Rarity badge */}
      <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
        <Text style={styles.rarityBadgeText}>{bug.rarity.toUpperCase()}</Text>
      </View>
      
      <View style={styles.bugLevel}>
        <Text style={styles.levelText}>{isFainted ? 'FAINTED' : `Lv.${bug.level}`}</Text>
      </View>
    </TouchableOpacity>
  );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🕳️</Text>
      <ThemedText style={styles.emptyTitle}>No Bugs in Collection</ThemedText>
      <ThemedText style={styles.emptyDescription}>
        Bugs you catch will appear here when your party is full, or you can move them here from your party.
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <ThemedText style={styles.title}>📚 Bug Collection</ThemedText>
          <ThemedText style={styles.subtitle}>
            {filteredBugs.length} of {collection.bugs.length} bugs
          </ThemedText>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* All / Storage toggle */}
      <View style={styles.filterSection}>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewToggleOption, showAll && { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowAll(true)}
          >
            <Text style={[styles.viewToggleText, showAll && { color: '#fff' }]}>All Bugs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleOption, !showAll && { backgroundColor: theme.colors.primary }]}
            onPress={() => setShowAll(false)}
          >
            <Text style={[styles.viewToggleText, !showAll && { color: '#fff' }]}>Storage Only</Text>
          </TouchableOpacity>
        </View>

        {/* Rarity filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {RARITIES.map(r => {
            const active = rarityFilter === r.key;
            return (
              <TouchableOpacity
                key={r.key}
                style={[styles.chip, active && { backgroundColor: r.color, borderColor: r.color }]}
                onPress={() => setRarityFilter(r.key)}
              >
                <Text style={[styles.chipText, active && { color: '#fff' }]}>{r.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Sort options */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {SORTS.map(s => {
            const active = sortBy === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.chip, active && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
                onPress={() => setSortBy(s.key)}
              >
                <Text style={[styles.chipText, active && { color: '#fff' }]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {filteredBugs.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredBugs}
          renderItem={renderBugItem}
          keyExtractor={(bug) => bug.id}
          numColumns={GRID_COLUMNS}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Bug Details Modal */}
      <BugInfoModal
        visible={showBugDetails}
        bug={selectedBug}
        onClose={handleBugDetailsClose}
        onConfirm={handleBugDetailsConfirm}
        isNewCatch={false}
      />
    </ThemedView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 14,
    borderBottomWidth: 3,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  headerContent: {
    flex: 1,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  closeButtonText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '900',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  gridContainer: {
    padding: 16,
    paddingTop: 12,
  },
  filterSection: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    padding: 3,
    marginBottom: 8,
  },
  viewToggleOption: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
  },
  viewToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 8,
    paddingRight: 12,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  row: {
    justifyContent: 'space-between',
  },
  bugCard: {
    width: ITEM_SIZE,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  bugImageContainer: {
    width: ITEM_SIZE - 20,
    height: ITEM_SIZE - 20,
    borderRadius: 6,
    marginBottom: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bugIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 5,
  },
  placeholderIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 28,
  },
  bugName: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
    minHeight: 30,
  },
  rarityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginBottom: 4,
  },
  rarityBadgeText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bugLevel: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: `${theme.colors.primary}80`,
  },
  levelText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyDescription: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
});