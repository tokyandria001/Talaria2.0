<?php

namespace App\Service;

use App\Entity\User;

/** Représentation publique d'un utilisateur (jamais l'email) : amis, recherche, groupes */
final class UserPresenter
{
    public static function public(User $u): array
    {
        $name = trim(($u->getFirstName() ?? '') . ' ' . ($u->getLastName() ?? ''));

        return [
            'id'             => $u->getId(),
            'username'       => $u->getPseudo(),
            'firstName'      => $u->getFirstName(),
            'lastName'       => $u->getLastName(),
            'displayName'    => $name !== '' ? $name : ($u->getPseudo() ?? 'Voyageur'),
            'profilePicture' => $u->getProfilePicture(),
        ];
    }
}
