/**
 * Catégories de lieux (tag stocké dans Place.tags). Les anciens tags (visite, culture, sport)
 * restent reconnus : ils sont rattachés aux catégories Musées et Activités.
 */
export const PLACE_CATEGORIES = [
  { value: 'restaurant', label: 'Restaurant', plural: 'Restaurants', icon: 'restaurant',     color: '#f2762e', tags: ['restaurant', 'marche'] },
  { value: 'marche',     label: 'Marché',     plural: 'Marchés',     icon: 'basket',         color: '#e0912f', tags: ['marche'] },
  { value: 'bar',        label: 'Bar',        plural: 'Bars',        icon: 'wine',           color: '#e5484d', tags: ['bar'] },
  { value: 'musee',      label: 'Musée',      plural: 'Musées',      icon: 'business',       color: '#7c5cdb', tags: ['musee', 'culture', 'visite'] },
  { value: 'plage',      label: 'Plage',      plural: 'Plages',      icon: 'umbrella',       color: '#1fa2c4', tags: ['plage'] },
  { value: 'activite',   label: 'Activité',   plural: 'Activités',   icon: 'bicycle',        color: '#4f203f', tags: ['activite', 'sport'] },
  { value: 'hotel',      label: 'Hôtel',      plural: 'Hôtels',      icon: 'bed',            color: '#3f6fd8', tags: ['hotel'] },
  { value: 'auberge',    label: 'Auberge',    plural: 'Auberges',    icon: 'people',         color: '#5b8def', tags: ['auberge'] },
  { value: 'camping',    label: 'Camping',    plural: 'Campings',    icon: 'bonfire',        color: '#2f9e5b', tags: ['camping'] },
  { value: 'nature',     label: 'Nature',     plural: 'Nature',      icon: 'leaf',           color: '#2f9e5b', tags: ['nature'] },
];

/** Catégories proposées dans les filtres de la carte (le marché est inclus dans Restaurants) */
export const FILTER_CATEGORIES = PLACE_CATEGORIES.filter(c => c.value !== 'marche');

const LEGACY = { visite: 'musee', culture: 'musee', sport: 'activite' };

/** Catégorie principale d'un lieu (d'après son premier tag reconnu) */
export function categoryOf(place) {
  for (const tag of place?.tags ?? []) {
    const value = LEGACY[tag] ?? tag;
    const cat = PLACE_CATEGORIES.find(c => c.value === value);
    if (cat) return cat;
  }
  return { value: '', label: 'Lieu', plural: 'Lieux', icon: 'location', color: '#4f203f', tags: [] };
}

/** Niveau de prix affiché (€ / €€ / €€€) d'après le prix moyen par personne */
export function priceLevel(averagePrice) {
  if (averagePrice == null) return null;
  if (averagePrice < 15) return '€';
  if (averagePrice < 40) return '€€';
  return '€€€';
}

/** Distance en mètres entre deux points GPS (formule de haversine) */
export function distanceMeters(a, b) {
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const fmtDistance = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);
