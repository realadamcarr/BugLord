import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date | string; // Can be string when loaded from AsyncStorage
  isCompleted: boolean;
  xpReward: number;
}

interface EnhancedNoteCardProps {
  note: Note;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

const getXPTierInfo = (xp: number, theme: any) => {
  if (xp >= 50) return { icon: '💎', color: theme.colors.tierEpic, tier: 'Epic' };
  if (xp >= 35) return { icon: '🌟', color: theme.colors.tierRare, tier: 'Rare' };
  if (xp >= 25) return { icon: '⭐', color: theme.colors.tierGood, tier: 'Good' };
  return { icon: '📝', color: theme.colors.tierBasic, tier: 'Basic' };
};

const formatTimeAgo = (date: Date | string): string => {
  const now = new Date();
  // Handle both Date objects and date strings from AsyncStorage
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const diff = now.getTime() - dateObj.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

export const EnhancedNoteCard: React.FC<EnhancedNoteCardProps> = ({
  note,
  onComplete,
  onDelete,
}) => {
  const { theme } = useTheme();
  const tierInfo = getXPTierInfo(note.xpReward, theme);
  const timeAgo = formatTimeAgo(note.createdAt);
  const styles = createStyles(theme);

  return (
    <ThemedView 
      style={[
        styles.noteCard,
        note.isCompleted && styles.completedNote,
        { borderLeftColor: tierInfo.color }
      ]}
    >
      {/* Header with tier badge and time */}
      <View style={styles.noteHeader}>
        <View style={[styles.tierBadge, { backgroundColor: tierInfo.color }]}>
          <Text style={styles.tierIcon}>{tierInfo.icon}</Text>
          <ThemedText style={styles.tierText}>{tierInfo.tier}</ThemedText>
        </View>
        <ThemedText style={styles.timeText}>{timeAgo}</ThemedText>
      </View>

      {/* Title */}
      <ThemedText style={[styles.noteTitle, note.isCompleted && styles.completedText]}>
        {note.title}
      </ThemedText>

      {/* Content */}
      {note.content ? (
        <ThemedText style={[styles.noteContent, note.isCompleted && styles.completedText]}>
          {note.content}
        </ThemedText>
      ) : null}

      {/* Footer */}
      <View style={styles.noteFooter}>
        <View style={styles.xpContainer}>
          <View style={[styles.xpBadge, { backgroundColor: tierInfo.color }]}>
            <Text style={styles.xpIcon}>⚡</Text>
            <ThemedText style={styles.xpText}>+{note.xpReward}</ThemedText>
          </View>
        </View>

        <View style={styles.noteActions}>
          {!note.isCompleted && (
            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => onComplete(note.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonIcon}>✓</Text>
              <Text style={styles.buttonText}>Complete</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.deleteButton, note.isCompleted && styles.deleteButtonCompleted]}
            onPress={() => onDelete(note.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Completed overlay */}
      {note.isCompleted && (
        <View style={styles.completedOverlay}>
          <Text style={styles.completedIcon}>✅</Text>
          <ThemedText style={styles.completedLabel}>Completed</ThemedText>
        </View>
      )}
    </ThemedView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  noteCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 4,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: theme.isDark ? 0.3 : 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  completedNote: {
    backgroundColor: theme.isDark ? 'rgba(50, 215, 75, 0.08)' : 'rgba(76, 175, 80, 0.05)',
    borderColor: theme.isDark ? 'rgba(50, 215, 75, 0.3)' : 'rgba(76, 175, 80, 0.2)',
    opacity: 0.8,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  tierText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timeText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 24,
  },
  noteContent: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpContainer: {
    flex: 1,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  xpIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  xpText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  noteActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.success,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  buttonIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: theme.isDark ? 'rgba(255, 69, 58, 0.15)' : 'rgba(255, 107, 107, 0.1)',
  },
  deleteButtonCompleted: {
    backgroundColor: theme.isDark ? 'rgba(142, 142, 147, 0.15)' : 'rgba(153, 153, 153, 0.1)',
  },
  deleteIcon: {
    fontSize: 16,
  },
  completedOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.isDark ? 'rgba(50, 215, 75, 0.9)' : 'rgba(76, 175, 80, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  completedLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
