<?php

namespace App\Service;

use App\Entity\User;

/** Représentations d'un utilisateur */
final class UserPresenter
{
    /** Représentation publique (jamais l'email) : amis, recherche, groupes */
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

    /** Compte complet, pour l'utilisateur lui-même (/api/auth/me, /api/profile) */
    public static function self(User $u): array
    {
        return [
            'id'                => $u->getId(),
            'email'             => $u->getEmail(),
            'firstName'         => $u->getFirstName(),
            'lastName'          => $u->getLastName(),
            'username'          => $u->getPseudo(),
            'profilePicture'    => $u->getProfilePicture(),
            'coverPhoto'        => $u->getCoverPhoto(),
            'bio'               => $u->getBio(),
            'phone'             => $u->getPhone(),
            'averageBudget'     => $u->getAverageBudget(),
            'activityTags'      => $u->getActivityTags(),
            'travelStyle'       => $u->getTravelStyle(),
            'travelPace'        => $u->getTravelPace(),
            'favoriteTransport' => $u->getFavoriteTransport(),
            'interests'         => $u->getInterests(),
            'hasCar'            => $u->hasCar(),
            'hasDrivingLicense' => $u->hasDrivingLicense(),
            'travelPreferences' => $u->getTravelPreferences(),
            'profilePublic'     => $u->isProfilePublic(),
            'invitePolicy'      => $u->getInvitePolicy(),
            'settings'          => $u->getSettings(),
            'passwordChangedAt' => $u->getPasswordChangedAt()?->format(\DateTimeInterface::ATOM),
            'deletionScheduledFor' => $u->getDeletionScheduledFor()?->format('Y-m-d'),
            'createdAt'         => $u->getCreatedAt()?->format(\DateTimeInterface::ATOM),
            // Onboarding (l'âge reste privé : seulement dans le profil de l'utilisateur lui-même)
            'birthYear'         => $u->getBirthYear(),
            'homeCity'          => $u->getHomeCity(),
            'homeLatitude'      => $u->getHomeLatitude(),
            'homeLongitude'     => $u->getHomeLongitude(),
            'homeHubs'          => $u->getHomeHubs(),
            'travelerTypes'     => $u->getTravelerTypes(),
            'weekendBudget'     => $u->getWeekendBudget(),
            'companions'        => $u->getCompanions(),
            'wishlist'          => $u->getWishlist(),
            'onboardedAt'       => $u->getOnboardedAt()?->format(\DateTimeInterface::ATOM),
        ];
    }
}
