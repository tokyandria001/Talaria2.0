<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;

/** Phase 8 (étape 2) — groupes de voyage : création, invitations, code, départs */
final class GroupTest extends ApiTestCase
{
    /** @var array<string, array{token: string, id: int}> */
    private array $users = [];

    private function user(string $name): array
    {
        if (!isset($this->users[$name])) {
            $token = $this->registerAndLogin("$name@talaria.test");
            $this->json('PATCH', '/api/profile', ['firstName' => ucfirst($name), 'username' => $name], $token);
            [, $me] = $this->json('GET', '/api/auth/me', null, $token);
            $this->users[$name] = ['token' => $token, 'id' => $me['user']['id']];
        }
        return $this->users[$name];
    }

    private function befriend(string $a, string $b): void
    {
        [, $res] = $this->json('POST', '/api/friends/requests', ['userId' => $this->user($b)['id']], $this->user($a)['token']);
        $this->json('POST', "/api/friends/requests/{$res['requestId']}/accept", null, $this->user($b)['token']);
    }

    private function createGroup(string $owner, array $body = []): array
    {
        [$code, $group] = $this->json('POST', '/api/groups', $body + ['name' => 'Monterrey 2026'], $this->user($owner)['token']);
        self::assertSame(201, $code, json_encode($group));
        return $group;
    }

    private function memberStatus(array $group, string $name): ?string
    {
        foreach ($group['members'] as $m) {
            if ($m['user']['id'] === $this->user($name)['id']) return $m['status'] . '/' . $m['role'];
        }
        return null;
    }

    public function testCreateGroupWithFriendsWhoAcceptOrDecline(): void
    {
        $this->befriend('alice', 'bob');
        $this->befriend('alice', 'chloe');

        $group = $this->createGroup('alice', [
            'description' => 'Tacos, randonnée et plongée', 'isPrivate' => true, 'sharedBudget' => true,
            'memberIds' => [$this->user('bob')['id'], $this->user('chloe')['id']],
        ]);
        self::assertSame('owner', $group['myRole']);
        self::assertSame('invited/member', $this->memberStatus($group, 'bob'));
        self::assertSame(1, $group['membersCount'], 'Les invités ne comptent pas encore');
        self::assertMatchesRegularExpression('/^[A-Z2-9]{8}$/', $group['inviteCode']);

        // Bob voit l'invitation et sa notification
        [, $bobGroups] = $this->json('GET', '/api/groups', null, $this->user('bob')['token']);
        self::assertCount(0, $bobGroups['groups']);
        self::assertSame('Alice', $bobGroups['invitations'][0]['invitedBy']['displayName']);
        [, $notifs] = $this->json('GET', '/api/notifications', null, $this->user('bob')['token']);
        self::assertSame('group_invite', $notifs[0]['type']);
        self::assertSame($group['id'], $notifs[0]['group']['id']);

        [$code, $afterAccept] = $this->json('POST', "/api/groups/{$group['id']}/accept", null, $this->user('bob')['token']);
        self::assertSame(200, $code);
        self::assertSame('active/member', $this->memberStatus($afterAccept, 'bob'));
        self::assertNull($afterAccept['inviteCode'], 'Groupe privé : un membre ne voit pas le code');

        [$code] = $this->json('POST', "/api/groups/{$group['id']}/decline", null, $this->user('chloe')['token']);
        self::assertSame(204, $code);

        [, $final] = $this->json('GET', "/api/groups/{$group['id']}", null, $this->user('alice')['token']);
        self::assertSame(2, $final['membersCount']);
        self::assertNull($this->memberStatus($final, 'chloe'));

        // Alice est notifiée de l'arrivée de Bob
        [, $notifs] = $this->json('GET', '/api/notifications', null, $this->user('alice')['token']);
        self::assertContains('group_join', array_column($notifs, 'type'));
    }

    public function testOnlyFriendsCanBeInvited(): void
    {
        $this->user('bob');
        [$code, $data] = $this->json('POST', '/api/groups', ['name' => 'G', 'memberIds' => [$this->user('bob')['id']]], $this->user('alice')['token']);

        self::assertSame(422, $code);
        self::assertStringContainsString('ne fait pas partie de vos amis', $data['message']);
    }

    public function testPrivateVsOpenGroupInvitations(): void
    {
        $this->befriend('alice', 'bob');
        $this->befriend('bob', 'chloe');

        $private = $this->createGroup('alice', ['isPrivate' => true, 'memberIds' => [$this->user('bob')['id']]]);
        $this->json('POST', "/api/groups/{$private['id']}/accept", null, $this->user('bob')['token']);
        [$code] = $this->json('POST', "/api/groups/{$private['id']}/members", ['userIds' => [$this->user('chloe')['id']]], $this->user('bob')['token']);
        self::assertSame(403, $code, 'Groupe privé : seul l\'organisateur invite');

        $open = $this->createGroup('alice', ['name' => 'Ouvert', 'isPrivate' => false, 'memberIds' => [$this->user('bob')['id']]]);
        $this->json('POST', "/api/groups/{$open['id']}/accept", null, $this->user('bob')['token']);
        [$code, $updated] = $this->json('POST', "/api/groups/{$open['id']}/members", ['userIds' => [$this->user('chloe')['id']]], $this->user('bob')['token']);
        self::assertSame(200, $code, 'Groupe ouvert : un membre invite ses amis');
        self::assertSame('invited/member', $this->memberStatus($updated, 'chloe'));
    }

    public function testJoinWithInviteCode(): void
    {
        $group = $this->createGroup('alice');
        $david = $this->user('david')['token'];

        [$code, $preview] = $this->json('GET', '/api/groups/join/' . strtolower($group['inviteCode']), null, $david);
        self::assertSame(200, $code);
        self::assertSame('Monterrey 2026', $preview['name']);
        self::assertFalse($preview['alreadyMember']);

        [$code, $joined] = $this->json('POST', "/api/groups/join/{$group['inviteCode']}", null, $david);
        self::assertSame(201, $code);
        self::assertSame('active/member', $this->memberStatus($joined, 'david'));

        [$code] = $this->json('POST', '/api/groups/join/AAAAAAAA', null, $david);
        self::assertSame(404, $code);

        // Un nouveau code invalide l'ancien
        [, $regen] = $this->json('POST', "/api/groups/{$group['id']}/invite-code", null, $this->user('alice')['token']);
        self::assertNotSame($group['inviteCode'], $regen['inviteCode']);
        [$code] = $this->json('GET', "/api/groups/join/{$group['inviteCode']}", null, $this->user('emma')['token']);
        self::assertSame(404, $code);
    }

    public function testOwnerLeavingPassesTheRoleThenLastMemberDeletesGroup(): void
    {
        $group = $this->createGroup('alice');
        $this->json('POST', "/api/groups/join/{$group['inviteCode']}", null, $this->user('bob')['token']);

        [$code] = $this->json('DELETE', "/api/groups/{$group['id']}/members/{$this->user('alice')['id']}", null, $this->user('alice')['token']);
        self::assertSame(200, $code);

        [, $afterOwnerLeft] = $this->json('GET', "/api/groups/{$group['id']}", null, $this->user('bob')['token']);
        self::assertSame('owner', $afterOwnerLeft['myRole'], 'Bob devient organisateur');

        [, $res] = $this->json('DELETE', "/api/groups/{$group['id']}/members/{$this->user('bob')['id']}", null, $this->user('bob')['token']);
        self::assertTrue($res['deleted']);

        [$code] = $this->json('GET', "/api/groups/{$group['id']}", null, $this->user('bob')['token']);
        self::assertSame(404, $code);
    }

    public function testPermissionsAndValidation(): void
    {
        $group = $this->createGroup('alice');
        $this->json('POST', "/api/groups/join/{$group['inviteCode']}", null, $this->user('bob')['token']);
        $this->json('POST', "/api/groups/join/{$group['inviteCode']}", null, $this->user('chloe')['token']);

        [$code] = $this->json('GET', "/api/groups/{$group['id']}", null, $this->user('intrus')['token']);
        self::assertSame(404, $code, 'Un non-membre ne voit pas le groupe');

        [$code] = $this->json('PATCH', "/api/groups/{$group['id']}", ['name' => 'Piraté'], $this->user('bob')['token']);
        self::assertSame(403, $code);

        [$code] = $this->json('DELETE', "/api/groups/{$group['id']}/members/{$this->user('chloe')['id']}", null, $this->user('bob')['token']);
        self::assertSame(403, $code, 'Un membre ne retire pas les autres');

        [$code, $updated] = $this->json('DELETE', "/api/groups/{$group['id']}/members/{$this->user('chloe')['id']}", null, $this->user('alice')['token']);
        self::assertSame(200, $code);
        self::assertSame(2, $updated['membersCount']);

        [$code] = $this->json('PATCH', "/api/groups/{$group['id']}", ['name' => '   '], $this->user('alice')['token']);
        self::assertSame(422, $code, 'Nom vide');

        [$code] = $this->json('DELETE', "/api/groups/{$group['id']}", null, $this->user('bob')['token']);
        self::assertSame(403, $code);
        [$code] = $this->json('DELETE', "/api/groups/{$group['id']}", null, $this->user('alice')['token']);
        self::assertSame(204, $code);
    }
}
