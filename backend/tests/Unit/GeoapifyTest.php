<?php

namespace App\Tests\Unit;

use App\Service\GeoSearch;
use PHPUnit\Framework\TestCase;
use Symfony\Component\ErrorHandler\BufferingLogger;
use Symfony\Component\Cache\Adapter\ArrayAdapter;
use Symfony\Component\HttpClient\MockHttpClient;
use Symfony\Component\HttpClient\Response\MockResponse;

/** Recherche par Geoapify (si la clé est configurée), Photon en secours */
final class GeoapifyTest extends TestCase
{
    /** @var list<string> */
    private array $calls = [];
    private BufferingLogger $logger;

    private function geo(?string $key, callable $answer): GeoSearch
    {
        $client = new MockHttpClient(function (string $method, string $url) use ($answer) {
            $this->calls[] = $url;
            return $answer($url);
        });
        $this->logger = new BufferingLogger();
        return new GeoSearch($client, new ArrayAdapter(), $this->logger, $key);
    }

    private static function feature(array $props, float $lon, float $lat): array
    {
        return ['type' => 'Feature', 'geometry' => ['type' => 'Point', 'coordinates' => [$lon, $lat]], 'properties' => $props];
    }

    public function testCitiesAndCountriesComeFromGeoapify(): void
    {
        $geo = $this->geo('cle-secrete', function (string $url) {
            parse_str((string) parse_url($url, PHP_URL_QUERY), $q);
            self::assertSame('cle-secrete', $q['apiKey']);
            $features = ($q['type'] ?? '') === 'city'
                ? [self::feature(['result_type' => 'city', 'city' => 'Lyon', 'postcode' => '69001', 'state' => 'Auvergne-Rhône-Alpes', 'country' => 'France', 'country_code' => 'fr'], 4.8357, 45.764)]
                : [];
            return new MockResponse(json_encode(['type' => 'FeatureCollection', 'features' => $features]));
        });

        $results = $geo->search('Lyon');
        self::assertCount(2, $this->calls, 'Villes et pays : deux requêtes');
        self::assertStringNotContainsString('photon', implode(' ', $this->calls));
        self::assertSame('Lyon', $results[0]['name']);
        self::assertSame('Lyon, France', $results[0]['label']);
        self::assertSame('FR', $results[0]['countryCode']);
        self::assertSame('city', $results[0]['type']);
        self::assertEqualsWithDelta(45.764, $results[0]['latitude'], 0.001);
    }

    public function testFallsBackToPhotonWhenGeoapifyFailsWithoutLoggingTheKey(): void
    {
        $geo = $this->geo('cle-secrete', function (string $url) {
            if (str_contains($url, 'geoapify')) return new MockResponse('{"message":"quota"}', ['http_code' => 429]);
            return new MockResponse(json_encode(['type' => 'FeatureCollection', 'features' => [
                self::feature(['name' => 'Angers', 'type' => 'city', 'country' => 'France', 'countrycode' => 'FR'], -0.55, 47.47),
            ]]));
        });

        $results = $geo->search('Angers');
        self::assertSame('Angers', $results[0]['name']);
        self::assertStringContainsString('photon.komoot.io', end($this->calls));
        $logs = json_encode($this->logger->cleanLogs());
        self::assertStringContainsString('Geoapify indisponible', $logs);
        self::assertStringNotContainsString('cle-secrete', $logs, 'La clé ne doit jamais apparaître dans les journaux');
    }

    public function testWithoutKeyOnlyPhotonIsUsed(): void
    {
        $geo = $this->geo(null, fn () => new MockResponse(json_encode(['type' => 'FeatureCollection', 'features' => []])));
        $geo->search('Paris');
        self::assertCount(1, $this->calls);
        self::assertStringContainsString('photon.komoot.io', $this->calls[0]);
    }

    public function testStationsAndAirportsComeFromGeoapifyPlaces(): void
    {
        $geo = $this->geo('cle-secrete', function (string $url) {
            parse_str((string) parse_url($url, PHP_URL_QUERY), $q);
            $features = match ($q['categories'] ?? '') {
                'public_transport.train' => [self::feature(['name' => 'Angers Saint-Laud', 'city' => 'Angers'], -0.5566, 47.4645)],
                'airport'                => [self::feature(['name' => 'Aéroport Nantes-Atlantique', 'city' => 'Bouguenais'], -1.6083, 47.1519)],
                default                  => [],
            };
            return new MockResponse(json_encode(['type' => 'FeatureCollection', 'features' => $features]));
        });

        $hubs = $geo->hubs('Angers', 47.4784, -0.5632);
        self::assertSame(['Angers Saint-Laud', 'Aéroport Nantes-Atlantique'], array_column($hubs, 'name'));
        self::assertSame(['train', 'avion'], array_column($hubs, 'kind'));
        parse_str((string) parse_url($this->calls[0], PHP_URL_QUERY), $first);
        self::assertSame('circle:-0.5632,47.4784,25000', $first['filter'], 'Gares à moins de 25 km');
    }
}
