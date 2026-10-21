<?php

namespace App\Service;

use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\ResponseInterface;

/**
 * Recherche de villes et de pays (destination d'un voyage), d'adresses (logement) et itinéraires routiers.
 *
 * Fournisseurs basés sur OpenStreetMap, à utiliser avec modération (cache + limite par utilisateur) :
 * - Geoapify (clé GEOAPIFY_API_KEY, offre gratuite 3 000 requêtes/jour) pour les lieux, les adresses,
 *   les gares, aéroports et logements ; ses réponses sont converties au format de Photon ;
 * - Photon (photon.komoot.io) en secours : sans clé, ou si Geoapify ne répond pas / quota atteint ;
 * - OSRM (router.project-osrm.org, serveur de démonstration) pour la distance en voiture.
 */
final class GeoSearch
{
    private const URL = 'https://photon.komoot.io/api/';
    private const GEOAPIFY_URL = 'https://api.geoapify.com/';
    private const ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving/';
    private const USER_AGENT = 'Talaria/1.0 (+https://talaria.world)';
    private const LIMIT = 6;

    public function __construct(
        private HttpClientInterface $httpClient,
        private CacheInterface $cache,
        private LoggerInterface $logger,
        #[Autowire('%env(default::GEOAPIFY_API_KEY)%')] private ?string $geoapifyKey = null,
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
            $features = $this->geoapify('v1/geocode/autocomplete', ['text' => $query, 'lang' => 'fr', 'limit' => self::LIMIT]
                    + ($bias ? ['bias' => "proximity:{$bias['lon']},{$bias['lat']}"] : []))
                ?? $this->photon(['q' => $query, 'lang' => 'fr', 'limit' => self::LIMIT] + $bias);

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

    /** Étapes intermédiaires au plus, entre le départ et l'arrivée */
    public const MAX_VIA = 10;

    /**
     * Itinéraire en voiture, avec des étapes intermédiaires facultatives ($via : liste de [lat, lon]) :
     * distance (km), durée (min), tracé de la route (GeoJSON LineString, coordonnées [lon, lat] qui suivent
     * la route à 3 m près) et un tronçon par étape (legs). Gardé en cache 30 jours.
     *
     * @param list<array{0: float, 1: float}> $via
     * @return array{distanceKm: int, durationMin: int, legs: list<array{distanceKm: int, durationMin: int}>, geometry: array{type: string, coordinates: list<array{0: float, 1: float}>}|null}
     */
    public function route(float $fromLat, float $fromLon, float $toLat, float $toLon, array $via = []): array
    {
        $points = [[$fromLat, $fromLon], ...array_slice($via, 0, self::MAX_VIA), [$toLat, $toLon]];
        $path = implode(';', array_map(fn (array $p) => sprintf('%.5f,%.5f', $p[1], $p[0]), $points));

        // v4 : tracé précis (les entrées en cache plus anciennes, moins précises, sont ignorées)
        return $this->cache->get('geo_route_v4_' . md5($path), function (ItemInterface $item) use ($path) {
            $item->expiresAfter(30 * 86400);
            try {
                // overview=full : le tracé suit la route (simplified coupe en ligne droite entre de rares points) ;
                // il est ensuite allégé par traceRoute() sans perdre la forme des virages
                $data = $this->httpClient->request('GET', self::ROUTE_URL . $path . '?overview=full&geometries=geojson', [
                    'headers' => ['User-Agent' => self::USER_AGENT],
                    'timeout' => 8,
                ])->toArray();
            } catch (\Throwable $e) {
                $this->logger->warning('Itinéraire (OSRM) indisponible : {message}', ['message' => $e->getMessage()]);
                throw new GeoSearchUnavailable($e->getMessage(), 0, $e);
            }
            $route = $data['routes'][0] ?? null;
            if (($data['code'] ?? '') !== 'Ok' || !$route) throw new GeoSearchUnavailable('Aucun itinéraire');

            return [
                'distanceKm'  => (int) round($route['distance'] / 1000),
                'durationMin' => (int) round($route['duration'] / 60),
                // Un tronçon par étape : départ → étape 1 → … → arrivée
                'legs'        => array_map(fn (array $leg) => [
                    'distanceKm'  => (int) round(($leg['distance'] ?? 0) / 1000),
                    'durationMin' => (int) round(($leg['duration'] ?? 0) / 60),
                ], array_values(array_filter($route['legs'] ?? [], 'is_array'))),
                'geometry'    => $this->traceRoute($route['geometry'] ?? null),
            ];
        });
    }

    /** Tracé : écart toléré par rapport à la route (m), et nombre de points au plus */
    private const TRACE_TOLERANCE_M = 3.0;
    private const TRACE_MAX_POINTS = 5000;

    /**
     * Tracé GeoJSON allégé sans perdre la forme de la route : les points des lignes droites sont retirés,
     * ceux des virages gardés (Douglas-Peucker, 3 m d'écart au plus ; tolérance doublée si le trajet
     * dépasse 5 000 points). Coordonnées arrondies à 5 décimales (environ 1 m).
     *
     * @return array{type: string, coordinates: list<array{0: float, 1: float}>}|null
     */
    private function traceRoute(mixed $geometry): ?array
    {
        $coords = is_array($geometry) && ($geometry['type'] ?? '') === 'LineString' && is_array($geometry['coordinates'] ?? null)
            ? $geometry['coordinates'] : [];
        $coords = array_values(array_map(
            fn ($c) => [(float) $c[0], (float) $c[1]],
            array_filter($coords, fn ($c) => is_array($c) && count($c) >= 2 && is_numeric($c[0]) && is_numeric($c[1])),
        ));
        if (count($coords) < 2) return null;

        $tolerance = self::TRACE_TOLERANCE_M;
        $kept = $this->simplify($coords, $tolerance);
        while (count($kept) > self::TRACE_MAX_POINTS) {
            $tolerance *= 2;
            $kept = $this->simplify($coords, $tolerance);
        }

        return [
            'type'        => 'LineString',
            'coordinates' => array_map(fn ($c) => [round($c[0], 5), round($c[1], 5)], $kept),
        ];
    }

    /**
     * Douglas-Peucker (itératif) : garde les points qui s'écartent de plus de $toleranceM mètres
     * de la ligne entre les points gardés. Distances calculées sur une projection locale en mètres.
     *
     * @param list<array{0: float, 1: float}> $coords [lon, lat]
     * @return list<array{0: float, 1: float}>
     */
    private function simplify(array $coords, float $toleranceM): array
    {
        $n = count($coords);
        if ($n <= 2) return $coords;

        // [lon, lat] -> mètres (projection équirectangulaire autour de la latitude moyenne)
        $kx = 111_320 * cos(deg2rad(array_sum(array_column($coords, 1)) / $n));
        $ky = 110_540;
        $xy = array_map(fn ($c) => [$c[0] * $kx, $c[1] * $ky], $coords);

        $keep = array_fill(0, $n, false);
        $keep[0] = $keep[$n - 1] = true;
        $stack = [[0, $n - 1]];
        while ($stack) {
            [$first, $last] = array_pop($stack);
            [$ax, $ay] = $xy[$first];
            [$bx, $by] = $xy[$last];
            $dx = $bx - $ax;
            $dy = $by - $ay;
            $len2 = $dx * $dx + $dy * $dy;

            $maxDist = 0.0;
            $index = 0;
            for ($i = $first + 1; $i < $last; $i++) {
                [$px, $py] = $xy[$i];
                // Distance du point au segment [A, B]
                $t = $len2 > 0 ? max(0, min(1, (($px - $ax) * $dx + ($py - $ay) * $dy) / $len2)) : 0;
                $dist = hypot($px - ($ax + $t * $dx), $py - ($ay + $t * $dy));
                if ($dist > $maxDist) { $maxDist = $dist; $index = $i; }
            }
            if ($maxDist > $toleranceM) {
                $keep[$index] = true;
                $stack[] = [$first, $index];
                $stack[] = [$index, $last];
            }
        }

        return array_values(array_filter($coords, fn ($c, $i) => $keep[$i], ARRAY_FILTER_USE_BOTH));
    }

    /**
     * Gares et aéroports proches d'une ville (onboarding : « d'où pars-tu ? »).
     * Gares : celles de la ville à moins de 25 km ; aéroports : les plus proches à moins de 120 km.
     *
     * @return list<array{name: string, kind: string, city: ?string, distanceKm: int}>
     */
    public function hubs(string $city, float $lat, float $lon): array
    {
        $city = trim(mb_substr($city, 0, 80));
        $key = 'geo_hubs_' . md5(mb_strtolower($city) . sprintf('%.2f,%.2f', $lat, $lon));

        return $this->cache->get($key, function (ItemInterface $item) use ($city, $lat, $lon) {
            $item->expiresAfter(30 * 86400);
            $bias = ['lat' => round($lat, 3), 'lon' => round($lon, 3), 'lang' => 'fr', 'limit' => 10];
            $near = fn (string $categories, int $km) => $this->geoapify('v2/places', [
                'categories' => $categories, 'filter' => sprintf('circle:%.4f,%.4f,%d', $lon, $lat, $km * 1000),
                'bias' => sprintf('proximity:%.4f,%.4f', $lon, $lat), 'lang' => 'fr', 'limit' => 10,
            ]);
            $found = [
                'train' => [$near('public_transport.train', 25) ?? $this->photon(['q' => $city ?: 'gare', 'osm_tag' => 'railway:station'] + $bias), 25, 3],
                'avion' => [$near('airport', 120) ?? $this->photon(['q' => 'aéroport', 'osm_tag' => 'aeroway:aerodrome'] + $bias), 120, 3],
            ];

            $hubs = [];
            foreach ($found as $kind => [$features, $maxKm, $max]) {
                $list = [];
                foreach ($features as $f) {
                    $p = $f['properties'] ?? [];
                    $c = $f['geometry']['coordinates'] ?? null;
                    $name = trim((string) ($p['name'] ?? ''));
                    // Les stations de métro ne sont pas des gares de départ
                    if ($name === '' || !is_array($c) || stripos($name, 'métro') !== false) continue;
                    $km = self::distanceKm($lat, $lon, (float) $c[1], (float) $c[0]);
                    if ($km > $maxKm || isset($list[mb_strtolower($name)])) continue;
                    $list[mb_strtolower($name)] = ['name' => $name, 'kind' => $kind, 'city' => $p['city'] ?? null, 'distanceKm' => (int) round($km)];
                }
                usort($list, fn ($a, $b) => $a['distanceKm'] <=> $b['distanceKm']);
                array_push($hubs, ...array_slice($list, 0, $max));
            }
            return $hubs;
        });
    }

    /**
     * Établissements d'un type OpenStreetMap ($osmTag, ex. « tourism:hotel ») à moins de $maxKm d'un point.
     *
     * @return list<array{name: string, address: ?string, city: ?string, latitude: float, longitude: float, distanceKm: float}>
     */
    public function nearbyByTag(string $query, string $osmTag, float $lat, float $lon, float $maxKm): array
    {
        $key = 'geo_tag_' . md5($query . $osmTag . sprintf('%.3f,%.3f,%.1f', $lat, $lon, $maxKm));

        return $this->cache->get($key, function (ItemInterface $item) use ($query, $osmTag, $lat, $lon, $maxKm) {
            $item->expiresAfter(7 * 86400);
            $category = self::GEOAPIFY_CATEGORIES[$osmTag] ?? null;
            $features = ($category ? $this->geoapify('v2/places', [
                'categories' => $category, 'filter' => sprintf('circle:%.4f,%.4f,%d', $lon, $lat, (int) ($maxKm * 1000)),
                'bias' => sprintf('proximity:%.4f,%.4f', $lon, $lat), 'lang' => 'fr', 'limit' => 15,
            ]) : null)
                ?? $this->photon(['q' => $query, 'osm_tag' => $osmTag, 'lat' => round($lat, 3), 'lon' => round($lon, 3), 'lang' => 'fr', 'limit' => 15]);

            $results = [];
            foreach ($features as $f) {
                $p = $f['properties'] ?? [];
                $c = $f['geometry']['coordinates'] ?? null;
                if (empty($p['name']) || !is_array($c) || count($c) < 2) continue;
                $km = self::distanceKm($lat, $lon, (float) $c[1], (float) $c[0]);
                if ($km > $maxKm) continue;
                $street = trim(($p['housenumber'] ?? '') . ' ' . ($p['street'] ?? ''));
                $results[] = [
                    'name'       => $p['name'],
                    'address'    => implode(', ', array_filter([$street, trim(($p['postcode'] ?? '') . ' ' . ($p['city'] ?? ''))])) ?: null,
                    'city'       => $p['city'] ?? null,
                    'latitude'   => (float) $c[1],
                    'longitude'  => (float) $c[0],
                    'distanceKm' => round($km, 1),
                ];
            }
            return $results;
        });
    }

    public static function distanceKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $r = M_PI / 180;
        $a = sin(($lat2 - $lat1) * $r / 2) ** 2 + cos($lat1 * $r) * cos($lat2 * $r) * sin(($lon2 - $lon1) * $r / 2) ** 2;
        return 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    /** Types OpenStreetMap (Photon) → catégories Geoapify (logements proposés) */
    private const GEOAPIFY_CATEGORIES = [
        'tourism:hotel'       => 'accommodation.hotel',
        'tourism:hostel'      => 'accommodation.hostel',
        'tourism:apartment'   => 'accommodation.apartment',
        'tourism:guest_house' => 'accommodation.guest_house',
        'tourism:camp_site'   => 'camping.camp_site',
    ];

    /**
     * Appel à Geoapify, réponse convertie au format de Photon (lieux GeoJSON, propriétés « type » et « countrycode »).
     * Sans clé, ou en cas d'échec (panne, quota du jour atteint) : null, et l'appelant passe à Photon.
     *
     * @return list<array<string, mixed>>|null
     */
    private function geoapify(string $path, array $params): ?array
    {
        return $this->geoapifyRead($this->geoapifySend($path, $params));
    }

    /** Envoie la requête sans attendre la réponse (plusieurs requêtes partent ainsi en parallèle) */
    private function geoapifySend(string $path, array $params): ?ResponseInterface
    {
        if (!$this->geoapifyKey) return null;
        try {
            return $this->httpClient->request('GET', self::GEOAPIFY_URL . $path, [
                'query'   => $params + ['format' => 'geojson', 'apiKey' => $this->geoapifyKey],
                'headers' => ['User-Agent' => self::USER_AGENT],
                'timeout' => 4,
            ]);
        } catch (\Throwable $e) {
            $this->geoapifyFailed($e);
            return null;
        }
    }

    /** @return list<array<string, mixed>>|null */
    private function geoapifyRead(?ResponseInterface $response): ?array
    {
        if (!$response) return null;
        try {
            $data = $response->toArray();
        } catch (\Throwable $e) {
            $this->geoapifyFailed($e);
            return null;
        }

        return array_map(function (array $f) {
            $p = $f['properties'] ?? [];
            $type = $p['result_type'] ?? null;
            $p['type'] = $type;
            $p['countrycode'] = $p['country_code'] ?? null;
            // Villes et pays : Geoapify range souvent leur nom dans « city » / « country »
            $p['name'] ??= match ($type) { 'city' => $p['city'] ?? null, 'country' => $p['country'] ?? null, default => null };
            $f['properties'] = $p;
            return $f;
        }, array_values(array_filter($data['features'] ?? [], 'is_array')));
    }

    private function geoapifyFailed(\Throwable $e): void
    {
        // Le message d'erreur peut contenir l'URL, donc la clé : on ne journalise que le type d'erreur
        $this->logger->warning('Geoapify indisponible ({class}), secours Photon', ['class' => (new \ReflectionClass($e))->getShortName()]);
    }

    /**
     * Villes et pays en un seul tour : deux recherches Geoapify envoyées en parallèle (« city » et « country »).
     *
     * @return list<array<string, mixed>>|null
     */
    private function geoapifyCitiesAndCountries(string $query): ?array
    {
        if (!$this->geoapifyKey) return null;
        $base = ['text' => $query, 'lang' => 'fr', 'limit' => self::LIMIT];
        $countriesResponse = $this->geoapifySend('v1/geocode/autocomplete', $base + ['type' => 'country']);
        $citiesResponse = $this->geoapifySend('v1/geocode/autocomplete', $base + ['type' => 'city']);
        $countries = $this->geoapifyRead($countriesResponse);
        $cities = $this->geoapifyRead($citiesResponse);
        if ($cities === null && $countries === null) return null;

        // Un pays dont le nom correspond exactement passe devant (« Thaïlande »), sinon les villes d'abord
        $exact = array_filter($countries ?? [], fn ($f) => mb_strtolower((string) ($f['properties']['name'] ?? '')) === mb_strtolower($query));
        return array_slice($exact ? [...$countries ?? [], ...$cities ?? []] : [...$cities ?? [], ...$countries ?? []], 0, self::LIMIT);
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
            $features = $this->geoapifyCitiesAndCountries($query)
                ?? $this->photon(['q' => $query, 'lang' => 'fr', 'limit' => self::LIMIT], ['city', 'country']);

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
