import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ChatbotFAB from '../../components/ChatbotFAB';
import CreateMenu from '../../components/CreateMenu';
import { Colors } from '../../constants/Colors';
import { TAB_BAR_HEIGHT } from '../../constants/Layout';

const TABS = {
  home:     { label: 'Accueil',     icon: 'home-outline' },
  discover: { label: 'Découvrir',   icon: 'map-outline' },
  new:      { label: 'Nouveau',     icon: 'add' },
  trips:    { label: 'Mes voyages', icon: 'earth-outline' },
  profile:  { label: 'Profil',      icon: 'person-circle-outline' },
};

/** Barre d'onglets flottante du design ; le bouton central ouvre le menu de création */
function TabBar({ state, navigation, onCreate }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.bar, { bottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;

        if (route.name === 'new') {
          return (
            <TouchableOpacity key={route.key} style={s.item} onPress={onCreate} activeOpacity={0.85}
              accessibilityRole="button" accessibilityLabel="Nouveau">
              <View style={s.plus}><Ionicons name="add" size={22} color={Colors.white} /></View>
              <Text style={s.label}>{tab.label}</Text>
            </TouchableOpacity>
          );
        }

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <TouchableOpacity key={route.key} style={s.item} onPress={onPress} activeOpacity={0.85}
            accessibilityRole="tab" accessibilityState={{ selected: focused }}>
            <Ionicons name={focused ? tab.icon.replace('-outline', '') : tab.icon} size={22}
              color={focused ? Colors.parme : 'rgba(79,32,63,0.65)'} />
            <Text style={[s.label, focused && s.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <TabBar {...props} onCreate={() => setCreateOpen(true)} />}
      >
        <Tabs.Screen name="home" />
        <Tabs.Screen name="discover" />
        <Tabs.Screen name="new" />
        <Tabs.Screen name="trips" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <ChatbotFAB />
      <CreateMenu visible={createOpen} onClose={() => setCreateOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute', left: 14, right: 14, height: TAB_BAR_HEIGHT,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#efe6e9', borderRadius: 32, paddingHorizontal: 6,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 10,
  },
  item:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  plus: {
    width: 44, height: 30, borderRadius: 15, backgroundColor: Colors.parme,
    alignItems: 'center', justifyContent: 'center',
  },
  label:       { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 10, color: Colors.parme },
  labelActive: { fontFamily: 'BricolageGrotesque_700Bold' },
});
