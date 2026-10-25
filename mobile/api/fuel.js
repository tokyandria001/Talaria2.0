import client from './client';

/** Prix de secours si le serveur ne répond pas (€/L) */
export const DEFAULT_FUEL_PRICE = 1.72;

let pending = null;

/**
 * Prix moyen du jour en France pour le SP95-E10 (le plus vendu), d'après le flux officiel
 * (GET /api/fuel-prices). Une seule requête par lancement de l'app.
 */
export function fuelPriceToday() {
  pending ??= client.get('/api/fuel-prices')
    .then(({ data }) => Number(data?.prices?.e10) || DEFAULT_FUEL_PRICE)
    .catch(() => { pending = null; return DEFAULT_FUEL_PRICE; });
  return pending;
}

/** 1.742 → « 1,74 » */
export const formatFuelPrice = (p) => p.toFixed(2).replace('.', ',');
