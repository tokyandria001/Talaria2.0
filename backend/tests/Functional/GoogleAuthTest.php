<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use App\Tests\Mock\PhotonMockResponseFactory;

/** Connexion et inscription avec Google : jetons signés par une clé de test, servie comme certificat Google */
final class GoogleAuthTest extends ApiTestCase
{
    private const CLIENT_ID = '688722692928-dn8e3melnk939itijm8r1e7maoh95j4g.apps.googleusercontent.com';

    private \OpenSSLAsymmetricKey $key;
    private string $kid;

    protected function setUp(): void
    {
        parent::setUp();
        static::getContainer()->get('cache.app')->clear();

        $this->key = $this->newKey();
        $cert = openssl_csr_sign(openssl_csr_new(['commonName' => 'test'], $this->key, $this->sslConfig()), null, $this->key, 1, $this->sslConfig());
        openssl_x509_export($cert, $pem);
        $this->kid = bin2hex(random_bytes(8));
        PhotonMockResponseFactory::$googleCerts = [$this->kid => $pem];
    }

    /** PHP sous Windows ne trouve pas toujours openssl.cnf tout seul */
    private function sslConfig(): array
    {
        $file = dirname(PHP_BINARY) . '/extras/ssl/openssl.cnf';
        return !getenv('OPENSSL_CONF') && is_file($file) ? ['config' => $file] : [];
    }

    private function newKey(): \OpenSSLAsymmetricKey
    {
        return openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA] + $this->sslConfig());
    }

    private function idToken(array $claims = [], ?\OpenSSLAsymmetricKey $key = null): string
    {
        $b64 = fn (array $a) => rtrim(strtr(base64_encode(json_encode($a)), '+/', '-_'), '=');
        $claims += [
            'iss' => 'https://accounts.google.com', 'aud' => self::CLIENT_ID, 'sub' => '1094001',
            'email' => 'lea@gmail.com', 'email_verified' => true, 'given_name' => 'Léa', 'family_name' => 'Martin',
            'picture' => 'https://lh3.googleusercontent.com/a/photo', 'exp' => time() + 3600,
        ];
        $data = $b64(['alg' => 'RS256', 'kid' => $this->kid, 'typ' => 'JWT']) . '.' . $b64($claims);
        openssl_sign($data, $sig, $key ?? $this->key, OPENSSL_ALGO_SHA256);

        return $data . '.' . rtrim(strtr(base64_encode($sig), '+/', '-_'), '=');
    }

    public function testSignsUpThenLogsInWithGoogle(): void
    {
        [$code, $data] = $this->json('POST', '/api/auth/google', ['idToken' => $this->idToken()]);
        self::assertSame(201, $code);
        self::assertTrue($data['isNewUser']);
        self::assertNotEmpty($data['token']);
        self::assertNotEmpty($data['refresh_token']);
        self::assertSame('Léa', $data['firstName']);

        [, $me] = $this->json('GET', '/api/auth/me', null, $data['token']);
        self::assertSame('lea@gmail.com', $me['user']['email']);
        self::assertSame('Martin', $me['user']['lastName']);
        self::assertSame('https://lh3.googleusercontent.com/a/photo', $me['user']['profilePicture']);
        self::assertFalse($me['user']['hasPassword']);
        self::assertTrue($me['user']['googleLinked']);
        self::assertNull($me['user']['onboardedAt'], "L'onboarding reste à faire");

        // Deuxième fois : même compte
        [$code, $again] = $this->json('POST', '/api/auth/google', ['idToken' => $this->idToken()]);
        self::assertSame(200, $code);
        self::assertFalse($again['isNewUser']);
        self::assertSame($data['id'], $again['id']);

        // Pas de mot de passe : connexion classique impossible, inscription avec le même email refusée
        [$code] = $this->json('POST', '/api/auth/login', ['username' => 'lea@gmail.com', 'password' => '']);
        self::assertNotSame(200, $code);
        [$code, $err] = $this->json('POST', '/api/auth/register', ['email' => 'lea@gmail.com', 'password' => 'motdepasse123']);
        self::assertSame(409, $code);
        self::assertStringContainsString('Google', $err['message']);

        // Il peut choisir un mot de passe sans mot de passe actuel, puis se connecter avec
        [$code] = $this->json('PUT', '/api/profile/password', ['newPassword' => 'nouveau-mdp-123'], $data['token']);
        self::assertSame(200, $code);
        [$code] = $this->json('POST', '/api/auth/login', ['username' => 'lea@gmail.com', 'password' => 'nouveau-mdp-123']);
        self::assertSame(200, $code);
    }

    public function testLinksAnExistingAccountWithTheSameEmail(): void
    {
        $token = $this->registerAndLogin('lea@gmail.com');
        [, $before] = $this->json('GET', '/api/auth/me', null, $token);

        [$code, $data] = $this->json('POST', '/api/auth/google', ['idToken' => $this->idToken()]);
        self::assertSame(200, $code);
        self::assertFalse($data['isNewUser']);
        self::assertSame($before['user']['id'], $data['id']);

        [, $me] = $this->json('GET', '/api/auth/me', null, $data['token']);
        self::assertTrue($me['user']['googleLinked']);
        self::assertTrue($me['user']['hasPassword'], 'Le mot de passe existant est conservé');
    }

    public function testRejectsInvalidTokens(): void
    {
        $other = $this->newKey();
        $cases = [
            'signature'        => $this->idToken([], $other),
            'autre app'        => $this->idToken(['aud' => 'autre.apps.googleusercontent.com']),
            'expiré'           => $this->idToken(['exp' => time() - 3600]),
            'émetteur'         => $this->idToken(['iss' => 'https://pirate.example']),
            'email non vérifié' => $this->idToken(['email_verified' => false]),
            'mal formé'        => 'abc.def',
        ];
        foreach ($cases as $case => $token) {
            [$code] = $this->json('POST', '/api/auth/google', ['idToken' => $token]);
            self::assertSame(401, $code, $case);
        }
        [$code] = $this->json('POST', '/api/auth/google', []);
        self::assertSame(400, $code);
    }
}
