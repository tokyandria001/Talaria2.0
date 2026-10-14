<?php

namespace App\Service;

use App\Entity\Trip;
use App\Entity\TripTraveler;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;

/** Réglages des participants d'un voyage (budget personnel, personnes rattachées) */
final class TravelerSettings
{
    public function __construct(private EntityManagerInterface $em, private TripAccess $access) {}

    /** Réglages de $user pour $trip (nouveaux, non enregistrés, s'il n'en a pas encore) */
    public function for(Trip $trip, User $user): TripTraveler
    {
        return $this->em->getRepository(TripTraveler::class)->findOneBy(['trip' => $trip, 'user' => $user])
            ?? (new TripTraveler())->setTrip($trip)->setUser($user);
    }

    /** @return array<int, TripTraveler> réglages de chaque participant actuel, par identifiant d'utilisateur */
    public function all(Trip $trip): array
    {
        $saved = [];
        foreach ($this->em->getRepository(TripTraveler::class)->findBy(['trip' => $trip]) as $t) {
            $saved[$t->getUser()->getId()] = $t;
        }
        $all = [];
        foreach ($this->access->participants($trip) as $u) {
            $all[$u->getId()] = $saved[$u->getId()] ?? (new TripTraveler())->setTrip($trip)->setUser($u);
        }
        return $all;
    }

    /** @return array<int, int> nombre de personnes (participant + rattachés) par identifiant d'utilisateur */
    public function heads(Trip $trip): array
    {
        return array_map(fn (TripTraveler $t) => $t->getHeads(), $this->all($trip));
    }

    /** Nombre total de voyageurs (participants et rattachés) */
    public function totalHeads(Trip $trip): int
    {
        return array_sum($this->heads($trip));
    }
}
