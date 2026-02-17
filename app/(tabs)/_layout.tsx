import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { useTheme } from '@/contexts/ThemeContext';

export default function TabLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: theme.colors.surface + 'F5',
            borderTopWidth: 3,
            borderTopColor: theme.colors.border,
            paddingTop: 8,
            paddingBottom: 20,
            height: 88,
          },
          default: {
            backgroundColor: theme.colors.surface,
            borderTopWidth: 3,
            borderTopColor: theme.colors.border,
            paddingTop: 6,
            paddingBottom: 6,
            height: 72,
            elevation: 12,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
          },
        }),
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '800',
          letterSpacing: 1,
          textTransform: 'uppercase',
          textAlign: 'center',
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}>
      <Tabs.Screen
        name="train"
        options={{
          title: 'Train',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={focused ? 30 : 26} name="dumbbell" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Capture',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={focused ? 34 : 30} name="camera" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="player"
        options={{
          title: 'Player',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={focused ? 30 : 26} name="person.circle" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={focused ? 30 : 26} name="person.2.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
