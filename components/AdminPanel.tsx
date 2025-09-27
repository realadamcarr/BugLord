import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import { useUserProgress } from '@/contexts/UserProgressContext';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface AdminPanelProps {
  visible: boolean;
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const { userProgress, updateProgress } = useUserProgress();
  const [customLevel, setCustomLevel] = useState('');
  const styles = createStyles(theme);

  if (!visible) return null;

  const setMaxLevel = async () => {
    const maxLevel = 25; // Set to a level higher than the highest unlock (20)
    const totalXpForMaxLevel = calculateTotalXpForLevel(maxLevel);
    
    const newProgress = {
      level: maxLevel,
      xp: 0, // Reset current level XP to 0
      totalXp: totalXpForMaxLevel
    };

    await updateProgress(newProgress);
    Alert.alert('Admin Command', `Level set to ${maxLevel}! 🎉\nAll cosmetics unlocked!`);
    onClose();
  };

  const setCustomLevelFunc = async () => {
    const level = parseInt(customLevel);
    if (isNaN(level) || level < 1 || level > 50) {
      Alert.alert('Invalid Level', 'Please enter a level between 1 and 50');
      return;
    }

    const totalXpForLevel = calculateTotalXpForLevel(level);
    
    const newProgress = {
      level: level,
      xp: 0,
      totalXp: totalXpForLevel
    };

    await updateProgress(newProgress);
    Alert.alert('Admin Command', `Level set to ${level}! 🎯`);
    setCustomLevel('');
    onClose();
  };

  const resetProgress = async () => {
    Alert.alert(
      'Reset Progress',
      'Are you sure you want to reset all progress to Level 1?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            const newProgress = {
              level: 1,
              xp: 0,
              totalXp: 0
            };
            await updateProgress(newProgress);
            Alert.alert('Progress Reset', 'All progress has been reset to Level 1');
            onClose();
          }
        }
      ]
    );
  };

  const addXP = async (amount: number) => {
    const calculateXpForNextLevel = (level: number) => level * 100;
    
    let newTotalXp = userProgress.totalXp + amount;
    let newXp = userProgress.xp + amount;
    let newLevel = userProgress.level;

    // Handle level ups
    while (newXp >= calculateXpForNextLevel(newLevel)) {
      newXp -= calculateXpForNextLevel(newLevel);
      newLevel++;
    }

    const newProgress = {
      level: newLevel,
      xp: newXp,
      totalXp: newTotalXp
    };

    await updateProgress(newProgress);
    Alert.alert('XP Added', `Added ${amount} XP! ${newLevel > userProgress.level ? `Leveled up to ${newLevel}!` : ''}`);
    onClose();
  };

  // Calculate total XP needed to reach a specific level
  const calculateTotalXpForLevel = (targetLevel: number) => {
    let totalXp = 0;
    for (let level = 1; level < targetLevel; level++) {
      totalXp += level * 100;
    }
    return totalXp;
  };

  return (
    <View style={styles.overlay}>
      <ThemedView style={styles.panel}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>🔧 Admin Panel</ThemedText>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ThemedText style={styles.currentStats}>
          Current Level: {userProgress.level} | Total XP: {userProgress.totalXp}
        </ThemedText>

        <View style={styles.buttonGroup}>
          <TouchableOpacity style={[styles.button, styles.maxLevelButton]} onPress={setMaxLevel}>
            <Text style={styles.buttonText}>🚀 Set Max Level (25)</Text>
          </TouchableOpacity>

          <View style={styles.customLevelContainer}>
            <TextInput
              style={styles.input}
              placeholder="Custom level (1-50)"
              value={customLevel}
              onChangeText={setCustomLevel}
              keyboardType="numeric"
              placeholderTextColor={theme.colors.textSecondary}
            />
            <TouchableOpacity style={[styles.button, styles.customButton]} onPress={setCustomLevelFunc}>
              <Text style={styles.buttonText}>Set Level</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.xpButtonsRow}>
            <TouchableOpacity style={[styles.button, styles.xpButton]} onPress={() => addXP(100)}>
              <Text style={styles.buttonText}>+100 XP</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.xpButton]} onPress={() => addXP(500)}>
              <Text style={styles.buttonText}>+500 XP</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.xpButton]} onPress={() => addXP(1000)}>
              <Text style={styles.buttonText}>+1000 XP</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.button, styles.resetButton]} onPress={resetProgress}>
            <Text style={styles.buttonText}>🔄 Reset Progress</Text>
          </TouchableOpacity>
        </View>

        <ThemedText style={styles.warning}>
          ⚠️ This panel is for testing purposes only
        </ThemedText>
      </ThemedView>
    </View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  panel: {
    width: '90%',
    maxWidth: 400,
    padding: 20,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  currentStats: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    padding: 10,
    backgroundColor: theme.isDark ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
  },
  buttonGroup: {
    gap: 12,
  },
  button: {
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  maxLevelButton: {
    backgroundColor: '#FF6B35',
  },
  customLevelContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontSize: 16,
  },
  customButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
  },
  xpButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  xpButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
  },
  resetButton: {
    backgroundColor: theme.colors.error,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  warning: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.7,
    fontStyle: 'italic',
  },
});
