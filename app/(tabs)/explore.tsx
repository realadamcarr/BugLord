import { AdminPanel } from '@/components/AdminPanel';
import { Character } from '@/components/Character';
import { CosmeticsShowcase } from '@/components/CosmeticsShowcase';
import { EnhancedStatCard } from '@/components/EnhancedStatCard';
import { TabSelector } from '@/components/TabSelector';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { XPProgressBar } from '@/components/XPProgressBar';
import { useTheme } from '@/contexts/ThemeContext';
import { useUserProgress } from '@/contexts/UserProgressContext';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  isCompleted: boolean;
  xpReward: number;
}

interface UserProgress {
  level: number;
  xp: number;
  totalXp: number;
}

export default function StatsScreen() {
  const { theme } = useTheme();
  const { userProgress, notes } = useUserProgress();
  const [activeTab, setActiveTab] = useState<'stats' | 'cosmetics'>('stats');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTapCount, setAdminTapCount] = useState(0);
  const [stats, setStats] = useState({
    totalNotes: 0,
    completedNotes: 0,
    pendingNotes: 0,
    totalXpEarned: 0,
    averageXpPerNote: 0,
  });

  const styles = createStyles(theme);

  useEffect(() => {
    calculateStats();
  }, [notes, userProgress]);

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

  useEffect(() => {
    calculateStats();
  }, [notes, userProgress]);

  const calculateStats = () => {
    const totalNotes = notes.length;
    const completedNotes = notes.filter(note => note.isCompleted).length;
    const pendingNotes = totalNotes - completedNotes;
    const totalXpEarned = userProgress.totalXp;
    const averageXpPerNote = completedNotes > 0 ? Math.round(totalXpEarned / completedNotes) : 0;

    setStats({
      totalNotes,
      completedNotes,
      pendingNotes,
      totalXpEarned,
      averageXpPerNote,
    });
  };

  const calculateXpForNextLevel = (level: number) => level * 100;
  const xpForNextLevel = calculateXpForNextLevel(userProgress.level);

  const getInsightMessage = (completedNotes: number, pendingNotes: number): string => {
    if (completedNotes === 0) {
      return "Complete your first note to start earning XP! 🚀";
    }
    if (pendingNotes === 0) {
      return "All caught up! Great work keeping your notes organized! 🎉";
    }
    return `You have ${pendingNotes} pending notes. Complete them to level up faster! 💪`;
  };

  const tabOptions = [
    { id: 'stats', label: 'Stats', icon: '📊' },
    { id: 'cosmetics', label: 'Cosmetics', icon: '👕' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <ThemedView style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <ThemedText style={styles.headerTitle}>Character Profile</ThemedText>
            <ThemedText style={styles.headerSubtitle}>Track your note-taking journey 🚀</ThemedText>
          </View>
        </View>
        
        {/* Character Display */}
        <View style={styles.characterSection}>
          <Character level={userProgress.level} size="large" />
        </View>
        
        {/* Tab Selector */}
        <TabSelector
          tabs={tabOptions}
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as 'stats' | 'cosmetics')}
        />
      </ThemedView>

      {activeTab === 'stats' ? (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          {/* Level Progress */}
          <ThemedView style={styles.levelCard}>
            <View style={styles.levelHeader}>
              <ThemedText style={styles.levelEmoji}>⭐</ThemedText>
              <View style={styles.levelInfo}>
                <TouchableOpacity onPress={handleAdminTap} activeOpacity={0.7}>
                  <ThemedText style={styles.levelText}>Level {userProgress.level}</ThemedText>
                </TouchableOpacity>
                <ThemedText style={styles.xpText}>Progress to next level</ThemedText>
              </View>
            </View>
            <XPProgressBar
              currentXP={userProgress.xp}
              maxXP={xpForNextLevel}
              level={userProgress.level}
              animated={true}
              showTooltip={true}
            />
            <ThemedText style={styles.totalXpText}>Total XP Earned: {userProgress.totalXp}</ThemedText>
          </ThemedView>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <EnhancedStatCard
              title="Total Notes"
              value={stats.totalNotes}
              icon="📝"
              color="#007AFF"
              subtitle="All notes created"
            />
            <EnhancedStatCard
              title="Completed"
              value={stats.completedNotes}
              icon="✅"
              color="#4CAF50"
              subtitle="Tasks finished"
              trend={stats.completedNotes > stats.pendingNotes ? 'up' : 'neutral'}
            />
            <EnhancedStatCard
              title="Pending"
              value={stats.pendingNotes}
              icon="⏳"
              color="#FF9800"
              subtitle="To be completed"
            />
            <EnhancedStatCard
              title="Avg XP/Note"
              value={stats.averageXpPerNote}
              icon="⚡"
              color="#9C27B0"
              subtitle="Points per task"
            />
          </View>

          {/* Achievement Levels */}
          <ThemedView style={styles.achievementSection}>
            <ThemedText style={styles.sectionTitle}>🏆 Level Milestones</ThemedText>
            <View style={styles.achievementGrid}>
              {[1, 2, 3, 4, 5, 10, 15, 20].map(level => {
                const isUnlocked = userProgress.level >= level;
                const isCurrent = userProgress.level === level;
                return (
                  <View key={level} style={[
                    styles.achievementItem,
                    isUnlocked && styles.unlockedAchievement,
                    isCurrent && styles.currentLevel
                  ]}>
                    <ThemedText style={styles.achievementIcon}>
                      {isUnlocked ? '⭐' : '☆'}
                    </ThemedText>
                    <ThemedText style={[
                      styles.achievementText,
                      isUnlocked && styles.unlockedText,
                      isCurrent && styles.currentLevelText
                    ]}>
                      Level {level} {isCurrent && '(Current)'}
                    </ThemedText>
                    {isUnlocked && !isCurrent && (
                      <ThemedText style={styles.checkmark}>✓</ThemedText>
                    )}
                  </View>
                );
              })}
            </View>
          </ThemedView>

          {/* Progress Insights */}
          <ThemedView style={styles.insightsSection}>
            <ThemedText style={styles.sectionTitle}>💡 Progress Insights</ThemedText>
            <View style={styles.insightCard}>
              <ThemedText style={styles.insightText}>
                {getInsightMessage(stats.completedNotes, stats.pendingNotes)}
              </ThemedText>
            </View>
            {userProgress.level >= 5 && (
              <View style={styles.insightCard}>
                <ThemedText style={styles.insightText}>
                  🌟 Achievement unlocked: Dedicated Note Taker! You've reached Level {userProgress.level}!
                </ThemedText>
              </View>
            )}
          </ThemedView>
        </ScrollView>
      ) : (
        <CosmeticsShowcase level={userProgress.level} />
      )}

      {/* Admin Panel */}
      <AdminPanel 
        visible={showAdminPanel} 
        onClose={() => setShowAdminPanel(false)} 
      />
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surface,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: theme.isDark ? 0.3 : 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 4,
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 20,
    fontWeight: '500',
  },
  characterSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  levelCard: {
    padding: 20,
    marginTop: 16,
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: theme.isDark ? 0.3 : 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  levelEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  levelInfo: {
    flex: 1,
  },
  levelText: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  xpText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  totalXpText: {
    textAlign: 'center',
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 8,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  achievementSection: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    marginBottom: 20,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: theme.isDark ? 0.3 : 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
    color: theme.colors.text,
  },
  achievementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  achievementItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
  },
  unlockedAchievement: {
    backgroundColor: theme.isDark ? 'rgba(50, 215, 75, 0.15)' : 'rgba(76, 175, 80, 0.1)',
  },
  currentLevel: {
    backgroundColor: theme.isDark ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  achievementIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  achievementText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    color: theme.colors.textSecondary,
  },
  unlockedText: {
    color: theme.colors.success,
  },
  currentLevelText: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  checkmark: {
    fontSize: 14,
    color: theme.colors.success,
  },
  insightsSection: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    marginBottom: 20,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: theme.isDark ? 0.3 : 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  insightCard: {
    backgroundColor: theme.isDark ? 'rgba(10, 132, 255, 0.1)' : 'rgba(0, 122, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  insightText: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.text,
    fontWeight: '500',
  },
});
