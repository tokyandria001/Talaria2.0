<?php

namespace App\Security;

use App\Entity\User;
use Symfony\Component\Security\Core\Exception\CustomUserMessageAccountStatusException;
use Symfony\Component\Security\Core\User\UserCheckerInterface;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * Compte suspendu par un administrateur : connexion, jeton d'accès et renouvellement refusés.
 * Vérifié après le mot de passe (un mauvais mot de passe ne révèle pas qu'un compte est suspendu).
 */
final class UserChecker implements UserCheckerInterface
{
    public function checkPreAuth(UserInterface $user): void
    {
    }

    public function checkPostAuth(UserInterface $user, mixed $token = null): void
    {
        if ($user instanceof User && $user->isSuspended()) {
            throw new CustomUserMessageAccountStatusException('Ce compte est suspendu. Contacte l\'équipe Talaria pour en savoir plus.');
        }
    }
}
