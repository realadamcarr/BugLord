import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export interface EquippedCosmetics {
  hat: string | null;
  outfit: string | null; 
  accessory: string | null;
  background: string | null;
}

interface CharacterCustomizationContextType {
  equippedCosmetics: EquippedCosmetics;
  updateEquippedCosmetic: (type: keyof EquippedCosmetics, cosmeticId: string | null) => Promise<void>;
  resetToDefaults: (unlockedCosmetics: any[]) => Promise<void>;
}

const CharacterCustomizationContext = createContext<CharacterCustomizationContextType | undefined>(undefined);

export const CharacterCustomizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [equippedCosmetics, setEquippedCosmetics] = useState<EquippedCosmetics>({
    hat: null,
    outfit: null,
    accessory: null,
    background: null,
  });

  // Load equipped cosmetics on mount
  useEffect(() => {
    loadEquippedCosmetics();
  }, []);

  const loadEquippedCosmetics = async () => {
    try {
      const saved = await AsyncStorage.getItem('equippedCosmetics');
      if (saved) {
        setEquippedCosmetics(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading equipped cosmetics:', error);
    }
  };

  const saveEquippedCosmetics = async (newEquipped: EquippedCosmetics) => {
    try {
      await AsyncStorage.setItem('equippedCosmetics', JSON.stringify(newEquipped));
    } catch (error) {
      console.error('Error saving equipped cosmetics:', error);
    }
  };

  const updateEquippedCosmetic = async (type: keyof EquippedCosmetics, cosmeticId: string | null) => {
    const newEquipped = {
      ...equippedCosmetics,
      [type]: cosmeticId,
    };
    
    setEquippedCosmetics(newEquipped);
    await saveEquippedCosmetics(newEquipped);
  };

  // Reset to auto-equip the highest level cosmetics (useful when new cosmetics are unlocked)
  const resetToDefaults = async (unlockedCosmetics: any[]) => {
    const getHighestLevelCosmetic = (type: string) => {
      return unlockedCosmetics
        .filter(c => c.type === type)
        .sort((a, b) => b.unlockLevel - a.unlockLevel)[0]?.id || null;
    };

    const newEquipped: EquippedCosmetics = {
      hat: getHighestLevelCosmetic('hat'),
      outfit: getHighestLevelCosmetic('outfit'),
      accessory: getHighestLevelCosmetic('accessory'),
      background: getHighestLevelCosmetic('background'),
    };
    
    setEquippedCosmetics(newEquipped);
    await saveEquippedCosmetics(newEquipped);
  };

  const contextValue = useMemo(() => ({
    equippedCosmetics,
    updateEquippedCosmetic,
    resetToDefaults,
  }), [equippedCosmetics]);

  return (
    <CharacterCustomizationContext.Provider value={contextValue}>
      {children}
    </CharacterCustomizationContext.Provider>
  );
};

export const useCharacterCustomization = () => {
  const context = useContext(CharacterCustomizationContext);
  if (context === undefined) {
    throw new Error('useCharacterCustomization must be used within a CharacterCustomizationProvider');
  }
  return context;
};
