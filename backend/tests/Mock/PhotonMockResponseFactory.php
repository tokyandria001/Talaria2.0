<?php

namespace App\Tests\Mock;

use Symfony\Component\HttpClient\Response\MockResponse;
use Symfony\Contracts\HttpClient\ResponseInterface;

/**
 * Réponses de Photon simulées pendant les tests (aucun appel réseau).
 * « panne » simule un service indisponible ; chaque appel est compté dans $calls.
 */
final class PhotonMockResponseFactory
{
    public static int $calls = 0;

    /** Certificats publics renvoyés pour la connexion Google (kid => certificat PEM), fixés par le test */
    public static array $googleCerts = [];

    /**
     * Webhooks reçus pendant les tests : [en-têtes (noms en minuscules), corps JSON]
     * @var list<array{0: array<string, string>, 1: string}>
     */
    public static array $webhooks = [];

    public function __invoke(string $method, string $url, array $options = []): ResponseInterface
    {
        self::$calls++;
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
        if (($query['q'] ?? '') === 'panne' || str_contains($url, '0.00000,0.00000')) {
            return new MockResponse('', ['http_code' => 503]);
        }
        if (str_starts_with($url, 'https://hooks.talaria.test/')) {
            $headers = [];
            foreach ($options['headers'] ?? [] as $h) {
                [$k, $v] = explode(': ', $h, 2);
                $headers[strtolower($k)] = $v;
            }
            self::$webhooks[] = [$headers, $options['body'] ?? ''];
            return new MockResponse('', ['http_code' => 204]);
        }
        if (str_contains($url, 'googleapis.com/oauth2/v1/certs')) {
            return new MockResponse(json_encode(self::$googleCerts));
        }
        if (str_contains($url, 'router.project-osrm.org')) {
            $points = substr_count((string) parse_url($url, PHP_URL_PATH), ';') + 1;
            $legs = array_fill(0, $points - 1, ['distance' => 465_800 / ($points - 1), 'duration' => 17_880 / ($points - 1)]);
            return new MockResponse(json_encode(['code' => 'Ok', 'routes' => [[
                'distance' => 465_800, 'duration' => 17_880, 'legs' => $legs,
                'geometry' => ['type' => 'LineString', 'coordinates' => [[2.352222, 48.856614], [3.5, 47.3], [4.835659, 45.764043]]],
            ]]]));
        }
        // Gares (dont une station de métro et une gare lointaine, écartées) et aéroports autour d'Angers
        if (($query['osm_tag'] ?? '') === 'railway:station') {
            return new MockResponse(json_encode(['type' => 'FeatureCollection', 'features' => [
                $this->feature('Angers Saint-Laud', 'house', [-0.5566, 47.4645], ['city' => 'Angers']),
                $this->feature('Gare du Nord (Métro)', 'house', [-0.55, 47.47], ['city' => 'Angers']),
                $this->feature('Gare Montparnasse', 'house', [2.3191, 48.8400], ['city' => 'Paris']),
            ]]));
        }
        if (($query['osm_tag'] ?? '') === 'aeroway:aerodrome') {
            return new MockResponse(json_encode(['type' => 'FeatureCollection', 'features' => [
                $this->feature('Aéroport Nantes-Atlantique', 'house', [-1.6083, 47.1519], ['city' => 'Saint-Aignan-Grandlieu']),
                $this->feature("Aéroport d'Angers-Loire", 'house', [-0.3138, 47.5598], ['city' => 'Seiches-sur-le-Loir']),
                $this->feature('Aéroport Lyon Saint-Exupéry', 'house', [5.0811, 45.7256], ['city' => 'Colombier']),
            ]]));
        }
        // Hôtels autour de Lyon : un nom vague (« Hotel »), un doublon de la base et un hôtel trop loin, écartés
        if (($query['osm_tag'] ?? '') === 'tourism:camp_site') {
            return new MockResponse(json_encode(['type' => 'FeatureCollection', 'features' => []]));
        }
        if (($query['osm_tag'] ?? '') === 'tourism:hotel') {
            return new MockResponse(json_encode(['type' => 'FeatureCollection', 'features' => [
                $this->feature('Hotel', 'house', [4.835, 45.760], ['city' => 'Lyon']),
                $this->feature('Hôtel des Célestins', 'house', [4.831, 45.759], ['housenumber' => '4', 'street' => 'Rue des Archers', 'postcode' => '69002', 'city' => 'Lyon']),
                $this->feature('Grand Hôtel Bellecour', 'house', [4.832, 45.757], ['city' => 'Lyon']),
                $this->feature('Hôtel de Vienne', 'house', [4.874, 45.525], ['city' => 'Vienne']),
            ]]));
        }
        if (str_starts_with((string) ($query['q'] ?? ''), 'adresse')) {
            return new MockResponse(json_encode(['type' => 'FeatureCollection', 'features' => [
                $this->feature('', 'house', [2.33, 48.87], ['housenumber' => '12', 'street' => 'Rue de la Paix', 'postcode' => '75002', 'city' => 'Paris', 'country' => 'France']),
                $this->feature('Hôtel Ibis Styles Lyon Confluence', 'house', [4.82, 45.74], ['street' => 'Rue Ravat', 'postcode' => '69002', 'city' => 'Lyon', 'country' => 'France']),
            ]]));
        }

        return new MockResponse(json_encode(['type' => 'FeatureCollection', 'features' => [
            $this->feature('Monterrey', 'city', [-100.31, 25.67], ['state' => 'Nuevo León', 'country' => 'Mexique', 'countrycode' => 'MX']),
            $this->feature('Saint-Étienne', 'city', [4.387, 45.440], ['postcode' => '42000', 'county' => 'Loire', 'state' => 'Auvergne-Rhône-Alpes', 'country' => 'France', 'countrycode' => 'FR']),
            $this->feature('Saint-Étienne', 'city', [4.387, 45.440], ['postcode' => '42000', 'county' => 'Loire', 'country' => 'France', 'countrycode' => 'FR']),
            $this->feature('Thaïlande', 'country', [100.9, 15.1], ['countrycode' => 'TH']),
        ]]));
    }

    private function feature(string $name, string $type, array $coords, array $props): array
    {
        return ['type' => 'Feature', 'geometry' => ['type' => 'Point', 'coordinates' => $coords], 'properties' => array_filter(['name' => $name, 'type' => $type]) + $props];
    }
}
