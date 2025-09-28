import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface Theme {
  mode: ThemeMode;
  isDark: boolean;
  colors: {
    // Background colors
    background: string;
    surface: string;
    card: string;
    
    // Text colors
    text: string;
    textSecondary: string;
    textMuted: string;
    
    // Brand colors
    primary: string;
    primaryLight: string;
    success: string;
    warning: string;
    error: string;
    
    // UI colors
    border: string;
    separator: string;
    shadow: string;
    
    // Tier colors
    tierBasic: string;
    tierGood: string;
    tierRare: string;
    tierEpic: string;
    
    // XP colors
    xpFill: string;
    xpBackground: string;
  };
}

const lightTheme: Theme = {
  mode: 'light',
  isDark: false,
  colors: {
    background: '#f2f9f1',     // Very light nature green
    surface: '#ddeedf',        // Light sage green
    card: '#ddeedf',           // Light sage green
    
    text: '#2c3e2d',           // Dark forest text
    textSecondary: '#5c715e',  // Deep forest green
    textMuted: '#8a9c8d',      // Muted sage
    
    primary: '#5c715e',        // Deep forest green
    primaryLight: 'rgba(92, 113, 94, 0.1)',
    success: '#4a7c59',        // Success green
    warning: '#b8860b',        // Natural gold
    error: '#8b4513',          // Earth brown for errors
    
    border: '#b6cdbd',         // Medium green border
    separator: 'rgba(92, 113, 94, 0.1)',
    shadow: '#5c715e',
    
    tierBasic: '#4a7c59',      // Forest success green
    tierGood: '#5c715e',       // Deep forest
    tierRare: '#b8860b',       // Natural gold
    tierEpic: '#704214',       // Rich earth brown
    
    xpFill: '#5c715e',         // Deep forest green
    xpBackground: '#b6cdbd',   // Medium sage
  },
};

const darkTheme: Theme = {
  mode: 'dark',
  isDark: true,
  colors: {
    background: '#1a2e1d',     // Dark forest background
    surface: '#2d4a32',        // Dark forest card background  
    card: '#2d4a32',           // Dark forest card background
    
    text: '#e8f5e8',           // Very light green text
    textSecondary: '#b6cdbd',  // Medium sage green
    textMuted: '#6b8471',      // Dark muted sage
    
    primary: '#b6cdbd',        // Light sage accent
    primaryLight: 'rgba(182, 205, 189, 0.15)',
    success: '#7fb069',        // Brighter success green
    warning: '#d4af37',        // Brighter natural gold
    error: '#cd853f',          // Lighter earth brown
    
    border: '#5c715e',         // Deep forest border
    separator: 'rgba(182, 205, 189, 0.1)',
    shadow: '#000000',
    
    tierBasic: '#7fb069',      // Bright forest green
    tierGood: '#b6cdbd',       // Light sage
    tierRare: '#d4af37',       // Bright gold
    tierEpic: '#daa520',       // Rich gold
    
    xpFill: '#b6cdbd',         // Light sage green
    xpBackground: '#5c715e',   // Deep forest
  },
};

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme()
  );

  // Listen to system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(colorScheme);
    });

    return () => subscription.remove();
  }, []);

  // Always use system theme
  const getCurrentTheme = useCallback((): Theme => {
    return systemColorScheme === 'dark' ? darkTheme : lightTheme;
  }, [systemColorScheme]);

  const theme = getCurrentTheme();

  const contextValue = useMemo((): ThemeContextType => ({
    theme,
    themeMode: 'system',
    setThemeMode: () => {}, // No-op since we always use system
    toggleTheme: () => {}, // No-op since we always use system
  }), [theme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};
