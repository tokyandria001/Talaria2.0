<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use App\Tests\Mock\PhotonMockResponseFactory;

/** Autocomplétion des destinations (Photon simulé) et position enregistrée sur le voyage */
final class GeoTest extends ApiTestCase
{
    public function testSearchReturnsCitiesWithDetailsAndCountries(): void
    {
        $token = $this->registerAndLogin();
        $query = 'mont-' . uniqid(); // pas encore en cache

        [$code, $data] = $this->json('GET', '/api/geo/search?q=' . urlencode($query), null, $token);
        self::assertSame(200, $code);
        $results = $data['results'];
        self::assertCount(3, $results, 'Doublon Saint-Étienne retiré');

        self::assertSame('Monterrey, Mexique', $results[0]['label']);
        self::assertSame('MX', $results[0]['countryCode']);
        self::assertEqualsWithDelta(25.67, $results[0]['latitude'], 0.001);
        self::assertSame('42000 · Loire · France', $results[1]['details']);
        self::assertSame('country', $results[2]['type']);
        self::assertSame('Pays', $results[2]['details']);

        // Même recherche : servie par le cache, sans nouvel appel au service
        $calls = PhotonMockResponseFactory::$calls;
        $this->json('GET', '/api/geo/search?q=' . urlencode($query), null, $token);
        self::assertSame($calls, PhotonMockResponseFactory::$calls);

        [, $short] = $this->json('GET', '/api/geo/search?q=a', null, $token);
        self::assertSame([], $short['results'], '2 caractères minimum');
    }

    public function testAddressSearchAndDrivingRoute(): void
    {
        $token = $this->registerAndLogin();
        [$code, $data] = $this->json('GET', '/api/geo/search?type=address&lat=45.76&lon=4.84&q=' . urlencode('adresse ' . uniqid()), null, $token);
        self::assertSame(200, $code);
        self::assertSame('12 Rue de la Paix', $data['results'][0]['name']);
        self::assertSame('75002 Paris, France', $data['results'][0]['details']);
        self::assertSame('Hôtel Ibis Styles Lyon Confluence', $data['results'][1]['name']);
        self::assertSame('Rue Ravat, 69002 Lyon, France', $data['results'][1]['details']);

        [$code, $route] = $this->json('GET', '/api/geo/route?from=48.8566,2.3522&to=45.7640,' . (4.8357 + mt_rand(1, 999) / 1e6), null, $token);
        self::assertSame(200, $code);
        self::assertSame(466, $route['distanceKm']);
        self::assertSame(298, $route['durationMin']);
        // Tracé de la route pour la carte : [lon, lat] arrondis à 5 décimales
        self::assertSame('LineString', $route['geometry']['type']);
        self::assertSame([[2.35222, 48.85661], [3.5, 47.3], [4.83566, 45.76404]], $route['geometry']['coordinates']);

        [$code] = $this->json('GET', '/api/geo/route?from=nord&to=45,4', null, $token);
        self::assertSame(400, $code);
        [$code] = $this->json('GET', '/api/geo/route?from=0,0&to=0,0', null, $token);
        self::assertSame(503, $code);
    }

    public function testUnavailableServiceIsReported(): void
    {
        $token = $this->registerAndLogin();
        [$code, $data] = $this->json('GET', '/api/geo/search?q=panne', null, $token);
        self::assertSame(503, $code);
        self::assertSame([], $data['results']);
    }

    public function testTripKeepsTheChosenDestination(): void
    {
        $token = $this->registerAndLogin();
        [$code, $trip] = $this->json('POST', '/api/trips', [
            'destination' => 'Monterrey', 'departureCity' => 'Paris', 'startDate' => '2027-07-19', 'endDate' => '2027-07-21',
            'destinationLatitude' => 25.67, 'destinationLongitude' => -100.31,
            'destinationCountry' => 'Mexique', 'destinationCountryCode' => 'mx',
        ], $token);
        self::assertSame(201, $code);
        self::assertSame(25.67, $trip['destinationLatitude']);
        self::assertSame('MX', $trip['destinationCountryCode']);

        // Même destination renvoyée par le formulaire de modification : la position est gardée
        [, $same] = $this->json('PATCH', "/api/trips/{$trip['id']}", ['destination' => 'Monterrey', 'budget' => 900], $token);
        self::assertSame(25.67, $same['destinationLatitude']);

        // Destination retapée sans suggestion : l'ancienne position est oubliée
        [, $edited] = $this->json('PATCH', "/api/trips/{$trip['id']}", ['destination' => 'Lisbonne'], $token);
        self::assertNull($edited['destinationLatitude']);
        self::assertNull($edited['destinationCountryCode']);

        [$code] = $this->json('PATCH', "/api/trips/{$trip['id']}", ['destinationLatitude' => 'nord'], $token);
        self::assertSame(400, $code);
    }
}
