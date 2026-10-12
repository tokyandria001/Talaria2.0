<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;

/** Complétion du profil après l'inscription (prénom, pseudo, centres d'intérêt) */
final class ProfileTest extends ApiTestCase
{
    public function testCompleteProfile(): void
    {
        $token = $this->registerAndLogin();

        [$code, $data] = $this->json('PATCH', '/api/profile', [
            'firstName' => 'Alice', 'lastName' => 'Durand', 'username' => 'alice.d',
            'activityTags' => ['culture', 'gastronomie'], 'travelStyle' => 'confort', 'travelPace' => 'slow',
        ], $token);

        self::assertSame(200, $code);
        self::assertSame('alice.d', $data['user']['username']);
        self::assertSame(['culture', 'gastronomie'], $data['user']['activityTags']);
    }

    public function testUsernameMustBeUniqueAndValid(): void
    {
        $alice = $this->registerAndLogin('alice@talaria.test');
        $bob   = $this->registerAndLogin('bob@talaria.test');
        $this->json('PATCH', '/api/profile', ['username' => 'voyageur'], $alice);

        [$code, $data] = $this->json('PATCH', '/api/profile', ['username' => 'voyageur'], $bob);
        self::assertSame(422, $code);
        self::assertSame('Ce pseudo est déjà pris.', $data['message']);

        [$code] = $this->json('PATCH', '/api/profile', ['username' => 'pas de espaces'], $bob);
        self::assertSame(422, $code);

        [$code] = $this->json('PATCH', '/api/profile', ['username' => 'ab'], $bob);
        self::assertSame(422, $code, 'Trop court');

        // On peut garder son propre pseudo
        [$code] = $this->json('PATCH', '/api/profile', ['username' => 'voyageur', 'firstName' => 'Alice'], $alice);
        self::assertSame(200, $code);
    }
}
