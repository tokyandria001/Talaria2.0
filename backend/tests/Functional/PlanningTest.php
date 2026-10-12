<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;

/** Logements, planning (phase 5) et restos / prix par défaut (phase 6) */
final class PlanningTest extends ApiTestCase
{
    public function testAccommodationLifecycleAndValidation(): void
    {
        $token = $this->registerAndLogin();
        $trip = $this->createTrip($token);
        $base = "/api/trips/{$trip['id']}/accommodations";

        [$code, $hotel] = $this->json('POST', $base, [
            'name' => 'Hotel Roma', 'type' => 'hotel', 'checkIn' => '2027-06-01', 'checkOut' => '2027-06-03',
            'price' => 240, 'hasSpecialPrice' => true, 'specialPriceNote' => '-10% CE', 'link' => 'https://booking.com/roma',
        ], $token);
        self::assertSame(201, $code);
        self::assertTrue($hotel['hasSpecialPrice']);

        [$code] = $this->json('POST', $base, ['name' => 'X', 'checkIn' => '2027-06-03', 'checkOut' => '2027-06-01'], $token);
        self::assertSame(422, $code, 'Départ avant arrivée');

        [$code] = $this->json('POST', $base, ['name' => 'X', 'checkIn' => '2027-06-01', 'checkOut' => '2027-06-02', 'price' => -1], $token);
        self::assertSame(422, $code, 'Prix négatif');

        [$code] = $this->json('POST', $base, ['name' => 'X', 'checkIn' => '2027-06-01', 'checkOut' => '2027-06-02', 'link' => 'ftp://x.com'], $token);
        self::assertSame(422, $code, 'Lien non web');

        [$code] = $this->json('DELETE', "$base/{$hotel['id']}", null, $token);
        self::assertSame(204, $code);
    }

    public function testGenerateFillsMorningAndLunchAndKeepsManualActivities(): void
    {
        $token = $this->registerAndLogin();
        $trip = $this->createTrip($token); // 3 jours
        $base = "/api/trips/{$trip['id']}/activities";

        [$code] = $this->json('POST', $base, ['date' => '2027-06-02', 'slot' => 'matin', 'title' => 'Visite privée', 'price' => 50], $token);
        self::assertSame(201, $code);

        [$code, $data] = $this->json('POST', "$base/generate", [], $token);
        self::assertSame(200, $code);
        self::assertSame(5, $data['created'], '3 jours × 2 créneaux − 1 créneau déjà pris');
        self::assertCount(6, $data['activities']);

        $manual = array_values(array_filter($data['activities'], fn ($a) => !$a['isAuto']));
        self::assertCount(1, $manual);
        self::assertSame('Visite privée', $manual[0]['title']);

        foreach ($data['activities'] as $a) {
            self::assertNotNull($a['price'], "Chaque activité générée a un prix ({$a['title']})");
        }

        // Une 2e génération ne crée pas de doublons
        [, $again] = $this->json('POST', "$base/generate", [], $token);
        self::assertSame(0, $again['created']);
    }

    public function testGenerateOnlyUsesPlacesNearTheDestination(): void
    {
        $token = $this->registerAndLogin();
        $this->json('POST', '/api/places', ['name' => 'Colisée', 'latitude' => 41.89, 'longitude' => 12.49, 'tags' => ['musee'], 'averagePrice' => 18], $token);
        $this->json('POST', '/api/places', ['name' => 'Trattoria', 'latitude' => 41.90, 'longitude' => 12.48, 'tags' => ['restaurant'], 'averagePrice' => 22], $token);
        $this->json('POST', '/api/places', ['name' => 'Louvre', 'latitude' => 48.86, 'longitude' => 2.33, 'tags' => ['musee']], $token);
        $trip = $this->createTrip($token);

        [, $data] = $this->json('POST', "/api/trips/{$trip['id']}/activities/generate", ['lat' => 41.9, 'lng' => 12.5], $token);
        $titles = array_column($data['activities'], 'title');

        self::assertContains('Colisée', $titles);
        self::assertContains('Trattoria', $titles);
        self::assertNotContains('Louvre', $titles, 'Lieu à Paris exclu pour un voyage à Rome');

        $colisee = array_values(array_filter($data['activities'], fn ($a) => $a['title'] === 'Colisée'))[0];
        self::assertSame(18, $colisee['price'], 'Le prix moyen du lieu est repris');
        self::assertSame('matin', $colisee['slot']);
    }

    public function testRestaurantGetsDefaultAveragePrice(): void
    {
        $token = $this->registerAndLogin();
        $trip = $this->createTrip($token);
        $base = "/api/trips/{$trip['id']}/activities";

        [, $defaults] = $this->json('GET', '/api/price-defaults', null, $token);

        [$code, $resto] = $this->json('POST', $base, ['date' => '2027-06-01', 'slot' => 'midi', 'title' => 'Pizzeria', 'category' => 'restaurant'], $token);
        self::assertSame(201, $code);
        self::assertSame($defaults['restaurant'], $resto['price']);

        [, $bar] = $this->json('POST', $base, ['date' => '2027-06-01', 'slot' => 'soir', 'title' => 'Bar', 'category' => 'bar', 'price' => 8], $token);
        self::assertSame(8, $bar['price'], 'Un prix saisi est conservé');
    }

    public function testActivityValidation(): void
    {
        $token = $this->registerAndLogin();
        $trip = $this->createTrip($token);
        $base = "/api/trips/{$trip['id']}/activities";

        [$code] = $this->json('POST', $base, ['date' => '2030-01-01', 'title' => 'Hors voyage'], $token);
        self::assertSame(400, $code);

        [$code] = $this->json('POST', $base, ['date' => '2027-06-01', 'slot' => 'nuit', 'title' => 'Créneau inconnu'], $token);
        self::assertSame(422, $code);

        [$code] = $this->json('POST', $base, ['date' => '2027-06-01', 'title' => '   '], $token);
        self::assertSame(422, $code);

        [$code] = $this->json('POST', $base, ['date' => '2027-06-01', 'title' => 'x', 'price' => -5], $token);
        self::assertSame(422, $code);
    }
}
