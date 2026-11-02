import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  DefaultTheme,
  LinkingOptions,
  NavigationContainer,
} from '@react-navigation/native';
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/AppText';
import { Icon, IconName } from '../components/Icon';
import { MiniPlayer } from '../components/MiniPlayer';
import { AlarmSetupScreen } from '../screens/AlarmSetupScreen';
import { AlarmsScreen } from '../screens/AlarmsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { NowPlayingScreen } from '../screens/NowPlayingScreen';
import { PlaylistDetailScreen } from '../screens/PlaylistDetailScreen';
import { PlaylistsScreen } from '../screens/PlaylistsScreen';
import { SetupScreen } from '../screens/SetupScreen';
import { colors } from '../theme';
import type { RootStackParams, TabParams } from './types';

const Tab = createBottomTabNavigator<TabParams>();
const Stack = createNativeStackNavigator<RootStackParams>();

const tabIcons: Record<keyof TabParams, IconName> = {
  Home: 'home',
  Library: 'music',
  Playlists: 'playlists',
  Alarms: 'clock',
};

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      <MiniPlayer />
      <View style={styles.tabs}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const color = focused ? colors.sage : colors.muted;
          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              onPress={() => navigation.navigate(route.name, route.params)}>
              <Icon
                name={tabIcons[route.name as keyof TabParams]}
                size={28}
                color={color}
              />
              <AppText
                variant="label"
                color={color}
                numberOfLines={1}
                style={styles.tabLabel}>
                {route.name}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const renderTabBar = (props: BottomTabBarProps) => <TabBar {...props} />;

function Tabs() {
  return (
    <Tab.Navigator
      tabBar={renderTabBar}
      screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Playlists" component={PlaylistsScreen} />
      <Tab.Screen name="Alarms" component={AlarmsScreen} />
    </Tab.Navigator>
  );
}

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.background },
};

// The notification and lock screen open the player through morningmelody://now-playing.
const linking: LinkingOptions<RootStackParams> = {
  prefixes: ['morningmelody://'],
  config: { screens: { NowPlaying: 'now-playing' } },
};

export function AppNavigation() {
  return (
    <NavigationContainer theme={theme} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
        <Stack.Screen name="AddSongs" component={LibraryScreen} />
        <Stack.Screen name="AlarmSetup" component={AlarmSetupScreen} />
        <Stack.Screen name="NowPlaying" component={NowPlayingScreen} />
        <Stack.Screen name="Setup" component={SetupScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.background },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  tab: {
    flex: 1,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabLabel: { letterSpacing: 0, marginTop: 2 },
});
