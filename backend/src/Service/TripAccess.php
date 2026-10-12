<?php

namespace App\Service;

use App\Entity\TravelGroup;
use App\Entity\Trip;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Droits sur un voyage (phase 8, étape 3).
 *
 * - Voir le voyage et modifier son planning (activités, logements) : son créateur,
 *   et tous les membres actifs de son groupe (voyage collaboratif).
 * - Modifier ses infos (dates, budget, transport, groupe) ou le supprimer : son créateur
 *   et l'organisateur du groupe.
 */
final class TripAccess
{
    public function __construct(
        private EntityManagerInterface $em,
        private GroupJournal $journal,
    ) {}

    /** Voyage visible par $user, sinon null (→ 404, sans révéler son existence) */
    public function findVisible(int $tripId, User $user): ?Trip
    {
        $trip = $this->em->find(Trip::class, $tripId);
        return $trip && $this->canView($trip, $user) ? $trip : null;
    }

    public function canView(Trip $trip, User $user): bool
    {
        return $this->isCreator($trip, $user)
            || ($trip->getGroup() && $this->isActiveMember($trip->getGroup(), $user));
    }

    public function canManage(Trip $trip, User $user): bool
    {
        if ($this->isCreator($trip, $user)) return true;
        $membership = $trip->getGroup()?->membershipOf($user);
        return (bool) ($membership?->isActive() && $membership->isOwner());
    }

    public function isActiveMember(TravelGroup $group, User $user): bool
    {
        return (bool) $group->membershipOf($user)?->isActive();
    }

    /**
     * Événement d'un voyage de groupe : journal du groupe + notification des autres membres.
     * Avec $throttle, une même personne ne génère qu'un événement de ce type toutes les 10 minutes.
     */
    public function notifyGroup(Trip $trip, User $from, string $type, string $message, bool $throttle = false): void
    {
        if ($trip->getGroup()) {
            $this->journal->record($trip->getGroup(), $from, $type, $message, $trip, $throttle);
        }
    }

    private function isCreator(Trip $trip, User $user): bool
    {
        return $trip->getUser()->getId() === $user->getId();
    }

}
