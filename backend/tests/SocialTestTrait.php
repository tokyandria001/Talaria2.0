<?php

namespace App\Tests;

/** Utilitaires des tests sociaux (amis, groupes) : utilisateurs nommés, amitiés, groupes */
trait SocialTestTrait
{
    /** @var array<string, array{token: string, id: int}> */
    private array $users = [];

    /** Utilisateur de test (créé au premier appel) : ['token' => ..., 'id' => ...] */
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

    private function token(string $name): string
    {
        return $this->user($name)['token'];
    }

    private function befriend(string $a, string $b): void
    {
        [, $res] = $this->json('POST', '/api/friends/requests', ['userId' => $this->user($b)['id']], $this->token($a));
        $this->json('POST', "/api/friends/requests/{$res['requestId']}/accept", null, $this->token($b));
    }

    private function createGroup(string $owner, array $body = []): array
    {
        [$code, $group] = $this->json('POST', '/api/groups', $body + ['name' => 'Monterrey 2026'], $this->token($owner));
        self::assertSame(201, $code, json_encode($group));
        return $group;
    }

    /** Groupe de $owner que les $members rejoignent avec le code d'invitation */
    private function groupWith(string $owner, string ...$members): array
    {
        $group = $this->createGroup($owner);
        foreach ($members as $m) {
            $this->json('POST', "/api/groups/join/{$group['inviteCode']}", null, $this->token($m));
        }
        return $group;
    }
}
