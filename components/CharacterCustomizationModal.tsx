import { getUnlockedCosmetics, type Cosmetic } from '@/components/Character';
import { SPRITE_ASSETS } from '@/components/SpriteAssets';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useCharacterCustomization } from '@/contexts/CharacterCustomizationContext';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface CharacterCustomizationModalProps {
  visible: boolean;
  onClose: () => void;
  level: number;
}

export const CharacterCustomizationModal: React.FC<CharacterCustomizationModalProps> = ({ 
  visible, 
  onClose, 
  level 
}) => {
  const { theme } = useTheme();
  const { equippedCosmetics, updateEquippedCosmetic, resetToDefaults } = useCharacterCustomization();
  const [activeCategory, setActiveCategory] = useState<'hat' | 'outfit' | 'accessory' | 'background'>('hat');
  const styles = createStyles(theme);
  
  const unlockedCosmetics = getUnlockedCosmetics(level);
  
  const categories = [
    { id: 'hat' as const, label: 'Hats', icon: '🎩' },
    { id: 'outfit' as const, label: 'Outfits', icon: '👕' },
    { id: 'accessory' as const, label: 'Accessories', icon: '👓' },
    { id: 'background' as const, label: 'Backgrounds', icon: '🌄' },
  ];

  const getCosmeticsForCategory = (category: string) => {
    return unlockedCosmetics.filter(cosmetic => cosmetic.type === category);
  };

  const renderCosmeticIcon = (cosmetic: Cosmetic, size: number = 40) => {
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
      <ThemedText style={{ fontSize: size * 0.8, textAlign: 'center' }}>
        {cosmetic.emoji}
      </ThemedText>
    );
  };

  const handleCosmeticSelect = async (cosmetic: Cosmetic) => {
    await updateEquippedCosmetic(cosmetic.type, cosmetic.id);
  };

  const handleRemoveCosmetic = async (type: 'hat' | 'outfit' | 'accessory' | 'background') => {
    await updateEquippedCosmetic(type, null);
  };

  const handleResetToDefaults = async () => {
    await resetToDefaults(unlockedCosmetics);
  };

  const renderCategoryTab = (category: typeof categories[0]) => {
    const isActive = activeCategory === category.id;
    const hasEquipped = equippedCosmetics[category.id] !== null;
    
    return (
      <TouchableOpacity
        key={category.id}
        style={[styles.categoryTab, isActive && styles.activeCategoryTab]}
        onPress={() => setActiveCategory(category.id)}
      >
        <Text style={[styles.categoryTabIcon, isActive && styles.activeCategoryTabIcon]}>
          {category.icon}
        </Text>
        <Text style={[styles.categoryTabLabel, isActive && styles.activeCategoryTabLabel]}>
          {category.label}
        </Text>
        {hasEquipped && <View style={styles.equippedIndicator} />}
      </TouchableOpacity>
    );
  };

  const renderCosmeticItem = (cosmetic: Cosmetic) => {
    const isEquipped = equippedCosmetics[cosmetic.type] === cosmetic.id;
    
    return (
      <TouchableOpacity
        key={cosmetic.id}
        style={[styles.cosmeticItem, isEquipped && styles.equippedCosmeticItem]}
        onPress={() => handleCosmeticSelect(cosmetic)}
      >
        <View style={styles.cosmeticIconContainer}>
          {renderCosmeticIcon(cosmetic)}
        </View>
        <ThemedText style={[styles.cosmeticName, isEquipped && styles.equippedCosmeticName]}>
          {cosmetic.name}
        </ThemedText>
        <ThemedText style={styles.cosmeticLevel}>
          Level {cosmetic.unlockLevel}
        </ThemedText>
        {isEquipped && (
          <View style={styles.equippedBadge}>
            <Text style={styles.equippedBadgeText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const activeCategoryCosmetics = getCosmeticsForCategory(activeCategory);
  const hasEquippedInCategory = equippedCosmetics[activeCategory] !== null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Customize Character</ThemedText>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.resetButton} onPress={handleResetToDefaults}>
            <Text style={styles.resetButtonText}>🔄 Auto-Equip Best</Text>
          </TouchableOpacity>
        </View>

        {/* Category Tabs */}
        <View style={styles.categoryTabs}>
          {categories.map(renderCategoryTab)}
        </View>

        {/* Active Category Header */}
        <View style={styles.categoryHeader}>
          <ThemedText style={styles.categoryHeaderTitle}>
            {categories.find(c => c.id === activeCategory)?.icon} {categories.find(c => c.id === activeCategory)?.label}
          </ThemedText>
          {hasEquippedInCategory && (
            <TouchableOpacity 
              style={styles.removeButton} 
              onPress={() => handleRemoveCosmetic(activeCategory)}
            >
              <Text style={styles.removeButtonText}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Cosmetics Grid */}
        <ScrollView style={styles.cosmeticsContainer} showsVerticalScrollIndicator={false}>
          {activeCategoryCosmetics.length > 0 ? (
            <View style={styles.cosmeticsGrid}>
              {activeCategoryCosmetics
                .sort((a, b) => a.unlockLevel - b.unlockLevel)
                .map(renderCosmeticItem)}
            </View>
          ) : (
            <ThemedView style={styles.emptyCategoryContainer}>
              <ThemedText style={styles.emptyCategoryTitle}>No {categories.find(c => c.id === activeCategory)?.label} Unlocked</ThemedText>
              <ThemedText style={styles.emptyCategorySubtitle}>
                Level up to unlock cosmetics in this category!
              </ThemedText>
            </ThemedView>
          )}
        </ScrollView>
      </ThemedView>
    </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'center',
  },
  resetButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  resetButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  categoryTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  categoryTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    position: 'relative',
  },
  activeCategoryTab: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryTabIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  activeCategoryTabIcon: {
    opacity: 1,
  },
  categoryTabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  activeCategoryTabLabel: {
    color: '#fff',
  },
  equippedIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  categoryHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  removeButton: {
    backgroundColor: theme.colors.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cosmeticsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  cosmeticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 16,
  },
  cosmeticItem: {
    width: '48%',
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    position: 'relative',
  },
  equippedCosmeticItem: {
    borderColor: theme.colors.success,
    backgroundColor: theme.isDark ? 'rgba(50, 215, 75, 0.15)' : 'rgba(76, 175, 80, 0.1)',
  },
  cosmeticIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    height: 50,
  },
  cosmeticName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  equippedCosmeticName: {
    color: theme.colors.success,
  },
  cosmeticLevel: {
    fontSize: 12,
    textAlign: 'center',
    color: theme.colors.textSecondary,
  },
  equippedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  equippedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyCategoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyCategoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyCategorySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
});
