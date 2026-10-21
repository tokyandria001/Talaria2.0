<?php

namespace App\EventListener;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Event\AuthenticationSuccessEvent;
use Lexik\Bundle\JWTAuthenticationBundle\Events;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;

/**
 * Réponse de connexion : le jeton et l'utilisateur connecté, pour que le site web n'ait pas
 * à appeler /api/auth/me. "username" est toujours rempli (pseudo, sinon prénom, sinon début de l'email).
 *
 * Se reconnecter annule une suppression de compte demandée (délai de 30 jours).
 */
#[AsEventListener(event: Events::AUTHENTICATION_SUCCESS)]
final class LoginSuccessListener
{
    public function __construct(private EntityManagerInterface $em) {}

    public function __invoke(AuthenticationSuccessEvent $event): void
    {
        $user = $event->getUser();
        if (!$user instanceof User) {
            return;
        }

        $restored = false;
        if ($user->getDeletionRequestedAt()) {
            $user->setDeletionRequestedAt(null);
            $this->em->flush();
            $restored = true;
        }

        $event->setData($event->getData() + [
            'id'             => $user->getId(),
            'email'          => $user->getEmail(),
            'username'       => $user->getPseudo() ?? $user->getFirstName() ?? strstr($user->getEmail(), '@', true),
            'firstName'      => $user->getFirstName(),
            'lastName'       => $user->getLastName(),
            'profilePicture' => $user->getProfilePicture(),
            'isAdmin'        => $user->isAdmin(),
            'deletionCanceled' => $restored,
        ]);
    }
}
