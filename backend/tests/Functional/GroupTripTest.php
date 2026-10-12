<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use App\Tests\SocialTestTrait;

/** Phase 8 (étape 3) — voyages de groupe : visibilité, droits, notifications */
final class GroupTripTest extends ApiTestCase
{
    use SocialTestTrait;

    private const TRIP = [
        'destination' => 'Monterrey', 'departureCity' => 'Paris',
        'startDate' => '2027-07-19', 'endDate' => '2027-07-21', 'transportMode' => 'avion',
    ];

    public function testGroupMembersSeeAndEditThePlanning(): void
    {
        $group = $this->groupWith('alice', 'bob');

        // Bob (simple membre) crée un voyage pour le groupe
        [$code, $trip] = $this->json('POST', '/api/trips', self::TRIP + ['groupId' => $group['id']], $this->token('bob'));
        self::assertSame(201, $code);
        self::assertSame($group['id'], $trip['group']['id']);
        self::assertSame('Bob', $trip['createdBy']['displayName']);

        // Alice le voit dans ses voyages et reçoit une notification
        [, $aliceTrips] = $this->json('GET', '/api/trips', null, $this->token('alice'));
        self::assertSame([$trip['id']], array_column($aliceTrips, 'id'));
        self::assertTrue($aliceTrips[0]['permissions']['canManage'], 'L\'organisateur du groupe gère le voyage');
        [, $notifs] = $this->json('GET', '/api/notifications', null, $this->token('alice'));
        self::assertSame('group_trip', $notifs[0]['type']);
        self::assertSame($trip['id'], $notifs[0]['trip']['id']);

        // Tous les membres modifient le planning (activités, logements)
        [$code] = $this->json('POST', "/api/trips/{$trip['id']}/activities", ['date' => '2027-07-20', 'slot' => 'midi', 'title' => 'Tacos', 'category' => 'restaurant'], $this->token('alice'));
        self::assertSame(201, $code);
        [$code] = $this->json('POST', "/api/trips/{$trip['id']}/accommodations", ['name' => 'Loft', 'checkIn' => '2027-07-19', 'checkOut' => '2027-07-21'], $this->token('alice'));
        self::assertSame(201, $code);
        [, $activities] = $this->json('GET', "/api/trips/{$trip['id']}/activities", null, $this->token('bob'));
        self::assertSame('Tacos', $activities[0]['title']);

        // L'écran du groupe affiche le prochain voyage
        [, $detail] = $this->json('GET', "/api/groups/{$group['id']}", null, $this->token('bob'));
        self::assertSame($trip['id'], $detail['nextTrip']['id']);
        self::assertCount(1, $detail['trips']);
    }

    public function testOnlyCreatorAndGroupOwnerManageTheTrip(): void
    {
        $group = $this->groupWith('alice', 'bob', 'chloe');
        [, $trip] = $this->json('POST', '/api/trips', self::TRIP + ['groupId' => $group['id']], $this->token('bob'));

        // Chloé (membre) : planning oui, infos du voyage non
        [$code] = $this->json('PATCH', "/api/trips/{$trip['id']}", ['budget' => 9999], $this->token('chloe'));
        self::assertSame(403, $code);
        [$code] = $this->json('DELETE', "/api/trips/{$trip['id']}", null, $this->token('chloe'));
        self::assertSame(403, $code);
        [, $seen] = $this->json('GET', "/api/trips/{$trip['id']}", null, $this->token('chloe'));
        self::assertFalse($seen['permissions']['canManage']);

        // Bob (créateur) et Alice (organisatrice) : oui
        [$code] = $this->json('PATCH', "/api/trips/{$trip['id']}", ['budget' => 4200], $this->token('bob'));
        self::assertSame(200, $code);
        [$code, $updated] = $this->json('PATCH', "/api/trips/{$trip['id']}", ['budget' => 4300], $this->token('alice'));
        self::assertSame(200, $code);
        self::assertSame(4300, $updated['budget']);
    }

    public function testNonMembersAndFormerMembersLoseAccess(): void
    {
        $group = $this->groupWith('alice', 'bob');
        [, $trip] = $this->json('POST', '/api/trips', self::TRIP + ['groupId' => $group['id']], $this->token('alice'));

        [$code] = $this->json('GET', "/api/trips/{$trip['id']}", null, $this->token('intrus'));
        self::assertSame(404, $code);
        [$code] = $this->json('POST', "/api/trips/{$trip['id']}/activities", ['date' => '2027-07-20', 'title' => 'x'], $this->token('intrus'));
        self::assertSame(404, $code);

        // Un invité qui n'a pas encore accepté ne voit pas les voyages
        $this->befriend('alice', 'chloe');
        $this->json('POST', "/api/groups/{$group['id']}/members", ['userIds' => [$this->user('chloe')['id']]], $this->token('alice'));
        [$code] = $this->json('GET', "/api/trips/{$trip['id']}", null, $this->token('chloe'));
        self::assertSame(404, $code);

        // Bob quitte le groupe : il perd l'accès
        $this->json('DELETE', "/api/groups/{$group['id']}/members/{$this->user('bob')['id']}", null, $this->token('bob'));
        [$code] = $this->json('GET', "/api/trips/{$trip['id']}", null, $this->token('bob'));
        self::assertSame(404, $code);
        [, $bobTrips] = $this->json('GET', '/api/trips', null, $this->token('bob'));
        self::assertCount(0, $bobTrips);
    }

    public function testCannotAttachATripToAGroupYouAreNotIn(): void
    {
        $group = $this->createGroup('alice');

        [$code] = $this->json('POST', '/api/trips', self::TRIP + ['groupId' => $group['id']], $this->token('bob'));
        self::assertSame(403, $code);

        // Un voyage perso peut être rattaché puis détaché par son créateur
        [, $trip] = $this->json('POST', '/api/trips', self::TRIP, $this->token('alice'));
        [, $attached] = $this->json('PATCH', "/api/trips/{$trip['id']}", ['groupId' => $group['id']], $this->token('alice'));
        self::assertSame($group['id'], $attached['group']['id']);
        [, $detached] = $this->json('PATCH', "/api/trips/{$trip['id']}", ['groupId' => null], $this->token('alice'));
        self::assertNull($detached['group']);
    }

    public function testPlanningChangesNotifyOtherMembersWithoutSpam(): void
    {
        $group = $this->groupWith('alice', 'bob');
        [, $trip] = $this->json('POST', '/api/trips', self::TRIP + ['groupId' => $group['id']], $this->token('alice'));

        for ($i = 0; $i < 3; $i++) {
            $this->json('POST', "/api/trips/{$trip['id']}/activities", ['date' => '2027-07-20', 'title' => "Activité $i"], $this->token('alice'));
        }

        [, $notifs] = $this->json('GET', '/api/notifications', null, $this->token('bob'));
        $updates = array_values(array_filter($notifs, fn ($n) => $n['type'] === 'trip_update'));
        self::assertCount(1, $updates, '3 modifications rapprochées = 1 seule notification');
        self::assertStringContainsString('a modifié le planning', $updates[0]['message']);

        [, $aliceNotifs] = $this->json('GET', '/api/notifications', null, $this->token('alice'));
        self::assertNotContains('trip_update', array_column($aliceNotifs, 'type'), 'On ne se notifie pas soi-même');
    }

    public function testDeletingTheGroupKeepsTheTripForItsCreator(): void
    {
        $group = $this->groupWith('alice', 'bob');
        [, $trip] = $this->json('POST', '/api/trips', self::TRIP + ['groupId' => $group['id']], $this->token('bob'));

        $this->json('DELETE', "/api/groups/{$group['id']}", null, $this->token('alice'));

        [$code, $kept] = $this->json('GET', "/api/trips/{$trip['id']}", null, $this->token('bob'));
        self::assertSame(200, $code);
        self::assertNull($kept['group']);
        [$code] = $this->json('GET', "/api/trips/{$trip['id']}", null, $this->token('alice'));
        self::assertSame(404, $code);
    }
}
