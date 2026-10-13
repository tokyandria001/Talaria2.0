<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;

/** Rester connecté : jeton d'accès d'1 heure renouvelé avec un jeton de renouvellement de 30 jours */
final class RefreshTokenTest extends ApiTestCase
{
    /** @return array réponse de connexion (token, refresh_token, refresh_token_expiration...) */
    private function login(string $email = 'lea@talaria.test', string $password = 'motdepasse123'): array
    {
        [$code, $data] = $this->json('POST', '/api/auth/login', ['username' => $email, 'password' => $password]);
        self::assertSame(200, $code);
        return $data;
    }

    public function testRefreshGivesANewPairAndEachRefreshTokenWorksOnce(): void
    {
        $this->registerAndLogin('lea@talaria.test');
        $login = $this->login();
        self::assertNotEmpty($login['refresh_token']);
        self::assertEqualsWithDelta(time() + 30 * 86400, $login['refresh_token_expiration'], 60, 'Valable 30 jours');

        // Sans jeton d'accès (expiré ou perdu) : le jeton de renouvellement suffit
        [$code, $renewed] = $this->json('POST', '/api/token/refresh', ['refresh_token' => $login['refresh_token']]);
        self::assertSame(200, $code);
        self::assertNotEmpty($renewed['token']);
        self::assertNotSame($login['refresh_token'], $renewed['refresh_token'], 'Un nouveau jeton de renouvellement à chaque fois');

        [$code, $me] = $this->json('GET', '/api/auth/me', null, $renewed['token']);
        self::assertSame(200, $code);
        self::assertSame('lea@talaria.test', $me['user']['email']);

        // L'ancien jeton de renouvellement ne sert plus
        [$code] = $this->json('POST', '/api/token/refresh', ['refresh_token' => $login['refresh_token']]);
        self::assertSame(401, $code);
        [$code] = $this->json('POST', '/api/token/refresh', ['refresh_token' => 'inventé']);
        self::assertSame(401, $code);
    }

    public function testLogoutRevokesOnlyThisDevice(): void
    {
        $this->registerAndLogin('lea@talaria.test');
        $phone = $this->login();
        $tablet = $this->login();

        [$code, $data] = $this->json('POST', '/api/token/revoke', ['refresh_token' => $phone['refresh_token']]);
        self::assertSame(200, $code);
        self::assertTrue($data['revoked']);

        [$code] = $this->json('POST', '/api/token/refresh', ['refresh_token' => $phone['refresh_token']]);
        self::assertSame(401, $code, 'Le téléphone est déconnecté');
        [$code] = $this->json('POST', '/api/token/refresh', ['refresh_token' => $tablet['refresh_token']]);
        self::assertSame(200, $code, 'La tablette reste connectée');

        [, $again] = $this->json('POST', '/api/token/revoke', ['refresh_token' => $phone['refresh_token']]);
        self::assertFalse($again['revoked']);
    }

    public function testPasswordChangeSignsOutOtherDevices(): void
    {
        $this->registerAndLogin('lea@talaria.test');
        $phone = $this->login();
        $tablet = $this->login();

        [$code, $changed] = $this->json('PUT', '/api/profile/password', ['currentPassword' => 'motdepasse123', 'newPassword' => 'nouveau-mot-de-passe'], $phone['token']);
        self::assertSame(200, $code);
        self::assertNotEmpty($changed['refresh_token'], 'Cet appareil reçoit un nouveau jeton');

        [$code] = $this->json('POST', '/api/token/refresh', ['refresh_token' => $tablet['refresh_token']]);
        self::assertSame(401, $code, 'Les autres appareils sont déconnectés');
        [$code] = $this->json('POST', '/api/token/refresh', ['refresh_token' => $phone['refresh_token']]);
        self::assertSame(401, $code, 'L\'ancien jeton de cet appareil aussi');
        [$code] = $this->json('POST', '/api/token/refresh', ['refresh_token' => $changed['refresh_token']]);
        self::assertSame(200, $code);
    }

    public function testAccountDeletionRequestSignsOutEverywhere(): void
    {
        $this->registerAndLogin('lea@talaria.test');
        $phone = $this->login();
        $this->json('DELETE', '/api/profile', ['password' => 'motdepasse123'], $phone['token']);

        [$code] = $this->json('POST', '/api/token/refresh', ['refresh_token' => $phone['refresh_token']]);
        self::assertSame(401, $code);
    }
}
