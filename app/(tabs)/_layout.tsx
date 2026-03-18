import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { T, R } from '@/constants/theme';

const TAB_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  home:      'home',
  fixtures:  'calendar',
  'my-team': 'shirt',
  standings: 'podium',
  profile:   'person',
};

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <View style={s.tabBar}>
      {state.routes
        .filter((r) => r.name in TAB_ICONS)
        .map((route) => {
          const { options } = descriptors[route.key];
          const label = (options.title ?? route.name) as string;
          const isFocused = state.index === state.routes.indexOf(route);
          const iconName = TAB_ICONS[route.name] ?? 'ellipse';

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity key={route.key} onPress={onPress} style={s.tab} activeOpacity={0.7}>
              <Ionicons name={iconName} size={22} color={isFocused ? T.accentLight : T.textMuted} />
              <Text style={[s.tabLabel, isFocused && s.tabLabelActive]}>{label}</Text>
              {isFocused && <View style={s.tabDot} />}
            </TouchableOpacity>
          );
        })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home"      options={{ title: 'Home' }} />
      <Tabs.Screen name="fixtures"  options={{ title: 'Fixtures' }} />
      <Tabs.Screen name="my-team"   options={{ title: 'My Team' }} />
      <Tabs.Screen name="standings" options={{ title: 'Standings' }} />
      <Tabs.Screen name="profile"   options={{ title: 'Profile' }} />
      <Tabs.Screen name="draft"     options={{ title: 'Draft', href: null }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: T.accentDark,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  tabLabel: {
    fontSize: 9,
    fontFamily: 'Fredoka_500Medium',
    color: T.textMuted,
  },
  tabLabelActive: {
    color: T.accentLight,
    fontFamily: 'Fredoka_700Bold',
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.accentLight,
    marginTop: 2,
  },
});
