import { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';

/** Simple opacity fade-in */
export function useFadeIn(delay = 0, duration = 600) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1, duration, delay,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);
  return opacity;
}

/** Fade-in + slide up avec spring */
export function useSlideUp(delay = 0, fromY = 50) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 600, delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0, delay,
        damping: 22, stiffness: 180, mass: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  return { opacity, translateY };
}

/** Fade-in + scale-up (logo pop) */
export function useScaleFade(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.82)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 700, delay,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1, delay,
        damping: 18, stiffness: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  return { opacity, scale };
}

/** Swap animé de texte quand une valeur change : fade-out → callback → fade-in */
export function useTextSwap() {
  const opacity    = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const swap = (onMid) => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 0, duration: 110, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -10, duration: 110, useNativeDriver: true }),
    ]).start(() => {
      onMid();
      translateY.setValue(14);
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: 280, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, damping: 20, stiffness: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  return { opacity, translateY, swap };
}
