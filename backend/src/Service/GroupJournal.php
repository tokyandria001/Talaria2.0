<?php

namespace App\Service;

use App\Entity\GroupActivity;
use App\Entity\Notification;
use App\Entity\TravelGroup;
use App\Entity\Trip;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Événement d'un groupe : une ligne dans le journal (« Activité récente ») + une notification
 * pour chacun des autres membres actifs.
 */
final class GroupJournal
{
    /** Avec $throttle : un même auteur ne génère qu'un événement de ce type par voyage toutes les 10 minutes */
    private const THROTTLE_WINDOW = '-10 minutes';

    public function __construct(private EntityManagerInterface $em) {}

    public function record(TravelGroup $group, User $actor, string $type, string $message, ?Trip $trip = null, bool $throttle = false, bool $notify = true): void
    {
        if ($throttle && $this->recentlyRecorded($group, $actor, $type, $trip)) return;

        $this->em->persist((new GroupActivity())
            ->setGroup($group)->setActor($actor)->setTrip($trip)
            ->setType($type)->setMessage($message));

        if (!$notify) return;
        foreach ($group->activeMembers() as $member) {
            if ($member->getUser()->getId() === $actor->getId()) continue;
            $this->em->persist((new Notification())
                ->setRecipient($member->getUser())->setFromUser($actor)
                ->setGroup($group)->setTrip($trip)
                ->setType($type)->setMessage($message));
        }
    }

    /** @return GroupActivity[] derniers événements du groupe */
    public function latest(TravelGroup $group, int $limit = 10): array
    {
        return $this->em->getRepository(GroupActivity::class)
            ->findBy(['group' => $group], ['createdAt' => 'DESC', 'id' => 'DESC'], $limit);
    }

    private function recentlyRecorded(TravelGroup $group, User $actor, string $type, ?Trip $trip): bool
    {
        $qb = $this->em->getRepository(GroupActivity::class)->createQueryBuilder('a')
            ->select('COUNT(a.id)')
            ->where('a.group = :g AND a.actor = :actor AND a.type = :type AND a.createdAt > :since')
            ->setParameter('g', $group)
            ->setParameter('actor', $actor)
            ->setParameter('type', $type)
            ->setParameter('since', new \DateTimeImmutable(self::THROTTLE_WINDOW));
        if ($trip) $qb->andWhere('a.trip = :trip')->setParameter('trip', $trip);

        // Les événements pas encore enregistrés en base (même requête HTTP) comptent aussi
        foreach ($this->em->getUnitOfWork()->getScheduledEntityInsertions() as $pending) {
            if ($pending instanceof GroupActivity && $pending->getGroup() === $group && $pending->getActor() === $actor
                && $pending->getType() === $type && $pending->getTrip() === $trip) {
                return true;
            }
        }

        return (int) $qb->getQuery()->getSingleScalarResult() > 0;
    }
}
