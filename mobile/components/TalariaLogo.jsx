import { Image } from 'react-native';

// light=true → logo blanc pour fonds sombres (onboarding, welcome)
export default function TalariaLogo({ height = 44, light = false }) {
  const aspectRatio = 8476 / 2211; // ratio exact du PNG horizontal
  return (
    <Image
      source={require('../assets/Logo-07 1.png')}
      style={{ height, width: height * aspectRatio, tintColor: light ? '#ffffff' : undefined }}
      resizeMode="contain"
    />
  );
}
