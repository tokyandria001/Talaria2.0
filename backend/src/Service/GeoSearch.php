<?php

namespace App\Service;

use Psr\Log\LoggerInterface;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Recherche de villes et de pays (destination d'un voyage), d'adresses (logement) et itinéraires routiers.
 *
 * Fournisseurs gratuits basés sur OpenStreetMap, à utiliser avec modération (cache + limite par utilisateur) :
 * - Photon (photon.komoot.io) pour les lieux et les adresses ;
 * - OSRM (router.project-osrm.org, serveur de démonstration) pour la distance en voiture.
 */
final class GeoSearch
{
    private const URL = 'https://photon.komoot.io/api/';
    private const ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving/';
    private const USER_AGENT = 'Talaria/1.0 (+https://talaria.world)';
    private const LIMIT = 6;

    public function __construct(
        private HttpClientInterface $httpClient,
        private CacheInterface $cache,
        private LoggerInterface $logger,
    ) {}

    /**
     * Adresses et établissements (logement) : rue et numéro, ou nom d'un hôtel, résidence...
     * Avec $lat/$lon (la destination du voyage), les résultats proches passent devant.
     *
     * @return list<array{label: string, name: string, details: string, latitude: float, longitude: float}>
     */
    public function searchAddress(string $query, ?float $lat = null, ?float $lon = null): array
    {
        $query = trim(mb_substr($query, 0, 150));
        if (mb_strlen($query) < 3) return [];
        $bias = $lat !== null && $lon !== null ? ['lat' => round($lat, 3), 'lon' => round($lon, 3)] : [];

        return $this->cache->get('geo_address_' . md5(mb_strtolower($query) . json_encode($bias)), function (ItemInterface $item) use ($query, $bias) {
            $item->expiresAfter(7 * 86400);
            $features = $this->photon(['q' => $query, 'lang' => 'fr', 'limit' => self::LIMIT] + $bias);

            $results = [];
            foreach ($features as $f) {
                $p = $f['properties'] ?? [];
                $coords = $f['geometry']['coordinates'] ?? null;
                if (!is_array($coords) || count($coords) < 2) continue;

                $street = trim(($p['housenumber'] ?? '') . ' ' . ($p['street'] ?? ''));
                $town = trim(($p['postcode'] ?? '') . ' ' . ($p['city'] ?? ''));
                // Établissement nommé (hôtel...) : son nom, puis son adresse ; sinon l'adresse
                $name = $p['name'] ?? ($street !== '' ? $street : null);
                if (!$name) continue;
                $address = implode(', ', array_filter([$p['name'] ?? null ? $street : null, $town, $p['country'] ?? null]));

                $results[] = [
                    'label'     => implode(', ', array_filter([$p['name'] ?? null, $street, $town])) ?: $name,
                    'name'      => $name,
                    'details'   => $address ?: ($p['country'] ?? ''),
                    'latitude'  => (float) $coords[1],
                    'longitude' => (float) $coords[0],
                ];
            }
            return $results;
        });
    }

    /**
     * Itinéraire en voiture entre deux points : distance (km) et durée (min). Gardé en cache 30 jours.
     *
     * @return array{distanceKm: int, durationMin: int}
     */
    public function route(float $fromLat, float $fromLon, float $toLat, float $toLon): array
    {
        $path = sprintf('%.5f,%.5f;%.5f,%.5f', $fromLon, $fromLat, $toLon, $toLat);

        return $this->cache->get('geo_route_' . md5($path), function (ItemInterface $item) use ($path) {
            $item->expiresAfter(30 * 86400);
            try {
                $data = $this->httpClient->request('GET', self::ROUTE_URL . $path . '?overview=false', [
                    'headers' => ['User-Agent' => self::USER_AGENT],
                    'timeout' => 8,
                ])->toArray();
            } catch (\Throwable $e) {
                $this->logger->warning('Itinéraire (OSRM) indisponible : {message}', ['message' => $e->getMessage()]);
                throw new GeoSearchUnavailable($e->getMessage(), 0, $e);
            }
            $route = $data['routes'][0] ?? null;
            if (($data['code'] ?? '') !== 'Ok' || !$route) throw new GeoSearchUnavailable('Aucun itinéraire');

            return ['distanceKm' => (int) round($route['distance'] / 1000), 'durationMin' => (int) round($route['duration'] / 60)];
        });
    }

    /** Appel à Photon ; service indisponible → GeoSearchUnavailable (rien n'est mis en cache) */
    private function photon(array $params, array $layers = []): array
    {
        try {
            $url = self::URL . '?' . http_build_query($params) . implode('', array_map(fn ($l) => '&layer=' . $l, $layers));
            return $this->httpClient->request('GET', $url, [
                'headers' => ['User-Agent' => self::USER_AGENT],
                'timeout' => 6,
            ])->toArray()['features'] ?? [];
        } catch (\Throwable $e) {
            $this->logger->warning('Recherche de lieux (Photon) indisponible : {message}', ['message' => $e->getMessage()]);
            throw new GeoSearchUnavailable($e->getMessage(), 0, $e);
        }
    }

    /**
     * @return list<array{label: string, name: string, details: string, region: ?string, postcode: ?string,
     *                    country: ?string, countryCode: ?string, latitude: float, longitude: float, type: string}>
     */
    public function search(string $query): array
    {
        $query = trim(mb_substr($query, 0, 100));
        if (mb_strlen($query) < 2) return [];

        return $this->cache->get('geo_search_' . md5(mb_strtolower($query)), function (ItemInterface $item) use ($query) {
            $item->expiresAfter(7 * 86400);
            // Villes, villages et pays, noms en français (service indisponible : l'app laisse saisir librement)
            $features = $this->photon(['q' => $query, 'lang' => 'fr', 'limit' => self::LIMIT], ['city', 'country']);

            $results = [];
            foreach ($features as $f) {
                $p = $f['properties'] ?? [];
                $coords = $f['geometry']['coordinates'] ?? null;
                if (empty($p['name']) || !is_array($coords) || count($coords) < 2) continue;

                $isCountry = ($p['type'] ?? '') === 'country';
                $region = $p['county'] ?? $p['state'] ?? null;
                $details = array_values(array_filter([
                    $isCountry ? null : ($p['postcode'] ?? null),
                    $isCountry ? null : $region,
                    $isCountry ? null : ($p['country'] ?? null),
                ]));
                $results[] = [
                    'label'       => $isCountry ? $p['name'] : $p['name'] . (isset($p['country']) ? ', ' . $p['country'] : ''),
                    'name'        => $p['name'],
                    'details'     => $isCountry ? 'Pays' : implode(' · ', $details),
                    'region'      => $isCountry ? null : $region,
                    'postcode'    => $isCountry ? null : ($p['postcode'] ?? null),
                    'country'     => $p['country'] ?? ($isCountry ? $p['name'] : null),
                    'countryCode' => isset($p['countrycode']) ? strtoupper($p['countrycode']) : null,
                    'latitude'    => (float) $coords[1],
                    'longitude'   => (float) $coords[0],
                    'type'        => $isCountry ? 'country' : 'city',
                ];
            }

            // Doublons (même nom, même région, même pays) : on garde le premier
            $seen = [];
            return array_values(array_filter($results, function ($r) use (&$seen) {
                $key = mb_strtolower($r['name'] . '|' . $r['region'] . '|' . $r['countryCode']);
                if (isset($seen[$key])) return false;
                return $seen[$key] = true;
            }));
        });
    }
}
