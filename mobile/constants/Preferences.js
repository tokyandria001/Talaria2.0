/** Préférences de voyage du profil — mêmes valeurs que le site web (ProfilePage) et le backend */
export const ACTIVITY_TAGS = [
  { value: 'culture',     label: '🏛️ Culture' },
  { value: 'nature',      label: '🌿 Nature' },
  { value: 'nightlife',   label: '🎉 Nightlife' },
  { value: 'sport',       label: '🏄 Sport' },
  { value: 'gastronomie', label: '🍽️ Gastronomie' },
  { value: 'aventure',    label: '🧗 Aventure' },
  { value: 'plage',       label: '🏖️ Plage' },
  { value: 'shopping',    label: '🛍️ Shopping' },
  { value: 'bien-etre',   label: '🧘 Bien-être' },
  { value: 'art',         label: '🎨 Art' },
];

export const TRAVEL_STYLES = [
  { value: 'budget',  label: '💸 Budget' },
  { value: 'confort', label: '🛋️ Confort' },
  { value: 'luxe',    label: '✨ Luxe' },
];

export const TRAVEL_PACES = [
  { value: 'slow', label: '🐢 Slow travel' },
  { value: 'fast', label: '⚡ Rythme rapide' },
];

/** Profil suffisant pour être reconnu par ses amis (prénom + pseudo) */
export const isProfileComplete = (user) => !!(user?.firstName?.trim() && user?.username?.trim());

/** Clé SecureStore : l'utilisateur a choisi « Plus tard » (on ne lui redemande pas à chaque lancement) */
export const skipKey = (userId) => `profilePromptSkipped_${userId}`;
