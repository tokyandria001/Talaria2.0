<?php

namespace App\Service;

use App\Entity\Notification;
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
    /** Pas plus d'une notification « planning modifié » par membre et par auteur toutes les 10 minutes */
    private const UPDATE_NOTIF_WINDOW = '-10 minutes';

    public function __construct(private EntityManagerInterface $em) {}

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
     * Notifie les autres membres actifs du groupe du voyage.
     * Avec $throttle, une même personne ne génère qu'une notification par membre toutes les 10 minutes.
     */
    public function notifyGroup(Trip $trip, User $from, string $type, string $message, bool $throttle = false): void
    {
        $group = $trip->getGroup();
        if (!$group) return;

        foreach ($group->activeMembers() as $member) {
            $recipient = $member->getUser();
            if ($recipient->getId() === $from->getId()) continue;
            if ($throttle && $this->recentlyNotified($recipient, $from, $trip, $type)) continue;

            $this->em->persist((new Notification())
                ->setRecipient($recipient)->setFromUser($from)
                ->setTrip($trip)->setGroup($group)
                ->setType($type)->setMessage($message));
        }
    }

    private function isCreator(Trip $trip, User $user): bool
    {
        return $trip->getUser()->getId() === $user->getId();
    }

    private function recentlyNotified(User $recipient, User $from, Trip $trip, string $type): bool
    {
        return (int) $this->em->getRepository(Notification::class)->createQueryBuilder('n')
            ->select('COUNT(n.id)')
            ->where('n.recipient = :r AND n.fromUser = :f AND n.trip = :t AND n.type = :type AND n.createdAt > :since')
            ->setParameter('r', $recipient)
            ->setParameter('f', $from)
            ->setParameter('t', $trip)
            ->setParameter('type', $type)
            ->setParameter('since', new \DateTimeImmutable(self::UPDATE_NOTIF_WINDOW))
            ->getQuery()->getSingleScalarResult() > 0;
    }
}
