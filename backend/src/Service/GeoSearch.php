<?php

namespace App\Service;

use Psr\Log\LoggerInterface;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Recherche de villes et de pays (autocomplétion de la destination d'un voyage).
 *
 * Fournisseur : Photon (photon.komoot.io), géocodeur gratuit basé sur OpenStreetMap, à utiliser
 * avec modération : les résultats sont gardés en cache 7 jours et les appels limités par utilisateur.
 */
final class GeoSearch
{
    private const URL = 'https://photon.komoot.io/api/';
    private const USER_AGENT = 'Talaria/1.0 (+https://talaria.world)';
    private const LIMIT = 6;

    public function __construct(
        private HttpClientInterface $httpClient,
        private CacheInterface $cache,
        private LoggerInterface $logger,
    ) {}

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
            try {
                // Villes, villages et pays, noms en français
                $response = $this->httpClient->request('GET', self::URL . '?' . http_build_query(['q' => $query, 'lang' => 'fr', 'limit' => self::LIMIT])
                    . '&layer=city&layer=country', [
                    'headers' => ['User-Agent' => self::USER_AGENT],
                    'timeout' => 6,
                ]);
                $features = $response->toArray()['features'] ?? [];
            } catch (\Throwable $e) {
                // Service indisponible : rien en cache, l'app laisse saisir la destination librement
                $item->expiresAfter(1);
                $this->logger->warning('Recherche de lieux (Photon) indisponible : {message}', ['message' => $e->getMessage()]);
                throw new GeoSearchUnavailable($e->getMessage(), 0, $e);
            }

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
