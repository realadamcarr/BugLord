import { ThemeMode, useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from './ThemedText';

export const ThemeToggle: React.FC = () => {
  const { theme, themeMode, setThemeMode } = useTheme();

  const getThemeIcon = (mode: ThemeMode): string => {
    switch (mode) {
      case 'light': return '☀️';
      case 'dark': return '🌙';
      case 'system': return '📱';
      default: return '☀️';
    }
  };

  const getThemeLabel = (mode: ThemeMode): string => {
    switch (mode) {
      case 'light': return 'Light';
      case 'dark': return 'Dark';
      case 'system': return 'System';
      default: return 'Light';
    }
  };

  const themeOptions: ThemeMode[] = ['light', 'dark', 'system'];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ThemedText style={[styles.title, { color: theme.colors.text }]}>
        🎨 Theme
      </ThemedText>
      
      <View style={styles.optionsContainer}>
        {themeOptions.map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.option,
              { 
                backgroundColor: themeMode === mode 
                  ? theme.colors.primary 
                  : theme.colors.background,
                borderColor: theme.colors.border,
              }
            ]}
            onPress={() => setThemeMode(mode)}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.optionIcon}>
              {getThemeIcon(mode)}
            </ThemedText>
            <ThemedText
              style={[
                styles.optionText,
                {
                  color: themeMode === mode 
                    ? '#FFFFFF' 
                    : theme.colors.text
                }
              ]}
            >
              {getThemeLabel(mode)}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
