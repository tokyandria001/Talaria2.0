import { Image } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// light=true force le blanc (fonds sombres fixes comme welcome/hero)
export default function TalariaLogo({ height = 44, light = false }) {
  const { isDark } = useTheme();
  const aspectRatio = 8476 / 2211;
  const tintColor = (light || isDark) ? '#ffffff' : undefined;
  return (
    <Image
      source={require('../assets/Logo-07 1.png')}
      style={{ height, width: height * aspectRatio, tintColor }}
      resizeMode="contain"
    />
  );
}
