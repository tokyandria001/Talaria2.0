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

    public function __invoke(string $method, string $url, array $options = []): ResponseInterface
    {
        self::$calls++;
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
        if (($query['q'] ?? '') === 'panne') {
            return new MockResponse('', ['http_code' => 503]);
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
        return ['type' => 'Feature', 'geometry' => ['type' => 'Point', 'coordinates' => $coords], 'properties' => ['name' => $name, 'type' => $type] + $props];
    }
}
