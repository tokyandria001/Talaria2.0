<?php

namespace App\Tests\Functional;

use App\Entity\Place;
use App\Tests\ApiTestCase;
use Doctrine\ORM\EntityManagerInterface;

/** Logements proposés par Talaria : lieux de la base puis OpenStreetMap, prix estimé, lien de réservation */
final class AccommodationSuggestTest extends ApiTestCase
{
    public function testSuggestsNearestAccommodationsWithEstimatedPrice(): void
    {
        $token = $this->registerAndLogin();
        $this->json('PATCH', '/api/profile', ['travelStyle' => 'budget'], $token);

        // Un hôtel de la base, au centre de Lyon (proposé en premier) ; un camping, d'un autre type
        $em = static::getContainer()->get(EntityManagerInterface::class);
        $em->persist((new Place())->setName('Grand Hôtel Bellecour')->setTags(['hotel'])->setLatitude(45.7575)->setLongitude(4.8320));
        $em->persist((new Place())->setName('Camping de la Saône')->setTags(['camping'])->setLatitude(45.7600)->setLongitude(4.8350));
        $em->flush();

        [$code, $data] = $this->json('GET', '/api/geo/accommodations?lat=45.7578&lon=4.8320&type=hotel&checkIn=2027-05-01&checkOut=2027-05-04&travelers=2&city=Lyon', null, $token);
        self::assertSame(200, $code);
        $list = $data['suggestions'];
        self::assertSame(['Grand Hôtel Bellecour', 'Hôtel des Célestins'], array_column($list, 'name'), 'Sans doublon, sans nom vague, sans hôtel lointain');
        self::assertSame(240, $list[0]['estimatedPrice'], '40 €/pers/nuit (budget) × 3 nuits × 2 voyageurs');
        self::assertSame('4 Rue des Archers, 69002 Lyon', $list[1]['address']);
        self::assertStringContainsString('booking.com', $list[0]['link']);
        self::assertStringContainsString('checkin=2027-05-01', $list[0]['link']);

        [$code] = $this->json('GET', '/api/geo/accommodations?lat=45.75&lon=4.83&checkIn=2027-05-04&checkOut=2027-05-01', null, $token);
        self::assertSame(400, $code);
    }

    public function testSuggestedAccommodationIsFlagged(): void
    {
        $token = $this->registerAndLogin();
        [, $trip] = $this->json('POST', '/api/trips', [
            'destination' => 'Lyon', 'departureCity' => 'Paris', 'startDate' => '2027-05-01', 'endDate' => '2027-05-04',
        ], $token);

        [$code, $a] = $this->json('POST', "/api/trips/{$trip['id']}/accommodations", [
            'name' => 'Grand Hôtel Bellecour', 'type' => 'hotel', 'checkIn' => '2027-05-01', 'checkOut' => '2027-05-04', 'price' => 240, 'suggested' => true,
        ], $token);
        self::assertSame(201, $code);
        self::assertTrue($a['suggested']);

        [, $log] = $this->json('GET', "/api/trips/{$trip['id']}/logistics", null, $token);
        self::assertTrue($log['accommodations'][0]['suggested']);
    }
}
