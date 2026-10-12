<?php

namespace App\Repository;

use App\Entity\Friendship;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<Friendship> */
class FriendshipRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Friendship::class);
    }

    /** Relation existante entre deux utilisateurs, dans un sens ou dans l'autre */
    public function findBetween(User $a, User $b): ?Friendship
    {
        return $this->createQueryBuilder('f')
            ->where('(f.requester = :a AND f.addressee = :b) OR (f.requester = :b AND f.addressee = :a)')
            ->setParameter('a', $a)->setParameter('b', $b)
            ->setMaxResults(1)
            ->getQuery()->getOneOrNullResult();
    }

    /** @return Friendship[] amitiés acceptées de $user */
    public function findFriendshipsOf(User $user): array
    {
        return $this->createQueryBuilder('f')
            ->where('(f.requester = :u OR f.addressee = :u) AND f.status = :accepted')
            ->setParameter('u', $user)->setParameter('accepted', Friendship::ACCEPTED)
            ->orderBy('f.acceptedAt', 'DESC')->addOrderBy('f.id', 'DESC')
            ->getQuery()->getResult();
    }

    /** @return Friendship[] demandes en attente reçues par $user */
    public function findReceivedRequests(User $user): array
    {
        return $this->findBy(['addressee' => $user, 'status' => Friendship::PENDING], ['createdAt' => 'DESC', 'id' => 'DESC']);
    }

    /** @return Friendship[] demandes en attente envoyées par $user */
    public function findSentRequests(User $user): array
    {
        return $this->findBy(['requester' => $user, 'status' => Friendship::PENDING], ['createdAt' => 'DESC', 'id' => 'DESC']);
    }

    /**
     * Relations de $me avec les utilisateurs donnés, indexées par id de l'autre utilisateur.
     *
     * @param int[] $userIds
     * @return array<int, Friendship>
     */
    public function findRelationsWith(User $me, array $userIds): array
    {
        if (!$userIds) return [];
        $rows = $this->createQueryBuilder('f')
            ->where('(f.requester = :me AND f.addressee IN (:ids)) OR (f.addressee = :me AND f.requester IN (:ids))')
            ->setParameter('me', $me)->setParameter('ids', $userIds)
            ->getQuery()->getResult();

        $byUser = [];
        foreach ($rows as $f) {
            $byUser[$f->otherThan($me)->getId()] = $f;
        }
        return $byUser;
    }
}
