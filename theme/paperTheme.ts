import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

/**
 * React Native Paper theme tokens aligned with BugLord's
 * earthy forest / game-style palette from ThemeContext.
 */
export const bugLordLightPaperTheme = {
  ...MD3LightTheme,
  dark: false,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#3D6B35',
    onPrimary: '#FFFFFF',
    primaryContainer: 'rgba(61, 107, 53, 0.12)',
    onPrimaryContainer: '#2A1F14',
    secondary: '#D4940A',
    onSecondary: '#FFFFFF',
    secondaryContainer: 'rgba(212, 148, 10, 0.12)',
    background: '#F5F0E8',
    onBackground: '#2A1F14',
    surface: '#EDE6D6',
    onSurface: '#2A1F14',
    surfaceVariant: '#EDE6D6',
    onSurfaceVariant: '#5C4A32',
    outline: '#C4B596',
    error: '#B83A2A',
    onError: '#FFFFFF',
  },
};

export const bugLordDarkPaperTheme = {
  ...MD3DarkTheme,
  dark: true,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#6ABF5E',
    onPrimary: '#141210',
    primaryContainer: 'rgba(106, 191, 94, 0.15)',
    onPrimaryContainer: '#F0E8D8',
    secondary: '#F0B429',
    onSecondary: '#141210',
    secondaryContainer: 'rgba(240, 180, 41, 0.15)',
    background: '#141210',
    onBackground: '#F0E8D8',
    surface: '#1E1B16',
    onSurface: '#F0E8D8',
    surfaceVariant: '#1E1B16',
    onSurfaceVariant: '#B8A88C',
    outline: '#3A3327',
    error: '#E05A44',
    onError: '#FFFFFF',
  },
};
