import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BugCollectionProvider } from '@/contexts/BugCollectionContext';
import { InventoryProvider } from '@/contexts/InventoryContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { restoreBackgroundStepTrackingIfNeeded } from '@/services/BackgroundStepTracking';
import { walkModeService } from '@/services/WalkModeService';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Auto-initialize Walk Mode on app startup so the pedometer
  // re-subscribes immediately after an app kill, rather than waiting
  // for the user to navigate to the Walk Mode screen.
  // Also re-register the background fetch task if walk mode was active.
  useEffect(() => {
    (async () => {
      try {
        await walkModeService.initialize();
      } catch (err) {
        console.warn('Walk mode auto-init skipped:', err);
      }

      // Ensure background fetch task is registered if walk mode was active
      // before process death/app restart.
      try {
        await restoreBackgroundStepTrackingIfNeeded();
      } catch (err) {
        console.warn('Background step task restore skipped:', err);
      }
    })();
  }, []);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <BugCollectionProvider>
          <InventoryProvider>
            <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
            </NavigationThemeProvider>
          </InventoryProvider>
        </BugCollectionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
