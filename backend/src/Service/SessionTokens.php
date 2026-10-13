<?php

namespace App\Service;

use App\Entity\User;
use Gesdinet\JWTRefreshTokenBundle\Generator\RefreshTokenGeneratorInterface;
use Gesdinet\JWTRefreshTokenBundle\Model\RefreshTokenManagerInterface;
use Gesdinet\JWTRefreshTokenBundle\Model\RevokeRefreshTokenManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Sessions (jetons de renouvellement) d'un utilisateur : déconnexion d'un appareil,
 * de tous les appareils, nouveau jeton pour l'appareil courant.
 */
final class SessionTokens
{
    public function __construct(
        private RefreshTokenManagerInterface $manager,
        private RevokeRefreshTokenManagerInterface $revoker,
        private RefreshTokenGeneratorInterface $generator,
        #[Autowire('%gesdinet_jwt_refresh_token.ttl%')] private int $ttl,
    ) {}

    /** Déconnecte l'appareil qui détient ce jeton. Retourne false si le jeton est inconnu. */
    public function revoke(string $refreshToken): bool
    {
        $token = $this->manager->get($refreshToken);
        if (!$token) return false;
        $this->manager->delete($token);
        return true;
    }

    /** Déconnecte tous les appareils (changement de mot de passe, suppression du compte) */
    public function revokeAll(User $user): int
    {
        return $this->revoker->revokeAllForUser($user);
    }

    /** @return array{refresh_token: string, refresh_token_expiration: int} nouveau jeton pour l'appareil courant */
    public function issue(User $user): array
    {
        $token = $this->generator->createForUserWithTtl($user, $this->ttl);
        // Le jeton est remplacé par son empreinte à l'enregistrement : on garde la valeur à rendre avant
        $value = (string) $token->getRefreshToken();
        $this->manager->save($token);

        return ['refresh_token' => $value, 'refresh_token_expiration' => $token->getValid()->getTimestamp()];
    }
}
