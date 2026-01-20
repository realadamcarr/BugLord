import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Bug, BugCollection, generateBugStats, RARITY_CONFIG } from '../types/Bug';

interface BugCollectionContextType {
  collection: BugCollection;
  addBugToCollection: (bug: Omit<Bug, 'id' | 'caughtAt' | 'level' | 'xp' | 'maxXp'>) => Promise<Bug>;
  addBugToParty: (bug: Bug, slot?: number) => boolean;
  removeBugFromParty: (slot: number) => void;
  swapPartySlots: (from: number, to: number) => void;
  updateBugNickname: (bugId: string, nickname: string) => void;
  addXpToBug: (bugId: string, xpAmount: number) => Promise<boolean>;
  gainXP: (amount: number) => void;
  loading: boolean;
}

const BugCollectionContext = createContext<BugCollectionContextType | undefined>(undefined);

const STORAGE_KEY = 'bug_collection_data';
const COLLECTION_VERSION = '1.0';

const DEFAULT_COLLECTION: BugCollection = {
  bugs: [],
  party: [null, null, null, null, null, null], // 6 empty party slots
  totalXp: 0,
  level: 1,
  xp: 0,
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
        
        // Ensure party array has 6 slots
        if (!parsed.party || parsed.party.length !== 6) {
          parsed.party = Array(6).fill(null);
        }
        
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
    bugData: Omit<Bug, 'id' | 'caughtAt' | 'level' | 'xp' | 'maxXp'>
  ): Promise<Bug> => {
    const stats = generateBugStats(bugData.rarity);
    const newBug: Bug = {
      ...bugData,
      id: generateBugId(),
      caughtAt: new Date(),
      level: 1,
      xp: 0,
      maxXp: stats.maxXp,
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

  const addBugToParty = (bug: Bug, slot?: number): boolean => {
    setCollection(prev => {
      const newParty = [...prev.party];
      
      // If slot is specified, use it (if empty)
      if (slot !== undefined && slot >= 0 && slot < 6) {
        if (newParty[slot] === null) {
          newParty[slot] = bug;
          return { ...prev, party: newParty };
        }
        return prev; // Slot occupied
      }
      
      // Find first empty slot
      const emptySlot = newParty.findIndex(slot => slot === null);
      if (emptySlot !== -1) {
        newParty[emptySlot] = bug;
        return { ...prev, party: newParty };
      }
      
      return prev; // Party full
    });
    
    return true;
  };

  const removeBugFromParty = (slot: number) => {
    if (slot < 0 || slot >= 6) return;
    
    setCollection(prev => {
      const newParty = [...prev.party];
      newParty[slot] = null;
      return { ...prev, party: newParty };
    });
  };

  const swapPartySlots = (from: number, to: number) => {
    if (from < 0 || from >= 6 || to < 0 || to >= 6) return;
    
    setCollection(prev => {
      const newParty = [...prev.party];
      const temp = newParty[from];
      newParty[from] = newParty[to];
      newParty[to] = temp;
      return { ...prev, party: newParty };
    });
  };

  const updateBugNickname = (bugId: string, nickname: string) => {
    setCollection(prev => ({
      ...prev,
      bugs: prev.bugs.map(bug => 
        bug.id === bugId ? { ...bug, nickname } : bug
      ),
      party: prev.party.map(bug => 
        bug && bug.id === bugId ? { ...bug, nickname } : bug
      ),
    }));
  };

  const addXpToBug = async (bugId: string, xpAmount: number): Promise<boolean> => {
    return new Promise((resolve) => {
      setCollection(prev => {
        // Find the bug in either bugs array or party
        let bugFound = false;
        
        // Update bug in bugs array
        const newBugs = prev.bugs.map(bug => {
          if (bug.id === bugId) {
            bugFound = true;
            let newXp = bug.xp + xpAmount;
            let newLevel = bug.level;
            
            // Level up logic for individual bugs
            while (newXp >= bug.maxXp) {
              newXp -= bug.maxXp;
              newLevel += 1;
              // Increase max XP for next level (simple progression)
              const newMaxXp = Math.floor(bug.maxXp * 1.2);
              bug = { ...bug, maxXp: newMaxXp };
            }
            
            return {
              ...bug,
              xp: newXp,
              level: newLevel,
            };
          }
          return bug;
        });
        
        // Update bug in party array if found
        const newParty = prev.party.map(bug => {
          if (bug && bug.id === bugId) {
            bugFound = true;
            let newXp = bug.xp + xpAmount;
            let newLevel = bug.level;
            
            // Level up logic for individual bugs
            while (newXp >= bug.maxXp) {
              newXp -= bug.maxXp;
              newLevel += 1;
              // Increase max XP for next level (simple progression)
              const newMaxXp = Math.floor(bug.maxXp * 1.2);
              bug = { ...bug, maxXp: newMaxXp };
            }
            
            return {
              ...bug,
              xp: newXp,
              level: newLevel,
            };
          }
          return bug;
        });
        
        // Resolve the promise with success status
        setTimeout(() => resolve(bugFound), 0);
        
        return {
          ...prev,
          bugs: newBugs,
          party: newParty,
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

  const contextValue: BugCollectionContextType = {
    collection,
    addBugToCollection,
    addBugToParty,
    removeBugFromParty,
    swapPartySlots,
    updateBugNickname,
    addXpToBug,
    gainXP,
    loading,
  };

  return (
    <BugCollectionContext.Provider value={contextValue}>
      {children}
    </BugCollectionContext.Provider>
  );
};