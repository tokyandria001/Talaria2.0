import { useRef, useEffect, useState } from 'react';
import { TouchableOpacity, StyleSheet, Animated, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import ChatbotModal from './ChatbotModal';
import { Colors } from '../constants/Colors';

const MASCOT = require('../assets/Logo-09.png');
const TAB_H  = 60;

export default function ChatbotFAB() {
  const insets       = useSafeAreaInsets();
  const pathname     = usePathname();
  const [open, setOpen] = useState(false);

  // Pulsation douce
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.00, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Rebond à l'ouverture
  const bounce = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Animated.sequence([
      Animated.timing(bounce, { toValue: 0.85, duration: 100, useNativeDriver: true }),
      Animated.spring(bounce,  { toValue: 1,    useNativeDriver: true, friction: 4 }),
    ]).start();
    setOpen(true);
  };

  // Écrans avec un bouton flottant en bas à droite : l'assistant se place au-dessus
  const RAISED = { '/profile': 44 + 12 };
  const bottom = TAB_H + Math.max(insets.bottom, 8) + 16 + (RAISED[pathname] ?? 0);

  return (
    <>
      <Animated.View style={[
        s.wrap,
        { bottom, transform: [{ scale: Animated.multiply(pulse, bounce) }] },
      ]}>
        <TouchableOpacity style={s.btn} onPress={handlePress} activeOpacity={0.9}>
          <Image source={MASCOT} style={s.icon} resizeMode="contain" />
        </TouchableOpacity>
      </Animated.View>

      <ChatbotModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 18,
    zIndex: 999,
    elevation: 10,
    shadowColor: Colors.parme,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  btn: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.parmeLight ?? '#f5eef8',
  },
  icon: { width: 44, height: 44 },
});
