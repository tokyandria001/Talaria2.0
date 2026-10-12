<?php

namespace App\Tests;

use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Base des tests d'API : base SQLite recréée à chaque test + helpers JSON / authentification.
 */
abstract class ApiTestCase extends WebTestCase
{
    protected KernelBrowser $client;

    protected function setUp(): void
    {
        $this->client = static::createClient();

        // Compteurs de limitation de débit (connexion, inscription) remis à zéro
        static::getContainer()->get('cache.rate_limiter')->clear();

        /** @var EntityManagerInterface $em */
        $em = static::getContainer()->get(EntityManagerInterface::class);
        $metadata = $em->getMetadataFactory()->getAllMetadata();
        $tool = new SchemaTool($em);
        $tool->dropSchema($metadata);
        $tool->createSchema($metadata);
    }

    /**
     * Envoie une requête JSON et renvoie [code HTTP, corps décodé].
     *
     * @return array{0: int, 1: mixed}
     */
    protected function json(string $method, string $uri, ?array $body = null, ?string $token = null, string $ip = '127.0.0.1'): array
    {
        $server = ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'REMOTE_ADDR' => $ip];
        if ($token) {
            $server['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
        }

        $this->client->request($method, $uri, [], [], $server, $body === null ? null : json_encode($body));
        $response = $this->client->getResponse();

        return [$response->getStatusCode(), json_decode((string) $response->getContent(), true)];
    }

    /** Crée un compte, se connecte et renvoie le token JWT */
    protected function registerAndLogin(string $email = 'voyageur@talaria.test', string $password = 'motdepasse123'): string
    {
        [$code] = $this->json('POST', '/api/auth/register', ['email' => $email, 'password' => $password]);
        self::assertSame(201, $code, 'Inscription impossible');

        [$code, $data] = $this->json('POST', '/api/auth/login', ['username' => $email, 'password' => $password]);
        self::assertSame(200, $code, 'Connexion impossible');

        return $data['token'];
    }

    /** Crée un voyage valide (surcharges possibles) et renvoie sa représentation JSON */
    protected function createTrip(string $token, array $overrides = []): array
    {
        [$code, $trip] = $this->json('POST', '/api/trips', $overrides + [
            'destination'   => 'Rome',
            'departureCity' => 'Paris',
            'startDate'     => '2027-06-01',
            'endDate'       => '2027-06-03',
            'travelers'     => 2,
            'budget'        => 1500,
            'transportMode' => 'train',
        ], $token);
        self::assertSame(201, $code, 'Création du voyage impossible : ' . json_encode($trip));

        return $trip;
    }
}
