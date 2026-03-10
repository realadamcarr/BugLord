import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BugCollectionProvider } from '@/contexts/BugCollectionContext';
import { InventoryProvider } from '@/contexts/InventoryContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { restoreBackgroundStepTrackingIfNeeded } from '@/services/BackgroundStepTracking';
import { walkModeService } from '@/services/WalkModeService';
import { bugLordDarkPaperTheme, bugLordLightPaperTheme } from '@/theme/paperTheme';

/** Inner wrapper — reads BugLord theme and feeds the matching Paper theme. */
function AppProviders({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const colorScheme = useColorScheme();
  const paperTheme = theme.isDark ? bugLordDarkPaperTheme : bugLordLightPaperTheme;

  return (
    <PaperProvider theme={paperTheme}>
      <BugCollectionProvider>
        <InventoryProvider>
          <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            {children}
          </NavigationThemeProvider>
        </InventoryProvider>
      </BugCollectionProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const colorScheme = useColorScheme();

  useEffect(() => {
    (async () => {
      try {
        await walkModeService.initialize();
      } catch (err) {
        console.warn('Walk mode auto-init skipped:', err);
      }

      try {
        await restoreBackgroundStepTrackingIfNeeded();
      } catch (err) {
        console.warn('Background step task restore skipped:', err);
      }
    })();
  }, []);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppProviders>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="inventory" options={{ title: 'Inventory' }} />
            <Stack.Screen name="walkmode" options={{ headerShown: false }} />
            <Stack.Screen name="hivemode" options={{ headerShown: false }} />
            <Stack.Screen name="social-auth" options={{ title: 'Sign In', presentation: 'modal' }} />
            <Stack.Screen name="social-trade-create" options={{ title: 'Create Trade' }} />
            <Stack.Screen name="social-trade-session" options={{ title: 'Trade Session' }} />
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar
            style={colorScheme === 'dark' ? 'light' : 'dark'}
            backgroundColor="transparent"
            translucent={Platform.OS === 'android'}
          />
        </AppProviders>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
