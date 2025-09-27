import { SPRITE_ASSETS, SPRITES_ENABLED } from '@/components/SpriteAssets';
import { ThemedText } from '@/components/ThemedText';
import { useCharacterCustomization } from '@/contexts/CharacterCustomizationContext';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface CharacterProps {
  level: number;
  size?: 'small' | 'medium' | 'large';
}

interface Cosmetic {
  id: string;
  type: 'hat' | 'outfit' | 'accessory' | 'background';
  name: string;
  unlockLevel: number;
  emoji: string;
  spriteKey: string; // Key to find sprite in SPRITE_ASSETS
}

const COSMETICS: Cosmetic[] = [
  // Hats
  { id: 'hat_cap', type: 'hat', name: 'Baseball Cap', unlockLevel: 2, emoji: '🧢', spriteKey: 'hat_cap' },
  { id: 'hat_crown', type: 'hat', name: 'Crown', unlockLevel: 5, emoji: '👑', spriteKey: 'hat_crown' },
  { id: 'hat_wizard', type: 'hat', name: 'Wizard Hat', unlockLevel: 10, emoji: '🎩', spriteKey: 'hat_wizard' },
  { id: 'hat_party', type: 'hat', name: 'Party Hat', unlockLevel: 15, emoji: '🎉', spriteKey: 'hat_party' },
  
  // Outfits
  { id: 'outfit_casual', type: 'outfit', name: 'Casual Wear', unlockLevel: 3, emoji: '👕', spriteKey: 'outfit_casual' },
  { id: 'outfit_formal', type: 'outfit', name: 'Formal Suit', unlockLevel: 7, emoji: '🤵', spriteKey: 'outfit_formal' },
  { id: 'outfit_superhero', type: 'outfit', name: 'Superhero Cape', unlockLevel: 12, emoji: '🦸', spriteKey: 'outfit_superhero' },
  { id: 'outfit_ninja', type: 'outfit', name: 'Ninja Outfit', unlockLevel: 18, emoji: '🥷', spriteKey: 'outfit_ninja' },
  
  // Accessories
  { id: 'acc_sunglasses', type: 'accessory', name: 'Cool Sunglasses', unlockLevel: 4, emoji: '😎', spriteKey: 'acc_sunglasses' },
  { id: 'acc_briefcase', type: 'accessory', name: 'Briefcase', unlockLevel: 8, emoji: '💼', spriteKey: 'acc_briefcase' },
  { id: 'acc_trophy', type: 'accessory', name: 'Trophy', unlockLevel: 20, emoji: '🏆', spriteKey: 'acc_trophy' },
  
  // Backgrounds
  { id: 'bg_forest', type: 'background', name: 'Forest', unlockLevel: 6, emoji: '🌲', spriteKey: 'bg_forest' },
  { id: 'bg_city', type: 'background', name: 'City', unlockLevel: 11, emoji: '🏙️', spriteKey: 'bg_city' },
  { id: 'bg_space', type: 'background', name: 'Space', unlockLevel: 16, emoji: '🌌', spriteKey: 'bg_space' },
];

export const getUnlockedCosmetics = (level: number): Cosmetic[] => {
  return COSMETICS.filter(cosmetic => level >= cosmetic.unlockLevel);
};

export const getNextUnlock = (level: number): Cosmetic | null => {
  const nextUnlocks = COSMETICS.filter(cosmetic => level < cosmetic.unlockLevel)
    .sort((a, b) => a.unlockLevel - b.unlockLevel);
  return nextUnlocks[0] || null;
};

// Helper function to render hat with proper sizing and positioning
const renderHat = (cosmetic: Cosmetic | null, size: string, style: any, fallbackStyle?: any) => {
  if (!cosmetic) return null;

  // Hat sizing - made smaller for better proportions
  const hatSizeMap = {
    small: 25,   // Reduced from 35
    medium: 45,  // Reduced from 60
    large: 60    // Reduced from 80
  };

  // Only try to load sprites if they're enabled
  if (SPRITES_ENABLED) {
    try {
      const spriteSource = (SPRITE_ASSETS.hats as any)[cosmetic.spriteKey];
      
      if (spriteSource) {
        return (
          <Image
            source={spriteSource}
            style={[style, { 
              width: hatSizeMap[size as keyof typeof hatSizeMap], 
              height: hatSizeMap[size as keyof typeof hatSizeMap] 
            }]}
            resizeMode="contain"
          />
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        console.log(`Hat sprite not found for ${cosmetic.spriteKey}, using emoji fallback:`, error.message);
      } else {
        console.log(`Hat sprite not found for ${cosmetic.spriteKey}, using emoji fallback`);
      }
    }
  }

  // Fallback to emoji
  return (
    <ThemedText style={fallbackStyle || style}>
      {cosmetic.emoji}
    </ThemedText>
  );
};
const renderCosmetic = (cosmetic: Cosmetic | null, size: string, style: any, fallbackStyle?: any) => {
  if (!cosmetic) return null;

  // Background sizing - fills the entire character container
  const backgroundSizeMap = {
    small: 60,   // Matches character container size
    medium: 100, // Matches character container size  
    large: 140   // Matches character container size
  };

  // Regular cosmetic sizing (for outfits and accessories)
  const sizeMap = {
    small: 25,   // Reduced from 30
    medium: 40,  // Reduced from 50  
    large: 55    // Reduced from 70
  };

  // Choose the appropriate size map based on cosmetic type
  const currentSizeMap = cosmetic.type === 'background' ? backgroundSizeMap : sizeMap;

  // Only try to load sprites if they're enabled
  if (SPRITES_ENABLED) {
    try {
      // Try to get the sprite from SPRITE_ASSETS
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
            style={[style, { width: currentSizeMap[size as keyof typeof currentSizeMap], height: currentSizeMap[size as keyof typeof currentSizeMap] }]}
            resizeMode="contain"
          />
        );
      }
    } catch (error) {
      // If sprite loading fails, fall back to emoji
      if (error instanceof Error) {
        console.log(`Sprite not found for ${cosmetic.spriteKey}, using emoji fallback:`, error.message);
      } else {
        console.log(`Sprite not found for ${cosmetic.spriteKey}, using emoji fallback`);
      }
    }
  }

  // Fallback to emoji
  return (
    <ThemedText style={fallbackStyle || style}>
      {cosmetic.emoji}
    </ThemedText>
  );
};

// Helper function to render base character (always default.png)
const renderBaseCharacter = (size: string, emojiSize: number, styles: any) => {
  const sizeMap = {
    small: 50,   // Increased from 40 (+10px)
    medium: 80,  // Increased from 60 (+20px)
    large: 110   // Increased from 80 (+30px)
  };

  // Only try to load sprites if they're enabled
  if (SPRITES_ENABLED) {
    try {
      // Always try to show default character sprite
      const defaultSprite = (SPRITE_ASSETS.characters as any)?.default;
      if (defaultSprite) {
        return (
          <Image
            source={defaultSprite}
            style={{ width: sizeMap[size as keyof typeof sizeMap], height: sizeMap[size as keyof typeof sizeMap] }}
            resizeMode="contain"
          />
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        console.log('Character sprite not found, using emoji fallback:', error.message);
      } else {
        console.log('Character sprite not found, using emoji fallback');
      }
    }
  }

  // Fallback to emoji
  return (
    <ThemedText style={[styles.characterEmoji, { fontSize: emojiSize * 1.5 }]}>
      🧑
    </ThemedText>
  );
};

export const Character: React.FC<CharacterProps> = ({ level, size = 'medium' }) => {
  const { theme } = useTheme();
  const { equippedCosmetics, resetToDefaults } = useCharacterCustomization();
  const unlockedCosmetics = getUnlockedCosmetics(level);
  
  // Auto-equip highest level cosmetics for new users or when new cosmetics are unlocked
  useEffect(() => {
    const hasEquippedAny = Object.values(equippedCosmetics).some(id => id !== null);
    if (!hasEquippedAny && unlockedCosmetics.length > 0) {
      resetToDefaults(unlockedCosmetics);
    }
  }, [unlockedCosmetics.length, equippedCosmetics, resetToDefaults]);
  
  // Get equipped cosmetics by their IDs
  const equippedHat = equippedCosmetics.hat 
    ? unlockedCosmetics.find(c => c.id === equippedCosmetics.hat) || null
    : null;
    
  const equippedOutfit = equippedCosmetics.outfit 
    ? unlockedCosmetics.find(c => c.id === equippedCosmetics.outfit) || null
    : null;
    
  const equippedAccessory = equippedCosmetics.accessory 
    ? unlockedCosmetics.find(c => c.id === equippedCosmetics.accessory) || null
    : null;
    
  const equippedBackground = equippedCosmetics.background 
    ? unlockedCosmetics.find(c => c.id === equippedCosmetics.background) || null
    : null;

  const sizeStyles = {
    small: { width: 60, height: 60 },
    medium: { width: 100, height: 100 },
    large: { width: 140, height: 140 }
  };

  const emojiSizes = {
    small: 12,
    medium: 20,
    large: 28
  };

  // Calculate positioning values - hat positioned lower on character
  let hatTopOffset = 0;      // Lowered from -5 (moved down 5px)
  let accessoryTopOffset = 0;    // New: vertical positioning for accessories
  let accessoryLeftOffset = 8;   // New: left positioning for briefcase/trophy (positive to stay inside)
  let levelFontSize = 10;
  
  if (size === 'small') {
    hatTopOffset = 12;        // Lowered from -3 (moved down 5px)
    accessoryTopOffset = 0;   // Sunglasses positioning for small (centered)
    accessoryLeftOffset = 5;  // Left positioning for small (positive to stay inside)
    levelFontSize = 8;
  } else if (size === 'large') {
    hatTopOffset = 7;         // Lowered from -8 (moved down 5px)
    accessoryTopOffset = 0;   // Sunglasses positioning for large (centered)
    accessoryLeftOffset = 12; // Left positioning for large (positive to stay inside)
    levelFontSize = 12;
  }

  const styles = createStyles(theme);

  return (
    <View style={[styles.characterContainer, sizeStyles[size]]}>
      {/* Background */}
      {equippedBackground && (
        <View style={styles.backgroundContainer}>
          {renderCosmetic(
            equippedBackground, 
            size, 
            styles.backgroundSprite,
            [styles.backgroundEmoji, { fontSize: emojiSizes[size] * 3 }]
          )}
        </View>
      )}
      
      {/* Base Character */}
      <View style={styles.characterBase}>
        {/* Default Character (always shown) */}
        {renderBaseCharacter(size, emojiSizes[size], styles)}
        
        {/* Outfit Layer (over default character) */}
        {equippedOutfit && (
          <View style={styles.outfitContainer}>
            {renderCosmetic(
              equippedOutfit, 
              size, 
              styles.outfitSprite,
              [styles.outfitEmoji, { fontSize: emojiSizes[size] * 1.2 }]
            )}
          </View>
        )}
        
        {/* Hat */}
        {equippedHat && (
          <View style={[styles.hatContainer, { top: hatTopOffset }]}>
            {renderHat(
              equippedHat, 
              size, 
              styles.hatSprite,
              [styles.hatEmoji, { fontSize: emojiSizes[size] }]
            )}
          </View>
        )}
        
        {/* Accessory */}
        {equippedAccessory && (
          <View style={[
            styles.accessoryContainer, 
            equippedAccessory.id === 'acc_sunglasses' ? {
              // Sunglasses: centered both horizontally and vertically on character's face
              top: accessoryTopOffset,
              alignSelf: 'center',
              width: '100%',
            } : {
              // Briefcase/Trophy: positioned to the left inside the container
              bottom: 8,  // Slightly above bottom, inside container
              left: accessoryLeftOffset, // Positive value to stay inside
              width: 30,  // Fixed width to contain the accessory
            }
          ]}>
            {renderCosmetic(
              equippedAccessory, 
              size, 
              styles.accessorySprite,
              [styles.accessoryEmoji, { fontSize: emojiSizes[size] * 0.8 }]
            )}
          </View>
        )}
      </View>
      
      {/* Level Badge */}
      <View style={styles.levelBadge}>
        <ThemedText style={[styles.levelText, { fontSize: levelFontSize }]}>
          Lv.{level}
        </ThemedText>
      </View>
    </View>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  characterContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: theme.isDark ? 'rgba(10, 132, 255, 0.1)' : 'rgba(0, 122, 255, 0.05)',
    borderWidth: 2,
    borderColor: theme.isDark ? 'rgba(10, 132, 255, 0.3)' : 'rgba(0, 122, 255, 0.2)',
  },
  backgroundContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,    // Added to match characterContainer's border radius
    overflow: 'hidden',  // Ensures background stays within rounded corners
  },
  backgroundSprite: {
    position: 'absolute',
    opacity: 0.3,
  },
  backgroundEmoji: {
    position: 'absolute',
    opacity: 0.3,
  },
  characterBase: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterEmoji: {
    textAlign: 'center',
  },
  outfitContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitSprite: {
    position: 'absolute',
  },
  outfitEmoji: {
    position: 'absolute',
    textAlign: 'center',
  },
  hatContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',  // Full width to ensure centering
  },
  hatSprite: {
    position: 'absolute',
    zIndex: 10,     // Ensure hat appears above other elements
  },
  hatEmoji: {
    position: 'absolute',
    textAlign: 'center',
    zIndex: 10,     // Ensure hat appears above other elements
  },
  accessoryContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessorySprite: {
    position: 'absolute',
  },
  accessoryEmoji: {
    position: 'absolute',
    bottom: 0,
  },
  levelBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: theme.colors.success,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: theme.colors.surface,
  },
  levelText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export { COSMETICS };
export type { Cosmetic };

