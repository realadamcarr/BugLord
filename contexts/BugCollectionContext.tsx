import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { BugCategory } from '../constants/bugSprites';
import { Bug, BugCollection, generateBugStats, RARITY_CONFIG } from '../types/Bug';
import { labelToCategory } from '../utils/bugCategory';

/**
 * Derive a BugCategory from any available text field on the bug.
 * Tries: confirmedLabel → userConfirmedLabel → top predicted candidate → name → species.
 */
function deriveBugCategory(bug: any): BugCategory | undefined {
  const fields: string[] = [
    bug.confirmedLabel,
    bug.userConfirmedLabel,
    bug.predictedCandidates?.[0]?.label,
    bug.name,
    bug.species,
  ].filter(Boolean);

  for (const text of fields) {
    const cat = labelToCategory(text);
    if (cat) return cat;
  }
  return undefined;
}

interface BugCollectionContextType {
  collection: BugCollection;
  addBugToCollection: (bug: Omit<Bug, 'id' | 'caughtAt'> & Partial<Pick<Bug, 'level' | 'xp' | 'maxXp'>>) => Promise<Bug>;
  /** Add a traded bug to the local collection using its Firestore ID (so future trades work correctly). */
  receiveTradedBug: (firestoreId: string, bugData: Omit<Bug, 'id' | 'caughtAt'>) => Promise<Bug>;
  addBugToParty: (bug: Bug, slot?: number) => boolean;
  removeBugFromParty: (slot: number) => void;
  swapPartySlots: (from: number, to: number) => void;
  switchParty: (index: number) => void;
  updateBugNickname: (bugId: string, nickname: string) => void;
  addXpToBug: (bugId: string, xpAmount: number) => Promise<boolean>;
  updateBugHp: (bugId: string, currentHp: number) => Promise<boolean>;
  releaseBug: (bugId: string) => void;
  gainXP: (amount: number) => void;
  setProfilePicture: (key: string) => void;
  loading: boolean;
}

const BugCollectionContext = createContext<BugCollectionContextType | undefined>(undefined);

const STORAGE_KEY = 'bug_collection_data';
const COLLECTION_VERSION = '1.0';

const EMPTY_PARTY: (Bug | null)[] = [null, null, null, null, null, null];

const DEFAULT_COLLECTION: BugCollection = {
  bugs: [],
  party: [null, null, null, null, null, null],
  parties: [
    [null, null, null, null, null, null],
    [null, null, null, null, null, null],
    [null, null, null, null, null, null],
  ],
  activePartyIndex: 0,
  totalXp: 0,
  level: 1,
  xp: 0,
  profilePicture: 'default',
};

export const useBugCollection = (): BugCollectionContextType => {
  const context = useContext(BugCollectionContext);
  if (!context) {
    throw new Error('useBugCollection must be used within a BugCollectionProvider');
  }
  return context;
};

interface BugCollectionProviderProps {
  children: React.ReactNode;
}

export const BugCollectionProvider: React.FC<BugCollectionProviderProps> = ({ children }) => {
  const [collection, setCollection] = useState<BugCollection>(DEFAULT_COLLECTION);
  const [loading, setLoading] = useState(true);

  // Load collection from storage on mount
  useEffect(() => {
    loadCollection();
  }, []);

  // Save collection whenever it changes
  useEffect(() => {
    if (!loading) {
      saveCollection();
    }
  }, [collection, loading]);

  const loadCollection = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        
        // Convert date strings back to Date objects
        if (parsed.bugs) {
          parsed.bugs = parsed.bugs.map((bug: any) => ({
            ...bug,
            caughtAt: new Date(bug.caughtAt),
          }));
        }
        
        // --- Migration: single party → multi-party ---
        const ensureSixSlots = (p: any): (Bug | null)[] => {
          if (!p || !Array.isArray(p)) return [...EMPTY_PARTY];
          while (p.length < 6) p.push(null);
          return p.slice(0, 6);
        };

        if (!parsed.parties || !Array.isArray(parsed.parties)) {
          // Old format: migrate existing party to parties[0]
          const oldParty = ensureSixSlots(parsed.party);
          parsed.parties = [
            oldParty,
            [...EMPTY_PARTY],
            [...EMPTY_PARTY],
          ];
          parsed.activePartyIndex = 0;
        } else {
          // Ensure we have exactly 3 parties with 6 slots each
          while (parsed.parties.length < 3) parsed.parties.push([...EMPTY_PARTY]);
          parsed.parties = parsed.parties.slice(0, 3).map(ensureSixSlots);
          if (parsed.activePartyIndex == null || parsed.activePartyIndex < 0 || parsed.activePartyIndex > 2) {
            parsed.activePartyIndex = 0;
          }
        }

        // Keep party in sync with active party
        parsed.party = parsed.parties[parsed.activePartyIndex];

        // --- Migration: back-fill category + battle stats for bugs that don't have them ---
        const migrateBug = (bug: any) => {
          let changed = false;
          const updates: any = {};
          if (!bug.category) {
            const cat = deriveBugCategory(bug);
            if (cat) { updates.category = cat; changed = true; }
          }
          if (bug.attack == null || bug.defense == null || bug.speed == null) {
            const stats = generateBugStats(bug.rarity || 'common');
            if (bug.attack == null) { updates.attack = stats.attack; changed = true; }
            if (bug.defense == null) { updates.defense = stats.defense; changed = true; }
            if (bug.speed == null) { updates.speed = stats.speed; changed = true; }
          }
          return changed ? { ...bug, ...updates } : bug;
        };
        if (parsed.bugs) {
          parsed.bugs = parsed.bugs.map(migrateBug);
        }
        // Migrate bugs in all parties
        parsed.parties = parsed.parties.map((p: any[]) =>
          p.map((bug: any) => bug ? migrateBug(bug) : bug)
        );
        // Keep party in sync after migration
        parsed.party = parsed.parties[parsed.activePartyIndex];
        
        setCollection({ ...DEFAULT_COLLECTION, ...parsed });
      }
    } catch (error) {
      console.warn('Failed to load bug collection:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCollection = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...collection,
        version: COLLECTION_VERSION,
      }));
    } catch (error) {
      console.warn('Failed to save bug collection:', error);
    }
  };

  const generateBugId = (): string => {
    return 'bug_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  const addBugToCollection = async (
    bugData: Omit<Bug, 'id' | 'caughtAt'> & Partial<Pick<Bug, 'level' | 'xp' | 'maxXp'>>
  ): Promise<Bug> => {
    const stats = generateBugStats(bugData.rarity);
    const level = bugData.level ?? 1;
    const xp = bugData.xp ?? 0;
    const maxXp = bugData.maxXp ?? stats.maxXp;
    const hpForLevel = Math.floor(stats.maxXp * (1 + (level - 1) * 0.2));
    const newBug: Bug = {
      ...bugData,
      id: generateBugId(),
      caughtAt: new Date(),
      level,
      xp,
      maxXp,
      maxHp: bugData.maxHp ?? hpForLevel,
      currentHp: bugData.currentHp ?? hpForLevel,
      attack: bugData.attack ?? stats.attack,
      defense: bugData.defense ?? stats.defense,
      speed: bugData.speed ?? stats.speed,
    };

    setCollection(prev => ({
      ...prev,
      bugs: [...prev.bugs, newBug],
    }));

    // Gain XP for catching the bug
    const xpReward = RARITY_CONFIG[newBug.rarity].xpRange[0];
    gainXP(xpReward);

    return newBug;
  };

  const receiveTradedBug = async (
    firestoreId: string,
    bugData: Omit<Bug, 'id' | 'caughtAt'>,
  ): Promise<Bug> => {
    const hpForLevel = Math.floor((bugData.maxXp ?? 50) * (1 + ((bugData.level ?? 1) - 1) * 0.2));
    const newBug: Bug = {
      ...bugData,
      id: firestoreId,
      caughtAt: new Date(),
      maxHp: bugData.maxHp ?? hpForLevel,
      currentHp: bugData.currentHp ?? hpForLevel,
    };
    setCollection(prev => ({
      ...prev,
      bugs: [...prev.bugs, newBug],
    }));
    return newBug;
  };

  const addBugToParty = (bug: Bug, slot?: number): boolean => {
    setCollection(prev => {
      const idx = prev.activePartyIndex;
      const newParty = [...prev.parties[idx]];
      
      // If slot is specified, use it (if empty)
      if (slot !== undefined && slot >= 0 && slot < 6) {
        if (newParty[slot] === null) {
          newParty[slot] = bug;
          const newParties = [...prev.parties];
          newParties[idx] = newParty;
          return { ...prev, parties: newParties, party: newParty };
        }
        return prev; // Slot occupied
      }
      
      // Find first empty slot
      const emptySlot = newParty.findIndex(slot => slot === null);
      if (emptySlot !== -1) {
        newParty[emptySlot] = bug;
        const newParties = [...prev.parties];
        newParties[idx] = newParty;
        return { ...prev, parties: newParties, party: newParty };
      }
      
      return prev; // Party full
    });
    
    return true;
  };

  const removeBugFromParty = (slot: number) => {
    if (slot < 0 || slot >= 6) return;
    
    setCollection(prev => {
      const idx = prev.activePartyIndex;
      const newParty = [...prev.parties[idx]];
      newParty[slot] = null;
      const newParties = [...prev.parties];
      newParties[idx] = newParty;
      return { ...prev, parties: newParties, party: newParty };
    });
  };

  const swapPartySlots = (from: number, to: number) => {
    if (from < 0 || from >= 6 || to < 0 || to >= 6) return;
    
    setCollection(prev => {
      const idx = prev.activePartyIndex;
      const newParty = [...prev.parties[idx]];
      const temp = newParty[from];
      newParty[from] = newParty[to];
      newParty[to] = temp;
      const newParties = [...prev.parties];
      newParties[idx] = newParty;
      return { ...prev, parties: newParties, party: newParty };
    });
  };

  const switchParty = (index: number) => {
    if (index < 0 || index > 2) return;
    setCollection(prev => ({
      ...prev,
      activePartyIndex: index,
      party: prev.parties[index],
    }));
  };

  const updateBugNickname = (bugId: string, nickname: string) => {
    setCollection(prev => {
      const newParties = prev.parties.map(p =>
        p.map(bug => bug && bug.id === bugId ? { ...bug, nickname } : bug)
      );
      return {
        ...prev,
        bugs: prev.bugs.map(bug => 
          bug.id === bugId ? { ...bug, nickname } : bug
        ),
        parties: newParties,
        party: newParties[prev.activePartyIndex],
      };
    });
  };

  const addXpToBug = async (bugId: string, xpAmount: number): Promise<boolean> => {
    return new Promise((resolve) => {
      setCollection(prev => {
        let bugFound = false;

        const levelUpBug = (bug: Bug): Bug => {
          bugFound = true;
          let newXp = bug.xp + xpAmount;
          let newLevel = bug.level;
          let currentBug = { ...bug };
          while (newXp >= currentBug.maxXp) {
            newXp -= currentBug.maxXp;
            newLevel += 1;
            const newMaxXp = Math.floor(currentBug.maxXp * 1.2);
            currentBug = { ...currentBug, maxXp: newMaxXp };
          }
          return { ...currentBug, xp: newXp, level: newLevel };
        };

        // Update bug in bugs array
        const newBugs = prev.bugs.map(bug =>
          bug.id === bugId ? levelUpBug(bug) : bug
        );
        
        // Update bug in all parties
        const newParties = prev.parties.map(p =>
          p.map(bug => bug && bug.id === bugId ? levelUpBug(bug) : bug)
        );
        
        setTimeout(() => resolve(bugFound), 0);
        
        return {
          ...prev,
          bugs: newBugs,
          parties: newParties,
          party: newParties[prev.activePartyIndex],
        };
      });
    });
  };

  const gainXP = (amount: number) => {
    setCollection(prev => {
      const newTotalXp = prev.totalXp + amount;
      let newLevel = prev.level;
      let newXp = prev.xp + amount;
      
      // Level up logic (every 100 XP)
      while (newXp >= 100) {
        newXp -= 100;
        newLevel += 1;
      }
      
      return {
        ...prev,
        totalXp: newTotalXp,
        level: newLevel,
        xp: newXp,
      };
    });
  };

  const updateBugHp = async (bugId: string, currentHp: number): Promise<boolean> => {
    return new Promise((resolve) => {
      setCollection(prev => {
        let bugFound = false;

        const updateHp = (bug: Bug): Bug => {
          bugFound = true;
          const maxHp = bug.maxHp || bug.maxXp;
          return {
            ...bug,
            currentHp: Math.max(0, Math.min(currentHp, maxHp)),
            maxHp,
          };
        };
        
        const newBugs = prev.bugs.map(bug =>
          bug.id === bugId ? updateHp(bug) : bug
        );
        
        const newParties = prev.parties.map(p =>
          p.map(bug => bug && bug.id === bugId ? updateHp(bug) : bug)
        );
        
        setTimeout(() => resolve(bugFound), 0);
        
        return {
          ...prev,
          bugs: newBugs,
          parties: newParties,
          party: newParties[prev.activePartyIndex],
        };
      });
    });
  };

  const releaseBug = (bugId: string) => {
    setCollection(prev => {
      const newBugs = prev.bugs.filter(bug => bug.id !== bugId);
      
      // Remove from all parties
      const newParties = prev.parties.map(p =>
        p.map(bug => bug && bug.id === bugId ? null : bug)
      );
      
      return {
        ...prev,
        bugs: newBugs,
        parties: newParties,
        party: newParties[prev.activePartyIndex],
      };
    });
  };

  const setProfilePicture = (key: string) => {
    setCollection(prev => ({ ...prev, profilePicture: key }));
  };

  const contextValue: BugCollectionContextType = {
    collection,
    addBugToCollection,
    receiveTradedBug,
    addBugToParty,
    removeBugFromParty,
    swapPartySlots,
    switchParty,
    updateBugNickname,
    addXpToBug,
    updateBugHp,
    releaseBug,
    gainXP,
    setProfilePicture,
    loading,
  };

  return (
    <BugCollectionContext.Provider value={contextValue}>
      {children}
    </BugCollectionContext.Provider>
  );
};