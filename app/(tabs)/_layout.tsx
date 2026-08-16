import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import React from 'react';

import { AnimatedTabBar } from '@/components/AnimatedTabBar';
import { IconSymbol } from '@/components/ui/IconSymbol';

function renderTabBar(props: BottomTabBarProps) {
  return <AnimatedTabBar {...props} />;
}

type IconProps = Readonly<{ color: string; focused: boolean }>;

function WalkIcon({ color, focused }: IconProps) {
  return <IconSymbol size={focused ? 30 : 26} name="figure.walk" color={color} />;
}

function CaptureIcon({ color, focused }: IconProps) {
  return <IconSymbol size={focused ? 34 : 30} name="camera" color={color} />;
}

function HiveIcon({ color, focused }: IconProps) {
  return <IconSymbol size={focused ? 30 : 26} name="hexagon" color={color} />;
}

function PlayerIcon({ color, focused }: IconProps) {
  return <IconSymbol size={focused ? 30 : 26} name="person.circle" color={color} />;
}

function SocialIcon({ color, focused }: IconProps) {
  return <IconSymbol size={focused ? 30 : 26} name="person.2.fill" color={color} />;
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={renderTabBar}
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen
        name="walk"
        options={{
          title: 'Walk',
          tabBarIcon: WalkIcon,
        }}
      />
      <Tabs.Screen
        name="hive"
        options={{
          title: 'Hive',
          tabBarIcon: HiveIcon,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Capture',
          tabBarIcon: CaptureIcon,
        }}
      />
      <Tabs.Screen
        name="player"
        options={{
          title: 'Player',
          tabBarIcon: PlayerIcon,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: SocialIcon,
        }}
      />
    </Tabs>
  );
}
