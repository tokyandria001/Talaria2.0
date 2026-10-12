<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use PHPUnit\Framework\Attributes\DataProvider;

final class TripTest extends ApiTestCase
{
    public function testCreateListAndComputeCarCosts(): void
    {
        $token = $this->registerAndLogin();
        $trip = $this->createTrip($token, [
            'transportMode'     => 'voiture',
            'distanceKm'        => 500,
            'fuelPricePerLiter' => 2,
            'fuelConsumption'   => 6,
            'tollCost'          => 40,
        ]);

        // 500 km × 2 (A/R) × 6 L/100 km × 2 €/L = 120 €, + 40 € de péages
        self::assertSame(120, $trip['computedFuelCost']);
        self::assertSame(160, $trip['computedTotalCost']);

        [$code, $list] = $this->json('GET', '/api/trips', null, $token);
        self::assertSame(200, $code);
        self::assertCount(1, $list);
    }

    /** @return iterable<string, array{0: array, 1: int}> */
    public static function invalidTrips(): iterable
    {
        yield 'dates inversées'         => [['endDate' => '2027-05-01'], 422];
        yield 'date mal formée'         => [['startDate' => 'bonjour'], 400];
        yield 'date inexistante'        => [['startDate' => '2027-02-30'], 400];
        yield 'budget négatif'          => [['budget' => -500], 422];
        yield 'budget non numérique'    => [['budget' => 'abc'], 400];
        yield 'aucun voyageur'          => [['travelers' => 0], 422];
        yield 'péages négatifs'         => [['tollCost' => -1], 422];
        yield 'transport inconnu'       => [['transportMode' => 'fusée'], 422];
        yield 'lien de location javascript:' => [['rentalLink' => 'javascript:alert(1)'], 422];
        yield 'lien de réservation javascript:' => [['bookingLinks' => [['type' => 'hotel', 'label' => 'x', 'url' => 'javascript:alert(1)']]], 422];
    }

    #[DataProvider('invalidTrips')]
    public function testRejectsInvalidTrips(array $overrides, int $expectedCode): void
    {
        $token = $this->registerAndLogin();

        [$code, $data] = $this->json('POST', '/api/trips', $overrides + [
            'destination' => 'Rome', 'departureCity' => 'Paris',
            'startDate' => '2027-06-01', 'endDate' => '2027-06-05',
        ], $token);

        self::assertSame($expectedCode, $code);
        self::assertNotEmpty($data['message']);

        [, $list] = $this->json('GET', '/api/trips', null, $token);
        self::assertCount(0, $list, 'Aucun voyage ne doit être créé');
    }

    public function testAcceptsHttpsBookingLinks(): void
    {
        $token = $this->registerAndLogin();
        $trip = $this->createTrip($token, ['bookingLinks' => [['type' => 'hotel', 'label' => 'Hôtel', 'url' => 'https://booking.com/h']]]);

        self::assertSame('https://booking.com/h', $trip['bookingLinks'][0]['url']);
    }

    public function testInvalidUpdateIsRejectedAndNotSaved(): void
    {
        $token = $this->registerAndLogin();
        $trip = $this->createTrip($token);

        [$code] = $this->json('PATCH', "/api/trips/{$trip['id']}", ['endDate' => '2027-01-01'], $token);
        self::assertSame(422, $code);

        [, $reloaded] = $this->json('GET', "/api/trips/{$trip['id']}", null, $token);
        self::assertSame('2027-06-03', $reloaded['endDate']);
    }

    public function testCannotReadOrDeleteAnotherUsersTrip(): void
    {
        $owner = $this->registerAndLogin('owner@talaria.test');
        $trip = $this->createTrip($owner);

        $intruder = $this->registerAndLogin('intrus@talaria.test');

        [$code] = $this->json('GET', "/api/trips/{$trip['id']}", null, $intruder);
        self::assertSame(404, $code);

        [$code] = $this->json('DELETE', "/api/trips/{$trip['id']}", null, $intruder);
        self::assertSame(404, $code);

        [$code] = $this->json('GET', "/api/trips/{$trip['id']}/activities", null, $intruder);
        self::assertSame(404, $code);
    }
}
