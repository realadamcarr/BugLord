import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';

// Icon components moved outside for better performance
const HuntIcon = ({ color, focused }: { color: string; focused: boolean }) => (
  <IconSymbol 
    size={focused ? 32 : 28} 
    name="camera" 
    color={focused ? '#5c715e' : color}
    style={{
      transform: [{ scale: focused ? 1.1 : 1 }],
    }}
  />
);

const CollectionIcon = ({ color, focused }: { color: string; focused: boolean }) => (
  <IconSymbol 
    size={focused ? 32 : 28} 
    name="book.closed" 
    color={focused ? '#5c715e' : color}
    style={{
      transform: [{ scale: focused ? 1.1 : 1 }],
    }}
  />
);

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#5c715e',
        tabBarInactiveTintColor: '#8a9c8d',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: 'rgba(242, 249, 241, 0.95)',
            borderTopWidth: 1,
            borderTopColor: 'rgba(92, 113, 94, 0.2)',
            paddingTop: 8,
            paddingBottom: 20,
            height: 90,
          },
          default: {
            backgroundColor: '#f2f9f1',
            borderTopWidth: 2,
            borderTopColor: 'rgba(92, 113, 94, 0.3)',
            paddingTop: 8,
            paddingBottom: 8,
            height: 80,
            elevation: 8,
            shadowColor: '#5c715e',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          },
        }),
        tabBarLabelStyle: {
          fontSize: 16,
          fontWeight: '600',
          textAlign: 'center',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hunt',
          tabBarIcon: HuntIcon,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Collection',
          tabBarIcon: CollectionIcon,
        }}
      />
    </Tabs>
  );
}
