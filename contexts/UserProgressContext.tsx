import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

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

interface UserProgressContextType {
  userProgress: UserProgress;
  notes: Note[];
  updateProgress: (newProgress: UserProgress) => Promise<void>;
  updateNotes: (newNotes: Note[]) => Promise<void>;
  updateBoth: (newNotes: Note[], newProgress: UserProgress) => Promise<void>;
  refreshData: () => Promise<void>;
}

const UserProgressContext = createContext<UserProgressContextType | undefined>(undefined);

export const UserProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProgress, setUserProgress] = useState<UserProgress>({ level: 1, xp: 0, totalXp: 0 });
  const [notes, setNotes] = useState<Note[]>([]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const savedNotes = await AsyncStorage.getItem('notes');
      const savedProgress = await AsyncStorage.getItem('userProgress');
      
      if (savedNotes) {
        setNotes(JSON.parse(savedNotes));
      }
      
      if (savedProgress) {
        setUserProgress(JSON.parse(savedProgress));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const updateProgress = async (newProgress: UserProgress) => {
    try {
      setUserProgress(newProgress);
      await AsyncStorage.setItem('userProgress', JSON.stringify(newProgress));
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const updateNotes = async (newNotes: Note[]) => {
    try {
      setNotes(newNotes);
      await AsyncStorage.setItem('notes', JSON.stringify(newNotes));
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  const updateBoth = async (newNotes: Note[], newProgress: UserProgress) => {
    try {
      setNotes(newNotes);
      setUserProgress(newProgress);
      await AsyncStorage.setItem('notes', JSON.stringify(newNotes));
      await AsyncStorage.setItem('userProgress', JSON.stringify(newProgress));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const refreshData = async () => {
    await loadData();
  };

  const contextValue = useMemo(() => ({
    userProgress,
    notes,
    updateProgress,
    updateNotes,
    updateBoth,
    refreshData,
  }), [userProgress, notes]);

  return (
    <UserProgressContext.Provider value={contextValue}>
      {children}
    </UserProgressContext.Provider>
  );
};

export const useUserProgress = () => {
  const context = useContext(UserProgressContext);
  if (context === undefined) {
    throw new Error('useUserProgress must be used within a UserProgressProvider');
  }
  return context;
};
