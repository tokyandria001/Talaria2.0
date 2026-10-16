<?php

namespace App\Tests\Functional;

use App\Tests\ApiTestCase;
use App\Tests\Mock\PhotonMockResponseFactory;

/** Webhook « user.registered » : envoyé à l'inscription, signé, sans données inutiles */
final class WebhookTest extends ApiTestCase
{
    public function testRegistrationSendsASignedWebhook(): void
    {
        $before = count(PhotonMockResponseFactory::$webhooks);
        [$code] = $this->json('POST', '/api/auth/register', ['email' => 'lea@talaria.test', 'password' => 'motdepasse123', 'firstName' => 'Léa']);
        self::assertSame(201, $code);

        $received = array_slice(PhotonMockResponseFactory::$webhooks, $before);
        self::assertCount(1, $received);
        [$headers, $body] = $received[0];
        $payload = json_decode($body, true);

        self::assertSame('user.registered', $payload['event']);
        self::assertSame('user.registered', $headers['x-talaria-event']);
        self::assertSame('lea@talaria.test', $payload['data']['email']);
        self::assertSame('Léa', $payload['data']['firstName']);
        self::assertSame('email', $payload['data']['method']);
        self::assertNotEmpty($payload['data']['username']);
        self::assertArrayNotHasKey('password', $payload['data']);

        // Signature vérifiable par le destinataire avec le secret partagé
        $expected = 'sha256=' . hash_hmac('sha256', $headers['x-talaria-timestamp'] . '.' . $body, 'secret-de-test');
        self::assertSame($expected, $headers['x-talaria-signature']);
        // En-tête d'authentification du destinataire (Header Auth de n8n)
        self::assertSame('jeton-de-test', $headers['x-webhook-token']);

        // Connexion ensuite : aucun nouveau webhook
        $this->json('POST', '/api/auth/login', ['username' => 'lea@talaria.test', 'password' => 'motdepasse123']);
        self::assertCount($before + 1, PhotonMockResponseFactory::$webhooks);
    }
}
