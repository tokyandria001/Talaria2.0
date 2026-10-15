import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/Colors';
import { TYPE_ICON, TYPE_COLOR } from '../constants/Notifications';

const POLL_MS = 20_000;   // vérification des nouvelles notifications, app ouverte
const SHOW_MS = 4_500;    // durée d'affichage du bandeau

/**
 * Bandeau en haut de l'écran à l'arrivée d'une notification (app ouverte) : il descend, reste
 * quelques secondes puis remonte. Le toucher ouvre la page Notifications.
 * Les notifications déjà là à l'ouverture de l'app ne sont pas rejouées.
 */
export default function NotificationBanner() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [banner, setBanner] = useState(null);           // { notif, more }
  const lastId = useRef(null);                          // plus récente notification déjà connue
  const y = useRef(new Animated.Value(-160)).current;
  const hideTimer = useRef(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const hide = () => {
    clearTimeout(hideTimer.current);
    Animated.timing(y, { toValue: -160, duration: 220, useNativeDriver: true }).start(() => setBanner(null));
  };

  useEffect(() => {
    if (!user) { lastId.current = null; return undefined; }
    let cancelled = false;

    const check = async () => {
      if (AppState.currentState !== 'active') return;
      try {
        const { data } = await client.get('/api/notifications');
        if (cancelled || !Array.isArray(data)) return;
        const newest = data.reduce((max, n) => Math.max(max, n.id), 0);
        if (lastId.current === null) { lastId.current = newest; return; }
        const fresh = data.filter(n => n.id > lastId.current && !n.isRead);
        lastId.current = Math.max(lastId.current, newest);
        // Déjà sur la page Notifications : la liste suffit
        if (!fresh.length || pathRef.current === '/notifications') return;
        setBanner({ notif: fresh[0], more: fresh.length - 1 });
        y.setValue(-160);
        Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(hide, SHOW_MS);
      } catch { /* hors ligne : on réessaie au prochain tour */ }
    };

    check();
    const id = setInterval(check, POLL_MS);
    // Retour dans l'app : vérification immédiate
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') check(); });
    return () => { cancelled = true; clearInterval(id); sub.remove(); clearTimeout(hideTimer.current); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!banner) return null;
  const { notif, more } = banner;
  const color = TYPE_COLOR[notif.type] ?? Colors.parme;

  return (
    <Animated.View style={[s.wrap, { top: insets.top + 8, transform: [{ translateY: y }] }]}>
      <TouchableOpacity style={s.card} activeOpacity={0.9}
        onPress={() => { hide(); router.push('/notifications'); }}>
        <View style={[s.icon, { backgroundColor: color }]}>
          <Ionicons name={TYPE_ICON[notif.type] ?? 'notifications'} size={16} color={Colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.message} numberOfLines={2}>{notif.message}</Text>
          {more > 0 && <Text style={s.more}>+ {more} autre{more > 1 ? 's' : ''} notification{more > 1 ? 's' : ''}</Text>}
        </View>
        <TouchableOpacity onPress={hide} hitSlop={10}>
          <Ionicons name="close" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 1000, elevation: 20 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14,
    shadowColor: '#1e0816', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  message: { fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 13, color: Colors.text, lineHeight: 18 },
  more: { fontFamily: 'BricolageGrotesque_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 2 },
});
