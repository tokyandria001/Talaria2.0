<?php

namespace App\Service;

use Psr\Cache\CacheItemPoolInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Vérifie un jeton d'identité Google (idToken) sans librairie Google : signature RS256 avec les
 * certificats publics de Google (mis en cache, rechargés si Google change de clé), émetteur,
 * application destinataire (notre ID client), expiration et email vérifié.
 */
final class GoogleTokenVerifier
{
    public const CERTS_URL = 'https://www.googleapis.com/oauth2/v1/certs';
    private const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
    private const CACHE_KEY = 'google_oauth_certs';

    /** @var string[] */
    private array $clientIds;

    public function __construct(
        private HttpClientInterface $http,
        #[Autowire(service: 'cache.app')] private CacheItemPoolInterface $cache,
        #[Autowire('%env(default::GOOGLE_CLIENT_ID)%')] ?string $clientIds,
    ) {
        $this->clientIds = array_values(array_filter(array_map('trim', explode(',', (string) $clientIds))));
    }

    /**
     * @return array{sub: string, email: string, given_name?: string, family_name?: string, picture?: string}
     * @throws \RuntimeException jeton invalide (message en clair pour le champ « detail »)
     */
    public function verify(string $idToken): array
    {
        if (!$this->clientIds) throw new \RuntimeException('Connexion Google non configurée sur le serveur.');

        $parts = explode('.', $idToken);
        if (count($parts) !== 3) throw new \RuntimeException('Jeton Google mal formé.');
        [$h, $p, $sig] = $parts;
        $header = json_decode($this->b64($h), true);
        $claims = json_decode($this->b64($p), true);
        if (!is_array($header) || !is_array($claims) || ($header['alg'] ?? '') !== 'RS256' || !is_string($header['kid'] ?? null)) {
            throw new \RuntimeException('Jeton Google mal formé.');
        }

        $cert = $this->certificate($header['kid']);
        if ($cert === null || openssl_verify("$h.$p", $this->b64($sig), $cert, OPENSSL_ALGO_SHA256) !== 1) {
            throw new \RuntimeException('Signature du jeton Google invalide.');
        }

        $now = time();
        if (!in_array($claims['iss'] ?? null, self::ISSUERS, true)) throw new \RuntimeException('Jeton non émis par Google.');
        if (!in_array($claims['aud'] ?? null, $this->clientIds, true)) throw new \RuntimeException('Jeton destiné à une autre application.');
        if (!is_int($claims['exp'] ?? null) || $claims['exp'] < $now - 60) throw new \RuntimeException('Jeton Google expiré.');
        if (!is_string($claims['sub'] ?? null) || !is_string($claims['email'] ?? null)) throw new \RuntimeException('Jeton Google incomplet.');
        if (($claims['email_verified'] ?? false) !== true && ($claims['email_verified'] ?? null) !== 'true') {
            throw new \RuntimeException('Adresse email Google non vérifiée.');
        }

        return $claims;
    }

    /** Certificat public de la clé « kid » : depuis le cache, sinon rechargé chez Google */
    private function certificate(string $kid): ?string
    {
        $item = $this->cache->getItem(self::CACHE_KEY);
        $certs = $item->isHit() ? $item->get() : [];
        if (!isset($certs[$kid])) {
            try {
                $certs = $this->http->request('GET', self::CERTS_URL, ['timeout' => 10])->toArray();
            } catch (\Throwable) {
                throw new \RuntimeException('Google ne répond pas, réessaie dans un instant.');
            }
            $this->cache->save($item->set($certs)->expiresAfter(6 * 3600));
        }

        return is_string($certs[$kid] ?? null) ? $certs[$kid] : null;
    }

    private function b64(string $s): string
    {
        return (string) base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4));
    }
}
