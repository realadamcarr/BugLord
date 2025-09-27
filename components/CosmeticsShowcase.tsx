import { COSMETICS, getNextUnlock, getUnlockedCosmetics, type Cosmetic } from '@/components/Character';
import { CharacterCustomizationModal } from '@/components/CharacterCustomizationModal';
import { SPRITE_ASSETS } from '@/components/SpriteAssets';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CosmeticsShowcaseProps {
  level: number;
}

export const CosmeticsShowcase: React.FC<CosmeticsShowcaseProps> = ({ level }) => {
  const { theme } = useTheme();
  const [showCustomization, setShowCustomization] = useState(false);
  const unlockedCosmetics = getUnlockedCosmetics(level);
  const nextUnlock = getNextUnlock(level);
  const styles = createStyles(theme);
  
  const groupedCosmetics = COSMETICS.reduce((acc, cosmetic) => {
    if (!acc[cosmetic.type]) {
      acc[cosmetic.type] = [];
    }
    acc[cosmetic.type].push(cosmetic);
    return acc;
  }, {} as Record<string, Cosmetic[]>);

  // Helper function to render cosmetic sprite or emoji
  const renderCosmeticIcon = (cosmetic: Cosmetic, isUnlocked: boolean, size: number = 30) => {
    if (!isUnlocked) {
      return (
        <ThemedText style={[styles.cosmeticEmoji, styles.lockedEmoji]}>
          🔒
        </ThemedText>
      );
    }

    try {
      let spriteSource: any = null;
      
      switch (cosmetic.type) {
        case 'hat':
          spriteSource = (SPRITE_ASSETS.hats as any)[cosmetic.spriteKey];
          break;
        case 'outfit':
          spriteSource = (SPRITE_ASSETS.outfits as any)[cosmetic.spriteKey];
          break;
        case 'accessory':
          spriteSource = (SPRITE_ASSETS.accessories as any)[cosmetic.spriteKey];
          break;
        case 'background':
          spriteSource = (SPRITE_ASSETS.backgrounds as any)[cosmetic.spriteKey];
          break;
      }
      
      if (spriteSource) {
        return (
          <Image
            source={spriteSource}
            style={{ width: size, height: size }}
            resizeMode="contain"
          />
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        console.log(`Sprite not found for ${cosmetic.spriteKey}, using emoji fallback:`, error.message);
      } else {
        console.log(`Sprite not found for ${cosmetic.spriteKey}, using emoji fallback`);
      }
    }

    // Fallback to emoji
    return (
      <ThemedText style={styles.cosmeticEmoji}>
        {cosmetic.emoji}
      </ThemedText>
    );
  };

  const renderCosmeticItem = (cosmetic: Cosmetic) => {
    const isUnlocked = level >= cosmetic.unlockLevel;
    const isNext = nextUnlock?.id === cosmetic.id;
    
    return (
      <View 
        key={cosmetic.id} 
        style={[
          styles.cosmeticItem,
          isUnlocked && styles.unlockedItem,
          isNext && styles.cosmeticItemHighlight
        ]}
      >
        <View style={styles.cosmeticIconContainer}>
          {renderCosmeticIcon(cosmetic, isUnlocked)}
        </View>
        <ThemedText style={[styles.cosmeticName, !isUnlocked && styles.lockedText]}>
          {cosmetic.name}
        </ThemedText>
        <ThemedText style={[styles.unlockLevel, isNext && styles.nextUnlockText]}>
          {isUnlocked ? '✓ Unlocked' : `Level ${cosmetic.unlockLevel}`}
        </ThemedText>
      </View>
    );
  };

  const renderCosmeticCategory = (type: string, cosmetics: Cosmetic[]) => {
    const categoryNames = {
      hat: '🎩 Hats',
      outfit: '👕 Outfits', 
      accessory: '👓 Accessories',
      background: '🌄 Backgrounds'
    };
    
    return (
      <ThemedView key={type} style={styles.categorySection}>
        <ThemedText style={styles.categoryTitle}>
          {categoryNames[type as keyof typeof categoryNames] || type}
        </ThemedText>
        <View style={styles.cosmeticsGrid}>
          {cosmetics
            .toSorted((a, b) => a.unlockLevel - b.unlockLevel)
            .map(renderCosmeticItem)}
        </View>
      </ThemedView>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <ThemedView style={styles.header}>
        <ThemedText style={styles.headerTitle}>Character Cosmetics</ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          Unlock new cosmetics by leveling up!
        </ThemedText>
        <View style={styles.headerActions}>
          <ThemedText style={styles.unlockedCount}>
            {unlockedCosmetics.length}/{COSMETICS.length} Unlocked
          </ThemedText>
          {unlockedCosmetics.length > 0 && (
            <TouchableOpacity 
              style={styles.customizeButton} 
              onPress={() => setShowCustomization(true)}
            >
              <Text style={styles.customizeButtonText}>✨ Customize</Text>
            </TouchableOpacity>
          )}
        </View>
      </ThemedView>

      {nextUnlock && (
        <ThemedView style={styles.nextUnlockSection}>
          <ThemedText style={styles.nextUnlockTitle}>🎯 Next Unlock</ThemedText>
          <View style={styles.nextUnlockCard}>
            <View style={styles.nextUnlockIconContainer}>
              {renderCosmeticIcon(nextUnlock, true, 40)}
            </View>
            <View style={styles.nextUnlockInfo}>
              <ThemedText style={styles.nextUnlockName}>{nextUnlock.name}</ThemedText>
              <ThemedText style={styles.nextUnlockLevel}>
                Unlock at Level {nextUnlock.unlockLevel}
              </ThemedText>
              <ThemedText style={styles.nextUnlockProgress}>
                {level}/{nextUnlock.unlockLevel} ({nextUnlock.unlockLevel - level} levels to go)
              </ThemedText>
            </View>
          </View>
        </ThemedView>
      )}

      {Object.entries(groupedCosmetics).map(([type, cosmetics]) =>
        renderCosmeticCategory(type, cosmetics)
      )}

      <CharacterCustomizationModal
        visible={showCustomization}
        onClose={() => setShowCustomization(false)}
        level={level}
      />
    </ScrollView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: theme.isDark ? 'rgba(10, 132, 255, 0.15)' : 'rgba(0, 122, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 8,
  },
  unlockedCount: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.success,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  customizeButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  customizeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  nextUnlockSection: {
    padding: 16,
    marginBottom: 24,
    borderRadius: 12,
    backgroundColor: theme.isDark ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255, 215, 0, 0.1)',
    borderWidth: 2,
    borderColor: theme.isDark ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255, 215, 0, 0.3)',
  },
  nextUnlockTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  nextUnlockCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextUnlockIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    width: 50,
    height: 50,
  },
  nextUnlockEmoji: {
    fontSize: 40,
    marginRight: 16,
  },
  nextUnlockInfo: {
    flex: 1,
  },
  nextUnlockName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  nextUnlockLevel: {
    fontSize: 14,
    color: '#FF8C00',
    fontWeight: '600',
    marginBottom: 2,
  },
  nextUnlockProgress: {
    fontSize: 12,
    opacity: 0.7,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  cosmeticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cosmeticItem: {
    width: '48%',
    padding: 12,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  cosmeticIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    height: 40,
  },
  unlockedItem: {
    backgroundColor: theme.isDark ? 'rgba(50, 215, 75, 0.15)' : 'rgba(76, 175, 80, 0.1)',
    borderColor: theme.colors.success,
  },
  cosmeticItemHighlight: {
    backgroundColor: theme.isDark ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255, 215, 0, 0.1)',
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  cosmeticEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  lockedEmoji: {
    opacity: 0.3,
  },
  cosmeticName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  lockedText: {
    opacity: 0.5,
  },
  unlockLevel: {
    fontSize: 12,
    textAlign: 'center',
    color: theme.colors.textSecondary,
  },
  nextUnlockText: {
    color: '#FF8C00',
    fontWeight: 'bold',
  },
});
