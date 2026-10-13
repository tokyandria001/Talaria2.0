<?php

namespace App\EventListener;

use App\Entity\User;
use Lexik\Bundle\JWTAuthenticationBundle\Event\AuthenticationSuccessEvent;
use Lexik\Bundle\JWTAuthenticationBundle\Events;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;

/**
 * Réponse de connexion : le jeton et l'utilisateur connecté, pour que le site web n'ait pas
 * à appeler /api/auth/me. "username" est toujours rempli (pseudo, sinon prénom, sinon début de l'email).
 */
#[AsEventListener(event: Events::AUTHENTICATION_SUCCESS)]
final class LoginSuccessListener
{
    public function __invoke(AuthenticationSuccessEvent $event): void
    {
        $user = $event->getUser();
        if (!$user instanceof User) {
            return;
        }

        $event->setData($event->getData() + [
            'id'             => $user->getId(),
            'email'          => $user->getEmail(),
            'username'       => $user->getPseudo() ?? $user->getFirstName() ?? strstr($user->getEmail(), '@', true),
            'firstName'      => $user->getFirstName(),
            'lastName'       => $user->getLastName(),
            'profilePicture' => $user->getProfilePicture(),
        ]);
    }
}
