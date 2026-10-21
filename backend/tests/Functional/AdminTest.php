<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Tester\CommandTester;

/** Rôle administrateur : attribué par commande, visible partout (badge), impossible à s'attribuer par l'API */
final class AdminTest extends ApiTestCase
{
    public function testAdminBadgeIsGivenByCommandAndShownEverywhere(): void
    {
        $toky = $this->registerAndLogin('toky@talaria.test');
        $other = $this->registerAndLogin('autre@talaria.test');
        [, $me] = $this->json('GET', '/api/auth/me', null, $toky);
        self::assertFalse($me['user']['isAdmin']);

        // Impossible de se nommer administrateur par l'API
        $this->json('PATCH', '/api/profile', ['roles' => ['ROLE_ADMIN'], 'isAdmin' => true], $toky);
        [, $me] = $this->json('GET', '/api/auth/me', null, $toky);
        self::assertFalse($me['user']['isAdmin']);

        $cmd = new CommandTester((new Application(static::$kernel))->find('app:admin'));
        self::assertSame(0, $cmd->execute(['user' => 'toky@talaria.test']));

        // Badge : son compte, la connexion, son profil vu par les autres
        [, $me] = $this->json('GET', '/api/auth/me', null, $toky);
        self::assertTrue($me['user']['isAdmin']);
        [, $login] = $this->json('POST', '/api/auth/login', ['username' => 'toky@talaria.test', 'password' => 'motdepasse123']);
        self::assertTrue($login['isAdmin']);
        [, $profile] = $this->json('GET', "/api/users/{$me['user']['id']}", null, $other);
        self::assertTrue($profile['isAdmin']);

        self::assertSame(0, $cmd->execute(['--list' => true]));
        self::assertStringContainsString('toky@talaria.test', $cmd->getDisplay());

        self::assertSame(0, $cmd->execute(['user' => 'toky@talaria.test', '--revoke' => true]));
        [, $me] = $this->json('GET', '/api/auth/me', null, $toky);
        self::assertFalse($me['user']['isAdmin']);

        self::assertSame(1, $cmd->execute(['user' => 'personne@talaria.test']));
    }
}
