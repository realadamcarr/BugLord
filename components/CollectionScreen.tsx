import { BugInfoModal } from '@/components/BugInfoModal';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Bug } from '@/types/Bug';
import React, { useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const ITEM_SIZE = (screenWidth - 60) / GRID_COLUMNS; // Account for padding and gaps

interface CollectionScreenProps {
  onClose: () => void;
}

export const CollectionScreen: React.FC<CollectionScreenProps> = ({ onClose }) => {
  const { theme } = useTheme();
  const { collection } = useBugCollection();
  const [selectedBug, setSelectedBug] = useState<Bug | null>(null);
  const [showBugDetails, setShowBugDetails] = useState(false);

  const styles = createStyles(theme);

  // Get all bugs that are not currently in the party
  const partyBugIds = new Set(collection.party.filter(Boolean).map(bug => bug!.id));
  const collectionBugs = collection.bugs.filter(bug => !partyBugIds.has(bug.id));

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

    return (
    <TouchableOpacity
      style={styles.bugCard}
      onPress={() => handleBugPress(bug)}
    >
      <View style={[styles.bugImageContainer, isFainted && { opacity: 0.4 }]}>
        {bug.photo ? (
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
            {collectionBugs.length} bugs in storage
          </ThemedText>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      {collectionBugs.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={collectionBugs}
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