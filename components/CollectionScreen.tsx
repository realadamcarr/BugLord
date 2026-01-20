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

  const renderBugItem = ({ item: bug }: { item: Bug }) => (
    <TouchableOpacity
      style={styles.bugCard}
      onPress={() => handleBugPress(bug)}
    >
      <View style={styles.bugImageContainer}>
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
      
      <ThemedText style={styles.bugName} numberOfLines={2}>
        {bug.nickname || bug.name}
      </ThemedText>
      
      <View style={styles.bugLevel}>
        <Text style={styles.levelText}>Lv.{bug.level}</Text>
      </View>
    </TouchableOpacity>
  );

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
    padding: 20,
    paddingBottom: 16,
  },
  headerContent: {
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  closeButtonText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  gridContainer: {
    padding: 20,
    paddingTop: 0,
  },
  row: {
    justifyContent: 'space-between',
  },
  bugCard: {
    width: ITEM_SIZE,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bugImageContainer: {
    width: ITEM_SIZE - 24,
    height: ITEM_SIZE - 24,
    borderRadius: 8,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
  },
  bugIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  placeholderIcon: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 32,
  },
  bugName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
    minHeight: 32, // Ensure consistent height for 2 lines
  },
  bugLevel: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  levelText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.7,
  },
});