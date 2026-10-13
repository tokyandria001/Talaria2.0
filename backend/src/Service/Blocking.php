<?php

namespace App\Service;

use App\Entity\BlockedUser;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

/** Blocages entre utilisateurs (dans un sens ou dans l'autre) */
final class Blocking
{
    public function __construct(private EntityManagerInterface $em) {}

    /** L'un des deux a bloqué l'autre */
    public function between(User $a, User $b): bool
    {
        return (bool) $this->em->createQuery(
            'SELECT COUNT(b.id) FROM App\Entity\BlockedUser b
             WHERE (b.blocker = :a AND b.blocked = :b) OR (b.blocker = :b AND b.blocked = :a)',
        )->setParameter('a', $a)->setParameter('b', $b)->getSingleScalarResult();
    }

    /** @return int[] identifiants des personnes que j'ai bloquées ou qui m'ont bloqué */
    public function hiddenIdsFor(User $me): array
    {
        $rows = $this->em->createQuery(
            'SELECT IDENTITY(b.blocked) AS blockedId, IDENTITY(b.blocker) AS blockerId FROM App\Entity\BlockedUser b
             WHERE b.blocker = :me OR b.blocked = :me',
        )->setParameter('me', $me)->getScalarResult();

        $ids = [];
        foreach ($rows as $r) {
            foreach ([(int) $r['blockedId'], (int) $r['blockerId']] as $id) {
                if ($id !== $me->getId()) $ids[$id] = $id;
            }
        }
        return array_values($ids);
    }

    /** @return BlockedUser[] personnes que j'ai bloquées, les plus récentes d'abord */
    public function blockedBy(User $me): array
    {
        return $this->em->getRepository(BlockedUser::class)->findBy(['blocker' => $me], ['createdAt' => 'DESC', 'id' => 'DESC']);
    }
}
