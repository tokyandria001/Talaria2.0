/** Aides d'affichage des voyages (accueil, profil) */

/** Pas de photo de destination en base : photos locales, choisies selon la ville ou de façon stable par voyage */
const CITY_PHOTOS = [
  [/paris/i, require('../assets/paris.jpg')],
  [/rom[ea]/i, require('../assets/roma.jpg')],
  [/new york|nyc/i, require('../assets/nyc.jpg')],
];
const GENERIC_PHOTOS = [
  require('../assets/auth/welcome-1.jpg'),
  require('../assets/auth/welcome-2.jpg'),
  require('../assets/auth/welcome-3.jpg'),
  require('../assets/auth/welcome-4.jpg'),
];

export const tripPhoto = (trip) => CITY_PHOTOS.find(([re]) => re.test(trip.destination))?.[1]
  ?? GENERIC_PHOTOS[trip.id % GENERIC_PHOTOS.length];

/** Date du jour AAAA-MM-JJ */
export const today = () => new Date().toISOString().slice(0, 10);

/** AAAA-MM-JJ → JJ/MM */
export const shortDate = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Jours entre aujourd'hui et une date AAAA-MM-JJ (négatif si passée) */
export const daysUntil = (iso) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 864e5);

/** Initiales d'un utilisateur (prénom + nom, sinon pseudo ou email) */
export const initialsOf = (u) => ((u?.firstName?.[0] ?? '') + (u?.lastName?.[0] ?? '') || u?.username?.[0] || u?.email?.[0] || '?').toUpperCase();
