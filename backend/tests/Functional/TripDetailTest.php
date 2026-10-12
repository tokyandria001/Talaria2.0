<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use App\Tests\SocialTestTrait;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/** Écran détail du voyage — onglet Planning : heures, photos des lieux, participants */
final class TripDetailTest extends ApiTestCase
{
    use SocialTestTrait;

    public function testActivityTimeDrivesSlotAndOrder(): void
    {
        $alice = $this->token('alice');
        $trip = $this->createTrip($alice);
        $base = "/api/trips/{$trip['id']}/activities";

        [$code, $dinner] = $this->json('POST', $base, ['date' => '2027-06-01', 'time' => '19:30', 'title' => 'Tacos'], $alice);
        self::assertSame(201, $code);
        self::assertSame('soir', $dinner['slot'], '19:30 → soir');
        self::assertSame('19:30', $dinner['time']);

        $this->json('POST', $base, ['date' => '2027-06-01', 'time' => '08:30', 'title' => 'Plongée'], $alice);
        $this->json('POST', $base, ['date' => '2027-06-01', 'time' => '10:30', 'title' => 'Marché'], $alice);

        [, $list] = $this->json('GET', $base, null, $alice);
        self::assertSame(['Plongée', 'Marché', 'Tacos'], array_column($list, 'title'), 'Triées par heure');

        // Changer de créneau sans heure efface l'heure devenue incohérente
        [, $moved] = $this->json('PATCH', "$base/{$dinner['id']}", ['slot' => 'midi'], $alice);
        self::assertSame('midi', $moved['slot']);
        self::assertNull($moved['time']);

        [$code] = $this->json('POST', $base, ['date' => '2027-06-01', 'time' => '25:00', 'title' => 'x'], $alice);
        self::assertSame(400, $code, 'Heure invalide');

        // Le remplissage automatique met des heures par défaut
        [, $generated] = $this->json('POST', "$base/generate", [], $alice);
        $times = array_column(array_filter($generated['activities'], fn ($a) => $a['isAuto']), 'time');
        self::assertContains('09:00', $times);
        self::assertContains('12:30', $times);
    }

    public function testPlacePhotosShowOnLinkedActivities(): void
    {
        $alice = $this->token('alice');
        [, $created] = $this->json('POST', '/api/places', ['name' => 'Cerro', 'latitude' => 25.6, 'longitude' => -100.2, 'tags' => ['nature']], $alice);
        $placeId = $created['place']['id'];

        // Image PNG 1×1 envoyée comme le ferait l'application
        $file = sys_get_temp_dir() . '/talaria-test.png';
        file_put_contents($file, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='));
        $this->client->request('POST', "/api/places/$placeId/photos", [], ['photo' => new UploadedFile($file, 'cerro.png', 'image/png', null, true)], [
            'HTTP_AUTHORIZATION' => "Bearer $alice",
        ]);
        self::assertSame(201, $this->client->getResponse()->getStatusCode(), $this->client->getResponse()->getContent());
        $photo = json_decode($this->client->getResponse()->getContent(), true)['place']['photos'][0];
        self::assertStringStartsWith('/uploads/places/', $photo);

        // Un autre utilisateur ne peut pas ajouter de photo
        $this->client->request('POST', "/api/places/$placeId/photos", [], [], ['HTTP_AUTHORIZATION' => 'Bearer ' . $this->token('bob')]);
        self::assertSame(403, $this->client->getResponse()->getStatusCode());

        // L'activité liée au lieu expose sa photo
        $trip = $this->createTrip($alice);
        [, $activity] = $this->json('POST', "/api/trips/{$trip['id']}/activities", ['date' => '2027-06-02', 'title' => 'Randonnée', 'placeId' => $placeId], $alice);
        self::assertSame($photo, $activity['place']['photo']);

        [$code, $after] = $this->json('DELETE', "/api/places/$placeId/photos/0", null, $alice);
        self::assertSame(200, $code);
        self::assertSame([], $after['place']['photos']);
        self::assertFileDoesNotExist(static::getContainer()->getParameter('kernel.project_dir') . '/public' . $photo);
    }

    public function testParticipants(): void
    {
        $solo = $this->createTrip($this->token('alice'));
        self::assertSame(['Alice'], array_column($solo['participants'], 'displayName'));

        $group = $this->groupWith('alice', 'bob');
        [, $groupTrip] = $this->json('POST', '/api/trips', [
            'destination' => 'Monterrey', 'departureCity' => 'Paris', 'startDate' => '2027-07-19', 'endDate' => '2027-07-21', 'groupId' => $group['id'],
        ], $this->token('alice'));
        self::assertSame(['Alice', 'Bob'], array_column($groupTrip['participants'], 'displayName'));
    }
}
