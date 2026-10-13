<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;

final class AuthTest extends ApiTestCase
{
    public function testRegisterLoginAndFetchProfile(): void
    {
        $token = $this->registerAndLogin('alice@talaria.test');

        [$code, $data] = $this->json('GET', '/api/auth/me', null, $token);

        self::assertSame(200, $code);
        self::assertSame('alice@talaria.test', $data['user']['email']);
    }

    /** Appels du site web app.talaria.world : { username, email, password } puis login avec "email" */
    public function testWebsiteRegisterAndLoginWithEmailField(): void
    {
        [$code] = $this->json('POST', '/api/auth/register', ['username' => 'malol', 'email' => 'malol@talaria.test', 'password' => 'secret']);
        self::assertSame(201, $code);

        [$code, $data] = $this->json('POST', '/api/auth/login', ['email' => 'malol@talaria.test', 'password' => 'secret']);
        self::assertSame(200, $code);
        self::assertNotEmpty($data['token']);
        self::assertSame('malol', $data['username'], 'Pseudo enregistré à l\'inscription');
        self::assertSame('malol@talaria.test', $data['email']);
        self::assertIsInt($data['id']);

        // Sans pseudo : début de l'email, jamais vide (affiché par le site)
        $this->json('POST', '/api/auth/register', ['email' => 'sans.pseudo@talaria.test', 'password' => 'secret'], null, '10.9.9.9');
        [, $data] = $this->json('POST', '/api/auth/login', ['email' => 'sans.pseudo@talaria.test', 'password' => 'secret']);
        self::assertSame('sans.pseudo', $data['username']);

        // Erreurs aussi dans "detail", le champ lu par le site
        [$code, $data] = $this->json('POST', '/api/auth/login', ['email' => 'malol@talaria.test', 'password' => 'faux']);
        self::assertSame(401, $code);
        self::assertSame('Email ou mot de passe incorrect.', $data['detail']);

        [$code, $data] = $this->json('POST', '/api/auth/register', ['username' => 'malol', 'email' => 'autre@talaria.test', 'password' => 'secret'], null, '10.9.9.9');
        self::assertSame(422, $code);
        self::assertSame('Ce pseudo est déjà pris.', $data['detail']);
    }

    public function testRegisterRejectsDuplicateEmail(): void
    {
        $this->registerAndLogin('alice@talaria.test');

        [$code, $data] = $this->json('POST', '/api/auth/register', ['email' => 'alice@talaria.test', 'password' => 'autre-mot-de-passe']);

        self::assertSame(409, $code);
        self::assertSame('Un compte existe déjà avec cet email.', $data['message']);
    }

    public function testRegisterRejectsInvalidEmail(): void
    {
        [$code] = $this->json('POST', '/api/auth/register', ['email' => 'pas-un-email', 'password' => 'motdepasse123']);

        self::assertSame(422, $code);
    }

    public function testWrongPasswordReturnsFrenchMessage(): void
    {
        $this->registerAndLogin('alice@talaria.test');

        [$code, $data] = $this->json('POST', '/api/auth/login', ['username' => 'alice@talaria.test', 'password' => 'faux']);

        self::assertSame(401, $code);
        self::assertSame('Email ou mot de passe incorrect.', $data['message']);
    }

    public function testProtectedRoutesRequireAToken(): void
    {
        [$code] = $this->json('GET', '/api/trips');

        self::assertSame(401, $code);
    }

    public function testLoginIsThrottledAfterFiveFailedAttempts(): void
    {
        $this->client->disableReboot(); // garde les compteurs entre les requêtes
        $this->registerAndLogin('alice@talaria.test', 'bon-mot-de-passe');

        for ($i = 1; $i <= 5; $i++) {
            [$code] = $this->json('POST', '/api/auth/login', ['username' => 'alice@talaria.test', 'password' => 'faux']);
            self::assertSame(401, $code, "Essai raté #$i");
        }

        [$code, $data] = $this->json('POST', '/api/auth/login', ['username' => 'alice@talaria.test', 'password' => 'bon-mot-de-passe']);

        self::assertSame(429, $code);
        self::assertStringStartsWith('Trop de tentatives de connexion', $data['message']);
        self::assertNotNull($this->client->getResponse()->headers->get('Retry-After'));
    }

    public function testRegistrationIsRateLimitedPerIp(): void
    {
        $this->client->disableReboot();

        for ($i = 1; $i <= 5; $i++) {
            [$code] = $this->json('POST', '/api/auth/register', ['email' => "user$i@talaria.test", 'password' => 'motdepasse123'], null, '10.0.0.1');
            self::assertSame(201, $code, "Inscription #$i");
        }

        [$code, $data] = $this->json('POST', '/api/auth/register', ['email' => 'user6@talaria.test', 'password' => 'motdepasse123'], null, '10.0.0.1');
        self::assertSame(429, $code);
        self::assertStringStartsWith("Trop d'inscriptions", $data['message']);

        // Une autre adresse IP n'est pas concernée
        [$code] = $this->json('POST', '/api/auth/register', ['email' => 'user7@talaria.test', 'password' => 'motdepasse123'], null, '10.0.0.2');
        self::assertSame(201, $code);
    }
}
