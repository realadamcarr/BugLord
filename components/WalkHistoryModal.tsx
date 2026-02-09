import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/contexts/ThemeContext';
import { WalkHistoryEntry } from '@/services/WalkModeService';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

interface WalkHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  getWalkHistory: () => Promise<WalkHistoryEntry[]>;
}

export const WalkHistoryModal: React.FC<WalkHistoryModalProps> = ({
  visible,
  onClose,
  getWalkHistory
}) => {
  const { theme } = useTheme();
  const [history, setHistory] = useState<WalkHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const styles = createStyles(theme);

  useEffect(() => {
    if (visible) {
      loadHistory();
    }
  }, [visible]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const entries = await getWalkHistory();
      setHistory(entries);
    } catch (error) {
      console.error('Failed to load walk history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const renderHistoryEntry = (entry: WalkHistoryEntry, index: number) => (
    <View key={entry.id} style={styles.historyCard}>
      <View style={styles.historyHeader}>
        <View style={styles.dateSection}>
          <ThemedText style={styles.dateText}>
            {formatDate(entry.startTime)}
          </ThemedText>
          <ThemedText style={styles.timeText}>
            {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
          </ThemedText>
        </View>
        <View style={styles.durationSection}>
          <ThemedText style={styles.durationText}>
            {formatDuration(entry.duration)}
          </ThemedText>
        </View>
      </View>

      <View style={styles.statsSection}>
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>👟</Text>
          <ThemedText style={styles.statValue}>{entry.stepsWalked.toLocaleString()}</ThemedText>
          <ThemedText style={styles.statLabel}>steps</ThemedText>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>🐛</Text>
          <ThemedText style={styles.statValue} numberOfLines={1}>
            {entry.bugName}
          </ThemedText>
          <ThemedText style={styles.statLabel}>bug trained</ThemedText>
        </View>
        
        <View style={styles.statItem}>
          <Text style={styles.statIcon}>⭐</Text>
          <ThemedText style={styles.statValue}>{entry.xpGained}</ThemedText>
          <ThemedText style={styles.statLabel}>XP gained</ThemedText>
        </View>
      </View>

      {entry.itemsFound.length > 0 && (
        <View style={styles.itemsSection}>
          <ThemedText style={styles.itemsLabel}>Items Found:</ThemedText>
          <View style={styles.itemsList}>
            {entry.itemsFound.map((item, itemIndex) => (
              <View key={`${item.itemId}-${itemIndex}`} style={styles.itemChip}>
                <ThemedText style={styles.itemText}>
                  {item.amount}x {item.name}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <ThemedText style={styles.title}>Walk History</ThemedText>
          <View style={styles.closeButton} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ThemedText style={styles.loadingText}>Loading history...</ThemedText>
          </View>
        ) : history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🚶‍♂️</Text>
            <ThemedText style={styles.emptyTitle}>No walks yet</ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Start walking with an active bug to build your history
            </ThemedText>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {history.map(renderHistoryEntry)}
            <View style={styles.bottomPadding} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 24,
  },
  scrollContent: {
    padding: 16,
  },
  historyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dateSection: {
    flex: 1,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  timeText: {
    fontSize: 14,
    opacity: 0.7,
  },
  durationSection: {
    alignItems: 'flex-end',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  itemsSection: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
  },
  itemsLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  itemsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  itemChip: {
    backgroundColor: theme.colors.primary + '20',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  itemText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.primary,
  },
  bottomPadding: {
    height: 20,
  },
});