import { AdminPanel } from '@/components/AdminPanel';
import { Character, getNextUnlock } from '@/components/Character';
import { EnhancedNoteCard } from '@/components/EnhancedNoteCard';
import { LevelUpNotification } from '@/components/LevelUpNotification';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { XPProgressBar } from '@/components/XPProgressBar';
import { useTheme } from '@/contexts/ThemeContext';
import { useUserProgress } from '@/contexts/UserProgressContext';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date | string; // Can be string when loaded from AsyncStorage
  isCompleted: boolean;
  xpReward: number;
}

interface UserProgress {
  level: number;
  xp: number;
  totalXp: number;
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const { notes, userProgress, updateBoth } = useUserProgress();
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTapCount, setAdminTapCount] = useState(0);
  const [levelUpData, setLevelUpData] = useState({ newLevel: 1, xpGained: 0, nextUnlock: null as any });

  const styles = createStyles(theme);

  // Reset admin tap count after 3 seconds of inactivity
  useEffect(() => {
    if (adminTapCount > 0) {
      const timeout = setTimeout(() => {
        setAdminTapCount(0);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [adminTapCount]);

  const handleAdminTap = () => {
    const newCount = adminTapCount + 1;
    setAdminTapCount(newCount);
    
    if (newCount >= 5) {
      setShowAdminPanel(true);
      setAdminTapCount(0);
    }
  };

  const calculateXpForNextLevel = (level: number) => level * 100;

  const addNote = async () => {
    if (!newNoteTitle.trim()) {
      Alert.alert('Error', 'Please enter a note title');
      return;
    }

    // Improved XP calculation based on title and content
    const titleXp = Math.floor(newNoteTitle.trim().length / 2);
    const contentXp = Math.floor(newNoteContent.trim().length / 5);
    const baseXp = 15; // Base XP for creating any note
    const totalXp = baseXp + titleXp + contentXp;

    const newNote: Note = {
      id: Date.now().toString(),
      title: newNoteTitle.trim(),
      content: newNoteContent.trim(),
      createdAt: new Date(),
      isCompleted: false,
      xpReward: Math.max(15, totalXp) // Minimum 15 XP
    };

    const updatedNotes = [...notes, newNote];
    await updateBoth(updatedNotes, userProgress);
    
    setNewNoteTitle('');
    setNewNoteContent('');
    setShowAddForm(false);
    
    // Show confirmation
    Alert.alert('Note Created!', `"${newNote.title}" is ready to complete for ${newNote.xpReward} XP!`);
  };

  const completeTask = async (noteId: string) => {
    const noteIndex = notes.findIndex(note => note.id === noteId);
    if (noteIndex === -1 || notes[noteIndex].isCompleted) return;

    const note = notes[noteIndex];
    const updatedNotes = [...notes];
    updatedNotes[noteIndex] = { ...note, isCompleted: true };

    const gainedXp = note.xpReward;
    const newTotalXp = userProgress.totalXp + gainedXp;
    let newXp = userProgress.xp + gainedXp;
    let newLevel = userProgress.level;
    let leveledUp = false;

    const xpForNextLevel = calculateXpForNextLevel(newLevel);
    
    if (newXp >= xpForNextLevel) {
      newLevel += 1;
      newXp = newXp - xpForNextLevel;
      leveledUp = true;
    }

    const newProgress = { level: newLevel, xp: newXp, totalXp: newTotalXp };
    
    await updateBoth(updatedNotes, newProgress);

    // Enhanced feedback with level up modal
    if (leveledUp) {
      const nextUnlock = getNextUnlock(newLevel);
      setLevelUpData({
        newLevel,
        xpGained: gainedXp,
        nextUnlock,
      });
      setShowLevelUp(true);
    } else {
      Alert.alert(
        '✅ Task Completed!', 
        `Great job! You earned ${gainedXp} XP!\n\nProgress: ${newXp}/${calculateXpForNextLevel(newLevel)} XP to Level ${newLevel + 1}`,
        [{ text: 'Nice!', style: 'default' }]
      );
    }
  };

  const deleteNote = (noteId: string) => {
    const handleDelete = async () => {
      const updatedNotes = notes.filter(note => note.id !== noteId);
      await updateBoth(updatedNotes, userProgress);
    };

    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => { handleDelete(); }
        }
      ]
    );
  };

  const renderNote = ({ item }: { item: Note }) => (
    <EnhancedNoteCard
      note={item}
      onComplete={completeTask}
      onDelete={deleteNote}
    />
  );

  const xpForNextLevel = calculateXpForNextLevel(userProgress.level);

  // Sort notes to show incomplete first, then by creation date
  const sortedNotes = [...notes].sort((a, b) => {
    // Sort by completion status (incomplete first), then by creation date (newest first)
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <ThemedView style={styles.container}>
      {/* Level Up Notification */}
      <LevelUpNotification
        visible={showLevelUp}
        newLevel={levelUpData.newLevel}
        xpGained={levelUpData.xpGained}
        nextUnlockName={levelUpData.nextUnlock?.name}
        nextUnlockLevel={levelUpData.nextUnlock?.unlockLevel}
        onClose={() => setShowLevelUp(false)}
      />

      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Completed Notes</ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          Track your progress and earn XP! 🚀
        </ThemedText>
      </View>

      {/* Progress Header with Character */}
      <ThemedView style={styles.progressHeader}>
        <View style={styles.headerContent}>
          <Character level={userProgress.level} size="medium" />
          <View style={styles.progressInfo}>
            <TouchableOpacity onPress={handleAdminTap} activeOpacity={0.7}>
              <ThemedText style={styles.levelText}>Level {userProgress.level}</ThemedText>
            </TouchableOpacity>
            <XPProgressBar
              currentXP={userProgress.xp}
              maxXP={xpForNextLevel}
              level={userProgress.level}
              animated={true}
              showTooltip={true}
            />
            <ThemedText style={styles.totalXpText}>Total XP: {userProgress.totalXp}</ThemedText>
          </View>
        </View>
      </ThemedView>

      {/* Add Note Section */}
      {showAddForm ? (
        <ThemedView style={styles.addForm}>
          <TextInput
            style={styles.input}
            placeholder="Note title..."
            value={newNoteTitle}
            onChangeText={setNewNoteTitle}
            placeholderTextColor="#666"
          />
          <TextInput
            style={[styles.input, styles.contentInput]}
            placeholder="Note content..."
            value={newNoteContent}
            onChangeText={setNewNoteContent}
            multiline
            placeholderTextColor="#666"
          />
          <View style={styles.formButtons}>
            <TouchableOpacity style={styles.addButton} onPress={addNote}>
              <Text style={styles.buttonText}>Add Note</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={() => setShowAddForm(false)}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ThemedView>
      ) : (
        <TouchableOpacity 
          style={styles.showFormButton} 
          onPress={() => setShowAddForm(true)}
        >
          <Text style={styles.buttonText}>+ Add New Note</Text>
        </TouchableOpacity>
      )}

      {/* Notes List */}
      <FlatList
        data={sortedNotes}
        renderItem={renderNote}
        keyExtractor={(item) => item.id}
        style={styles.notesList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyStateTitle}>Ready to start your quest? 🎯</ThemedText>
            <ThemedText style={styles.emptyStateSubtitle}>
              Create your first note to begin earning XP and leveling up!
            </ThemedText>
          </ThemedView>
        }
      />

      {/* Admin Panel */}
      <AdminPanel 
        visible={showAdminPanel} 
        onClose={() => setShowAdminPanel(false)} 
      />
    </ThemedView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: theme.colors.background,
  },
  header: {
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  progressHeader: {
    padding: 20,
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: theme.isDark ? 0.3 : 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressInfo: {
    flex: 1,
    marginLeft: 16,
  },
  levelText: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    color: theme.colors.primary,
  },
  totalXpText: {
    fontSize: 14,
    textAlign: 'left',
    opacity: 0.7,
    marginTop: 4,
    fontWeight: '500',
  },
  showFormButton: {
    backgroundColor: theme.colors.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addForm: {
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: theme.isDark ? 0.3 : 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: theme.colors.surface,
    fontSize: 16,
    color: theme.colors.text,
  },
  contentInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  addButton: {
    backgroundColor: theme.colors.success,
    padding: 14,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButton: {
    backgroundColor: theme.colors.error,
    padding: 14,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
    marginLeft: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  notesList: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 24,
  },
});
