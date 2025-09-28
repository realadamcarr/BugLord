/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

// Green Nature Theme Colors
const natureGreenLight = '#5c715e';  // Deep forest green for accents
const natureGreenDark = '#b6cdbd';   // Softer green for dark mode

export const Colors = {
  light: {
    text: '#2c3e2d',           // Dark forest text
    background: '#f2f9f1',     // Very light nature green
    tint: natureGreenLight,    // Deep forest green
    icon: '#5c715e',           // Deep forest green
    tabIconDefault: '#8a9c8d', // Muted green
    tabIconSelected: natureGreenLight,
    
    // Additional nature theme colors
    cardBackground: '#ddeedf',  // Light sage green
    cardBorder: '#b6cdbd',     // Medium green border
    accent: '#5c715e',         // Deep forest accent
    success: '#4a7c59',        // Success green
    muted: '#8a9c8d',         // Muted sage
  },
  dark: {
    text: '#e8f5e8',          // Very light green text
    background: '#1a2e1d',     // Dark forest background
    tint: natureGreenDark,     // Softer green
    icon: '#b6cdbd',           // Medium sage green
    tabIconDefault: '#6b8471', // Darker muted green
    tabIconSelected: natureGreenDark,
    
    // Additional nature theme colors
    cardBackground: '#2d4a32',  // Dark forest card background
    cardBorder: '#5c715e',     // Deep forest border
    accent: '#b6cdbd',         // Light sage accent
    success: '#7fb069',        // Brighter success green
    muted: '#6b8471',         // Dark muted sage
  },
};
