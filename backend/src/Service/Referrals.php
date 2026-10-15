<?php

namespace App\Service;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Parrainage : le pseudo du parrain sert de code (liens https://app.talaria.world/?invite=<pseudo>).
 * Un code inconnu, le sien ou celui d'un compte en cours de suppression est ignoré :
 * le parrainage ne fait jamais échouer une inscription.
 */
final class Referrals
{
    public function __construct(private EntityManagerInterface $em) {}

    /** Rattache le nouveau compte à son parrain (avant le flush de la création) */
    public function apply(User $newUser, mixed $invite): void
    {
        $referrer = $this->findReferrer($invite, $newUser);
        if ($referrer) $newUser->setReferredBy($referrer)->setReferredAt(new \DateTimeImmutable());
    }

    public function findReferrer(mixed $invite, ?User $newUser = null): ?User
    {
        $code = is_string($invite) ? ltrim(trim($invite), '@') : '';
        if ($code === '' || mb_strlen($code) > 50) return null;

        $referrer = $this->em->getRepository(User::class)->createQueryBuilder('u')
            ->where('LOWER(u.username) = :code')->setParameter('code', mb_strtolower($code))
            ->setMaxResults(1)->getQuery()->getOneOrNullResult();
        if (!$referrer instanceof User || $referrer->getDeletionRequestedAt()) return null;
        if ($newUser && ($referrer === $newUser || mb_strtolower((string) $newUser->getPseudo()) === mb_strtolower($code))) return null;

        return $referrer;
    }

    public function count(User $user): int
    {
        return $this->em->getRepository(User::class)->count(['referredBy' => $user]);
    }

    /** @return User[] filleuls, du plus récent au plus ancien */
    public function referredBy(User $user): array
    {
        return $this->em->getRepository(User::class)->findBy(['referredBy' => $user], ['referredAt' => 'DESC', 'id' => 'DESC']);
    }
}
