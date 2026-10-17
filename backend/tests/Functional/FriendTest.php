<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;

/** Phase 7 — amis */
final class FriendTest extends ApiTestCase
{
    private function profile(string $token, array $data): void
    {
        [$code] = $this->json('PATCH', '/api/profile', $data, $token);
        self::assertSame(200, $code);
    }

    private function idOf(string $token): int
    {
        [, $me] = $this->json('GET', '/api/auth/me', null, $token);
        return $me['user']['id'];
    }

    public function testSearchFindsUsersWithoutExposingEmails(): void
    {
        $alice = $this->registerAndLogin('alice@talaria.test');
        $bob   = $this->registerAndLogin('bob@talaria.test');
        $this->profile($bob, ['firstName' => 'Bob', 'lastName' => 'Martin', 'username' => 'bobby']);

        foreach (['bob', 'Martin', 'bobby', 'bob martin'] as $q) {
            [$code, $results] = $this->json('GET', '/api/users/search?q=' . urlencode($q), null, $alice);
            self::assertSame(200, $code);
            self::assertCount(1, $results, "Recherche « $q »");
            self::assertSame('Bob Martin', $results[0]['displayName']);
            self::assertSame('none', $results[0]['relation']);
            self::assertArrayNotHasKey('email', $results[0]);
        }

        // Ni email partiel ni email exact : impossible de savoir si une adresse a un compte
        foreach (['talaria.test', 'bob@talaria.test'] as $q) {
            [, $results] = $this->json('GET', '/api/users/search?q=' . urlencode($q), null, $alice);
            self::assertCount(0, $results, "Recherche « $q »");
        }

        // On ne se trouve pas soi-même, et une requête trop courte ne renvoie rien
        [, $results] = $this->json('GET', '/api/users/search?q=alice@talaria.test', null, $alice);
        self::assertCount(0, $results);
        [, $results] = $this->json('GET', '/api/users/search?q=b', null, $alice);
        self::assertCount(0, $results);
    }

    public function testRequestAcceptAndRemoveFriend(): void
    {
        $alice = $this->registerAndLogin('alice@talaria.test');
        $bob   = $this->registerAndLogin('bob@talaria.test');
        $bobId = $this->idOf($bob);

        [$code, $sent] = $this->json('POST', '/api/friends/requests', ['userId' => $bobId], $alice);
        self::assertSame(201, $code);
        self::assertSame('request_sent', $sent['status']);

        [$code] = $this->json('POST', '/api/friends/requests', ['userId' => $bobId], $alice);
        self::assertSame(409, $code, 'Pas de double demande');

        // Bob voit la demande et une notification
        [, $requests] = $this->json('GET', '/api/friends/requests', null, $bob);
        self::assertCount(1, $requests['received']);
        [, $notifs] = $this->json('GET', '/api/notifications', null, $bob);
        self::assertSame('friend_request', $notifs[0]['type']);

        // Alice ne peut pas accepter sa propre demande
        [$code] = $this->json('POST', "/api/friends/requests/{$sent['requestId']}/accept", null, $alice);
        self::assertSame(404, $code);

        [$code] = $this->json('POST', "/api/friends/requests/{$sent['requestId']}/accept", null, $bob);
        self::assertSame(200, $code);

        [, $aliceFriends] = $this->json('GET', '/api/friends', null, $alice);
        self::assertCount(1, $aliceFriends);
        self::assertSame($bobId, $aliceFriends[0]['user']['id']);

        [, $notifs] = $this->json('GET', '/api/notifications', null, $alice);
        self::assertSame('friend_accept', $notifs[0]['type']);

        [, $results] = $this->json('GET', '/api/users/search?q=bob', null, $alice);
        self::assertSame('friends', $results[0]['relation']);

        [$code] = $this->json('DELETE', "/api/friends/$bobId", null, $alice);
        self::assertSame(204, $code);
        [, $bobFriends] = $this->json('GET', '/api/friends', null, $bob);
        self::assertCount(0, $bobFriends);
    }

    public function testCrossedRequestsBecomeFriendsAutomatically(): void
    {
        $alice = $this->registerAndLogin('alice@talaria.test');
        $bob   = $this->registerAndLogin('bob@talaria.test');

        $this->json('POST', '/api/friends/requests', ['userId' => $this->idOf($bob)], $alice);
        [$code, $res] = $this->json('POST', '/api/friends/requests', ['userId' => $this->idOf($alice)], $bob);

        self::assertSame(200, $code);
        self::assertSame('friends', $res['status']);
        [, $friends] = $this->json('GET', '/api/friends', null, $alice);
        self::assertCount(1, $friends);
    }

    public function testDeclineAndCancelRequests(): void
    {
        $alice = $this->registerAndLogin('alice@talaria.test');
        $bob   = $this->registerAndLogin('bob@talaria.test');
        $bobId = $this->idOf($bob);

        [, $sent] = $this->json('POST', '/api/friends/requests', ['userId' => $bobId], $alice);
        [$code] = $this->json('POST', "/api/friends/requests/{$sent['requestId']}/decline", null, $bob);
        self::assertSame(204, $code);

        // Après un refus, une nouvelle demande est possible, puis annulable par son auteur
        [$code, $again] = $this->json('POST', '/api/friends/requests', ['userId' => $bobId], $alice);
        self::assertSame(201, $code);
        [$code] = $this->json('DELETE', "/api/friends/requests/{$again['requestId']}", null, $bob);
        self::assertSame(404, $code, 'Seul l\'auteur peut annuler');
        [$code] = $this->json('DELETE', "/api/friends/requests/{$again['requestId']}", null, $alice);
        self::assertSame(204, $code);

        [, $requests] = $this->json('GET', '/api/friends/requests', null, $bob);
        self::assertCount(0, $requests['received']);
    }

    public function testInvalidRequests(): void
    {
        $alice = $this->registerAndLogin('alice@talaria.test');

        [$code] = $this->json('POST', '/api/friends/requests', ['userId' => $this->idOf($alice)], $alice);
        self::assertSame(400, $code, 'Soi-même');

        [$code] = $this->json('POST', '/api/friends/requests', ['userId' => 9999], $alice);
        self::assertSame(404, $code, 'Utilisateur inexistant');

        [$code] = $this->json('POST', '/api/friends/requests', ['userId' => 'abc'], $alice);
        self::assertSame(400, $code, 'Identifiant non numérique');

        [$code] = $this->json('DELETE', '/api/friends/9999', null, $alice);
        self::assertSame(404, $code, 'Pas ami');
    }
}
