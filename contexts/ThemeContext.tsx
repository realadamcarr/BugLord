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
    background: '#F5F0E8',     // Warm parchment
    surface: '#EDE6D6',        // Light parchment card
    card: '#EDE6D6',
    
    text: '#2A1F14',           // Rich bark brown
    textSecondary: '#5C4A32',  // Medium bark
    textMuted: '#9B8B73',      // Faded wood
    
    primary: '#3D6B35',        // Bold forest green
    primaryLight: 'rgba(61, 107, 53, 0.12)',
    success: '#4A8C3F',        // Vivid leaf green
    warning: '#D4940A',        // Honey amber
    error: '#B83A2A',          // Deep russet red
    
    border: '#C4B596',         // Warm tan border
    separator: 'rgba(90, 74, 50, 0.1)',
    shadow: '#5C4A32',
    
    tierBasic: '#4A8C3F',
    tierGood: '#3D6B35',
    tierRare: '#D4940A',
    tierEpic: '#A0522D',
    
    xpFill: '#D4940A',         // Honey amber XP
    xpBackground: '#D5CAB8',   // Light tan
  },
};

const darkTheme: Theme = {
  mode: 'dark',
  isDark: true,
  colors: {
    background: '#141210',     // Near-black warm
    surface: '#1E1B16',        // Dark bark
    card: '#1E1B16',
    
    text: '#F0E8D8',           // Warm cream
    textSecondary: '#B8A88C',  // Faded parchment
    textMuted: '#786A54',      // Dim brown
    
    primary: '#6ABF5E',        // Bright leaf green
    primaryLight: 'rgba(106, 191, 94, 0.15)',
    success: '#6ABF5E',        // Vivid green
    warning: '#F0B429',        // Bright amber
    error: '#E05A44',          // Warm red
    
    border: '#3A3327',         // Dark tan border
    separator: 'rgba(184, 168, 140, 0.1)',
    shadow: '#000000',
    
    tierBasic: '#6ABF5E',
    tierGood: '#5EA652',
    tierRare: '#F0B429',
    tierEpic: '#E0853D',
    
    xpFill: '#F0B429',         // Bright amber XP
    xpBackground: '#2E2920',   // Very dark tan
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
